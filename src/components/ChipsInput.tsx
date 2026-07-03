'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Tag editor: committed values render as removable chips, with a bare inline input for the
// next one. Enter or comma commits the pending text, Backspace on an empty input removes the
// last chip, and blur commits whatever is pending so a half-typed tag survives a Save click.
// Duplicates are dropped case-insensitively. The caller owns the array; joining it back into
// a stored string (e.g. comma-separated `tiles.category`) is its business.

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Per-tag character cap. Defaults to 30. */
  maxTagLength?: number;
  /** Layout/width classes for the wrapper. Defaults to full width (block). */
  className?: string;
}

export default function ChipsInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  maxTagLength = 30,
  className,
}: Props) {
  const [pending, setPending] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function commitPending() {
    const tag = pending.trim();
    setPending('');
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitPending();
    } else if (e.key === 'Backspace' && pending === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
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
        onChange={(e) => setPending(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commitPending}
        className="flex-1 min-w-[90px] bg-transparent outline-none text-sm text-foreground placeholder:text-text-muted/60 py-0.5"
      />
    </div>
  );
}
