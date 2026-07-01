'use client';

import type { Event, Team } from '@/lib/types';
import { useState, useCallback, useEffect } from 'react';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';

// Every hiscores action (snapshot / refresh / reset) fans out a request per enrolled player, so
// after one runs we lock the whole panel for a cooldown to stop spam-clicking from hammering the
// OSRS hiscores.
const COOLDOWN_SECS = 30;

interface Props {
  event: Event;
  teams: Team[];
}

// Only the submission fields the activity rollup needs — keeps us decoupled from the
// stream's exact Submission shape.
interface ActivitySubmission {
  teamId: number;
  creditPlayerId: number | null;
  creditPlayerName?: string | null;
  amount: number;
}

export default function StatsClient({ event, teams }: Props) {
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

  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();
  const busy = snapshotting || refreshingStats || forceResetting;
  const locked = busy || cooldown > 0;

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
          creditPlayerId: s.creditPlayerId,
          creditPlayerName: s.creditPlayerName,
          amount: s.amount,
        })),
      );
    }, []),
  });

  async function takeSnapshot() {
    setSnapshotting(true);
    setSnapshotResult(null);
    try {
      const res = await fetch(`/api/events/${event.id}/snapshot`, { method: 'POST' });
      if (res.ok) setSnapshotResult(await res.json());
    } finally {
      setSnapshotting(false);
      setCooldown(COOLDOWN_SECS);
    }
  }

  async function forceResetBaselines() {
    if (!confirm('This will overwrite ALL player baselines with current stats. Are you sure?')) return;
    setForceResetting(true);
    setSnapshotResult(null);
    try {
      const res = await fetch(`/api/events/${event.id}/snapshot?forceReset=true`, { method: 'POST' });
      if (res.ok) setSnapshotResult(await res.json());
    } finally {
      setForceResetting(false);
      setCooldown(COOLDOWN_SECS);
    }
  }

  async function refreshStats() {
    setRefreshingStats(true);
    try {
      const res = await fetch(`/api/events/${event.id}/gains`);
      if (res.ok) setLastStatsRefresh(new Date());
    } finally {
      setRefreshingStats(false);
      setCooldown(COOLDOWN_SECS);
    }
  }

  // Aggregate live submissions into per-player drop totals.
  const activityByPlayer = new Map<number, { name: string; teamId: number; submissions: number; totalAmount: number }>();
  for (const s of submissions) {
    if (s.creditPlayerId) {
      const existing = activityByPlayer.get(s.creditPlayerId);
      if (existing) {
        existing.submissions++;
        existing.totalAmount += s.amount;
      } else {
        activityByPlayer.set(s.creditPlayerId, {
          name: s.creditPlayerName || 'Unknown',
          teamId: s.teamId,
          submissions: 1,
          totalAmount: s.amount,
        });
      }
    }
  }
  const sortedActivity = Array.from(activityByPlayer.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount);

  return (
    <div className="space-y-10">
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
            disabled={locked}
            className="shrink-0 px-4 py-2 text-sm font-semibold rounded-lg bg-accent-green/20 border border-accent-green/40 text-accent-green-light hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
          >
            {snapshotting
              ? 'Capturing…'
              : cooldown > 0
                ? `Wait ${cooldown}s`
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
            disabled={locked}
            className="shrink-0 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {refreshingStats ? 'Updating…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Update now'}
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
              disabled={locked}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
            >
              {forceResetting ? 'Resetting…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Reset all starting stats'}
            </button>
          </div>
        </details>
      </div>

      {/* Player Activity */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Player Activity
        </h2>
        {sortedActivity.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
            No submissions yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedActivity.map(([playerId, data]) => {
              const team = teams.find((t) => t.id === data.teamId);
              return (
                <div key={playerId} className="border border-card-border rounded-lg p-3 bg-card-bg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{data.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: team?.color + '20', color: team?.color }}>
                      {team?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-accent-green-light font-medium">{data.totalAmount} drops</span>
                    <span className="text-text-muted">
                      ({data.submissions} submission{data.submissions !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
