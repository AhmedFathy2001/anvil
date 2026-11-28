// Combat Achievements that change a loadout, per boss profile: picking one on the trip card re-runs
// the engine with its limits (lib/tripLoadout). PURE.
//
// Only tasks that change what you bring are listed: a style or weapon rule, no prayer potions, the
// raid's own supplies, a speed target (the Max DPS plan). Tasks that only ask for clean mechanics or
// a kill count change nothing in the bank and are left out. The task names and tiers are the game's
// own (src/data/combatAchievements.json has the same by id: tests/loadout-ca-rules checks), written
// here so the site's guide pages don't ship the whole task list; `does` is our own short wording.

import { SUPPLY_FORMS, SUPPLY_LABEL } from './supplies';
import type { Loadout, LoadoutConstraints, Preset, SupplyKind } from './types';

export interface CaRule {
  /** The task's id in the game's list. */
  id: number;
  /** The task's name in the game: "Perfect Zulrah". */
  name: string;
  tier: string;
  /** The boss profile key (lib/loadout/profiles). */
  boss: string;
  /** What it asks of the setup, in a few words: "melee only". */
  does: string;
  constraints?: LoadoutConstraints;
  /** A plan it needs: a speed task wants the fastest kills. */
  preset?: Preset;
  /** The fight's version it is done in (ToB Hard Mode, CoX Challenge Mode). */
  variant?: string;
}

const SPEED = { does: 'a fast kill: the Max DPS plan', preset: 'max' as const };
const BARROWS = ["^ahrim's staff", "^dharok's greataxe", "^guthan's warspear", "^karil's crossbow", "^torag's hammers", "^verac's flail", '^dawnbringer'];

