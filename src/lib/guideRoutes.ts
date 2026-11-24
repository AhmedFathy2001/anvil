// Progression routes: ordered chapters of goals, ticked from what the site already knows. PURE.
//
// A route is a guide of kind 'route' whose body holds one ```route block (this JSON) — so a route has
// revisions, clan copies that follow or fork, proposals and Discord posts exactly like any guide.
//
// A STEP IS A GOAL, never a walkthrough. Quest steps name the quest and stop there: Quest Helper does
// the walking. Each step says why it matters in one line, what it needs (requirement chips), and how
// account types differ: a fork can skip it for a type (HCIM and the Wilderness) or swap in another
// line for that type (UIM keeps it worn).
//
// TICKS come from facts the caller gathers (lib/guideRouteFacts): hiscores levels, quests and
// diaries/CAs the plugin pushed, collection-log items, items the plugin saw (phase 2) — or the
// player's own tick for a manual step. NEXT UP is the first open step whose requirements are met.

import { cleanMarkerLabel } from './groundMarkers';
import type { GuideAccount } from './guideSetups';

export type Goal =
  | { kind: 'level'; skill: string; level: number }
  | { kind: 'quest'; name: string }
  | { kind: 'item'; id: number; name?: string }
  | { kind: 'diary'; region: string; tier: 'easy' | 'medium' | 'hard' | 'elite' }
  | { kind: 'clog'; id: number; name?: string }
  | { kind: 'ca'; name: string }
  | { kind: 'kc'; boss: string; count: number }
  | { kind: 'manual' };

export interface StepFork {
  /** Leave the step out for this account type. */
  skip?: boolean;
  /** Or show this instead of `why` for the type. */
  alt?: string;
}

export interface RouteStep {
  id: string;
  /** What to get, short: "Ava's accumulator", "70 Agility". */
  title: string;
  goal: Goal;
  /** One line on why it matters. */
  why?: string;
  /** Requirements, each itself a goal (shown as chips, met or not). */
  reqs?: Goal[];
  forks?: Partial<Record<GuideAccount, StepFork>>;
  /** An item id to draw beside the step. */
  icon?: number;
  /** Who suggested it, when it came from a community suggestion. */
  by?: { userId: number; name: string } | null;
}

export interface RouteChapter {
  name: string;
  steps: RouteStep[];
}

export interface RouteBlock {
  /** Account types the route is for (absent = all). */
  accounts?: GuideAccount[];
  chapters: RouteChapter[];
}

const SKILLS = new Set([
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking',
  'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft', 'hunter', 'construction', 'sailing',
]);
const DIARY_TIERS = ['easy', 'medium', 'hard', 'elite'] as const;
const ACCOUNTS: GuideAccount[] = ['main', 'ironman', 'hcim', 'uim', 'gim'];

const text = (v: unknown, max: number): string => (typeof v === 'string' ? (cleanMarkerLabel(v.slice(0, max * 2)) ?? '').slice(0, max) : '');
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);

/** One goal, validated: unknown kinds and bad numbers are dropped (null). */
export function cleanGoal(v: unknown): Goal | null {
  const g = v as Record<string, unknown> | null;
  if (!g || typeof g !== 'object') return null;
  switch (g.kind) {
    case 'level': {
      const skill = typeof g.skill === 'string' ? g.skill.toLowerCase() : '';
      const level = int(g.level, 1, 99);
      return SKILLS.has(skill) && level ? { kind: 'level', skill, level } : null;
    }
    case 'quest':
    case 'ca': {
      const name = text(g.name, 80);
      return name ? { kind: g.kind, name } : null;
    }
    case 'item':
    case 'clog': {
      const id = int(g.id, 1, 100_000);
      const name = text(g.name, 60);
      return id ? { kind: g.kind, id, ...(name ? { name } : {}) } : null;
    }
    case 'diary': {
      const region = text(g.region, 30).toLowerCase();
      const tier = DIARY_TIERS.find((t) => t === g.tier);
      return region && tier ? { kind: 'diary', region, tier } : null;
    }
    case 'kc': {
      const boss = text(g.boss, 40).toLowerCase();
      const count = int(g.count, 1, 100_000);
      return boss && count ? { kind: 'kc', boss, count } : null;
    }
    case 'manual':
      return { kind: 'manual' };
    default:
      return null;
  }
}

