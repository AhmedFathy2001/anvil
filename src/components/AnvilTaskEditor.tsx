'use client';

import { useEffect, useState } from 'react';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import { AuthoringApiContext } from '@/components/AuthoringApi';
import Textarea from '@/components/Textarea';
import { blankTileConfig, payloadToCsvRow, toTileConfig } from '@/app/admin/tile-library/taskConfig';
import { DEFAULT_TIER_BANDS } from '@/lib/tileFilter';
import type { TileCsvRow } from '@/lib/csvTiles';
import type { TileConfig } from '@/lib/types';

/** A task in the shape the library APIs take. */
export interface AnvilTaskDraft {
  label: string;
  points: number;
  category: string | null;
  description: string | null;
  config: TileCsvRow;
}

/**
 * The tile editor for an Anvil library task, in a dialog. Used three ways:
 *   - staff creating/editing an Anvil task (mode 'staff');
 *   - anyone suggesting a new task, or a fix to an existing one (mode 'suggest' — adds a note box,
 *     and the editor's save sends the suggestion instead of saving anything).
 * `lookupApi` is where item/NPC search lives: /api/library on the apex, /api/admin inside a clan.
 */
export default function AnvilTaskEditor({
  title,
  task,
  mode,
  lookupApi,
  categorySuggestions,
  onSubmit,
  onClose,
}: {
  title: string;
  /** The task to start from; null for a new one. */
  task: AnvilTaskDraft | null;
  mode: 'staff' | 'suggest';
  lookupApi: string;
  categorySuggestions?: string[];
  /** Returns an error message, or null when it worked (the dialog then closes). */
  onSubmit: (draft: AnvilTaskDraft, note: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [initial, setInitial] = useState<TileConfig | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cfg = task
        ? await toTileConfig(task.config, { label: task.label, points: task.points, category: task.category, description: task.description }, lookupApi)
        : blankTileConfig();
      if (alive) setInitial(cfg);
    })();
    return () => {
      alive = false;
    };
  }, [task, lookupApi]);

  async function save(payload: Record<string, unknown>): Promise<TileConfig | null> {
    setError(null);
    const draft: AnvilTaskDraft = {
      label: (payload.label as string) || 'Untitled task',
      points: (payload.points as number) ?? 0,
      category: (payload.category as string | null) ?? null,
      description: (payload.description as string | null) ?? null,
      config: payloadToCsvRow(payload),
    };
    const err = await onSubmit(draft, note);
    if (err) {
      setError(err);
      return null;
    }
    onClose();
    return { ...(payload as unknown as TileConfig), updatedAt: null };
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl border border-gold/30 bg-card-bg rounded-2xl shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-card-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-5 bg-gold rounded-full shrink-0" />
            <h2 className="font-semibold truncate">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-foreground rounded-md w-8 h-8 flex items-center justify-center hover:bg-brown-light">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          {mode === 'suggest' && (
            <div>
              <label className="block text-sm font-medium mb-1">Why? (optional)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="What’s wrong with it now, or why clans would want it."
                className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-text-muted">
                Anvil reviews suggestions before they reach anyone. Pressing save below sends it.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {initial === null ? (
            <p className="text-sm text-text-muted">Loading the task…</p>
          ) : (
            <AuthoringApiContext.Provider value={lookupApi}>
              <TileTrackingConfig
                initial={initial}
                onSave={save}
                onSaved={() => {}}
                pointsMode
                tierBands={DEFAULT_TIER_BANDS}
                categorySuggestions={categorySuggestions}
              />
            </AuthoringApiContext.Provider>
          )}
        </div>
      </div>
    </div>
  );
}
