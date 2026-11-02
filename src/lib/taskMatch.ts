// "What should players do?" — the matcher behind the tile creator, the bulk "paste your list" and
// the editor's task finder. Pure: it is handed everything it searches (the item catalogue, the
// clan's library, the collection-log pages) so the tests run without a database and the client can
// use the static half (browse lists, re-titling) directly.
//
// It covers every kind a tile can be: hiscores kills and XP, in-game counters, raids (with their
// modes), agility courses and the Sepulchre, Barracuda Trials, items (both "lands in the inventory"
// and "a monster drops it"), diaries, combat tasks, and the challenge kinds (speed, deathless, LMS,
// PvP, loot value). A number typed before or after the task is the amount; "– 20 pts" at the end of
// a line is its points.
//
// Matching is token overlap rather than substring: a clan's list is written as sentences ("150
// Hallowed marks earned in Sepulchre"), so a candidate wins by covering the query's meaningful words
// — with a bonus when its whole name appears in order — not by containing the query verbatim.

import {
  AGILITY_COURSES,
  BOSSES,
  CA_TIERS,
  COUNTER_TARGETS,
  DIARY_AREAS,
  DIARY_TIERS,
  RAID_MODE_VARIANTS,
  SEPULCHRE_TARGETS,
  SKILLS,
  SKILL_ALIASES,
  SKILL_LABELS,
} from '@/lib/constants';
import { HISCORES_ACTIVITIES } from '@/lib/hiscoresActivities';
import { chooseKillSource, hiscoresKeyForMonster } from '@/lib/killSource';
import type { TileConfig } from '@/lib/types';
import { GOTR_ENERGY_CAPS, GOTR_SEARCHES, capPhrase } from '@/lib/tileCaps';
import { COMBO_TILE_TYPE, MAX_COMBO_PARTS, comboLabel, comboSentence, type ComboRule } from '@/lib/combo';
import { clogTileTitle } from '@/lib/clogTileWords';
import {
  RAID_OPTIONS,
  TRIAL_COURSE_OPTIONS,
  TRIAL_RANK_OPTIONS_UI,
  defaultRaidSelection,
  howItCountsLine,
  raidModeKey,
  raidTileConfig,
  raidTitle,
  trialTileConfig,
  BOSS_FAMILIES,
  familyFor,
  killPicksConfig,
  type CountEngine,
  type RaidId,
  type RaidSelection,
} from '@/lib/tileCreatorConfig';

// ─── Types ───────────────────────────────────────────────────────────────────────────────────

export type BrowseCategory = 'bosses' | 'items' | 'clog' | 'skilling' | 'courses' | 'xp' | 'achievements' | 'challenges' | 'other';

/** Which screen finishes this candidate: most go straight to the one-sentence confirm. */
export type CreatorFlow = 'confirm' | 'raids' | 'trials' | 'items' | 'courses' | 'clog';

export type CandidateSource =
  | 'library' | 'boss' | 'activity' | 'skill' | 'counter' | 'raid' | 'lap' | 'trial'
  | 'diary' | 'ca' | 'timed' | 'deathless' | 'lms' | 'pvp' | 'value' | 'gain' | 'drop' | 'clog' | 'clogtile' | 'monster' | 'combo';

export interface TaskCandidate {
  key: string;
  source: CandidateSource;
  /** Short kind badge ("Counter", "Raids", "Items"). */
  badge: string;
  /** What the tile will be called at the current amount. */
  title: string;
  /** The tile title with `{n}` where the amount goes — the confirm step re-titles off it. */
  titleTemplate: string;
  /** Title to use when the amount is exactly 1, if it reads differently ("Abyssal needle"). */
  titleOne?: string;
  /** How it counts, one line. */
  hint: string;
  engine: CountEngine;
  /** The sentence: "Players must <verb> <n> <noun>". */
  verb: string;
  noun: string;
  /** Which config field the amount writes to; null = the task has no amount to set. */
  amountField: 'statGoal' | 'requiredAmount' | null;
  amount: number | null;
  config: Partial<TileConfig>;
  flow: CreatorFlow;
  /** What a purpose-built screen starts from. */
  seed?: {
    raids?: RaidSelection;
    trial?: { course: string | null; rank: string | null };
    items?: { id: number; name: string }[];
    how?: 'gain' | 'drop';
    courses?: string[];
    /** A collection-log tile's picks (lib/clogTiles). */
    clog?: { mode: 'slots' | 'complete'; pages: string[]; itemIds: number[] };
  };
  category: BrowseCategory;
  score: number;
  /** Covers what was typed well enough to add without a second look. */
  confident: boolean;
  /** Matched only after correcting a typo in what was typed ("zulrha" → zulrah). */
  fuzzy?: boolean;
  /** Library tasks carry their own points and tags. */
  points?: number | null;
  tileCategory?: string | null;
  /** A combo (lib/combo): each part as the candidate it was matched from, so a part can be edited or dropped. */
  comboParts?: TaskCandidate[];
}

export interface MatchItem {
  id: number;
  name: string;
}

export interface MatchContext {
  /** The item catalogue to match item names against (server-side: the merged mapping). */
  items?: MatchItem[];
  /** True when the item is on a MONSTER's drop table (so "a monster drops it" is the likely read). */
  itemIsMonsterDrop?: (id: number) => boolean;
  /** The clan's task library (and starter tasks), already resolved to editor fields. */
  library?: { key: string; label: string; category: string | null; points: number | null; config: Partial<TileConfig> }[];
  /** Collection-log pages, for "any GOTR reward" style tasks. */
  clogPages?: { name: string; items: MatchItem[] }[];
  /** Monster names (the wiki's monster list), for plugin kill tiles on ordinary monsters. */
  monsters?: string[];
  /** In-game counters (defaults to COUNTER_TARGETS) — injectable so tests can add new ones. */
  counters?: { name: string; group: string; note: string }[];
}

// ─── Query parsing ───────────────────────────────────────────────────────────────────────────

// Words that carry no meaning about WHICH task: verbs, connectives, filler. Content words that also
// name things ("win", "floor", "xp", "laps") are deliberately absent.
const STOP = new Set([
  'a', 'an', 'the', 'of', 'in', 'at', 'on', 'from', 'for', 'to', 'and', 'or', 'with', 'by', 'any', 'x',
  'time', 'times', 'complete', 'completed', 'completion', 'completions', 'harvest', 'harvested', 'earn',
  'earned', 'get', 'gets', 'got', 'obtain', 'obtained', 'collect', 'collected', 'do', 'done', 'total',
  'each', 'per', 'during', 'event', 'clear', 'clears', 'cleared', 'kill', 'kills', 'killed', 'kc', 'tile',
  'tiles', 'player', 'players', 'team', 'must', 'gained', 'gain', 'receive', 'received', 'some', 'make',
  'made', 'finish', 'finished', 'achieve', 'achieved', 'reach', 'reached', 'is', 'be', 'are', 'your',
  'their', 'one', 'run', 'runs', 'mode', 'no', 'not', 'without', 'excluding', 'except', 'only', 'count',
  'counts', 'ever', 'all', 'new', 'normal', 'entry', 'level', 'lvl',
]);

/** Lowercase, strip punctuation, crude singular. Short words (cox, tob, gp) are left alone. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']/g, '');
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(w)) return w;
  if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) w = w.slice(0, -1);
  return w;
}

const words = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Meaningful stemmed tokens of a phrase (stop words dropped). */
export function tokens(s: string): string[] {
  return words(s).filter((w) => !STOP.has(w)).map(stem);
}

const AMOUNT_RE = /^(\d+(?:[.,]\d+)?)\s*([km])?$/i;
function readAmount(tok: string, suffix?: string): number | null {
  // "1,000" is a thousand, not one-point-zero.
  const raw = /^\d{1,3}(,\d{3})+$/.test(tok) ? tok.replace(/,/g, '') : tok;
  const m = AMOUNT_RE.exec(raw + (suffix ?? ''));
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  const mult = m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2]?.toLowerCase() === 'k' ? 1_000 : 1;
  const v = Math.round(n * mult);
  return v > 0 ? v : null;
}

export interface ParsedQuery {
  /** The amount typed before or after the task ("150 herbi", "zulrah x100"). */
  amount: number | null;
  /** The query with the amount removed. */
  text: string;
  /** Meaningful tokens of `text`. */
  tokens: string[];
  /** Every stemmed word of `text`, stop words included (for phrase checks like "no entry"). */
  all: string[];
  /** A time cap, when the task says "sub 30" / "under 1:20:00". */
  timeCapSeconds: number | null;
}

function parseClock(s: string): number | null {
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** Split an amount and a time cap off what was typed. */
// OSRS shorthand the hiscores data doesn't carry as an alias, expanded before anything else reads
// the query. Whole words only; "cg", "hmt", "dks", "gotr", "wt", "sire", "hydra" already match.
const SHORTHANDS: Record<string, string> = {
  nm: 'nightmare',
  pnm: 'phosanis nightmare',
  kq: 'kalphite queen',
  kbd: 'king black dragon',
  vork: 'vorkath',
  muspah: 'phantom muspah',
  tempo: 'tempoross',
  dwh: 'dragon warhammer',
  ele: 'elemental',
  clogs: 'clog',
  mlm: 'motherlode mine',
  gf: 'giants foundry',
  herbi: 'herbiboar',
  herbis: 'herbiboars',
  sepulcher: 'sepulchre',
  rumor: 'rumour',
  rumors: 'rumours',
  coxcm: 'cox cm',
  tobhm: 'tob hm',
  toaexpert: 'toa expert',
  cms: 'cox cm',
  // Item shorthand clans write in their lists. "zenytes" (plural) are the shards that drop; a lone
  // "zenyte" stays ambiguous with the cut gem, so only the plural is expanded.
  zenytes: 'zenyte shards',
  tbow: 'twisted bow',
  bowfa: 'bow of faerdhinen',
  zcb: 'zaryte crossbow',
  acb: 'armadyl crossbow',
  dhcb: 'dragon hunter crossbow',
  dhl: 'dragon hunter lance',
  bgs: 'bandos godsword',
  ags: 'armadyl godsword',
  sgs: 'saradomin godsword',
  zgs: 'zamorak godsword',
  sang: 'sanguinesti staff',
  dpick: 'dragon pickaxe',
};

// Names a clan uses for ONE item only when the word is the whole task ("Scythe", "Shadow") — inside a
// longer name ("Tumeken's shadow", "Scythe of vitur") they are left alone.
const WHOLE_ALIASES: Record<string, string> = {
  scythe: 'scythe of vitur',
  scythes: 'scythe of vitur',
  shadow: "tumeken's shadow",
  shadows: "tumeken's shadow",
  rapier: 'ghrazi rapier',
  fang: "osmumten's fang",
  lance: 'dragon hunter lance',
};

export function expandShorthands(text: string): string {
  return text.replace(/[A-Za-z’']+/g, (w) => SHORTHANDS[w.toLowerCase().replace(/[’']/g, '')] ?? w);
}

