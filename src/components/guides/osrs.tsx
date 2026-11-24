'use client';

// The game's own interfaces, drawn for guides: the equipment screen (paper doll with its connector
// lines and the quiver slot above ammo), the 4×7 inventory, the rune pouch, the spellbook and its
// spells, and a bank tag tab. Icons are the site's item route (/img/item/<id>.png) and the wiki's
// sprites through the site's wiki cache. Items sit loose on stone-brown panels, stack counts yellow.

import { useState, type ReactNode } from 'react';

import { itemAssetUrl, wikiImageUrl } from '@/lib/assetUrls';
import { bankLayout, type ExportSetup } from '@/lib/runeliteExport';
import { bankGrid } from '@/lib/runeliteImport';
import { spellbookName } from '@/lib/guideSelection';
import type { InvItem } from '@/lib/guideTiers';

export type Names = Record<number, string>;

/** The in-game stack label and colour: yellow under 100K, white "K" to 10M, green "M" above. */
export function stack(q: number): { text: string; color: string } {
  if (q >= 10_000_000) return { text: `${Math.floor(q / 1_000_000)}M`, color: '#00ff80' };
  if (q >= 100_000) return { text: `${Math.floor(q / 1000)}K`, color: '#ffffff' };
  return { text: String(q), color: '#ffff00' };
}

export function ItemSprite({ id, name, size = 32, qty, dim, title }: { id: number; name?: string; size?: number; qty?: number; dim?: boolean; title?: string }) {
  const s = qty && qty > 1 ? stack(qty) : null;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} title={title ?? name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={itemAssetUrl(id)} alt={name ?? ''} loading="lazy" className={`max-h-full max-w-full object-contain [image-rendering:pixelated] drop-shadow-[1px_1px_0_rgba(0,0,0,0.6)] ${dim ? 'opacity-35 grayscale' : ''}`} />
      {s && (
        <span className="pointer-events-none absolute -top-0.5 left-0 text-[10px] font-bold leading-none" style={{ color: s.color, textShadow: '1px 1px 0 #000' }}>
          {s.text}
        </span>
      )}
    </span>
  );
}

/** The stone panel every interface sits on: brown, a dark outer edge, a gold top rule. */
export function StonePanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded border border-[#14100b] border-t-2 border-t-gold bg-[#3e3529] shadow-[inset_0_0_0_1px_#54483a] ${className}`}>{children}</div>;
}

const SLOT_LABEL: Record<string, string> = {
  head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring', quiver: 'Quiver',
};
/** The wiki's own slot silhouettes, faint in an empty slot as in game. Quiver uses the ammo glyph. */
const slotGlyph = (slot: string) => wikiImageUrl(`${SLOT_LABEL[slot === 'quiver' ? 'ammo' : slot]}_slot.png`);

export interface SlotNote {
  /** "fallback": the reader will use another item; "missing": they own nothing on the list. */
  kind: 'fallback' | 'missing';
  text: string;
}

/**
 * The equipment screen. Rows: [ –, head, quiver ], [ cape, neck, ammo ], [ weapon, body, shield ],
 * [ –, legs, – ], [ hands, feet, ring ]. The quiver's second ammo slot only appears with Dizana's
 * quiver (or its max cape) worn, directly above Ammo. A two-handed weapon writes "two-handed" in the
 * empty shield slot.
 */
