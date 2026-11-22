/**
 * The site's side of tile conditions (lib/tileConditions): checking what a tile save sends, the raid
 * names a clear line can carry for a tile, and who on the board can take a start-count tile.
 *
 * Pure: no database, so the tiles route, the config builder, the facts judging and the tests share it.
 */
import { RAID_OPTIONS, type RaidId, type RaidModeId } from '@/lib/tileCreatorConfig';
import { hiscoresKeyForMonster } from '@/lib/killSource';
import { compareVersions } from '@/lib/tileRequirementChecks';
import {
  RAID_PARTY_MAX,
  raidOffers,
  startCountAllows,
  type PartyBar,
  type RaidPick,
  type StartCount,
  type TileConditions,
  type ToaBar,
} from '@/lib/tileConditions';

/** The tile kind a conditioned raid tile is stored as: counted only from the plugin's `raid` facts. */
export const RAID_TILE_TYPE = 'raid';

/** The first plugin that sends `raid` facts and the count line on kill facts. */
export const RAID_FACTS_MIN_PLUGIN = '1.17.2';

export const MAX_RAID_PICKS = 4;
const MAX_SECONDS = 6 * 3600;
const MAX_TOA_LEVEL = 600;
const MAX_START_COUNT = 100_000;

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function toaBar(v: unknown, what: string): Check<ToaBar> {
  if (!obj(v)) return bad(`${what}: give the raid level.`);
  if (!isInt(v.min, 0, MAX_TOA_LEVEL)) return bad(`${what}: the raid level must be a whole number from 0 to ${MAX_TOA_LEVEL}.`);
  const op = v.op ?? 'gte';
  if (op !== 'gte' && op !== 'eq' && op !== 'lte') return bad(`${what}: the level is exactly, at least or at most a number.`);
  return { ok: true, value: { min: v.min, entry: v.entry === true, ...(op !== 'gte' ? { op } : {}) } };
}

function partyBar(v: unknown, raid: RaidId): Check<PartyBar | null> {
  if (v == null) return { ok: true, value: null };
  if (!obj(v) || (v.op !== 'eq' && v.op !== 'gte' && v.op !== 'lte')) return bad('The party size is exactly, at least or at most a number.');
  const max = RAID_PARTY_MAX[raid];
  if (!isInt(v.n, 1, max)) return bad(`${raidLabel(raid)} takes 1 to ${max} players.`);
  return { ok: true, value: { op: v.op, n: v.n } };
}

const raidLabel = (raid: RaidId) => RAID_OPTIONS.find((r) => r.id === raid)?.label ?? raid;

function pick(v: unknown): Check<RaidPick> {
  if (!obj(v)) return bad('Each raid on the tile must be an object.');
  const opt = RAID_OPTIONS.find((r) => r.id === v.raid);
  if (!opt) return bad('Pick a raid: CoX, ToB, ToA or TFA.');
  const raid = opt.id;
  const out: RaidPick = { raid };
  if (raid === 'toa') {
    const bar = toaBar(v.toa ?? { min: 150, entry: false }, 'Tombs of Amascut');
    if (!bar.ok) return bar;
    out.toa = bar.value;
  } else {
    const known = new Set(opt.modes.map((m) => m.id));
    const modes = Array.isArray(v.modes) ? [...new Set(v.modes as unknown[])] : [];
    if (modes.length === 0) return bad(`${opt.label}: tick at least one mode.`);
    if (!modes.every((m) => known.has(m as RaidModeId))) return bad(`${opt.label}: that mode isn’t one of its modes.`);
    out.modes = modes as RaidModeId[];
  }
  if (v.under != null) {
    if (!isInt(v.under, 1, MAX_SECONDS)) return bad(`${opt.label}: the time must be between 1 second and 6 hours.`);
    out.under = v.under;
  }
  const party = partyBar(v.party, raid);
  if (!party.ok) return party;
  if (party.value) out.party = party.value;
  const offers = raidOffers(raid, out.modes ?? []);
  if (v.challenge === true) {
    if (!offers.challenge) return bad(`${opt.label}: only CoX Challenge Mode and ToB Hard Mode have a challenge time.`);
    out.challenge = true;
  }
  if (v.scale != null) {
    if (!offers.scale) return bad('Only Chambers of Xeric scales to a team size.');
    if (!isInt(v.scale, 1, 100)) return bad('The scaled team size must be 1 to 100.');
    out.scale = v.scale;
  }
  return { ok: true, value: out };
}

