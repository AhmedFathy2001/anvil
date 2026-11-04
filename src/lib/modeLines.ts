// Game-mode events: relics, region unlocks, pacts, masteries and task completions on Leagues,
// Deadman and whatever Jagex launches next. Pure — no database; lib/modeLineStore holds the
// staff-added patterns and the review queue.
//
// THE PLUGIN DOESN'T KNOW WHAT ANY OF THESE ARE. On a game-mode world it forwards the highlighted
// game messages (POST /api/plugin/mode-lines) and the site decides what each line means. Every
// league reinvents its unlocks — relics, then areas, then pacts, then masteries, then something new
// — and each one is a chat line Jagex writes on launch day. Recognising them here means a new
// league is handled the day it starts, by a staff edit, not after a hub review.
//
// HOW A LINE IS CLASSIFIED, in order:
//   1. Staff patterns (/staff/mode-lines) — written against the real wording once it's seen.
//   2. The built-ins below — the wording of past leagues, kept loose so a reworded line still lands.
//   3. The generic shape: a line that opens "Congratulations" or "You've unlocked/completed/earned…"
//      is posted as a milestone as it stands. That's what makes launch day "run itself": the new
//      unlock posts at once in plain words, and staff turn it into a proper pattern later.
// Lines that are none of these aren't posted. They're kept, counted, as a template on the review
// queue, so the lines worth a pattern surface by how often players see them.

import { stripChatTags } from '@/lib/chatTags';
import type { WorldMode } from '@/lib/worldModes';

/** The kinds a game mode's event posts come in — each one a switch on Admin → Discord → Game modes. */
export const MODE_EVENT_KINDS = [
  { id: 'modeRelic', label: 'Relics' },
  { id: 'modeArea', label: 'Area unlocks' },
  { id: 'modePact', label: 'Pacts' },
  { id: 'modeMastery', label: 'Masteries' },
  { id: 'modeTask', label: 'Tasks (hard and up)' },
  { id: 'modeTaskMinor', label: 'Tasks (easy and medium)' },
  { id: 'modeMilestone', label: 'Other unlocks and milestones' },
] as const;
export type ModeEventKind = (typeof MODE_EVENT_KINDS)[number]['id'];
export const MODE_EVENT_KIND_IDS: ReadonlySet<string> = new Set(MODE_EVENT_KINDS.map((k) => k.id));

/**
 * Off until a clan turns them on: a league has hundreds of easy tasks, and a channel full of
 * "Open the Leagues menu" buries the relics people actually want to see.
 */
export const DEFAULT_MODE_KINDS_OFF: readonly ModeEventKind[] = ['modeTaskMinor'];

/** Pattern kinds: an event kind, or 'ignore' (recognised, never posted, kept off the review queue). */
export type ModeLineKind = ModeEventKind | 'ignore';
export const MODE_LINE_KINDS: readonly ModeLineKind[] = [...MODE_EVENT_KINDS.map((k) => k.id), 'ignore'];

export interface ModeLinePattern {
  /** 'builtin:<name>' or 'custom:<row id>'. */
  id: string;
  /** The mode it applies to; null = every mode (a league's wording is usually the next one's too). */
  modeKey: string | null;
  kind: ModeLineKind;
  /** Case-insensitive, run on the tag-stripped line, matched anywhere in it. */
  regex: string;
  /** What the post says. `${group}` is a named group; the first letter is capitalised. */
  title: string;
}