/** Parse and clean a route block; null when it isn't one. Everything text becomes plain text. */
export function parseRouteBlock(json: string): RouteBlock | null {
  let j: unknown;
  try {
    j = JSON.parse(json);
  } catch {
    return null;
  }
  const r = j as { chapters?: unknown; accounts?: unknown };
  if (!r || !Array.isArray(r.chapters)) return null;
  const seen = new Set<string>();
  const chapters: RouteChapter[] = r.chapters.slice(0, 20).map((c, ci) => {
    const ch = c as { name?: unknown; steps?: unknown };
    const steps: RouteStep[] = [];
    for (const [si, s] of (Array.isArray(ch?.steps) ? ch.steps : []).slice(0, 80).entries()) {
      const st = s as Record<string, unknown>;
      const goal = cleanGoal(st?.goal);
      const title = text(st?.title, 80);
      if (!goal || !title) continue;
      let id = typeof st.id === 'string' && /^[a-z0-9-]{1,40}$/.test(st.id) ? st.id : `c${ci}-s${si}`;
      while (seen.has(id)) id = `${id}-x`;
      seen.add(id);
      const forks: RouteStep['forks'] = {};
      if (st.forks && typeof st.forks === 'object') {
        for (const a of ACCOUNTS) {
          const f = (st.forks as Record<string, { skip?: unknown; alt?: unknown }>)[a];
          if (!f) continue;
          const alt = text(f.alt, 160);
          if (f.skip === true || alt) forks[a] = { ...(f.skip === true ? { skip: true } : {}), ...(alt ? { alt } : {}) };
        }
      }
      const by = st.by as { userId?: unknown; name?: unknown } | null | undefined;
      steps.push({
        id,
        title,
        goal,
        ...(text(st.why, 200) ? { why: text(st.why, 200) } : {}),
        ...(Array.isArray(st.reqs) ? { reqs: st.reqs.slice(0, 8).map(cleanGoal).filter((x): x is Goal => !!x) } : {}),
        ...(Object.keys(forks).length ? { forks } : {}),
        ...(int(st.icon, 1, 100_000) ? { icon: st.icon as number } : {}),
        ...(by && int(by.userId, 1, 1e9) ? { by: { userId: by.userId as number, name: text(by.name, 40) } } : {}),
      });
    }
    return { name: text(ch?.name, 60) || `Chapter ${ci + 1}`, steps };
  });
  const accounts = Array.isArray(r.accounts) ? (r.accounts.filter((a) => ACCOUNTS.includes(a as GuideAccount)) as GuideAccount[]) : [];
  return { ...(accounts.length ? { accounts } : {}), chapters };
}

export const serializeRouteBlock = (r: RouteBlock) => JSON.stringify(r);

// ── Facts and ticks ──────────────────────────────────────────────────────────────────────────

export interface RouteFacts {
  levels?: Record<string, number> | null;
  /** Quest names finished (lower-case). */
  quests?: Set<string> | null;
  /** "region:tier" finished, e.g. "ardougne:medium" (lower-case). */
  diaries?: Set<string> | null;
  /** Combat achievement task names done (lower-case). */
  cas?: Set<string> | null;
  /** Collection-log item ids held. */
  clog?: Set<number> | null;
  /** Item ids the player holds (bank/inventory/worn, phase 2), through equivalences. */
  items?: Set<number> | null;
  /** Boss kc by hiscores key. */
  kc?: Record<string, number> | null;
  /** Steps the player ticked by hand. */
  manual?: Set<string> | null;
}

/** Met / not met / unknown (no data to say). Unknown never blocks Next up but never ticks either. */
export type Truth = true | false | null;

export function goalMet(g: Goal, f: RouteFacts): Truth {
  switch (g.kind) {
    case 'level': {
      const have = f.levels?.[g.skill];
      return have == null ? null : have >= g.level;
    }
    case 'quest':
      return f.quests ? f.quests.has(g.name.toLowerCase()) : null;
    case 'diary': {
      if (!f.diaries) return null;
      // A harder tier done implies the easier ones.
      const at = DIARY_TIERS.indexOf(g.tier);
      return DIARY_TIERS.slice(at).some((t) => f.diaries!.has(`${g.region}:${t}`));
    }
    case 'ca':
      return f.cas ? f.cas.has(g.name.toLowerCase()) : null;
    case 'clog':
      return f.clog ? f.clog.has(g.id) : null;
    case 'item':
      if (f.items?.has(g.id) || f.clog?.has(g.id)) return true;
      return f.items ? false : null;
    case 'kc': {
      const have = f.kc?.[g.boss];
      return have == null ? null : have >= g.count;
    }
    case 'manual':
      return null;
  }
}

/** Where a tick came from, for the "from your hiscores" / "from the plugin" note. */
export function goalSource(g: Goal): string {
  switch (g.kind) {
    case 'level':
    case 'kc':
      return 'from your hiscores';
    case 'clog':
      return 'from your collection log';
    case 'manual':
      return 'ticked by you';
    default:
      return 'from the plugin';
  }
}

