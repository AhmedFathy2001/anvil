// "Your gear now vs this setup": the gear a character is wearing (the plugin's equipment push) beside
// a guide setup, per target, and the one slot swap that closes the gap most. PURE — the gear index and
// the item equivalences come in, so the panel view and the tests share it.
//
// ONE DPS PATH. Every number is bestStyle over setupLoadout (lib/dps), and a slot swap is withSlot,
// the same step the Upgrades ladder (lib/guideView ladderFor) takes. "You" is the character: its own
// Attack, Strength, Ranged and Magic where known (hiscores / the plugin), the setup's for any unknown.
// Worn gear says nothing about spellbook, prayers or boosts, so those are the setup's, as the guide's
// own DPS has them. "Guide" stays on the setup's own levels.

import type { DpsResult, Monster } from './dps/engine';
import { bestStyle } from './dps/engine';
import { SLOTS } from './dps/tables';
import { setupLoadout, type GearIndex } from './dps/summary';
import { blockTargets, setupTargets, type GearBlock, type GearSetup, type InvItem } from './guideTiers';
import type { Equivalents } from './gearOwnership';

/** The setup with `slot` holding `id`; a two-handed weapon takes the shield off. The ladder's step. */
export function withSlot(s: GearSetup, slot: string, id: number, idx: Pick<GearIndex, 'item'>): GearSetup {
  const gear = { ...s.gear, [slot]: id };
  if (slot === 'weapon' && idx.item(id)?.h2) delete gear.shield;
  return { ...s, gear };
}

/** A setup's best style against one monster. */
export const setupResult = (s: GearSetup, m: Monster, idx: GearIndex): DpsResult | null => bestStyle(setupLoadout(s), m, idx.item, idx.rules)?.result ?? null;

/** The worn item `it` as the gear data knows it: itself, or an equivalent it holds (a charged form, a kit). */
const knownAs = (id: number, idx: Pick<GearIndex, 'item'>, eq?: Equivalents): number | undefined => (idx.item(id) ? id : (eq?.(id) ?? []).find((x) => idx.item(x)));

/**
 * Worn items to their slots by the gear data's own slot ('2h' is worn in the weapon slot). An id the
 * gear data doesn't hold (a charged form, a kit) takes an equivalent it does, through `eq`.
 */
export function wornGear(items: readonly InvItem[], idx: Pick<GearIndex, 'item'>, eq?: Equivalents): Record<string, number> {
  const gear: Record<string, number> = {};
  for (const it of items) {
    const known = knownAs(it.id, idx, eq);
    const slot = known ? idx.item(known)?.s : null;
    const key = slot === '2h' ? 'weapon' : slot;
    if (known && key && (SLOTS as readonly string[]).includes(key) && gear[key] == null) gear[key] = known;
  }
  return gear;
}

/**
 * The worn ids the gear data can't place (no entry, no equivalent with one): their slot and stats are
 * unknown, so the card names them instead of reading their slot as empty.
 */
export const unreadWorn = (items: readonly InvItem[], idx: Pick<GearIndex, 'item'>, eq?: Equivalents): number[] => items.map((it) => it.id).filter((id) => !knownAs(id, idx, eq));

export interface GearNowRow {
  monster: Monster;
  you: number;
  guide: number;
  /** Seconds per kill (null: can't be killed). */
  youTtk: number | null;
  guideTtk: number | null;
  /** The whole best-style results, for max hit, accuracy and attack speed (null: no attack). */
  mine: DpsResult | null;
  theirs: DpsResult | null;
}

/** One slot, the worn item against the guide's, everything else as worn. */
export interface GearNowSlot {
  slot: string;
  worn: number | null;
  guide: number | null;
  /**
   * How much the worn item is worth over the guide's, as % of the DPS with the guide's there (mean over
   * the targets): +4 the worn one is 4% better, -12 worse. Null: the same item, or a form of it.
   */
  pct: number | null;
}

export interface GearNow {
  /** One per target the setup is for, in the block's order. */
  rows: GearNowRow[];
  /** Every slot either side fills, in the equipment screen's order. */
  slots: GearNowSlot[];
  /** The guide's item for one slot that raises the worn DPS most (mean over the targets), or null. */
  gap: { slot: string; guide: number; worn: number | null; gainPct: number } | null;
  /** "You" used at least one of the character's own levels. */
  ownLevels: boolean;
}

