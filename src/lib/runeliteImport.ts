// The inverse of lib/runeliteExport: read a pasted Bank Tags string or Inventory Setups JSON. PURE.
//
// Bank Tags, from RuneLite's TabInterface (importTag / the export op):
//   the clipboard is CSV (Text.fromCSV). First token = the name — unless it is "banktags", in which
//   case the next token is a version ("1", not validated by RuneLite) and the token after that is the
//   name. Older strings without the "banktags,1," head start straight at the name. Then the icon item
//   id, then item ids until a "layout" token, then <index>,<itemId> pairs. The export lists an item
//   loose only when the layout doesn't hold it, so a tag can be all layout, all loose, or both.
//   A layout index is a bank position: column = idx % 8, row = idx / 8 (BANK_ITEMS_PER_ROW = 8).
//   RuneLite strips < > / : from the name. ("banktaglayoutsplugin…" strings are an older third-party
//   format and are refused here with a clear message.)
// Inventory Setups: { setup: { inv[28], eq[14], rp?, sb?, name, notes?, hc }, layout? } — items as
//   { id, q? }, eq indexed by EquipmentInventorySlot (runeliteExport EQUIPMENT_INDEX).
//
// STRICT: ids and indexes must be plain non-negative integers in range, counts are bounded, the name
// is reduced to plain text. Anything else is refused with a sentence saying what was wrong.

import { EQUIPMENT_INDEX, type EquipSlot } from './runeliteExport';
import type { InvItem } from './guideTiers';

export const BANK_COLUMNS = 8;
const MAX_ITEMS = 400;
const MAX_INDEX = 8 * 120;
const MAX_ID = 100_000;
const NAME_MAX = 40;

export interface ImportedTag {
  source: 'banktag' | 'inventory-setup';
  name: string;
  icon: number | null;
  /** Every distinct item, in order seen. */
  items: number[];
  /** Bank position → item id. */
  layout: Map<number, number>;
  /** Only from an Inventory Setup: the worn items by slot, the 28, the pouch and spellbook. */
  gear?: Partial<Record<EquipSlot, number>>;
  inventory?: (InvItem | null)[];
  runePouch?: InvItem[];
  spellbook?: number;
}

export type ImportResult = { ok: true; tag: ImportedTag } | { ok: false; error: string };

