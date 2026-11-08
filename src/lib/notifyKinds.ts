/**
 * The announcement kinds added on top of the original set (drops, pets, deaths, clog, levels, CA,
 * diaries, quests, PvP): slayer tasks, clue scrolls, speedruns, kill counts, BA gambles, custom chat
 * lines, Grand Exchange offers, trades, group storage and other plugins' requests. Plus one setting
 * that spans every kind: whether the announcement carries a screenshot.
 *
 * Each setting resolves like the drop thresholds (lib/notifyPrefs dropGates): the person's own choice,
 * else the default of the clan their character is in, else Anvil's. Stored as absent (null) when
 * inherited, never as a copied value, so a later clan change reaches everyone still following it.
 *
 * Every new kind is OFF on Anvil's side; a clan can make one a default for its members. The PRIVATE
 * kinds (GE, trades, group storage, other plugins) are the player's alone: a clan default never turns
 * them on, and they only ever post to the player's own webhooks.
 *
 * How the plugin finds them: most kinds are a game line. The site hands the plugin a list of WATCHES
 * (a glob, with `#` standing for a number and an optional every-N / minimum gate on it); a matching
 * line comes back as a `line` post, and the site re-checks it against the same list before posting.
 * Pure: no database.
 */

export type Source = 'custom' | 'clan' | 'platform';

/** Kinds read off a game line. */
export const LINE_KINDS = ['slayer', 'clues', 'speedruns', 'kc', 'ba', 'custom'] as const;
/** Kinds the plugin reads from a client hook; the player's alone. */
export const PRIVATE_KINDS = ['ge', 'trade', 'storage', 'ext'] as const;
export const NEW_KINDS = [...LINE_KINDS, ...PRIVATE_KINDS] as const;
export type LineKind = (typeof LINE_KINDS)[number];
export type PrivateKind = (typeof PRIVATE_KINDS)[number];
export type NewKind = (typeof NEW_KINDS)[number];

export const isPrivateKind = (k: string): k is PrivateKind => (PRIVATE_KINDS as readonly string[]).includes(k);
export const isNewKind = (k: string): k is NewKind => (NEW_KINDS as readonly string[]).includes(k);

export const CLUE_TIERS = ['beginner', 'easy', 'medium', 'hard', 'elite', 'master'] as const;
export type ClueTier = (typeof CLUE_TIERS)[number];

/** One kind's settings. Every field null = inherit. Only the fields a kind uses are kept. */
export interface KindSetting {
  on: boolean | null;
  shot: boolean | null;
  /** Post every Nth (KC, BA gambles, slayer streak). */
  every?: number | null;
  /** Lowest clue tier that posts. */
  tier?: ClueTier | null;
  /** Speedruns: only new personal bests. */
  pbOnly?: boolean | null;
  /** GE: smallest offer, in gp. */
  min?: number | null;
}

/** The original kinds, for the screenshot setting. Keys as on /settings; values the plugin's post kinds. */
export const SHOT_KINDS = {
  drops: ['drop'],
  pets: ['pet'],
  deaths: ['death'],
  clog: ['clogSlot'],
  ca: ['caTask'],
  diaries: ['diary'],
  levels: ['level', 'totalLevel'],
  pvp: ['pvpKills'],
} as const;
export type ShotKind = keyof typeof SHOT_KINDS;
export const SHOT_KEYS = Object.keys(SHOT_KINDS) as ShotKind[];

export const PATTERN_LIMITS = { count: 10, min: 4, max: 100, literal: 4 } as const;
export const EXT_SOURCE_LIMITS = { count: 10, max: 40 } as const;

/** A person's settings for all of the above (users.notify_prefs.kinds). */
export interface PersonalKinds {
  kinds: Partial<Record<NewKind, KindSetting>>;
  /** Screenshot on the original kinds' posts; null/absent = inherit. */
  shots: Partial<Record<ShotKind, boolean | null>>;
  /** Their own chat-line patterns: they post to their own webhooks. */
  patterns: string[];
  /** Plugins allowed to post through Anvil, by the name they send. */
  extSources: string[];
}

/** A clan's defaults for its members (setting notify_kind_defaults). Private kinds are never kept. */
export interface ClanKinds {
  kinds: Partial<Record<LineKind, KindSetting>>;
  shots: Partial<Record<ShotKind, boolean | null>>;
  /** The clan's chat-line patterns: they post to its channels. */
  patterns: string[];
}