export const CA_RULES: readonly CaRule[] = [
  // Vorkath
  { id: 273, name: "Stick 'em With the Pointy End", tier: 'Elite', boss: 'vorkath', does: 'melee weapons only', constraints: { bannedStyles: ['ranged', 'magic'] } },
  { id: 274, name: 'Faithless Encounter', tier: 'Grandmaster', boss: 'vorkath', does: 'no prayer: no prayer potions', constraints: { noPrayerPots: true } },
  { id: 276, name: 'Vorkath Speed-Chaser', tier: 'Master', boss: 'vorkath', ...SPEED },
  { id: 277, name: 'Vorkath Speed-Runner', tier: 'Grandmaster', boss: 'vorkath', ...SPEED },
  // Zulrah
  { id: 229, name: 'Perfect Zulrah', tier: 'Master', boss: 'zulrah', does: 'no damage from its listed attacks: slower, careful kills on prayer', constraints: { moreSupplies: [{ kind: 'prayer', count: 2 }] } },
  { id: 230, name: 'Zulrah Speed-Trialist', tier: 'Elite', boss: 'zulrah', ...SPEED },
  { id: 231, name: 'Zulrah Speed-Chaser', tier: 'Master', boss: 'zulrah', ...SPEED },
  { id: 232, name: 'Zulrah Speed-Runner', tier: 'Grandmaster', boss: 'zulrah', ...SPEED },
  // Tombs of Amascut
  { id: 425, name: 'Helpful spirit who?', tier: 'Elite', boss: 'toa', does: 'nothing from the Helpful Spirit: bring your own supplies', constraints: { ownSupplies: true } },
  { id: 424, name: 'You are not prepared', tier: 'Master', boss: 'toa', does: 'only the tomb’s own supplies', constraints: { noSupplies: true } },
  { id: 428, name: 'Chompington', tier: 'Master', boss: 'toa', does: 'Zebak with melee only', constraints: { phaseStyles: { zebak: ['melee'] } } },
  { id: 429, name: 'Fancy feet', tier: 'Master', boss: 'toa', does: 'Wardens P3 with melee only', constraints: { phaseStyles: { p3: ['melee'] } } },
  { id: 421, name: 'Tombs Speed Runner', tier: 'Master', boss: 'toa', ...SPEED },
  { id: 422, name: 'Tombs Speed Runner II', tier: 'Grandmaster', boss: 'toa', ...SPEED },
  { id: 423, name: 'Tombs Speed Runner III', tier: 'Grandmaster', boss: 'toa', ...SPEED },
  // Theatre of Blood
  { id: 253, name: 'Back in My Day...', tier: 'Master', boss: 'tob', does: 'no Scythe of vitur', constraints: { bannedNames: ['^scythe of vitur'] } },
  { id: 251, name: 'Can You Dance?', tier: 'Master', boss: 'tob', does: 'Xarpus with melee only', constraints: { phaseStyles: { xarpus: ['melee'] } } },
  { id: 252, name: 'Morytania Only', tier: 'Grandmaster', boss: 'tob', does: 'Barrows weapons only (Dawnbringer allowed)', constraints: { weaponsOnly: BARROWS } },
  { id: 379, name: 'Harder Mode III', tier: 'Grandmaster', boss: 'tob', does: 'no melee on Verzik P3', constraints: { phaseStyles: { 'verzik-p3': ['ranged', 'magic'] } }, variant: 'hard' },
  { id: 254, name: 'Theatre (Duo) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED },
  { id: 255, name: 'Theatre (Trio) Speed-Chaser', tier: 'Master', boss: 'tob', ...SPEED },
  { id: 256, name: 'Theatre (Trio) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED },
  { id: 257, name: 'Theatre (4-Scale) Speed-Chaser', tier: 'Master', boss: 'tob', ...SPEED },
  { id: 258, name: 'Theatre (4-Scale) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED },
  { id: 259, name: 'Theatre (5-Scale) Speed-Chaser', tier: 'Master', boss: 'tob', ...SPEED },
  { id: 260, name: 'Theatre (5-Scale) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED },
  { id: 381, name: 'Hard Mode? Completed It', tier: 'Master', boss: 'tob', ...SPEED, variant: 'hard' },
  { id: 382, name: 'Theatre: HM (Trio) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED, variant: 'hard' },
  { id: 383, name: 'Theatre: HM (4-Scale) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED, variant: 'hard' },
  { id: 384, name: 'Theatre: HM (5-Scale) Speed-Runner', tier: 'Grandmaster', boss: 'tob', ...SPEED, variant: 'hard' },
  { id: 396, name: 'Theatre of Blood: SM Speed-Chaser', tier: 'Master', boss: 'tob', ...SPEED, variant: 'entry' },
  // Chambers of Xeric
  { id: 322, name: 'Chambers of Xeric (Solo) Speed-Chaser', tier: 'Master', boss: 'cox', ...SPEED },
  { id: 323, name: 'Chambers of Xeric (Solo) Speed-Runner', tier: 'Grandmaster', boss: 'cox', ...SPEED },
  { id: 324, name: 'Chambers of Xeric (5-Scale) Speed-Chaser', tier: 'Master', boss: 'cox', ...SPEED },
  { id: 325, name: 'Chambers of Xeric (5-Scale) Speed-Runner', tier: 'Grandmaster', boss: 'cox', ...SPEED },
  { id: 326, name: 'Chambers of Xeric (Trio) Speed-Chaser', tier: 'Master', boss: 'cox', ...SPEED },
  { id: 327, name: 'Chambers of Xeric (Trio) Speed-Runner', tier: 'Grandmaster', boss: 'cox', ...SPEED },
  { id: 292, name: 'Dust Seeker', tier: 'Elite', boss: 'cox', ...SPEED, variant: 'cm' },
  { id: 293, name: 'Chambers of Xeric: CM (Solo) Speed-Chaser', tier: 'Master', boss: 'cox', ...SPEED, variant: 'cm' },
  { id: 294, name: 'Chambers of Xeric: CM (Solo) Speed-Runner', tier: 'Grandmaster', boss: 'cox', ...SPEED, variant: 'cm' },
  { id: 295, name: 'Chambers of Xeric: CM (5-Scale) Speed-Chaser', tier: 'Master', boss: 'cox', ...SPEED, variant: 'cm' },
  { id: 296, name: 'Chambers of Xeric: CM (5-Scale) Speed-Runner', tier: 'Grandmaster', boss: 'cox', ...SPEED, variant: 'cm' },
  { id: 297, name: 'Chambers of Xeric: CM (Trio) Speed-Chaser', tier: 'Master', boss: 'cox', ...SPEED, variant: 'cm' },
  { id: 298, name: 'Chambers of Xeric: CM (Trio) Speed-Runner', tier: 'Grandmaster', boss: 'cox', ...SPEED, variant: 'cm' },
];

const TIER_ORDER = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

export interface CaOption {
  id: number;
  name: string;
  tier: string;
  does: string;
}

/** A task's name from the game's list ("Perfect Zulrah"), or null when the list doesn't have it. */
export const caName = (id: number): string | null => CA_RULES.find((r) => r.id === id)?.name ?? null;

export const caRule = (boss: string, id: number | null | undefined): CaRule | null => (id == null ? null : (CA_RULES.find((r) => r.boss === boss && r.id === id) ?? null));

/**
 * The loadout-changing tasks for a boss the player hasn't done, easiest tier first. `done` is the
 * set of completed task names, lowercased (lib/guideViewer cas); null (never synced) lists them all.
 */
export function casFor(boss: string, done: ReadonlySet<string> | null): CaOption[] {
  return CA_RULES.filter((r) => r.boss === boss && !done?.has(r.name.toLowerCase()))
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.name.localeCompare(b.name))
    .map((r) => ({ id: r.id, name: r.name, tier: r.tier, does: r.does }));
}

// ── "What changed", one plain line ───────────────────────────────────────────────────────────

const ORDER: SupplyKind[] = ['food', 'karambwan', 'brew', 'prayer', 'restore', 'antifire-super', 'antifire', 'antivenom', 'antipoison', 'ranging', 'magic-boost', 'combat', 'teleport-zulrah'];
const ONE: Partial<Record<SupplyKind, string>> = { karambwan: 'karambwan', brew: 'brew', prayer: 'prayer potion', restore: 'restore' };

/** A supply slot's kind by its name: each kind's own form first (a Prayer potion is a prayer potion, not a restore). */
function kindOf(name: string): SupplyKind | null {
  const plain = name.replace(/\s*\(\d\)\s*$/, '').trim();
  for (const k of ORDER) if (SUPPLY_FORMS[k][0]?.match.test(plain)) return k;
  for (const k of ORDER) if (SUPPLY_FORMS[k].some((f) => f.match.test(plain))) return k;
  return null;
}

function supplyCounts(l: Loadout): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of l.inventory) {
    if (!s) continue;
    const key = s.kind === 'reserved' ? 'free slot' : s.kind === 'supply' ? (kindOf(s.name) ?? 'other') : null;
    if (key) out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

const words = (n: number, k: string) => {
  if (k === 'free slot') return `${n} free slot${n === 1 ? '' : 's'}`;
  const label = n === 1 ? (ONE[k as SupplyKind] ?? SUPPLY_LABEL[k as SupplyKind] ?? k) : (SUPPLY_LABEL[k as SupplyKind] ?? k);
  return `${n} ${label}`;
};
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * "Perfect Zulrah: 3 food swapped for 2 prayer potions": what the task changed from the loadout
 * without it, in one line. The weapon worn, the switches and the supplies, in that order.
 */
export function caChangeLine(name: string, base: Loadout, withCa: Loadout, nameOf: (id: number) => string): string {
  const parts: string[] = [];
  if (withCa.preset !== base.preset && withCa.preset === 'max') parts.push('the Max DPS plan');
  if (base.worn.weapon !== withCa.worn.weapon && withCa.worn.weapon != null) parts.push(base.worn.weapon != null ? `${nameOf(base.worn.weapon)} swapped for ${nameOf(withCa.worn.weapon)}` : `${nameOf(withCa.worn.weapon)} worn`);
  const sw = (l: Loadout) => l.switches.length + l.specs.length;
  const ds = sw(withCa) - sw(base);
  if (ds) parts.push(`${Math.abs(ds)} ${ds > 0 ? 'more' : 'fewer'} switch${Math.abs(ds) === 1 ? '' : 'es'}`);
  const a = supplyCounts(base);
  const b = supplyCounts(withCa);
  const less: string[] = [];
  const more: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const d = (b.get(k) ?? 0) - (a.get(k) ?? 0);
    if (d < 0) less.push(words(-d, k));
    else if (d > 0) more.push(words(d, k));
  }
  if (less.length && more.length) parts.push(`${list(less)} swapped for ${list(more)}`);
  else if (less.length) parts.push(`${list(less)} left out`);
  else if (more.length) parts.push(`${list(more)} added`);
  return `${name}: ${parts.length ? parts.join(', ') : 'nothing to change in your setup'}`;
}
