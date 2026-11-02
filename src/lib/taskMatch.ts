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
import { chooseKillSource } from '@/lib/killSource';
import type { TileConfig } from '@/lib/types';
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
  type CountEngine,
  type RaidId,
  type RaidSelection,
} from '@/lib/tileCreatorConfig';

// ─── Types ───────────────────────────────────────────────────────────────────────────────────

export type BrowseCategory = 'bosses' | 'items' | 'skilling' | 'courses' | 'xp' | 'achievements' | 'challenges' | 'other';

/** Which screen finishes this candidate: most go straight to the one-sentence confirm. */
export type CreatorFlow = 'confirm' | 'raids' | 'trials' | 'items' | 'courses';

export type CandidateSource =
  | 'library' | 'boss' | 'activity' | 'skill' | 'counter' | 'raid' | 'lap' | 'trial'
  | 'diary' | 'ca' | 'timed' | 'deathless' | 'lms' | 'pvp' | 'value' | 'gain' | 'drop' | 'clog';

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
  };
  category: BrowseCategory;
  score: number;
  /** Covers what was typed well enough to add without a second look. */
  confident: boolean;
  /** Library tasks carry their own points and tags. */
  points?: number | null;
  tileCategory?: string | null;
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
export function parseTaskQuery(query: string): ParsedQuery {
  let text = query.trim().replace(/\s+/g, ' ');
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
  return {
    amount,
    text,
    tokens: tokens(text),
    all: words(text).map(stem),
    timeCapSeconds,
  };
}

/** One bulk line: "150 herbiboars harvested – 20 pts" → the task text and its points. */
export function parseBulkLine(line: string): { text: string; points: number | null } {
  const m = /\s*(?:[-–—:|(,]\s*)?(\d+)\s*(?:pts?|points?)\)?\.?\s*$/i.exec(line);
  if (m && m.index > 0) return { text: line.slice(0, m.index).trim().replace(/[-–—:|,]\s*$/, '').trim(), points: parseInt(m[1], 10) };
  return { text: line.trim(), points: null };
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
  return q.length >= 3 && c.startsWith(q);
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
  'tombsOfAmascut', 'tombsOfAmascutExpertMode',
]);

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
      names: [b.label],
      aliases: b.aliases ?? [],
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
    names: [t.name, ...(t.name.startsWith('Hallowed Sepulchre Floor') ? [`sepulchre ${t.label}`] : [])],
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
  for (const r of RAID_MODE_VARIANTS.filter((v) => v.base !== 'Fractured Archive')) {
    out.push({
      key: `deathless-${r.base}`,
      source: 'deathless',
      badge: 'Deathless',
      names: [`deathless ${r.base}`],
      aliases: ['deathless', 'flawless', 'death', 'deaths', 'die', 'zero', 'raid'],
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
  if (raids.length === 0 && raidWord) raids = ['cox', 'tob', 'toa'];
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
    if (!s.matched || !s.nameCovered) continue;
    const k = lower;
    if (seen.has(k)) continue;
    seen.add(k);
    hits.push({ it, s });
  }
  hits.sort((a, b) => b.s.score - a.s.score || a.it.name.length - b.it.name.length);
  const out: TaskCandidate[] = [];
  for (const { it, s } of hits.slice(0, 3)) {
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

function clogCandidates(q: ParsedQuery, ctx: MatchContext): TaskCandidate[] {
  const out: TaskCandidate[] = [];
  for (const page of ctx.clogPages ?? []) {
    const s = scoreNamed(q, { names: [page.name], aliases: ['collection', 'log', 'clog', 'rare', 'reward', 'unique'] });
    if (!s.matched || !s.nameCovered) continue;
    const ids = page.items.map((i) => i.id);
    out.push(finish({
      key: `clog-${page.name}`,
      source: 'clog',
      badge: 'Items',
      titleTemplate: `Any ${page.name} collection log item`,
      verb: 'Get',
      noun: `any ${page.name} collection log item`,
      amountField: null,
      defaultAmount: null,
      config: { tileType: 'gain', trackedItemIds: ids, requiredAmount: 1 },
      flow: 'items',
      seed: { items: page.items, how: 'gain' },
      category: 'items',
    }, q, { ...s, confident: false, score: s.score - 0.5 }));
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
}

// ─── The catalogue ───────────────────────────────────────────────────────────────────────────

function staticDrafts(ctx: MatchContext, q: ParsedQuery | null): (Draft & Named)[] {
  return [
    ...counterDrafts(ctx),
    ...bossDrafts(),
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
  out.push(...trialCandidates(q));

  for (const d of staticDrafts(ctx, q)) {
    // Timed/speed candidates only when the task talks about time; deathless only when it says so.
    if (d.source === 'timed' && q.timeCapSeconds == null && !['speed', 'speedrun', 'timed', 'fast', 'pb'].some((w) => q.all.includes(w))) continue;
    if (d.source === 'deathless' && !['deathless', 'flawless', 'death', 'deaths', 'die'].some((w) => q.all.includes(w))) continue;
    const s = scoreNamed(q, d);
    if (!s.matched) continue;
    out.push(finish(d, q, { ...s, score: s.score + (SOURCE_BONUS[d.source] ?? 0) }));
  }

  out.push(...itemCandidates(q, ctx));
  out.push(...clogCandidates(q, ctx));

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
  return staticDrafts(ctx, null)
    .filter((d) => d.category === category)
    // Each diary area × tier is searchable, but a browse list of 60 diaries is noise: the
    // any-area tiers and the any-tier areas cover it.
    .filter((d) => d.source !== 'diary' || d.key.startsWith('diary-Any ') || d.key.endsWith(' Any'))
    .filter((d) => d.source !== 'timed' || ['Inferno', 'Fight Caves', 'Fortis Colosseum', 'Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut', 'Hallowed Sepulchre'].includes(d.names[0]))
    .map((d) => finish(d, null, null));
}