export const NO_PERSONAL_KINDS: PersonalKinds = { kinds: {}, shots: {}, patterns: [], extSources: [] };
export const NO_CLAN_KINDS: ClanKinds = { kinds: {}, shots: {}, patterns: [] };

/** Anvil's own defaults. Every new kind is off; the numbers apply once someone turns one on. */
export const PLATFORM_KINDS: Record<NewKind, { on: boolean; shot: boolean; every?: number; tier?: ClueTier; pbOnly?: boolean; min?: number }> = {
  slayer: { on: false, shot: true, every: 1 },
  clues: { on: false, shot: true, tier: 'beginner' },
  speedruns: { on: false, shot: true, pbOnly: true },
  kc: { on: false, shot: true, every: 100 },
  ba: { on: false, shot: true, every: 100 },
  custom: { on: false, shot: true },
  ge: { on: false, shot: false, min: 1_000_000 },
  trade: { on: false, shot: false },
  storage: { on: false, shot: false },
  ext: { on: false, shot: false },
};
/** The original kinds all posted with a screenshot. */
export const PLATFORM_SHOT = true;

const EVERY_MAX = 100_000;
const GP_MAX = 2_147_483_647;

const boolOrNull = (v: unknown): boolean | null => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);
const intOrNull = (v: unknown, lo: number, hi: number): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : null;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** One stored kind → its clamped setting, keeping only the fields that kind has. */
export function normalizeKind(kind: NewKind, raw: unknown): KindSetting {
  const o = obj(raw);
  const p = PLATFORM_KINDS[kind];
  const out: KindSetting = { on: boolOrNull(o.on), shot: boolOrNull(o.shot) };
  if ('every' in p) out.every = intOrNull(o.every, 1, EVERY_MAX);
  if ('tier' in p) out.tier = typeof o.tier === 'string' && (CLUE_TIERS as readonly string[]).includes(o.tier) ? (o.tier as ClueTier) : null;
  if ('pbOnly' in p) out.pbOnly = boolOrNull(o.pbOnly);
  if ('min' in p) out.min = intOrNull(o.min, 0, GP_MAX);
  return out;
}

const isBlank = (s: KindSetting) => Object.values(s).every((v) => v == null);

function normalizeShots(raw: unknown): Partial<Record<ShotKind, boolean | null>> {
  const o = obj(raw);
  const out: Partial<Record<ShotKind, boolean | null>> = {};
  for (const k of SHOT_KEYS) {
    const b = boolOrNull(o[k]);
    if (b != null) out[k] = b;
  }
  return out;
}

/**
 * Why a chat pattern can't be used, or null when it can. `*` matches any text and `#` a number; the
 * rest is literal, case ignored. No regex: matching is one linear pass (see globNumber).
 */
