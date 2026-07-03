'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import Input from '@/components/Input';

// Free-text input with a themed suggestion popover — the combobox counterpart to
// Select. Replaces native <datalist> autocomplete (which renders as the unthemed
// browser dropdown) with the same gold-accented list Select uses. The value is
// whatever the user types; suggestions are just quick fills, never a constraint.
//
// Keyboard: ↑/↓ move the highlight (opening the list if closed), Enter commits the
// highlighted suggestion, Esc/Tab close. While typing, the list filters on the
// current text and the first match is pre-highlighted so "Vork⏎" completes to
// "Vorkath"; when the list opens via focus/chevron with no highlight, Enter is
// inert so free text is never hijacked.

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  ariaLabel?: string;
  /** Layout/width classes for the wrapper. Defaults to full width (block). */
  className?: string;
  /**
   * Comma-separated multi-value mode: the popover filters and completes only the
   * segment after the last comma, so picking a suggestion appends instead of
   * replacing earlier entries. Suggestions already entered are hidden.
   */
  multi?: boolean;
}

export default function Combobox({
  value,
  onChange,
  suggestions,
  placeholder,
  maxLength,
  disabled,
  ariaLabel,
  className,
  multi,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // The text being completed: the whole value, or the last comma segment in multi mode.
  const segment = multi ? (value.split(',').pop() ?? '') : value;

  const filtered = useMemo(() => {
    const q = segment.trim().toLowerCase();
    const taken = multi
      ? new Set(value.split(',').slice(0, -1).map((s) => s.trim().toLowerCase()))
      : null;
    return suggestions.filter(
      (s) => !taken?.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)),
    );
  }, [suggestions, segment, value, multi]);

  // Anchor the highlight to the exact current value; -1 (inert Enter) otherwise.
  function openMenu() {
    const exact = filtered.findIndex((s) => s.toLowerCase() === segment.trim().toLowerCase());
    setHighlight(exact);
    setOpen(true);
  }

  function commit(index: number) {
    const pick = filtered[index];
    if (pick === undefined) return;
    if (multi) {
      const lastComma = value.lastIndexOf(',');
      onChange(lastComma === -1 ? pick : `${value.slice(0, lastComma + 1)} ${pick}`);
    } else {
      onChange(pick);
    }
    setOpen(false);
    inputRef.current?.focus();
  }

  // Close on outside pointerdown, same as Select.
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

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openMenu();
        if (filtered.length > 0) setHighlight(e.key === 'ArrowDown' ? 0 : filtered.length - 1);
        return;
      }
      setHighlight((h) => {
        if (filtered.length === 0) return -1;
        const next = h + (e.key === 'ArrowDown' ? 1 : -1);
        return Math.max(0, Math.min(filtered.length - 1, next));
      });
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0) {
        e.preventDefault();
        commit(highlight);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const showList = open && filtered.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        className="pr-8"
        onChange={(e) => {
          onChange(e.target.value);
          // Typing narrows the list — pre-highlight the first match so Enter completes it.
          const seg = multi ? (e.target.value.split(',').pop() ?? '') : e.target.value;
          setOpen(true);
          setHighlight(seg.trim() ? 0 : -1);
        }}
        onFocus={() => openMenu()}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-hidden
        // pointerdown (not click) + preventDefault so the input never loses focus.
        onPointerDown={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else {
            inputRef.current?.focus();
            openMenu();
          }
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/70 disabled:opacity-40"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={cn('opacity-70 transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showList && (
        <div className="absolute z-50 mt-1 w-full min-w-max rounded-lg border border-gold/30 bg-card-bg shadow-2xl shadow-black/50">
          <ul ref={listRef} role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-auto py-1">
            {filtered.map((s, i) => {
              const isSelected = s.toLowerCase() === segment.trim().toLowerCase();
              const isHighlight = i === highlight;
              return (
                <li
                  key={s}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setHighlight(i)}
                  // pointerdown so the commit wins the race against the outside-click closer.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    commit(i);
                  }}
                  className={cn(
                    'px-3 py-1.5 text-sm cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-gold/20 text-gold'
                      : isHighlight
                        ? 'bg-brown-light text-foreground'
                        : 'text-foreground',
                  )}
                >
                  {s}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
