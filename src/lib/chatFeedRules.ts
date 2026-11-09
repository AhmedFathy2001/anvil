// The in-game chat feed's rules: what one person wants to see, and who gets one item. Pure — no
// database; lib/chatFeed gathers the people and sends.
//
// An ITEM is one thing that happened to one player: a drop, a pet, a new collection-log slot, a
// combat task, a level, a quest or diary, a game-mode unlock, or (on a board) a team's tile. It
// reaches people along AUDIENCES:
//   event — everyone on a board whose host turned the chat feed on
//   guest — across a clan boundary: a clan's guests sitting in its channel right now, and the clan's
//           members for those guests (the "guest bridge"; the clan opts in, so does each person)
// Each person gets an item ONCE, however many audiences carry it, tagged by the first of those in
// that order. Nobody is sent their own item, and a player's personal item never goes to someone in
// the same in-game clan: the game's own clan broadcast already showed it to them.
//
// The plugin holds one switch (feed on or off); every finer choice lives here, on the site.

import { stripChatTags } from '@/lib/chatTags';

export const CA_TIERS = ['easy', 'medium', 'hard', 'elite', 'master', 'grandmaster'] as const;
export type CaTier = (typeof CA_TIERS)[number];

export interface ChatFeedPrefs {
  /** Board feeds a host turned on. */
  events: boolean;
  /** The guest bridge. Off until the person turns it on. */
  guests: boolean;
  drops: boolean;
  /** Drops below this are left out. Pets ignore it. */
  minValue: number;
  pets: boolean;
  clog: boolean;
  /** Lowest combat-task tier shown, or 'off'. */
  ca: CaTier | 'off';
  /** 'major' = 99s, maxing and total-level milestones; 'off' = none. */
  levels: 'major' | 'off';
  /** 'major' = the quest cape and elite diaries; 'off' = none. */
  quests: 'major' | 'off';
  /** Other teams' tile completions on a board. */
  tiles: boolean;
  /** A teammate's drop moving one of your team's item tiles along ("Drenvox: Abyssal whip 4/10"). */
  teamProgress: boolean;
  /** Game-mode unlocks: relics, areas, pacts, masteries, harder tasks. */
  modes: boolean;
  /** New tiles opening and missions going live on your own boards (lib/revealPush). */
  reveals: boolean;
  /** The one-or-two-line brief printed at login (lib/chatBrief). */
  login: boolean;
  /** How Anvil lines are coloured — see lib/chatLook. 'custom' is a Supporter perk. */
  palette: Palette;
  /** Supporter colours per tone, '#rrggbb'. Missing tones keep the Anvil colour. */
  colors: Partial<Record<Tone, string>>;
  /** What the login brief covers. Choosing is a Champion perk; everyone else gets the default. */
  brief: BriefItem[];
}

/** What a chat line is, which decides its colour: tile done, progress/rank, a drop, someone else's
 * tile, a warning, or plain information. */
export const TONES = ['done', 'near', 'drop', 'feed', 'warn', 'info'] as const;
export type Tone = (typeof TONES)[number];
export const PALETTES = ['anvil', 'plain', 'custom'] as const;
export type Palette = (typeof PALETTES)[number];
export const BRIEF_ITEMS = ['bingo', 'weekly', 'tiles', 'clanEvents', 'goals'] as const;
export type BriefItem = (typeof BRIEF_ITEMS)[number];
export const DEFAULT_BRIEF: BriefItem[] = ['bingo', 'weekly'];

export const DEFAULT_PREFS: ChatFeedPrefs = {
  events: true,
  guests: false,
  drops: true,
  minValue: 1_000_000,
  pets: true,
  clog: true,
  ca: 'elite',
  levels: 'major',
  quests: 'off',
  tiles: true,
  teamProgress: true,
  modes: true,
  reveals: true,
  login: true,
  palette: 'anvil',
  colors: {},
  brief: DEFAULT_BRIEF,
};

export const MIN_VALUE_CHOICES = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000] as const;

/** Stored JSON → prefs, any missing or malformed field taking its default. */
export function parsePrefs(raw: string | null | undefined): ChatFeedPrefs {
  let p: Record<string, unknown> = {};
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object' && !Array.isArray(v)) p = v;
  } catch {
    /* defaults */
  }
  return cleanPrefs(p);
}