export function patternProblem(raw: string): string | null {
  const p = raw.trim();
  if (p.length < PATTERN_LIMITS.min) return `At least ${PATTERN_LIMITS.min} characters.`;
  if (p.length > PATTERN_LIMITS.max) return `At most ${PATTERN_LIMITS.max} characters.`;
  if (/[\u0000-\u001f<>]/.test(p)) return 'Plain text only.';
  if (p.replace(/[*#\s]/g, '').length < PATTERN_LIMITS.literal) return `Needs at least ${PATTERN_LIMITS.literal} letters or digits besides * and #.`;
  if (/^\**$/.test(p.replace(/[#\s]/g, ''))) return 'Too broad.';
  return null;
}

/** A pattern list → the valid ones, trimmed, de-duplicated, capped. */
export function normalizePatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const p = v.trim().replace(/\*{2,}/g, '*');
    if (patternProblem(p) || out.some((x) => x.toLowerCase() === p.toLowerCase())) continue;
    out.push(p);
    if (out.length >= PATTERN_LIMITS.count) break;
  }
  return out;
}

function normalizeSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const s = v.trim().slice(0, EXT_SOURCE_LIMITS.max);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= EXT_SOURCE_LIMITS.count) break;
  }
  return out;
}

export function normalizePersonalKinds(raw: unknown): PersonalKinds {
  const o = obj(raw);
  const k = obj(o.kinds);
  const kinds: PersonalKinds['kinds'] = {};
  for (const kind of NEW_KINDS) {
    const s = normalizeKind(kind, k[kind]);
    if (!isBlank(s)) kinds[kind] = s;
  }
  return { kinds, shots: normalizeShots(o.shots), patterns: normalizePatterns(o.patterns), extSources: normalizeSources(o.extSources) };
}

/** A clan's defaults. A private kind is dropped here, so no clan value can ever reach it. */
export function normalizeClanKinds(raw: unknown): ClanKinds {
  const o = obj(raw);
  const k = obj(o.kinds);
  const kinds: ClanKinds['kinds'] = {};
  for (const kind of LINE_KINDS) {
    const s = normalizeKind(kind, k[kind]);
    if (!isBlank(s)) kinds[kind] = s;
  }
  return { kinds, shots: normalizeShots(o.shots), patterns: normalizePatterns(o.patterns) };
}

export function parseClanKinds(raw: string | null | undefined): ClanKinds {
  if (!raw) return NO_CLAN_KINDS;
  try {
    return normalizeClanKinds(JSON.parse(raw));
  } catch {
    return NO_CLAN_KINDS;
  }
}

/** One kind in force, with where each value came from. */
export interface ResolvedKind {
  on: boolean;
  shot: boolean;
  every: number;
  tier: ClueTier;
  pbOnly: boolean;
  min: number;
  sources: Record<'on' | 'shot' | 'every' | 'tier' | 'pbOnly' | 'min', Source>;
}

function pick<T>(own: T | null | undefined, clan: T | null | undefined, platform: NonNullable<T>): [NonNullable<T>, Source] {
  if (own != null) return [own, 'custom'];
  if (clan != null) return [clan, 'clan'];
  return [platform, 'platform'];
}

/**
 * The setting in force for one kind: the person's, else their clan's default, else Anvil's. A private
 * kind never reads the clan: only the person can turn it on.
 */
export function resolveKind(kind: NewKind, personal: PersonalKinds = NO_PERSONAL_KINDS, clan: ClanKinds = NO_CLAN_KINDS): ResolvedKind {
  const own = personal.kinds[kind];
  const c = isPrivateKind(kind) ? undefined : clan.kinds[kind as LineKind];
  const p = PLATFORM_KINDS[kind];
  const [on, onS] = pick(own?.on, c?.on, p.on);
  const [shot, shotS] = pick(own?.shot, c?.shot, p.shot);
  const [every, everyS] = pick(own?.every, c?.every, p.every ?? 1);
  const [tier, tierS] = pick(own?.tier, c?.tier, p.tier ?? 'beginner');
  const [pbOnly, pbS] = pick(own?.pbOnly, c?.pbOnly, p.pbOnly ?? true);
  const [min, minS] = pick(own?.min, c?.min, p.min ?? 0);
  return { on, shot, every, tier, pbOnly, min, sources: { on: onS, shot: shotS, every: everyS, tier: tierS, pbOnly: pbS, min: minS } };
}

/** Screenshot on one of the original kinds' posts, and where that came from. */
export function resolveShot(kind: ShotKind, personal: PersonalKinds = NO_PERSONAL_KINDS, clan: ClanKinds = NO_CLAN_KINDS): { shot: boolean; source: Source } {
  const [shot, source] = pick(personal.shots[kind], clan.shots[kind], PLATFORM_SHOT);
  return { shot, source };
}

/** What the plugin watches for: a glob, the kind it posts as, and the gate on its number. */
export interface Watch {
  k: LineKind;
  g: string;
  every: number;
  min: number;
  shot: boolean;
}

/** Where a custom pattern came from decides where its post may go. */
export interface SourcedWatch extends Watch {
  from?: 'clan' | 'own';
}

/**
 * The game lines behind each kind. `#` is the number the gate reads. Exact game wording, case ignored;
 * a reworded line is a site change, never a plugin release.
 */
export function kindGlobs(kind: Exclude<LineKind, 'custom'>, r: ResolvedKind): { g: string; every: number }[] {
  switch (kind) {
    case 'slayer':
      // "You've completed 57 tasks and received 15 points, giving you a total of 1,234; return to a Slayer master."
      return [{ g: "You've completed # tasks*", every: r.every }];
    case 'clues':
      // "You have completed 123 hard Treasure Trails."
      return CLUE_TIERS.slice(CLUE_TIERS.indexOf(r.tier)).map((t) => ({ g: `You have completed # ${t} Treasure Trail*`, every: 0 }));
    case 'speedruns':
      // "Fight duration: 1:23.40 (new personal best)", raids' "Duration:", ToB's "completion time:".
      return r.pbOnly
        ? [{ g: '*duration: *(new personal best)*', every: 0 }, { g: '*completion time: *(new personal best)*', every: 0 }]
        : [{ g: '*duration: #*', every: 0 }, { g: '*completion time: #*', every: 0 }];
    case 'kc':
      // "Your Zulrah kill count is: 500."
      return [{ g: 'Your * count is: #*', every: r.every }];
    case 'ba':
      // "High level gamble count: 100."
      return [{ g: '*gamble count: #*', every: r.every }];
  }
}

/**
 * Every watch in force for one character: each line kind that is on, plus the custom patterns (the
 * clan's when custom is on, the person's own too). Order matters: the first match wins, so the fixed
 * kinds come before anybody's free text.
 */
export function watchesFor(personal: PersonalKinds = NO_PERSONAL_KINDS, clan: ClanKinds = NO_CLAN_KINDS): SourcedWatch[] {
  const out: SourcedWatch[] = [];
  for (const kind of LINE_KINDS) {
    const r = resolveKind(kind, personal, clan);
    if (!r.on) continue;
    if (kind === 'custom') {
      for (const g of clan.patterns) out.push({ k: 'custom', g, every: 0, min: 0, shot: r.shot, from: 'clan' });
      for (const g of personal.patterns) out.push({ k: 'custom', g, every: 0, min: 0, shot: r.shot, from: 'own' });
      continue;
    }
    for (const w of kindGlobs(kind, r)) out.push({ k: kind, g: w.g, every: w.every <= 1 ? 0 : w.every, min: 0, shot: r.shot });
  }
  return out;
}

/** The plugin's copy: no provenance. */
export const pluginWatches = (ws: SourcedWatch[]): Watch[] => ws.map(({ k, g, every, min, shot }) => ({ k, g, every, min, shot }));

/**
 * The same matcher as the plugin's NotifyFacts.glob: `*` any text, `#` a number (digits and commas),
 * case ignored. Returns the last number matched (0 if none), or -1. One backtrack point, so the cost is
 * bounded by pattern length x line length — no regex, nothing to blow up.
 */
export function globNumber(p: string, s: string): number {
  let i = 0;
  let j = 0;
  let si = -1;
  let sj = 0;
  let n = 0;
  const digit = (c: string) => c >= '0' && c <= '9';
  while (j < s.length) {
    const c = i < p.length ? p[i] : '';
    if (c === '#' && digit(s[j])) {
      let v = 0;
      for (; j < s.length && (digit(s[j]) || s[j] === ','); j++) if (s[j] !== ',') v = Math.min(v * 10 + Number(s[j]), 2 ** 40);
      n = v;
      i++;
    } else if (c === '*') {
      si = ++i;
      sj = j;
    } else if (c !== '' && c !== '#' && c.toLowerCase() === s[j].toLowerCase()) {
      i++;
      j++;
    } else if (si >= 0) {
      i = si;
      j = ++sj;
    } else {
      return -1;
    }
  }
  while (i < p.length && p[i] === '*') i++;
  return i === p.length ? n : -1;
}

/** The watch of `kind` this line satisfies, gate included — the site's own check on a reported line. */
export function matchWatch(line: string, kind: string, watches: SourcedWatch[]): { watch: SourcedWatch; n: number } | null {
  for (const w of watches) {
    if (w.k !== kind) continue;
    const n = globNumber(w.g, line);
    if (n < 0 || n < w.min || (w.every > 0 && n % w.every !== 0)) continue;
    return { watch: w, n };
  }
  return null;
}

/** The post kinds (and the PvP channel) that go without a screenshot, for the plugin's Me.noShot. */
export function noShotList(personal: PersonalKinds = NO_PERSONAL_KINDS, clan: ClanKinds = NO_CLAN_KINDS): string[] {
  const out: string[] = [];
  for (const k of SHOT_KEYS) if (!resolveShot(k, personal, clan).shot) out.push(...SHOT_KINDS[k]);
  for (const k of ['ge', 'trade', 'storage'] as const) {
    const r = resolveKind(k, personal, clan);
    if (r.on && !r.shot) out.push(k);
  }
  return out;
}

/** The hook kinds that are on, with their floor, for the plugin's Me.on. Private: the person's alone. */
export function hookKindsOn(personal: PersonalKinds = NO_PERSONAL_KINDS): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of PRIVATE_KINDS) {
    const r = resolveKind(k, personal);
    if (r.on && (k !== 'ext' || personal.extSources.length > 0)) out[k] = k === 'ge' ? r.min : 0;
  }
  return out;
}
