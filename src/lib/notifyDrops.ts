import pluginNpcDrops from '@/data/pluginNpcDrops.json'; // the plugin's bundled npc_drops.json (Dink-derived)
import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import thievingDrops from '@/data/thievingDrops.json'; // the plugin's bundled thieving.json (Dink-derived)
import type { GuaranteedDrops } from '@/lib/dropFacts';
import { mainRarityGate, mainValueGate, modeGate, type NotifyPrefs } from '@/lib/notifyPrefs';

/**
 * Which drops post to the clan, decided here instead of in the plugin (it used to carry the drop
 * tables, the floors and the lucky-drop rules). The plugin still screenshots in the moment: it
 * screenshots any loot that MIGHT post — worth the value floor, or on the rare table below — and
 * sends the items; `judgeDrop` makes the call the plugin's maybeNotifyRareDrop used to, the same way.
 *
 * Rarity is a port of the plugin's AbstractRarityService (adapted from Dink, BSD-2-Clause): a drop
 * row is 1-in-d per roll, a multi-roll row expands into one entry per success count, and an item's
 * rate is the sum of the entries whose quantity range holds what dropped. The plugin's own tables
 * moved here with it (src/data/pluginNpcDrops.json, thievingDrops.json).
 */

interface RawDrop {
  i: number;
  d: number;
  r?: number;
  q?: number;
  m?: number;
  n?: number;
}

interface RareDrop {
  id: number;
  min: number;
  max: number;
  p: number;
}

const EPSILON = 0.00001;
/** MathUtils.lessThanOrEqual: the plugin's rounding slack, kept so the same drops post. */
const lte = (a: number, b: number) => a < b || Math.abs(a - b) <= EPSILON;

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
const binomial = (p: number, n: number, k: number) => (FACT[n] / (FACT[k] * FACT[n - k])) * p ** k * (1 - p) ** (n - k);

function expand(raw: RawDrop): RareDrop[] {
  const rounds = raw.r ?? 1;
  const min = raw.m ?? raw.q ?? 1;
  const max = raw.n ?? raw.q ?? 1;
  const p = 1 / raw.d;
  if (rounds === 1) return [{ id: raw.i, min, max, p }];
  const out: RareDrop[] = [];
  for (let k = 1; k <= rounds; k++) out.push({ id: raw.i, min: min * k, max: max * k, p: binomial(p, rounds, k) });
  return out;
}

/** Loot kind → the key prefix its table lives under (pickpocketing has its own table). */
const PREFIX: Record<string, string> = { npc: '', pickpocket: 'pp:' };

let tables: Map<string, RareDrop[]> | null = null;
function dropTables(): Map<string, RareDrop[]> {
  if (tables) return tables;
  const t = new Map<string, RareDrop[]>();
  // First table to name a source wins. The plugin's own table first, so every source it covered
  // posts exactly as it did; the site's wiki dataset fills in the rest — a wiki "Vorkath#Post-quest"
  // page answers for the "Vorkath" a loot event names, when nothing plainer already did.
  const add = (prefix: string, data: Record<string, RawDrop[]>) => {
    for (const [source, rows] of Object.entries(data)) {
      const key = prefix + source.split('#')[0].trim().toLowerCase();
      if (!t.has(key)) t.set(key, rows.flatMap(expand));
    }
  };
  add('', pluginNpcDrops as unknown as Record<string, RawDrop[]>);
  add('', npcDrops as unknown as Record<string, RawDrop[]>);
  add('pp:', thievingDrops as unknown as Record<string, RawDrop[]>);
  return (tables = t);
}

/**
 * The per-kill probability of this item at this quantity from this source, or null when the source
 * or item isn't on a table. `nameOf` answers a table row's item name, so a variant id with the same
 * name (the plugin's ItemVariationMapping check) still counts.
 */