/** Any object → valid prefs. What the settings route stores. */
export function cleanPrefs(p: Record<string, unknown>): ChatFeedPrefs {
  const bool = (k: keyof ChatFeedPrefs) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  const min = typeof p.minValue === 'number' && Number.isFinite(p.minValue) ? Math.max(0, Math.min(2_147_000_000, Math.round(p.minValue))) : DEFAULT_PREFS.minValue;
  return {
    events: bool('events'),
    guests: bool('guests'),
    drops: bool('drops'),
    minValue: min,
    pets: bool('pets'),
    clog: bool('clog'),
    ca: p.ca === 'off' || (CA_TIERS as readonly unknown[]).includes(p.ca) ? (p.ca as CaTier | 'off') : DEFAULT_PREFS.ca,
    levels: p.levels === 'major' || p.levels === 'off' ? p.levels : DEFAULT_PREFS.levels,
    quests: p.quests === 'major' || p.quests === 'off' ? p.quests : DEFAULT_PREFS.quests,
    tiles: bool('tiles'),
    teamProgress: bool('teamProgress'),
    modes: bool('modes'),
    reveals: bool('reveals'),
    login: bool('login'),
    palette: (PALETTES as readonly unknown[]).includes(p.palette) ? (p.palette as Palette) : DEFAULT_PREFS.palette,
    colors: cleanColors(p.colors),
    brief: Array.isArray(p.brief)
      ? BRIEF_ITEMS.filter((b) => (p.brief as unknown[]).includes(b))
      : DEFAULT_PREFS.brief,
  };
}

function cleanColors(v: unknown): Partial<Record<Tone, string>> {
  const out: Partial<Record<Tone, string>> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const t of TONES) {
    const c = (v as Record<string, unknown>)[t];
    if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) out[t] = c.toLowerCase();
  }
  return out;
}

/** The tone a feed item is printed in: drops and pets stand out, other teams' tiles sit back. */
export function toneOf(kind: FeedKind): Tone {
  return kind === 'drop' || kind === 'pet' ? 'drop' : kind === 'tile' ? 'feed' : kind === 'progress' || kind === 'reveal' ? 'near' : 'info';
}

export type FeedKind = 'drop' | 'pet' | 'clog' | 'ca' | 'level' | 'quest' | 'mode' | 'tile' | 'progress' | 'reveal';

export interface FeedItem {
  kind: FeedKind;
  /** Who it happened to (a team name for a tile). */
  who: string;
  /** The rest of the line, e.g. "Twisted bow (1.2b) from Chambers of Xeric". */
  text: string;
  /** drop: GE value. */
  valueGp?: number | null;
  /** ca: the task's tier. */
  caTier?: CaTier | null;
  /** level / quest: a 99, max, quest cape or elite diary — the ones 'major' keeps. */
  major?: boolean;
}

/** Does this person want this item at all (audience aside)? */
export function wants(prefs: ChatFeedPrefs, item: FeedItem): boolean {
  switch (item.kind) {
    case 'drop':
      return prefs.drops && (item.valueGp ?? 0) >= prefs.minValue;
    case 'pet':
      return prefs.pets;
    case 'clog':
      return prefs.clog;
    case 'ca':
      return prefs.ca !== 'off' && item.caTier != null && CA_TIERS.indexOf(item.caTier) >= CA_TIERS.indexOf(prefs.ca);
    case 'level':
      return prefs.levels === 'major' && !!item.major;
    case 'quest':
      return prefs.quests === 'major' && !!item.major;
    case 'mode':
      return prefs.modes;
    case 'tile':
      return prefs.tiles;
    case 'progress':
      return prefs.teamProgress;
    case 'reveal':
      return prefs.reveals;
  }
}

export type Audience = 'event' | 'guest';
const AUDIENCE_ORDER: Audience[] = ['event', 'guest'];

/** One way an item could reach one person. */
export interface Candidate {
  userId: number;
  via: Audience;
  /** What the line is tagged with: the board's or the clan's name. */
  tag: string;
}

export interface Recipient {
  userId: number;
  tag: string;
}

/**
 * Who gets the item, once each.
 *
 * `memberClans` is each user's in-game clans (member seats), the sender's included; a personal item
 * skips anyone sharing one with the sender. A tile is the team's, not a person's, so it never skips.
 */
export function recipients(args: {
  item: FeedItem;
  senderUserId: number | null;
  candidates: Candidate[];
  prefs: Map<number, ChatFeedPrefs>;
  memberClans: Map<number, Set<number>>;
}): Recipient[] {
  const { item, senderUserId, candidates, prefs, memberClans } = args;
  const senderClans = senderUserId != null ? memberClans.get(senderUserId) : undefined;
  const best = new Map<number, Candidate>();
  for (const c of candidates) {
    if (c.userId === senderUserId) continue;
    const prev = best.get(c.userId);
    if (!prev || AUDIENCE_ORDER.indexOf(c.via) < AUDIENCE_ORDER.indexOf(prev.via)) best.set(c.userId, c);
  }
  const out: Recipient[] = [];
  for (const c of best.values()) {
    const p = prefs.get(c.userId) ?? DEFAULT_PREFS;
    if (c.via === 'event' && !p.events) continue;
    if (c.via === 'guest' && !p.guests) continue;
    if (!wants(p, item)) continue;
    // Clanmates already see the game's own broadcast of a drop, so they're skipped; nothing in the game
    // says what a drop did for a board, so team progress goes to them too.
    if (item.kind !== 'tile' && item.kind !== 'progress' && senderClans?.size) {
      const theirs = memberClans.get(c.userId);
      if (theirs && [...theirs].some((id) => senderClans.has(id))) continue;
    }
    out.push({ userId: c.userId, tag: c.tag });
  }
  return out;
}

