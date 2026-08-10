'use client';

import { useState } from 'react';
import TileLibraryDraw from '@/components/TileLibraryDraw';
import type { LibraryTask } from '@/lib/tileLibrary';

interface Props {
  eventId: number;
  canGrow: boolean;
  onCreated: (summary: { created: number; ignored: number; label: string }) => void;
  onError: (text: string) => void;
}

// "From library" — top up an existing board with a random draw from the clan's task catalogue.
// Same engine as the create form's generator, but appending rather than sizing a new board, so any
// number is valid. Stays open after adding: drawing 5 medium, then 3 hard, then 2 ultra is the
// normal way a board gets filled.
export default function LibraryTileGenerator({ eventId, canGrow, onCreated, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [drawn, setDrawn] = useState<LibraryTask[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function addToBoard() {
    if (!drawn || drawn.length === 0) return;
    setAdding(true);
    try {
      const rows = drawn.map((t) => ({
        ...t.config,
        label: t.label,
        points: t.points,
        category: t.category ?? undefined,
      }));
      const res = await fetch(`/api/events/${eventId}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, append: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not add the drawn tasks to the board.');
        return;
      }
      onCreated({
        created: data.created ?? rows.length,
        ignored: data.ignored ?? 0,
        label: `${rows.length} task${rows.length === 1 ? '' : 's'} from the library`,
      });
      setDrawn(null);
    } catch {
      onError('Could not add the drawn tasks to the board.');
    } finally {
      setAdding(false);
    }
  }

  if (!canGrow) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
        title="Draw random tasks from the clan's task library and append them to this board"
      >
        📚 From library
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Draw tasks from the library"
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg my-auto border border-gold/30 bg-card-bg rounded-2xl shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-card-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                <h2 className="font-semibold">Draw from the task library</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-foreground rounded-md w-8 h-8 flex items-center justify-center hover:bg-brown-light transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <TileLibraryDraw drawn={drawn} onDrawn={setDrawn} />
              <div className="flex items-center justify-end gap-2 border-t border-card-border pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={addToBoard}
                  disabled={adding || !drawn || drawn.length === 0}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gold text-brown-dark hover:bg-gold-light transition-colors disabled:opacity-50"
                >
                  {adding ? 'Adding…' : `Add ${drawn?.length ?? 0} to board`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
