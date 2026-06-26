'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Themed dropdown that replaces native <select> across the app. Custom popover so
// it matches DateTimePicker (chevron, gold-accented list) instead of the OS combo
// box. Values are plain strings — numeric callers convert in onChange, exactly as
// they did with e.target.value.
//
// Keyboard: ↑/↓ move, Enter/Space select, Esc close, Home/End jump. Disabled
// options are skipped. A hidden mirror input carries `required` so a wrapping
// <form> still validates.

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  /** Layout/width classes for the wrapper. Defaults to full width (block). */
  className?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required,
  disabled,
  ariaLabel,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Open the list with the highlight anchored to the current selection.
  function openMenu() {
    setHighlight(selectedIndex >= 0 ? selectedIndex : firstEnabled(options, 0, 1));
    setOpen(true);
  }

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  function commit(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => firstEnabled(options, h + 1, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => firstEnabled(options, h - 1, -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlight(firstEnabled(options, 0, 1));
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlight(firstEnabled(options, options.length - 1, -1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(highlight);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-left transition-colors',
          'hover:border-gold/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          open ? 'border-gold/60 ring-1 ring-gold/30' : '',
          selected ? 'text-foreground' : 'text-text-muted',
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={cn('opacity-70 shrink-0 transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {required && (
        // Hidden mirror so a wrapping <form> still enforces `required` — the visible
        // button isn't a form control on its own.
        <input
          tabIndex={-1}
          value={value}
          onChange={() => {}}
          required
          aria-hidden
          className="sr-only absolute inset-0 pointer-events-none opacity-0"
        />
      )}

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 w-full min-w-max max-h-60 overflow-auto rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 py-1"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isHighlight = i === highlight;
            return (
              <li
                key={opt.value || `opt-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onPointerEnter={() => !opt.disabled && setHighlight(i)}
                onClick={() => commit(i)}
                className={cn(
                  'px-3 py-1.5 text-sm cursor-pointer transition-colors',
                  opt.disabled
                    ? 'text-text-muted/40 cursor-not-allowed'
                    : isSelected
                      ? 'bg-gold/20 text-gold'
                      : isHighlight
                        ? 'bg-brown-light text-foreground'
                        : 'text-foreground',
                )}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// First enabled option index at or after `from`, walking in `dir`. Stops at the
// bounds (no wrap) and returns the original index if nothing enabled is found.
function firstEnabled(options: SelectOption[], from: number, dir: 1 | -1): number {
  let i = from;
  while (i >= 0 && i < options.length) {
    if (!options[i].disabled) return i;
    i += dir;
  }
  // Nothing found in that direction — clamp back to the nearest valid bound.
  return Math.max(0, Math.min(options.length - 1, from - dir));
}
