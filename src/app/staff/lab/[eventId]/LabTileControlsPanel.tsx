'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import type { LabTeamsView } from '@/lib/labTeams';
import Select from '@/components/Select';

export interface ControlTile {
  id: number;
  label: string;
  parentTileId: number | null;
  progressStore: string | null;
  progressGoal: number | null;
}

const STORE_WORDS: Record<string, string> = {
  stat: 'gain (KC / XP)',
  count: 'count',
  distinct: 'different items',
  slots: 'new log slots',
  best: 'best single haul (gp)',
  fastest: 'fastest run (seconds)',
};

/**
 * Tile controls: complete, clear, or set the progress of any tile for any team, as if a chosen player
 * on that team did it (lib/labTileControls). The real engine decides completion, so the feed and the
 * board react exactly as they would to real credit.
 */
export default function LabTileControlsPanel({
  eventId,
  tiles,
  teams,
  completions,
  onDone,
}: {
  eventId: number;
  tiles: ControlTile[];
  teams: LabTeamsView;
  completions: { tileId: number; teamId: number }[];
  onDone: () => Promise<void>;
}) {
  const [teamId, setTeamId] = useState<number | ''>(teams.teams[0]?.id ?? '');
  const [tileId, setTileId] = useState<number | ''>(tiles[0]?.id ?? '');
  const [playerId, setPlayerId] = useState<number | ''>('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);

  const team = teams.teams.find((t) => t.id === teamId) ?? null;
  const members = team?.members ?? [];
  // The picked player, or the team's first one when none is picked (or the pick left with a team change).
  const player = members.find((m) => m.participantId === playerId)?.participantId ?? members[0]?.participantId ?? null;
  const tile = tiles.find((t) => t.id === tileId) ?? null;
  const done = !!tile && completions.some((c) => c.tileId === tile.id && c.teamId === teamId);
  const label = (t: ControlTile) => (t.parentTileId != null ? `  ↳ ${t.label}` : t.label);

  async function run(action: 'tile-complete' | 'tile-clear' | 'tile-progress') {
    if (teamId === '' || tileId === '') return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await clanFetch(`/api/staff/lab/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, teamId, tileId, participantId: player, ...(action === 'tile-progress' ? { value: Number(value) } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'That did not work.');
      const t = d.tile as { complete: boolean; progress: number | null; goal: number | null };
      const progress = t.progress != null ? ` · progress ${t.progress.toLocaleString()}${t.goal != null ? ` / ${t.goal.toLocaleString()}` : ''}` : '';
      setMsg({ error: false, text: `${t.complete ? 'Complete' : 'Not complete'}${progress}` });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
      await onDone();
    }
  }

  const btn = 'rounded-lg border border-card-border px-3 py-1.5 text-sm text-gray-200 hover:border-gold/60 disabled:opacity-50';
  const valueOk = value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Tile controls</h2>
      <p className="mb-3 text-xs text-text-muted">
        Complete, clear or set progress on any tile for any team, credited to the player you pick. It goes through the
        real crediting code, so the board and feed react as they would to real play. Clear removes the team&rsquo;s
        completion, submissions and stat gain on that tile.
      </p>
      {teams.teams.length === 0 || tiles.length === 0 ? (
        <p className="text-sm text-text-muted">This board needs a team and a tile first.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-gray-300">
              Team
              <Select
                value={String(teamId)}
                onChange={(v) => setTeamId(Number(v))}
                options={teams.teams.map((t) => ({ value: String(t.id), label: t.name }))}
                ariaLabel="Team"
                className="mt-1"
              />
            </label>
            <label className="text-sm text-gray-300">
              Player
              <Select
                value={player == null ? '' : String(player)}
                onChange={(v) => setPlayerId(Number(v))}
                options={members.map((m) => ({ value: String(m.participantId), label: m.name }))}
                placeholder={members.length === 0 ? 'Nobody on this team' : 'Select…'}
                disabled={members.length === 0}
                ariaLabel="Player"
                className="mt-1"
              />
            </label>
            <label className="text-sm text-gray-300">
              Tile
              <Select
                value={String(tileId)}
                onChange={(v) => setTileId(Number(v))}
                options={tiles.map((t) => ({ value: String(t.id), label: label(t) }))}
                ariaLabel="Tile"
                className="mt-1"
              />
            </label>
          </div>
          {tile && (
            <p className="mt-2 text-xs text-text-muted">
              {done ? <span className="text-accent-green-light">✓ complete for this team</span> : 'Not complete for this team'}
              {' · '}
              {tile.progressStore
                ? `progress is ${STORE_WORDS[tile.progressStore] ?? tile.progressStore}${tile.progressGoal != null ? `, goal ${tile.progressGoal.toLocaleString()}` : ''}`
                : 'no number to set on this kind — complete or clear it'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <button type="button" className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-50" disabled={busy || player == null} onClick={() => void run('tile-complete')}>
              Complete
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void run('tile-clear')}>Clear</button>
            {tile?.progressStore && (
              <>
                <input
                  className="w-32 rounded-lg border border-card-border bg-brown-dark px-3 py-1.5 text-sm"
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={tile.progressGoal != null ? String(tile.progressGoal) : '0'}
                  aria-label="Progress"
                />
                <button type="button" className={btn} disabled={busy || player == null || !valueOk} onClick={() => void run('tile-progress')}>
                  Set progress
                </button>
              </>
            )}
          </div>
          {msg && <p className={`mt-3 text-sm ${msg.error ? 'text-red-400' : 'text-gray-200'}`}>{msg.text}</p>}
        </>
      )}
    </section>
  );
}
