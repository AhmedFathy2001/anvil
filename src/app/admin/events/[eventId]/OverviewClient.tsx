'use client';

import type { Event, Tile, Team, Completion, Submission } from '@/lib/types';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EventBoard from '@/components/EventBoard';
import BoardFilters from '@/components/BoardFilters';
import TileDetailModal from '@/components/TileDetailModal';
import MissionAdminPanel from '@/components/MissionAdminPanel';
import StartProofAdminPanel from '@/components/StartProofAdminPanel';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import { isPointsMode, eventNoun } from '@/lib/utils';
import { eventAxes, supportsMissions } from '@/lib/eventAxes';
import { DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { STAGE_BLURB, type EventStage, type StageCounts } from '@/lib/eventStage';
import { findBoardProblems, type BoardProblem } from '@/lib/boardMisconfig';
import LiveFixPanel from './LiveFixPanel';
import type { RecordedTeamResult } from '@/lib/adminEventsOverview';

/** One superlative, flattened for display — see lib/eventRecap. */
export interface RecapAwardSummary {
  key: string;
  emoji: string;
  title: string;
  winner: string;
  value: string;
  team: string | null;
}

interface Props {
  event: Event;
  tiles: Tile[];
  teams: Team[];
  completions: Completion[];
  stage: EventStage;
  counts: StageCounts;
  /** Finished events only: the standings as recorded when the event ended (lib/adminEventsOverview). */
  recorded?: RecordedTeamResult[];
  /** Finished events only: the top superlatives (lib/eventRecap), already formatted. */
  awards?: RecapAwardSummary[];
  tierBands?: TierBand[];
}

/**
 * The event's home, which is a different page in each of its three stages.
 *
 * Before it opens you're getting it to the start line, so home is a checklist that names what's
 * blocking and links to the tab that fixes it. While it runs you want what's happening and what
 * needs a decision. Once it's over the job is finite: settle up, tell the story, file it away.
 *
 * Configuration (shape, dates, reveal policy, editors, delete) moved to ./settings — it was
 * crowding out the thing people check ten times a day.
 */
export default function OverviewClient({
  event,
  tiles,
  teams,
  completions,
  stage,
  counts,
  recorded = [],
  awards = [],
  tierBands = DEFAULT_TIER_BANDS,
}: Props) {
  const router = useRouter();
  const [currentEvent, setCurrentEvent] = useState(event);
  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles);
  const [liveCompletions, setLiveCompletions] = useState<Completion[]>(completions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [matchedTileIds, setMatchedTileIds] = useState<Set<number> | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

  const { connected: streamConnected } = useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setLiveCompletions(data.completions);
      setLocalTiles(data.tiles);
    }, []),
  });

  // All teams' submissions (full rows incl. proof images) for the click-through management modal.
  // Fetched directly — the event stream carries a lighter projection without imageUrl.
  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions`);
    if (res.ok) setSubmissions(await res.json());
  }, [event.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void fetchSubmissions();
  }, [fetchSubmissions]);

  const pointsMode = isPointsMode(currentEvent.scoringMode);
  const noun = eventNoun(currentEvent.format);

  // Standings, computed from the same rows the board draws, so they follow the live stream without
  // a second request. Mirrors lib/statStandings: optional tiles don't score, and a points board
  // uses each completion's frozen award where it has one.
  const standings = useMemo(() => {
    const weight = new Map(
      localTiles.filter((t) => !t.optional).map((t) => [t.id, pointsMode ? (t.points ?? 0) : 1]),
    );
    return teams
      .map((team) => ({
        team,
        score: liveCompletions
          .filter((c) => c.teamId === team.id && weight.has(c.tileId))
          .reduce(
            (sum, c) =>
              sum + (pointsMode && c.awardedPoints != null ? c.awardedPoints : weight.get(c.tileId) ?? 0),
            0,
          ),
        tiles: liveCompletions.filter((c) => c.teamId === team.id && weight.has(c.tileId)).length,
      }))
      .sort((a, b) => b.score - a.score || a.team.name.localeCompare(b.team.name));
  }, [teams, liveCompletions, localTiles, pointsMode]);

  const topScore = standings[0]?.score ?? 0;

  // Recomputed from the streamed tiles, so fixing a tile clears it from the panel without a reload.
  const problems = useMemo(
    () => findBoardProblems(localTiles, { pointsMode }),
    [localTiles, pointsMode],
  );
  const hasStatTiles = useMemo(() => localTiles.some((t) => !!t.trackedStat), [localTiles]);

  // All-teams submission management from the board: click a tile to see/manage every team's proofs.
  const teamNameById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t.name])), [teams]);
  const selectedTile = localTiles.find((t) => t.id === selectedTileId) ?? null;
  const selectedTileSubmissions = selectedTileId ? submissions.filter((s) => s.tileId === selectedTileId) : [];
  const selectedTileCompletedBy = selectedTileId
    ? liveCompletions
        .filter((c) => c.tileId === selectedTileId)
        .map((c) => {
          const t = teams.find((tm) => tm.id === c.teamId);
          return { teamId: c.teamId, teamName: t?.name ?? 'Team', color: t?.color ?? '#888' };
        })
    : [];

  async function deleteSubmission(submissionId: number, reason: string) {
    await fetch(
      `/api/events/${event.id}/submissions?submissionId=${submissionId}&reason=${encodeURIComponent(reason)}`,
      { method: 'DELETE' },
    );
    setSubmissions((list) => list.filter((s) => s.id !== submissionId));
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-text-muted -mt-2">{STAGE_BLURB[stage]}</p>

      {stage === 'build' && (
        <BuildHome
          event={currentEvent}
          counts={counts}
          noun={noun}
          onEventChange={(e) => {
            setCurrentEvent(e);
            router.refresh();
          }}
        />
      )}

      {stage === 'run' && (
        <RunHome
          problems={problems}
          hasStatTiles={hasStatTiles}
          event={currentEvent}
          counts={counts}
          standings={standings}
          topScore={topScore}
          pointsMode={pointsMode}
          streamConnected={streamConnected}
          completions={liveCompletions}
          tiles={localTiles}
          teams={teams}
          onEventChange={(e) => {
            setCurrentEvent(e);
            router.refresh();
          }}
        />
      )}

      {stage === 'wrap' && (
        <WrapHome
          event={currentEvent}
          counts={counts}
          standings={standings}
          recorded={recorded}
          awards={awards}
          pointsMode={pointsMode}
          onEventChange={(e) => {
            setCurrentEvent(e);
            router.refresh();
          }}
        />
      )}

      {/* Missions — mid-event hidden-objective controls. Hidden on a ladder, whose whole board is
          already a pool of announced objectives, and after the event ends. */}
      {stage !== 'wrap' && (
        <MissionAdminPanel
          event={currentEvent}
          tiles={localTiles}
          allowed={supportsMissions(eventAxes(currentEvent))}
        />
      )}

      {/* Starting shot — the anti-stack proof everyone files at the start (lib/startProof). Turned
          on while building; becomes the review list once the event is live. */}
      {stage !== 'wrap' && <StartProofAdminPanel event={currentEvent} />}

      {/* Board — search, filter, and click any tile to manage every team's submissions in one place. */}
      <div className="min-w-0">
        <SectionTitle
          sub={
            stage === 'build'
              ? 'A preview of what members will see. Click a tile to check how it reads.'
              : 'Click any tile to see and manage submissions from every team.'
          }
        >
          Board
        </SectionTitle>
        <BoardFilters tiles={localTiles} tierBands={tierBands} pointsMode={pointsMode} onMatched={setMatchedTileIds} />
        <EventBoard
          format={currentEvent.format}
          tiles={localTiles}
          boardSize={currentEvent.boardSize}
          completions={liveCompletions}
          teams={teams}
          pointsMode={pointsMode}
          onTileClick={setSelectedTileId}
          matchedTileIds={matchedTileIds}
        />
      </div>

      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={false}
          canManage={true}
          canToggle={false}
          onDelete={deleteSubmission}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamNameById={teamNameById}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Build — get it to the start line                                                              */
/* -------------------------------------------------------------------------------------------- */

function BuildHome({
  event,
  counts,
  noun,
  onEventChange,
}: {
  event: Event;
  counts: StageCounts;
  noun: string;
  onEventChange: (e: Event) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const base = `/admin/events/${event.id}`;
  const tilesDone = counts.expectedTiles > 0 && counts.tileCount >= counts.expectedTiles;
  const blocked = counts.blockers.length > 0;

  const checks: CheckRow[] = [
    {
      done: tilesDone,
      title: tilesDone ? `${counts.tileCount} tiles authored` : `${counts.tileCount} of ${counts.expectedTiles} tiles written`,
      detail: tilesDone ? 'The board is complete.' : 'Paste a list, draw from the library, or generate from the collection log.',
      href: `${base}/tiles`,
      action: tilesDone ? 'Review' : 'Write tiles',
      blocking: false,
    },
    {
      done: counts.teamCount > 0 && counts.assignedPlayers > 0,
      title:
        counts.teamCount === 0
          ? 'No teams yet'
          : counts.assignedPlayers === 0
            ? `${counts.teamCount} teams, nobody assigned`
            : `${counts.teamCount} teams · ${counts.assignedPlayers} players`,
      detail: blocked ? capitalise(counts.blockers[0]) : 'Draft them, or assign straight from the roster.',
      href: `${base}/teams`,
      action: counts.teamCount === 0 ? 'Set up teams' : 'Open draft',
      blocking: blocked,
    },
    {
      done: !!event.startDate && !!event.endDate,
      title: event.startDate
        ? `Runs from ${new Date(event.startDate).toLocaleDateString()}`
        : 'No dates set',
      detail: event.startDate
        ? event.endDate
          ? 'Starts and ends on schedule.'
          : 'Open-ended — it runs until you end it.'
        : `The ${noun} can still be started by hand, but nothing is scheduled.`,
      href: `${base}/settings`,
      action: 'Edit dates',
      blocking: false,
    },
    {
      done: counts.pendingSignups === 0,
      title:
        counts.pendingSignups > 0
          ? `${counts.pendingSignups} sign-up${counts.pendingSignups === 1 ? '' : 's'} waiting`
          : `${counts.signupCount} signed up`,
      detail: counts.pendingSignups > 0 ? 'Review and approve before the draft.' : 'Nobody is waiting on a decision.',
      href: `${base}/signups`,
      action: 'Open sign-ups',
      blocking: false,
    },
    {
      done: !!event.tilesRevealed,
      title: event.tilesRevealed ? 'Tiles are visible to members' : 'Tiles are hidden from members',
      detail: event.tilesRevealed
        ? 'Members can read the board before it starts.'
        : 'Fine either way — just decide on purpose before the start.',
      href: `${base}/settings`,
      action: 'Change',
      blocking: false,
    },
  ];

  async function startNow(force = false) {
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-now', ...(force ? { force: true } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onEventChange(data);
        return;
      }
      // 409 = the readiness gate (lib/eventReadiness) refused. It's overridable for the warnings
      // that aren't really blockers (an event with no end date), so offer the override in words.
      if (res.status === 409 && data.overridable) {
        if (confirm(`${data.error}\n\nStart it anyway?`)) {
          await startNow(true);
          return;
        }
      } else {
        setError(data.error || 'Could not start the event.');
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="border border-gold/30 rounded-xl bg-card-bg overflow-hidden">
      <div className="p-5 bg-gradient-to-br from-gold/[0.07] to-transparent">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Before this can start
          </h2>
          {blocked ? (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
              {counts.blockers.length} blocking
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-accent-green/15 text-accent-green-light border border-accent-green/30">
              Ready to go
            </span>
          )}
        </div>

        <div className="space-y-2">
          {checks.map((c) => (
            <CheckRowView key={c.title} row={c} />
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-card-border flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => startNow()}
            disabled={starting || blocked}
            title={blocked ? counts.blockers.join(' · ') : undefined}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gold hover:bg-gold-light text-brown-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {starting ? 'Starting…' : `Start the ${noun} now`}
          </button>
          <span className="text-xs text-text-muted flex-1 min-w-[200px]">
            {blocked
              ? `Can't start yet — ${counts.blockers[0]}.`
              : event.startDate
                ? 'Or leave it — it starts on schedule by itself.'
                : 'Nothing is scheduled, so it only starts when you say so.'}
          </span>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="px-5 py-4 border-t border-card-border bg-black/10">
        <p className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-2">Worth checking first</p>
        <div className="flex flex-wrap gap-2">
          <QuietLink href={`/events/${event.id}`}>See the player&apos;s view ↗</QuietLink>
          <QuietLink href={`/admin/events/${event.id}/tiles`}>Check the board balance</QuietLink>
          <QuietLink href="/admin/announce">Send a test announcement</QuietLink>
        </div>
      </div>
    </section>
  );
}

