'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LocalTime from '@/components/LocalTime';
import { eventTileCount, eventShapeBadge } from '@/lib/utils';
import { formatGp, formatWeeklyGain, SPARK_DAYS } from '@/lib/adminEventsFormat';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import type {
  AttentionItem,
  PastEventResult,
  RunningEventSummary,
  SetupProgress,
} from '@/lib/adminEventsOverview';

export interface EventRow {
  kind: 'event';
  id: number;
  name: string;
  boardSize: number;
  format: string;
  scoringMode: string;
  rules?: string | null; // game rules JSON (lib/eventRules) — names reveal modes in the badge
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  createdAt: string;
  teamCount: number;
  tilesRevealed: boolean;
}

export interface WeeklyRow {
  kind: 'weekly';
  id: number;
  title: string;
  type: 'skill' | 'boss' | 'efficiency';
  metric: string;
  status: string;
  startDate: string;
  endDate: string;
  participantCount: number;
  createdAt: string;
}

export type ListItem = EventRow | WeeklyRow;

interface Props {
  running: ListItem[];
  upcoming: ListItem[];
  past: ListItem[];
  // Admins manage events (create/delete); bingo editors only open a board's Tiles tab.
  canManage: boolean;
  summaries: Record<number, RunningEventSummary>;
  setup: Record<number, SetupProgress>;
  pastResults: Record<number, PastEventResult>;
  pastWeekly: Record<number, { winner: string | null; gained: number | null; players: number }>;
  attention: AttentionItem[];
}

