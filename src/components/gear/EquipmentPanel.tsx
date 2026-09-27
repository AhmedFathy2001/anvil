'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { GearItem } from '@/lib/dps/engine';
import type { Slot } from '@/lib/dps/tables';
import { itemIcon } from './useGearData';

// The in-game equipment screen: the slots where a player's eye expects them.
const LAYOUT: (Slot | null)[][] = [
  [null, 'head', null],
  ['cape', 'neck', 'ammo'],
  ['weapon', 'body', 'shield'],
  [null, 'legs', null],
  ['hands', 'feet', 'ring'],
];

const SLOT_LABEL: Record<Slot, string> = {
  head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body',
  shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring',
};

// The wiki's own slot silhouettes, faint in an empty slot like in game.
const slotGlyph = (slot: Slot) => `https://oldschool.runescape.wiki/images/${SLOT_LABEL[slot]}_slot.png`;

const BONUS = ['Stab', 'Slash', 'Crush', 'Magic', 'Range', 'Str', 'R.Str', 'M.Dmg', 'Pray'];

/** The item's non-zero bonuses, the way the equipment stats screen shows them. */
function bonusLine(item: GearItem): string {
  return item.b
    .map((v, i) => (v ? `${BONUS[i]} ${v > 0 ? '+' : ''}${v}${i === 7 ? '%' : ''}` : null))
    .filter(Boolean)
    .join(' · ');
}

function SlotBox({
  slot,
  item,
  size,
  active,
  readOnly,
  onOpen,
  onClear,
}: {
  slot: Slot;
  item: GearItem | null;
  size: number;
  active: boolean;
  readOnly: boolean;
  onOpen: () => void;
  onClear: () => void;
}) {
  const icon = itemIcon(item?.img);
  return (
    <div className="group relative" style={{ width: size, height: size }}>
      <button
        type="button"
        disabled={readOnly}
        onClick={onOpen}
        aria-label={item ? `${SLOT_LABEL[slot]}: ${item.n}` : `${SLOT_LABEL[slot]}: empty`}
        className={`flex h-full w-full items-center justify-center rounded-[5px] border bg-[#1d1812] shadow-[inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_-1px_0_rgba(255,255,255,0.04)] transition-colors ${
          active ? 'border-gold' : 'border-[#4a3f31] enabled:hover:border-gold/60'
        } disabled:cursor-default`}
      >
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="max-h-[78%] max-w-[78%] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" loading="lazy" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slotGlyph(slot)} alt="" className="max-h-[70%] max-w-[70%] object-contain opacity-25 grayscale" loading="lazy" />
        )}
      </button>
      {/* Hover card: name and bonuses, like examining the item. */}
      {item && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[220px] -translate-x-1/2 rounded-md border border-[#4a3f31] bg-[#14100b]/95 px-2 py-1 text-[11px] shadow-lg group-hover:block">
          <div className="font-semibold text-[#ff981f]">{item.n}</div>
          {bonusLine(item) && <div className="text-text-muted">{bonusLine(item)}</div>}
          {item.sp && <div className="text-text-muted">Speed {item.sp} ticks{item.h2 ? ' · two-handed' : ''}</div>}
        </div>
      )}
      {item && !readOnly && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${item.n}`}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/80 text-[10px] leading-none text-text-muted hover:text-red-300 group-hover:flex"
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Search the items that fit one slot. */
function SlotSearch({ slot, items, value, onPick, onClose }: { slot: Slot; items: GearItem[]; value: number | null | undefined; onPick: (id: number | null) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = items.filter((i) => i.s === slot && !i.hid && (!needle || i.n.toLowerCase().includes(needle)));
    return pool
      .map((i) => ({ i, score: (needle && i.n.toLowerCase().startsWith(needle) ? 1000 : 0) + i.b.slice(0, 8).reduce((a, b) => a + Math.max(0, b), 0) + (i.df ?? 0) / 4 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.i);
  }, [items, slot, q]);
  return (
    <div className="rounded-lg border border-[#4a3f31] bg-[#14100b] p-2 shadow-2xl">
      <div className="mb-1.5 flex items-center gap-2">
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && matches[0]) onPick(matches[0].id);
          }}
          placeholder={`Search ${SLOT_LABEL[slot].toLowerCase()} items…`}
          className="min-w-0 flex-1 rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none"
        />
        {value != null && (
          <button type="button" onClick={() => onPick(null)} className="text-[11px] text-text-muted hover:text-red-300">
            Empty slot
          </button>
        )}
      </div>
      <ul className="max-h-60 overflow-y-auto overscroll-contain text-xs">
        {matches.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onPick(i.id)}
              className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-white/10 ${i.id === value ? 'text-gold' : ''}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {itemIcon(i.img) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={itemIcon(i.img)!} alt="" className="max-h-full max-w-full" loading="lazy" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{i.n}</span>
              <span className="shrink-0 text-[10px] text-text-muted">{bonusLine(i).split(' · ').slice(0, 2).join(' · ')}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-2 py-2 text-text-muted">No match.</li>}
      </ul>
    </div>
  );
}

/**
 * Worn equipment, drawn like the in-game equipment tab. Click a slot to search for an item for it;
 * hover to see what it gives. `size` shrinks it for read-only previews on setup cards.
 */
export default function EquipmentPanel({
  gear,
  items,
  lookup,
  onChange,
  readOnly = false,
  size = 44,
}: {
  gear: Partial<Record<Slot, number>>;
  items: GearItem[];
  lookup: (id: number | null | undefined) => GearItem | null;
  onChange?: (slot: Slot, id: number | null) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const [open, setOpen] = useState<Slot | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const gap = Math.round(size / 7);
  return (
    <div ref={boxRef} className="relative inline-block">
      <div
        className="inline-grid rounded-lg border border-[#4a3f31] bg-gradient-to-b from-[#3a3024] to-[#2a231a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gap, padding: gap + 2 }}
      >
        {LAYOUT.flat().map((slot, i) =>
          slot ? (
            <SlotBox
              key={slot}
              slot={slot}
              item={lookup(gear[slot])}
              size={size}
              active={open === slot}
              readOnly={readOnly}
              onOpen={() => setOpen(open === slot ? null : slot)}
              onClear={() => onChange?.(slot, null)}
            />
          ) : (
            <span key={`e${i}`} style={{ width: size, height: size }} />
          ),
        )}
      </div>
      {open && !readOnly && (
        <div className="absolute left-0 top-full z-40 mt-1 w-80 max-w-[85vw]">
          <SlotSearch
            slot={open}
            items={items}
            value={gear[open]}
            onClose={() => setOpen(null)}
            onPick={(id) => {
              onChange?.(open, id);
              setOpen(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
