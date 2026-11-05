'use client';

import type { ReactNode } from 'react';

// The settings controls from the mockup (https://claude.ai/artifact/5Ksnm48moeBB6PaQXWSyDh): a
// segmented pill group for a one-of choice, a switch for on/off, and a row that lays a setting's
// name and hint beside its control with a rule between rows. Every panel on every tab uses these, so
// a choice looks like a choice wherever it is.

/** One of a few: "Your clan | Invited clans | Anyone". The picked option's hint shows underneath. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  showHint = true,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  /** For screen readers: what is being chosen. */
  label: string;
  disabled?: boolean;
  showHint?: boolean;
}) {
  const hint = options.find((o) => o.value === value)?.hint;
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-xl border border-card-border bg-brown-dark p-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`min-h-9 rounded-lg px-3.5 text-[13px] transition-colors disabled:opacity-50 ${
                on ? 'bg-card-bg-hover font-medium text-gold shadow-[inset_0_0_0_1px_var(--card-border)]' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {showHint && hint && <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">{hint}</p>}
    </div>
  );
}

/** On or off. A real switch (role="switch"), labelled by the row it sits in. */
export function Switch({ on, onChange, label, disabled = false }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-gold' : 'bg-card-border'}`}
    >
      <span
        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full transition-all ${on ? 'left-[23px] bg-brown-dark' : 'left-[3px] bg-text-muted'}`}
        aria-hidden
      />
    </button>
  );
}

/**
 * One line of a settings card: what it is (and a hint) on the left, its control on the right; rows
 * are separated by a rule. `stack` puts the control under the words, for wide ones (a segmented
 * group with long labels, a list).
 */
export function SettingRow({ title, hint, children, stack = false }: { title?: ReactNode; hint?: ReactNode; children?: ReactNode; stack?: boolean }) {
  return (
    <div className={`flex gap-x-5 gap-y-3 border-t border-card-border/70 px-5 py-4 first:border-t-0 ${stack ? 'flex-col' : 'flex-wrap items-center justify-between'}`}>
      {(title || hint) && (
        // The 14rem basis is a width for the side-by-side layout; in a column it became a 14rem
        // height and left a blank gap above the control.
        <div className={`min-w-0 ${stack ? '' : 'flex-[1_1_14rem]'}`}>
          {title && <div className="text-[14px] font-medium">{title}</div>}
          {hint && <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">{hint}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
