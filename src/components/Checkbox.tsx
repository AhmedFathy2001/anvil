'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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

// Themed checkbox (gold accent) with an optional label + description, so checkboxes look and behave
// consistently instead of each spot rolling its own `<input type="checkbox" className="accent-gold">`.
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
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'h-4 w-4 shrink-0',
          tone === 'amber' ? 'accent-amber-400' : 'accent-gold',
          !!description && 'mt-0.5',
        )}
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
