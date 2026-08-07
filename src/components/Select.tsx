'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Optional indicator colour rendered as a leading dot (e.g. difficulty-tier ramp). */
  dot?: string;
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
  const popoverRef = useRef<HTMLDivElement>(null);

  // The popover renders in a portal with fixed positioning so it ESCAPES any `overflow` ancestor
  // (e.g. a table's overflow-x-auto) that would otherwise clip it. Anchored to the trigger's rect,
  // recomputed on open + scroll/resize, and flipped above the trigger when there's more room there.
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; maxHeight: number; above: boolean } | null>(null);

  const layout = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const margin = 4;
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const above = spaceBelow < 240 && spaceAbove > spaceBelow;
    setCoords({
      left: r.left,
      top: above ? r.top - margin : r.bottom + margin,
      width: r.width,
      maxHeight: Math.max(160, Math.min(320, above ? spaceAbove : spaceBelow)),
      above,
    });
  }, []);

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
    layout();
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

  // Close on outside click + Escape. The popover lives in a portal OUTSIDE the container, so a
  // click on an option would read as "outside" and close before its onClick fired — guard on the
  // popover element too.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Keep the portaled popover anchored to the trigger while open.
  useEffect(() => {
    if (!open) return;
    const onReflow = () => layout();
    window.addEventListener('scroll', onReflow, true); // capture — catch scroll on any ancestor
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, layout]);

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
        <span className="truncate flex items-center gap-2 min-w-0">
          {selected?.dot && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selected.dot }} aria-hidden />
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
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

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            minWidth: coords.width,
            maxHeight: coords.maxHeight,
            transform: coords.above ? 'translateY(-100%)' : undefined,
          }}
          className="z-[60] flex flex-col min-w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 overflow-hidden"
        >
          {hasSearch && (
            <div className="p-1.5 border-b border-card-border/60 shrink-0">
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
            className="flex-1 overflow-auto py-1"
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
                    'px-3 py-1.5 text-sm cursor-pointer transition-colors flex items-center gap-2',
                    opt.disabled
                      ? 'text-text-muted/40 cursor-not-allowed'
                      : isSelected
                        ? 'bg-gold/20 text-gold'
                        : isHighlight
                          ? 'bg-brown-light text-foreground'
                          : 'text-foreground',
                  )}
                >
                  {opt.dot && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} aria-hidden />
                  )}
                  {opt.label}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
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