export function parseTaskQuery(query: string): ParsedQuery {
  let text = expandShorthands(query.trim().replace(/\s+/g, ' '));
  let timeCapSeconds: number | null = null;
  // "sub 30", "sub-25 min", "under 1:20:00", "in under 45 minutes"
  const cap = /\b(?:sub|under|below|in under|faster than)\s*-?\s*(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?)\s*(m|min|mins|minutes|s|sec|secs|seconds|h|hr|hrs|hours)?\b/i.exec(text);
  if (cap) {
    const raw = cap[1];
    const unit = (cap[2] ?? 'm').toLowerCase();
    timeCapSeconds = raw.includes(':')
      ? parseClock(raw)
      : Math.round(parseFloat(raw) * (unit.startsWith('h') ? 3600 : unit.startsWith('s') ? 1 : 60));
    text = (text.slice(0, cap.index) + text.slice(cap.index + cap[0].length)).trim();
  }
  let amount: number | null = null;
  const lead = /^(\d{1,3}(?:,\d{3})+|\d+(?:[.,]\d+)?)\s*([km])?\s*[x×]?\s+(?=\D)/i.exec(text);
  if (lead) {
    amount = readAmount(lead[1], lead[2]);
    text = text.slice(lead[0].length).trim();
  } else {
    // A trailing number is the amount too — unless it is part of a name ("floor 5", "top 3").
    const trail = /(?:^|\s)[x×]?\s*(\d+(?:[.,]\d+)?)\s*([km])?\s*[x×]?$/i.exec(text);
    if (trail) {
      const before = text.slice(0, trail.index).trim().toLowerCase();
      if (!/(floor|top|tier|level|lvl|wave|raid level|invocation)$/.test(before) && before.length > 0) {
        amount = readAmount(trail[1], trail[2]);
        text = before.length ? text.slice(0, trail.index).trim() : text;
      }
    }
  }
  text = WHOLE_ALIASES[text.toLowerCase().replace(/^(?:an?|the)\s+/, '')] ?? text;
  return {
    amount,
    text,
    tokens: tokens(text),
    all: words(text).map(stem),
    timeCapSeconds,
  };
}

