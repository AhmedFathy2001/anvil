'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'gold' | 'danger';
  disabled?: boolean;
  title?: string;
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[10rem] rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 py-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((it, i) => (
            <button
              key={i}
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
          ))}
        </div>
      )}
    </div>
  );
}