/** The combat levels "You" takes from the character (Hitpoints stays the setup's: only Dharok's trick reads it). */
const OWN_STATS = ['attack', 'strength', 'ranged', 'magic'] as const;

/** The setup's stats with the character's own levels in place where they are known. */
export function ownStats(stats: GearSetup['stats'], levels: Record<string, number> | null | undefined): { stats: GearSetup['stats']; own: boolean } {
  const out = { ...stats };
  let own = false;
  for (const k of OWN_STATS) {
    const v = levels?.[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) {
      out[k] = v;
      own = true;
    }
  }
  return { stats: out, own };
}

const ttkOf = (r: DpsResult | null) => (r && Number.isFinite(r.ttk) ? r.ttk : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** The setup with `slot` emptied. */
const withoutSlot = (s: GearSetup, slot: string): GearSetup => {
  const gear = { ...s.gear };
  delete gear[slot];
  return { ...s, gear };
};

/**
 * The worn gear against the setup over the setup's targets. Null when there is nothing to compare:
 * no worn items, or no target the gear data knows.
 */
export function gearNow(setup: GearSetup, block: GearBlock, worn: Record<string, number>, idx: GearIndex, eq?: Equivalents, levels?: Record<string, number> | null): GearNow | null {
  if (!Object.keys(worn).length) return null;
  const monsters = setupTargets(setup, block)
    .map((k) => idx.monster(k))
    .filter((m): m is Monster => !!m);
  if (!monsters.length) return null;
  const me = ownStats(setup.stats, levels);
  const mine: GearSetup = { ...setup, gear: worn, quiver: null, stats: me.stats };
  const rows = monsters.map((m) => {
    const y = setupResult(mine, m, idx);
    const g = setupResult(setup, m, idx);
    return { monster: m, you: y?.dps ?? 0, guide: g?.dps ?? 0, youTtk: ttkOf(y), guideTtk: ttkOf(g), mine: y, theirs: g };
  });
  const base = mean(rows.map((r) => r.you));
  // Each slot in turn: the worn gear with the guide's item there (or nothing, where the guide wears
  // nothing). The same swap gives the slot's sign and the biggest gap.
  const slots: GearNowSlot[] = [];
  let gap: GearNow['gap'] = null;
  let best = 1e-9;
  for (const slot of SLOTS) {
    const want = setup.gear[slot] ?? null;
    const have = worn[slot] ?? null;
    if (want == null && have == null) continue;
    // Already wearing it (or a form of it): nothing to swap.
    if (have != null && want != null && (have === want || (eq?.(have) ?? []).includes(want))) {
      slots.push({ slot, worn: have, guide: want, pct: null });
      continue;
    }
    // A shield can't go on beside a two-handed weapon: that is two swaps, not one.
    if (slot === 'shield' && want != null && idx.item(worn.weapon)?.h2) continue;
    const swapped = want != null ? withSlot(mine, slot, want, idx) : withoutSlot(mine, slot);
    const theirs = mean(monsters.map((m) => setupResult(swapped, m, idx)?.dps ?? 0));
    slots.push({ slot, worn: have, guide: want, pct: theirs > 0 ? round1(((base - theirs) / theirs) * 100) : base > 0 ? 100 : 0 });
    if (want != null && theirs - base > best) {
      best = theirs - base;
      gap = { slot, guide: want, worn: have, gainPct: base > 0 ? round1(((theirs - base) / base) * 100) : 0 };
    }
  }
  return { rows, slots, gap, ownLevels: me.own };
}

/**
 * The block's targets `current` isn't for, each with the setup that is (or null): the Barrows magic
 * setup is for five brothers, and Ahrim has a blowpipe setup of his own. Names without a "#version".
 */
export function otherTargets(current: { key: string; setup: GearSetup }, setups: readonly { key: string; setup: GearSetup }[], block: GearBlock): { name: string; setup: string | null; setupName: string | null }[] {
  const mine = setupTargets(current.setup, block);
  return blockTargets(block)
    .filter((t) => !mine.includes(t))
    .map((t) => {
      const o = setups.find((x) => x.key !== current.key && setupTargets(x.setup, block).includes(t));
      return { name: t.split('#')[0], setup: o?.key ?? null, setupName: o?.setup.name ?? null };
    });
}
