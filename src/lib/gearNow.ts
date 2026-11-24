// "Your gear now vs this setup": the gear a character is wearing (the plugin's equipment push) beside
// a guide setup, per target, and the one slot swap that closes the gap most. PURE — the gear index and
// the item equivalences come in, so the panel view and the tests share it.
//
// ONE DPS PATH. Every number is bestStyle over setupLoadout (lib/dps), and a slot swap is withSlot,
// the same step the Upgrades ladder (lib/guideView ladderFor) takes. Worn gear says nothing about
// spellbook, prayers, boosts or levels, so the worn loadout borrows the setup's, as the guide's own
// DPS does: the comparison is the gear and nothing else.

import type { DpsResult, Monster } from './dps/engine';
import { bestStyle } from './dps/engine';
import { SLOTS } from './dps/tables';
import { setupLoadout, type GearIndex } from './dps/summary';
import { setupTargets, type GearBlock, type GearSetup, type InvItem } from './guideTiers';
import type { Equivalents } from './gearOwnership';

/** The setup with `slot` holding `id`; a two-handed weapon takes the shield off. The ladder's step. */
export function withSlot(s: GearSetup, slot: string, id: number, idx: Pick<GearIndex, 'item'>): GearSetup {
  const gear = { ...s.gear, [slot]: id };
  if (slot === 'weapon' && idx.item(id)?.h2) delete gear.shield;
  return { ...s, gear };
}

/** A setup's best style against one monster. */
export const setupResult = (s: GearSetup, m: Monster, idx: GearIndex): DpsResult | null => bestStyle(setupLoadout(s), m, idx.item, idx.rules)?.result ?? null;

/**
 * Worn items to their slots by the gear data's own slot ('2h' is worn in the weapon slot). An id the
 * gear data doesn't hold (a charged form, a kit) takes an equivalent it does, through `eq`.
 */
export function wornGear(items: readonly InvItem[], idx: Pick<GearIndex, 'item'>, eq?: Equivalents): Record<string, number> {
  const gear: Record<string, number> = {};
  for (const it of items) {
    const known = idx.item(it.id) ? it.id : (eq?.(it.id) ?? []).find((x) => idx.item(x));
    const slot = known ? idx.item(known)?.s : null;
    const key = slot === '2h' ? 'weapon' : slot;
    if (known && key && (SLOTS as readonly string[]).includes(key) && gear[key] == null) gear[key] = known;
  }
  return gear;
}

export interface GearNowRow {
  monster: Monster;
  you: number;
  guide: number;
  /** Seconds per kill (null: can't be killed). */
  youTtk: number | null;
  guideTtk: number | null;
}

export interface GearNow {
  /** One per target the setup is for, in the block's order. */
  rows: GearNowRow[];
  /** The guide's item for one slot that raises the worn DPS most (mean over the targets), or null. */
  gap: { slot: string; guide: number; worn: number | null; gainPct: number } | null;
}

const ttkOf = (r: DpsResult | null) => (r && Number.isFinite(r.ttk) ? r.ttk : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);

/**
 * The worn gear against the setup over the setup's targets. Null when there is nothing to compare:
 * no worn items, or no target the gear data knows.
 */
export function gearNow(setup: GearSetup, block: GearBlock, worn: Record<string, number>, idx: GearIndex, eq?: Equivalents): GearNow | null {
  if (!Object.keys(worn).length) return null;
  const monsters = setupTargets(setup, block)
    .map((k) => idx.monster(k))
    .filter((m): m is Monster => !!m);
  if (!monsters.length) return null;
  const mine: GearSetup = { ...setup, gear: worn, quiver: null };
  const rows = monsters.map((m) => {
    const y = setupResult(mine, m, idx);
    const g = setupResult(setup, m, idx);
    return { monster: m, you: y?.dps ?? 0, guide: g?.dps ?? 0, youTtk: ttkOf(y), guideTtk: ttkOf(g) };
  });
  const base = mean(rows.map((r) => r.you));
  let gap: GearNow['gap'] = null;
  let best = 1e-9;
  for (const slot of SLOTS) {
    const want = setup.gear[slot];
    if (!want) continue;
    const have = worn[slot] ?? null;
    // Already wearing it (or a form of it): nothing to swap.
    if (have != null && (have === want || (eq?.(have) ?? []).includes(want))) continue;
    // A shield can't go on beside a two-handed weapon: that is two swaps, not one.
    if (slot === 'shield' && idx.item(worn.weapon)?.h2) continue;
    const swapped = withSlot(mine, slot, want, idx);
    const gain = mean(monsters.map((m) => setupResult(swapped, m, idx)?.dps ?? 0)) - base;
    if (gain > best) {
      best = gain;
      gap = { slot, guide: want, worn: have, gainPct: base > 0 ? Math.round((gain / base) * 1000) / 10 : 0 };
    }
  }
  return { rows, gap };
}
