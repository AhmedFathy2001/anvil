'use client';

import { useState } from 'react';
import ManualOnlyBadge from '@/components/ManualOnlyBadge';

interface ClogItem {
  id: number;
  name: string;
  manualOnly?: boolean;
}
interface ActivityMeta {
  name: string;
  count: number;
  manualCount?: number;
}

interface Props {
  eventId: number;
  // Append needs a growable board (Leagues/Tile-race, pre-start). When false the button explains why.
  canGrow: boolean;
  // Points-scoring event → show the per-tile points input.
  pointsMode?: boolean;
  onCreated: (summary: { created: number; ignored: number; activity: string }) => void;
  onError: (message: string) => void;
}

// How the kept items become tiles. All three shapes are native to the import route:
// per-item rows, a row with items + no requiredAmount (collection — each item needs its own
// drop), and a row with items + requiredAmount (pool — any N drops from the set count).
type GenMode = 'perItem' | 'allOf' | 'anyOf';

const MODES: { key: GenMode; label: string; blurb: string }[] = [
  { key: 'perItem', label: 'Tile per item', blurb: 'One 1× drop tile for every kept item.' },
  { key: 'allOf', label: 'One tile: all of', blurb: 'A single collection tile — every kept item must drop (1× each).' },
  { key: 'anyOf', label: 'One tile: any of', blurb: 'A single drop tile — any N drops from the kept items complete it.' },
];

