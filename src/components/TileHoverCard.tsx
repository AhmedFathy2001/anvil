'use client';

import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type FocusEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { TileHoverView } from '@/lib/tileHover';

/** Wait before the card shows, and before "intent" (prefetch) fires. A pass-over shows nothing. */
const SHOW_DELAY_MS = 350;
const INTENT_DELAY_MS = 150;

const STATE_TONE: Record<TileHoverView['state'], string> = {
  done: 'text-gold',
  open: 'text-foreground',
  locked: 'text-text-muted',
  needs_proof: 'text-yellow-400',
};

/**
 * A small hover / keyboard-focus card for a board tile: name, progress, state, who is on it. Built
 * from data the board already holds (lib/tileHover), so it never makes a request.
 *
 * - Mouse and pen hover only: a touch tap opens the tile, so the card never appears on touch.
 * - Keyboard focus shows it too (`:focus-visible` only: a mouse click's focus does not).
 * - `onIntent` fires after a short, steady hover or focus: used to warm the tile dialog's data.
 *
 * Spread `bind` on the tile's button and render `card` next to it.
 */
export function useTileHover(view: TileHoverView | null, onIntent?: () => void) {
  const id = useId();
  const ref = useRef<HTMLButtonElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const clear = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (intentTimer.current) clearTimeout(intentTimer.current);
    showTimer.current = null;
    intentTimer.current = null;
  }, []);
  const hide = useCallback(() => {
    clear();
    setRect(null);
  }, [clear]);
  const start = useCallback(() => {
    clear();
    if (onIntent) intentTimer.current = setTimeout(onIntent, INTENT_DELAY_MS);
    if (view) {
      showTimer.current = setTimeout(() => {
        if (ref.current) setRect(ref.current.getBoundingClientRect());
      }, SHOW_DELAY_MS);
    }
  }, [clear, onIntent, view]);

  useEffect(() => clear, [clear]);
  // Anything that moves the tile away from the card dismisses it.
  useEffect(() => {
    if (!rect) return;
    const off = () => setRect(null);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') off(); };
    window.addEventListener('scroll', off, true);
    window.addEventListener('resize', off);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', off, true);
      window.removeEventListener('resize', off);
      window.removeEventListener('keydown', key);
    };
  }, [rect]);

  const bind = {
    ref,
    onPointerEnter: (e: PointerEvent) => { if (e.pointerType !== 'touch') start(); },
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (e: FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) start(); },
    onBlur: hide,
    'aria-describedby': rect ? id : undefined,
  };

  const card: ReactNode = rect && view && typeof document !== 'undefined'
    ? createPortal(<CardBody id={id} view={view} rect={rect} />, document.body)
    : null;
  return { bind, card };
}

function CardBody({ id, view, rect }: { id: string; view: TileHoverView; rect: DOMRect }) {
  const W = 224;
  const above = rect.top > 140;
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, rect.left + rect.width / 2 - W / 2));
  const style = above
    ? { left, width: W, bottom: window.innerHeight - rect.top + 6 }
    : { left, width: W, top: rect.bottom + 6 };
  return (
    <div id={id} role="tooltip" style={style} className="pointer-events-none fixed z-[60] rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="text-sm font-semibold text-foreground leading-snug">{view.title}</p>
      <p className={cn('mt-0.5 font-medium', STATE_TONE[view.state])}>{view.stateLabel}</p>
      {view.progress && <p className="mt-0.5 text-text-muted tabular-nums">{view.progress}</p>}
      {view.points && <p className="mt-0.5 text-text-muted">{view.points}</p>}
      {view.who && <p className="mt-0.5 text-text-muted">{view.who}</p>}
    </div>
  );
}

/** A `<button>` with the hover card attached: for tiles drawn inside loops, where a hook can't go. */
export function TileHoverButton({ view, onIntent, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { view: TileHoverView; onIntent?: () => void }) {
  const hover = useTileHover(view, onIntent);
  return (
    <>
      <button {...hover.bind} {...rest} />
      {hover.card}
    </>
  );
}
