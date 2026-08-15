import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  clanAuditLog,
  clanMembers,
  completions,
  events,
  eventSignups,
  signupFees,
  teams,
  tiles,
  users,
} from '@/db/schema';
import { alias } from 'drizzle-orm/sqlite-core';
import { and, count, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { eventTileCount, isLadderFormat } from '@/lib/utils';
import { getSetupStatus } from '@/lib/setupStatus';
import SetupChecklist from '@/components/SetupChecklist';
import MemberCapNotice from '@/components/MemberCapNotice';
import { rosterCapStatus } from '@/lib/member-cap';
import { listEventIndex, type EventIndexItem } from '@/lib/eventIndex';
import { attentionQueue, openCount, type AttentionItem, type Severity } from '@/lib/adminAttention';
import { addDays, dayOf, daysBetween, findGaps, packLanes } from '@/lib/scheduleLanes';
import { dayKey, daysSince, parseStamp } from '@/lib/dbTime';

export const dynamic = 'force-dynamic';

/** Six weeks is as far ahead as anyone plans a clan event, and it fits on one strip. */
const RUNWAY_WEEKS = 6;

// Day windows compare the date PREFIX, not the whole string — these columns hold two timestamp
// formats and only the first ten characters mean the same thing in both. See lib/dbTime.
function sinceDay(column: unknown, now: number, daysAgo: number) {
  return sql`substr(${column}, 1, 10) >= ${dayKey(now, daysAgo)}`;
}

function betweenDays(column: unknown, now: number, fromDaysAgo: number, toDaysAgo: number) {
  return sql`substr(${column}, 1, 10) >= ${dayKey(now, fromDaysAgo)} AND substr(${column}, 1, 10) < ${dayKey(now, toDaysAgo)}`;
}

export default async function AdminDashboardPage() {
  // First-run: a brand-new clan (no name, no webhook, never dismissed) is sent straight
  // to the guided wizard once. It's always escapable, and skipping sets the advisory flag
  // so this never becomes a trap.
  const setup = await getSetupStatus();
  if (setup.isFresh) redirect('/admin/setup?welcome=1');
  // Read-only: the grace clock is started by the roster sync, never by someone opening a page.
  const capStatus = await rosterCapStatus();

  const now = Date.now();
  const today = dayOf(new Date(now));

  // Aliased so the audit feed can join users as the "actor" without colliding with any
  // other users join.
  const actor = alias(users, 'actor_user');

  const [
    index,
    boardRows,
    tileCountRows,
    teamCountRows,
    provisionalCount,
    activeMembers,
    seenThisWeek,
    joined7d,
    left7d,
    completions7d,
    completionsPrev7d,
    rawRecentAudit,
    feeCounts,
    oldestHeldFee,
  ] = await Promise.all([
    listEventIndex(),
    db.select().from(events).orderBy(desc(events.createdAt)),
    db.select({ eventId: tiles.eventId, n: count() }).from(tiles).groupBy(tiles.eventId),
    db.select({ eventId: teams.eventId, n: count() }).from(teams).groupBy(teams.eventId),
    db
      .select({ c: count() })
      .from(clanMembers)
      .where(and(eq(clanMembers.provisional, 1), isNull(clanMembers.leftAt)))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(clanMembers)
      // Exclude guests (is_guest=1) so "Active members" matches the real in-game clan
      // count — guests are plugin-pinged non-members. Unranked non-guests stay counted.
      .where(and(isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0)))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(clanMembers)
      .where(
        and(
          isNull(clanMembers.leftAt),
          eq(clanMembers.isGuest, 0),
          sinceDay(clanMembers.lastSeenInClan, now, 7),
        ),
      )
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(clanAuditLog)
      .where(and(eq(clanAuditLog.eventType, 'joined'), sinceDay(clanAuditLog.occurredAt, now, 7)))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(clanAuditLog)
      .where(and(eq(clanAuditLog.eventType, 'left'), sinceDay(clanAuditLog.occurredAt, now, 7)))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(completions)
      .where(sinceDay(completions.completedAt, now, 7))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(completions)
      .where(betweenDays(completions.completedAt, now, 14, 7))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({
        id: clanAuditLog.id,
        clanMemberId: clanAuditLog.clanMemberId,
        eventType: clanAuditLog.eventType,
        notes: clanAuditLog.notes,
        occurredAt: clanAuditLog.occurredAt,
        memberRsn: clanMembers.rsn,
        // Who performed the action. displayName preferred; fall back to the Discord
        // handle so a logged actor never renders as a blank "by".
        actorName: actor.displayName,
        actorUsername: actor.discordUsername,
      })
      .from(clanAuditLog)
      .leftJoin(clanMembers, eq(clanAuditLog.clanMemberId, clanMembers.id))
      .leftJoin(actor, eq(clanAuditLog.actorUserId, actor.id))
      .orderBy(desc(clanAuditLog.occurredAt))
      .limit(60),
    // Two different questions, which one number was conflating:
    //   owed    — nobody has the money yet (or it's disputed). Chase the player.
    //   toSign  — a mod HAS the money; it needs a second pair of eyes to close out. Chase staff.
    // Fees on a withdrawn/rejected sign-up are excluded outright: the player is gone and nothing
    // was collected, so they're dead rows that only ever inflated the badge (the fees API already
    // hides them from its own queue).
    db
      .select({ status: signupFees.status, c: count() })
      .from(signupFees)
      .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
      .where(
        and(
          inArray(signupFees.status, ['pending', 'reported', 'collected', 'disputed']),
          notInArray(eventSignups.status, ['withdrawn', 'rejected']),
        ),
      )
      .groupBy(signupFees.status)
      .then((rows) => {
        const by = new Map(rows.map((r) => [r.status, r.c]));
        return {
          owed: (by.get('pending') ?? 0) + (by.get('reported') ?? 0) + (by.get('disputed') ?? 0),
          toSign: by.get('collected') ?? 0,
        };
      }),
    // How long the oldest held fee has been sitting. A count alone never conveyed that some of
    // these have been waiting since last month.
    db
      .select({ at: signupFees.collectedAt })
      .from(signupFees)
      .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
      .where(
        and(
          eq(signupFees.status, 'collected'),
          notInArray(eventSignups.status, ['withdrawn', 'rejected']),
        ),
      )
      .orderBy(signupFees.collectedAt)
      .limit(1)
      .then((r) => r[0]?.at ?? null),
  ]);

  const tilesById = new Map(tileCountRows.map((r) => [r.eventId, r.n]));
  const teamsById = new Map(teamCountRows.map((r) => [r.eventId, r.n]));
  const boardById = new Map(boardRows.map((b) => [b.id, b]));

  const dated = index.filter((i) => i.startDate && i.endDate);
  const unscheduled = index
    .filter((i) => i.kind === 'board' && (!i.startDate || !i.endDate) && i.status !== 'ended')
    .map((i) => ({ id: i.id, name: i.title, href: i.href }));

  const running = dated.filter((i) => i.status === 'running');
  const nextUp = dated
    .filter((i) => Date.parse(i.startDate!) > now)
    .sort((a, b) => Date.parse(a.startDate!) - Date.parse(b.startDate!))[0];

  // The runway window, and the first hole in it that's still ahead of us.
  const runwayEnd = addDays(today, RUNWAY_WEEKS * 7);
  const runwaySpans = dated.map((i) => ({ start: dayOf(i.startDate!), end: dayOf(i.endDate!) }));
  const gap = findGaps(runwaySpans, today, runwayEnd, 2).find((g) => g.end >= today) ?? null;

  const queue = attentionQueue({
    now,
    events: index.map((i) => {
      const row = i.kind === 'board' ? boardById.get(i.id) : undefined;
      return {
        id: i.id,
        kind: i.kind,
        name: i.title,
        href: i.href,
        startDate: i.startDate,
        status: i.status,
        teamCount: teamsById.get(i.id) ?? 0,
        tileCount: tilesById.get(i.id) ?? 0,
        expectedTiles: row ? eventTileCount(row.format, row.scoringMode, row.boardSize) : 0,
        // A ladder is an individual leaderboard — teams are optional there, so never nag for them.
        needsTeams: row ? !isLadderFormat(row.format) : false,
      };
    }),
    feesOwed: feeCounts.owed,
    feesToSign: feeCounts.toSign,
    oldestFeeDays: daysSince(oldestHeldFee, now),
    pendingVerifications: provisionalCount,
    gap: gap ? { days: gap.days, startsInDays: Math.max(0, daysBetween(today, gap.start)) } : null,
    unscheduled,
  });

  // A single logical action (e.g. verifying a member) writes several audit rows —
  // 'renamed' + 'claimed' + 'verified' — and a member can be touched repeatedly, so the
  // raw feed reads as a wall of identical "Verified · X" lines. Collapse by
  // (member, eventType): keep the most recent occurrence and tally repeats as a ×N badge.
  // Rows with no member (system events like clan-sync joins) are keyed by id so they
  // never merge together.
  const collapsedAudit: Array<(typeof rawRecentAudit)[number] & { count: number }> = [];
  const auditIndex = new Map<string, number>();
  for (const a of rawRecentAudit) {
    const key = a.clanMemberId != null ? `m${a.clanMemberId}:${a.eventType}` : `r${a.id}`;
    const existing = auditIndex.get(key);
    if (existing != null) {
      collapsedAudit[existing].count += 1;
    } else {
      auditIndex.set(key, collapsedAudit.length);
      collapsedAudit.push({ ...a, count: 1 });
    }
  }
  const recentAudit = collapsedAudit.slice(0, 10);

  const netRoster = joined7d - left7d;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">
          {new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </h1>
        <p className="text-text-muted text-sm">
          {activeMembers} on the roster · {running.length} running · {openCount(queue)} waiting on you
        </p>
      </header>

      <MemberCapNotice status={capStatus} />

      {!setup.allDone && !setup.dismissed && (
        <SetupChecklist
          steps={setup.steps}
          completedCount={setup.completedCount}
          totalCount={setup.totalCount}
        />
      )}

      <NowBar running={running} nextUp={nextUp} now={now} />

      {/* What needs a human — the reason this page exists. */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Needs you
            <span className="text-xs text-text-muted font-normal">
              {openCount(queue) === 0 ? 'all clear' : `${openCount(queue)} open`}
            </span>
          </h2>
          <Link href="/admin/events" className="text-xs text-gold hover:text-gold-light">
            Manage events →
          </Link>
        </div>
        <div className="space-y-2">
          {queue.map((item) => (
            <AttentionCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      {/* Measurements, not counts. */}
      <section className="mt-8">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Pulse
          <span className="text-xs text-text-muted font-normal">last 7 days</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PulseTile
            label="Roster"
            value={activeMembers}
            delta={netRoster}
            sub={`${joined7d} joined · ${left7d} left`}
            href="/admin/clan"
          />
          <PulseTile
            label="Seen this week"
            value={seenThisWeek}
            share={activeMembers > 0 ? seenThisWeek / activeMembers : 0}
            sub={`of ${activeMembers} · ${Math.max(0, activeMembers - seenThisWeek)} idle`}
            href="/admin/clan"
          />
          <PulseTile
            label="Tiles completed"
            value={completions7d}
            delta={completions7d - completionsPrev7d}
            sub={
              running.length > 0
                ? `across ${running.length} live ${running.length === 1 ? 'event' : 'events'}`
                : 'nothing running'
            }
            href="/admin/events"
          />
          <PulseTile
            label="Waiting on staff"
            value={feeCounts.owed + feeCounts.toSign + provisionalCount}
            warn={feeCounts.toSign + provisionalCount > 0}
            sub={`${feeCounts.toSign} to sign · ${feeCounts.owed} to collect · ${provisionalCount} to verify`}
            href="/admin/fees"
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3 mt-8">
        <div className="lg:col-span-2 space-y-8">
          <Runway items={dated} today={today} weeks={RUNWAY_WEEKS} />
          <Activity rows={recentAudit} now={now} />
        </div>

        <aside className="space-y-6">
          <Snapshot
            running={running}
            activeMembers={activeMembers}
            provisionalCount={provisionalCount}
            feeCounts={feeCounts}
            unscheduled={unscheduled.length}
          />
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Now — what is live this second, and what rolls next.
   --------------------------------------------------------------------------- */

function NowBar({
  running,
  nextUp,
  now,
}: {
  running: EventIndexItem[];
  nextUp: EventIndexItem | undefined;
  now: number;
}) {
  return (
    <div className="grid gap-px sm:grid-cols-2 rounded-xl overflow-hidden border border-card-border bg-card-border">
      <div className="bg-card-bg p-4">
        {running.length === 0 ? (
          <>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">Running now</div>
            <div className="mt-2 text-sm text-text-muted">
              Nothing is live.{' '}
              <Link href="/admin/schedule" className="text-gold hover:underline">
                Check the schedule →
              </Link>
            </div>
          </>
        ) : (
          running.slice(0, 2).map((it, i) => {
            const start = Date.parse(it.startDate!);
            const end = Date.parse(it.endDate!);
            const pct = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
            return (
              <div key={`${it.kind}-${it.id}`} className={i > 0 ? 'mt-4 pt-4 border-t border-card-border' : ''}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green-light" />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-accent-green-light">
                    Running now
                  </span>
                  <span className="ml-auto text-[10px] text-text-muted">{remaining(end, now)}</span>
                </div>
                <Link href={it.href} className="block mt-1.5 font-semibold hover:text-gold transition-colors">
                  {it.title}
                </Link>
                <div className="text-xs text-text-muted mt-0.5">
                  {it.badge} · {it.headline}
                </div>
                <div className="h-1.5 rounded-full bg-brown-dark mt-2.5 overflow-hidden">
                  <span className="block h-full rounded-full bg-accent-green" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-card-bg p-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-blue-300">Up next</span>
          {nextUp && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
              {untilLabel(Date.parse(nextUp.startDate!), now)}
            </span>
          )}
        </div>
        {nextUp ? (
          <>
            <Link href={nextUp.href} className="block mt-1.5 font-semibold hover:text-gold transition-colors">
              {nextUp.title}
            </Link>
            <div className="text-xs text-text-muted mt-0.5">
              {nextUp.badge} · {nextUp.headline}
            </div>
            <div className="text-[11px] text-text-muted/70 mt-2.5">
              {new Date(nextUp.startDate!).toLocaleDateString()} →{' '}
              {new Date(nextUp.endDate!).toLocaleDateString()}
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm text-text-muted">
            Nothing queued.{' '}
            <Link href="/admin/events/new" className="text-gold hover:underline">
              Schedule one →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function remaining(end: number, now: number): string {
  const ms = end - now;
  if (ms <= 0) return 'ending';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d left`;
  return `${Math.max(1, Math.floor(ms / 3_600_000))}h left`;
}

function untilLabel(start: number, now: number): string {
  const ms = start - now;
  if (ms <= 0) return 'now';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `in ${days}d`;
  return `in ${Math.max(1, Math.floor(ms / 3_600_000))}h`;
}

/* ---------------------------------------------------------------------------
   One decision per card: what, why, and the button.
   --------------------------------------------------------------------------- */

const SEVERITY_STYLE: Record<Severity, { rail: string; chip: string; mark: string }> = {
  critical: { rail: 'border-l-accent-red', chip: 'bg-accent-red/15 text-red-300', mark: '!' },
  warn: { rail: 'border-l-yellow-500', chip: 'bg-yellow-500/15 text-yellow-400', mark: '!' },
  info: { rail: 'border-l-blue-500', chip: 'bg-blue-500/15 text-blue-300', mark: 'i' },
  clear: { rail: 'border-l-accent-green', chip: 'bg-accent-green/15 text-accent-green-light', mark: '✓' },
};

function AttentionCard({ item }: { item: AttentionItem }) {
  const s = SEVERITY_STYLE[item.severity];
  return (
    <div
      className={`flex items-center gap-3 border border-card-border border-l-[3px] ${s.rail} rounded-xl bg-card-bg p-3.5 ${
        item.severity === 'clear' ? 'opacity-70' : 'hover:bg-card-bg-hover transition-colors'
      }`}
    >
      <span className={`w-8 h-8 shrink-0 rounded-lg grid place-items-center text-sm font-bold ${s.chip}`}>
        {s.mark}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{item.title}</div>
        <div className="text-xs text-text-muted mt-0.5">{item.detail}</div>
      </div>
      <Link
        href={item.href}
        className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
          item.severity === 'critical'
            ? 'bg-gold text-brown-dark hover:bg-gold-light'
            : 'border border-card-border hover:border-gold/40 hover:text-gold'
        }`}
      >
        {item.action}
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Pulse — a number that means something next to the number it moved from.
   --------------------------------------------------------------------------- */

function PulseTile({
  label,
  value,
  delta,
  share,
  sub,
  warn,
  href,
}: {
  label: string;
  value: number;
  delta?: number;
  share?: number;
  sub: string;
  warn?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-card-border rounded-xl bg-card-bg p-4 hover:border-gold/40 transition-colors"
    >
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted/70">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-2xl font-semibold tabular-nums ${warn ? 'text-yellow-400' : ''}`}>{value}</span>
        {delta != null && delta !== 0 && (
          <span
            className={`text-xs font-semibold tabular-nums ${
              delta > 0 ? 'text-accent-green-light' : 'text-accent-red'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
        {share != null && (
          <span className="text-xs text-text-muted tabular-nums">{Math.round(share * 100)}%</span>
        )}
      </div>
      {share != null && (
        <div className="h-1 rounded-full bg-brown-dark mt-2.5 overflow-hidden">
          <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
      <div className="text-[10px] text-text-muted/70 mt-2">{sub}</div>
    </Link>
  );
}

/* ---------------------------------------------------------------------------
   Runway — six weeks of bars, so overlap and holes are visible at a glance.
   --------------------------------------------------------------------------- */

function Runway({ items, today, weeks }: { items: EventIndexItem[]; today: Date; weeks: number }) {
  const from = addDays(today, -7);
  const to = addDays(today, weeks * 7);
  const total = daysBetween(from, to) + 1;

  const inWindow = items.filter((i) => dayOf(i.endDate!) >= from && dayOf(i.startDate!) <= to);
  const laid = packLanes(inWindow, (i) => ({ start: dayOf(i.startDate!), end: dayOf(i.endDate!) }));
  const lanes = Math.max(1, Math.max(0, ...laid.map((l) => l.lane)) + 1);
  const todayPct = (daysBetween(from, today) / total) * 100;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Runway
          <span className="text-xs text-text-muted font-normal">next {weeks} weeks</span>
        </h2>
        <Link href="/admin/schedule" className="text-xs text-gold hover:text-gold-light">
          Full schedule →
        </Link>
      </div>

      <div className="border border-card-border rounded-xl bg-card-bg p-4">
        {inWindow.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">
            Nothing runs in the next {weeks} weeks.{' '}
            <Link href="/admin/events/new" className="text-gold hover:underline">
              Schedule something →
            </Link>
          </p>
        ) : (
          <div className="relative" style={{ height: `${lanes * 26}px` }}>
            {laid.map((l) => {
              const left = Math.max(0, (daysBetween(from, l.start) / total) * 100);
              const width = Math.min(100 - left, ((daysBetween(l.start, l.end) + 1) / total) * 100);
              const tone =
                l.item.status === 'running'
                  ? 'bg-accent-green/15 text-accent-green-light border-accent-green/40'
                  : l.item.status === 'upcoming'
                    ? l.item.kind === 'board'
                      ? 'bg-gold/15 text-gold-light border-gold/40'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                    : 'bg-text-muted/10 text-text-muted border-text-muted/30';
              return (
                <Link
                  key={`${l.item.kind}-${l.item.id}`}
                  href={l.item.href}
                  title={`${l.item.title} · ${l.item.headline}`}
                  style={{ left: `${left}%`, width: `${width}%`, top: `${l.lane * 26}px` }}
                  className={`absolute h-[22px] rounded-md border flex items-center px-2 text-[10px] font-semibold overflow-hidden whitespace-nowrap hover:brightness-125 transition-[filter] ${tone}`}
                >
                  <span className="truncate">{l.item.title}</span>
                </Link>
              );
            })}
            <span
              className="absolute top-0 bottom-0 w-px bg-gold/60 pointer-events-none"
              style={{ left: `${todayPct}%` }}
              aria-hidden
            />
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Activity — grouped by day, written as sentences.
   --------------------------------------------------------------------------- */

/** Both timestamp formats, rendered in the reader's own timezone. See lib/dbTime. */
function formatDay(stamp: string): string {
  const ms = parseStamp(stamp);
  return ms == null
    ? '—'
    : new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function formatTime(stamp: string): string {
  const ms = parseStamp(stamp);
  return ms == null ? '' : new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const AUDIT_TONE: Record<string, string> = {
  joined: 'bg-accent-green/15 text-accent-green-light',
  left: 'bg-accent-red/15 text-red-300',
  verified: 'bg-accent-green/15 text-accent-green-light',
  claimed: 'bg-accent-green/15 text-accent-green-light',
  user_signed_up: 'bg-accent-green/15 text-accent-green-light',
  renamed: 'bg-gold/15 text-gold',
  rank_changed: 'bg-gold/15 text-gold',
};

function Activity({
  rows,
  now,
}: {
  rows: Array<{
    id: number;
    eventType: string;
    notes: string | null;
    occurredAt: string;
    memberRsn: string | null;
    actorName: string | null;
    actorUsername: string | null;
    count: number;
  }>;
  now: number;
}) {
  // Group by calendar day so the feed reads as "today, then yesterday" rather than a wall with
  // a date stamped on every line.
  const groups: { label: string; rows: typeof rows }[] = [];
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(now, 1);
  for (const row of rows) {
    const key = row.occurredAt.slice(0, 10);
    const label =
      key === todayKey
        ? 'Today'
        : key === yesterdayKey
          ? 'Yesterday'
          : formatDay(row.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Activity
        </h2>
        <Link href="/admin/clan/audit" className="text-xs text-gold hover:text-gold-light">
          Full log →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
          Nothing logged yet.
        </div>
      ) : (
        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-4 py-2 bg-brown-dark/40 border-b border-card-border text-[10px] uppercase tracking-[0.14em] text-text-muted/70">
                {g.label}
              </div>
              <ul className="divide-y divide-card-border">
                {g.rows.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-lg grid place-items-center text-[11px] ${
                        AUDIT_TONE[a.eventType] ?? 'bg-brown-light text-text-muted'
                      }`}
                    >
                      {a.eventType === 'left' ? '−' : a.eventType === 'joined' ? '+' : '·'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        {a.memberRsn && <span className="font-semibold">{a.memberRsn}</span>}
                        {a.memberRsn && ' '}
                        <span className="text-text-muted">{a.eventType.replace(/_/g, ' ')}</span>
                        {a.count > 1 && (
                          <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold/15 text-gold/90 align-middle">
                            ×{a.count}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted/70 truncate">
                        {(a.actorName || a.actorUsername) && <>by {a.actorName || a.actorUsername}</>}
                        {(a.actorName || a.actorUsername) && a.notes && ' · '}
                        {a.notes}
                      </div>
                    </div>
                    <span className="text-[11px] text-text-muted/70 shrink-0 tabular-nums">
                      {formatTime(a.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Snapshot — the rest of the clan in one column of links.
   --------------------------------------------------------------------------- */

function Snapshot({
  running,
  activeMembers,
  provisionalCount,
  feeCounts,
  unscheduled,
}: {
  running: EventIndexItem[];
  activeMembers: number;
  provisionalCount: number;
  feeCounts: { owed: number; toSign: number };
  unscheduled: number;
}) {
  const weekly = running.find((r) => r.kind === 'weekly');
  return (
    <section>
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Snapshot
      </h2>
      <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
        <SnapshotRow
          label="This week's competition"
          value={weekly?.title ?? 'none running'}
          href="/admin/weekly"
        />
        <SnapshotRow
          label="Pending mod review"
          value={`${provisionalCount} member${provisionalCount === 1 ? '' : 's'}`}
          href="/admin/clan/needs-review"
          emphasize={provisionalCount > 0}
        />
        <SnapshotRow label="Roster size" value={`${activeMembers} active`} href="/admin/clan" />
        <SnapshotRow
          label="Fees to collect"
          value={`${feeCounts.owed} fee${feeCounts.owed === 1 ? '' : 's'}`}
          href="/admin/fees"
          emphasize={feeCounts.owed > 0}
        />
        {feeCounts.toSign > 0 && (
          <SnapshotRow label="Fees awaiting sign-off" value={`${feeCounts.toSign} paid`} href="/admin/fees" />
        )}
        {unscheduled > 0 && (
          <SnapshotRow
            label="Boards without dates"
            value={`${unscheduled} waiting`}
            href="/admin/schedule"
            emphasize
          />
        )}
      </div>
    </section>
  );
}

function SnapshotRow({
  label,
  value,
  href,
  emphasize,
}: {
  label: string;
  value: string;
  href: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-card-bg-hover transition-colors"
    >
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
        <div className={`text-sm font-medium truncate ${emphasize ? 'text-yellow-400' : ''}`}>{value}</div>
      </div>
      <span className="text-text-muted text-xs">→</span>
    </Link>
  );
}
