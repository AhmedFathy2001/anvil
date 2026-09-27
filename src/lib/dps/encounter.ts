// Fights with more than one target — the six Barrows brothers, a raid's bosses. PURE.
//
// One number still has to come out, so the measure is the whole run: every target killed once,
// each with the best setup a tier (or a player) has for it. Its DPS is total HP over total time,
// which weights a 750 HP boss properly against a 100 HP brother rather than averaging them.

import { bestStyle, type DpsResult, type ItemLookup, type Loadout, type Monster } from './engine';
import type { EffectRule } from './effects';

export interface TargetResult {
  monster: Monster;
  /** The setup index used against it (within the list given), and its numbers. Null = nothing applies. */
  setup: number | null;
  result: DpsResult | null;
}

export interface EncounterResult {
  targets: TargetResult[];
  /** Seconds to kill every target once. Infinity when one of them can't be killed. */
  time: number;
  /** Total HP / total time. */
  dps: number;
}

/**
 * The run for a set of loadouts, each usable against the targets it lists (by index into
 * `monsters`; undefined = all). Every target takes the fastest loadout allowed against it.
 */
export function encounter(
  loadouts: { loadout: Loadout; targets?: number[] }[],
  monsters: Monster[],
  items: ItemLookup,
  rules: EffectRule[] = [],
): EncounterResult {
  const targets = monsters.map<TargetResult>((monster, t) => {
    let best: TargetResult = { monster, setup: null, result: null };
    loadouts.forEach((l, i) => {
      if (l.targets && !l.targets.includes(t)) return;
      const r = bestStyle(l.loadout, monster, items, rules)?.result ?? null;
      if (r && (!best.result || r.dps > best.result.dps)) best = { monster, setup: i, result: r };
    });
    return best;
  });
  const time = targets.reduce((a, t) => a + (t.result && t.result.dps > 0 ? t.monster.hp / t.result.dps : Infinity), 0);
  const hp = monsters.reduce((a, m) => a + m.hp, 0);
  return { targets, time, dps: Number.isFinite(time) && time > 0 ? hp / time : 0 };
}

/** One loadout against every target — a player's own setup over the whole run. */
export function encounterDps(loadout: Loadout, monsters: Monster[], items: ItemLookup, rules: EffectRule[] = []): number {
  if (monsters.length === 1) return bestStyle(loadout, monsters[0], items, rules)?.result.dps ?? 0;
  return encounter([{ loadout }], monsters, items, rules).dps;
}
