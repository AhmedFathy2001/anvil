'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Tag editor: committed values render as removable chips, with a bare inline input for the
// next one. Enter or comma commits the pending text, Backspace on an empty input removes the
// last chip, and blur commits whatever is pending so a half-typed tag survives a Save click.
// Duplicates are dropped case-insensitively. The caller owns the array; joining it back into
// a stored string (e.g. comma-separated `tiles.category`) is its business.
//
// When `suggestions` is passed, typing surfaces a case-insensitive-substring dropdown of
// existing tags (e.g. categories already used elsewhere on the board), so "tombs of" offers
// "Tombs of Amascut". ↑/↓ move the highlight, Enter/click picks it, Esc dismisses.

const MAX_SUGGESTIONS = 8;

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Per-tag character cap. Defaults to 30. */
  maxTagLength?: number;
  /** Layout/width classes for the wrapper. Defaults to full width (block). */
  className?: string;
  /** Existing tags to offer as typeahead suggestions (matched case-insensitively). */
  suggestions?: string[];
}

export default function ChipsInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  maxTagLength = 30,
  className,
  suggestions,
}: Props) {
  const [pending, setPending] = useState('');
  const [active, setActive] = useState(-1); // highlighted suggestion index; -1 = none
  const [dismissed, setDismissed] = useState(false); // Esc hides the list until typing resumes
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Case-insensitive substring match against suggestions, excluding tags already chosen.
  const matches = useMemo(() => {
    const q = pending.trim().toLowerCase();
    if (!q || !suggestions?.length) return [];
    const chosen = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => !chosen.has(s.toLowerCase()) && s.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [pending, suggestions, value]);

  const showSuggestions = matches.length > 0 && !dismissed;

  function addTag(raw: string) {
    const tag = raw.trim();
    setPending('');
    setActive(-1);
    setDismissed(false);
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function commitPending() {
    addTag(pending);
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      // A highlighted suggestion wins; otherwise commit whatever was typed.
      if (e.key === 'Enter' && showSuggestions && active >= 0) addTag(matches[active]);
      else commitPending();
    } else if (e.key === 'Escape' && showSuggestions) {
      e.preventDefault();
      setDismissed(true);
      setActive(-1);
    } else if (e.key === 'Backspace' && pending === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-brown-dark border border-card-border rounded text-sm',
          'focus-within:border-gold transition-colors cursor-text',
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gold/15 border border-gold/30 text-gold"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="opacity-70 hover:opacity-100 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={pending}
          maxLength={maxTagLength}
          aria-label={ariaLabel}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(e) => {
            setPending(e.target.value);
            setActive(-1);
            setDismissed(false);
          }}
          onKeyDown={onKeyDown}
          // Delay so a suggestion click lands before blur commits the raw pending text.
          onBlur={() => setTimeout(commitPending, 120)}
          className="flex-1 min-w-[90px] bg-transparent outline-none text-sm text-foreground placeholder:text-text-muted/60 py-0.5"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
      </div>

      {showSuggestions && (
        <ul
          role="listbox"
          id={listboxId}
          className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card-bg border border-card-border rounded-lg shadow-xl py-1"
        >
          {matches.map((s, i) => (
            <li key={s} role="option" aria-selected={i === active}>
              <button
                type="button"
                // onMouseDown (not onClick) so it fires before the input's blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                  inputRef.current?.focus();
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm transition-colors',
                  i === active ? 'bg-gold/15 text-gold' : 'text-foreground hover:bg-brown-light',
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