/** 1234 → "1.2k", 1_250_000 → "1.25m", 1_100_000_000 → "1.1b". */
export function gp(n: number): string {
  const fmt = (v: number, unit: string) => `${Number(v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0))}${unit}`;
  if (n >= 1_000_000_000) return fmt(n / 1_000_000_000, 'b');
  if (n >= 1_000_000) return fmt(n / 1_000_000, 'm');
  if (n >= 1_000) return fmt(n / 1_000, 'k');
  return String(Math.round(n));
}

/** The message the plugin prints: `[Anvil · <tag>] <who> <text>`. Kept short for the chatbox. */
export interface FeedMessage {
  t: 'feed';
  kind: FeedKind;
  tone: Tone;
  tag: string;
  who: string;
  text: string;
  /** The sender's Supporter name colour ('#rrggbb'), when they have one. */
  whoColor?: string;
  /** The name's gradient stops (Champion/Patron), 2–4 hex colours. */
  whoGrad?: string[];
  /** Patron: a star before the name. */
  star?: true;
}

export function feedMessage(
  item: FeedItem,
  tag: string,
  flair?: { color: string; star: boolean; grad?: string[] } | null,
): FeedMessage {
  const m: FeedMessage = { t: 'feed', kind: item.kind, tone: toneOf(item.kind), tag: tag.slice(0, 40), who: item.who.slice(0, 40), text: item.text.slice(0, 160) };
  if (flair) {
    // `whoColor` for every plugin; `whoGrad` for one that colours the name letter by letter.
    m.whoColor = flair.color;
    if (flair.grad && flair.grad.length >= 2) m.whoGrad = flair.grad.slice(0, 4);
    if (flair.star) m.star = true;
  }
  return m;
}

// ── What the plugin reports (POST /api/plugin/moments) ───────────────────────────────────────────
//
// The plugin already sends every drop over 100k, pet, combat task and big level as a moment, whatever
// its Discord settings, and the site throws most of them away when no board or competition wants
// them (lib/moments). The feed reads the same reports before that; 'clog', 'diary' and 'quest' are
// moments only the feed reads.

/** Moment kinds the feed reads that lib/moments doesn't store. */
export const FEED_ONLY_MOMENT_KINDS = ['clog', 'diary', 'quest'] as const;

function str(v: unknown, max = 60): string | null {
  if (typeof v !== 'string') return null;
  const clean = stripChatTags(v)?.trim();
  return clean ? clean.slice(0, max) : null;
}

function num(v: unknown, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.floor(v) : null;
}

const MAX_VALUE_GP = 1_000_000_000_000;

/** One reported moment → a feed item, or null when it isn't one (a death) or is malformed. */
export function feedItemFromMoment(raw: Record<string, unknown>, who: string): FeedItem | null {
  const from = (s: string | null) => (s ? ` from ${s}` : '');
  const name = str(raw.itemName);
  switch (raw.kind) {
    case 'drop': {
      const value = num(raw.valueGp, MAX_VALUE_GP);
      if (!name || value == null) return null;
      const qty = num(raw.quantity, 1_000_000_000) ?? 1;
      return { kind: 'drop', who, valueGp: value, text: `received ${qty > 1 ? `${qty.toLocaleString('en-US')} x ` : ''}${name} (${gp(value)})${from(str(raw.source))}` };
    }
    case 'pet':
      return { kind: 'pet', who, text: `got a pet${name ? `: ${name}` : '!'}${from(str(raw.source))}` };
    case 'clog':
      return name ? { kind: 'clog', who, text: `new collection log slot: ${name}` } : null;
    case 'ca': {
      const task = str(raw.taskName, 80);
      const tier = str(raw.tier, 16)?.toLowerCase().replace(/\s+/g, '') as CaTier | undefined;
      if (!task || !tier || !(CA_TIERS as readonly string[]).includes(tier)) return null;
      return { kind: 'ca', who, caTier: tier, text: `completed a ${tier} combat task: ${task}` };
    }
    case 'level': {
      const level = num(raw.quantity, 10_000);
      if (level == null) return null;
      if (raw.sourceKind === 'max') return { kind: 'level', who, major: true, text: 'has maxed every skill!' };
      if (raw.sourceKind === 'total') return { kind: 'level', who, major: false, text: `reached ${level.toLocaleString('en-US')} total level` };
      return name ? { kind: 'level', who, major: level >= 99, text: `reached ${level} ${name}` } : null;
    }
    case 'diary': {
      const tier = str(raw.tier, 10);
      if (!name || !tier) return null;
      return { kind: 'quest', who, major: tier.toLowerCase() === 'elite', text: `completed the ${tier} ${name} diary` };
    }
    case 'quest': {
      if (!name) return null;
      const cape = raw.sourceKind === 'cape';
      return { kind: 'quest', who, major: cape, text: cape ? `completed every quest! (${name})` : `completed ${name}` };
    }
    default:
      return null;
  }
}
