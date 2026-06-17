import Link from 'next/link';
import { db } from '@/db';
import {
  clanAuditLog,
  clanMembers,
  events,
  signupFees,
  teams,
  weeklyCompetitions,
} from '@/db/schema';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { eventShapeBadge } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));
  const teamCounts = new Map<number, number>();
  if (allEvents.length > 0) {
    const counts = await db
      .select({ eventId: teams.eventId, count: count() })
      .from(teams)
      .groupBy(teams.eventId);
    for (const row of counts) teamCounts.set(row.eventId, row.count);
  }
  const now = new Date().toISOString();
  const activeEvents = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });
  const pastEvents = allEvents.filter((e) => !!e.forceEndedAt || (!!e.endDate && e.endDate < now));

  const [provisionalCount, activeMembers, activeWeekly, rawRecentAudit, openFeeCount] = await Promise.all([
    db
      .select({ c: count() })
      .from(clanMembers)
      .where(and(eq(clanMembers.provisional, 1), isNull(clanMembers.leftAt)))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(clanMembers)
      .where(isNull(clanMembers.leftAt))
      .then((r) => r[0]?.c ?? 0),
    db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.status, 'active') }),
    db
      .select({
        id: clanAuditLog.id,
        clanMemberId: clanAuditLog.clanMemberId,
        eventType: clanAuditLog.eventType,
        notes: clanAuditLog.notes,
        occurredAt: clanAuditLog.occurredAt,
        memberRsn: clanMembers.rsn,
      })
      .from(clanAuditLog)
      .leftJoin(clanMembers, eq(clanAuditLog.clanMemberId, clanMembers.id))
      .orderBy(desc(clanAuditLog.occurredAt))
      .limit(60),
    db
      .select({ c: count() })
      .from(signupFees)
      .where(inArray(signupFees.status, ['pending', 'reported', 'collected', 'disputed']))
      .then((r) => r[0]?.c ?? 0),
  ]);

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
  const recentAudit = collapsedAudit.slice(0, 8);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Dashboard</h1>
        <p className="text-text-muted text-sm">Overview of clan activity and live events.</p>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatTile label="Active members" value={activeMembers} />
        <StatTile label="Active events" value={activeEvents.length} accent={activeEvents.length > 0} />
        <StatTile label="Pending verifications" value={provisionalCount} warn={provisionalCount > 0} />
        <StatTile label="Past events" value={pastEvents.length} muted />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Active events */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <span className="w-1 h-5 bg-accent-green rounded-full" />
                Active Events
              </h2>
              <Link href="/admin/events" className="text-xs text-gold hover:text-gold-light">
                Manage events →
              </Link>
            </div>
            {activeEvents.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
                No active events.{' '}
                <Link href="/admin/events" className="text-gold hover:underline">
                  Create one →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeEvents.map((e) => {
                  const numTeams = teamCounts.get(e.id) || 0;
                  const hasStarted = e.startDate && e.startDate <= now;
                  return (
                    <Link
                      key={e.id}
                      href={`/admin/events/${e.id}`}
                      className="group flex items-center justify-between border border-card-border rounded-xl p-4 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold group-hover:text-gold transition-colors">{e.name}</span>
                          {hasStarted ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                          <span className="bg-gold/15 text-gold px-1.5 py-0.5 rounded-full">
                            {eventShapeBadge(e.format, e.scoringMode, e.boardSize)}
                          </span>
                          <span>
                            {numTeams} team{numTeams !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-text-muted text-sm group-hover:text-gold transition-colors">→</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent audit */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                Recent activity
              </h2>
              <Link href="/admin/clan/audit" className="text-xs text-gold hover:text-gold-light">
                Full log →
              </Link>
            </div>
            {recentAudit.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
                Nothing logged yet.
              </div>
            ) : (
              <ul className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
                {recentAudit.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="text-gold capitalize">{a.eventType.replace(/_/g, ' ')}</span>
                        {a.memberRsn && <span className="text-text-muted"> · {a.memberRsn}</span>}
                        {a.count > 1 && (
                          <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold/15 text-gold/90 align-middle">
                            ×{a.count}
                          </span>
                        )}
                      </div>
                      {a.notes && <div className="text-[11px] text-text-muted truncate">{a.notes}</div>}
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0">
                      {new Date(a.occurredAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Quick context */}
          <section>
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <span className="w-1 h-5 bg-gold rounded-full" />
              Snapshot
            </h2>
            <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
              <SnapshotRow label="This week's competition" value={activeWeekly?.title ?? '—'} href="/admin/weekly" />
              <SnapshotRow
                label="Pending mod review"
                value={`${provisionalCount} member${provisionalCount === 1 ? '' : 's'}`}
                href="/admin/verifications"
                emphasize={provisionalCount > 0}
              />
              <SnapshotRow label="Roster size" value={`${activeMembers} active`} href="/admin/clan" />
              <SnapshotRow
                label="Open sign-up fees"
                value={`${openFeeCount} fee${openFeeCount === 1 ? '' : 's'}`}
                href="/admin/fees"
                emphasize={openFeeCount > 0}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
  warn,
  muted,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  warn?: boolean;
  muted?: boolean;
}) {
  const valueClass = warn
    ? 'text-yellow-400'
    : accent
      ? 'text-accent-green-light'
      : muted
        ? 'text-text-muted'
        : 'text-foreground';
  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</div>
    </div>
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
