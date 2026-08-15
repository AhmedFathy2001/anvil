'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Tile } from '@/lib/types';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { tileKindBadge } from '@/lib/tileKinds';
import type { AuthoringModel } from '@/lib/tileAuthoring';

/**
 * The reveal plan, as a plan.
 *
 * On a scheduled board (Showdown) the times ARE the event: a tile with no reveal time never opens,
 * and two tiles a minute apart make an hour of the event happen at once. That plan used to exist
 * only as a datetime field inside each tile's drawer — so reading it meant opening twelve drawers
 * and holding twelve times in your head, and writing it meant typing a full date twelve times.
 *
 * Here it's one screen: the run in order, the gaps visible, and a tool that lays out "first one at
 * six, then one an hour" in a single go.
 */

const HOUR = 60 * 60 * 1000;

/** ISO → the local wall-clock string a <input type="datetime-local"> wants. */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "in 2h 15m" / "3h ago" — how far off a moment is, in the words a host thinks in. */
function relative(iso: string, now: number): string {
  const delta = new Date(iso).getTime() - now;
  const mins = Math.round(Math.abs(delta) / 60000);
  const text =
    mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 60 * 24 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d`;
  if (mins < 1) return 'any moment';
  return delta > 0 ? `in ${text}` : `${text} ago`;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

interface Props {
  eventId: number;
  tiles: Tile[];
  model: AuthoringModel;
  /** The event's own start — a reveal before it is a tile that opens to an empty board. */
  eventStartDate?: string | null;
  editingTileId: number | null;
  onPick: (tileId: number) => void;
  /** One tile's time landed. */
  onRevealAtSaved: (tileId: number, revealAt: string | null) => void;
  /** A whole run landed — the caller patches every tile at once. */
  onScheduled: (schedule: { tileId: number; revealAt: string }[]) => void;
}

export default function ScheduleView({
  eventId,
  tiles,
  model,
  eventStartDate,
  editingTileId,
  onPick,
  onRevealAtSaved,
  onScheduled,
}: Props) {
  const [busyTileId, setBusyTileId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  // Hydration-safe clock: the server has no idea what "in 2h" means, so the relative column only
  // appears once the browser has one.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const planned = useMemo(
    () =>
      tiles
        .filter((t) => t.revealAt || t.revealedAt)
        .sort((a, b) => {
          const at = new Date(a.revealedAt ?? a.revealAt ?? 0).getTime();
          const bt = new Date(b.revealedAt ?? b.revealAt ?? 0).getTime();
          return at - bt || a.position - b.position;
        }),
    [tiles],
  );
  const unplanned = useMemo(
    () => tiles.filter((t) => !t.revealAt && !t.revealedAt).sort((a, b) => a.position - b.position),
    [tiles],
  );
  // Two tiles opening on the same minute is nearly always an accident, and the one thing a list of
  // times sorted by time hides — the rows sit next to each other looking deliberate.
  const sharedMinutes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tiles) {
      if (!t.revealAt || t.revealedAt) continue;
      const minute = t.revealAt.slice(0, 16);
      counts.set(minute, (counts.get(minute) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([m]) => m));
  }, [tiles]);

  // ─── The lay-out-a-run tool ───────────────────────────────────────────────────────────────
  // Where the run starts, by default:
  //   • Some reveals already planned → an hour after the last of them. "Lay out the rest" means
  //     after what's there, not on top of it — starting at the event's opening again would stack
  //     two tiles on the same minute and say nothing about it.
  //   • Nothing planned yet → the event's own start, because that's what "the board opens" means
  //     to everyone except the code.
  //   • No start date either → the next whole hour.
  const [startAt, setStartAt] = useState(() => {
    const lastPlanned = tiles
      .map((t) => t.revealAt)
      .filter((v): v is string => !!v)
      .sort()
      .pop();
    if (lastPlanned) return toLocalInputValue(new Date(new Date(lastPlanned).getTime() + HOUR).toISOString());
    return toLocalInputValue(eventStartDate ?? new Date(Math.ceil(Date.now() / HOUR) * HOUR).toISOString());
  });
  const [interval, setIntervalMinutes] = useState(60);
  const [scope, setScope] = useState<'unplanned' | 'all'>('unplanned');
  const [laying, setLaying] = useState(false);

  // Already-open tiles are never re-planned: their reveal is history, not a plan (the API refuses
  // them too, so this keeps the button honest rather than letting it 409).
  const runTiles = scope === 'all' ? tiles.filter((t) => !t.revealedAt) : unplanned;

  async function layOutRun() {
    if (runTiles.length === 0) return;
    const iso = startAt ? new Date(startAt).toISOString() : '';
    if (!iso || Number.isNaN(new Date(iso).getTime())) {
      setError('Give the first reveal a date and time.');
      return;
    }
    setLaying(true);
    setError('');
    setNote('');
    try {
      const res = await fetch(`/api/events/${eventId}/tiles/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tileIds: runTiles.map((t) => t.id),
          startAt: iso,
          intervalMinutes: interval,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not lay out those reveals.');
        return;
      }
      onScheduled(data.schedule ?? []);
      setNote(`Laid out ${data.updated} reveal${data.updated === 1 ? '' : 's'}, ${interval} minutes apart.`);
    } catch {
      setError('Could not lay out those reveals.');
    } finally {
      setLaying(false);
    }
  }

  async function saveOne(tileId: number, revealAt: string | null) {
    setBusyTileId(tileId);
    setError('');
    setNote('');
    try {
      const res = await fetch(`/api/events/${eventId}/tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId, revealAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save that reveal time.');
        return;
      }
      onRevealAtSaved(tileId, data.revealAt ?? null);
    } catch {
      setError('Could not save that reveal time.');
    } finally {
      setBusyTileId(null);
    }
  }

  const lastOfRun = runTiles.length > 0 && startAt
    ? new Date(new Date(startAt).getTime() + (runTiles.length - 1) * interval * 60_000)
    : null;

  return (
    <div className="space-y-4">
      {/* Lay out a run — the thing a host is actually here to do. */}
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Lay out the reveals</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Spaces {model.nounPlural} evenly from a first reveal, in the order shown below.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-text-muted">
            <span className="block mb-1">First reveal</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="bg-brown-dark border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-gold/50 focus:outline-none"
            />
          </label>
          <label className="text-xs text-text-muted">
            <span className="block mb-1">Then one every</span>
            <span className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={10080}
                value={interval}
                onChange={(e) => setIntervalMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 px-2.5 py-1.5 text-xs"
              />
              <span>minutes</span>
            </span>
          </label>
          <label className="text-xs text-text-muted">
            <span className="block mb-1">Apply to</span>
            <Select
              value={scope}
              onChange={(v) => setScope(v as 'unplanned' | 'all')}
              ariaLabel="Which tiles to schedule"
              className="w-56"
              options={[
                { value: 'unplanned', label: `${unplanned.length} with no time yet` },
                { value: 'all', label: `The whole board (${tiles.filter((t) => !t.revealedAt).length})` },
              ]}
            />
          </label>
          <button
            type="button"
            onClick={layOutRun}
            disabled={laying || runTiles.length === 0}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50"
          >
            {laying ? 'Laying out…' : `Schedule ${runTiles.length}`}
          </button>
        </div>
        {runTiles.length > 0 && lastOfRun && (
          <p className="text-[11px] text-text-muted">
            {runTiles.length} {runTiles.length === 1 ? model.noun : model.nounPlural} — last one opens{' '}
            <span className="text-foreground/80">{lastOfRun.toLocaleString()}</span>.
            {scope === 'all' && ' Rewrites times that are already set.'}
          </p>
        )}
        {runTiles.length === 0 && (
          <p className="text-[11px] text-text-muted">
            Every {model.noun} already has a time. Switch to the whole board to lay them out again.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {note && <p className="text-sm text-accent-green-light">{note}</p>}

      {/* Nothing scheduled is the failure state of this format, so it leads. */}
      {unplanned.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-400/20 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-200">No time set</span>
            <span className="text-xs text-amber-200/70">
              {unplanned.length} {unplanned.length === 1 ? model.noun : model.nounPlural} that will never open
            </span>
          </div>
          <ul className="divide-y divide-amber-400/10">
            {unplanned.map((tile) => (
              <ScheduleRow
                key={tile.id}
                tile={tile}
                model={model}
                now={now}
                eventStartDate={eventStartDate}
                busy={busyTileId === tile.id}
                editing={editingTileId === tile.id}
                onPick={onPick}
                onSave={saveOne}
              />
            ))}
          </ul>
        </div>
      )}

      {planned.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          {(() => {
            let lastDay = '';
            return planned.map((tile) => {
              const at = tile.revealedAt ?? tile.revealAt!;
              const day = dayLabel(at);
              const newDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={tile.id}>
                  {newDay && (
                    <div className="px-4 py-1.5 bg-brown-dark/50 border-y border-card-border text-[11px] uppercase tracking-widest text-text-muted">
                      {day}
                    </div>
                  )}
                  <ul>
                    <ScheduleRow
                      tile={tile}
                      model={model}
                      now={now}
                      eventStartDate={eventStartDate}
                      sharesMinute={!!tile.revealAt && sharedMinutes.has(tile.revealAt.slice(0, 16))}
                      busy={busyTileId === tile.id}
                      editing={editingTileId === tile.id}
                      onPick={onPick}
                      onSave={saveOne}
                    />
                  </ul>
                </div>
              );
            });
          })()}
        </div>
      )}

      {tiles.length === 0 && (
        <div className="border border-card-border rounded-xl p-8 bg-card-bg text-center text-sm text-text-muted">
          No {model.nounPlural} to schedule yet — add some first.
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  tile,
  model,
  now,
  eventStartDate,
  sharesMinute = false,
  busy,
  editing,
  onPick,
  onSave,
}: {
  tile: Tile;
  model: AuthoringModel;
  now: number | null;
  eventStartDate?: string | null;
  /** Another tile opens on this same minute. */
  sharesMinute?: boolean;
  busy: boolean;
  editing: boolean;
  onPick: (tileId: number) => void;
  onSave: (tileId: number, revealAt: string | null) => void;
}) {
  const [value, setValue] = useState(() => toLocalInputValue(tile.revealAt));
  // A save from elsewhere (the run tool, the drawer) is the truth — follow it.
  useEffect(() => setValue(toLocalInputValue(tile.revealAt)), [tile.revealAt]);

  const badge = tileKindBadge(tile);
  const open = !!tile.revealedAt && !tile.closedAt;
  const claimed = !!tile.closedAt;
  // A reveal before the event starts opens a tile onto a board nobody can play yet.
  const beforeStart =
    !!tile.revealAt && !!eventStartDate && new Date(tile.revealAt) < new Date(eventStartDate);

  const dirty = value !== toLocalInputValue(tile.revealAt);

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${editing ? 'bg-gold/[0.07]' : ''}`}>
      <span className="text-xs font-mono text-text-muted w-8 shrink-0">#{tile.position + 1}</span>

      {/* Time is the column you scan, so it leads and it's editable where you read it. */}
      <span className="shrink-0">
        {tile.revealedAt ? (
          <span className={`text-xs font-medium ${claimed ? 'text-red-300' : 'text-accent-green-light'}`}>
            {claimed ? '🎯 Claimed' : '🔓 Open'} · {new Date(tile.revealedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                if (dirty && value) onSave(tile.id, new Date(value).toISOString());
              }}
              disabled={busy}
              className={`bg-brown-dark border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-gold/50 disabled:opacity-50 ${
                dirty ? 'border-gold/60' : 'border-card-border'
              }`}
            />
            {tile.revealAt && (
              <button
                type="button"
                onClick={() => onSave(tile.id, null)}
                disabled={busy}
                title="Clear this reveal time"
                className="text-xs text-text-muted hover:text-foreground px-1 disabled:opacity-50"
              >
                ×
              </button>
            )}
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={() => onPick(tile.id)}
        className="flex-1 min-w-[10rem] text-left group"
      >
        <span className="block text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors">
          {tile.label}
        </span>
        <span className="block text-[11px] text-text-muted truncate">
          {badge.label}
          {beforeStart && <span className="text-amber-300"> · before the event starts</span>}
          {sharesMinute && <span className="text-amber-300"> · opens at the same moment as another</span>}
        </span>
      </button>

      {model.axes.scoring === 'points' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/20 text-purple-300 shrink-0">
          {tile.points ?? 1} pt{(tile.points ?? 1) !== 1 ? 's' : ''}
        </span>
      )}
      <span className="text-[11px] text-text-muted w-20 text-right shrink-0">
        {now != null && tile.revealAt && !open && !claimed ? relative(tile.revealAt, now) : ''}
      </span>
    </li>
  );
}