/**
 * A tile save's `conditions`: null/absent clears; otherwise checked whole and rebuilt from the known
 * fields only, so nothing stray is stored. `{v:1}` with nothing in it is stored as null.
 */
export function validateConditions(raw: unknown): Check<TileConditions | null> {
  if (raw == null || raw === '') return { ok: true, value: null };
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return bad('conditions must be JSON.');
    }
  }
  if (!obj(v) || v.v !== 1) return bad('conditions must be an object with v: 1.');
  const out: TileConditions = { v: 1 };
  if (v.raids != null) {
    if (!Array.isArray(v.raids) || v.raids.length > MAX_RAID_PICKS) return bad(`A raid tile takes 1 to ${MAX_RAID_PICKS} raids.`);
    const picks: RaidPick[] = [];
    for (const p of v.raids) {
      const r = pick(p);
      if (!r.ok) return r;
      picks.push(r.value);
    }
    if (picks.length) out.raids = picks;
  }
  if (v.noDeaths === true) out.noDeaths = true;
  if (v.mates != null) {
    if (!obj(v.mates)) return bad('Teammates inside: at least a number, or the whole party.');
    if (v.mates.all === true) out.mates = { all: true };
    else if (isInt(v.mates.min, 1, 100)) out.mates = { min: v.mates.min };
    else return bad('Teammates inside must be 1 to 100.');
  }
  if (v.shared != null) {
    if (v.shared !== 'each' && v.shared !== 'together') return bad("A shared raid counts 'each' or 'together'.");
    if (v.shared === 'together') out.shared = 'together';
  }
  if (v.startCount != null) {
    const s = v.startCount;
    if (!obj(s) || (s.op !== 'lt' && s.op !== 'gt')) return bad('The count at the start is under or over a number.');
    if (!isInt(s.n, 0, MAX_START_COUNT)) return bad(`The count at the start must be 0 to ${MAX_START_COUNT.toLocaleString('en-US')}.`);
    if (s.op === 'lt' && s.n === 0) return bad('Nobody has under 0: use “under 1” for a first.');
    out.startCount = { op: s.op, n: s.n };
  }
  if (v.toaLevel != null) {
    const bar = toaBar(v.toaLevel, 'The ToA raid level');
    if (!bar.ok) return bar;
    out.toaLevel = bar.value;
  }
  const empty = !out.raids && !out.noDeaths && !out.mates && !out.shared && !out.startCount && !out.toaLevel;
  return { ok: true, value: empty ? null : out };
}

/**
 * Which conditions a tile kind may carry, or why not. A raid tile is raids plus every tile-wide rule;
 * a plugin kill or collection log tile the start count; a drop tile a ToA level (and the start count
 * of nothing, so none).
 */
export function conditionsKindError(tileType: string | null | undefined, c: TileConditions | null, hasStat: boolean): string | null {
  if (!c) return tileType === RAID_TILE_TYPE ? 'A raid tile needs at least one raid.' : null;
  const raidOnly = !!(c.raids?.length || c.noDeaths || c.mates || c.shared);
  if (tileType === RAID_TILE_TYPE) {
    if (!c.raids?.length) return 'A raid tile needs at least one raid.';
    if (c.toaLevel) return 'The ToA drop level is for drop tiles; put the level on the ToA raid instead.';
    return null;
  }
  if (raidOnly) return 'Raids, deaths and teammates are conditions of a raid tile.';
  if (c.startCount) {
    if (hasStat) return 'The count at the start needs the plugin to count the kills: switch the tile to the plugin.';
    if (tileType !== 'kill' && tileType !== 'clog') return 'Only raid, kill and collection log tiles can ask for a count at the start.';
  }
  if (c.toaLevel && tileType !== 'drop') return 'Only drop tiles can ask for a ToA raid level.';
  return null;
}

// ─── Clear lines ─────────────────────────────────────────────────────────────────────────────────