// Past leagues' wording, loosened (optional articles, either "area" or "region", any trailing
// punctuation). These are the best-known shapes, not a promise: a line one of them misses still
// posts through the generic shape and lands on the review queue.
export const BUILTIN_PATTERNS: readonly ModeLinePattern[] = [
  // The main game's own milestones say "Congratulations" too. Without these the generic shape posted
  // every level-up on a Hardcore World word for word ("…your Magic level. You are now level 23.").
  // Skill levels and quests are read as such in classifyLine (levelLine / questLine) and posted under
  // the clan's level rules; combat level, combat tasks and diaries are left to their own posts.
  { id: 'builtin:skip-level', modeKey: null, kind: 'ignore', regex: String.raw`advanced (?:your|a) [\w ]+? level`, title: '' },
  { id: 'builtin:skip-ca', modeKey: null, kind: 'ignore', regex: String.raw`completed an? \w+ combat task`, title: '' },
  { id: 'builtin:skip-diary', modeKey: null, kind: 'ignore', regex: String.raw`completed all of the \w+ tasks in the`, title: '' },
  {
    id: 'builtin:task',
    modeKey: null,
    kind: 'modeTask',
    regex: String.raw`completed an? (?<tier>beginner|easy|medium|hard|elite|master) task:?\s*(?<name>[^!]+?)[.!]*$`,
    title: '${tier} task: ${name}',
  },
  {
    id: 'builtin:relic',
    modeKey: null,
    kind: 'modeRelic',
    regex: String.raw`(?:unlocked|chosen|selected) (?:a |an |the )?(?:new )?relic:?\s*(?<name>[^.!]+)`,
    title: 'Relic unlocked: ${name}',
  },
  {
    id: 'builtin:area',
    modeKey: null,
    kind: 'modeArea',
    regex: String.raw`unlocked (?:a |an |the )?(?:new )?(?:area|region):?\s*(?<name>[^.!]+)`,
    title: 'Area unlocked: ${name}',
  },
  {
    id: 'builtin:pact',
    modeKey: null,
    kind: 'modePact',
    regex: String.raw`(?:formed|made|sealed|accepted|unlocked|chosen|struck) (?:a |an |the )?(?:new )?(?:demonic )?pact(?: with)?:?\s*(?<name>[^.!]+)`,
    title: 'Pact: ${name}',
  },
  {
    id: 'builtin:mastery',
    modeKey: null,
    kind: 'modeMastery',
    regex: String.raw`unlocked (?:a |an |the )?(?:new )?(?:combat )?mastery:?\s*(?<name>[^.!]+)`,
    title: 'Mastery unlocked: ${name}',
  },
];

const SKILLS = new Set([
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
  'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming',
  'runecraft', 'hunter', 'construction', 'sailing',
]);

/** "…advanced your Magic level. You are now level 23." → the skill and level; never Combat. */
export function levelLine(line: string): { skill: string; level: number } | null {
  const m = /advanced (?:your|a) ([\w ]+?) level\.?\s*you are now level (\d{1,2})\b/i.exec(line);
  if (!m) return null;
  const skill = m[1].trim().toLowerCase();
  const level = Number(m[2]);
  if (!SKILLS.has(skill) || level < 2 || level > 99) return null;
  return { skill: skill.charAt(0).toUpperCase() + skill.slice(1), level };
}

/** "Congratulations, you've completed a quest: Black Knights' Fortress" → the quest's name. */
export function questLine(line: string): string | null {
  const m = /completed (?:a|the) quest:?\s*(.+?)[.!]*$/i.exec(line);
  const name = m?.[1]?.trim();
  return name && name.length <= 80 ? name : null;
}

