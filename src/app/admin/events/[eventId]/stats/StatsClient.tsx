'use client';

import type { Event, Team, Tile, Player } from '@/lib/types';
import type { StatTileStanding, TeamStanding } from '@/lib/statStandings';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import { isPointsMode } from '@/lib/utils';
import { computeMemberBreakdown, type StatGainMap } from '@/lib/memberBreakdown';
import MemberBreakdown from '@/components/MemberBreakdown';
import PlayerBaselineEditor from '@/components/PlayerBaselineEditor';
import { clanFetch } from '@/lib/clanFetch';

// Every hiscores action (snapshot / refresh / reset) fans out a request per enrolled player, so
// after a manual pull we lock the pull buttons for a cooldown to stop spam-clicking from hammering
// the OSRS hiscores. Persisted server-side (see the snapshot route) so it survives a page refresh.
const COOLDOWN_SECS = 30 * 60; // 30 minutes, alongside the hourly auto-refresh cron

// Cooldown label, e.g. "29m 04s" or "12s".
function fmtCooldown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

interface Props {
  event: Event;
  teams: Team[];
  tiles: Tile[];
  players: Player[];
  statStandings: StatTileStanding[];
  teamStandings: TeamStanding[];
  // ISO time of the last manual stat pull (persisted), or null. Seeds the cooldown across refreshes.
  statsPulledAt: string | null;
}

// Only the submission fields the activity rollup needs — keeps us decoupled from the
// stream's exact Submission shape.
interface ActivitySubmission {
  teamId: number;
  tileId: number;
  creditPlayerId: number | null;
  creditPlayerName?: string | null;
  amount: number;
}