// A points figure: "500", "1.5k", "1,000".
const PTS_NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?`;
const PTS_WORD = String.raw`(?:points?|pts?|p)`;
// …at the end: "– 20 pts", "(15 points)", "for 500 points", "500p", "points: 500".
const PTS_END = new RegExp(String.raw`\s*(?:[-–—:|(,]\s*)?(?:for\s+)?(?:${PTS_NUM}\s*${PTS_WORD}|points?\s*[:=]\s*${PTS_NUM})\s*\)?\.?\s*$`, 'i');
// …at the start: "500 points: 2 zenytes", "(500 pts) 2 zenytes", "points: 500 - 2 zenytes".
const PTS_START = new RegExp(String.raw`^\s*\(?\s*(?:for\s+)?(?:${PTS_NUM}\s*${PTS_WORD}|points?\s*[:=]\s*${PTS_NUM})\s*\)?\s*[-–—:|,]?\s+(?=\S)`, 'i');
// Counters whose own name ends in "points" ("Vale research points"): "Vale research 250 points" is
// that counter, not a points figure.
const POINTS_COUNTERS = COUNTER_TARGETS.filter((c) => /\bpoints?$/i.test(c.name)).map((c) => tokens(c.name.replace(/\s*points?$/i, '')));

function readPoints(num: string | undefined, k: string | undefined): number | null {
  if (!num) return null;
  const n = parseFloat(num.replace(/,/g, '')) * (k ? 1000 : 1);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n) : null;
}

/**
 * A line's POINTS, at its start or end, and the task text without them: "2 zenytes 500 points" → 2
 * Zenyte shards worth 500. Points are never the task's amount. Accepts "500 points", "500 pts",
 * "500pts", "500 pt", "500p", "(500 points)", "- 500 points", "for 500 points", "points: 500", "1.5k
 * points". A bare number before a counter's own "points" ("250 Tithe Farm points") is left alone.
 */
export function parseBulkLine(line: string): { text: string; points: number | null } {
  const trimmed = line.trim();
  const end = PTS_END.exec(trimmed);
  if (end && end.index > 0) {
    const text = trimmed.slice(0, end.index).trim().replace(/[-–—:|,(]\s*$/, '').trim();
    const pts = readPoints(end[1] ?? end[3], end[2] ?? end[4]);
    const sep = /^\s*[-–—:|(,]|^\s*for\b|points?\s*[:=]/i.test(end[0]);
    // "Vale research 250 points" — the counter's own unit, not a points figure.
    const counterUnit = !sep && /points?\)?\.?\s*$/i.test(end[0]) && POINTS_COUNTERS.some((ct) => ct.length > 0 && ct.every((t) => tokens(text).includes(t)));
    if (pts != null && text && !counterUnit) return { text, points: pts };
  }
  const start = PTS_START.exec(trimmed);
  if (start) {
    const pts = readPoints(start[1] ?? start[3], start[2] ?? start[4]);
    const text = trimmed.slice(start[0].length).trim();
    if (pts != null && text) return { text, points: pts };
  }
  return { text: trimmed, points: null };
}

// ─── Scoring ─────────────────────────────────────────────────────────────────────────────────

interface Named {
  /** Primary names: covering one fully is a strong match. */
  names: string[];
  /** Weaker search terms (aliases, nicknames). */
  aliases?: string[];
}

interface Score {
  score: number;
  coverage: number;
  nameCovered: boolean;
  acronym: boolean;
  confident: boolean;
  matched: boolean;
}

const acronymOf = (name: string) => words(name).map((w) => w[0]).join('');

function tokMatch(q: string, c: string): boolean {
  if (q === c) return true;
  // Typing the start of a word finds it ("herbi" → herbiboar); not the other way round.
  // Four letters at least: "cow" is not the start of "cowhide" in anyone's head.
  return q.length >= 4 && c.startsWith(q);
}

function containsRun(hay: string[], run: string[]): boolean {
  if (run.length === 0 || run.length > hay.length) return false;
  for (let i = 0; i + run.length <= hay.length; i++) {
    if (run.every((r, j) => tokMatch(hay[i + j], r))) return true;
  }
  return false;
}

function scoreNamed(q: ParsedQuery, entry: Named): Score {
  const qt = q.tokens;
  const none: Score = { score: 0, coverage: 0, nameCovered: false, acronym: false, confident: false, matched: false };
  if (qt.length === 0) return none;
  let best = none;
  for (const name of entry.names) {
    const nt = tokens(name);
    if (nt.length === 0) continue;
    const acr = words(name).length >= 3 ? acronymOf(name) : '';
    const aliasToks = (entry.aliases ?? []).flatMap(tokens);
    let weight = 0;
    let acronym = false;
    for (const t of qt) {
      if (nt.some((c) => tokMatch(t, c))) weight += 1;
      else if (acr && t === acr) {
        weight += 1;
        acronym = true;
      } else if (aliasToks.some((c) => tokMatch(t, c))) weight += 0.8;
    }
    const coverage = weight / qt.length;
    const nameCovered = acronym || nt.every((c) => qt.some((t) => tokMatch(t, c)));
    const contiguous = nt.length >= 2 && containsRun(qt, nt);
    const missingName = nt.filter((c) => !qt.some((t) => tokMatch(t, c))).length;
    const score = coverage * 10 + (nameCovered ? 2 : 0) + (contiguous ? 1.5 : 0) - missingName * 0.4;
    const confident = coverage >= 0.6 || (contiguous && nameCovered);
    const matched = weight > 0 && (coverage >= 0.5 || acronym || nameCovered);
    if (score > best.score) best = { score, coverage, nameCovered, acronym, confident, matched };
  }
  return best;
}

// ─── Building candidates ─────────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-US');
function shortNumber(n: number): string {
  if (n >= 1_000_000 && n % 100_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 10_000 && n % 1_000 === 0) return `${n / 1_000}k`;
  return fmt(n);
}

/** The candidate's title at an amount. */
export function titleAt(c: Pick<TaskCandidate, 'titleTemplate' | 'titleOne' | 'amountField'>, n: number | null): string {
  if (c.amountField == null || n == null) return c.titleTemplate.replace('{n} ', '').replace('{n}', '');
  if (n === 1 && c.titleOne) return c.titleOne;
  return c.titleTemplate.replace('{n}', c.amountField === 'statGoal' && n >= 10_000 ? shortNumber(n) : fmt(n));
}

/** The same candidate at a new amount — the config field and title follow. */
export function applyAmount(c: TaskCandidate, n: number | null): TaskCandidate {
  if (c.amountField == null) return c;
  const config = { ...c.config, [c.amountField]: n };
  return { ...c, amount: n, config, title: titleAt(c, n) };
}

type Draft = Omit<TaskCandidate, 'title' | 'hint' | 'engine' | 'score' | 'confident' | 'amount'> & { defaultAmount: number | null };

function finish(d: Draft, q: ParsedQuery | null, s: Score | null): TaskCandidate {
  const amount = d.amountField ? q?.amount ?? d.defaultAmount : null;
  const config = d.amountField && amount != null ? { ...d.config, [d.amountField]: amount } : d.config;
  const how = howItCountsLine(config);
  const { defaultAmount: _a, names: _n, aliases: _al, ...rest } = d as Draft & Partial<Named>;
  void _a; void _n; void _al;
  return {
    ...rest,
    amount,
    config,
    title: titleAt(d, amount),
    hint: how.text,
    engine: how.engine,
    score: s?.score ?? 0,
    confident: s?.confident ?? false,
  };
}

// Raid boss keys are offered through the raid picker (modes as toggles), not one hiscores row each.
const RAID_KEYS = new Set([
  'chambersOfXeric', 'chambersOfXericChallengeMode', 'theatreOfBlood', 'theatreOfBloodHardMode',
  'tombsOfAmascut', 'tombsOfAmascutExpertMode', 'fracturedArchive',
]);

// A boss's nickname that no other boss shares ("cg", "vork", "kq") names it as surely as its label.
const BOSS_ALIAS_COUNT = (() => {
  const m = new Map<string, number>();
  for (const b of BOSSES) for (const a of b.aliases ?? []) m.set(a, (m.get(a) ?? 0) + 1);
  return m;
})();

function bossDrafts(): (Draft & Named)[] {
  return BOSSES.filter((b) => !RAID_KEYS.has(b.key)).map((b) => {
    const choice = chooseKillSource([b.key]);
    const config: Partial<TileConfig> = choice.ok && choice.source === 'hiscores'
      ? { tileType: 'standard', statType: 'boss', trackedStat: choice.trackedStat, statBasis: 'gain' }
      : { tileType: 'kill', targetNpcs: choice.ok && choice.source === 'plugin' ? choice.targetNpcs : [b.label] };
    return {
      key: `boss-${b.key}`,
      source: 'boss',
      badge: 'Kills',
      names: [b.label, ...(b.aliases ?? []).filter((x) => BOSS_ALIAS_COUNT.get(x) === 1)],
      aliases: (b.aliases ?? []).filter((x) => BOSS_ALIAS_COUNT.get(x) !== 1),
      titleTemplate: `{n} ${b.label} kills`,
      verb: 'Kill',
      noun: `${b.label}`,
      amountField: config.statType ? 'statGoal' : 'requiredAmount',
      defaultAmount: 25,
      config,
      flow: 'confirm',
      category: 'bosses',
    } satisfies Draft & Named;
  });
}

// ─── Several bosses on one tile ──────────────────────────────────────────────────────────────

/**
 * The candidate for kills of several bosses / monsters / counters counted together. Picks are
 * hiscores keys or count-line names; lib/killSource picks the engine (all on the hiscores → one
 * stat tile whose keys SUM; anything off them → a plugin tile listing every name).
 */
export function killCandidate(given: string[], amount: number | null, extra: Partial<TaskCandidate> = {}): TaskCandidate | null {
  // A known family keeps its own member order, so "artio + callisto" and "callisto or artio" are
  // the same stored tile.
  const family = familyFor(given);
  const picks = family ? family.members : given;
  const res = killPicksConfig(picks, amount);
  if (!res.ok) return null;
  const n = amount && amount > 0 ? amount : 1;
  const how = howItCountsLine(res.config);
  const titleTemplate = `{n} ${res.what} kills`;
  return {
    key: family ? `family-${family.key}` : `kills-${picks.join('+')}`,
    source: 'boss',
    badge: 'Kills',
    title: titleAt({ titleTemplate, amountField: 'statGoal' }, n),
    titleTemplate,
    hint: how.text,
    engine: how.engine,
    verb: 'Kill',
    noun: res.what,
    amountField: res.source === 'hiscores' ? 'statGoal' : 'requiredAmount',
    amount: n,
    config: res.config,
    flow: 'confirm',
    category: 'bosses',
    score: 0,
    confident: true,
    ...extra,
  };
}

function familyDrafts(): (Draft & Named)[] {
  return BOSS_FAMILIES.map((f) => {
    const res = killPicksConfig(f.members, null);
    return {
      key: `family-${f.key}`,
      source: 'boss' as const,
      badge: 'Kills',
      names: [f.name, ...f.aliases],
      aliases: [],
      titleTemplate: `{n} ${f.name} kills`,
      verb: 'Kill',
      noun: f.name,
      amountField: (res.source === 'plugin' ? 'requiredAmount' : 'statGoal') as 'statGoal' | 'requiredAmount',
      defaultAmount: 25,
      config: res.config,
      flow: 'confirm' as const,
      category: 'bosses' as const,
    };
  });
}

// Words that say "more than one" — a family beats its namesake boss only when the task says so.
const GROUP_WORDS = ['any', 'all', 'both', 'either', 'or', 'and', 'mode', 'modes', 'boss', 'bosses', 'variant', 'variants', 'awakened'];

/**
 * Bosses named separately in one task ("phosani and normal nightmare", "gauntlet or cg"). Each boss
 * claims the words of its own name (longest names first, so "Phosani's Nightmare" takes both its
 * words before plain "Nightmare" can), plus any alias only it carries.
 */
function mentionedBosses(q: ParsedQuery): { keys: string[]; used: number } {
  const all = q.all;
  const taken = new Array(all.length).fill(false);
  const aliasOwners = new Map<string, number>();
  for (const b of BOSSES) for (const a of b.aliases ?? []) aliasOwners.set(a, (aliasOwners.get(a) ?? 0) + 1);
  const phrases: { key: string; toks: string[] }[] = [];
  for (const b of BOSSES) {
    if (RAID_KEYS.has(b.key)) continue;
    phrases.push({ key: b.key, toks: words(b.label).filter((w) => w !== 'the').map(stem) });
    for (const a of b.aliases ?? []) if (aliasOwners.get(a) === 1) phrases.push({ key: b.key, toks: words(a).map(stem) });
  }
  for (const c of COUNTER_TARGETS.filter((t) => t.group === 'Combat')) phrases.push({ key: c.name, toks: words(c.name).map(stem) });
  phrases.sort((a, b) => b.toks.length - a.toks.length);
  const keys: string[] = [];
  for (const p of phrases) {
    if (p.toks.length === 0 || keys.includes(p.key)) continue;
    for (let i = 0; i + p.toks.length <= all.length; i++) {
      if (p.toks.every((t, j) => !taken[i + j] && tokMatch(all[i + j], t))) {
        for (let j = 0; j < p.toks.length; j++) taken[i + j] = true;
        keys.push(p.key);
        break;
      }
    }
  }
  return { keys, used: all.filter((w, i) => taken[i] && !STOP.has(w)).length };
}

function multiBossCandidate(q: ParsedQuery): TaskCandidate | null {
  const { keys, used } = mentionedBosses(q);
  if (keys.length < 2) return null;
  const meaningful = q.all.filter((w) => !STOP.has(w) && !GROUP_WORDS.includes(w)).length;
  const coverage = meaningful ? used / meaningful : 0;
  const c = killCandidate(keys, q.amount ?? 25);
  if (!c) return null;
  return { ...c, score: coverage * 10 + 4.5, confident: coverage >= 0.6 };
}

function activityDrafts(): (Draft & Named)[] {
  return HISCORES_ACTIVITIES.filter((a) => a.scale === 'count' && a.group !== 'collection').map((a) => ({
    key: `activity-${a.key}`,
    source: 'activity',
    badge: a.group === 'clues' ? 'Clues' : 'Minigame',
    names: [a.label],
    aliases: a.aliases ?? [],
    titleTemplate: `{n} ${a.label}${a.unit && !a.label.toLowerCase().includes(a.unit) ? ` ${a.unit}` : ''}`,
    verb: a.group === 'clues' ? 'Complete' : 'Get',
    noun: a.unit ? `${a.unit} (${a.label})` : a.label,
    amountField: 'statGoal',
    defaultAmount: a.group === 'clues' ? 10 : 25,
    config: { tileType: 'standard', statType: 'boss', trackedStat: a.key, statBasis: 'gain' },
    flow: 'confirm',
    category: a.group === 'clues' ? 'achievements' : 'skilling',
  }));
}

function skillDrafts(): (Draft & Named)[] {
  return SKILLS.map((s) => {
    const name = s === 'overall' ? 'Total' : SKILL_LABELS[s] ?? s;
    return {
      key: `skill-${s}`,
      source: 'skill',
      badge: 'XP',
      names: [s === 'overall' ? 'total xp' : name],
      aliases: [...(SKILL_ALIASES[s] ?? []), 'xp', 'exp', 'experience', ...(s === 'overall' ? ['overall'] : [])],
      titleTemplate: `{n} ${name} XP`,
      verb: 'Gain',
      noun: `${name} XP`,
      amountField: 'statGoal',
      defaultAmount: 1_000_000,
      config: { tileType: 'standard', statType: 'skill', trackedStat: s, statBasis: 'gain' },
      flow: 'confirm',
      category: 'xp',
    };
  });
}

function counterVerb(c: { name: string; group: string }): string {
  if (c.group === 'Chests') return 'Open';
  if (/herbiboar/i.test(c.name)) return 'Harvest';
  if (/offering/i.test(c.name)) return 'Make';
  if (/challenge|delve|rumour|task|point/i.test(c.name)) return 'Complete';
  if (c.group === 'Combat') return 'Kill';
  return 'Complete';
}

function counterDrafts(ctx: MatchContext): (Draft & Named)[] {
  return (ctx.counters ?? COUNTER_TARGETS).map((c) => ({
    key: `counter-${c.name}`,
    source: 'counter',
    badge: 'Counter',
    names: [c.name],
    aliases: [],
    titleTemplate: `{n} ${c.name}`,
    verb: counterVerb(c),
    noun: c.name,
    amountField: 'requiredAmount',
    defaultAmount: 10,
    config: { tileType: 'kill', targetNpcs: [c.name] },
    flow: 'confirm',
    category: c.group === 'Combat' ? 'bosses' : 'skilling',
  }));
}

function lapDrafts(): (Draft & Named)[] {
  const courses = AGILITY_COURSES.map((c) => ({
    key: `lap-${c.name}`,
    source: 'lap' as const,
    badge: 'Laps',
    names: [c.label, c.name],
    aliases: ['agility', 'lap', 'course'],
    titleTemplate: `{n} ${c.label} laps`,
    verb: 'Run',
    noun: `${c.label} laps`,
    amountField: 'requiredAmount' as const,
    defaultAmount: 50,
    config: { tileType: 'lap', targetNpcs: [c.name] } as Partial<TileConfig>,
    flow: 'confirm' as const,
    category: 'courses' as const,
  }));
  const sep = SEPULCHRE_TARGETS.map((t) => ({
    key: `lap-${t.name}`,
    source: 'lap' as const,
    badge: 'Sepulchre',
    names: [t.name, ...(t.name.startsWith('Hallowed Sepulchre Floor') ? [`sepulchre ${t.label}`] : t.label === 'Any floor' ? ['sepulchre floors'] : [])],
    aliases: ['sepulchre', 'hallowed', 'floor', 'agility'],
    titleTemplate: t.unit === 'run' ? '{n} Sepulchre full runs' : t.label === 'Any floor' ? '{n} Sepulchre floors' : `{n} Sepulchre ${t.label} clears`,
    verb: t.unit === 'run' ? 'Finish' : 'Clear',
    noun: t.unit === 'run' ? 'full Sepulchre runs' : t.label === 'Any floor' ? 'Sepulchre floors' : `${t.label} clears`,
    amountField: 'requiredAmount' as const,
    defaultAmount: t.unit === 'run' ? 5 : 20,
    config: { tileType: 'lap', targetNpcs: [t.name] } as Partial<TileConfig>,
    flow: 'confirm' as const,
    category: 'courses' as const,
  }));
  return [...courses, ...sep];
}

function diaryDrafts(): (Draft & Named)[] {
  const out: (Draft & Named)[] = [];
  const tiers = ['Any', ...DIARY_TIERS];
  for (const area of ['Any', ...DIARY_AREAS]) {
    for (const tier of tiers) {
      if (area === 'Any' && tier === 'Any') continue;
      const sel = `${area} ${tier}`;
      const label = area === 'Any' ? `Any ${tier} diary` : tier === 'Any' ? `Any ${area} diary` : `${area} ${tier} diary`;
      out.push({
        key: `diary-${sel}`,
        source: 'diary',
        badge: 'Diary',
        names: [label.replace(/^Any /, '')],
        aliases: ['diary', 'diaries', 'achievement'],
        titleTemplate: `{n} × ${label}`,
        titleOne: label,
        verb: 'Complete',
        noun: label,
        amountField: 'requiredAmount',
        defaultAmount: 1,
        config: { tileType: 'diary', targetNpcs: [sel] },
        flow: 'confirm',
        category: 'achievements',
      });
    }
  }
  return out;
}

function caDrafts(): (Draft & Named)[] {
  return CA_TIERS.map((tier) => ({
    key: `ca-${tier}`,
    source: 'ca',
    badge: 'Combat task',
    names: [`${tier} combat task`, `${tier} ca`],
    aliases: ['combat', 'task', 'achievement', 'ca', ...(tier === 'Grandmaster' ? ['gm'] : [])],
    titleTemplate: `{n} ${tier} combat tasks`,
    titleOne: `Any ${tier} combat task`,
    verb: 'Complete',
    noun: `${tier} combat tasks`,
    amountField: 'requiredAmount',
    defaultAmount: 1,
    config: { tileType: 'ca', targetNpcs: [`Any ${tier}`] },
    flow: 'confirm',
    category: 'achievements',
  }));
}

const TIMED_ACTIVITIES = ['Inferno', 'Fight Caves', 'Fortis Colosseum', 'Hallowed Sepulchre', 'TzHaar-Ket-Rak', ...RAID_MODE_VARIANTS.flatMap((r) => [r.base, ...r.modes])];

function clockLabel(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function challengeDrafts(q: ParsedQuery | null): (Draft & Named)[] {
  const out: (Draft & Named)[] = [];
  const cap = q?.timeCapSeconds ?? null;
  for (const a of TIMED_ACTIVITIES) {
    out.push({
      key: `timed-${a}`,
      source: 'timed',
      badge: 'Speed',
      names: [a],
      aliases: ['speed', 'speedrun', 'time', 'timed', 'pb', 'sub', 'under', 'fast'],
      titleTemplate: cap ? `Sub-${clockLabel(cap)} ${a}` : `Fast ${a}`,
      verb: 'Finish',
      noun: cap ? `${a} in under ${clockLabel(cap)}` : `${a} under a time cap`,
      amountField: null,
      defaultAmount: null,
      config: { tileType: 'timed', timedActivity: a, timeThresholdSeconds: cap },
      flow: 'confirm',
      category: 'challenges',
    });
  }
  // Every raid the full editor offers for deathless, TFA included (its picker lists
  // RAID_MODE_VARIANTS whole). The short names ("tfa", "cox") let "deathless tfa" find its raid.
  for (const r of RAID_MODE_VARIANTS) {
    const raidId = RAID_OPTIONS.find((o) => o.modes.some((m) => m.name === r.base))?.id;
    out.push({
      key: `deathless-${r.base}`,
      source: 'deathless',
      badge: 'Deathless',
      names: [`deathless ${r.base}`],
      aliases: ['deathless', 'flawless', 'death', 'deaths', 'die', 'zero', 'raid', ...(raidId ? RAID_TOKENS[raidId] : [])],
      titleTemplate: `{n} deathless ${r.base}`,
      titleOne: `Deathless ${r.base}`,
      verb: 'Finish',
      noun: `${r.base} with no deaths`,
      amountField: 'requiredAmount',
      defaultAmount: 1,
      config: { tileType: 'deathless', timedActivity: r.base },
      flow: 'confirm',
      category: 'challenges',
    });
  }
  out.push({
    key: 'lms-win',
    source: 'lms',
    badge: 'LMS',
    names: ['lms win', 'last man standing win', 'win lms'],
    aliases: ['lms', 'last', 'man', 'standing', 'win', 'wins', 'top'],
    titleTemplate: '{n} LMS wins',
    titleOne: 'Win a game of LMS',
    verb: 'Win',
    noun: 'games of Last Man Standing',
    amountField: 'requiredAmount',
    defaultAmount: 1,
    config: { tileType: 'lms', timeThresholdSeconds: 1 },
    flow: 'confirm',
    category: 'challenges',
  });
  const top = q?.all.join(' ').match(/\btop (\d)\b/);
  if (top) {
    const n = parseInt(top[1], 10);
    out.push({
      key: `lms-top-${n}`,
      source: 'lms',
      badge: 'LMS',
      names: [`lms top ${n}`, `last man standing top ${n}`],
      aliases: ['lms', 'top', 'placement'],
      titleTemplate: `{n} LMS top-${n} finishes`,
      titleOne: `Top ${n} in LMS`,
      verb: 'Place',
      noun: `top ${n} in Last Man Standing`,
      amountField: 'requiredAmount',
      defaultAmount: 1,
      config: { tileType: 'lms', timeThresholdSeconds: n },
      flow: 'confirm',
      category: 'challenges',
    });
  }
  out.push({
    key: 'pvp-rival',
    source: 'pvp',
    badge: 'PvP',
    names: ['pvp kill', 'player kill', 'pk'],
    aliases: ['pvp', 'pk', 'pking', 'wilderness', 'wildy', 'player'],
    titleTemplate: '{n} PvP kills',
    titleOne: 'Get a PvP kill',
    verb: 'Kill',
    noun: 'rival players in PvP',
    amountField: 'requiredAmount',
    defaultAmount: 1,
    config: { tileType: 'pvp', targetNpcs: ['team:other'] },
    flow: 'confirm',
    category: 'challenges',
  });
  out.push({
    key: 'value-single',
    source: 'value',
    badge: 'Loot value',
    names: ['loot worth', 'drop worth', 'loot value'],
    aliases: ['loot', 'value', 'gp', 'worth', 'haul', 'coins'],
    titleTemplate: '{n} gp loot',
    verb: 'Get one haul worth',
    noun: 'gp',
    amountField: 'requiredAmount',
    defaultAmount: 5_000_000,
    config: { tileType: 'value' },
    flow: 'confirm',
    category: 'challenges',
  });
  return out;
}

// ─── Raids and trials: parsed, not catalogued ────────────────────────────────────────────────

const RAID_TOKENS: Record<RaidId, string[]> = {
  cox: ['cox', 'chamber', 'xeric', 'olm'],
  tob: ['tob', 'theatre', 'theater', 'blood'],
  toa: ['toa', 'tomb', 'amascut'],
  tfa: ['tfa', 'fractured', 'archive'],
};
const MODE_TOKENS: Record<string, string[]> = {
  cm: ['cm', 'challenge', 'cmode'],
  hard: ['hm', 'hard', 'hmt'],
  expert: ['expert', 'exp'],
};

function raidCandidate(q: ParsedQuery): TaskCandidate | null {
  const all = q.all;
  const has = (t: string) => all.includes(t);
  let raids = (Object.keys(RAID_TOKENS) as RaidId[]).filter((r) => RAID_TOKENS[r].some(has));
  const raidWord = has('raid');
  if (raids.length === 0 && raidWord) raids = RAID_OPTIONS.map((r) => r.id);
  // "hmt" only ever means Theatre of Blood.
  if (raids.length === 0 && has('hmt')) raids = ['tob'];
  if (raids.length === 0) return null;
  // Deathless / speed tasks name a raid too — those belong to their own kinds.
  if (['deathless', 'flawless', 'death', 'speed', 'speedrun'].some(has) || q.timeCapSeconds != null) return null;
  const joined = ` ${all.join(' ')} `;
  const entryNegated = /\b(no|not|without|excluding|except|exclude|non)\s+entry\b/.test(joined) || /\bentry\s+(excluded|not)\b/.test(joined);
  const entryWanted = has('entry') && !entryNegated;
  const sel: RaidSelection = {};
  for (const raid of RAID_OPTIONS) {
    if (!raids.includes(raid.id)) continue;
    const named = raid.modes.filter((m) => MODE_TOKENS[m.id]?.some(has));
    const normalNamed = has('normal') || has('regular');
    if (named.length > 0 || normalNamed || (entryWanted && joined.includes(' only '))) {
      for (const m of named) sel[raidModeKey(raid.id, m.id)] = true;
      if (normalNamed) sel[raidModeKey(raid.id, 'normal')] = true;
      if (entryWanted && raid.modes.some((m) => m.id === 'entry')) sel[raidModeKey(raid.id, 'entry')] = true;
    } else {
      Object.assign(sel, defaultRaidSelection([raid.id], entryWanted));
    }
  }
  const n = q.amount ?? 1;
  const res = raidTileConfig(sel, n);
  if (!res.ok) return null;
  // Coverage: how much of what was typed the raid parse accounted for.
  const known = new Set([
    ...Object.values(RAID_TOKENS).flat(), ...Object.values(MODE_TOKENS).flat(),
    'raid', 'entry', 'normal', 'regular', 'mode', 'no', 'not', 'without', 'excluding', 'except',
  ]);
  const meaningful = all.filter((w) => !STOP.has(w) || known.has(w));
  const covered = meaningful.filter((w) => known.has(w)).length;
  const coverage = meaningful.length ? covered / meaningful.length : 0;
  const how = howItCountsLine(res.config);
  return {
    key: `raid-${Object.keys(sel).sort().join('+')}`,
    source: 'raid',
    badge: 'Raids',
    title: res.title,
    titleTemplate: raidTitle(sel, 2).replace(/^2 /, '{n} '),
    titleOne: raidTitle(sel, 1),
    hint: how.text,
    engine: how.engine,
    verb: 'Clear',
    noun: 'raids',
    amountField: res.source === 'hiscores' ? 'statGoal' : 'requiredAmount',
    amount: n,
    config: res.config,
    flow: 'raids',
    seed: { raids: sel },
    category: 'bosses',
    score: coverage * 10 + 3,
    confident: coverage >= 0.6,
  };
}

const COURSE_TOKENS: Record<string, string[]> = {
  'tempor tantrum': ['tempor', 'tantrum'],
  'jubbly jive': ['jubbly', 'jive'],
  'gwenith glide': ['gwenith', 'glide'],
};

function trialCandidates(q: ParsedQuery): TaskCandidate[] {
  const has = (t: string) => q.all.includes(t);
  const courses = Object.keys(COURSE_TOKENS).filter((c) => COURSE_TOKENS[c].some(has));
  const rank = TRIAL_RANK_OPTIONS_UI.find((r) => has(r.id))?.id ?? null;
  const trialWord = has('barracuda') || has('trial');
  if (courses.length === 0 && !trialWord) return [];
  const known = new Set(['barracuda', 'trial', 'sailing', 'rank', 'swordfish', 'shark', 'marlin', ...Object.values(COURSE_TOKENS).flat()]);
  const meaningful = q.tokens;
  const coverage = meaningful.length ? meaningful.filter((w) => known.has(w)).length / meaningful.length : 0;
  const n = q.amount ?? 1;
  const out: TaskCandidate[] = [];
  const list = courses.length > 0 ? courses : [null];
  for (const course of list) {
    const label = course ? TRIAL_COURSE_OPTIONS.find((c) => c.id === course)!.label.replace(/^The /, '') : 'Barracuda Trials';
    const config = course && rank ? trialTileConfig(course, rank, n) : null;
    const rankLabel = rank ? TRIAL_RANK_OPTIONS_UI.find((r) => r.id === rank)!.label : null;
    const titleTemplate = rankLabel ? `{n} × ${label}, ${rankLabel}` : `{n} × ${label}`;
    const how = howItCountsLine(config ?? { tileType: 'timed', timedActivity: 'x — Marlin' });
    out.push({
      key: `trial-${course ?? 'any'}-${rank ?? 'any'}`,
      source: 'trial',
      badge: 'Trial',
      title: titleAt({ titleTemplate, titleOne: rankLabel ? `${label}, ${rankLabel}` : label, amountField: 'requiredAmount' }, n),
      titleTemplate,
      titleOne: rankLabel ? `${label}, ${rankLabel}` : label,
      hint: how.text,
      engine: how.engine,
      verb: 'Complete',
      noun: rankLabel ? `${label} runs on ${rankLabel}` : `${label} runs`,
      amountField: 'requiredAmount',
      amount: n,
      config: config ?? {},
      flow: 'trials',
      seed: { trial: { course, rank } },
      category: 'courses',
      // A course AND a rank is a finished tile; anything less still needs the trials screen.
      score: coverage * 10 + (config ? 3 : 1),
      confident: !!config && coverage >= 0.6,
    });
  }
  return out;
}

// ─── Items ───────────────────────────────────────────────────────────────────────────────────

function itemCandidates(q: ParsedQuery, ctx: MatchContext): TaskCandidate[] {
  if (!ctx.items || ctx.items.length === 0 || q.tokens.length === 0) return [];
  const hits: { it: MatchItem; s: Score }[] = [];
  const seen = new Set<string>();
  for (const it of ctx.items) {
    // Cheap prefilter: the item must contain at least one query token.
    const lower = it.name.toLowerCase();
    if (!q.tokens.some((t) => lower.includes(t))) continue;
    const s = scoreNamed(q, { names: [it.name] });
    // The whole name, or every typed word plus at most one container word left unsaid
    // ("bloodwood sap" is the Bucket of bloodwood sap).
    const unsaid = tokens(it.name).filter((c) => !q.tokens.some((t) => tokMatch(t, c))).length;
    const allSaid = q.tokens.length >= 2 && s.coverage === 1 && unsaid <= 1;
    if (!s.matched || !(s.nameCovered || allSaid)) continue;
    // "Hallowed mark" and "Hallowed marks" are two catalogue rows for one thing.
    const k = tokens(it.name).join(' ');
    if (seen.has(k)) continue;
    seen.add(k);
    hits.push({ it, s });
  }
  hits.sort((a, b) => b.s.score - a.s.score || a.it.name.length - b.it.name.length);
  const out: TaskCandidate[] = [];
  for (const { it, s: raw } of hits.slice(0, 3)) {
    // An item is more often an accidental match than the task itself ("herbi" is also the pet), so
    // a counter or boss of the same strength wins.
    const s = { ...raw, score: raw.score - 0.5 };
    const monster = ctx.itemIsMonsterDrop?.(it.id) ?? false;
    const base = {
      titleTemplate: `{n} × ${it.name}`,
      titleOne: it.name,
      amountField: 'requiredAmount' as const,
      defaultAmount: 1,
      category: 'items' as const,
      flow: 'items' as const,
      names: [it.name],
    };
    const gain = finish({
      ...base,
      key: `gain-${it.id}`,
      source: 'gain',
      badge: 'Items',
      verb: 'Get',
      noun: `${it.name} (in the inventory)`,
      config: { tileType: 'gain', trackedItemIds: [it.id] },
      seed: { items: [it], how: 'gain' },
    }, q, s);
    const drop = finish({
      ...base,
      key: `drop-${it.id}`,
      source: 'drop',
      badge: 'Drop',
      verb: 'Get',
      noun: `${it.name} as a drop`,
      config: { tileType: 'drop', trackedItemIds: [it.id] },
      seed: { items: [it], how: 'drop' },
    }, q, s);
    // The likely reading first: a monster's drop table says "drop", anything else "it lands in the
    // inventory" (rewards, gathering, minigames). The other stays as an "also matches".
    const [first, second] = monster ? [drop, gain] : [gain, drop];
    out.push(first, { ...second, score: second.score - 1.5, confident: false });
  }
  return out;
}

// ─── Ordinary monsters ───────────────────────────────────────────────────────────────────────

/**
 * "100 cows", "200 abyssal demons": a plugin kill tile on the monster, by its exact name. Only a
 * monster whose whole name was typed counts ("Cow", not "Cow calf"); one that is on the hiscores
 * is left to its boss row, which reads the hiscores as today.
 */
function monsterCandidates(q: ParsedQuery, ctx: MatchContext): TaskCandidate[] {
  if (!ctx.monsters || ctx.monsters.length === 0 || q.tokens.length === 0) return [];
  const hits: { name: string; s: Score; extra: number }[] = [];
  const seen = new Set<string>();
  for (const raw of ctx.monsters) {
    // Wiki disambiguation ("Cow (Lumbridge)") is not part of the name the game reports.
    const name = raw.replace(/\s*\(.*\)\s*$/, '').trim();
    const lower = name.toLowerCase();
    if (!name || !q.tokens.some((t) => lower.includes(t))) continue;
    // "Cow" and "Cows (Lumbridge)" are one monster to whoever types "cows".
    const k = tokens(name).join(' ');
    if (seen.has(k)) continue;
    const s = scoreNamed(q, { names: [name] });
    if (!s.matched || !s.nameCovered) continue;
    seen.add(k);
    if (hiscoresKeyForMonster(name)) continue;
    hits.push({ name, s, extra: tokens(name).length });
  }
  // Best covered first; among equals the shortest name — the plain monster, not a variant.
  hits.sort((a, b) => b.s.score - a.s.score || a.extra - b.extra);
  return hits.slice(0, 2).map(({ name, s }) => {
    const res = chooseKillSource([name]);
    const config: Partial<TileConfig> = { tileType: 'kill', targetNpcs: res.ok && res.source === 'plugin' ? res.targetNpcs : [name] };
    return finish({
      key: `monster-${name}`,
      source: 'monster',
      badge: 'Kills',
      titleTemplate: `{n} ${name} kills`,
      verb: 'Kill',
      noun: name,
      amountField: 'requiredAmount',
      defaultAmount: 50,
      config,
      flow: 'confirm',
      category: 'bosses',
    }, q, s);
  });
}

// A collection-log page is only what the task means when it talks about rewards ("GOTR rare reward",
// "any Barrows unique") — "golden nuggets at Motherlode Mine" names the page but means the nuggets.
const REWARD_WORDS = ['rare', 'reward', 'unique', 'clog', 'collection', 'log', 'pet', 'item', 'drop', 'any'];

function clogCandidates(q: ParsedQuery, ctx: MatchContext): TaskCandidate[] {
  const out: TaskCandidate[] = [];
  if (!REWARD_WORDS.some((w) => q.all.includes(w))) return out;
  for (const page of ctx.clogPages ?? []) {
    const s = scoreNamed(q, { names: [page.name], aliases: ['collection', 'log', 'clog', 'rare', 'reward', 'unique'] });
    // The page's whole name, or every word that isn't a reward word naming it ("any Barrows item" is
    // the Barrows Chests page — nobody says "chests" when they mean its loot).
    const pageToks = tokens(page.name);
    const core = q.tokens.filter((t) => !REWARD_WORDS.includes(t));
    const coreHit = core.length > 0 && core.every((t) => pageToks.some((c) => tokMatch(t, c)));
    if (!s.matched || !(s.nameCovered || coreHit)) continue;
    // "Zulrah pet" is the Zulrah page, not "All Pets": a page that leaves the task's own words unsaid
    // ranks below one that says them.
    const unsaid = core.length > 0 && !coreHit ? 3 : 0;
    // "A GOTR rare reward", "a Vorkath unique", "any Barrows item": the page IS the pool — whatever the
    // collection log lists there, any one of it, as a drop pool (the clog generator's "any N of").
    const ids = page.items.map((i) => i.id);
    out.push(finish({
      key: `clog-${page.name}`,
      source: 'clog',
      badge: 'Drop',
      titleTemplate: `Any ${page.name} collection log item`,
      verb: 'Get',
      noun: `any ${page.name} collection log item`,
      amountField: null,
      defaultAmount: null,
      config: { tileType: 'drop', trackedItemIds: ids, requiredAmount: 1 },
      flow: 'items',
      seed: { items: page.items, how: 'drop' },
      category: 'items',
    }, q, { ...s, confident: false, score: Math.max(s.score, 6) - 0.5 - unsaid }));
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
}

// ─── Collection-log tiles ────────────────────────────────────────────────────────────────────
//
// "10 new clog slots", "3 new barrows clog slots", "new clog slot from dwh, tyrannical ring or chaos
// ele pet", "complete the wintertodt clog page". The pages and items come from ctx.clogPages (the
// server's catalogue) — this module stays dataset-free so the creator can bundle it.

const CLOG_WORDS = new Set(['clog', 'log', 'collection', 'slot', 'page', 'complete', 'finish', 'fill', 'full', 'own', 'new', 'from', 'unique', 'different', 'any', 'the', 'a', 'an', 'of', 'item']);

/** The candidate a collection-log tile becomes — shared by the matcher and the creator's own step. */
export function clogTileCandidate(pick: { mode: 'slots' | 'complete'; pages: string[]; itemIds: number[]; itemNames?: string[] }, amount: number | null): TaskCandidate {
  const { mode, pages, itemIds } = pick;
  const config: Partial<TileConfig> = {
    tileType: 'clog',
    countMode: mode,
    targetNpcs: pages.length > 0 ? pages : null,
    trackedItemIds: itemIds.length > 0 ? itemIds : null,
    requiredAmount: mode === 'slots' ? Math.max(1, amount ?? 1) : null,
  };
  const how = howItCountsLine(config);
  const spec = { mode, pages, itemIds, required: Math.max(1, amount ?? 1) };
  const names = pick.itemNames && pick.itemNames.length > 0 ? pick.itemNames : undefined;
  const titleOne = clogTileTitle({ ...spec, required: 1 }, names);
  const templ = mode === 'slots' ? clogTileTitle({ ...spec, required: 2 }, names).replace(/^2 /, '{n} ') : titleOne;
  return {
    key: `clogtile-${mode}-${pages.join('+')}-${itemIds.length}`,
    source: 'clogtile',
    badge: 'Collection log',
    title: mode === 'slots' ? (spec.required === 1 ? titleOne : templ.replace('{n}', fmt(spec.required))) : titleOne,
    titleTemplate: templ,
    titleOne,
    hint: how.text,
    engine: how.engine,
    verb: mode === 'slots' ? 'Get' : 'Complete',
    noun: mode === 'slots' ? 'new collection log slots' : titleOne.replace(/^Complete /, '').replace(/^Own /, 'own '),
    amountField: mode === 'slots' ? 'requiredAmount' : null,
    amount: mode === 'slots' ? spec.required : null,
    config,
    flow: 'clog',
    seed: { clog: { mode, pages, itemIds } },
    category: 'clog',
    score: 0,
    confident: true,
  };
}

/** One phrase ("chaos ele pet", "tyrannical ring") → the clog item it names, or null. */
function clogItemFor(phrase: string, ctx: MatchContext): { id: number; name: string; page: string } | null {
  const want = tokens(expandShorthands(phrase)).filter((t) => !CLOG_WORDS.has(t) || t === 'pet');
  if (want.length === 0) return null;
  let best: { id: number; name: string; page: string; extra: number } | null = null;
  for (const page of ctx.clogPages ?? []) {
    if (page.name === 'All Pets') continue;
    for (const item of page.items) {
      const have = tokens(item.name);
      if (!want.every((w) => have.some((h) => tokMatch(w, h) || (w.length >= 3 && h.startsWith(w))))) continue;
      const extra = have.length - want.length;
      if (!best || extra < best.extra) best = { id: item.id, name: item.name, page: page.name, extra };
    }
  }
  return best ? { id: best.id, name: best.name, page: best.page } : null;
}

function clogTileCandidates(raw: string, q: ParsedQuery, ctx: MatchContext): TaskCandidate[] {
  if (!ctx.clogPages || ctx.clogPages.length === 0) return [];
  const all = new Set(q.all);
  const logWord = all.has('clog') || all.has('collection') || (all.has('log') && (all.has('slot') || all.has('page')));
  if (!logWord) return [];
  const slotIntent = all.has('slot');
  const pageIntent = !slotIntent && ['complete', 'finish', 'fill', 'full', 'own', 'page'].some((w) => all.has(w));
  if (!slotIntent && !pageIntent) return [];
  const mode = slotIntent ? 'slots' : 'complete';

  // Hand-picked items: "… from dwh, tyrannical ring or chaos ele pet".
  const fromAt = /\bfrom\b/i.exec(raw);
  if (fromAt) {
    const list = raw.slice(fromAt.index + 4).split(/,|\bor\b|\band\b|\//i).map((p) => p.trim()).filter(Boolean);
    const items = list.map((p) => clogItemFor(p, ctx));
    if (list.length > 1 && items.every((x) => x != null)) {
      const picked = items as { id: number; name: string; page: string }[];
      const ids = [...new Set(picked.map((i) => i.id))];
      const pages = [...new Set(picked.map((i) => i.page))];
      const c = clogTileCandidate({ mode, pages, itemIds: ids, itemNames: picked.map((i) => i.name) }, mode === 'slots' ? q.amount ?? 1 : null);
      return [{ ...c, score: 12, confident: true }];
    }
  }

  // A page ("barrows", "wintertodt"), or no page at all = any page.
  const core = q.tokens.filter((t) => !CLOG_WORDS.has(t));
  if (core.length === 0) {
    if (mode === 'complete') return [];
    return [{ ...clogTileCandidate({ mode, pages: [], itemIds: [] }, q.amount ?? 10), score: 11, confident: true }];
  }
  let best: { page: { name: string; items: MatchItem[] }; extra: number } | null = null;
  for (const page of ctx.clogPages) {
    const have = tokens(page.name);
    if (!core.every((t) => have.some((h) => tokMatch(t, h)))) continue;
    const extra = have.length - core.length;
    if (!best || extra < best.extra) best = { page, extra };
  }
  if (best) {
    const c = clogTileCandidate({ mode, pages: [best.page.name], itemIds: best.page.items.map((i) => i.id) }, mode === 'slots' ? q.amount ?? 1 : null);
    return [{ ...c, score: 11 - Math.min(best.extra, 2) * 0.25, confident: true }];
  }
  // One item: "a new clog slot: tyrannical ring".
  const one = clogItemFor(core.join(' '), ctx);
  if (one) {
    return [{ ...clogTileCandidate({ mode, pages: [one.page], itemIds: [one.id], itemNames: [one.name] }, mode === 'slots' ? 1 : null), score: 10, confident: true }];
  }
  return [];
}

// ─── The catalogue ───────────────────────────────────────────────────────────────────────────

function staticDrafts(ctx: MatchContext, q: ParsedQuery | null): (Draft & Named)[] {
  return [
    ...counterDrafts(ctx),
    ...bossDrafts(),
    ...familyDrafts(),
    ...activityDrafts(),
    ...skillDrafts(),
    ...lapDrafts(),
    ...diaryDrafts(),
    ...caDrafts(),
    ...challengeDrafts(q),
  ];
}

// Small nudges so equal coverage falls the way people mean it: a named counter beats a skill that
// shares a word with it, and a ready library task beats a fresh one of the same name.
const SOURCE_BONUS: Partial<Record<CandidateSource, number>> = {
  library: 0.6, counter: 0.4, boss: 0.2, lap: 0.2, activity: 0.1, skill: -0.3, diary: -0.2, ca: -0.2, timed: -0.5,
};

/** A library task as a candidate: fully configured, with its own points and tags. */
export function libraryCandidate(t: NonNullable<MatchContext['library']>[number]): TaskCandidate {
  const how = howItCountsLine(t.config);
  return {
    key: t.key,
    source: 'library',
    badge: 'Your library',
    title: t.label,
    titleTemplate: t.label,
    hint: how.text,
    engine: how.engine,
    verb: 'Do',
    noun: t.label,
    amountField: null,
    amount: null,
    config: t.config,
    flow: 'confirm',
    category: 'other',
    score: 0,
    confident: true,
    points: t.points,
    tileCategory: t.category,
  };
}

/**
 * Everything that matches what was typed, best first. The first entry is the "best match"; the
 * rest are "also matches". Empty when nothing covers the query — the caller offers a screenshot tile.
 */
export function matchTasks(query: string, ctx: MatchContext = {}): TaskCandidate[] {
  // Points typed with the task ("2 zenytes 500 points") are the tile's worth, never its amount — and a
  // combo's as a whole, never one part's.
  const { text, points } = parseBulkLine(query);
  // "X or Y", "X and Y", "2 of: a, b, c": one COMBO tile when every part resolves (see comboMatch).
  const found = comboMatch(text, ctx) ?? matchSingle(text, ctx);
  return points == null ? found : found.map((c) => ({ ...c, points }));
}

/**
 * One task, never split into a combo. The combo matcher resolves each of its parts through THIS, so
 * a part can't recurse into another split — the old either/or matcher did, and went exponential on a
 * line with many "or"s.
 */
function matchSingle(query: string, ctx: MatchContext): TaskCandidate[] {
  const exact = matchExact(query, ctx);
  const fix = correctQueryDetail(query, ctx);
  if (fix == null) return exact;
  const fixed = fix.text;
  // The corrected reading scores a step below anything matched as typed, so an exact hit always
  // wins a tie. It is only "confident" when it is clearly alone — otherwise the bulk review asks
  // ("pick one") instead of silently guessing what a typo meant.
  const fuzzy = matchExact(fixed, ctx).map((c) => ({ ...c, score: c.score - 1, fuzzy: true }));
  const top = fuzzy.find((c) => c.confident);
  // A rival is another reading that stands on its own (confident) and scores close — the same
  // item's drop-vs-inventory twin is not one.
  const rival = top && fuzzy.some((c) => c !== top && c.confident && c.score > top.score - 2);
  const merged = new Map<string, TaskCandidate>();
  for (const c of exact) merged.set(c.key, c);
  for (const c of fuzzy) {
    // A typo two known words are equally close to is a question, never a guess.
    const f = { ...c, confident: c === top && !rival && !fix.ambiguous };
    const prev = merged.get(c.key);
    if (!prev || f.score > prev.score) merged.set(c.key, f);
  }
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 12);
}

// ─── Combos ──────────────────────────────────────────────────────────────────────────────────

// "…with event-earned energy", "…using energy earned during the event", "paid for with event energy".
const ENERGY_RE = /\s*\b(?:(?:paid\s+(?:for\s+)?)?(?:with|using|from|via|by)\s+)?(?:(?:the\s+)?event[-\s]?earned\s+energy|energy\s+(?:earned|gained|attuned|made|collected)\s+(?:during|in|over|throughout)\s+(?:the\s+)?event|(?:the\s+)?event(?:'s)?\s+energy)\b/i;
const GOTR_RE = /\b(?:gotr|guardians?\s+of\s+the\s+rift)\b/i;

// The "mix" marker, anywhere in the line: "(any mix)", "- mix and match", "combined", "in any combination".
const MIX_RE = /\s*[-–—,(]?\s*\b(?:(?:in\s+)?any\s+mix|mix\s*(?:and|&|'?n'?)\s*match(?:ed)?|combined|(?:in\s+)?any\s+combination)\b\s*\)?/i;

/** Longest line the combo matcher will split. Longer text is matched as one task (never split). */
export const MAX_COMBO_QUERY = 240;

const SPELLED_N: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export interface ComboSplit {
  rule: ComboRule;
  parts: string[];
  /** Split on "and": an "and" between items only is one collection, never a combo. */
  and?: boolean;
}

/**
 * How a line could be a combo, cheapest first — never more than MAX_COMBO_PARTS parts, never a line
 * longer than MAX_COMBO_QUERY. Pure text: whether the parts mean anything is comboMatch's question.
 *
 *   "2 of: a, b, c"  / "any 2 of a, b or c"  → nOf
 *   "a or b or c"    / "a, b or c"            → any
 *   "a and b"                                  → all
 */
export function comboSplits(query: string): ComboSplit[] {
  const text = query.trim();
  if (!text || text.length > MAX_COMBO_QUERY) return [];
  const list = (body: string) => body.split(/\s*[,;]\s*(?:(?:or|and)\s+)?|\s+(?:or|and)\s+/i).map((p) => p.trim()).filter(Boolean);
  const nOf = /^(?:any\s+|at\s+least\s+)?(\d+|one|two|three|four|five|six)\s+of\s*(?::|\s)\s*(.+)$/i.exec(text);
  if (nOf) {
    // "one of each …", "2 of the Barrows items": a collection's wording, never a list of tiles.
    if (/^(?:each|every|the|all|any|these|those)\b/i.test(nOf[2])) return [];
    const n = SPELLED_N[nOf[1].toLowerCase()] ?? parseInt(nOf[1], 10);
    const parts = list(nOf[2]);
    if (parts.length >= 2 && parts.length <= MAX_COMBO_PARTS && n >= 1 && n <= parts.length) {
      return [{ rule: n === parts.length ? { mode: 'all' } : n === 1 ? { mode: 'any' } : { mode: 'nOf', n }, parts }];
    }
    return [];
  }
  const out: ComboSplit[] = [];
  for (const [word, mode] of [['or', 'any'], ['and', 'all']] as const) {
    const re = new RegExp(`\\s+${word}\\s+`, 'i');
    if (!re.test(text)) continue;
    // Commas join the list only when the line is a list of this word ("a, b or c").
    const parts = text.split(new RegExp(`\\s*,\\s*(?:${word}\\s+)?|\\s+${word}\\s+`, 'i')).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > MAX_COMBO_PARTS) continue;
    out.push({ rule: { mode }, parts, ...(word === 'and' ? { and: true } : {}) });
    // Also every two-way split of a longer list ("a or b or 100 c" may be "a or b" OR "100 c").
    if (parts.length > 2) {
      for (let k = 1; k < parts.length; k++) {
        out.push({ rule: { mode }, parts: [parts.slice(0, k).join(` ${word} `), parts.slice(k).join(` ${word} `)], ...(word === 'and' ? { and: true } : {}) });
      }
    }
  }
  return out;
}

/** Sources that need no amount of their own to be a finished tile: one item (drop or gained), a log page, a task. */
const AMOUNTLESS_SOURCES = new Set<CandidateSource>(['drop', 'gain', 'clog', 'diary', 'ca', 'trial', 'timed', 'deathless', 'library']);
/** Sources that are an item: an "and" between two of them is a collection, never a combo. */
const ITEM_SOURCES = new Set<CandidateSource>(['drop', 'clog', 'gain']);

interface ResolvedPart {
  text: string;
  pick: TaskCandidate;
}

/**
 * One part of a combo, through the non-splitting matcher: its clear best reading, or null. A part that
 * counts something (kills, KC, XP, a counter) must say how many itself — that is what keeps a kills
 * list ("gauntlet or cg", "25 callisto or artio", "5 cox tob or tfa") one kills tile.
 */
function resolvePart(raw: string, query: string, ctx: MatchContext): ResolvedPart | null {
  let text = raw.replace(/^(?:either|both)\s+/i, '').trim();
  const energy = ENERGY_RE.test(text);
  text = text.replace(ENERGY_RE, ' ').replace(/\s+/g, ' ').trim();
  // A GOTR search said any way ("reward searches", "searches in GOTR") is the searches counter.
  if (/\bsearch(?:es)?\b/i.test(text) && (GOTR_RE.test(query) || /\brift\b/i.test(query))) {
    text = text
      .replace(/\b(?:(?:in|at|from)\s+)?(?:the\s+)?(?:gotr|guardians?\s+of\s+the\s+rift)\b/gi, ' ')
      .replace(/\b(?:reward\s+)?(?:guardian\s+)?search(?:es)?\b/i, GOTR_SEARCHES)
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (!text) return null;
  const q = parseTaskQuery(text);
  const cands = matchSingle(text, ctx);
  const verdict = classifyMatches(cands);
  // A reward word ("unique", "pet", "rare reward", "any … item") means the collection-log page.
  const rewardy = REWARD_WORDS.some((w) => q.all.includes(w));
  const page = cands.find((c) => c.source === 'clog');
  const [lead, runnerUp] = cands;
  // A part is short ("100 barrows chests"): its clear leader will do even when it isn't "ready".
  const clear = !!lead && lead.score >= 6 && (!runnerUp || lead.score - runnerUp.score >= 1.5) ? lead : null;
  let pick = (rewardy && page) || (verdict.status === 'ready' ? verdict.choices[0] : null) || clear || page || null;
  if (!pick || Object.keys(pick.config).length === 0 || pick.source === 'combo') return null;
  if (pick.source === 'trial' && pick.flow !== 'confirm') return null;
  if (!AMOUNTLESS_SOURCES.has(pick.source) && q.amount == null) return null;
  if (pick.source === 'clog') {
    // The page IS the pool — a finished drop tile once it's a part.
    pick = { ...pick, source: 'drop', flow: 'confirm', seed: undefined };
  }
  // GOTR searches "paid for with event-earned energy": capped per member by the two energy counters.
  if (energy && pick.config.tileType === 'kill' && pick.config.targetNpcs?.length === 1 && pick.config.targetNpcs[0] === GOTR_SEARCHES) {
    const capBy = [...GOTR_ENERGY_CAPS];
    pick = {
      ...pick,
      config: { ...pick.config, capBy },
      hint: `${pick.hint} Only searches paid for with energy earned during the event count.`,
      noun: `${pick.noun}${capPhrase(capBy)}`,
    };
  }
  return { text, pick };
}

/** "New clog slots", "a clog slot from …", "complete the … clog page": a collection-log tile's wording. */
const CLOG_TILE_PHRASE = /\b(?:clog|collection[\s-]*log)\s+(?:slots?|pages?)\b/i;

/**
 * A plain "get one of these items" pick — a drop pool, or an inventory-gain pool for items that aren't
 * a monster's drop (a raid reward) — needing one, with no sets, sources or modes.
 */
function isSingleDropPool(p: TaskCandidate): boolean {
  const c = p.config;
  return (
    (c.tileType === 'drop' || c.tileType === 'gain') &&
    (c.trackedItemIds?.length ?? 0) > 0 &&
    !(c.itemRequirements?.length) &&
    !(c.sourceNpcs?.length) &&
    c.countMode !== 'distinct' &&
    (c.requiredAmount ?? 1) === 1
  );
}

/**
 * Several one-item picks joined by "or" → one item pool over all their items: a drop pool when every
 * item is a drop, else an inventory-gain pool (which sees an item however it arrives — a raid chest, a
 * drop picked up — where loot detection only sees monster drops).
 */
function dropPoolCandidate(picks: TaskCandidate[]): TaskCandidate {
  const ids = [...new Set(picks.flatMap((p) => p.config.trackedItemIds ?? []))];
  const labels = picks.map((p) => p.title);
  const title = comboLabel({ mode: 'any' }, labels);
  const tileType = picks.every((p) => p.config.tileType === 'drop') ? 'drop' : 'gain';
  const base = picks.find((p) => p.config.tileType === tileType) ?? picks[0];
  return {
    ...base,
    key: `pool-${tileType}-${ids.join('-')}`,
    source: tileType,
    title,
    titleTemplate: title,
    noun: title,
    hint: `Get any one of: ${labels.join(', ')}.`,
    config: { ...base.config, tileType, trackedItemIds: ids, requiredAmount: 1, countMode: null },
    flow: 'confirm',
    score: Math.max(...picks.map((p) => p.score)) + 3,
    confident: true,
    fuzzy: picks.some((p) => p.fuzzy) || undefined,
    comboParts: undefined,
  };
}

const sameConfig = (a: TaskCandidate, b: TaskCandidate) => a.key === b.key || JSON.stringify(a.config) === JSON.stringify(b.config);

/** The combo candidate for resolved parts under a rule. */
export function comboCandidate(rule: ComboRule, parts: TaskCandidate[]): TaskCandidate {
  const labels = parts.map((p) => p.title);
  const title = comboLabel(rule, labels);
  const engines = new Set(parts.map((p) => p.engine));
  return {
    key: `combo-${rule.mode}${rule.n ?? ''}-${parts.map((p) => p.key).join('|')}`,
    source: 'combo',
    badge: 'Combo',
    title,
    titleTemplate: title,
    hint: comboSentence(rule, labels),
    engine: engines.has('plugin') ? 'plugin' : engines.has('hiscores') ? 'hiscores' : 'screenshot',
    verb: 'Do',
    noun: title,
    amountField: null,
    amount: null,
    config: {
      tileType: COMBO_TILE_TYPE,
      comboRule: rule,
      parts: parts.map((p) => ({ ...p.config, label: p.title })),
    },
    flow: 'confirm',
    category: 'other',
    score: Math.max(...parts.map((p) => p.score)) + 3,
    confident: true,
    fuzzy: parts.some((p) => p.fuzzy) || undefined,
    comboParts: parts,
  };
}

/**
 * A line that names several DIFFERENT tiles joined by a rule → ONE combo tile, each part its own
 * ordinary tile on its own best engine: "Vorkath unique or 200 Vorkath kc" (a drop page OR hiscores
 * KC), "a Zulrah pet and 99 Fishing", "2 of: Tbow, Scythe, Shadow". Every part has to resolve; an
 * "and" between items only is a collection ("Ahrim's and Dharok's"), never a combo.
 *
 * Bounded: the line is split at the top level only, into at most MAX_COMBO_PARTS parts, and each part
 * goes through the non-splitting matcher — no recursion, so a line of fifty "or"s costs nothing.
 */
function comboMatch(query: string, ctx: MatchContext): TaskCandidate[] | null {
  // A collection-log tile's own wording lists items or pages ("new clog slot from dwh, tyrannical ring
  // or chaos ele pet") — that list IS the tile (lib/clogTiles), never a combo of parts.
  if (CLOG_TILE_PHRASE.test(query)) return null;
  // "(any mix)", "mix and match", "combined", "any combination": a weighted MIX — each part adds its
  // share toward 100% ("100 gorillas + 1 zenyte" finishes "200 gorillas or 2 zenytes"). The marker is
  // dropped before the parts are read; without it a plain "X or Y" stays 'any'.
  const mixMarker = MIX_RE.exec(query);
  const mix = !!mixMarker;
  if (mixMarker) query = (query.slice(0, mixMarker.index) + ' ' + query.slice(mixMarker.index + mixMarker[0].length)).replace(/\s+/g, ' ').trim();
  for (const s of comboSplits(query)) {
    const split: ComboSplit = mix && s.rule.mode !== 'nOf' ? { ...s, rule: { mode: 'mix' } } : s;
    const resolved: ResolvedPart[] = [];
    for (const raw of split.parts) {
      const r = resolvePart(raw, query, ctx);
      if (!r) break;
      resolved.push(r);
    }
    if (resolved.length !== split.parts.length) continue;
    const picks = resolved.map((r) => r.pick);
    if (picks.some((p, i) => picks.some((o, j) => j < i && sameConfig(p, o)))) continue;
    if (split.and && !mix && picks.every((p) => ITEM_SOURCES.has(p.source))) continue;
    // "Tbow or scythe", "zenyte or onyx": items only, one of each — ONE drop pool (any of them), not a
    // combo. Combos are for mixing different kinds or count sides ("a Vorkath unique or 200 KC").
    if (split.rule.mode === 'any' && !mix && picks.every(isSingleDropPool)) {
      const pool = dropPoolCandidate(picks);
      return [pool, ...picks.slice(0, 3).map((c) => ({ ...c, confident: false, score: Math.min(c.score, pool.score - 2) }))];
    }
    const combined = comboCandidate(split.rule, picks);
    // Each part on its own stays on offer, a step below, for "no, just that one".
    const rest = picks.slice(0, 3).map((c) => ({ ...c, confident: false, score: Math.min(c.score, combined.score - 2) }));
    return [combined, ...rest];
  }
  return null;
}

// ─── Typo tolerance ──────────────────────────────────────────────────────────────────────────

/** Damerau-Levenshtein (optimal string alignment): a transposition costs 1. Stops early past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = new Array(b.length + 1).fill(0);
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

/** How many edits a word of this length may be off by: short words must be exact. */
function allowedEdits(len: number): number {
  return len <= 3 ? 0 : len <= 5 ? 1 : 2;
}

interface Vocab {
  set: Set<string>;
  byLen: Map<number, string[]>;
}
function vocabOf(tokensList: Iterable<string>): Vocab {
  const set = new Set<string>();
  for (const t of tokensList) if (t && !/\d/.test(t)) set.add(t);
  const byLen = new Map<number, string[]>();
  for (const t of set) {
    const l = byLen.get(t.length) ?? [];
    l.push(t);
    byLen.set(t.length, l);
  }
  return { set, byLen };
}

let staticVocab: Vocab | null = null;
let staticCounters: unknown = null;
function vocabStatic(ctx: MatchContext): Vocab {
  if (staticVocab && staticCounters === (ctx.counters ?? COUNTER_TARGETS)) return staticVocab;
  const all: string[] = [];
  for (const d of staticDrafts(ctx, null)) for (const n of [...d.names, ...(d.aliases ?? [])]) all.push(...tokens(n));
  all.push(...Object.values(RAID_TOKENS).flat(), ...Object.values(MODE_TOKENS).flat(), ...Object.values(COURSE_TOKENS).flat());
  all.push(...TRIAL_RANK_OPTIONS_UI.map((r) => r.id), 'raid', 'trial', 'barracuda', 'sailing', 'rank', ...GROUP_WORDS, ...REWARD_WORDS);
  for (const f of BOSS_FAMILIES) for (const n of [f.name, ...f.aliases]) all.push(...tokens(n));
  staticVocab = vocabOf(all);
  staticCounters = ctx.counters ?? COUNTER_TARGETS;
  return staticVocab;
}

// Cached per (item catalogue, monster list) — both are long-lived server arrays; the library and
// clog pages ride along with them.
const ctxVocabCache = new WeakMap<object, { monsters: unknown; vocab: Vocab }>();
function vocabCtx(ctx: MatchContext): Vocab {
  const hit = ctx.items ? ctxVocabCache.get(ctx.items) : undefined;
  if (hit && hit.monsters === ctx.monsters) return hit.vocab;
  const all: string[] = [];
  for (const it of ctx.items ?? []) all.push(...tokens(it.name));
  for (const p of ctx.clogPages ?? []) all.push(...tokens(p.name));
  for (const t of ctx.library ?? []) all.push(...tokens(t.label));
  for (const m of ctx.monsters ?? []) all.push(...tokens(m));
  const v = vocabOf(all);
  if (ctx.items) ctxVocabCache.set(ctx.items, { monsters: ctx.monsters, vocab: v });
  return v;
}

function known(w: string, vs: Vocab[]): boolean {
  return STOP.has(w) || vs.some((v) => v.set.has(w));
}

/**
 * The closest known word within the allowed edits, or null. Earlier vocabularies win ties, then a
 * shared first letter; `tied` says two words were still equally close (the typo is ambiguous).
 */
function nearest(w: string, vs: Vocab[]): { t: string; tied: boolean } | null {
  const max = allowedEdits(w.length);
  if (max === 0) return null;
  let best: { t: string; d: number; rank: number } | null = null;
  let tied = false;
  vs.forEach((v, rank) => {
    for (let len = w.length - max; len <= w.length + max; len++) {
      for (const t of v.byLen.get(len) ?? []) {
        if (t.length < 3) continue;
        const d = editDistance(w, t, max);
        if (d > max) continue;
        const b = best as { t: string; d: number; rank: number } | null;
        const better = !b || d < b.d || (d === b.d && rank < b.rank)
          || (d === b.d && rank === b.rank && t[0] === w[0] && b.t[0] !== w[0]);
        const same = !!b && d === b.d && rank === b.rank && (t[0] === w[0]) === (b.t[0] === w[0]);
        if (better) {
          best = { t, d, rank };
          tied = false;
        } else if (same && t !== b!.t) {
          tied = true;
        }
      }
    }
  });
  const b = best as { t: string } | null;
  return b ? { t: b.t, tied } : null;
}

/**
 * What was typed, with its typos fixed against the words the matcher knows — or null when every
 * word is already known. Joins and splits run first ("blood wood" → bloodwood, "coxcm" → cox cm),
 * then a per-word edit-distance fallback. Numbers are never touched; short words must be exact.
 */
export function correctQuery(query: string, ctx: MatchContext = {}): string | null {
  return correctQueryDetail(query, ctx)?.text ?? null;
}

function correctQueryDetail(query: string, ctx: MatchContext): { text: string; ambiguous: boolean } | null {
  const vs = [vocabStatic(ctx), vocabCtx(ctx)];
  const raw = expandShorthands(query).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9.,:]+/g, ' ').trim().split(' ').filter(Boolean);
  const out: string[] = [];
  let changed = false;
  let ambiguous = false;
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (/\d/.test(w) || !/^[a-z]+$/.test(w)) {
      out.push(w);
      continue;
    }
    const s = stem(w);
    const next = raw[i + 1];
    // "blood wood" → "bloodwood": two words that are one known word.
    if (next && /^[a-z]+$/.test(next) && !STOP.has(w) && !STOP.has(next)) {
      const joined = stem(w + next);
      if (vs.some((v) => v.set.has(joined))) {
        out.push(w + next);
        changed = true;
        i++;
        continue;
      }
    }
    if (known(s, vs) || known(w, vs)) {
      out.push(w);
      continue;
    }
    // "coxcm" → "cox cm": one word that is two known words (the matcher's own words only).
    let split: string | null = null;
    for (let k = 2; k <= w.length - 2 && !split; k++) {
      const a = w.slice(0, k);
      const b = w.slice(k);
      if (vs[0].set.has(a) && vs[0].set.has(stem(b))) split = `${a} ${b}`;
    }
    if (split) {
      out.push(split);
      changed = true;
      continue;
    }
    const fix = nearest(s, vs);
    if (fix && fix.t !== s) {
      out.push(fix.t);
      changed = true;
      if (fix.tied) ambiguous = true;
    } else {
      out.push(w);
    }
  }
  return changed ? { text: out.join(' '), ambiguous } : null;
}

function matchExact(query: string, ctx: MatchContext): TaskCandidate[] {
  const q = parseTaskQuery(query);
  if (q.tokens.length === 0 && q.all.length === 0) return [];
  if (q.tokens.join('').length < 2 && q.all.join('').length < 2) return [];
  const out: TaskCandidate[] = [];

  for (const t of ctx.library ?? []) {
    const s = scoreNamed(q, { names: [t.label], aliases: t.category ? [t.category] : [] });
    if (!s.matched || s.coverage < 0.5) continue;
    const c = libraryCandidate(t);
    out.push({ ...c, score: s.score + (SOURCE_BONUS.library ?? 0), confident: s.confident });
  }

  const raid = raidCandidate(q);
  if (raid) out.push(raid);
  const several = multiBossCandidate(q);
  if (several) out.push(several);
  out.push(...trialCandidates(q));

  for (const d of staticDrafts(ctx, q)) {
    // Timed/speed candidates only when the task talks about time; deathless only when it says so.
    if (d.source === 'timed' && q.timeCapSeconds == null && !['speed', 'speedrun', 'timed', 'fast', 'pb'].some((w) => q.all.includes(w))) continue;
    if (d.source === 'deathless' && !['deathless', 'flawless', 'death', 'deaths', 'die'].some((w) => q.all.includes(w))) continue;
    const s = scoreNamed(q, d);
    if (!s.matched) continue;
    // A variant pinned to a number the task never said ("Doom delve level 3", "Sepulchre Floor 5")
    // is narrower than what was asked — let the general target win the tie ("75 Doom delves").
    const strayNumber = tokens(d.noun).some((t) => /^\d+$/.test(t) && !q.all.includes(t));
    // A family ("Nightmare (any)") wins over its namesake boss only when the task says "any", "both",
    // "bosses"… or uses a name only the family has ("dt2", "wildy").
    // "sub 30 inferno" is a speed tile, not 25 Zuk kills.
    const timeAdj = d.source === 'timed' && q.timeCapSeconds != null ? 2.5 : 0;
    const familyAdj = d.key.startsWith('family-')
      ? GROUP_WORDS.some((w) => q.all.includes(w)) || q.tokens.some((t) => !BOSSES.some((b) => [b.label, ...(b.aliases ?? [])].some((n) => tokens(n).includes(t)))) ? 1.5 : -1.5
      : 0;
    out.push(finish(d, q, { ...s, score: s.score + (SOURCE_BONUS[d.source] ?? 0) - (strayNumber ? 1 : 0) + familyAdj + timeAdj }));
  }

  // A monster that is also a counter or boss already offered (Herbiboar) is that counter or boss.
  const named = new Set(out.filter((c) => ['counter', 'boss', 'activity', 'lap'].includes(c.source)).map((c) => tokens(c.noun).join(' ')));
  for (const c of monsterCandidates(q, ctx)) {
    const nm = tokens(c.noun).join(' ');
    if (named.has(nm)) {
      out.push({ ...c, score: c.score - 3, confident: false });
    } else {
      out.push(c);
      named.add(nm);
    }
  }
  // An item that is just the name of a counter, boss or monster already offered ("Herbiboar",
  // the "Chicken" item next to the chicken you kill) is noise.
  for (const c of itemCandidates(q, ctx)) {
    const itemName = tokens(c.titleOne ?? c.title).join(' ');
    out.push(named.has(itemName) ? { ...c, score: c.score - 3, confident: false } : c);
  }
  out.push(...clogCandidates(q, ctx));
  out.push(...clogTileCandidates(query, q, ctx));

  out.sort((a, b) => b.score - a.score);
  // One row per key (a library task and its seed can share a label but not a key).
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true))).slice(0, 12);
}

/** How sure the bulk review is about a line: add it, ask which, or make it a screenshot tile. */
export type LineStatus = 'ready' | 'pick' | 'screenshot';

export function classifyMatches(cands: TaskCandidate[]): { status: LineStatus; choices: TaskCandidate[] } {
  if (cands.length === 0) return { status: 'screenshot', choices: [] };
  const [best, next] = cands;
  // A trial without a rank (or a clog page) is a starting point, not a finished tile.
  if (best.confident && Object.keys(best.config).length > 0 && best.source !== 'clog') {
    // Two confident readings close together: ask rather than guess.
    if (next && next.confident && best.score - next.score < 0.75) return { status: 'pick', choices: cands.slice(0, 4) };
    return { status: 'ready', choices: [best] };
  }
  const plausible = cands.filter((c) => c.score >= 6 || c.source === 'clog' || c.source === 'trial');
  if (plausible.length > 0) return { status: 'pick', choices: plausible.slice(0, 4) };
  return { status: 'screenshot', choices: [] };
}

/** A screenshot (standard) tile for whatever was typed — the fallback that always works. */
export function screenshotCandidate(query: string): TaskCandidate {
  const q = parseTaskQuery(query);
  const text = q.text.replace(/\s+/g, ' ').trim();
  const name = text ? text[0].toUpperCase() + text.slice(1) : 'New task';
  const titleTemplate = q.amount != null ? `{n} ${name}` : name;
  return {
    key: 'screenshot',
    source: 'library',
    badge: 'Screenshot',
    title: q.amount != null ? `${fmt(q.amount)} ${name}` : name,
    titleTemplate,
    hint: 'Needs a screenshot: staff approve each one.',
    engine: 'screenshot',
    verb: 'Do',
    noun: name,
    amountField: null,
    amount: q.amount,
    config: { tileType: 'standard' },
    flow: 'confirm',
    category: 'other',
    score: 0,
    confident: false,
  };
}

/** The browse lists — every catalogued task of one category, unscored. Client-safe (constants only). */
export function browseCatalog(category: BrowseCategory, ctx: MatchContext = {}): TaskCandidate[] {
  // The collection log has its own step (pages → item checklist); browse offers the any-page tile.
  if (category === 'clog') return [clogTileCandidate({ mode: 'slots', pages: [], itemIds: [] }, 10)];
  return staticDrafts(ctx, null)
    .filter((d) => d.category === category)
    // Each diary area × tier is searchable, but a browse list of 60 diaries is noise: the
    // any-area tiers and the any-tier areas cover it.
    .filter((d) => d.source !== 'diary' || d.key.startsWith('diary-Any ') || d.key.endsWith(' Any'))
    .filter((d) => d.source !== 'timed' || ['Inferno', 'Fight Caves', 'Fortis Colosseum', 'Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut', 'Hallowed Sepulchre'].includes(d.names[0]))
    .map((d) => finish(d, null, null));
}
