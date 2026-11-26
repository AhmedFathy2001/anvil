// The pre-trip check's "next trip" target: which trip a bank close OUTSIDE the trip regions
// (lib/tripContent) is checked for, so regearing at the Grand Exchange before a trip is checked too.
// PURE: lib/tripTargetStore reads the inputs, pluginUi/tripView and POST /api/plugin/items use it.
//
// THE TARGET, strongest first:
//   pick    the player chose it: "Going here next" on a guide, or a trip picked in the panel
//   guide   the guide they opened most recently, when it maps to a trip
//   last    the trip of their last kill count (the newest boss kc stamp, accounts.liveStatKeyTimes)
//
// A target is only ever a trip Anvil knows (TRIP_CONTENT) or one the player saved a setup for
// ("m:<monster>", lib/tripSetups): nothing is checked against content with no definition of its own.
//
// IT CLEARS when the trip ends: a pick or a guide gives way to a boss kc after it (the "last trip"
// then takes over, usually the same trip); a death, logout or hop (the plugin's `tripEnd` on its item
// push) or "clear" in the panel set `clearedAt`, which every source must be newer than; and after
// TARGET_IDLE_MS with no kc, pick or guide opened. No combat cues: this is read at the bank only.

import { BOSSES } from './constants';
import { bossKeyForName } from './capabilityData';
import { MONSTER_PREFIX, TRIP_CONTENT, tripContent } from './tripContent';

export type TargetSource = 'pick' | 'guide' | 'last';

/** What is stored (lib/tripTargetStore): the pick and the last clear. ISO times. */
export interface TargetState {
  pick?: { key: string; at: string };
  clearedAt?: string;
}

export interface Target {
  key: string;
  source: TargetSource;
}

/** A target nobody touched for this long is gone. */
export const TARGET_IDLE_MS = 2 * 60 * 60_000;
/** A kc stamped this soon after a pick is the kill just before it (the push lands late), not a new trip. */
const KC_GRACE_MS = 30_000;

/** The boss kc keys (BOSSES) that end each trip: its modes too. */
export const CONTENT_KC: Record<string, string[]> = {
  toa: ['tombsOfAmascut', 'tombsOfAmascutExpertMode'],
  tob: ['theatreOfBlood', 'theatreOfBloodHardMode'],
  cox: ['chambersOfXeric', 'chambersOfXericChallengeMode'],
  vorkath: ['vorkath'],
  zulrah: ['zulrah'],
  barrows: ['barrows'],
  nex: ['nex'],
  // Stamped by the plugin's "Deep delves completed" line (delve 9+); delves 1-8 print no count, so
  // a shallow Doom trip is only the target by a pick or a guide.
  doom: ['doomOfMokhaiotl'],
};

const BOSS_KEYS = new Set(BOSSES.map((b) => b.key));

/** "m:Doom of Mokhaiotl#Normal" → the boss kc key it is counted on ("doomOfMokhaiotl"), or null. */
export function bossOfKey(key: string): string | null {
  if (!key.startsWith(MONSTER_PREFIX)) return null;
  return bossKeyForName(key.slice(MONSTER_PREFIX.length).split('#')[0].trim());
}

/**
 * The target a boss kc means: the trip it belongs to, else the player's own setup for that boss. A
 * setup they saved for the boss picked by hand ("m:Doom of Mokhaiotl#…") wins over the trip's guide
 * or calc, unless they saved one for the trip itself too.
 */
export function contentForBoss(boss: string, ownKeys: readonly string[]): string | null {
  const own = ownKeys.find((k) => bossOfKey(k) === boss) ?? null;
  for (const [key, kcs] of Object.entries(CONTENT_KC)) if (kcs.includes(boss)) return own && !ownKeys.includes(key) ? own : key;
  return own;
}

/** Can this key be a target: a known trip, or one the player saved a setup for. */
export const isTargetKey = (key: string | null | undefined, ownKeys: readonly string[]): key is string => !!key && (!!tripContent(key) || ownKeys.includes(key));

/**
 * The trip a guide is for: the trip naming it (TRIP_CONTENT.guide), else the boss its gear block
 * counts kc on (lib/guideViewer kcKeyOf), else the player's own setup for the block's monster.
 */
export function guideTarget(slug: string, kcKey: string | null, monster: string | null, ownKeys: readonly string[]): string | null {
  const named = TRIP_CONTENT.find((c) => c.guide && c.guide === slug);
  if (named) return named.key;
  if (kcKey) {
    const k = contentForBoss(kcKey, ownKeys);
    if (k) return k;
  }
  if (!monster) return null;
  const exact = `${MONSTER_PREFIX}${monster}`;
  if (ownKeys.includes(exact)) return exact;
  const name = monster.split('#')[0].trim().toLowerCase();
  return ownKeys.find((k) => k.startsWith(MONSTER_PREFIX) && k.slice(MONSTER_PREFIX.length).split('#')[0].trim().toLowerCase() === name) ?? null;
}

/** The newest boss kc: its key and when (liveStatKeyTimes holds skills and activities too). */
export function lastKill(kcTimes: Record<string, string>): { boss: string; at: number } | null {
  let best: { boss: string; at: number } | null = null;
  for (const [k, iso] of Object.entries(kcTimes)) {
    if (!BOSS_KEYS.has(k)) continue;
    const at = Date.parse(iso);
    if (Number.isFinite(at) && (!best || at > best.at)) best = { boss: k, at };
  }
  return best;
}

export interface TargetInputs {
  state: TargetState | null;
  /** The guide opened most recently, already mapped (guideTarget): null when it maps to no trip. */
  guide: { key: string | null; at: string } | null;
  kcTimes: Record<string, string>;
  /** The content keys the player saved a setup for (lib/tripSetups). */
  ownKeys: readonly string[];
  now: number;
}

/** The target now, or null: nothing set, it ended, or it went idle. */
export function resolveTarget(inp: TargetInputs): Target | null {
  const cleared = inp.state?.clearedAt ? Date.parse(inp.state.clearedAt) : NaN;
  const kill = lastKill(inp.kcTimes);
  const live = (iso: string | undefined): boolean => {
    const at = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(at) || inp.now - at > TARGET_IDLE_MS) return false;
    if (Number.isFinite(cleared) && at <= cleared) return false;
    return !kill || kill.at <= at + KC_GRACE_MS;
  };
  const pick = inp.state?.pick;
  if (pick && isTargetKey(pick.key, inp.ownKeys) && live(pick.at)) return { key: pick.key, source: 'pick' };
  const g = inp.guide;
  if (g?.key && isTargetKey(g.key, inp.ownKeys) && live(g.at)) return { key: g.key, source: 'guide' };
  if (kill && inp.now - kill.at <= TARGET_IDLE_MS && !(Number.isFinite(cleared) && kill.at <= cleared)) {
    const key = contentForBoss(kill.boss, inp.ownKeys);
    if (key) return { key, source: 'last' };
  }
  return null;
}

/** "your pick", "the guide you opened", "last trip": said as "Checking for: Doom (last trip)". */
export const SOURCE_LABEL: Record<TargetSource, string> = { pick: 'your pick', guide: 'guide you opened', last: 'last trip' };