interface CheckRow {
  done: boolean;
  title: string;
  detail: string;
  href: string;
  action: string;
  blocking: boolean;
}

function CheckRowView({ row }: { row: CheckRow }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        row.blocking
          ? 'border-amber-400/40 bg-amber-400/10'
          : 'border-card-border bg-black/15'
      }`}
    >
      <span
        className={`w-6 h-6 rounded-full grid place-items-center text-xs flex-shrink-0 border ${
          row.done
            ? 'border-accent-green/50 text-accent-green bg-accent-green/10'
            : row.blocking
              ? 'border-amber-400/50 text-amber-300 bg-amber-400/10'
              : 'border-card-border text-text-muted'
        }`}
      >
        {row.done ? '✓' : row.blocking ? '!' : '·'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{row.title}</span>
        <span className={`block text-xs ${row.blocking ? 'text-amber-300/90' : 'text-text-muted'}`}>{row.detail}</span>
      </span>
      <Link
        href={row.href}
        className="px-2.5 py-1 text-xs rounded-lg border border-card-border hover:border-gold/50 hover:text-gold transition-colors whitespace-nowrap"
      >
        {row.action}
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Run — what's happening, what needs a decision                                                 */
/* -------------------------------------------------------------------------------------------- */

function RunHome({
  event,
  counts,
  problems,
  hasStatTiles,
  standings,
  topScore,
  pointsMode,
  streamConnected,
  completions,
  tiles,
  teams,
  onEventChange,
}: {
  event: Event;
  counts: StageCounts;
  problems: BoardProblem[];
  hasStatTiles: boolean;
  standings: { team: Team; score: number; tiles: number }[];
  topScore: number;
  pointsMode: boolean;
  streamConnected: boolean;
  completions: Completion[];
  tiles: Tile[];
  teams: Team[];
  onEventChange: (e: Event) => void;
}) {
  const [ending, setEnding] = useState(false);
  const base = `/admin/events/${event.id}`;

  const tileById = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const recent = useMemo(
    () =>
      [...completions]
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
        .slice(0, 8),
    [completions],
  );

  const scored = tiles.filter((t) => !t.optional).length;
  const cleared = new Set(completions.map((c) => c.tileId)).size;

  async function forceEnd() {
    if (!confirm('Force-end this event? It ends immediately and notifies Discord.')) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-end' }),
      });
      if (res.ok) onEventChange(await res.json());
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="space-y-6">
      <LiveFixPanel eventId={event.id} problems={problems} hasStatTiles={hasStatTiles} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] items-start">
      <section className="border border-card-border rounded-xl bg-card-bg p-5 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-accent-green rounded-full" />
            Live activity
          </h2>
          {/* This is the DATA connection, not the event's state — it used to just say "Live", which
              read as "the event is live" right next to a Draft badge. */}
          <span
            className="flex items-center gap-1.5 text-xs text-text-muted"
            title={
              streamConnected
                ? 'This page is streaming updates — completions appear without a refresh.'
                : 'Reconnecting to the update stream. This says nothing about whether the event is running.'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
            {streamConnected ? 'Streaming' : 'Reconnecting…'}
          </span>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing completed yet. Drops credit themselves as the plugin sees them.
          </p>
        ) : (
          <div className="divide-y divide-card-border">
            {recent.map((c) => {
              const tile = tileById.get(c.tileId);
              const team = teamById.get(c.teamId);
              return (
                <div key={c.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-6 h-6 rounded-md bg-accent-green/15 text-accent-green-light grid place-items-center text-[11px] flex-shrink-0">
                    ✓
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{tile?.label ?? 'A tile'}</span>
                    {team && <span className="text-text-muted"> · {team.name}</span>}
                  </span>
                  <span className="text-[11px] text-text-muted/70 tabular-nums flex-shrink-0" suppressHydrationWarning>
                    {new Date(c.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-card-border flex flex-wrap gap-2">
          <QuietLink href={`${base}/stats`}>Stats &amp; per-member breakdown</QuietLink>
          <QuietLink href={`${base}/teams`}>Rosters &amp; subs</QuietLink>
          <button
            type="button"
            onClick={forceEnd}
            disabled={ending}
            className="ml-auto px-2.5 py-1 text-xs rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {ending ? 'Ending…' : 'End it now'}
          </button>
        </div>
      </section>

      <div className="space-y-6 min-w-0">
        <StandingsPanel standings={standings} topScore={topScore} pointsMode={pointsMode} />

        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-text-muted rounded-full" />
            Health
          </h2>
          <div className="space-y-2.5 text-sm">
            <Meter label="Board cleared" value={cleared} total={scored} />
            <Meter label="Teams scoring" value={standings.filter((s) => s.score > 0).length} total={standings.length} />
            {counts.pendingSignups > 0 && (
              <p className="text-xs text-amber-300">
                {counts.pendingSignups} sign-up{counts.pendingSignups === 1 ? '' : 's'} still waiting on a decision.
              </p>
            )}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Wrap — settle up, tell the story, file it away                                                */
/* -------------------------------------------------------------------------------------------- */

function WrapHome({
  event,
  counts,
  standings,
  recorded,
  awards,
  pointsMode,
  onEventChange,
}: {
  event: Event;
  counts: StageCounts;
  standings: { team: Team; score: number; tiles: number }[];
  recorded: RecordedTeamResult[];
  awards: RecapAwardSummary[];
  pointsMode: boolean;
  onEventChange: (e: Event) => void;
}) {
  const [resuming, setResuming] = useState(false);
  const base = `/admin/events/${event.id}`;
  const unit = pointsMode ? 'pts' : 'tiles';
  // Prefer what was banked when the event ended; fall back to the live computation for events that
  // finished before results were recorded (the ones "Rebuild results" on the events list repairs).
  const podium = recorded.length
    ? recorded.slice(0, 3).map((r) => ({ id: r.teamId, name: r.name, score: r.points }))
    : standings.slice(0, 3).map((s) => ({ id: s.team.id, name: s.team.name, score: s.score }));
  const fromRecord = recorded.length > 0;

  async function resume() {
    if (!confirm('Resume this event? It goes back to running and members can submit again.')) return;
    setResuming(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      if (res.ok) onEventChange(await res.json());
    } finally {
      setResuming(false);
    }
  }

  return (
    <div className="space-y-6">
      {podium.length > 0 && (
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Final standings
            {!fromRecord && (
              <span className="text-[10px] font-normal uppercase tracking-wider text-text-muted/70">
                computed live — no recorded result
              </span>
            )}
          </h2>
          <div className="grid grid-cols-3 gap-2 items-end">
            {[podium[1], podium[0], podium[2]].map((row, i) =>
              row ? (
                <div
                  key={row.id}
                  className={`rounded-lg border p-3 text-center ${
                    i === 1
                      ? 'border-gold/40 bg-gradient-to-b from-gold/15 to-gold/[0.04] pb-5'
                      : 'border-card-border bg-black/15'
                  }`}
                >
                  <div className="text-lg">{i === 1 ? '🥇' : i === 0 ? '🥈' : '🥉'}</div>
                  <div className="text-sm font-semibold mt-1 truncate">{row.name}</div>
                  <div className={`text-xs tabular-nums ${i === 1 ? 'text-gold' : 'text-text-muted'}`}>
                    {Math.round(row.score).toLocaleString()} {unit}
                  </div>
                </div>
              ) : (
                <div key={`empty-${i}`} />
              ),
            )}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <NextStep
          href={`${base}/payouts`}
          title={counts.unpaidPayouts > 0 ? `${counts.unpaidPayouts} payouts owed` : counts.payoutCount > 0 ? 'All paid' : 'Set the payouts'}
          detail={
            counts.unpaidPayouts > 0
              ? 'Mark each winner paid, with a screenshot.'
              : counts.payoutCount > 0
                ? 'Nothing outstanding.'
                : 'Prizes are generated from the split when an event ends.'
          }
          tone={counts.unpaidPayouts > 0 ? 'attn' : counts.payoutCount > 0 ? 'done' : undefined}
        />
        <NextStep
          href={`${base}/survey`}
          title={counts.surveyResponses > 0 ? `${counts.surveyResponses} survey replies` : counts.hasSurvey ? 'Survey is out' : 'No survey'}
          detail={
            counts.surveyResponses > 0
              ? 'Read what people said before planning the next one.'
              : counts.hasSurvey
                ? 'Nudge people in the recap post — replies roughly double.'
                : 'Ask a few questions while the event is fresh.'
          }
          tone={counts.surveyResponses > 0 ? 'done' : undefined}
        />
        <NextStep
          href={`${base}/stats`}
          title="The story"
          detail={
            awards.length > 0
              ? `${awards.length} award${awards.length === 1 ? '' : 's'} worked out — plus the per-member breakdown.`
              : 'The per-member breakdown behind the result.'
          }
        />
      </div>

      {awards.length > 0 && (
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <span className="w-1 h-5 bg-violet-400 rounded-full" />
            Worth telling people
          </h2>
          <p className="text-sm text-text-muted mb-3">
            Worked out from what actually happened — the same awards the recap post uses.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {awards.map((a) => (
              <div key={a.key} className="flex items-center gap-3 p-3 rounded-lg border border-card-border bg-black/15">
                <span aria-hidden className="text-lg flex-shrink-0">{a.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-wider text-text-muted/70">{a.title}</span>
                  <span className="block text-sm font-medium truncate">{a.winner}</span>
                  {a.team && <span className="block text-[11px] text-text-muted truncate">{a.team}</span>}
                </span>
                <span className="text-xs tabular-nums text-gold flex-shrink-0">{a.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border border-card-border rounded-xl bg-card-bg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-text-muted rounded-full" />
          Run it again
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
          <QuietLink href={`${base}/settings`}>Clone or save as a template</QuietLink>
          {event.forceEndedAt && (
            <button
              type="button"
              onClick={resume}
              disabled={resuming}
              className="px-2.5 py-1 text-xs rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            >
              {resuming ? 'Resuming…' : 'Resume the event'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Shared bits                                                                                   */
/* -------------------------------------------------------------------------------------------- */

function StandingsPanel({
  standings,
  topScore,
  pointsMode,
}: {
  standings: { team: Team; score: number; tiles: number }[];
  topScore: number;
  pointsMode: boolean;
}) {
  if (standings.length === 0) return null;
  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Standings
      </h2>
      <div className="space-y-1">
        {standings.map((row, i) => (
          <div key={row.team.id} className="grid grid-cols-[14px_1fr_auto] gap-2.5 items-center text-sm py-0.5">
            <span className="text-xs text-text-muted/70 tabular-nums">{i + 1}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate">{row.team.name}</span>
              <span className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden min-w-[24px]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${topScore > 0 ? Math.round((row.score / topScore) * 100) : 0}%`,
                    background: row.team.color || '#d4a017',
                  }}
                />
              </span>
            </span>
            <span className={`tabular-nums text-xs ${i === 0 ? 'text-gold' : 'text-text-muted'}`}>
              {row.score.toLocaleString()} {pointsMode ? 'pts' : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums">
          {value} / {total}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-accent-green" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NextStep({
  href,
  title,
  detail,
  tone,
}: {
  href: string;
  title: string;
  detail: string;
  tone?: 'attn' | 'done';
}) {
  return (
    <Link
      href={href}
      className={`block p-4 rounded-xl border transition-colors ${
        tone === 'attn'
          ? 'border-amber-400/40 bg-amber-400/10 hover:border-amber-400/60'
          : 'border-card-border bg-card-bg hover:border-gold/40'
      }`}
    >
      <div className={`text-sm font-semibold ${tone === 'attn' ? 'text-amber-300' : tone === 'done' ? 'text-accent-green-light' : ''}`}>
        {title}
      </div>
      <p className="text-xs text-text-muted mt-1">{detail}</p>
    </Link>
  );
}

function QuietLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
    >
      {children}
    </Link>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <>
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        {children}
      </h2>
      {sub && <p className="text-sm text-text-muted mb-3">{sub}</p>}
    </>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
