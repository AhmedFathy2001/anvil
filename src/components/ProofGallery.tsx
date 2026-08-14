'use client';

import { useCallback, useEffect, useRef } from 'react';
import LocalTime from './LocalTime';

/**
 * Full-size viewer for a tile's proof screenshots.
 *
 * Proof used to open with `window.open(imageUrl)`, which throws the viewer out of the page they were
 * reading and gives them a bare image in a tab with no idea whose it is or what it was for. This
 * keeps them where they are: caption intact, arrows to walk the rest of that contributor's proof,
 * Esc to get back.
 */
export interface ProofShot {
  id: number;
  imageUrl: string;
  /** Who earned it — not necessarily who uploaded it. */
  credit: string | null;
  note: string | null;
  createdAt: string;
  amountLabel: string | null;
}

export default function ProofGallery({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: ProofShot[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = shots.length;

  const step = useCallback(
    (delta: number) => {
      if (count === 0) return;
      onIndex((index + delta + count) % count);
    },
    [count, index, onIndex],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight') {
        step(1);
      } else if (e.key === 'ArrowLeft') {
        step(-1);
      }
    }
    // Capture phase: this sits above the tile modal, which closes on Escape too — without capturing,
    // one Escape would dismiss both and dump the viewer back to the board.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, step]);

  // Focus the close button on open so the viewer is immediately keyboard-operable and a screen
  // reader lands somewhere meaningful rather than at the top of the page behind it.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const shot = shots[index];
  if (!shot) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Proof screenshot"
      onClick={onClose}
    >
      <div className="flex items-start justify-between gap-3 p-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">
            {shot.credit ?? 'Unattributed'}
            {shot.amountLabel && <span className="ml-2 text-gold font-normal">{shot.amountLabel}</span>}
          </p>
          <p className="text-xs text-text-muted">
            <LocalTime date={shot.createdAt} format="date" />
            {count > 1 && <span className="ml-2">{index + 1} of {count}</span>}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-xs text-text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Close
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-2 px-2 pb-3" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            className="shrink-0 rounded-lg border border-card-border bg-card-bg/80 px-2 py-6 text-text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            ‹
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.imageUrl}
          alt={shot.note || 'Proof screenshot'}
          className="max-h-full max-w-full m-auto object-contain rounded-lg"
        />
        {count > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            className="shrink-0 rounded-lg border border-card-border bg-card-bg/80 px-2 py-6 text-text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            ›
          </button>
        )}
      </div>

      {shot.note && (
        <p className="px-3 pb-3 text-xs text-text-muted max-w-3xl" onClick={(e) => e.stopPropagation()}>
          {shot.note}
        </p>
      )}
    </div>
  );
}
