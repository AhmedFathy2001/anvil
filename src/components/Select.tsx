'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Themed dropdown that replaces native <select> across the app. Custom popover so
// it matches DateTimePicker (chevron, gold-accented list) instead of the OS combo
// box. Values are plain strings — numeric callers convert in onChange, exactly as
// they did with e.target.value.
//
// Long lists get a filter box in the popover (auto-on past SEARCH_AUTO_THRESHOLD
// options, or forced via `searchable`). The filter matches option labels and their
// `keywords` — aliases like "colosseum" for Sol Heredit.
//
// Keyboard: ↑/↓ move, Enter select, Esc close, Home/End jump; with the filter box
// open, typing filters and Space types a space (Space only selects in plain mode).
// Disabled options are skipped. A hidden mirror input carries `required` so a
// wrapping <form> still validates.

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Extra lowercase search terms the filter box matches besides the label. */
  keywords?: string[];
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
  /** Force the filter box on/off. Default: on when the list is long. */
  searchable?: boolean;
}

const SEARCH_AUTO_THRESHOLD = 10;

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required,
  disabled,
  ariaLabel,
  className,
  searchable,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const hasSearch = searchable ?? options.length > SEARCH_AUTO_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!hasSearch || !q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [options, query, hasSearch]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Open the list with the highlight anchored to the current selection.
  function openMenu() {
    setQuery('');
    setHighlight(selectedIndex >= 0 ? selectedIndex : firstEnabled(options, 0, 1));
    setOpen(true);
  }

  function closeMenu(refocus = false) {
    setOpen(false);
    setQuery('');
    if (refocus) buttonRef.current?.focus();
  }

  // Re-anchor the highlight whenever the filter narrows the list.
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      const sel = filtered.findIndex((o) => o.value === value);
      setHighlight(sel >= 0 ? sel : firstEnabled(filtered, 0, 1));
    } else {
      setHighlight(firstEnabled(filtered, 0, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
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
    const opt = filtered[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    closeMenu(true);
  }

  // Shared list navigation for both the trigger button and the filter input.
  // Returns true when the key was handled.
  function navKey(e: React.KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      closeMenu(true);
      return true;
    }
    if (e.key === 'ArrowDown') {
      setHighlight((h) => firstEnabled(filtered, h + 1, 1));
      return true;
    }
    if (e.key === 'ArrowUp') {
      setHighlight((h) => firstEnabled(filtered, h - 1, -1));
      return true;
    }
    if (e.key === 'Home') {
      setHighlight(firstEnabled(filtered, 0, 1));
      return true;
    }
    if (e.key === 'End') {
      setHighlight(firstEnabled(filtered, filtered.length - 1, -1));
      return true;
    }
    if (e.key === 'Enter') {
      commit(highlight);
      return true;
    }
    return false;
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      } else if (hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Type-to-open: the first character seeds the filter box.
        e.preventDefault();
        openMenu();
        setQuery(e.key);
      }
      return;
    }
    if (navKey(e)) {
      e.preventDefault();
    } else if (e.key === ' ' && !hasSearch) {
      e.preventDefault();
      commit(highlight);
    }
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (navKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') closeMenu();
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
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
        <div className="absolute z-50 mt-1 w-full min-w-max rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50">
          {hasSearch && (
            <div className="p-1.5 border-b border-card-border/60">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Type to filter…"
                aria-label={ariaLabel ? `Filter ${ariaLabel} options` : 'Filter options'}
                className="w-full px-2 py-1 bg-brown-dark border border-card-border rounded text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-gold/60"
              />
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-1.5 text-sm text-text-muted/60 cursor-default">No matches</li>
            )}
            {filtered.map((opt, i) => {
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
        </div>
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