/** The generic shape of an unlock nobody has written a pattern for yet. */
const GENERIC = /^(?:congratulations\b|you(?:'ve| have) (?:just )?(?:unlocked|completed|earned|reached|been awarded|achieved)\b)/i;

/** Longest line kept, posted or matched. Chat lines are short; anything longer isn't a game line. */
export const MAX_LINE = 200;

/** The line as text: the game's <col>/<img> tags gone, non-breaking spaces normal, trimmed. */
export function cleanLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = stripChatTags(raw)
    .replace(/<[^>]*>/g, '')
    .replace(/[   ]/g, ' ')
    // Control characters would only ever be a client sending junk.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s && s.length <= MAX_LINE ? s : null;
}

/** The review-queue form of a line: numbers become #, so "12 of 40 tasks" and "13 of 40" are one row. */
export function lineTemplate(line: string): string {
  return line.replace(/\d[\d,.]*/g, '#').slice(0, MAX_LINE);
}

const compiled = new Map<string, RegExp | null>();

/** Compile a pattern once; null when it doesn't compile (a bad staff regex is skipped, never thrown). */
export function compilePattern(regex: string): RegExp | null {
  let re = compiled.get(regex);
  if (re === undefined) {
    try {
      re = new RegExp(regex, 'i');
    } catch {
      re = null;
    }
    if (compiled.size > 500) compiled.clear();
    compiled.set(regex, re);
  }
  return re;
}

function renderTitle(template: string, groups: Record<string, string | undefined>): string {
  const out = template.replace(/\$\{(\w+)\}/g, (_, g: string) => (groups[g] ?? '').trim()).replace(/\s+/g, ' ').trim();
  return (out.charAt(0).toUpperCase() + out.slice(1)).slice(0, MAX_LINE);
}

export type LineVerdict =
  | { kind: 'level'; skill: string; level: number }
  | { kind: 'quest'; name: string }
  | { kind: ModeEventKind; title: string; patternId: string }
  | { kind: 'ignore'; patternId: string }
  | { kind: 'generic'; title: string }
  | { kind: 'unknown' };

/**
 * What one cleaned line is, in `mode`. `custom` are the staff patterns, tried before the built-ins
 * so a staff fix always wins over the wording it corrects.
 */
export function classifyLine(line: string, mode: Pick<WorldMode, 'key'>, custom: readonly ModeLinePattern[] = []): LineVerdict {
  // The game's own level-up and quest lines, before any pattern: they post as levels and quests.
  const lv = levelLine(line);
  if (lv) return { kind: 'level', ...lv };
  const quest = questLine(line);
  if (quest) return { kind: 'quest', name: quest };
  for (const p of [...custom, ...BUILTIN_PATTERNS]) {
    if (p.modeKey !== null && p.modeKey !== mode.key) continue;
    const re = compilePattern(p.regex);
    const m = re?.exec(line);
    if (!m) continue;
    if (p.kind === 'ignore') return { kind: 'ignore', patternId: p.id };
    const groups = m.groups ?? {};
    let kind: ModeEventKind = p.kind;
    // A task's tier decides which switch it answers to.
    if (kind === 'modeTask' && /^(?:beginner|easy|medium)$/i.test(groups.tier ?? '')) kind = 'modeTaskMinor';
    const title = renderTitle(p.title, groups) || line;
    return { kind, title, patternId: p.id };
  }
  if (GENERIC.test(line)) return { kind: 'generic', title: line };
  return { kind: 'unknown' };
}

/** A staff pattern's problems, before it's saved. Empty = fine. */
export function checkPattern(p: { regex: string; title: string; kind: string; modeKey: string | null }): string[] {
  const errors: string[] = [];
  if (!MODE_LINE_KINDS.includes(p.kind as ModeLineKind)) errors.push('Unknown kind.');
  if (!p.regex.trim()) errors.push('Empty pattern.');
  if (p.regex.length > 500) errors.push('Longer than 500 characters.');
  else if (!compilePattern(p.regex)) errors.push("The pattern doesn't compile.");
  // The lines are short and capped, but a nested unbounded quantifier is still the one shape that
  // can make a server-side match crawl.
  if (/\((?:[^()]|\\.)*[+*](?:[^()]|\\.)*\)[+*{]/.test(p.regex)) errors.push('Nested repetition like (a+)+ is not allowed.');
  if (p.kind !== 'ignore' && !p.title.trim()) errors.push('A post needs a title.');
  if (p.title.length > 200) errors.push('Title longer than 200 characters.');
  return errors;
}

/** Escape a sample line into a starting regex for "make a pattern from this". */
export function patternFromSample(line: string): string {
  return line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\d[\d,]*/g, String.raw`\d[\d,]*`);
}

/** The Discord embed for one event. The mode label and art are added by markMode. */
export function modeEventEmbed(title: string, rsn: string | null): Record<string, unknown> {
  return {
    title,
    color: 0xc8a24a,
    ...(rsn ? { author: { name: rsn } } : {}),
    timestamp: new Date().toISOString(),
  };
}
