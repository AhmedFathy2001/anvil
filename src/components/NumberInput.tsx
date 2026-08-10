'use client';

import { useState } from 'react';
import Input from '@/components/Input';

// A number field you can actually type in.
//
// The pattern this replaces clamped and coerced on every keystroke —
// `onChange={(e) => setN(Math.max(5, Math.min(50, parseInt(e.target.value, 10) || 10)))}` — which
// makes the field fight you: clearing it snaps straight back to the fallback, and typing "10" into
// a min-5 field gets rewritten to 5 the moment you press "1". The only way to reach 10 from 20 was
// to select the first character and overtype it.
//
// So: while the field has focus it holds your raw text, including empty, and reports upward only
// when the text parses — unclamped, so a half-typed "1" on the way to "10" survives. Clamping and
// the empty-field fallback happen on blur, once you've finished saying what you meant. Committing
// on blur is safe for forms because clicking a submit button blurs the field first.
interface Props {
  value: number;
  /** Receives a parsed number as you type (unclamped), and the clamped value on blur. */
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** What an empty field becomes on blur. Defaults to `min`, else 0. */
  fallback?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /** Runs after the value has been clamped and committed — for save-on-blur call sites. */
  onBlur?: () => void;
}

export default function NumberInput({
  value,
  onChange,
  min,
  max,
  fallback,
  step,
  disabled,
  required,
  placeholder,
  className,
  'aria-label': ariaLabel,
  onBlur,
}: Props) {
  // null = not being edited, so the field mirrors `value`. A string (including '') means the user
  // is mid-edit and owns what's on screen.
  const [draft, setDraft] = useState<string | null>(null);

  function handleChange(raw: string) {
    setDraft(raw);
    if (raw === '' || raw === '-') return; // nothing meaningful to report yet
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  function handleBlur() {
    const raw = draft;
    setDraft(null);
    if (raw === null) {
      onBlur?.();
      return; // never edited — nothing to commit
    }
    const parsed = Number(raw);
    const base = raw.trim() === '' || !Number.isFinite(parsed) ? (fallback ?? min ?? 0) : parsed;
    let next = base;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (next !== value) onChange(next);
    onBlur?.();
  }

  return (
    <Input
      type="number"
      value={draft ?? String(value)}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
