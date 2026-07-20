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
}

// Themed checkbox (gold accent) with an optional label + description, so checkboxes look and behave
// consistently instead of each spot rolling its own `<input type="checkbox" className="accent-gold">`.
export default function Checkbox({ checked, onChange, label, description, disabled, className }: CheckboxProps) {
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
        className={cn('h-4 w-4 accent-gold shrink-0', !!description && 'mt-0.5')}
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
