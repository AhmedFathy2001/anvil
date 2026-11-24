// Setup pills: which of a level's setups suits this reader, and why the others don't. PURE.
//
// A level holds several setups (a ranged one, a melee one, a budget one). Each may say who it is for:
// account types (an Ironman can't buy a DHCB off the GE, so an "Iron-friendly" setup says so), builds
// (a 1 Defence pure can't wear Masori) and requirements (levels, quests). The reader's filters pick
// the default pill; a setup that doesn't fit is still shown, greyed, with the one reason it doesn't.

import { TIERS, type GearSetup, type TierKey } from './guideTiers';

export const GUIDE_ACCOUNTS = [
  { key: 'main', label: 'Main' },
  { key: 'ironman', label: 'Ironman' },
  { key: 'hcim', label: 'HCIM' },
  { key: 'uim', label: 'UIM' },
  { key: 'gim', label: 'GIM' },
] as const;
export type GuideAccount = (typeof GUIDE_ACCOUNTS)[number]['key'];

/** Builds, with the Defence they stop at. "any" is the filter's "Any build", never a setup tag. */
export const GUIDE_BUILDS = [
  { key: 'any', label: 'Any build', maxDef: 99 },
  { key: 'pure', label: 'Pure 1 def', maxDef: 1 },
  { key: 'zerker', label: 'Zerker 45 def', maxDef: 45 },
  { key: 'med', label: 'Med level', maxDef: 70 },
  { key: 'main', label: 'Main build', maxDef: 99 },
] as const;
export type GuideBuild = (typeof GUIDE_BUILDS)[number]['key'];

export const isGuideAccount = (v: unknown): v is GuideAccount => GUIDE_ACCOUNTS.some((a) => a.key === v);
export const isGuideBuild = (v: unknown): v is GuideBuild => GUIDE_BUILDS.some((b) => b.key === v);
export const accountLabel = (k: string) => GUIDE_ACCOUNTS.find((a) => a.key === k)?.label ?? k;
export const buildLabel = (k: string) => GUIDE_BUILDS.find((b) => b.key === k)?.label ?? k;

/** The game's stored mode (lib/accountType) as a guide filter. */
export function guideAccountOf(stored: string | null | undefined): GuideAccount {
  switch (stored) {
    case 'ironman':
      return 'ironman';
    case 'hardcore':
      return 'hcim';
    case 'ultimate':
      return 'uim';
    case 'group':
    case 'hardcore_group':
    case 'unranked_group':
      return 'gim';
    default:
      return 'main';
  }
}

/** A build from levels: a 1 Defence account is a pure, ≤45 a zerker, ≤70 a med, else a main. */
export function guideBuildOf(levels: Record<string, number> | null | undefined): GuideBuild {
  const def = levels?.defence;
  if (def == null) return 'any';
  if (def <= 1) return 'pure';
  if (def <= 45) return 'zerker';
  if (def <= 70) return 'med';
  return 'main';
}

/** Every iron type can use an Ironman setup (GIM trades only inside its group). */
const IRON: GuideAccount[] = ['ironman', 'hcim', 'uim', 'gim'];

/** A setup's stable key: its own id, else level + slugged name + position (old blocks have no ids). */
export function setupKey(s: Pick<GearSetup, 'id' | 'tier' | 'name'>, index: number): string {
  if (s.id && /^[a-z0-9-]{1,48}$/.test(s.id)) return s.id;
  const slug = (s.name || 'setup').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'setup';
  return `${s.tier}-${slug}-${index}`;
}

export interface Viewer {
  account?: GuideAccount | null;
  build?: GuideBuild | null;
  /** Hiscores levels when known (skill → level). */
  levels?: Record<string, number> | null;
  /** Quest names done, when the plugin sent the quest list. Lower-case. */
  quests?: Set<string> | null;
}

export interface Fit {
  ok: boolean;
  /** Why not, in a few words: "needs 70 Defence", "not for Ironman". */
  reason: string | null;
}

/** The Defence a setup needs: its own req, else its stats' (absent = no Defence need). */
export function defenceNeed(s: GearSetup): number {
  return s.req?.levels?.defence ?? 0;
}

/**
 * Does this setup suit the reader? Order of reasons: account type, build (Defence cap), then levels
 * and quests the reader is known to lack. Unknown levels never block — a logged-out reader sees
 * every setup as fitting except by the filters they chose.
 */
