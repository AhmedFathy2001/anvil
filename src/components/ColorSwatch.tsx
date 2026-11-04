'use client';

import { twMerge } from 'tailwind-merge';

// A colour well that looks like ours: a swatch filled with the current colour, our border and focus
// ring. The browser's own well (a grey button with a padded chip, different in every browser) never
// shows — the real <input type="color"> covers the swatch invisibly, so a click or Enter/Space still
// opens the system colour chooser, the same way a styled upload button opens the file chooser.
//
// A <span>, not a <label>, so it can sit inside a call site's own label without nesting labels.
// Size and shape come from `className` (tailwind-merged over the default 28px rounded square).

interface Props {
  value: string;
  onChange: (hex: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
}

export default function ColorSwatch({ value, onChange, onBlur, disabled, ariaLabel, title, className }: Props) {
  return (
    <span
      title={title}
      style={{ backgroundColor: value }}
      className={twMerge(
        'relative inline-block h-7 w-7 shrink-0 rounded-md border border-card-border transition-colors',
        'hover:border-gold/60 focus-within:ring-2 focus-within:ring-gold/40',
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="color"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="absolute inset-0 h-full w-full cursor-[inherit] opacity-0"
      />
    </span>
  );
}
