'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { cn } from '@/lib/utils';

type BoxProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** See Checkbox's `tone`. */
  tone?: 'gold' | 'amber' | 'indigo';
  /** Classes for the box's wrapper: margins, alignment, or a size (`h-3.5 w-3.5`) — tailwind-merged. */
  className?: string;
};

/**
 * The bare box — a real `<input type="checkbox">` (focusable, keyboard-toggled, submits its
 * `name`/`value` with a form) drawn by us instead of the browser: `appearance-none` drops the OS
 * widget, and the tick is our SVG shown by `peer-checked`. For the spots whose layout is their own —
 * a whole selectable card, a table cell — where the labelled `Checkbox` below would not fit. Every
 * other input property (a `ref`, say, to set `indeterminate`) passes straight through.
 */
export function CheckboxBox({ tone = 'gold', className, ...rest }: BoxProps) {
  return (
    <span className={twMerge('relative inline-flex h-4 w-4 shrink-0', className)}>
      <input
        type="checkbox"
        {...rest}
        className={cn(
          'peer m-0 h-full w-full cursor-[inherit] appearance-none rounded-[4px] border border-text-dim/70 bg-brown-dark transition-colors',
          'hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
          'disabled:cursor-not-allowed',
          tone === 'amber'
            ? 'checked:border-amber-400 checked:bg-amber-400 indeterminate:border-amber-400 indeterminate:bg-amber-400'
            : tone === 'indigo'
              ? 'checked:border-indigo-400 checked:bg-indigo-400 indeterminate:border-indigo-400 indeterminate:bg-indigo-400'
              : 'checked:border-gold checked:bg-gold indeterminate:border-gold indeterminate:bg-gold',
        )}
      />
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute inset-0 hidden h-full w-full text-brown-dark peer-checked:block peer-indeterminate:hidden"
        aria-hidden
      >
        <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
      </svg>
      {/* A select-all box set `indeterminate` by its caller (some rows picked) shows a dash. */}
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        className="pointer-events-none absolute inset-0 hidden h-full w-full text-brown-dark peer-indeterminate:block"
        aria-hidden
      >
        <line x1="4" y1="8" x2="12" y2="8" />
      </svg>
    </span>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  /**
   * The accent. Gold is the product's, and nearly every checkbox wants it.
   *
   * `amber` exists for the one that means something else: the admin override that unlocks a live
   * event's tiles is deliberately not the same colour as an ordinary preference, because it is a
   * warning. That was the only reason it had stayed a hand-rolled input — converting it to the
   * shared control would have quietly turned a warning into a setting.
   */
  tone?: 'gold' | 'amber';
  /**
   * For a checkbox with no visible label — a row-selection box in a table, where the column header
   * carries the meaning. Named to match Select's prop rather than passing `aria-label` through, so
   * both shared controls are asked the same way.
   */
  ariaLabel?: string;
  title?: string;
  /**
   * REPLACES the default label classes (`text-sm font-medium`) rather than adding to them, because
   * `cn` here is a plain join with no tailwind-merge — a passed `text-xs` and the default `text-sm`
   * would both land and stylesheet order would pick the winner.
   *
   * It exists for the dense pickers: a 3-column grid of 23 skills is a different typographic object
   * from a settings row, and forcing it to `text-sm font-medium` is what had kept those lists on
   * hand-rolled inputs.
   */
  labelClassName?: string;
  /**
   * Rendered after the label and pushed to the right edge. Two of the tile pickers end their rows
   * with a badge — a slayer level, a "manual only" chip — held there by `ml-auto`, which only works
   * on a DIRECT flex child of the row. Putting it inside `label` would have silently left-aligned
   * it, so the slot is explicit. Widening the label wrapper to `flex-1` instead would have moved
   * every existing caller's layout to fix two.
   */
  trailing?: ReactNode;
}

// Themed checkbox with an optional label + description, so checkboxes look and behave consistently
// instead of each spot rolling its own `<input type="checkbox">` — the browser's box never shows.
export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  tone = 'gold',
  ariaLabel,
  title,
  labelClassName,
  trailing,
}: CheckboxProps) {
  return (
    <label
      title={title}
      className={cn(
        'flex gap-2.5 select-none',
        description ? 'items-start' : 'items-center',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <CheckboxBox
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        tone={tone}
        className={description ? 'mt-0.5' : undefined}
      />
      {(label || description) && (
        <span>
          {label && <span className={labelClassName ?? 'text-sm font-medium'}>{label}</span>}
          {description && <span className="block text-xs text-text-muted">{description}</span>}
        </span>
      )}
      {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
    </label>
  );
}
