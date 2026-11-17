'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ActionItem {
  label: string;
  /** Draw a divider above this item — groups a long menu without a heading row. */
  separatorBefore?: boolean;
  onClick: () => void;
  variant?: 'default' | 'gold' | 'danger';
  disabled?: boolean;
  /** Why it is disabled, shown under the item (a tooltip on a disabled button is never seen). */
  disabledReason?: string;
  title?: string;
}

interface Coords {
  top: number;
  left?: number;
  right?: number;
}

// Compute a fixed-position anchor from the trigger's viewport rect. The menu is portalled to
// <body> so an ancestor with `overflow` (e.g. a table wrapped in `overflow-x-auto`, which the
// spec promotes to `overflow-y: auto`) can't clip it. Flips above the trigger when there isn't
// room below. `height` is the menu's real height once it has been drawn (phone rows are 44px and a
// disabled item carries a line of text, so the 32px-a-row guess alone let a long menu run off the
// bottom of a phone with no way to reach the last items). When it fits neither below nor above, it
// is pinned inside the screen; the panel itself scrolls if it is taller than the screen.
function computeCoords(btn: HTMLElement, itemCount: number, align: 'left' | 'right', height?: number): Coords {
  const r = btn.getBoundingClientRect();
  const estHeight = Math.min(height ?? itemCount * 32 + 8, window.innerHeight - 16);
  const below = r.bottom + 4;
  const fitsBelow = below + estHeight <= window.innerHeight - 8;
  const fitsAbove = r.top - estHeight - 4 >= 8;
  const top = fitsBelow ? below : fitsAbove ? r.top - estHeight - 4 : Math.max(8, window.innerHeight - 8 - estHeight);
  return align === 'right'
    ? { top, right: Math.max(8, window.innerWidth - r.right) }
    : { top, left: Math.max(8, r.left) };
}

// A compact per-row actions dropdown — replaces a long trailing row of buttons with one "Actions ▾"
// menu. Closes on outside click / Escape. Keep the item count small; group the row's actions here.
export default function ActionMenu({
  items,
  label = 'Actions',
  align = 'right',
}: {
  items: ActionItem[];
  label?: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (btnRef.current) setCoords(computeCoords(btnRef.current, items.length, align));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // Reposition while open so the menu tracks its trigger through scroll/resize (capture phase
    // catches scrolling ancestors, not just the window).
    function reflow() {
      if (btnRef.current) setCoords(computeCoords(btnRef.current, items.length, align, menuRef.current?.offsetHeight));
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
    };
  }, [open, items.length, align]);

  // Once the menu is drawn, place it again with its real height (see computeCoords).
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const next = computeCoords(btnRef.current, items.length, align, menuRef.current.offsetHeight);
    setCoords((c) => (c && c.top === next.top && c.left === next.left && c.right === next.right ? c : next));
  }, [open, items.length, align]);

  if (items.length === 0) return null;

  return (
    <div className="inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-2 py-1 max-sm:min-h-11 max-sm:px-3 text-xs border border-card-border rounded hover:border-gold/40 transition-colors inline-flex items-center gap-1"
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={cn('opacity-70 transition-transform', open && 'rotate-180')}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            // Only ever ONE of left/right is anchored; leaving the other as `auto` explicitly keeps
            // the panel shrink-to-fit instead of letting it stretch toward the opposite edge.
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left ?? 'auto',
              right: coords.right ?? 'auto',
            }}
            className="z-50 w-max min-w-[10rem] max-w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 py-1"
          >
            {items.map((it, i) => (
              <div key={i} className={it.separatorBefore && i > 0 ? 'border-t border-card-border mt-1 pt-1' : undefined}>
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                title={it.title}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 max-sm:min-h-11 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  it.variant === 'danger'
                    ? 'text-red-300 hover:bg-red-500/10'
                    : it.variant === 'gold'
                      ? 'text-gold hover:bg-gold/10'
                      : 'text-foreground hover:bg-brown-light',
                )}
              >
                {it.label}
              </button>
              {it.disabled && it.disabledReason && (
                <p className="px-3 pb-1.5 -mt-0.5 text-[11px] leading-snug text-text-muted">{it.disabledReason}</p>
              )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
