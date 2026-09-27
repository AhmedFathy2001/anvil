// Setups as RuneLite imports: a Bank Tags tab and an Inventory Setups plugin setup. PURE.
//
// Both formats are the plugins' own, read from their source rather than guessed:
//   Bank Tags (runelite-client …/banktags/tabs/TabInterface importTag):
//     banktags,1,<name>,<iconItemId>,<itemId>…[,layout,<bankIdx>,<itemId>,…]   (CSV)
//     A name may not contain  < / > :  and, being CSV, we keep commas out too.
//   Inventory Setups (dillydill123/inventory-setups InventorySetupPortable, via RuneLite's Gson):
//     { "setup": { inv[28], eq[14], rp?, name, hc:"#AARRGGBB", sb?, notes? }, "layout": int[] }
//     items are { id, q? } (q absent = 1), empty slots null; eq is indexed by EquipmentInventorySlot.
//
// The bank layout is the same for both: equipment on the left in its in-game shape, the inventory as
// its 4×7 grid on the right, and the rune pouch's runes under the equipment. The bank is 8 wide.

import type { InvItem } from './guideTiers';

export type EquipSlot = 'head' | 'cape' | 'neck' | 'ammo' | 'weapon' | 'body' | 'shield' | 'legs' | 'hands' | 'feet' | 'ring';

/** RuneLite's EquipmentInventorySlot indices. 6 (arms), 8 (hair) and 11 (jaw) are never worn items. */
export const EQUIPMENT_INDEX: Record<EquipSlot, number> = {
  head: 0, cape: 1, neck: 2, weapon: 3, body: 4, shield: 5, legs: 7, hands: 9, feet: 10, ring: 12, ammo: 13,
};

export interface ExportSetup {
  name: string;
  gear: Partial<Record<EquipSlot, number>>;
  inventory?: (InvItem | null)[];
  runePouch?: InvItem[];
  spellbook?: number;
  notes?: string;
}

const BANK_WIDTH = 8;
// Equipment in its in-game arrangement, in bank cells (row, col).
const GEAR_CELLS: Record<EquipSlot, [number, number]> = {
  head: [0, 1], cape: [1, 0], neck: [1, 1], ammo: [1, 2], weapon: [2, 0], body: [2, 1], shield: [2, 2],
  legs: [3, 1], hands: [4, 0], feet: [4, 1], ring: [4, 2],
};

/** Bank position → item id: equipment left (cols 0–2), inventory right (cols 4–7), runes below. */
export function bankLayout(s: ExportSetup): Map<number, number> {
  const at = new Map<number, number>();
  const put = (row: number, col: number, id: number | null | undefined) => {
    if (id != null && id > 0) at.set(row * BANK_WIDTH + col, id);
  };
  for (const [slot, [r, c]] of Object.entries(GEAR_CELLS) as [EquipSlot, [number, number]][]) put(r, c, s.gear[slot]);
  (s.inventory ?? []).slice(0, 28).forEach((it, i) => put(Math.floor(i / 4), 4 + (i % 4), it?.id));
  (s.runePouch ?? []).slice(0, 4).forEach((it, i) => put(6, i, it?.id));
  return at;
}

export function cleanTagName(name: string): string {
  return name.replace(/[<>/:,]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Anvil setup';
}

/** The Bank Tags import string (paste in the bank: right-click the new-tab button → Import). */
export function bankTagString(s: ExportSetup): string {
  const layout = bankLayout(s);
  const icon = s.gear.weapon ?? [...layout.values()][0] ?? 995; // 995 = coins, a harmless fallback
  const parts: (string | number)[] = ['banktags', 1, cleanTagName(s.name), icon, 'layout'];
  for (const [idx, id] of [...layout.entries()].sort((a, b) => a[0] - b[0])) parts.push(idx, id);
  return parts.join(',');
}

const item = (it: InvItem | null | undefined) => (it && it.id > 0 ? { id: it.id, ...(it.q && it.q !== 1 ? { q: it.q } : {}) } : null);

/** The Inventory Setups plugin's import JSON (the plugin panel → Import setup). */
export function inventorySetupJson(s: ExportSetup): string {
  const eq: ({ id: number } | null)[] = Array.from({ length: 14 }, () => null);
  for (const [slot, idx] of Object.entries(EQUIPMENT_INDEX) as [EquipSlot, number][]) {
    const id = s.gear[slot];
    if (id != null && id > 0) eq[idx] = { id };
  }
  const inv = Array.from({ length: 28 }, (_, i) => item(s.inventory?.[i]));
  const layout = bankLayout(s);
  const size = layout.size ? Math.max(...layout.keys()) + 1 : 0;
  const flat = Array.from({ length: size }, (_, i) => layout.get(i) ?? -1);
  const setup: Record<string, unknown> = {
    inv,
    eq,
    ...(s.runePouch?.length ? { rp: s.runePouch.slice(0, 4).map(item) } : {}),
    name: cleanTagName(s.name),
    ...(s.notes ? { notes: s.notes.slice(0, 500) } : {}),
    hc: '#FFFF0000',
    ...(s.spellbook ? { sb: s.spellbook } : {}),
  };
  return JSON.stringify({ setup, layout: flat });
}