export function setupFit(s: GearSetup, v: Viewer): Fit {
  const accounts = (s.accounts ?? []).filter(isGuideAccount);
  if (v.account && accounts.length && !accounts.includes(v.account)) {
    // An Ironman setup suits every iron type unless it names them.
    const ironOk = v.account !== 'main' && accounts.includes('ironman') && IRON.includes(v.account) && v.account !== 'uim';
    if (!ironOk) return { ok: false, reason: `not for ${accountLabel(v.account)}` };
  }
  const builds = (s.builds ?? []).filter((b) => isGuideBuild(b) && b !== 'any');
  const def = defenceNeed(s);
  if (v.build && v.build !== 'any') {
    const cap = GUIDE_BUILDS.find((b) => b.key === v.build)!.maxDef;
    if (def > cap) return { ok: false, reason: `needs ${def} Defence` };
    if (builds.length && !builds.includes(v.build)) return { ok: false, reason: `made for ${builds.map(buildLabel).join(' / ')}` };
  }
  if (v.levels) {
    for (const [skill, need] of Object.entries(s.req?.levels ?? {})) {
      const have = v.levels[skill];
      if (have != null && have < need) return { ok: false, reason: `needs ${need} ${skill[0].toUpperCase()}${skill.slice(1)}` };
    }
  }
  if (v.quests) {
    const q = (s.req?.quests ?? []).find((name) => !v.quests!.has(name.toLowerCase()));
    if (q) return { ok: false, reason: `needs ${q}` };
  }
  return { ok: true, reason: null };
}

/**
 * The pill a level opens on: the curator's pick if it fits, else the first that fits, else the
 * pick, else the first. Iron accounts prefer a setup tagged for iron over one that merely fits.
 */
export function defaultSetup(setups: GearSetup[], v: Viewer): number {
  if (!setups.length) return -1;
  const fits = setups.map((s) => setupFit(s, v).ok);
  const iron = v.account && v.account !== 'main';
  const forIron = (s: GearSetup) => (s.accounts ?? []).some((a) => a !== 'main');
  const order = [
    (i: number) => fits[i] && !!setups[i].pick && (!iron || forIron(setups[i])),
    (i: number) => fits[i] && !!iron && forIron(setups[i]),
    (i: number) => fits[i] && !!setups[i].pick,
    (i: number) => fits[i],
    (i: number) => !!setups[i].pick,
  ];
  for (const test of order) {
    const i = setups.findIndex((_, j) => test(j));
    if (i >= 0) return i;
  }
  return 0;
}

const COMBAT = ['attack', 'strength', 'ranged', 'magic'] as const;

/**
 * The level a reader opens a guide on. The highest level with a setup whose combat stats they meet
 * in that setup's own style; with no setups to compare, by combat level. Null = unknown (logged out).
 */
export function viewerTier(setups: GearSetup[], levels: Record<string, number> | null | undefined): TierKey | null {
  if (!levels) return null;
  const meets = (s: GearSetup) => {
    const st = s.stats ?? ({} as GearSetup['stats']);
    // The style that matters most to the setup: its highest stat.
    const main = COMBAT.reduce((a, b) => ((st[b] ?? 0) > (st[a] ?? 0) ? b : a), 'attack' as (typeof COMBAT)[number]);
    return (levels[main] ?? 0) >= (st[main] ?? 0);
  };
  let best: TierKey | null = null;
  for (const t of TIERS) if (setups.some((s) => s.tier === t.key && meets(s))) best = t.key;
  if (best) return best;
  if (setups.length) return 'beginner';
  const cmb = combatLevel(levels);
  return cmb >= 115 ? 'advanced' : cmb >= 90 ? 'intermediate' : 'beginner';
}

/** OSRS combat level from levels (missing skills count as 1, hitpoints as 10). */
export function combatLevel(l: Record<string, number>): number {
  const g = (k: string, d = 1) => l[k] ?? d;
  const base = 0.25 * (g('defence') + g('hitpoints', 10) + Math.floor(g('prayer') / 2));
  const melee = 0.325 * (g('attack') + g('strength'));
  const range = 0.325 * Math.floor(g('ranged') * 1.5);
  const mage = 0.325 * Math.floor(g('magic') * 1.5);
  return Math.floor(base + Math.max(melee, range, mage));
}
