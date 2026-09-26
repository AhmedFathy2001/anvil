'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { GearItem } from '@/lib/dps/engine';
import { itemIcon } from './useGearData';

/** A small item icon, or the slot's initial when there is none. */
export function ItemIcon({ item, size = 28, fallback }: { item: GearItem | null; size?: number; fallback?: string }) {
  const src = itemIcon(item?.img);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded bg-black/30"
      style={{ width: size, height: size }}
      title={item?.n ?? fallback}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="text-[10px] uppercase text-text-muted/60">{(fallback ?? '').slice(0, 2)}</span>
      )}
    </span>
  );
}

/**
 * Search the items for one slot. A light combobox rather than the app Select: a weapon list is ~900
 * entries and only the best few matches are ever worth drawing.
 */
export default function ItemPicker({
  slot,
  items,
  value,
  onChange,
  disabled,
  label,
}: {
  slot: string;
  items: GearItem[];
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const current = items.find((i) => i.id === value) ?? null;
  const pool = useMemo(() => items.filter((i) => i.s === slot && !i.hid), [items, slot]);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? pool.filter((i) => i.n.toLowerCase().includes(needle)) : pool;
    // Starts-with first, then by the sum of offensive bonuses, so "rune" finds the rune items.
    return list
      .map((i) => ({ i, score: (needle && i.n.toLowerCase().startsWith(needle) ? 1000 : 0) + i.b.slice(0, 8).reduce((a, b) => a + Math.max(0, b), 0) + (i.df ?? 0) / 4 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.i);
  }, [pool, q]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQ('');
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex w-full items-center gap-2 rounded border border-card-border bg-brown-dark px-2 py-1 text-left text-xs hover:border-gold/50 disabled:opacity-60"
        title={current?.n ?? `No ${slot}`}
      >
        <ItemIcon item={current} size={24} fallback={slot} />
        <span className={`truncate ${current ? '' : 'text-text-muted/70'}`}>{current?.n ?? label ?? slot}</span>
      </button>
      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-72 max-w-[85vw] rounded-lg border border-card-border bg-card-bg p-1.5 shadow-xl">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && matches[0]) {
                onChange(matches[0].id);
                setOpen(false);
              }
            }}
            placeholder={`Search ${slot}…`}
            className="mb-1 w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none"
          />
          <ul className="max-h-64 overflow-y-auto text-xs">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="w-full rounded px-2 py-1 text-left text-text-muted hover:bg-white/10"
              >
                — Nothing
              </button>
            </li>
            {matches.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/10 ${i.id === value ? 'text-gold' : ''}`}
                >
                  <ItemIcon item={i} size={20} />
                  <span className="truncate">{i.n}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-2 py-1 text-text-muted">No match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