export function PaperDoll({
  gear,
  quiver,
  hasQuiver,
  twoHanded,
  names,
  notes = {},
  onSlot,
  size = 46,
}: {
  gear: Record<string, number | undefined>;
  quiver?: number | null;
  hasQuiver: boolean;
  twoHanded: boolean;
  names: Names;
  notes?: Record<string, SlotNote>;
  onSlot?: (slot: string) => void;
  size?: number;
}) {
  const gapPx = Math.round(size * 0.27);
  const rows: (string | null)[][] = [
    [null, 'head', hasQuiver ? 'quiver' : null],
    ['cape', 'neck', 'ammo'],
    ['weapon', 'body', 'shield'],
    [null, 'legs', null],
    ['hands', 'feet', 'ring'],
  ];
  const ctr = (i: number) => i * (size + gapPx) + size / 2;
  const line = 'absolute z-0 bg-[#6b5c45]';
  return (
    <div className="relative grid" style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gridAutoRows: `${size}px`, gap: gapPx }}>
      {/* Connector lines: the spine down the middle column, and the three cross rows. */}
      <span aria-hidden className={line} style={{ left: ctr(1) - 1, top: ctr(0), width: 2, height: ctr(4) - ctr(0) }} />
      {[1, 2, 4].map((r) => (
        <span key={r} aria-hidden className={line} style={{ top: ctr(r) - 1, left: ctr(0), height: 2, width: ctr(2) - ctr(0) }} />
      ))}
      {hasQuiver && <span aria-hidden className={line} style={{ left: ctr(2) - 1, top: ctr(0), width: 2, height: ctr(1) - ctr(0) }} />}
      {rows.flat().map((slot, i) => {
        if (!slot) return <span key={i} />;
        const id = slot === 'quiver' ? quiver ?? undefined : gear[slot];
        const note = notes[slot];
        const label = SLOT_LABEL[slot];
        const empty = !id;
        return (
          <button
            key={i}
            type="button"
            disabled={!onSlot || empty}
            onClick={() => onSlot?.(slot)}
            title={empty ? `${label}: empty` : `${label}: ${names[id] ?? `item ${id}`}${note ? ` — ${note.text}` : ''}`}
            aria-label={empty ? `${label}: empty` : `${label}: ${names[id] ?? `item ${id}`}`}
            className={`relative z-10 flex items-center justify-center rounded-[3px] bg-[#2b241b] shadow-[inset_1px_1px_0_#18130d,inset_-1px_-1px_0_#5a4d3b] enabled:hover:ring-1 enabled:hover:ring-gold/60 ${note?.kind === 'missing' ? 'ring-1 ring-red-400/50' : ''}`}
          >
            {id ? (
              <ItemSprite id={id} name={names[id]} size={Math.round(size * 0.74)} dim={note?.kind === 'missing'} />
            ) : slot === 'shield' && twoHanded ? (
              <span className="px-0.5 text-center text-[9px] leading-tight text-[#8a7f6a]">two-handed</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slotGlyph(slot)} alt="" className="max-h-[60%] max-w-[60%] opacity-25 grayscale" loading="lazy" />
            )}
            {slot === 'quiver' && <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-[#a99d86]">Quiver</span>}
            {note?.kind === 'fallback' && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1b1610] text-[10px] font-bold text-gold ring-1 ring-gold/60" aria-hidden>
                ↓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The 4×7 inventory, items loose on the panel. */
export function InventoryGrid({ inventory, names, size = 34 }: { inventory: (InvItem | null)[] | undefined; names: Names; size?: number }) {
  const cells = Array.from({ length: 28 }, (_, i) => inventory?.[i] ?? null);
  return (
    <StonePanel className="inline-grid grid-cols-4 gap-x-1 gap-y-0.5 px-2.5 py-2">
      {cells.map((it, i) => (
        <span key={i} className="flex items-center justify-center" style={{ width: size, height: size * 0.84 }}>
          {it ? <ItemSprite id={it.id} name={names[it.id]} qty={it.q} size={Math.round(size * 0.88)} /> : null}
        </span>
      ))}
    </StonePanel>
  );
}

/** The rune pouch: 3 runes, or 4 with a divine pouch, each with its count. */
export function RunePouchBox({ runes, divine, names }: { runes: InvItem[]; divine: boolean; names: Names }) {
  const pouchId = divine ? 27281 : 12791;
  return (
    <StonePanel className="inline-flex items-center gap-1 px-1.5 py-1">
      <ItemSprite id={pouchId} name={divine ? 'Divine rune pouch' : 'Rune pouch'} size={28} />
      {Array.from({ length: divine ? 4 : 3 }, (_, i) => runes[i] ?? null).map((r, i) => (
        <span key={i} className="flex h-8 w-9 items-center justify-center rounded-[3px] bg-[#2b241b] shadow-[inset_1px_1px_0_#18130d,inset_-1px_-1px_0_#5a4d3b]">
          {r ? <ItemSprite id={r.id} name={names[r.id]} qty={r.q ?? 1} size={28} /> : null}
        </span>
      ))}
    </StonePanel>
  );
}

const BOOK_FILE = ['Standard_spellbook.png', 'Ancient_spellbook.png', 'Lunar_spellbook.png', 'Arceuus_spellbook.png'];

/** The spellbook's book icon, then the spells the setup needs as their own icons. */
export function SpellbookRow({ spellbook, spells }: { spellbook?: number; spells?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StonePanel className="inline-flex items-center gap-1.5 py-0.5 pl-1 pr-2 text-xs text-[#ece4d4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wikiImageUrl(BOOK_FILE[spellbook ?? 0] ?? BOOK_FILE[0])} alt="" className="h-6 w-6 object-contain [image-rendering:pixelated]" loading="lazy" />
        {spellbookName(spellbook)}
      </StonePanel>
      {(spells ?? []).map((sp) => (
        <span key={sp} className="inline-flex items-center gap-1 text-xs text-text-muted" title={sp}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wikiImageUrl(`${sp}.png`)} alt="" className="h-5 w-5 object-contain [image-rendering:pixelated]" loading="lazy" />
          {sp}
        </span>
      ))}
    </div>
  );
}

/**
 * A bank tag tab as RuneLite's bank shows it: the tag's icon and name in the tab header, then the
 * layout 8 per row (index = row × 8 + column, RuneLite's BANK_ITEMS_PER_ROW), empty positions empty.
 * Fed by runeliteExport.bankLayout — the same function the copy button's string comes from.
 */
export function BankTagPreview({ setup, names, icon }: { setup: ExportSetup; names: Names; icon?: number }) {
  const layout = bankLayout(setup);
  const grid = bankGrid(layout);
  const qty = new Map<number, number>();
  for (const it of [...(setup.inventory ?? []), ...(setup.runePouch ?? [])]) if (it && it.q) qty.set(it.id, Math.max(qty.get(it.id) ?? 0, it.q));
  const tagIcon = icon ?? setup.gear.weapon ?? [...layout.values()][0];
  return (
    <div className="inline-block overflow-hidden rounded border border-[#14100b] bg-[#3e3529] shadow-[inset_0_0_0_1px_#54483a]">
      <div className="flex items-center gap-2 border-b border-[#14100b] bg-[#2f2820] px-2 py-1">
        {tagIcon ? <ItemSprite id={tagIcon} name={names[tagIcon]} size={26} /> : null}
        <span className="text-xs font-semibold text-[#ff981f]">{setup.name}</span>
      </div>
      <div className="grid grid-cols-8 gap-x-[6px] gap-y-[2px] p-2">
        {grid.flat().map((id, i) => (
          <span key={i} className="flex h-8 w-9 items-center justify-center">
            {id ? <ItemSprite id={id} name={names[id]} qty={qty.get(id)} size={30} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A collapsible bank tag preview under a setup. */
export function BankTagPreviewToggle({ setup, names }: { setup: ExportSetup; names: Names }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold">
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span> Bank tag preview
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 overflow-x-auto">
          <BankTagPreview setup={setup} names={names} />
          <p className="text-[11px] text-text-muted">How the tag looks in your bank: worn gear in its paper-doll shape on the left, the inventory 4 wide on the right.</p>
        </div>
      )}
    </div>
  );
}

// ── Writer rank badge ───────────────────────────────────────────────────────────────────────────

const QUILL = { bronze: '#c27c3e', silver: '#c9d1d9', gold: '#e0b453' } as const;
export type QuillTone = keyof typeof QUILL;

/**
 * The writer's quill: bronze Contributor, silver Guide writer, gold Master writer. With Supporter it
 * becomes the gold star with the quill across it — the best of both.
 */
export function WriterBadge({ tone, supporter = false, size = 14, title }: { tone: QuillTone; supporter?: boolean; size?: number; title?: string }) {
  const c = supporter ? QUILL.gold : QUILL[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? 'Writer'} className="inline-block shrink-0 align-[-0.15em]">
      <title>{title ?? 'Writer'}</title>
      {supporter && <path d="M12 1.8l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 16.7 6.1 19.9l1.3-6.6L2.5 8.7l6.6-.8z" fill="#ffd35c" opacity="0.9" />}
      <path d="M20.5 2.5c-7 .8-12.4 6.2-14 13.2l-1.3 5.8 1.6-.8c1-3 2.3-5 4.3-6.1 4.7-1.4 8-5 9.4-12.1z" fill={supporter ? '#7a4f12' : c} stroke={supporter ? '#ffd35c' : 'rgba(0,0,0,0.45)'} strokeWidth="0.8" />
      <path d="M6.8 18.6c3.2-4.6 6.6-8.4 11.4-12.6" stroke={supporter ? '#ffd35c' : 'rgba(0,0,0,0.35)'} strokeWidth="0.9" fill="none" />
    </svg>
  );
}