/** A tag or setup name as plain text: no markup, none of < > / : , and no control characters. */
export function cleanImportName(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  return (
    s
      .replace(/<[^>]*>/g, '')
      .replace(/[<>/:,"'`]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NAME_MAX) || 'Imported setup'
  );
}

const ID_RE = /^\d{1,6}$/;
function intToken(t: string | undefined, max: number): number | null {
  if (t == null || !ID_RE.test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
}

/** Parse a Bank Tags export string. */
export function parseBankTag(text: string): ImportResult {
  const raw = text.trim();
  if (!raw) return { ok: false, error: 'Paste a bank tag first.' };
  if (raw.length > 20_000) return { ok: false, error: 'That is too long to be a bank tag.' };
  if (raw.startsWith('banktaglayoutsplugin')) return { ok: false, error: 'That is the old Bank Tag Layouts format. Re-export the tag from RuneLite’s own Bank Tags.' };
  // Text.fromCSV: split on commas, trim each value.
  const tokens = raw.split(',').map((t) => t.trim());
  let i = 0;
  let name = tokens[i++];
  if (name === 'banktags') {
    i++; // version
    name = tokens[i++];
  }
  if (name == null || !cleanImportName(name)) return { ok: false, error: 'The bank tag has no name.' };
  const icon = intToken(tokens[i++], MAX_ID);
  if (icon == null) return { ok: false, error: 'The icon must be an item id (a whole number).' };
  const items: number[] = [];
  const layout = new Map<number, number>();
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'layout') {
      i++;
      break;
    }
    if (t === '') continue;
    const id = intToken(t, MAX_ID);
    if (id == null) return { ok: false, error: `"${t.slice(0, 20)}" isn't an item id.` };
    if (!items.includes(id)) items.push(id);
    if (items.length > MAX_ITEMS) return { ok: false, error: `At most ${MAX_ITEMS} items.` };
  }
  for (; i < tokens.length; i += 2) {
    const idx = intToken(tokens[i], MAX_INDEX);
    const id = intToken(tokens[i + 1], MAX_ID);
    if (idx == null || id == null) return { ok: false, error: 'The layout must be pairs of bank position and item id.' };
    layout.set(idx, id);
    if (!items.includes(id)) items.push(id);
    if (layout.size > MAX_ITEMS) return { ok: false, error: `At most ${MAX_ITEMS} items.` };
  }
  // A tag with no layout lays its items out in order, as the bank would.
  if (!layout.size) items.forEach((id, k) => layout.set(k, id));
  return { ok: true, tag: { source: 'banktag', name: cleanImportName(name), icon, items, layout } };
}

function itemOf(v: unknown): InvItem | null | 'bad' {
  if (v == null) return null;
  if (typeof v !== 'object') return 'bad';
  const o = v as { id?: unknown; q?: unknown };
  if (typeof o.id !== 'number' || !Number.isInteger(o.id) || o.id < 0 || o.id > MAX_ID) return 'bad';
  if (o.id === 0 || o.id === -1) return null;
  if (o.q != null && (typeof o.q !== 'number' || !Number.isInteger(o.q) || o.q < 1 || o.q > 2_147_483_647)) return 'bad';
  return { id: o.id, ...(typeof o.q === 'number' && o.q !== 1 ? { q: o.q } : {}) };
}

/** Parse an Inventory Setups export. */
export function parseInventorySetup(text: string): ImportResult {
  const raw = text.trim();
  if (raw.length > 50_000) return { ok: false, error: 'That is too long to be an Inventory Setup.' };
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Not an Inventory Setup: paste what the plugin’s Export setup copied.' };
  }
  const setup = (j as { setup?: unknown })?.setup as Record<string, unknown> | undefined;
  if (!setup || typeof setup !== 'object') return { ok: false, error: 'An Inventory Setup export has a "setup" object.' };
  const inv = Array.isArray(setup.inv) ? setup.inv : [];
  const eq = Array.isArray(setup.eq) ? setup.eq : [];
  if (inv.length > 28 || eq.length > 14) return { ok: false, error: 'Too many items for one setup.' };
  const inventory: (InvItem | null)[] = [];
  for (const v of inv) {
    const it = itemOf(v);
    if (it === 'bad') return { ok: false, error: 'An inventory item has a bad id or quantity.' };
    inventory.push(it);
  }
  const gear: Partial<Record<EquipSlot, number>> = {};
  for (const [slot, idx] of Object.entries(EQUIPMENT_INDEX) as [EquipSlot, number][]) {
    const it = itemOf(eq[idx]);
    if (it === 'bad') return { ok: false, error: 'A worn item has a bad id.' };
    if (it) gear[slot] = it.id;
  }
  const runePouch: InvItem[] = [];
  for (const v of Array.isArray(setup.rp) ? setup.rp.slice(0, 4) : []) {
    const it = itemOf(v);
    if (it === 'bad') return { ok: false, error: 'A rune pouch item has a bad id or quantity.' };
    if (it) runePouch.push(it);
  }
  const sb = typeof setup.sb === 'number' && Number.isInteger(setup.sb) && setup.sb >= 0 && setup.sb <= 4 ? setup.sb : 0;
  const name = cleanImportName(setup.name);
  // The layout the export carried, else the one ours would build.
  const layout = new Map<number, number>();
  const flat = (j as { layout?: unknown }).layout;
  if (Array.isArray(flat)) {
    if (flat.length > MAX_INDEX) return { ok: false, error: 'The layout is too long.' };
    flat.forEach((v, k) => {
      if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_ID) layout.set(k, v);
    });
  }
  const items = [...new Set([...Object.values(gear), ...inventory.filter(Boolean).map((x) => x!.id), ...runePouch.map((r) => r.id)])] as number[];
  if (!layout.size) items.forEach((id, k) => layout.set(k, id));
  return {
    ok: true,
    tag: { source: 'inventory-setup', name, icon: gear.weapon ?? items[0] ?? null, items, layout, gear, inventory, runePouch, ...(sb ? { spellbook: sb } : {}) },
  };
}

/** Either format, by its first character. */
export function parseRuneliteImport(text: string): ImportResult {
  const t = text.trim();
  return t.startsWith('{') ? parseInventorySetup(t) : parseBankTag(t);
}

/**
 * A bank tag as a setup: items whose equipment slot is known go to that slot (first one wins),
 * everything else fills the inventory in layout order (28 at most). `slotOf` comes from the gear data.
 */
export function tagToSetup(tag: ImportedTag, slotOf: (id: number) => EquipSlot | null): { gear: Partial<Record<EquipSlot, number>>; inventory: (InvItem | null)[]; runePouch: InvItem[]; spellbook?: number } {
  if (tag.gear) {
    return { gear: tag.gear, inventory: tag.inventory ?? [], runePouch: tag.runePouch ?? [], ...(tag.spellbook ? { spellbook: tag.spellbook } : {}) };
  }
  const gear: Partial<Record<EquipSlot, number>> = {};
  const inventory: (InvItem | null)[] = [];
  const ordered = [...tag.layout.entries()].sort((a, b) => a[0] - b[0]).map(([, id]) => id);
  for (const id of [...new Set([...ordered, ...tag.items])]) {
    const slot = slotOf(id);
    if (slot && gear[slot] == null) gear[slot] = id;
    else if (inventory.length < 28) inventory.push({ id });
  }
  return { gear, inventory, runePouch: [] };
}

/** Cells for the bank tab preview: rows of 8, null where the bank shows nothing. */
export function bankGrid(layout: Map<number, number>): (number | null)[][] {
  if (!layout.size) return [];
  const last = Math.max(...layout.keys());
  const rows: (number | null)[][] = [];
  for (let r = 0; r <= Math.floor(last / BANK_COLUMNS); r++) {
    rows.push(Array.from({ length: BANK_COLUMNS }, (_, c) => layout.get(r * BANK_COLUMNS + c) ?? null));
  }
  return rows;
}
