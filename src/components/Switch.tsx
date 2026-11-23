'use client';

import type { ReactNode } from 'react';

/**
 * An on/off switch: a button with role="switch", drawn by us. `mixed` shows the knob in the middle
 * for a state that is neither (a hand-picked list the switch no longer describes); pressing it then
 * turns it on.
 */
export default function Switch({
  checked,
  mixed = false,
  onChange,
  disabled,
  children,
  className = '',
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const on = checked && !mixed;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? 'mixed' : checked}
      disabled={disabled}
      onClick={() => onChange(mixed ? true : !checked)}
      className={`inline-flex items-center gap-2 max-sm:min-h-10 text-left text-xs text-text-muted hover:text-foreground disabled:opacity-50 ${className}`}
    >
      <span aria-hidden className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? 'bg-gold/70' : mixed ? 'bg-gold/30' : 'bg-card-border'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : mixed ? 'left-2' : 'left-0.5'}`} />
      </span>
      {children}
    </button>
  );
}