export default function StatsClient({ event, teams, tiles, players, statStandings, teamStandings, statsPulledAt }: Props) {
  const router = useRouter();
  // Which player's baseline editor is open (per-row "Fix baseline" on the standings table).
  const [baselinePlayer, setBaselinePlayer] = useState<{ id: number; name: string } | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [forceResetting, setForceResetting] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [lastStatsRefresh, setLastStatsRefresh] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(0); // seconds left before hiscores actions re-enable
  const [snapshotResult, setSnapshotResult] = useState<{
    snapshotted: number;
    refreshed?: number;
    failed: string[];
    error?: string;
  } | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [completions, setCompletions] = useState<
    { teamId: number; tileId: number; statContributions?: { goal: number; total: number; split: { playerId: number; gained: number }[] } | null }[]
  >([]);
  const [breakdownTeams, setBreakdownTeams] = useState<Set<number>>(new Set());
  const [standingsQuery, setStandingsQuery] = useState('');

  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();
  // Seed the cooldown from the persisted last-pull time so it survives a page refresh. Runs in an
  // effect (not the initializer) to avoid an SSR/client clock hydration mismatch.
  useEffect(() => {
    if (!statsPulledAt) return;
    const elapsed = (Date.now() - new Date(statsPulledAt).getTime()) / 1000;
    const remaining = Math.max(0, Math.ceil(COOLDOWN_SECS - elapsed));
    if (remaining > 0) setCooldown(remaining);
  }, [statsPulledAt]);

  // Tick the cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setSubmissions(
        data.submissions.map((s) => ({
          teamId: s.teamId,
          tileId: s.tileId,
          creditPlayerId: s.creditPlayerId,
          creditPlayerName: s.creditPlayerName,
          amount: s.amount,
        })),
      );
      setCompletions(
        data.completions.map((c) => ({
          teamId: c.teamId,
          tileId: c.tileId,
          statContributions: c.statContributions ?? null,
        })),
      );
    }, []),
  });

  async function takeSnapshot() {
    setSnapshotting(true);
    setSnapshotResult(null);
    try {
      const res = await clanFetch(`/api/events/${event.id}/snapshot`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSnapshotResult(data);
        setCooldown(COOLDOWN_SECS);
      } else if (res.status === 429 && data.nextRefresh) {
        // Server enforced the cooldown (e.g. after a refresh) — sync the button to its clock.
        const remaining = Math.max(0, Math.ceil((new Date(data.nextRefresh).getTime() - Date.now()) / 1000));
        setCooldown(remaining);
        setSnapshotResult({ snapshotted: 0, failed: [], error: data.error || 'Please wait before pulling again.' });
      }
    } finally {
      setSnapshotting(false);
    }
  }

  async function forceResetBaselines() {
    if (!confirm('This will overwrite ALL player baselines with current stats. Are you sure?')) return;
    setForceResetting(true);
    setSnapshotResult(null);
    try {
      // Force-reset bypasses the cooldown server-side (it's a correction) but still restarts it.
      const res = await clanFetch(`/api/events/${event.id}/snapshot?forceReset=true`, { method: 'POST' });
      if (res.ok) {
        setSnapshotResult(await res.json());
        setCooldown(COOLDOWN_SECS);
      }
    } finally {
      setForceResetting(false);
    }
  }

  async function refreshStats() {
    // Reads cached gains (no hiscores pull) — not gated by the pull cooldown.
    setRefreshingStats(true);
    try {
      const res = await clanFetch(`/api/events/${event.id}/gains`);
      if (res.ok) setLastStatsRefresh(new Date());
    } finally {
      setRefreshingStats(false);
    }
  }

  // Per-team member breakdown: each completed tile's point weight split among the members who
  // submitted toward it (see computeMemberBreakdown). Live off the submission/completion stream.
  const pointsMode = isPointsMode(event.scoringMode);
  // Per skill/boss tile, each player's XP/KC gain — so the breakdown can attribute stat tiles too.
  const statGains: StatGainMap = {};
  for (const s of statStandings) {
    statGains[s.tileId] = s.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
  }
  const teamBreakdowns = teams.map((team) => ({
    team,
    members: computeMemberBreakdown({
      teamId: team.id,
      scoringMode: event.scoringMode,
      players,
      tiles,
      completions,
      submissions,
      statGains,
    }),
  }));

  return (
    <div className="space-y-10">
      {/* Team standings — at-a-glance leaderboard + a jump into each team's board to manage. */}
      {teamStandings.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Team standings
          </h2>
          <p className="text-sm text-text-muted mb-4 max-w-2xl">
            Each team&apos;s score so far. &ldquo;Manage board&rdquo; opens that team&apos;s board to see their
            progress and mark tiles done/undone or add/remove submissions.
          </p>
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
            {teamStandings.map((t, i) => (
              <div key={t.teamId} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-sm font-bold text-text-muted shrink-0">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">{t.name}</span>
                    <span className="text-sm text-text-muted shrink-0">
                      <span className="font-semibold text-foreground">{t.score}</span>/{t.total} {t.unit} · {t.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-brown-dark rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${t.pct}%`, backgroundColor: t.color }} />
                  </div>
                </div>
                <Link
                  href={`/admin/events/${event.id}/teams/${t.teamId}`}
                  className="shrink-0 text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-lg hover:bg-gold/20 transition-colors"
                >
                  Manage board &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill & boss tracking */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-4 max-w-2xl">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Skill &amp; boss tracking
          </h2>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            For tiles with a skill or boss goal, Anvil measures progress by comparing each player&apos;s stats{' '}
            <span className="text-foreground/80">now</span> against their stats when the event started. There are just
            two things you&apos;ll ever do here.
          </p>
        </div>

        {/* Step 1 — baseline */}
        <div className="rounded-lg border border-card-border bg-brown-dark/30 p-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-medium">1. Starting stats <span className="text-text-muted font-normal">(usually automatic)</span></div>
            <p className="text-xs text-text-muted mt-0.5 max-w-md leading-relaxed">
              {eventStarted
                ? 'Drafted players get their starting line automatically on the hourly sync. Tap this to grab one right now for late joiners instead of waiting.'
                : 'Anvil captures everyone’s starting line automatically once the event begins. Tapping this right before kickoff just makes it exact — otherwise the first hourly sync (top of the hour) sets it, missing any gains made in between.'}
            </p>
          </div>
          <button
            onClick={takeSnapshot}
            disabled={snapshotting || cooldown > 0}
            className="shrink-0 px-4 py-2 text-sm font-semibold rounded-lg bg-accent-green/20 border border-accent-green/40 text-accent-green-light hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
          >
            {snapshotting
              ? 'Capturing…'
              : cooldown > 0
                ? `Wait ${fmtCooldown(cooldown)}`
                : eventStarted
                  ? 'Capture late joiners'
                  : 'Capture starting stats'}
          </button>
        </div>

        {/* Step 2 — refresh */}
        <div className="rounded-lg border border-card-border bg-brown-dark/30 p-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-medium">2. Update the leaderboard</div>
            <p className="text-xs text-text-muted mt-0.5 max-w-md leading-relaxed">
              Stats refresh <span className="text-foreground/80">automatically every hour</span> — you rarely need this.
              Use it only for an instant update.
              {lastStatsRefresh && <> Last updated at {lastStatsRefresh.toLocaleTimeString()}.</>}
            </p>
          </div>
          <button
            onClick={refreshStats}
            disabled={refreshingStats}
            className="shrink-0 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {refreshingStats ? 'Updating…' : 'Update now'}
          </button>
        </div>

        {snapshotResult && (
          <div className="text-xs space-y-1 p-2.5 bg-brown-dark rounded-lg">
            {snapshotResult.snapshotted > 0 && (
              <p className="text-accent-green-light">
                ✓ Captured starting stats for {snapshotResult.snapshotted} player{snapshotResult.snapshotted !== 1 ? 's' : ''}.
              </p>
            )}
            {snapshotResult.refreshed !== undefined && snapshotResult.refreshed > 0 && (
              <p className="text-blue-400">
                ✓ Updated {snapshotResult.refreshed} player{snapshotResult.refreshed !== 1 ? 's' : ''}.
              </p>
            )}
            {snapshotResult.failed && snapshotResult.failed.length > 0 && (
              <p className="text-red-400">Couldn&apos;t reach the hiscores for: {snapshotResult.failed.join(', ')}</p>
            )}
            {snapshotResult.error && <p className="text-red-400">Error: {snapshotResult.error}</p>}
          </div>
        )}

        {/* Danger zone — destructive, tucked away */}
        <details className="rounded-lg border border-red-500/20 bg-red-500/5 group">
          <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs text-red-400/90 flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90">▸</span>
            Danger zone — reset starting stats
          </summary>
          <div className="px-3 pb-3">
            <p className="text-xs text-text-muted mb-2 max-w-md leading-relaxed">
              Overwrites <span className="text-red-400">every</span> player&apos;s starting stats with their current
              stats, wiping all tracked gains for this event. Only use it if the starting line was captured at the
              wrong time.
            </p>
            <button
              onClick={forceResetBaselines}
              disabled={forceResetting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
            >
              {forceResetting ? 'Resetting…' : 'Reset all starting stats'}
            </button>
          </div>
        </details>
      </div>

      {/* Stat tile standings — baseline (event start) vs current, so admins can confirm the
          starting lines actually loaded and watch gains accrue. */}
      {statStandings.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Stat tile standings
          </h2>
          <p className="text-sm text-text-muted mb-4 max-w-2xl">
            Each drafted player&apos;s starting line (captured at event start) vs. their current stat.
            If a baseline is missing or looks wrong, use &ldquo;Capture starting stats&rdquo; above, or
            edit it per-player from the Teams &amp; Draft tab.
          </p>
          <input
            type="text"
            value={standingsQuery}
            onChange={(e) => setStandingsQuery(e.target.value)}
            placeholder="Search a player, boss or skill…"
            className="w-full max-w-sm mb-4 px-3 py-2 bg-brown-dark border border-card-border rounded-lg text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-gold"
          />
          {(() => {
            // Filter by player name; matching a tile's label or tracked stat keeps that tile's
            // whole roster, so you can pull up a single boss/skill or a single player.
            const q = standingsQuery.trim().toLowerCase();
            const filtered = q
              ? statStandings
                  .map((tile) => {
                    const tileMatches =
                      tile.label.toLowerCase().includes(q) || tile.trackedStatLabel.toLowerCase().includes(q);
                    return {
                      ...tile,
                      players: tileMatches ? tile.players : tile.players.filter((p) => p.name.toLowerCase().includes(q)),
                    };
                  })
                  .filter((tile) => tile.players.length > 0)
              : statStandings;
            if (filtered.length === 0) {
              return <p className="text-sm text-text-muted py-4">No players or stats match your search.</p>;
            }
            return (
          <div className="space-y-6">
            {filtered.map((tile) => {
              const missing = tile.players.filter((p) => !p.hasBaseline).length;
              return (
                <div key={tile.tileId} className="border border-card-border rounded-xl p-4 bg-card-bg">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-bold text-foreground">{tile.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${tile.statType === 'skill' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                      {tile.statType === 'skill' ? 'XP' : 'KC'}
                    </span>
                    <span className="text-xs text-text-muted">
                      {tile.trackedStatLabel} · goal {tile.statGoal.toLocaleString()}
                    </span>
                  </div>
                  {missing > 0 && (
                    <p className="text-xs text-yellow-400 mb-2">
                      ⚠ {missing} player{missing !== 1 ? 's' : ''} with no starting stats captured yet — their gains won&apos;t track until a baseline is captured.
                    </p>
                  )}
                  {tile.players.length === 0 ? (
                    <p className="text-xs text-text-muted">No drafted players yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-text-muted text-left">
                            <th className="font-medium py-1 pr-3">Player</th>
                            <th className="font-medium py-1 pr-3">Team</th>
                            <th className="font-medium py-1 pr-3 text-right">Baseline</th>
                            <th className="font-medium py-1 pr-3 text-right">Current</th>
                            <th className="font-medium py-1 pr-3 text-right">Gained</th>
                            <th className="font-medium py-1 text-right" aria-label="Fix baseline"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tile.players.map((p) => {
                            const team = teams.find((t) => t.id === p.teamId);
                            const pct = tile.statGoal > 0 ? Math.min(100, Math.round((p.gained / tile.statGoal) * 100)) : 0;
                            return (
                              <tr key={p.playerId} className="border-t border-card-border/50">
                                <td className="py-1.5 pr-3 font-medium text-foreground">{p.name}</td>
                                <td className="py-1.5 pr-3">
                                  {team && (
                                    <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: team.color + '20', color: team.color }}>
                                      {team.name}
                                    </span>
                                  )}
                                </td>
                                <td className={`py-1.5 pr-3 text-right ${p.hasBaseline ? 'text-foreground' : 'text-yellow-400'}`}>
                                  {p.hasBaseline ? p.baseline.toLocaleString() : '—'}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-foreground">{p.current.toLocaleString()}</td>
                                <td className="py-1.5 pr-3 text-right font-medium text-accent-green-light">
                                  +{p.gained.toLocaleString()} <span className="text-text-muted">({pct}%)</span>
                                </td>
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() => setBaselinePlayer({ id: p.playerId, name: p.name })}
                                    className="text-[11px] text-gold/90 hover:text-gold border border-gold/30 rounded px-1.5 py-0.5 transition-colors"
                                    title="Reset this player's baseline from hiscores, or hand-edit a single skill's baseline — also clears any stuck live-stat overlay for the fixed skill"
                                  >
                                    Fix baseline
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            );
          })()}
        </div>
      )}

      {/* Member breakdown — per team, who earned the points / did the tasks */}
      <div>
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Member breakdown
        </h2>
        <p className="text-sm text-text-muted mb-4">
          {pointsMode
            ? 'Each completed tile’s points split across the members who contributed to it, plus their task and submission counts.'
            : 'Tiles and submissions each member contributed to, per team.'}
        </p>
        {teams.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
            No teams yet.
          </div>
        ) : (
          <div className="space-y-2">
            {teamBreakdowns.map(({ team, members }) => {
              const open = breakdownTeams.has(team.id);
              const totalTasks = members.reduce((sum, m) => sum + m.tasks, 0);
              return (
                <div key={team.id} className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setBreakdownTeams((prev) => {
                        const next = new Set(prev);
                        if (next.has(team.id)) next.delete(team.id);
                        else next.add(team.id);
                        return next;
                      })
                    }
                    aria-expanded={open}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left"
                  >
                    <span className={`text-text-muted text-xs transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
                      &#9656;
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden />
                    <span className="text-sm font-semibold truncate min-w-0">{team.name}</span>
                    <span className="text-xs text-text-muted ml-auto shrink-0">
                      {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-3 border-t border-card-border">
                      <MemberBreakdown members={members} pointsMode={pointsMode} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {baselinePlayer && (
        <PlayerBaselineEditor
          eventId={event.id}
          playerId={baselinePlayer.id}
          playerName={baselinePlayer.name}
          onClose={() => setBaselinePlayer(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