/** Every raid variant's clear-line name, lower-cased → its raid and mode. */
export const RAID_KEY_MODES: ReadonlyMap<string, { raid: RaidId; mode: RaidModeId }> = new Map(
  RAID_OPTIONS.flatMap((r) => r.modes.map((m) => [m.name.toLowerCase(), { raid: r.id, mode: m.id }] as const)),
);

/** The ToA modes a level bar can be met in. */
function toaModes(bar: ToaBar): RaidModeId[] {
  const op = bar.op ?? 'gte';
  const out: RaidModeId[] = bar.entry ? ['entry'] : [];
  const lo = op === 'lte' ? 0 : bar.min;
  const hi = op === 'gte' ? Infinity : bar.min;
  if (lo < 300 && hi >= 150) out.push('normal');
  if (hi >= 300) out.push('expert');
  return out;
}

/** The modes of each raid a pick can count. */
export function pickModes(p: RaidPick): RaidModeId[] {
  return p.raid === 'toa' ? toaModes(p.toa ?? { min: 150, entry: false }) : p.modes ?? [];
}

/**
 * The lower-cased clear-line names the plugin reports a `raid` fact for, for this tile: EVERY mode of
 * each picked raid, not just the ones that count. The plugin reports the longest key the line names,
 * so with only "chambers of xeric" listed a CM clear would arrive as a Normal one; with all of them
 * it arrives under its own name and the site refuses it in words.
 */
export function raidKeys(c: TileConditions | null): string[] {
  const out = new Set<string>();
  for (const p of c?.raids ?? []) {
    for (const m of RAID_OPTIONS.find((r) => r.id === p.raid)?.modes ?? []) out.add(m.name.toLowerCase());
  }
  return [...out];
}

/** The hiscores keys whose sum is a raid tile's "count when the event started". */
export function raidStartKeys(c: TileConditions | null): string[] {
  const out = new Set<string>();
  for (const p of c?.raids ?? []) {
    const opt = RAID_OPTIONS.find((r) => r.id === p.raid);
    for (const m of pickModes(p)) {
      const name = opt?.modes.find((x) => x.id === m)?.name;
      const key = name ? hiscoresKeyForMonster(name) : null;
      if (key) out.add(key);
    }
  }
  return [...out];
}

/**
 * The start count from one player's event-start baseline: the sum over the keys, or null when the
 * player had no baseline or was not listed for any of them (unknown: the count line decides).
 * `read` answers a key's hiscores score, null/negative when unlisted.
 */
export function startCountFrom(keys: string[], read: (key: string) => number | null | undefined): number | null {
  let sum = 0;
  let seen = false;
  for (const k of keys) {
    const v = read(k);
    if (v == null || v < 0) continue;
    sum += v;
    seen = true;
  }
  return seen ? sum : null;
}

// ─── Who can take it ─────────────────────────────────────────────────────────────────────────────

/** "kills" / "clears" — what a start count is a count of, for the words below. */
export type CountNoun = { one: string; many: string };
export const KILLS: CountNoun = { one: 'kill', many: 'kills' };
export const CLEARS: CountNoun = { one: 'clear', many: 'clears' };

/** One player's start-count verdict: can they take the tile, and the panel's short line for it. */
export function takeLine(bar: StartCount, start: number | null, noun: CountNoun = KILLS): { ok: boolean; line: string } {
  if (start == null) return { ok: true, line: 'You can take this' };
  if (startCountAllows(bar, start)) return { ok: true, line: 'You can take this' };
  return { ok: false, line: `Not for you: ${start.toLocaleString('en-US')} ${start === 1 ? noun.one : noun.many} at the start` };
}

/** The longer sentence the site's tile detail shows the viewer. */
export function takeSentence(bar: StartCount, start: number | null, what: string, noun: CountNoun = KILLS): { ok: boolean; text: string } {
  if (start == null) return { ok: true, text: `You can take this: no ${what} ${noun.many} on the hiscores when it started.` };
  if (startCountAllows(bar, start)) return { ok: true, text: `You can take this: you had ${start.toLocaleString('en-US')} ${what} ${start === 1 ? noun.one : noun.many} when it started.` };
  return { ok: false, text: `Not for you: you had ${start.toLocaleString('en-US')} ${what} ${start === 1 ? noun.one : noun.many} when it started.` };
}

