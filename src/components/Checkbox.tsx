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
}: CheckboxProps) {
  return (
    <label
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
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'h-4 w-4 shrink-0',
          tone === 'amber' ? 'accent-amber-400' : 'accent-gold',
          !!description && 'mt-0.5',
        )}
      />
      {(label || description) && (
        <span>
          {label && <span className="text-sm font-medium">{label}</span>}
          {description && <span className="block text-xs text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
