'use client';

import { useEffect, useRef, useState } from 'react';

import type { InvItem } from '@/lib/guideTiers';

/** Wiki icon for any item by name — inventories hold items the equipment dataset doesn't know. */
const iconFor = (name: string | undefined) =>
  name ? `https://oldschool.runescape.wiki/images/${encodeURIComponent(name.replace(/ /g, '_'))}.png` : null;

/** The in-game stack label (K from 100,000, M from 10M) — sooner in small cells, where digits collide. */
function stackLabel(q: number, compact: boolean): string {
  if (q >= 10_000_000) return `${Math.floor(q / 1_000_000)}M`;
  if (q >= 100_000 || (compact && q >= 1000)) return `${Math.floor(q / 1000)}K`;
  return String(q);
}

export type ItemNames = Record<number, string>;

/** Remember names for ids, so a saved inventory shows its items without a lookup per slot. */
export function useItemNames(ids: number[]): ItemNames {
  const [names, setNames] = useState<ItemNames>({});
  const key = [...new Set(ids)].sort((a, b) => a - b).join(',');
  useEffect(() => {
    const missing = key.split(',').filter(Boolean).map(Number).filter((id) => !names[id]);
    if (!missing.length) return;
    let alive = true;
    Promise.all(
      missing.slice(0, 40).map((id) =>
        fetch(`/api/gear/items-search?q=${id}`)
          .then((r) => r.json())
          .then((j) => [id, j.items?.[0]?.name as string | undefined] as const)
          .catch(() => [id, undefined] as const),
      ),
    ).then((pairs) => {
      if (!alive) return;
      setNames((n) => ({ ...n, ...Object.fromEntries(pairs.filter(([, v]) => v)) }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id set
  }, [key]);
  return names;
}

function ItemSearch({ onPick, onClose }: { onPick: (item: { id: number; name: string }) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: number; name: string }[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/gear/items-search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => setHits(j.items ?? []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="w-72 rounded-lg border border-[#4a3f31] bg-[#14100b] p-2 shadow-2xl">
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && hits[0]) onPick(hits[0]);
        }}
        placeholder="Search any item… (shark, prayer potion)"
        className="mb-1.5 w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none"
      />
      <ul className="max-h-56 overflow-y-auto overscroll-contain text-xs">
        {hits.map((h) => (
          <li key={h.id}>
            <button type="button" onClick={() => onPick(h)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconFor(h.name)!} alt="" className="h-5 w-5 object-contain" loading="lazy" />
              <span className="truncate">{h.name}</span>
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && hits.length === 0 && <li className="px-2 py-1 text-text-muted">No match.</li>}
      </ul>
    </div>
  );
}

function Cell({
  item,
  name,
  size,
  readOnly,
  onOpen,
  onClear,
}: {
  item: InvItem | null;
  name?: string;
  size: number;
  readOnly: boolean;
  onOpen: () => void;
  onClear: () => void;
}) {
  const icon = iconFor(name);
  return (
    <div className="group relative" style={{ width: size, height: size }}>
      <button
        type="button"
        disabled={readOnly}
        onClick={onOpen}
        title={name ? `${name}${item?.q && item.q > 1 ? ` ×${item.q}` : ''}` : 'Empty'}
        className="flex h-full w-full items-center justify-center rounded-[4px] border border-[#4a3f31]/60 bg-[#1d1812]/70 enabled:hover:border-gold/60 disabled:cursor-default"
      >
        {item && icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="max-h-[80%] max-w-[80%] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" loading="lazy" />
        )}
      </button>
      {item?.q && item.q > 1 && (
        <span className={`pointer-events-none absolute left-0.5 top-0 font-bold leading-none text-yellow-300 drop-shadow-[0_1px_0_#000] ${size < 30 ? 'text-[8px]' : 'text-[9px]'}`}>
          {stackLabel(item.q, size < 30)}
        </span>
      )}
      {item && !readOnly && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Empty slot"
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/80 text-[10px] text-text-muted hover:text-red-300 group-hover:flex"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * The 28-slot inventory, laid out like the in-game backpack, with an optional rune pouch row.
 * Editable: click a slot to search any item; stackables ask for a quantity.
 */
export default function InventoryPanel({
  inventory,
  runePouch,
  names,
  onChange,
  onRunePouch,
  readOnly = false,
  size = 34,
}: {
  inventory: (InvItem | null)[] | undefined;
  runePouch?: InvItem[];
  names: ItemNames;
  onChange?: (next: (InvItem | null)[]) => void;
  onRunePouch?: (next: InvItem[]) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const [open, setOpen] = useState<{ kind: 'inv' | 'rp'; i: number } | null>(null);
  const [learned, setLearned] = useState<ItemNames>({});
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const slots = Array.from({ length: 28 }, (_, i) => inventory?.[i] ?? null);
  const pouch = Array.from({ length: 4 }, (_, i) => runePouch?.[i] ?? null);
  const nameOf = (id: number | undefined) => (id ? (learned[id] ?? names[id]) : undefined);

  const pick = (h: { id: number; name: string }) => {
    if (!open) return;
    setLearned((l) => ({ ...l, [h.id]: h.name }));
    const stackable = /rune$|arrow|bolt|dart|coins|knife|javelin/i.test(h.name) || open.kind === 'rp';
    let q = 1;
    if (stackable) {
      const answer = window.prompt(`How many ${h.name}?`, open.kind === 'rp' ? '1000' : '100');
      q = Math.max(1, Math.min(2_147_483_647, Number(answer) || 1));
    }
    if (open.kind === 'inv') {
      const next = [...slots];
      next[open.i] = { id: h.id, ...(q > 1 ? { q } : {}) };
      onChange?.(next);
    } else {
      const next = [...pouch];
      next[open.i] = { id: h.id, q };
      onRunePouch?.(next.filter((x): x is InvItem => !!x));
    }
    setOpen(null);
  };

  const gap = Math.round(size / 9);
  return (
    <div ref={boxRef} className="relative inline-block">
      <div
        className="inline-grid rounded-lg border border-[#4a3f31] bg-gradient-to-b from-[#3a3024] to-[#2a231a]"
        style={{ gridTemplateColumns: `repeat(4, ${size}px)`, gap, padding: gap + 2 }}
      >
        {slots.map((it, i) => (
          <Cell
            key={i}
            item={it}
            name={nameOf(it?.id)}
            size={size}
            readOnly={readOnly}
            onOpen={() => setOpen({ kind: 'inv', i })}
            onClear={() => {
              const next = [...slots];
              next[i] = null;
              onChange?.(next);
            }}
          />
        ))}
      </div>
      {(runePouch?.length || !readOnly) && (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Rune pouch</span>
          {pouch.map((it, i) => (
            <Cell
              key={i}
              item={it}
              name={nameOf(it?.id)}
              size={Math.round(size * 0.8)}
              readOnly={readOnly}
              onOpen={() => setOpen({ kind: 'rp', i })}
              onClear={() => onRunePouch?.(pouch.filter((_, j) => j !== i).filter((x): x is InvItem => !!x))}
            />
          ))}
        </div>
      )}
      {open && !readOnly && (
        <div className="absolute left-0 top-full z-40 mt-1">
          <ItemSearch onPick={pick} onClose={() => setOpen(null)} />
        </div>
      )}
    </div>
  );
}
