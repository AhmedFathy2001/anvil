'use client';

import { useCallback, useEffect, useState } from 'react';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import type { LibraryTask } from '@/lib/tileLibrary';
import { DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';

// "Draw 8 easy, 10 medium, 5 hard from the task library" — the board generator on the create form.
//
// The counts are per TIER, and the tiers are the clan's own bands, so a clan that renamed or
// retuned them sees their names here. Every draw is previewed before it becomes a board: the whole
// point is to reroll until the mix looks right, not to accept whatever the first shuffle gave you.

interface LibraryMeta {
  categories: string[];
  tierCounts: Record<string, number>;
  pendingSeedCount: number;
  total: number;
}

export default function TileLibraryDraw({
  target,
  drawn,
  onDrawn,
  bands = DEFAULT_TIER_BANDS,
}: {
  /** How many tiles the board needs, when it's fixed (create form). Omit on the Tiles tab, where a
   *  draw is appended to an existing board and any size is valid. */
  target?: number;
  drawn: LibraryTask[] | null;
  onDrawn: (tasks: LibraryTask[] | null) => void;
  bands?: TierBand[];
}) {
  const [meta, setMeta] = useState<LibraryMeta | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shortfalls, setShortfalls] = useState<{ tier: string; asked: number; got: number }[]>([]);
  const [seeding, setSeeding] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tile-library');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const tierCounts: Record<string, number> = data.tierCounts ?? {};
      setMeta({
        categories: data.categories ?? [],
        tierCounts,
        pendingSeedCount: data.pendingSeedCount ?? 0,
        total: (data.tasks ?? []).length,
      });
    } catch {
      setError('Could not load the task library.');
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // A sensible opening spread: weight the middle tiers, and never suggest more than the library
  // actually holds. Only seeded once meta arrives, and never over a user's own edits.
  useEffect(() => {
    if (!meta || Object.keys(counts).length > 0 || !target || target <= 0) return;
    const weights: Record<string, number> = { troll: 0.05, easy: 0.3, medium: 0.35, hard: 0.2, ultra: 0.1 };
    const next: Record<string, number> = {};
    bands.forEach((b) => {
      const have = meta.tierCounts[b.key] ?? 0;
      const want = Math.round(target * (weights[b.key] ?? 1 / bands.length));
      next[b.key] = Math.min(have, want);
    });
    setCounts(next);
  }, [meta, target, bands, counts]);

  const asked = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

  async function seedLibrary() {
    setSeeding(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tile-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      if (!res.ok) throw new Error();
      await loadMeta();
    } catch {
      setError('Could not import the starter tasks.');
    } finally {
      setSeeding(false);
    }
  }

  async function draw(reroll = false) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tile-library/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counts,
          categories: category ? [category] : undefined,
          // Reroll deliberately excludes the current draw so you get a genuinely different board.
          exclude: reroll && drawn ? drawn.map((t) => t.id) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not draw from the library.');
        return;
      }
      onDrawn(data.tasks ?? []);
      setShortfalls(data.shortfalls ?? []);
    } catch {
      setError('Could not draw from the library.');
    } finally {
      setBusy(false);
    }
  }

  if (!meta) {
    return <p className="text-sm text-text-muted">Loading the task library…</p>;
  }

  // Nothing to draw from yet — offer the curated starter pool rather than an empty control panel.
  if (meta.total === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Your task library is empty. Import the {meta.pendingSeedCount} curated starter tasks to draw
          from, then edit them however you like — or add tiles from a past board with{' '}
          <span className="text-foreground">Add to library</span> on its Tiles tab.
        </p>
        <button
          type="button"
          onClick={seedLibrary}
          disabled={seeding || meta.pendingSeedCount === 0}
          className="px-3 py-2 text-sm rounded-lg bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {seeding ? 'Importing…' : `Import ${meta.pendingSeedCount} starter tasks`}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {bands.map((b) => {
          const have = meta.tierCounts[b.key] ?? 0;
          return (
            <div key={b.key}>
              <label className="block text-xs text-text-muted mb-1">
                {b.label} <span className="text-text-muted/60">({have} in library)</span>
              </label>
              <NumberInput
                value={counts[b.key] ?? 0}
                onChange={(n) => setCounts((prev) => ({ ...prev, [b.key]: n }))}
                min={0}
                max={have}
                fallback={0}
                disabled={have === 0}
                aria-label={`${b.label} tasks to draw`}
              />
            </div>
          );
        })}
      </div>

      {meta.categories.length > 0 && (
        <div>
          <label className="block text-xs text-text-muted mb-1">Category</label>
          <Select
            value={category}
            onChange={setCategory}
            ariaLabel="Restrict the draw to a category"
            options={[
              { value: '', label: 'Any category' },
              ...meta.categories.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => draw(false)}
          disabled={busy || asked === 0}
          className="px-3 py-2 text-sm rounded-lg bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {busy ? 'Drawing…' : drawn ? 'Draw again' : `Draw ${asked} task${asked === 1 ? '' : 's'}`}
        </button>
        {drawn && drawn.length > 0 && (
          <button
            type="button"
            onClick={() => draw(true)}
            disabled={busy}
            className="px-3 py-2 text-sm rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Reroll (different tasks)
          </button>
        )}
        <span className="text-xs text-text-muted">
          {asked} asked{target ? ` · board needs ${target}` : ''}
        </span>
      </div>

      {shortfalls.length > 0 && (
        <p className="text-xs text-yellow-400">
          Not enough tasks for:{' '}
          {shortfalls.map((s) => `${s.tier} (asked ${s.asked}, got ${s.got})`).join(', ')}. Add more to
          the library, or lower the count.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {drawn && drawn.length > 0 && (
        <div className="border border-card-border rounded-lg bg-brown-dark/40 max-h-56 overflow-y-auto">
          {drawn.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs border-b border-card-border/60 last:border-b-0">
              <span className="truncate">{t.label}</span>
              <span className="shrink-0 text-text-muted">
                {t.category ? `${t.category} · ` : ''}
                {t.points}p
              </span>
            </div>
          ))}
        </div>
      )}

      {drawn && target !== undefined && drawn.length !== target && (
        <p className="text-xs text-yellow-400">
          {drawn.length} drawn but the board needs {target} — adjust the counts or the board size
          before creating.
        </p>
      )}
    </div>
  );
}
