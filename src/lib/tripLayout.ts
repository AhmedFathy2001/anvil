// The pre-trip check drawn as the game lays a setup out (pluginUi/tripUi): the worn slots as the
// equipment screen, the 28 inventory slots, the rune pouch and the quiver. PURE.
//
// Each item says where the player has it: 'here' (worn or packed), 'bank' (owned, in the bank: take
// it) or 'none' (not owned). The inventory is the game's: 28 Manta rays are 28 slots, four
// Divine ranging(4) are four; only stackables (runes, ammo, coins, teleport tabs) are one slot with a
// count. The setup's own slot order is kept (own and guide setups); the calc's has none, so it is
// laid out switches first, then the spec, potions, food, anything else, teleports last.

import type { GearSetup, InvItem } from './guideTiers';
import { bankLayout, heldOne, supplyKind, type BankLayout, type TripRow } from './tripCheck';
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
  /** The quiver slot holds the quiver's own ammo (state.quiver): it comes with the quiver. */
  quiverRides?: boolean;
  /** Supplies a failing row wants packed that no slot shows (Doom's food and prayer restore). */
  extra: LayoutItem[];
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
  /**
   * The ammo in the player's Dizana's quiver (state.quiver), when they own a quiver: `have` is where
   * the quiver is ('here' worn or carried, 'bank'). It fires as the ammo slot would, so a setup's ammo
   * it serves (`serves`: the same arrows, or ones the launcher fires) is held with the quiver.
   */
  quiverAmmo?: { id: number; q: number; have: Have; serves: (want: number, weapon: number | null) => boolean; isQuiver: (id: number) => boolean } | null;
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
  // The quiver's ammo: what the quiver holds is the player's wherever the quiver is, and along with it.
  const qa = inp.quiverAmmo ?? null;
  const weapon = worn.weapon?.id ?? null;
  const fromQuiver = (): LayoutItem => ({ id: qa!.id, q: qa!.q, have: qa!.have });
  const qid = inp.setup?.quiver ?? inp.setup?.gear.quiver ?? null;
  let quiver: LayoutItem | null = null;
  let quiverRides = false;
  if (qid) {
    if (qa && qa.serves(qid, weapon)) [quiver, quiverRides] = [fromQuiver(), true];
    else quiver = { id: qid, have: inp.owns(qid) ? 'bank' : 'none' };
  }
  // The ammo slot's arrows in the quiver (not in the ammo slot): drawn in the quiver, held with it.
  const am = worn.ammo;
  if (am && am.have !== 'here' && qa && qa.serves(am.id, weapon)) {
    delete worn.ammo;
    if (!quiver || !quiverRides) [quiver, quiverRides] = [fromQuiver(), true];
  }
  // A quiver on the doll shows what it holds.
  if (!quiver && qa && worn.cape && qa.isQuiver(worn.cape.id)) [quiver, quiverRides] = [fromQuiver(), true];

  // A failing supply row with no slot here ("No food packed"): its one stack, to take.
  const laidKinds = new Set(inventory.filter((x): x is LayoutItem => !!x).map((x) => supplyKind(name(x.id))));
  const extra: LayoutItem[] = [];
  for (const r of inp.rows) {
    if (r.group !== 'supplies' || r.ok || r.need || r.item == null || laidKinds.has(supplyKind(name(r.item)))) continue;
    laidKinds.add(supplyKind(name(r.item)));
    extra.push({ id: r.item, have: inp.owns(r.item) ? 'bank' : 'none' });
  }

  const all = [...Object.values(worn), ...inventory.filter((x): x is LayoutItem => !!x), ...pouch, ...extra, ...(quiver && !quiverRides ? [quiver] : [])];
  const distinct = (h: Have) => new Set(all.filter((x) => x.have === h).map((x) => x.id)).size;
  // Arrows riding in a banked quiver are taken with it: one more only when no quiver is laid out.
  const quiverToTake = quiverRides && quiver?.have === 'bank' && !all.some((x) => x.have === 'bank' && qa!.isQuiver(x.id)) ? 1 : 0;
  return { worn, inventory, pouch, quiver, ...(quiverRides ? { quiverRides } : {}), extra, inBank: distinct('bank') + quiverToTake, notOwned: distinct('none') };
}