export default function EventsClient({
  running,
  upcoming,
  past,
  canManage,
  summaries,
  setup,
  pastResults,
  pastWeekly,
  attention,
}: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function deleteEvent(event: EventRow) {
    if (!confirm(`Permanently delete "${event.name}"? This wipes its tiles, teams, completions, and signups.`)) {
      return;
    }
    setDeletingId(event.id);
    try {
      const res = await clanFetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete event');
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  // The first running thing gets the hero; anything else running gets a one-line strip under it.
  // Two boards at once is normal (a bingo plus a weekly); five hero cards would not be.
  const [hero, ...alsoRunning] = running;
  // "Next opens" means the next SCHEDULED thing — an undated draft sits in the list but isn't a date.
  const nextScheduled = upcoming.find((i) => i.startDate);

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Events</h1>
          <p className="text-text-muted text-sm">
            {running.length} running · {upcoming.length} being set up · {past.length} finished
            {nextScheduled?.startDate && (
              <>
                {' · next opens '}
                <span className="text-foreground">
                  <LocalTime date={nextScheduled.startDate} format="date" />
                </span>
              </>
            )}
          </p>
        </div>
        {canManage && (
          <ClanLink
            href="/admin/events/new"
            className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors shadow-sm shadow-gold/20"
          >
            + New event
          </ClanLink>
        )}
      </header>

      {running.length > 0 && (
        <section className="mb-8">
          <SectionHead color="bg-accent-green" title="Running now">
            <span className="text-xs text-text-muted/60 font-normal">updates on refresh</span>
          </SectionHead>
          {hero.kind === 'event' ? (
            <RunningEventHero event={hero} summary={summaries[hero.id]} canManage={canManage} />
          ) : (
            <RunningWeeklyHero comp={hero} />
          )}
          {alsoRunning.length > 0 && (
            <div className="mt-2.5 grid gap-2">
              {alsoRunning.map((item) =>
                item.kind === 'event' ? (
                  <AlsoRunningRow
                    key={`e${item.id}`}
                    href={`/admin/events/${item.id}`}
                    title={item.name}
                    detail={`${eventShapeBadge(item.format, item.scoringMode, item.boardSize, item.rules)} · ${
                      item.teamCount
                    } team${item.teamCount === 1 ? '' : 's'}`}
                    endDate={item.endDate}
                  />
                ) : (
                  <AlsoRunningRow
                    key={`w${item.id}`}
                    href={`/admin/events/weekly/${item.id}`}
                    title={item.title}
                    detail={`${item.type === 'boss' ? 'BOTW' : item.type === 'efficiency' ? 'Efficiency' : 'SOTW'} · ${
                      item.participantCount
                    } players`}
                    endDate={item.endDate}
                  />
                ),
              )}
            </div>
          )}
        </section>
      )}

      {attention.length > 0 && (
        <section className="mb-8">
          <SectionHead color="bg-amber-400" title="Needs you">
            <span className="text-xs text-text-muted/60 font-normal">
              {attention.length} item{attention.length === 1 ? '' : 's'}
            </span>
          </SectionHead>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((item, i) => (
              <AttentionCard key={`${item.kind}-${i}`} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <SectionHead color="bg-gold" title="Being set up">
          {upcoming.length > 0 && <span className="text-xs text-text-muted/60 font-normal">{upcoming.length}</span>}
        </SectionHead>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
            Nothing scheduled.{' '}
            {canManage && (
              <ClanLink href="/admin/events/new" className="text-gold hover:underline">
                Plan the next one →
              </ClanLink>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((item) =>
              item.kind === 'event' ? (
                <SetupCard
                  key={`e${item.id}`}
                  event={item}
                  progress={setup[item.id]}
                  canManage={canManage}
                  deleting={deletingId === item.id}
                  onDelete={() => deleteEvent(item)}
                />
              ) : (
                <WeeklyCard key={`w${item.id}`} comp={item} />
              ),
            )}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <SectionHead color="bg-text-muted" title="Finished">
            <span className="text-xs text-text-muted/60 font-normal">{past.length}</span>
          </SectionHead>
          <PastTable
            past={past}
            results={pastResults}
            weekly={pastWeekly}
            canManage={canManage}
            deletingId={deletingId}
            onDelete={deleteEvent}
          />
          {canManage && <BackfillFacts />}
        </section>
      )}
    </div>
  );
}

function SectionHead({ color, title, children }: { color: string; title: string; children?: React.ReactNode }) {
  return (
    <h2 className="font-semibold flex items-center gap-2 mb-3">
      <span className={`w-1 h-5 ${color} rounded-full`} />
      {title}
      {children}
    </h2>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Running                                                                                       */
/* -------------------------------------------------------------------------------------------- */

/**
 * The live board, given the room it earns.
 *
 * Everything on it is a real read (lib/adminEventsOverview): completions, submissions per day,
 * enrolled players and the same standings the scoreboard uses. The card that used to say
 * "0 teams · 150 tiles" is the thing the person running the event actually looks at.
 */
function RunningEventHero({
  event,
  summary,
  canManage,
}: {
  event: EventRow;
  summary?: RunningEventSummary;
  canManage: boolean;
}) {
  const tilesTotal = summary?.tilesTotal || eventTileCount(event.format, event.scoringMode, event.boardSize);
  const cleared = summary?.tilesCleared ?? 0;
  const pct = tilesTotal > 0 ? Math.min(100, Math.round((cleared / tilesTotal) * 100)) : 0;
  const elapsed = timeProgress(event.startDate, event.endDate);

  return (
    <div className="border border-gold/30 rounded-xl bg-card-bg overflow-hidden grid lg:grid-cols-[1.35fr_1fr]">
      <div className="p-5 bg-gradient-to-br from-gold/[0.07] to-transparent min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
          <span className="text-accent-green-light font-semibold">LIVE</span>
          <span>·</span>
          <span className="bg-gold/15 text-gold/90 px-2 py-0.5 rounded-full font-medium">
            {eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
          </span>
          {!event.tilesRevealed && (
            <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full font-medium">Tiles hidden</span>
          )}
          <span>
            {event.teamCount} team{event.teamCount === 1 ? '' : 's'}
            {summary ? ` · ${summary.playersTotal} players` : ''}
          </span>
        </div>

        <ClanLink href={`/admin/events/${event.id}`} className="block group">
          <h3 className="text-xl font-bold group-hover:text-gold transition-colors">{event.name}</h3>
        </ClanLink>

        <div className="flex items-baseline gap-2 mt-3 mb-1.5">
          <span className="text-2xl font-bold tabular-nums">{elapsed.remainingLabel}</span>
          <span className="text-xs text-text-muted">
            {elapsed.dayLabel}
            {event.endDate && (
              <>
                {' · ends '}
                <LocalTime date={event.endDate} format="datetime" />
              </>
            )}
          </span>
        </div>
        {/* Two different journeys, stacked: how much of the WINDOW has gone (gold) against how much
            of the BOARD is done (green). A board 20% cleared on day 12 is the thing you want to see. */}
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden relative">
          <div className="h-full rounded-full bg-gold/70" style={{ width: `${elapsed.pct}%` }} />
          <div
            className="absolute inset-y-0 left-0 border-r-2 border-accent-green/80"
            style={{ width: `${pct}%` }}
            title={`${pct}% of the board cleared`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Stat value={`${cleared}`} suffix={`/${tilesTotal}`} label="Tiles cleared" />
          <Stat value={String(summary?.submissionsToday ?? 0)} label="Drops today" />
          <Stat
            value={String(summary?.activePlayers ?? 0)}
            suffix={summary ? `/${summary.playersTotal}` : undefined}
            label="Active players"
            tone={summary && summary.playersTotal > 0 && summary.activePlayers === 0 ? 'warn' : undefined}
          />
          {/* Who's gone quiet is the one number here you'd actually act on — a team with nothing
              credited in two days is usually a team that needs a nudge, not a team that's losing. */}
          <Stat
            value={String(summary?.idleTeams ?? 0)}
            label="Idle teams"
            tone={summary && summary.idleTeams > 0 ? 'warn' : undefined}
          />
        </div>

        {summary && summary.dailySubmissions.some((n) => n > 0) && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-1.5">
              Submissions · last {SPARK_DAYS} days
            </p>
            <Sparkline values={summary.dailySubmissions} />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-card-border">
          <ClanLink
            href={`/admin/events/${event.id}`}
            className="px-3 py-1.5 text-xs font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors"
          >
            Open board
          </ClanLink>
          <ClanLink
            href={`/admin/events/${event.id}/stats`}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border hover:border-gold/50 transition-colors"
          >
            Stats
          </ClanLink>
          {canManage && (
            <ClanLink
              href={`/admin/events/${event.id}/teams`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border hover:border-gold/50 transition-colors"
            >
              Rosters
            </ClanLink>
          )}
          <ClanLink
            href={`/events/${event.id}`}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-text-muted hover:text-foreground transition-colors ml-auto"
          >
            Player view ↗
          </ClanLink>
        </div>
      </div>

      <div className="p-5 border-t lg:border-t-0 lg:border-l border-card-border bg-black/15 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-2.5">Standings</p>
        {summary && summary.standings.length > 0 ? (
          <div className="space-y-1">
            {summary.standings.map((row, i) => (
              <div key={row.teamId} className="grid grid-cols-[14px_1fr_auto] gap-2.5 items-center text-xs py-0.5">
                <span className="text-text-muted/70 tabular-nums">{i + 1}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{row.name}</span>
                  <span className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden min-w-[24px]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${row.pct}%`, background: row.color || '#d4a017' }}
                    />
                  </span>
                </span>
                <span className={`tabular-nums ${i === 0 ? 'text-gold' : ''}`}>{row.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">Nothing scored yet.</p>
        )}

        <p className="text-[10px] uppercase tracking-wider text-text-muted/70 mt-5 mb-2">Latest</p>
        {summary && summary.latest.length > 0 ? (
          <div className="divide-y divide-card-border/60">
            {summary.latest.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="w-5 h-5 rounded-md bg-accent-green/15 text-accent-green-light grid place-items-center text-[10px] flex-shrink-0">
                  ✓
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {c.player && <span className="font-semibold">{c.player} </span>}
                  <span className="text-text-muted">{c.player ? 'cleared' : 'Cleared'} </span>
                  <span>{c.tile}</span>
                  {c.team && <span className="text-text-muted"> · {c.team}</span>}
                </span>
                <span className="text-[10px] text-text-muted/70 tabular-nums flex-shrink-0">{ago(c.at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No completions yet.</p>
        )}
      </div>
    </div>
  );
}

function RunningWeeklyHero({ comp }: { comp: WeeklyRow }) {
  const elapsed = timeProgress(comp.startDate, comp.endDate);
  const badge = comp.type === 'boss' ? 'BOTW' : comp.type === 'efficiency' ? 'Efficiency' : 'SOTW';
  return (
    <div className="border border-purple-400/30 rounded-xl bg-card-bg p-5 bg-gradient-to-br from-purple-400/[0.06] to-transparent">
      <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        <span className="text-accent-green-light font-semibold">LIVE</span>
        <span>·</span>
        <span className="bg-purple-400/15 text-purple-300 px-2 py-0.5 rounded-full font-medium">{badge}</span>
        <span className="capitalize">{comp.metric.replace(/_/g, ' ')}</span>
        <span>·</span>
        <span>{comp.participantCount} players</span>
      </div>
      <ClanLink href={`/admin/events/weekly/${comp.id}`} className="block group">
        <h3 className="text-xl font-bold group-hover:text-purple-300 transition-colors">{comp.title}</h3>
      </ClanLink>
      <div className="flex items-baseline gap-2 mt-3 mb-1.5">
        <span className="text-2xl font-bold tabular-nums">{elapsed.remainingLabel}</span>
        <span className="text-xs text-text-muted">
          {elapsed.dayLabel} · ends <LocalTime date={comp.endDate} format="datetime" />
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-purple-400" style={{ width: `${elapsed.pct}%` }} />
      </div>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-card-border">
        <ClanLink
          href={`/admin/events/weekly/${comp.id}`}
          className="px-3 py-1.5 text-xs font-semibold bg-purple-400/20 text-purple-200 hover:bg-purple-400/30 rounded-lg transition-colors"
        >
          Open competition
        </ClanLink>
        <ClanLink
          href={`/weekly/${comp.id}`}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-text-muted hover:text-foreground transition-colors ml-auto"
        >
          Player view ↗
        </ClanLink>
      </div>
    </div>
  );
}

function AlsoRunningRow({
  href,
  title,
  detail,
  endDate,
}: {
  href: string;
  title: string;
  detail: string;
  endDate: string | null;
}) {
  return (
    <ClanLink
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-card-border bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
      <span className="text-sm font-medium truncate">{title}</span>
      <span className="text-xs text-text-muted truncate hidden sm:block">{detail}</span>
      {endDate && (
        <span className="text-xs text-text-muted ml-auto flex-shrink-0">{timeProgress(null, endDate).remainingLabel} left</span>
      )}
    </ClanLink>
  );
}

function Stat({
  value,
  suffix,
  label,
  tone,
}: {
  value: string;
  suffix?: string;
  label: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={`px-3 py-2 rounded-lg border bg-black/20 ${
        tone === 'warn' ? 'border-amber-400/40 bg-amber-400/10' : 'border-card-border'
      }`}
    >
      <div className={`text-lg font-bold tabular-nums ${tone === 'warn' ? 'text-amber-300' : ''}`}>
        {value}
        {suffix && <span className="text-xs text-text-muted font-normal">{suffix}</span>}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted/70 mt-0.5">{label}</div>
    </div>
  );
}

/** Submissions per day. Drawn rather than charted — it's 14 numbers, not a dashboard. */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 300;
  const h = 40;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`);
  const last = points[points.length - 1]?.split(',') ?? ['0', '0'];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10" aria-hidden>
      <polygon points={`0,${h} ${points.join(' ')} ${w},${h}`} fill="rgba(212,160,23,0.16)" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#d4a017"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="#f0c940" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Needs you                                                                                     */
/* -------------------------------------------------------------------------------------------- */

function AttentionCard({ item }: { item: AttentionItem }) {
  const tone =
    item.severity === 'urgent'
      ? { ring: 'border-red-500/30 hover:border-red-400/50', chip: 'bg-red-500/15 text-red-400', icon: '!' }
      : item.severity === 'warn'
        ? { ring: 'border-amber-400/30 hover:border-amber-400/50', chip: 'bg-amber-400/15 text-amber-300', icon: '◷' }
        : { ring: 'border-card-border hover:border-gold/40', chip: 'bg-gold/15 text-gold', icon: '·' };

  return (
    <ClanLink href={item.href} className={`flex gap-3 items-start p-3 rounded-xl border bg-card-bg transition-colors ${tone.ring}`}>
      <span className={`w-6 h-6 rounded-lg grid place-items-center text-xs flex-shrink-0 ${tone.chip}`}>{tone.icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold truncate">{item.title}</span>
        <span className="block text-xs text-text-muted truncate">{item.detail}</span>
      </span>
    </ClanLink>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Being set up                                                                                  */
/* -------------------------------------------------------------------------------------------- */

/**
 * An unstarted event, described by what's left to do.
 *
 * The five segments are the five things that have to be true before a board can open, in the order
 * you'd naturally do them — so a half-built event reads as a progress bar rather than a card that
 * happens to say "0 teams".
 */
function SetupCard({
  event,
  progress,
  canManage,
  deleting,
  onDelete,
}: {
  event: EventRow;
  progress?: SetupProgress;
  canManage: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const expected = progress?.tilesExpected ?? eventTileCount(event.format, event.scoringMode, event.boardSize);
  const authored = progress?.tilesAuthored ?? 0;
  const isDraft = !event.startDate;
  const steps = [
    { done: expected > 0 && authored >= expected, label: authored >= expected ? 'Tiles' : `Tiles ${authored}/${expected}` },
    { done: (progress?.teamCount ?? 0) > 0, label: progress?.teamCount ? `${progress.teamCount} teams` : 'Teams' },
    { done: (progress?.assignedPlayers ?? 0) > 0, label: progress?.assignedPlayers ? 'Rostered' : 'Rosters' },
    { done: !!event.startDate && !!event.endDate, label: 'Dates' },
    { done: (progress?.blockers.length ?? 1) === 0, label: 'Startable' },
  ];

  return (
    <div className="group relative border border-card-border rounded-xl bg-card-bg hover:border-gold/40 transition-colors">
      <ClanLink href={canManage ? `/admin/events/${event.id}` : `/admin/events/${event.id}/tiles`} className="block p-4">
        <div className="flex items-start justify-between gap-2 pr-7">
          <h3 className="font-semibold group-hover:text-gold transition-colors">{event.name}</h3>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              isDraft ? 'bg-yellow-500/15 text-yellow-300' : 'bg-blue-500/15 text-blue-400'
            }`}
          >
            {isDraft ? 'Draft' : 'Upcoming'}
          </span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          {eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
          {progress ? ` · ${progress.signupCount} signed up` : ''}
          {event.startDate ? (
            <>
              {' · starts '}
              <LocalTime date={event.startDate} format="date" />
            </>
          ) : (
            ' · no dates yet'
          )}
        </p>

        <div className="flex gap-1 mt-3">
          {steps.map((s, i) => (
            <span
              key={i}
              className={`flex-1 h-1 rounded-full ${s.done ? 'bg-accent-green' : i === 0 && authored > 0 ? 'bg-amber-400' : 'bg-white/[0.07]'}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
          {steps.map((s, i) => (
            <span key={i} className={s.done ? 'text-text-muted' : 'text-amber-300/90'}>
              {s.done ? '✓ ' : ''}
              {s.label}
            </span>
          ))}
        </div>

        {progress && progress.blockers.length > 0 && (
          <p className="text-[11px] text-amber-300/90 mt-2 line-clamp-1">Can&apos;t start — {progress.blockers[0]}</p>
        )}
      </ClanLink>

      <div className="px-4 pb-4 -mt-1 flex gap-2">
        <ClanLink
          href={`/admin/events/${event.id}/${(progress?.teamCount ?? 0) === 0 ? 'teams' : 'tiles'}`}
          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
        >
          Continue setup →
        </ClanLink>
      </div>

      {canManage && (
        <DeleteButton label={event.name} deleting={deleting} onDelete={onDelete} />
      )}
    </div>
  );
}

// Read-only mirror of a weekly (SOTW/BOTW) competition. Clicking deep-links to the
// dedicated Competitions surface — this list is for visibility, not management.
function WeeklyCard({ comp }: { comp: WeeklyRow }) {
  const badge = comp.type === 'boss' ? 'BOTW' : comp.type === 'efficiency' ? 'Efficiency' : 'SOTW';
  return (
    <ClanLink
      href={`/admin/events/weekly/${comp.id}`}
      className="group relative block p-4 border border-card-border rounded-xl bg-card-bg hover:border-purple-400/40 hover:bg-card-bg-hover transition-colors"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-semibold flex items-center gap-2 group-hover:text-purple-300 transition-colors">
          <span aria-hidden>🏆</span>
          {comp.title}
        </h3>
        <span className="text-xs bg-purple-400/15 text-purple-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
          {badge}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="capitalize">{comp.metric.replace(/_/g, ' ')}</span>
        <span>·</span>
        <span>
          {comp.participantCount} player{comp.participantCount !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-[10px] text-text-muted/70 mt-2">
        <LocalTime date={comp.startDate} format="date" /> — <LocalTime date={comp.endDate} format="date" />
      </p>
    </ClanLink>
  );
}

function DeleteButton({ label, deleting, onDelete }: { label: string; deleting: boolean; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      }}
      disabled={deleting}
      aria-label={`Delete event ${label}`}
      title="Delete event"
      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
    >
      {deleting ? (
        <span className="text-[10px]">…</span>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Finished                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/**
 * Finished events as records, not cards.
 *
 * Eleven past events took up two thirds of this page as identical tiles carrying a team count.
 * As rows they carry the things people come back for — who won, how many played, what it paid —
 * and a missing winner is now visible (and fixable) rather than silently absent.
 */
function PastTable({
  past,
  results,
  weekly,
  canManage,
  deletingId,
  onDelete,
}: {
  past: ListItem[];
  results: Record<number, PastEventResult>;
  weekly: Record<number, { winner: string | null; gained: number | null; players: number }>;
  canManage: boolean;
  deletingId: number | null;
  onDelete: (event: EventRow) => void;
}) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-text-muted/70">
            <th className="text-left font-medium px-4 py-2.5">Event</th>
            <th className="text-left font-medium px-3 py-2.5 hidden sm:table-cell">Format</th>
            <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Ran</th>
            <th className="text-left font-medium px-3 py-2.5">Winner</th>
            <th className="text-right font-medium px-3 py-2.5 hidden sm:table-cell">Players</th>
            <th className="text-right font-medium px-3 py-2.5 hidden lg:table-cell">Payout</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {past.map((item) =>
            item.kind === 'event' ? (
              <PastEventRow
                key={`e${item.id}`}
                event={item}
                result={results[item.id]}
                canManage={canManage}
                deleting={deletingId === item.id}
                onDelete={() => onDelete(item)}
              />
            ) : (
              <PastWeeklyRow key={`w${item.id}`} comp={item} result={weekly[item.id]} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function PastEventRow({
  event,
  result,
  canManage,
  deleting,
  onDelete,
}: {
  event: EventRow;
  result?: PastEventResult;
  canManage: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const href = canManage ? `/admin/events/${event.id}` : `/admin/events/${event.id}/tiles`;
  return (
    <tr className="border-t border-card-border/70 group hover:bg-white/[0.02]">
      <td className="px-4 py-2.5">
        <ClanLink href={href} className="font-medium hover:text-gold transition-colors">
          {event.name}
        </ClanLink>
        {event.forceEndedAt && <span className="ml-2 text-[10px] text-red-400">force-ended</span>}
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <span className="text-xs bg-gold/10 text-gold/80 px-2 py-0.5 rounded-full">
          {eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-text-muted tabular-nums hidden md:table-cell">
        {event.startDate && event.endDate ? (
          <>
            <LocalTime date={event.startDate} format="date" /> — <LocalTime date={event.endDate} format="date" />
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">
        {result?.winnerTeam ? (
          <span className="text-gold">
            🥇 {result.winnerTeam}
            {result.winnerScore != null && (
              <span className="text-text-muted"> · {Math.round(result.winnerScore).toLocaleString()}</span>
            )}
          </span>
        ) : (
          <span className="text-text-muted/70">no result recorded</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-right tabular-nums text-text-muted hidden sm:table-cell">
        {result?.players ?? 0}
      </td>
      <td className="px-3 py-2.5 text-xs text-right tabular-nums hidden lg:table-cell">
        {result && result.payoutTotal > 0 ? (
          <span className={result.payoutsUnpaid > 0 ? 'text-amber-300' : 'text-text-muted'}>
            {formatGp(result.payoutTotal)}
            {result.payoutsUnpaid > 0 && <span className="text-[10px]"> · {result.payoutsUnpaid} unpaid</span>}
          </span>
        ) : (
          <span className="text-text-muted/50">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {canManage && (
          <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity inline-flex gap-1">
            <ClanLink
              href={`/admin/events/${event.id}/payouts`}
              className="px-2 py-1 text-xs rounded-md border border-card-border hover:border-gold/50 transition-colors"
            >
              Payouts
            </ClanLink>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              aria-label={`Delete event ${event.name}`}
              className="px-2 py-1 text-xs rounded-md border border-card-border text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

function PastWeeklyRow({
  comp,
  result,
}: {
  comp: WeeklyRow;
  result?: { winner: string | null; gained: number | null; players: number };
}) {
  const badge = comp.type === 'boss' ? 'BOTW' : comp.type === 'efficiency' ? 'Efficiency' : 'SOTW';
  return (
    <tr className="border-t border-card-border/70 group hover:bg-white/[0.02]">
      <td className="px-4 py-2.5">
        <ClanLink href={`/admin/events/weekly/${comp.id}`} className="font-medium hover:text-purple-300 transition-colors">
          {comp.title}
        </ClanLink>
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <span className="text-xs bg-purple-400/10 text-purple-300/90 px-2 py-0.5 rounded-full">{badge}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-text-muted tabular-nums hidden md:table-cell">
        <LocalTime date={comp.startDate} format="date" /> — <LocalTime date={comp.endDate} format="date" />
      </td>
      <td className="px-3 py-2.5 text-xs">
        {result?.winner ? (
          <span className="text-gold">
            🥇 {result.winner}
            {result.gained != null && (
              <span className="text-text-muted"> · {formatWeeklyGain(comp.type, result.gained)}</span>
            )}
          </span>
        ) : (
          <span className="text-text-muted/70">no result recorded</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-right tabular-nums text-text-muted hidden sm:table-cell">
        {result?.players ?? comp.participantCount}
      </td>
      <td className="px-3 py-2.5 text-xs text-right text-text-muted/50 hidden lg:table-cell">—</td>
      <td className="px-3 py-2.5" />
    </tr>
  );
}

/**
 * Rebuild per-player results for events that ended before those were recorded.
 *
 * Without it, a member who played five bingos reads "0 events played" on their profile — the results
 * were never materialized, and the repo script that does it can't run on a hosted instance (the
 * production image ships no scripts and no tsx). It sits under the finished table because that's
 * exactly what it repairs: the "no result recorded" rows above.
 */
function BackfillFacts() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await clanFetch('/api/admin/events/backfill-facts', { method: 'POST' });
      const data = (await res.json()) as {
        written?: { name: string }[];
        skipped?: number;
        failed?: { name: string }[];
        totalRows?: number;
        error?: string;
      };
      if (!res.ok) {
        setResult(data.error ?? 'Failed.');
      } else {
        const parts = [`${data.written?.length ?? 0} events rebuilt (${data.totalRows ?? 0} player results)`];
        if (data.skipped) parts.push(`${data.skipped} already had results`);
        if (data.failed?.length) parts.push(`${data.failed.length} failed`);
        setResult(parts.join(' · '));
        router.refresh();
      }
    } catch {
      setResult('Network error.');
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border border-card-border/70 rounded-xl bg-card-bg/50">
      <p className="text-xs text-text-muted max-w-prose">
        Missing a winner above? Rebuild fills in per-player points and placings for events that finished before
        those were recorded. Safe to run more than once.
      </p>
      <div className="flex items-center gap-3">
        {result && <p className="text-xs text-gold">{result}</p>}
        <button
          onClick={run}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded-lg border border-card-border hover:border-gold/50 disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? 'Rebuilding…' : 'Rebuild results'}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Time                                                                                          */
/* -------------------------------------------------------------------------------------------- */

/**
 * How far through its window an event is.
 *
 * Rendered on the server as static text (no ticking clock) — the list is a force-dynamic page, so
 * every load recomputes it, and a countdown that updates per second belongs on the event itself.
 */
function timeProgress(startDate: string | null, endDate: string | null) {
  const now = Date.now();
  const start = startDate ? Date.parse(startDate) : null;
  const end = endDate ? Date.parse(endDate) : null;

  if (!end) {
    return { pct: 0, remainingLabel: 'Open-ended', dayLabel: start ? `day ${dayNumber(start, now)}` : '' };
  }

  const remaining = Math.max(0, end - now);
  const pct = start && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
  const totalDays = start ? Math.max(1, Math.round((end - start) / 86_400_000)) : null;

  return {
    pct,
    remainingLabel: humanDuration(remaining),
    dayLabel: start ? `day ${dayNumber(start, now)}${totalDays ? ` of ${totalDays}` : ''}` : '',
  };
}

function dayNumber(start: number, now: number): number {
  return Math.max(1, Math.floor((now - start) / 86_400_000) + 1);
}

function humanDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
