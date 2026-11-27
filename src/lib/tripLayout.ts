// The pre-trip check drawn as the game lays a setup out (pluginUi/tripUi): the worn slots as the
// equipment screen, the 28 inventory slots, the rune pouch and the quiver. PURE.
//
// Each item says where the player has it: 'here' (worn or packed), 'bank' (owned, in the bank: take
// it) or 'none' (not owned). The inventory is the game's: 28 Manta rays are 28 slots, four
// Divine ranging(4) are four; only stackables (runes, ammo, coins, teleport tabs) are one slot with a
// count. The setup's own slot order is kept (own and guide setups); the calc's has none, so it is
// laid out switches first, then the spec, potions, food, anything else, teleports last.

import type { GearSetup, InvItem } from './guideTiers';
import { supplyKind, type TripRow } from './tripCheck';
import type { TripState } from './tripState';

export type Have = 'here' | 'bank' | 'none';

export interface LayoutItem {
  id: number;
  /** A stack's count (stackables only). */
  q?: number;
  have: Have;
}

export interface TripLayout {
  /** Slot → the setup's item there. */
  worn: Record<string, LayoutItem>;
  /** The 28 slots, null empty. */
  inventory: (LayoutItem | null)[];
  pouch: LayoutItem[];
  quiver: LayoutItem | null;
  /** Distinct items to take from the bank / not owned at all. */
  inBank: number;
  notOwned: number;
}

export interface LayoutInput {
  /** The own or guide setup; null for the calc (its rows say what it picked). */
  setup: GearSetup | null;
  rows: readonly TripRow[];
  worn: readonly InvItem[];
  inventory: readonly InvItem[];
  bank: readonly InvItem[];
  lootingBag?: readonly InvItem[];
  state: TripState | null;
  /** Worn or packed (its forms and upgrades count). */
  carries: (id: number) => boolean;
  /** Worn, packed or banked. */
  owns: (id: number) => boolean;
  /** The equipment slot an item is worn in, null when it is no gear. */
  slotOf: (id: number) => string | null;
  nameOf: (id: number) => string;
  isRunePouch: (id: number) => boolean;
  isSpec: (id: number) => boolean;
}

const RUNE_RE = /\brunes?$/i;
const STACK_RE = /\b(rune|arrows?|bolts?|bolt racks?|darts?|javelins?|knives|knife|thrownaxe|chinchompa|coins|tablet|teleport|scroll|seeds?|tokkul|platinum token)s?\b|\((e|p\+\+|p\+|p)\)$|^(dragon|rune|amethyst|adamant|mithril|steel|iron|bronze) (arrows?|darts?|javelins?|bolts?)/i;
const TELEPORT_RE = /teleport|tablet|tab$|\bring of dueling|games necklace|glory|ectophial|xeric|drakan|royal seed pod|crystal seed|book of the dead|ring of shadows|ring of wealth/i;
const POTION_RE = /\(\d\)$/;
const FOOD_RE = /^(shark|manta ray|anglerfish|dark crab|monkfish|cooked karambwan|sea turtle|tuna potato|lobster|swordfish|cooked moonlight antelope|cooked sunlight antelope|.* pie|.*pizza|.*cake)$/i;

/** One slot with a count in the game's inventory: runes, ammo, coins, tablets. */
export function isStackable(name: string): boolean {
  return RUNE_RE.test(name) || STACK_RE.test(name);
}

/**
 * The laid-out setup. Counts for supplies are by kind (any dose of a potion, lib/tripCheck
 * supplyKind): with 20 of 28 mantas packed, 20 slots are 'here' and 8 'bank' (or 'none').
 */
