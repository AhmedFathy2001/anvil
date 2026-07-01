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
  onCreated: (summary: { created: number; ignored: number; activity: string }) => void;
  onError: (message: string) => void;
}

// "Generate tiles from a collection log page" — pick any clog activity (boss, raid, minigame, clue
// tab), review its full item list, exclude the ones you don't want, and append one drop tile per
// kept item. Data comes from /api/admin/clog (bundled OSRS Wiki dataset). Each generated tile is a
// 1× drop tile tracking that single item id; loot-fired items auto-detect via the plugin's drop
// pipeline, and clog-only rewards (Barbarian Assault torso, gamble pets) auto-detect via the
// plugin's collection-log-unlock crediting.
export default function ClogGenerator({ eventId, canGrow, onCreated, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityMeta[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [items, setItems] = useState<ClogItem[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
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
      const rows = kept.map((it) => ({
        label: it.name,
        tileType: 'drop',
        requiredAmount: 1,
        category: activity,
        items: [{ id: it.id, name: it.name, count: 1 }],
      }));
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
                  Pick a page — boss, raid, minigame or clue tab. Every item becomes a 1× drop tile you can trim.
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
                <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                  {keptManual > 0 && (
                    <span className="text-amber-300">
                      ✋ {keptManual} of these can’t be drop-tracked (shop/gamble rewards) — they’ll be flagged <em>Manual</em> on the board.{' '}
                    </span>
                  )}
                  Clog rewards auto-complete off the in-game collection-log unlock, which fires <em>once per account</em> — so a member who
                  already owns the item won’t re-trigger it and must submit manually.
                </p>
                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-card-border">
                  <span className="text-xs text-text-muted">{keptCount} tile{keptCount === 1 ? '' : 's'} to add</span>
                  <div className="flex items-center gap-2">
                    <button onClick={close} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors">Cancel</button>
                    <button
                      onClick={create}
                      disabled={creating || keptCount === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 transition-colors disabled:opacity-50"
                    >
                      {creating ? 'Adding…' : `Add ${keptCount} tile${keptCount === 1 ? '' : 's'}`}
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
