'use client';

// Small shared pieces of the tile creator. Every control is a real <button> at least 44px tall, so
// the flow works by thumb inside the phone-width side panel.

import type { ReactNode } from 'react';
import type { CountEngine } from '@/lib/tileCreatorConfig';
import type { TaskCandidate } from '@/lib/taskMatch';
import type { TileConfig } from '@/lib/types';
import { bossIconUrl, deriveTileIcon, itemIconUrl } from '@/lib/tileIcons';

/** The icon a tile with this config shows on the board (lib/tileIcons), or null. */
export function configIcon(config: Partial<TileConfig>): string | null {
  return deriveTileIcon({
    tileType: config.tileType ?? 'standard',
    trackedStat: config.trackedStat ?? null,
    statType: config.statType ?? null,
    trackedItemIds: config.trackedItemIds ? JSON.stringify(config.trackedItemIds) : null,
    itemRequirements: config.itemRequirements ? JSON.stringify(config.itemRequirements) : null,
    timedActivity: config.timedActivity ?? null,
    targetNpcs: config.targetNpcs ? JSON.stringify(config.targetNpcs) : null,
  });
}

/** A search result's / suggestion's icon: what its tile would show, else what it seeds from. */
export function candidateIcon(c: TaskCandidate): string | null {
  const fromConfig = configIcon(c.config);
  if (fromConfig) return fromConfig;
  const item = c.seed?.items?.[0]?.id ?? c.seed?.clog?.itemIds?.[0];
  if (item != null) return itemIconUrl(item);
  const page = c.seed?.clog?.pages?.[0];
  return page ? bossIconUrl(page) : null;
}

export function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 w-11 h-11 grid place-items-center rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** A screen's title row: back button + heading. */
export function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {onBack && <BackButton onClick={onBack} />}
      <h4 className="text-base font-bold flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" aria-hidden="true" />
        {title}
      </h4>
    </div>
  );
}

export function Eyebrow({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-sm font-semibold text-foreground/90 mb-2.5">
      {children}
    </p>
  );
}

/** A toggle/choice button that reports its state (aria-pressed). */
export function ChoiceButton({
  pressed,
  onClick,
  children,
  className = '',
  disabled,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-h-11 px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        pressed ? 'bg-gold/15 border-gold text-gold' : 'border-card-border text-foreground hover:border-gold/50'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** How a tile is credited, in one line — green for "counts by itself", amber for screenshots. */
export function CountsBanner({ engine, text, extra }: { engine: CountEngine; text: string; extra?: ReactNode }) {
  const auto = engine !== 'screenshot';
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
        auto ? 'border-accent-green/40 bg-accent-green/10 text-accent-green-light' : 'border-amber-400/40 bg-amber-400/[0.08] text-amber-100'
      }`}
    >
      {auto ? <CheckIcon className="mt-0.5 shrink-0" /> : <span aria-hidden="true" className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-amber-300" />}
      <span>
        {text}
        {extra}
      </span>
    </div>
  );
}

export function KindBadge({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-card-border/70 text-text-muted">
      {children}
    </span>
  );
}

export function PrimaryButton({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-4 rounded-lg bg-gold text-brown-dark font-semibold text-sm hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-4 rounded-lg border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

/** An amount field sized for a sentence ("Clear [5] raids"). */
export function AmountField({
  value,
  onChange,
  label,
  id,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  label: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      aria-label={label}
      inputMode="numeric"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        onChange(raw ? parseInt(raw, 10) : null);
      }}
      className="w-24 min-h-11 px-3 rounded-lg bg-brown-dark border border-card-border text-center text-base font-semibold text-foreground focus:outline-none focus:border-gold"
    />
  );
}
