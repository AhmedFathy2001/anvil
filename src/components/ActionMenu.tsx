'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ActionItem {
  label: string;
  /** Draw a divider above this item — groups a long menu without a heading row. */
  separatorBefore?: boolean;
  onClick: () => void;
  variant?: 'default' | 'gold' | 'danger';
  disabled?: boolean;
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
// room below.
function computeCoords(btn: HTMLElement, itemCount: number, align: 'left' | 'right'): Coords {
  const r = btn.getBoundingClientRect();
  const estHeight = itemCount * 32 + 8; // ~1.5rem rows + padding
  const below = r.bottom + 4;
  const flip = below + estHeight > window.innerHeight - 8 && r.top - estHeight - 4 > 8;
  const top = flip ? r.top - estHeight - 4 : below;
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
      if (btnRef.current) setCoords(computeCoords(btnRef.current, items.length, align));
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

  if (items.length === 0) return null;

  return (
    <div className="inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors inline-flex items-center gap-1"
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
            className="z-50 w-max min-w-[10rem] max-w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 py-1"
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
                  'w-full text-left px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  it.variant === 'danger'
                    ? 'text-red-300 hover:bg-red-500/10'
                    : it.variant === 'gold'
                      ? 'text-gold hover:bg-gold/10'
                      : 'text-foreground hover:bg-brown-light',
                )}
              >
                {it.label}
              </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
