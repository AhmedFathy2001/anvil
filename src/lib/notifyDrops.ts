import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import type { GuaranteedDrops } from '@/lib/dropFacts';
import { dropGates, hookGates, modeGate, type ClanDropSettings, type DropGates, type HookDropFilter, type NotifyPrefs } from '@/lib/notifyPrefs';

/**
 * Which drops post to the clan, decided here instead of in the plugin. The plugin screenshots in the
 * moment: any loot that MIGHT post (worth the value floor, or on the rare table below) goes up with
 * its items, and `judgeDrop` makes the call.
 *
 * Rarity comes from our own OSRS Wiki drops dataset (src/data/npcDrops.json, refreshed daily): a row
 * is 1-in-d per roll, a multi-roll row expands into one entry per success count (binomial), and an
 * item's rate is the sum of the entries whose quantity range holds what dropped. The wiki dataset
 * carries no pickpocket tables, so pickpocket loot has no rarity and posts on value alone.
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

/** Float-tolerant `a <= b`: a summed rate that equals 1/floor in exact arithmetic still counts. */
const lte = (a: number, b: number) => a <= b * (1 + 1e-9);

/** P(exactly k successes in n independent tries of chance p). */
function binomial(p: number, n: number, k: number) {
  let coeff = 1;
  for (let i = 1; i <= k; i++) coeff = (coeff * (n - k + i)) / i;
  return coeff * p ** k * (1 - p) ** (n - k);
}

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

/** Loot kinds that have a drop table (pickpocketing has none in the wiki dataset). */
const KINDS = new Set(['npc']);

let tables: Map<string, RareDrop[]> | null = null;
function dropTables(): Map<string, RareDrop[]> {
  if (tables) return tables;
  const t = new Map<string, RareDrop[]>();
  // A wiki "Vorkath#Post-quest" page answers for the "Vorkath" a loot event names, when nothing
  // plainer already did: the first page to name a source wins.
  for (const [source, rows] of Object.entries(npcDrops as unknown as Record<string, RawDrop[]>)) {
    const key = source.split('#')[0].trim().toLowerCase();
    if (!t.has(key)) t.set(key, rows.flatMap(expand));
  }
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
  if (!KINDS.has(sourceKind ?? '') || !source) return null;
  const rows = dropTables().get(source.toLowerCase());
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
 * The plugin's screenshot gate for rarity: source key → item ids that
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

// ── The lucky-drop rules (the lucky-drop rules) ──────────────────────────────────────────────

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
  /** The character's clan defaults + the addressed clan's hard rarity floor (lib/notifyPrefs dropGates). */
  clan: ClanDropSettings;
  /** This world's mode thresholds (lib/worldModeStore pluginModeThresholds), null on the main game. */
  mode: { dropMinValue: number | null; dropRarityFloor: number | null } | null | undefined;
  guaranteed: GuaranteedDrops | null | undefined;
  nameOf: (id: number) => string | undefined;
}

/**
 * The drop post's facts (lib/pluginEmbeds DropFacts), or null when nothing in the candidate posts.
 * The same decisions, in the same order, as the plugin's maybeNotifyRareDrop / postRare.
 */
export function judgeDrop(c: DropCandidate, ctx: JudgeContext, gatesOverride?: DropGates): Record<string, unknown> | null {
  const { prefs } = ctx;
  if (!prefs.drops || !c.items.length) return null;
  const base = { rsn: c.rsn ?? null, source: c.source ?? null, sourceKind: c.sourceKind ?? null, kc: c.kc ?? null };
  const gates = gatesOverride ?? dropGates(prefs, ctx.clan);
  const mainRarity = gates.rarity;

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

  const mainValue = gates.value;
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
    if (!dropPasses(gates.mode, valueGate, rarityGate, valueOk, rate != null)) continue;
    qualifying.push({ ...it, rate });
    modeOnly &&= !dropPasses(
      gates.mode,
      mainValue,
      mainRarity,
      mainValue > 0 && it.value >= mainValue,
      rate != null && mainRarity > 0 && lte(rate, 1 / mainRarity),
    );
  }
  return post(qualifying, !!ctx.mode && modeOnly);
}

/**
 * Whether an item clears the thresholds. 'or': value OR rarity. 'and': both, where a threshold that is
 * off isn't required (so one off leaves the other to decide, and both off posts nothing).
 */
export function dropPasses(mode: 'or' | 'and', valueGate: number, rarityGate: number, valueOk: boolean, rarityOk: boolean): boolean {
  if (mode !== 'and') return valueOk || rarityOk;
  if (valueGate <= 0 && rarityGate <= 0) return false;
  return (valueGate <= 0 || valueOk) && (rarityGate <= 0 || rarityOk);
}

/** Where a judged drop goes: the person's clan channels and/or these of their own webhooks (by id). */
export interface DropVerdict {
  facts: Record<string, unknown>;
  clan: boolean;
  hooks: number[];
}

/**
 * judgeDrop for every destination the person has. The clan channels judge by the person's effective
 * gates (custom, else clan default, else Anvil's). Each personal webhook with its own filters judges by
 * them, falling back per filter to those same gates; one with none follows the person. Null = nothing
 * posts anywhere.
 */
export function judgeDropFor(c: DropCandidate, ctx: JudgeContext, hooks: HookDropFilter[]): DropVerdict | null {
  const person = judgeDrop(c, ctx);
  const base = dropGates(ctx.prefs, ctx.clan);
  const ids: number[] = [];
  let facts = person;
  for (const h of hooks) {
    if (h.minValue == null && h.minRarity == null && h.mode == null) {
      if (person) ids.push(h.id);
      continue;
    }
    const own = judgeDrop(c, ctx, hookGates(base, h));
    if (!own) continue;
    ids.push(h.id);
    facts ??= own;
  }
  return facts ? { facts, clan: !!person, hooks: ids } : null;
}

/**
 * The last gate before sending a judged drop: every clan destination (a url mapped to a clan id) is
 * dropped when the person's own gates declined it (verdict.clan false), whatever put it in the map. Only
 * their own webhooks (no clan id) that the verdict named stay. Unjudged posts (no verdict) pass untouched.
 */
export function keepDropDestinations(urls: Map<string, number | undefined>, verdict: DropVerdict | null): Map<string, number | undefined> {
  if (!verdict || verdict.clan) return urls;
  return new Map([...urls].filter(([, clanId]) => clanId == null));
}
