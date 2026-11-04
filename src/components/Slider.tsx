'use client';

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { twMerge } from 'tailwind-merge';

// A range slider in the site's look: gold fill and thumb on the card-border track, our focus ring.
// Replaces <input type="range">, whose track and thumb are the browser's.
//
// Same contract as the native input it replaces: controlled `value`, and `onChange` fires on every
// step while dragging or pressing keys, not once at the end. Call sites that save "when you let go"
// keep doing it with onPointerUp / onKeyUp / onBlur, which are passed through to the slider itself
// (pointer capture means pointerup lands here even when released off the track).
//
// Vertical runs min at the TOP, like the `writing-mode: vertical-lr` range inputs it replaces, so
// "Top / Bottom" labels around it still read right. On a vertical slider ArrowDown moves the thumb
// down (towards max) — the key follows what you see. PageUp/PageDown move a tenth, Home/End the ends.
//
// `name` adds a hidden input so a wrapping <form> still submits the value.

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  name?: string;
  ariaLabel?: string;
  /** Size and layout of the hit area — e.g. `w-32` horizontal, `flex-1` in a column for vertical. */
  className?: string;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
  onKeyUp?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onBlur?: () => void;
}

export default function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  orientation = 'horizontal',
  disabled,
  name,
  ariaLabel,
  className,
  onPointerUp,
  onKeyUp,
  onBlur,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const vertical = orientation === 'vertical';
  const span = max - min || 1;
  const clamp = (v: number) => {
    const stepped = Math.round((v - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(stepped.toFixed(10))));
  };
  const pct = ((Math.min(max, Math.max(min, value)) - min) / span) * 100;

  function emit(v: number) {
    const next = clamp(v);
    if (next !== value) onChange(next);
  }

  function fromPointer(e: PointerEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const frac = vertical ? (e.clientY - r.top) / (r.height || 1) : (e.clientX - r.left) / (r.width || 1);
    emit(min + Math.min(1, Math.max(0, frac)) * span);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); // no text selection / page scroll while dragging
    ref.current?.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!disabled && e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const big = Math.max(step, span / 10);
    const up = vertical ? 'ArrowDown' : 'ArrowRight';
    const down = vertical ? 'ArrowUp' : 'ArrowLeft';
    let next: number | null = null;
    if (e.key === up || (!vertical && e.key === 'ArrowUp')) next = value + step;
    else if (e.key === down || (!vertical && e.key === 'ArrowDown')) next = value - step;
    else if (e.key === 'PageUp') next = value - big * (vertical ? 1 : -1);
    else if (e.key === 'PageDown') next = value + big * (vertical ? 1 : -1);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    emit(next);
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation={orientation}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      className={twMerge(
        'group relative shrink-0 touch-none select-none rounded-full outline-none',
        vertical ? 'min-h-16 w-4' : 'h-4 min-w-16',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      {/* track */}
      <span
        aria-hidden
        className={`pointer-events-none absolute rounded-full bg-card-border ${
          vertical ? 'inset-y-0 left-1/2 w-1 -translate-x-1/2' : 'inset-x-0 top-1/2 h-1 -translate-y-1/2'
        }`}
      >
        {/* fill from min to the thumb */}
        <span
          className={`absolute rounded-full bg-gold ${vertical ? 'inset-x-0 top-0' : 'inset-y-0 left-0'}`}
          style={vertical ? { height: `${pct}%` } : { width: `${pct}%` }}
        />
      </span>
      {/* thumb */}
      <span
        aria-hidden
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brown-dark bg-gold shadow transition-shadow group-hover:shadow-[0_0_0_3px_rgba(224,170,30,0.2)] group-focus-visible:ring-2 group-focus-visible:ring-gold/50"
        style={vertical ? { left: '50%', top: `${pct}%` } : { top: '50%', left: `${pct}%` }}
      />
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