export function dropRarity(
  sourceKind: string | null | undefined,
  source: string | null | undefined,
  item: { id?: number | null; name: string; qty: number },
  nameOf: (id: number) => string | undefined,
): number | null {
  const prefix = PREFIX[sourceKind ?? ''];
  if (prefix == null || !source) return null;
  const rows = dropTables().get(prefix + source.toLowerCase());
  if (!rows) return null;
  const name = item.name.toLowerCase();
  let sum = 0;
  let any = false;
  for (const r of rows) {
    if (r.min > item.qty || item.qty > r.max) continue;
    if (r.id !== item.id && nameOf(r.id)?.toLowerCase() !== name) continue;
    sum += r.p;
    any = true;
  }
  return any ? sum : null;
}

/**
 * The plugin's screenshot gate for rarity: source key ("pp:" prefix for pickpocketing) → item ids that
 * could be rare enough at this floor. Broad on purpose — a summed rate is only ever rarer-than-or-equal
 * a row's own, so anything that can pass `dropRarity` is here; `judgeDrop` makes the final call. Every
 * id sharing a listed item's name is included, so a variant id still screenshots.
 */
export function rareTable(floor: number, idsByName: Map<string, number[]>, nameOf: (id: number) => string | undefined) {
  const out: Record<string, number[]> = {};
  if (floor <= 0) return out;
  for (const [source, rows] of dropTables()) {
    const ids = new Set<number>();
    for (const r of rows) {
      if (!lte(r.p, 1 / floor)) continue;
      ids.add(r.id);
      const name = nameOf(r.id)?.toLowerCase();
      for (const v of (name && idsByName.get(name)) || []) ids.add(v);
    }
    if (ids.size) out[source] = [...ids].sort((a, b) => a - b);
  }
  return out;
}

// ── The lucky-drop rules (the plugin's DropLuck) ──────────────────────────────────────────────

const EARNED_AWARDS = [
  'infernal cape',
  'fire cape',
  "dizana's quiver",
  "champion's cape",
  'quest point cape',
  'music cape',
  'achievement diary cape',
  'max cape',
];
/** A haul or single item worth this much gets the lucky-drop line whatever its odds. */
export const SPOON_VALUE = 50_000_000;
const TROLL_VALUE_CEILING = 250_000;

export const isEarnedAward = (name: string | null | undefined) =>
  !!name && EARNED_AWARDS.some((a) => name.toLowerCase().includes(a));

const obtainedShare = (p: number, kc: number) => (p <= 0 || kc <= 0 ? 0 : p >= 1 ? 1 : -Math.expm1(kc * Math.log1p(-p)));

/** Fewer than one in ten players would have it by this kill count. */
const spooned = (rate: number | null, kc: number | null | undefined) =>
  rate != null && rate > 0 && kc != null && kc > 0 && obtainedShare(rate, kc) < 0.1;

/** A rare roll on something worthless: a punchline, not a prize. */
export const isTrollDrop = (rate: number | null, value: number, floor: number) =>
  rate != null && rate > 0 && floor > 0 && value < TROLL_VALUE_CEILING && lte(rate, 1 / floor);

export const deservesSpoonLine = (name: string, value: number, rate: number | null, kc: number | null | undefined) =>
  !isEarnedAward(name) && (spooned(rate, kc) || value >= SPOON_VALUE);

/** DropSource.isGuaranteed: the source hands this item over every kill ("*" = wherever it drops). */
export function isGuaranteed(g: GuaranteedDrops | null | undefined, name: string, source: string | null | undefined) {
  const sources = g?.[name.toLowerCase().trim()];
  if (!sources?.length) return false;
  return sources.includes('*') || (!!source && sources.includes(source.toLowerCase().trim()));
}

// ── The judge ─────────────────────────────────────────────────────────────────────────────────

export interface CandidateItem {
  id?: number | null;
  name: string;
  qty: number;
  value: number;
}

export interface DropCandidate {
  rsn?: string | null;
  source?: string | null;
  sourceKind?: string | null;
  kc?: number | null;
  /** The items the plugin's gate let through (loot keys themselves already left out). */
  items: CandidateItem[];
  /** A loot key's contents: one post for the lot, gated only by its total. */
  key?: boolean;
  /** The vestige rotation line; rides on a single-item post only, as it did. */
  note?: string | null;
  /** An always-notify prestige item ('loot' or 'unlock'): posts past every gate but the drops switch. */
  notable?: 'loot' | 'unlock' | null;
}