export function tripLayout(inp: LayoutInput): TripLayout {
  const name = inp.nameOf;
  const owned = (list: readonly (readonly InvItem[] | undefined)[]) => {
    const m = new Map<string, number>();
    for (const l of list) for (const it of l ?? []) if (it && it.id > 0) m.set(supplyKind(name(it.id)), (m.get(supplyKind(name(it.id))) ?? 0) + Math.max(1, it.q ?? 1));
    return m;
  };
  const packedKinds = owned([inp.inventory]);
  const bankKinds = owned([inp.bank, inp.lootingBag]);
  const gearHave = (id: number): Have => (inp.carries(id) ? 'here' : inp.owns(id) ? 'bank' : 'none');

  // ── Worn ──
  const worn: Record<string, LayoutItem> = {};
  const rowFor = (slot: string) => inp.rows.find((r) => r.group === 'gear' && r.slot === slot && r.item != null);
  if (inp.setup) {
    for (const [slot, id] of Object.entries(inp.setup.gear)) {
      if (typeof id !== 'number' || slot === 'quiver') continue;
      // The player's own version of the slot (a check row names it), else the setup's.
      const use = rowFor(slot)?.item ?? id;
      worn[slot] = { id: use, have: gearHave(use) };
    }
  } else {
    // The calc's rows: a worn piece names its slot; a loadout's swaps go where they are worn; a row
    // about one item without a slot is worn when it is worn now, else it is a switch (inventory).
    const wear = (id: number, slot: string | null) => {
      if (slot && !worn[slot]) worn[slot] = { id, have: gearHave(id) };
    };
    for (const r of inp.rows) if (r.group === 'gear' && r.item != null && r.slot) wear(r.item, r.slot);
    for (const r of inp.rows) if (r.group === 'gear' && r.swaps) for (const id of [...(r.item != null ? [r.item] : []), ...r.swaps]) wear(id, inp.slotOf(id));
    for (const r of inp.rows) if (r.group === 'gear' && r.item != null && !r.slot && !r.swaps && inp.worn.some((w) => w.id === r.item)) wear(r.item, inp.slotOf(r.item));
    // No row laid a worn kit out ("Your setup covers all 5 bosses", "Kephri: Fang"): what is worn
    // now is the setup, so the doll shows it (and a worn piece is never drawn as a switch).
    if (!inp.rows.some((r) => r.group === 'gear' && r.slot)) for (const w of inp.worn) wear(w.id, inp.slotOf(w.id));
  }
  const wornIds = new Set(Object.values(worn).map((w) => w.id));

  // ── Inventory ──
  const cells: (LayoutItem | null)[] = [];
  const left = new Map(packedKinds);
  const supply = (id: number): LayoutItem => {
    const k = supplyKind(name(id));
    const n = left.get(k) ?? 0;
    if (n > 0) {
      left.set(k, n - 1);
      return { id, have: 'here' };
    }
    return { id, have: (bankKinds.get(k) ?? 0) > 0 ? 'bank' : 'none' };
  };
  const stack = (it: InvItem): LayoutItem => ({ id: it.id, ...(it.q && it.q > 1 ? { q: it.q } : {}), have: inp.carries(it.id) ? 'here' : inp.owns(it.id) ? 'bank' : 'none' });
  const put = (it: InvItem | null) => {
    if (!it) return void cells.push(null);
    if (inp.slotOf(it.id) && !isStackable(name(it.id))) return void cells.push({ id: it.id, have: gearHave(it.id) });
    if (isStackable(name(it.id)) || inp.isRunePouch(it.id)) return void cells.push(stack(it));
    for (let i = 0; i < Math.max(1, Math.floor(it.q ?? 1)); i++) cells.push(supply(it.id));
  };
  if (inp.setup?.inventory?.length) {
    for (const it of inp.setup.inventory) put(it);
  } else {
    // The calc: its switches and spec from the rows, then what is packed besides, in a sensible order.
    const picked: number[] = [];
    for (const r of inp.rows) {
      if (r.item == null || (r.group !== 'gear' && r.group !== 'spec')) continue;
      for (const id of [r.item, ...(r.swaps ?? [])]) if (!wornIds.has(id) && !picked.includes(id)) picked.push(id);
    }
    const rank = (id: number) => {
      const n = name(id);
      return inp.isSpec(id) ? 1 : inp.slotOf(id) && !isStackable(n) ? 0 : POTION_RE.test(n) ? 2 : FOOD_RE.test(n) ? 3 : TELEPORT_RE.test(n) ? 5 : 4;
    };
    // The calc's supplies (rows with a count): packed as many as it says; what is packed besides of
    // the same kind is them, not extra.
    const supplies: InvItem[] = inp.rows.filter((r) => (r.group === 'supplies' || (r.group === 'pouch' && !r.inPouch)) && r.item != null && r.need).map((r) => ({ id: r.item!, q: r.need }));
    const supplyKinds = new Set(supplies.map((it) => supplyKind(name(it.id))));
    const rest = inp.inventory.filter((it) => !picked.includes(it.id) && !wornIds.has(it.id) && !(supplyKinds.has(supplyKind(name(it.id))) && !inp.slotOf(it.id)));
    const all: InvItem[] = [...picked.map((id) => ({ id })), ...supplies, ...rest];
    all.sort((a, b) => rank(a.id) - rank(b.id));
    for (const it of all) put(it);
  }
  const inventory = Array.from({ length: 28 }, (_, i) => cells[i] ?? null);

  // ── Rune pouch and quiver ──
  const pouchPacked = inp.inventory.some((it) => inp.isRunePouch(it.id));
  const inPouch = new Map((pouchPacked ? inp.state?.pouch ?? [] : []).map((p) => [p.id, p.q]));
  // The calc's pouch: the runes its rows put there.
  const calcPouch = inp.setup ? null : inp.rows.filter((r) => r.group === 'pouch' && r.inPouch && r.item != null).map((r) => ({ id: r.item!, q: r.need }));
  const pouch = (calcPouch ?? inp.setup?.runePouch ?? []).map((p): LayoutItem => ({ id: p.id, ...(p.q && p.q > 1 ? { q: p.q } : {}), have: (inPouch.get(p.id) ?? 0) >= Math.max(1, calcPouch ? p.q ?? 1 : Math.min(p.q ?? 1, 100)) || (!calcPouch && inp.carries(p.id)) ? 'here' : inp.owns(p.id) ? 'bank' : 'none' }));
  const qid = inp.setup?.quiver ?? inp.setup?.gear.quiver ?? null;
  const qv = inp.state?.quiver;
  const quiver: LayoutItem | null = qid ? { id: qid, ...(qv && qv.id === qid ? { q: qv.q } : {}), have: qv && qv.id === qid ? 'here' : inp.owns(qid) ? 'bank' : 'none' } : null;

  const all = [...Object.values(worn), ...inventory.filter((x): x is LayoutItem => !!x), ...pouch, ...(quiver ? [quiver] : [])];
  const distinct = (h: Have) => new Set(all.filter((x) => x.have === h).map((x) => x.id)).size;
  return { worn, inventory, pouch, quiver, inBank: distinct('bank'), notOwned: distinct('none') };
}