/** A team board's line: "3 of 5 on Team Bandos can take it: a, b, c." / "Nobody on the team can take this". */
export function teamTakeLine(team: string, members: { name: string; start: number | null }[], bar: StartCount): string {
  const can = members.filter((m) => startCountAllows(bar, m.start)).map((m) => m.name);
  if (can.length === 0) return 'Nobody on the team can take this';
  const who = can.length <= 5 ? `: ${can.join(', ')}` : '';
  return `${can.length} of ${members.length} on ${team} can take it${who}.`;
}

/** The panel row line for a tile an older plugin can't count. */
export const NEEDS_PLUGIN_LINE = 'Needs the latest Anvil plugin';

// ─── The count when the event started ────────────────────────────────────────────────────────────

/** The fields of a tile the start count is read off. */
export interface StartTileLike {
  tileType?: string | null;
  conditions?: string | TileConditions | null;
  targetNpcs?: string | string[] | null;
}

function targetsOf(t: StartTileLike): string[] {
  if (Array.isArray(t.targetNpcs)) return t.targetNpcs.map(String);
  try {
    const v = t.targetNpcs ? JSON.parse(t.targetNpcs) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * The hiscores keys a tile's start count sums: a raid tile's raids, a kill tile's monsters. Empty when
 * nothing on it is on the hiscores (a collection log tile, a chicken): then the count line decides.
 */
export function tileStartKeys(t: StartTileLike): string[] {
  if (t.tileType === RAID_TILE_TYPE) return raidStartKeys(typeof t.conditions === 'string' || t.conditions == null ? parseStored(t.conditions) : t.conditions);
  if (t.tileType === 'kill') return [...new Set(targetsOf(t).map((n) => hiscoresKeyForMonster(n)).filter((k): k is string => !!k))];
  return [];
}

function parseStored(raw: string | null | undefined): TileConditions | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && v.v === 1 ? (v as TileConditions) : null;
  } catch {
    return null;
  }
}

/** What the count is of, for the sentences ("TzKal-Zuk kills", "CoX clears"). */
export function tileStartWhat(t: StartTileLike): { what: string; noun: CountNoun } {
  if (t.tileType === RAID_TILE_TYPE) {
    const c = typeof t.conditions === 'string' || t.conditions == null ? parseStored(t.conditions) : t.conditions;
    const names = [...new Set((c?.raids ?? []).map((p) => RAID_OPTIONS.find((r) => r.id === p.raid)?.short ?? p.raid))];
    return { what: names.join('/') || 'raid', noun: CLEARS };
  }
  const first = targetsOf(t)[0];
  return { what: first ?? 'kill', noun: KILLS };
}

/** A participant's event-start baseline (statsSnapshot JSON) read for those keys: their start count, or null when unknown. */
export function startCountOfSnapshot(snapshot: string | null | undefined, keys: string[]): number | null {
  if (!snapshot || keys.length === 0) return null;
  let parsed: { bosses?: Record<string, { score?: number } | undefined> } | null = null;
  try {
    parsed = JSON.parse(snapshot);
  } catch {
    return null;
  }
  return startCountFrom(keys, (k) => parsed?.bosses?.[k]?.score ?? null);
}

/** Does a plugin of this version (its X-Anvil-Plugin-Version) send raid facts? Unknown reads as no. */
export function raidFactsSupportedBy(version: string | null | undefined): boolean {
  const cmp = compareVersions(version, RAID_FACTS_MIN_PLUGIN);
  return cmp != null && cmp >= 0;
}

/**
 * A tile only site-judged facts may credit from the plugin: a raid tile, or one whose conditions the
 * plugin can't be trusted to have checked (a start count, a ToA level).
 */
export function conditionedForPlugin(tile: { tileType?: string | null; conditions?: string | null }): boolean {
  if (tile.tileType === RAID_TILE_TYPE) return true;
  const c = parseStored(tile.conditions ?? null);
  return !!c && (!!c.startCount || !!c.toaLevel);
}
