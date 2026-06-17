'use client';

import type { Event, Team } from '@/lib/types';
import { useState, useCallback } from 'react';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';

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
  const [snapshotResult, setSnapshotResult] = useState<{
    snapshotted: number;
    refreshed?: number;
    failed: string[];
    error?: string;
  } | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);

  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

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
    }
  }

  async function refreshStats() {
    setRefreshingStats(true);
    try {
      const res = await fetch(`/api/events/${event.id}/gains`);
      if (res.ok) setLastStatsRefresh(new Date());
    } finally {
      setRefreshingStats(false);
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
      {/* Hiscores Management */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-3 max-w-2xl">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Hiscores Management
        </h2>
        <p className="text-xs text-text-muted">
          {eventStarted
            ? 'Event has started. Use "Refresh Stats" to update current stats.'
            : 'Take a baseline snapshot before the event starts, then refresh stats to track gains.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={takeSnapshot}
            disabled={snapshotting || forceResetting}
            className="flex-1 py-2 text-sm font-semibold rounded bg-accent-green/20 border border-accent-green text-accent-green-light hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
          >
            {snapshotting ? 'Snapshotting...' : eventStarted ? 'Snapshot (New Players)' : 'Take Snapshot'}
          </button>
          <button
            onClick={refreshStats}
            disabled={refreshingStats || snapshotting || forceResetting}
            className="flex-1 py-2 text-sm font-semibold rounded bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {refreshingStats ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={forceResetBaselines}
            disabled={forceResetting || snapshotting}
            className="flex-1 py-2 text-sm font-semibold rounded bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
          >
            {forceResetting ? 'Resetting...' : 'Force Reset All'}
          </button>
        </div>
        {snapshotResult && (
          <div className="text-xs space-y-1 p-2 bg-brown-dark rounded">
            {snapshotResult.snapshotted > 0 && (
              <p className="text-accent-green-light">
                Snapshotted: {snapshotResult.snapshotted} player{snapshotResult.snapshotted !== 1 ? 's' : ''}
              </p>
            )}
            {snapshotResult.refreshed !== undefined && snapshotResult.refreshed > 0 && (
              <p className="text-blue-400">
                Refreshed: {snapshotResult.refreshed} player{snapshotResult.refreshed !== 1 ? 's' : ''}
              </p>
            )}
            {snapshotResult.failed && snapshotResult.failed.length > 0 && (
              <p className="text-red-400">Failed: {snapshotResult.failed.join(', ')}</p>
            )}
            {snapshotResult.error && <p className="text-red-400">Error: {snapshotResult.error}</p>}
          </div>
        )}
        {lastStatsRefresh && <p className="text-xs text-text-muted">Last refreshed: {lastStatsRefresh.toLocaleTimeString()}</p>}
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