// "Generate tiles from a collection log page" — pick any clog activity (boss, raid, minigame, clue
// tab), review its full item list, exclude the ones you don't want, and append tiles for the rest:
// one 1× drop tile per item, or a single all-of/any-of tile over the whole set. Data comes from
// /api/admin/clog (bundled OSRS Wiki dataset). Loot-fired items auto-detect via the plugin's drop
// pipeline, and clog-only rewards (Barbarian Assault torso, gamble pets) auto-detect via the
// plugin's collection-log-unlock crediting.
export default function ClogGenerator({ eventId, canGrow, pointsMode, onCreated, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityMeta[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [items, setItems] = useState<ClogItem[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<GenMode>('perItem');
  const [tileLabel, setTileLabel] = useState('');
  const [anyOfAmount, setAnyOfAmount] = useState('1');
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function openModal() {
    setOpen(true);
    if (activities) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/clog');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not load the collection log dataset.');
        setOpen(false);
        return;
      }
      setActivities(data.activities as ActivityMeta[]);
      setGeneratedAt(data.generatedAt ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function pickActivity(name: string) {
    setActivity(name);
    setItems(null);
    setExcluded(new Set());
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clog?activity=${encodeURIComponent(name)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not load items for that page.');
        return;
      }
      setItems(data.items as ClogItem[]);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setActivity(null);
    setItems(null);
    setExcluded(new Set());
    setSearch('');
    setMode('perItem');
    setTileLabel('');
    setAnyOfAmount('1');
    setPoints('');
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function create() {
    if (!activity || !items) return;
    const kept = items.filter((it) => !excluded.has(it.id));
    if (kept.length === 0) {
      onError('Nothing to create — every item is excluded.');
      return;
    }
    setCreating(true);
    try {
      // Points only ride along when the admin typed one — otherwise tiles keep the default.
      const pts = pointsMode && points.trim() ? Math.max(0, parseInt(points, 10) || 0) : undefined;
      const anyN = Math.max(1, parseInt(anyOfAmount, 10) || 1);
      // Bake a human summary of the requirement into the description, so players see what
      // completes the tile — and which uniques were picked — without opening the item list.
      // A full page with nothing excluded says "all N" instead of enumerating everything.
      const nameList = (names: string[]) => {
        const MAX = 25;
        return names.length > MAX
          ? `${names.slice(0, MAX).join(', ')} … +${names.length - MAX} more`
          : names.join(', ');
      };
      const keptNames = kept.map((it) => it.name);
      const allKept = excluded.size === 0;
      const anyPhrase = anyN > 1 ? `any ${anyN}` : 'any';
      const rows =
        mode === 'perItem'
          ? kept.map((it) => ({
              label: it.name,
              tileType: 'drop',
              requiredAmount: 1,
              category: activity,
              description: `Get 1× ${it.name}.`,
              ...(pts !== undefined ? { points: pts } : {}),
              items: [{ id: it.id, name: it.name, count: 1 }],
            }))
          : [
              {
                label:
                  tileLabel.trim() ||
                  (mode === 'allOf'
                    ? `${activity}: all ${kept.length} items`
                    : `${activity}: any ${anyN} of ${kept.length}`),
                tileType: 'drop',
                category: activity,
                description:
                  mode === 'allOf'
                    ? allKept
                      ? `Get every ${activity} unique — all ${kept.length} of them, 1× each.`
                      : `Get all of these ${activity} uniques (1× each): ${nameList(keptNames)}.`
                    : allKept
                      ? `Get ${anyPhrase} drop${anyN > 1 ? 's' : ''} from the ${activity} uniques — all ${kept.length} count.`
                      : `Get ${anyPhrase} of these ${activity} uniques: ${nameList(keptNames)}.`,
                ...(pts !== undefined ? { points: pts } : {}),
                // requiredAmount set → drop pool ("any N of"); omitted → collection ("all of").
                ...(mode === 'anyOf' ? { requiredAmount: anyN } : {}),
                items: kept.map((it) => ({ id: it.id, name: it.name, count: 1 })),
              },
            ];
      const res = await fetch(`/api/events/${eventId}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, append: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not create tiles.');
        return;
      }
      onCreated({ created: data.created ?? 0, ignored: data.ignored ?? 0, activity });
      close();
    } finally {
      setCreating(false);
    }
  }

  const filteredActivities = (activities ?? []).filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const keptCount = items ? items.length - excluded.size : 0;
  const keptManual = items ? items.filter((it) => it.manualOnly && !excluded.has(it.id)).length : 0;

  return (
    <>
      <button
        onClick={openModal}
        disabled={!canGrow}
        title={
          canGrow
            ? 'Add a whole collection log page as drop tiles, excluding any you don’t want'
            : 'Available on Leagues / Tile-race boards before the event starts'
        }
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Generate from clog…
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={close}>
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                {activity ? `Collection log — ${activity}` : 'Generate from collection log'}
              </h3>
              <button onClick={close} className="text-text-muted hover:text-foreground text-lg leading-none">×</button>
            </div>

            {!activity && (
              <>
                <p className="text-xs text-text-muted mb-3">
                  Pick a page — boss, raid, minigame or clue tab. Trim the item list, then add a tile per item or one
                  all-of / any-of tile over the set.
                  {generatedAt && (
                    <span className="block mt-1 opacity-70">Dataset built {new Date(generatedAt).toLocaleDateString()}.</span>
                  )}
                </p>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages (e.g. Barbarian Assault, Vorkath, Moons)…"
                  className="w-full text-sm rounded-lg border border-card-border bg-background px-3 py-2 mb-3 focus:border-gold/50 focus:outline-none"
                />
                <div className="flex-1 overflow-y-auto -mx-1 px-1">
                  {loading && !activities ? (
                    <p className="text-xs text-text-muted py-4 text-center">Loading…</p>
                  ) : filteredActivities.length === 0 ? (
                    <p className="text-xs text-text-muted py-4 text-center">No matching pages.</p>
                  ) : (
                    <ul className="space-y-1">
                      {filteredActivities.map((a) => (
                        <li key={a.name}>
                          <button
                            onClick={() => pickActivity(a.name)}
                            className="w-full flex items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-lg border border-card-border hover:border-gold/40 hover:bg-gold/5 transition-colors"
                          >
                            <span className="text-foreground">{a.name}</span>
                            <span className="flex items-center gap-1.5 text-xs text-text-muted">
                              {a.manualCount ? <span className="text-amber-300" title={`${a.manualCount} item(s) can’t be drop-tracked`}>✋{a.manualCount === a.count ? '' : ` ${a.manualCount}`}</span> : null}
                              {a.count}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            {activity && (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button onClick={reset} className="text-xs text-text-muted hover:text-foreground transition-colors">← All pages</button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExcluded(new Set())} className="text-xs text-gold hover:underline">All</button>
                    <span className="text-text-muted text-xs">·</span>
                    <button
                      onClick={() => setExcluded(new Set((items ?? []).map((i) => i.id)))}
                      className="text-xs text-text-muted hover:text-foreground"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-[8rem]">
                  {loading || !items ? (
                    <p className="text-xs text-text-muted py-4 text-center">Loading items…</p>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((it) => {
                        const on = !excluded.has(it.id);
                        return (
                          <li key={it.id}>
                            <label className="flex items-center gap-2.5 text-sm px-2.5 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={on} onChange={() => toggle(it.id)} className="accent-gold" />
                              <span className={on ? 'text-foreground' : 'text-text-muted line-through'}>{it.name}</span>
                              {it.manualOnly && <ManualOnlyBadge compact className="ml-auto shrink-0" />}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {/* How the kept items become tiles + per-run config */}
                <div className="mt-3 pt-3 border-t border-card-border space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {MODES.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMode(m.key)}
                        className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                          mode === m.key
                            ? 'bg-gold/20 border-gold text-gold'
                            : 'border-card-border text-text-muted hover:border-gold/50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed">{MODES.find((m) => m.key === mode)?.blurb}</p>

                  <div className="flex gap-2">
                    {mode !== 'perItem' && (
                      <input
                        value={tileLabel}
                        onChange={(e) => setTileLabel(e.target.value)}
                        maxLength={200}
                        placeholder={
                          mode === 'allOf'
                            ? `${activity}: all ${keptCount} items`
                            : `${activity}: any ${Math.max(1, parseInt(anyOfAmount, 10) || 1)} of ${keptCount}`
                        }
                        aria-label="Tile label"
                        className="flex-1 min-w-0 text-sm rounded-lg border border-card-border bg-background px-3 py-1.5 focus:border-gold/50 focus:outline-none"
                      />
                    )}
                    {mode === 'anyOf' && (
                      <label className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                        Drops
                        <input
                          type="number"
                          min="1"
                          value={anyOfAmount}
                          onChange={(e) => setAnyOfAmount(e.target.value)}
                          className="w-16 text-sm rounded-lg border border-card-border bg-background px-2 py-1.5 focus:border-gold/50 focus:outline-none"
                        />
                      </label>
                    )}
                    {pointsMode && (
                      <label className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                        Points
                        <input
                          type="number"
                          min="0"
                          value={points}
                          onChange={(e) => setPoints(e.target.value)}
                          placeholder="1"
                          title={mode === 'perItem' ? 'Point value applied to every created tile' : 'Point value for the tile'}
                          className="w-16 text-sm rounded-lg border border-card-border bg-background px-2 py-1.5 focus:border-gold/50 focus:outline-none"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                  {keptManual > 0 && (
                    <span className="text-amber-300">
                      ✋ {keptManual} of these can’t be drop-tracked (shop/gamble rewards) — they’ll be flagged <em>Manual</em> on the board.{' '}
                    </span>
                  )}
                  Clog rewards auto-complete off the in-game collection-log unlock, which fires <em>once per account</em> — so a member who
                  already owns the item won’t re-trigger it and must submit manually. Exception: guaranteed completion awards
                  (Infernal cape, Fire cape) credit off the kill-count message instead, so those track on <em>every</em> completion.
                </p>
                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-card-border">
                  <span className="text-xs text-text-muted">
                    {mode === 'perItem'
                      ? `${keptCount} tile${keptCount === 1 ? '' : 's'} to add`
                      : `1 tile over ${keptCount} item${keptCount === 1 ? '' : 's'}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={close} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors">Cancel</button>
                    <button
                      onClick={create}
                      disabled={creating || keptCount === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 transition-colors disabled:opacity-50"
                    >
                      {creating
                        ? 'Adding…'
                        : mode === 'perItem'
                          ? `Add ${keptCount} tile${keptCount === 1 ? '' : 's'}`
                          : 'Add 1 tile'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