export interface StepState {
  step: RouteStep;
  chapter: number;
  /** Position in the whole route, 1-based (skipped steps keep their number). */
  n: number;
  done: boolean;
  /** How it got ticked. */
  source: string | null;
  /** Skipped for this account type. */
  skipped: boolean;
  /** The line to show: the type's alt, else why. */
  line: string;
  reqs: { goal: Goal; met: Truth }[];
  /** Every requirement met (unknown counts as met: we can't say otherwise). */
  ready: boolean;
}

export function stepState(step: RouteStep, chapter: number, n: number, f: RouteFacts, account: GuideAccount | null): StepState {
  const fork = account ? step.forks?.[account] : undefined;
  const manualDone = f.manual?.has(step.id) ?? false;
  const auto = step.goal.kind === 'manual' ? null : goalMet(step.goal, f);
  const done = manualDone || auto === true;
  const reqs = (step.reqs ?? []).map((goal) => ({ goal, met: goalMet(goal, f) }));
  return {
    step,
    chapter,
    n,
    done,
    source: done ? (auto === true ? goalSource(step.goal) : 'ticked by you') : null,
    skipped: !!fork?.skip,
    line: fork?.alt ?? step.why ?? '',
    reqs,
    ready: reqs.every((r) => r.met !== false),
  };
}

export interface RouteProgress {
  steps: StepState[];
  done: number;
  /** Steps that count for this account (skipped ones don't). */
  total: number;
  /** The first open steps whose requirements are met, in route order (at most `limit`). */
  next: StepState[];
  /** The most recent done step in route order before the first open one (the "done just now" card). */
  lastDone: StepState | null;
}

export function routeProgress(route: RouteBlock, f: RouteFacts, account: GuideAccount | null, limit = 3): RouteProgress {
  const steps: StepState[] = [];
  let n = 0;
  route.chapters.forEach((ch, ci) => ch.steps.forEach((s) => steps.push(stepState(s, ci, ++n, f, account))));
  const counted = steps.filter((s) => !s.skipped);
  const open = counted.filter((s) => !s.done);
  const firstOpen = open[0];
  const lastDone = firstOpen ? [...counted].reverse().find((s) => s.done && s.n < firstOpen.n) ?? null : counted.filter((s) => s.done).pop() ?? null;
  return {
    steps,
    done: counted.filter((s) => s.done).length,
    total: counted.length,
    next: open.filter((s) => s.ready).slice(0, limit),
    lastDone,
  };
}

/** A requirement chip's words: "needs 50 Ranged", "quest: Animal Magnetism". */
export function goalLabel(g: Goal, f?: RouteFacts): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  switch (g.kind) {
    case 'level': {
      const have = f?.levels?.[g.skill];
      return have != null && have < g.level ? `${cap(g.skill)} ${have}/${g.level}` : `needs ${g.level} ${cap(g.skill)}`;
    }
    case 'quest':
      return `quest: ${g.name}`;
    case 'diary':
      return `${cap(g.region)} ${cap(g.tier)} Diary`;
    case 'ca':
      return `Combat Achievement: ${g.name}`;
    case 'clog':
      return `log: ${g.name ?? `item ${g.id}`}`;
    case 'item':
      return g.name ?? `item ${g.id}`;
    case 'kc': {
      const have = f?.kc?.[g.boss];
      return have != null && have < g.count ? `${cap(g.boss)} kc ${have}/${g.count}` : `${g.count} ${cap(g.boss)} kc`;
    }
    case 'manual':
      return 'tick it yourself';
  }
}

/** Discord: chapters as headed runs of checkbox lines. Quest steps say Quest Helper takes over. */
export function routeDiscordMarkdown(route: RouteBlock | null, siteUrl: string | null): string {
  if (!route) return '';
  const esc = (s: string) => s.replace(/([*_~`|>#\\[\]()])/g, '\\$1').replace(/@/g, '@\u200b');
  const parts: string[] = [];
  let n = 0;
  route.chapters.forEach((ch, ci) => {
    if (ci > 0) parts.push('---');
    parts.push(`## ${esc(ch.name)}`);
    for (const s of ch.steps) {
      n++;
      const forks = Object.entries(s.forks ?? {})
        .map(([a, f]) => (f?.skip ? `${a.toUpperCase()}: skip` : f?.alt ? `${a.toUpperCase()}: ${esc(f.alt)}` : ''))
        .filter(Boolean);
      parts.push(`⬜ **${n}. ${esc(s.title)}**${s.why ? ` — ${esc(s.why)}` : ''}`);
      const reqs = (s.reqs ?? []).map((g) => esc(goalLabel(g)));
      if (s.goal.kind === 'quest') reqs.push('Quest Helper takes it from here');
      if (reqs.length || forks.length) parts.push(`-# ${[...reqs, ...forks].join(' · ')}`);
    }
  });
  if (siteUrl) parts.push('', `✅ [Follow it and tick steps automatically](<${siteUrl}>)`);
  return parts.join('\n');
}