export interface JudgeContext {
  prefs: NotifyPrefs;
  /** The addressed clan's rarity floor (clan settings dropRarityFloor). */
  clanFloor: number | null | undefined;
  /** This world's mode thresholds (lib/worldModeStore pluginModeThresholds), null on the main game. */
  mode: { dropMinValue: number | null; dropRarityFloor: number | null } | null | undefined;
  guaranteed: GuaranteedDrops | null | undefined;
  nameOf: (id: number) => string | undefined;
}

/**
 * The drop post's facts (lib/pluginEmbeds DropFacts), or null when nothing in the candidate posts.
 * The same decisions, in the same order, as the plugin's maybeNotifyRareDrop / postRare.
 */
export function judgeDrop(c: DropCandidate, ctx: JudgeContext): Record<string, unknown> | null {
  const { prefs } = ctx;
  if (!prefs.drops || !c.items.length) return null;
  const base = { rsn: c.rsn ?? null, source: c.source ?? null, sourceKind: c.sourceKind ?? null, kc: c.kc ?? null };
  const mainRarity = mainRarityGate(prefs, ctx.clanFloor);

  const post = (items: (CandidateItem & { rate: number | null })[], modeOnly: boolean): Record<string, unknown> | null => {
    if (items.length === 0) return null;
    const plain = items.map(({ id, name, qty, value }) => ({ id: id ?? null, name, qty, value }));
    if (items.length > 1) {
      // No single rate to judge a mixed haul by, so the combined value decides.
      const total = items.reduce((s, it) => s + it.value, 0);
      return { ...base, items: plain, modeOnly, spoon: total >= SPOON_VALUE };
    }
    const it = items[0];
    const guaranteed = isGuaranteed(ctx.guaranteed, it.name, c.source);
    return {
      ...base,
      items: plain,
      dropRate: it.rate,
      guaranteed,
      troll: !guaranteed && isTrollDrop(it.rate, it.value, mainRarity),
      modeOnly,
      // The reaction line is about beating the odds. A guaranteed drop had none to beat.
      spoon: !guaranteed && deservesSpoonLine(it.name, it.value, it.rate, c.kc),
      note: c.note ?? null,
    };
  };

  if (c.notable) {
    // Two kinds of notable item the lucky-drop line insults: an EARNED award (the reward for finishing
    // the content) and a GUARANTEED drop (never rolled for). The plugin's postNotable, moved.
    const it = c.items[0];
    const earned = isEarnedAward(it.name);
    const guaranteed = isGuaranteed(ctx.guaranteed, it.name, c.source);
    return {
      ...base,
      items: [{ id: it.id ?? null, name: it.name, qty: it.qty, value: it.value }],
      notable: c.notable,
      earned,
      guaranteed,
      spoon: !earned && !guaranteed,
    };
  }

  if (c.key) {
    const total = c.items.reduce((s, it) => s + it.value, 0);
    if (prefs.keyMin <= 0 || total < prefs.keyMin) return null;
    return post(c.items.map((it) => ({ ...it, rate: null })), false);
  }

  const mainValue = mainValueGate(prefs);
  const valueGate = ctx.mode ? modeGate(mainValue, ctx.mode.dropMinValue) : mainValue;
  const rarityGate = ctx.mode ? modeGate(mainRarity, ctx.mode.dropRarityFloor) : mainRarity;
  let modeOnly = true;
  const qualifying: (CandidateItem & { rate: number | null })[] = [];
  for (const it of c.items) {
    const valueOk = valueGate > 0 && it.value >= valueGate;
    let rate: number | null = null;
    if (rarityGate > 0 && c.source) {
      const p = dropRarity(c.sourceKind, c.source, it, ctx.nameOf);
      if (p != null && p > 0 && lte(p, 1 / rarityGate)) rate = p;
    }
    if (!valueOk && rate == null) continue;
    qualifying.push({ ...it, rate });
    modeOnly &&= !((mainValue > 0 && it.value >= mainValue) || (rate != null && mainRarity > 0 && lte(rate, 1 / mainRarity)));
  }
  return post(qualifying, !!ctx.mode && modeOnly);
}
