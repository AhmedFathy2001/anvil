'use client';

import type { ReactNode } from 'react';

import ColorSwatch from '@/components/ColorSwatch';
import { MIN_STOP_CONTRAST, SURFACE_BACKGROUND, normalizeHex, type Hex, type NameSurface } from '@/lib/supporterStyle';

// Shared bits of the name-colour editors (Supporter names, boosted clan names): the colour-stop row,
// a name previewed on each kind of background, and the collapsed per-background override.

export const SURFACE_TITLE: Record<NameSurface, string> = { dark: 'Dark backgrounds', light: 'Light backgrounds' };

/** 1–`max` colour stops, each a swatch with its hex, removable down to one. */
export function StopsEditor({
  stops,
  max,
  onChange,
  disabled = false,
  label = 'Colour',
}: {
  stops: Hex[];
  max: number;
  onChange: (next: Hex[]) => void;
  disabled?: boolean;
  /** Prefix of each swatch's accessible name. */
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {stops.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5 rounded-lg border border-card-border px-2 py-1">
          <ColorSwatch
            value={s}
            disabled={disabled}
            ariaLabel={`${label} ${i + 1}`}
            onChange={(hex) => {
              const h = normalizeHex(hex);
              if (h) onChange(stops.map((c, j) => (j === i ? h : c)));
            }}
            className="h-6 w-8 rounded"
          />
          <span className="font-mono text-[11.5px] text-text-muted">{s}</span>
          {stops.length > 1 && !disabled && (
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(stops.filter((_, j) => j !== i))}
              className="text-text-dim hover:text-foreground"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {stops.length < max && !disabled && (
        <button
          type="button"
          onClick={() => onChange([...stops, stops[stops.length - 1] ?? '#ffd27a'])}
          className="rounded-lg border border-dashed border-card-border px-2.5 py-1 text-[12.5px] text-text-muted hover:border-gold/40"
        >
          Add colour
        </button>
      )}
    </div>
  );
}

/**
 * A name on one surface's reference background. `contrast`: the worst stop's ratio when the
 * person set their own look for this surface (worn as-is), so a hard-to-read choice gets a hint.
 */
export function SurfacePreview({ surface, contrast = null, children }: { surface: NameSurface; contrast?: number | null; children: ReactNode }) {
  const light = surface === 'light';
  return (
    <div>
      <div
        className={`flex min-h-11 items-center rounded-lg border px-3 py-2 ${light ? 'border-[#8f805f]' : 'border-card-border'}`}
        style={{ backgroundColor: SURFACE_BACKGROUND[surface] }}
      >
        {children}
        <span className={`ml-auto pl-2 text-[10px] font-medium uppercase tracking-wide ${light ? 'text-black/55' : 'text-white/40'}`}>
          {light ? 'light' : 'dark'}
        </span>
      </div>
      {contrast != null && contrast < MIN_STOP_CONTRAST && (
        <p className="mt-1 text-[12px] text-amber-300/90">
          Hard to read here ({contrast.toFixed(1)}:1). It is shown exactly as picked.
        </p>
      )}
    </div>
  );
}

/** "Set a separate look for … backgrounds": collapsed until switched on; off clears it. */
export function SurfaceOverride({
  surface,
  open,
  onToggle,
  disabled = false,
  children,
}: {
  surface: NameSurface;
  open: boolean;
  onToggle: (open: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-lg border border-card-border/70 p-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={open}
        disabled={disabled}
        onClick={() => onToggle(!open)}
        className="flex w-full items-center gap-2 text-left text-[12.5px] text-text-muted hover:text-foreground disabled:opacity-50"
      >
        <span aria-hidden className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${open ? 'bg-gold/70' : 'bg-card-border'}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${open ? 'left-3.5' : 'left-0.5'}`} />
        </span>
        Set a separate look for {surface} backgrounds
      </button>
      {open && (
        <div className="mt-2.5">
          <p className="mb-2 text-[12px] text-text-dim">
            {SURFACE_TITLE[surface]}: shown exactly as picked, with no automatic contrast fix.
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