/** What the bank filter needs to find the bank's own ids for a layout's items. */
export interface LayoutBankInput {
  bank: readonly InvItem[];
  /** A held id → the ids it counts as (lib/itemFamilies 'holds'). */
  holds: (id: number) => number[];
  /** X → the ids that count as having X (lib/itemFamilies 'needs'). */
  needs: (id: number) => number[];
  nameOf: (id: number) => string;
  isRunePouch: (id: number) => boolean;
  isSpec: (id: number) => boolean;
  slotOf: (id: number) => string | null;
  /** Dizana's quiver (or the max cape holding one). */
  isQuiver: (id: number) => boolean;
}

/**
 * The card's two bank filters off the SAME layout the card draws and counts, so "Show the N in my
 * bank" shows those N: `missing` what the layout marks to take, `setup` the whole layout. Each item
 * is one bank slot: a piece of gear its held form, a supply ONE stack of its kind (the setup's own
 * item when the bank holds it, else the kind's highest dose), never every dose or every food.
 */
export function layoutBanks(l: TripLayout, o: LayoutBankInput): { missing: BankLayout; setup: BankLayout; bank: number[] } {
  const bankIds = [...new Set(o.bank.map((it) => it.id))];
  const dose = (n: string) => Number(/\((\d)\)\s*$/.exec(n)?.[1] ?? 0);
  const gearBank = (id: number) => heldOne({ item: id, bank: bankIds.filter((b) => b === id || o.needs(id).includes(b) || o.holds(b).includes(id)) }, o.nameOf);
  const supplyBank = (id: number) => {
    if (bankIds.includes(id)) return id;
    const k = supplyKind(o.nameOf(id));
    return bankIds.filter((b) => supplyKind(o.nameOf(b)) === k).sort((a, b) => dose(o.nameOf(b)) - dose(o.nameOf(a)))[0] ?? null;
  };
  const isGear = (id: number) => !!o.slotOf(id) && !isStackable(o.nameOf(id));
  type Entry = { row: TripRow; have: Have };
  const entries: Entry[] = [];
  const add = (it: LayoutItem, group: TripRow['group'], slot?: string) => {
    const b = group === 'supplies' ? supplyBank(it.id) : isGear(it.id) || slot ? gearBank(it.id) : bankIds.includes(it.id) ? it.id : null;
    entries.push({ have: it.have, row: { group, ok: it.have === 'here', line: '', item: b ?? it.id, bank: [b ?? it.id], ...(slot ? { slot } : {}) } });
  };
  for (const [slot, it] of Object.entries(l.worn)) add(it, 'gear', slot);
  if (l.quiver) {
    if (!l.quiverRides) add(l.quiver, 'gear', 'quiver');
    else if (l.quiver.have === 'bank' && !Object.values(l.worn).some((w) => o.isQuiver(w.id))) {
      // The arrows ride in a banked quiver: the quiver is what to take.
      const q = bankIds.find(o.isQuiver);
      if (q != null) entries.push({ have: 'bank', row: { group: 'gear', ok: false, line: '', item: q, bank: [q] } });
    }
  }
  // One bank slot per distinct item, and per supply kind (its packed and banked slots are one stack):
  // to take when any of its slots is in the bank.
  const rank: Record<Have, number> = { here: 0, none: 1, bank: 2 };
  const byKey = new Map<string, { it: LayoutItem; group: TripRow['group'] }>();
  for (const it of [...l.inventory.filter((x): x is LayoutItem => !!x), ...l.pouch, ...l.extra]) {
    const n = o.nameOf(it.id);
    const group: TripRow['group'] = isGear(it.id) ? (o.isSpec(it.id) ? 'spec' : 'gear') : isStackable(n) || o.isRunePouch(it.id) ? 'pouch' : 'supplies';
    const key = group === 'supplies' ? `kind:${supplyKind(n)}` : `id:${it.id}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { it, group });
    else if (rank[it.have] > rank[prev.it.have]) prev.it = { ...prev.it, have: it.have };
  }
  for (const { it, group } of byKey.values()) add(it, group);
  const missing = entries.filter((e) => e.have === 'bank').map((e) => e.row);
  return { missing: bankLayout(missing, o.nameOf), setup: bankLayout(entries.map((e) => e.row), o.nameOf), bank: [...new Set(missing.map((r) => r.item!))] };
}
