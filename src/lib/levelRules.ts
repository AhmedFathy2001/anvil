// Level / XP milestone rules: WHICH level-ups and XP steps get announced, and where.
//
// Pure — no database, no network — so the matching is testable on its own. Storage lives in
// lib/levelRulesStore; the plugin reads the effective rules off /api/plugin/config (`levelRules`,
// capability 'level-rules') and /api/plugin/notify re-checks every level post against each
// destination's rules before forwarding it.
//
// THREE RULE SETS, one shape:
//
//   clan       the clan's rules for its levels channel (settings key `level_rules`, Admin →
//              Advanced settings → Notifications). Unset = DEFAULT_LEVEL_RULES, which is exactly what
//              the plugin did before rules existed (99s, every 100 total from 1800, max) plus the
//              site's own 50M total-XP posts.
//   member     a per-person choice about the clan channels: 'clan' (the clan's rules), 'ninetyNinesAndMax'
//              (only those two), or 'off'. Stricter only — it can remove posts, never add one the clan
//              didn't ask for. Stored per LOGIN (users.level_posts_clan) and applied to every clan
//              the person posts into.
//   personal   a full rule set for the person's OWN webhooks (users.level_rules), edited freely and
//              allowed to be looser than any clan's. Unset = the defaults.

/** The level half — the part shared with the plugin (the `levelRules` contract). */
export interface LevelRules {
  /** Post a skill reaching 99. */
  ninetyNines: boolean;
  /** 0 = off; else post skill level L when L >= skillFrom && (L - skillFrom) % skillStep == 0. */
  skillStep: number;
  /** 1..99. */
  skillFrom: number;
  /** 0 = off; else post total-level milestone M (a multiple of totalStep) when M >= totalFrom. */
  totalStep: number;
  totalFrom: number;
  /** Post reaching max total level. */
  maxTotal: boolean;
}

/** The XP half — site-side only (the server detects XP steps off hiscores/pushes; no plugin part). */
export interface XpRules {
  /** Total-XP step in MILLIONS; 0 = off. A multiple of TOTAL_XP_GRAIN_M. */
  totalXpStepM: number;
  /** Per-skill XP milestones in millions — a subset of SKILL_XP_CHOICES_M; [] = off. */
  skillXpM: number[];
}

/** What is stored for a clan, and for a person's own webhooks. */
export type MilestoneRules = LevelRules & XpRules;

export const DEFAULT_LEVEL_RULES: LevelRules = Object.freeze({
  ninetyNines: true,
  skillStep: 0,
  skillFrom: 1,
  totalStep: 100,
  totalFrom: 1800,
  maxTotal: true,
}) as LevelRules;

export const DEFAULT_XP_RULES: XpRules = Object.freeze({ totalXpStepM: 50, skillXpM: [] as number[] }) as XpRules;

export const DEFAULT_MILESTONE_RULES: MilestoneRules = Object.freeze({
  ...DEFAULT_LEVEL_RULES,
  ...DEFAULT_XP_RULES,
}) as MilestoneRules;

/**
 * The per-skill XP thresholds detection records (lib/statHistory XP_THRESHOLDS, in millions). A clan
 * picks a subset; anything else could never fire, so it is refused rather than stored.
 */
export const SKILL_XP_CHOICES_M = [10, 25, 50, 100, 150, 200] as const;

/**
 * Total-XP detection granularity, in millions. Steps a clan or person can choose are multiples of it,
 * and detection records steps at this grain only when some destination of the account wants one
 * (lib/statHistory recordMilestones) — the profile keeps its usual 50M ladder otherwise.
 */
export const TOTAL_XP_GRAIN_M = 5;
/** The step every profile records regardless of rules — the pre-rules behaviour, kept so old rows stay right. */
export const TOTAL_XP_RECORD_STEP_M = 50;

/** The highest level a skill posts at, and the max total level (what the plugin calls "maxed"). */
export const MAX_SKILL_LEVEL = 99;

export const LEVEL_POSTS_CHOICES = ['clan', 'ninetyNinesAndMax', 'off'] as const;
/** A member's choice for level posts in clan channels. */
export type LevelPostsChoice = (typeof LEVEL_POSTS_CHOICES)[number];

export function isLevelPostsChoice(v: unknown): v is LevelPostsChoice {
  return typeof v === 'string' && (LEVEL_POSTS_CHOICES as readonly string[]).includes(v);
}

// ── Normalisation ────────────────────────────────────────────────────────────────────────────────

function intIn(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
const boolOr = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/**
 * Any value → a complete, in-range rule set. Missing or malformed fields take the default, so a
 * stored row from before a field existed reads as "the default for that field", and nothing a
 * client sends can produce an out-of-range rule.
 */
export function normalizeMilestoneRules(raw: unknown, defaults: MilestoneRules = DEFAULT_MILESTONE_RULES): MilestoneRules {
  const o = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const stepM = intIn(o.totalXpStepM, 0, 1000, defaults.totalXpStepM);
  const skillXp = Array.isArray(o.skillXpM)
    ? o.skillXpM
        .map((x) => (typeof x === 'number' ? Math.trunc(x) : Number(x)))
        .filter((x): x is number => (SKILL_XP_CHOICES_M as readonly number[]).includes(x))
    : defaults.skillXpM;
  return {
    ninetyNines: boolOr(o.ninetyNines, defaults.ninetyNines),
    skillStep: intIn(o.skillStep, 0, 98, defaults.skillStep),
    skillFrom: intIn(o.skillFrom, 1, MAX_SKILL_LEVEL, defaults.skillFrom),
    totalStep: intIn(o.totalStep, 0, 2500, defaults.totalStep),
    totalFrom: intIn(o.totalFrom, 0, 2500, defaults.totalFrom),
    maxTotal: boolOr(o.maxTotal, defaults.maxTotal),
    // Rounded down onto the grain: a 12M step would need a 1M detection ladder nobody records.
    totalXpStepM: Math.floor(stepM / TOTAL_XP_GRAIN_M) * TOTAL_XP_GRAIN_M,
    skillXpM: [...new Set(skillXp)].sort((a, b) => a - b),
  };
}

/** A stored JSON text (or null) → rules; anything unreadable is the defaults. */
export function parseMilestoneRules(text: string | null | undefined): MilestoneRules {
  if (!text) return { ...DEFAULT_MILESTONE_RULES, skillXpM: [...DEFAULT_MILESTONE_RULES.skillXpM] };
  try {
    return normalizeMilestoneRules(JSON.parse(text));
  } catch {
    return { ...DEFAULT_MILESTONE_RULES, skillXpM: [...DEFAULT_MILESTONE_RULES.skillXpM] };
  }
}

/** Just the plugin-contract half, in the exact shape `/api/plugin/config` ships. */
export function levelHalf(r: LevelRules): LevelRules {
  return {
    ninetyNines: r.ninetyNines,
    skillStep: r.skillStep,
    skillFrom: r.skillFrom,
    totalStep: r.totalStep,
    totalFrom: r.totalFrom,
    maxTotal: r.maxTotal,
  };
}

// ── Effective rules (clan × member choice) ───────────────────────────────────────────────────────

/**
 * The rules a member's clan-channel posts follow: the clan's, after the member's own choice. Null when
 * they opted out. STRICTER ONLY: 'ninetyNinesAndMax' keeps 99s and max only where the clan has them
 * on, so a member can never switch on a post the clan turned off.
 */
export function effectiveClanRules(clan: MilestoneRules, choice: LevelPostsChoice): MilestoneRules | null {
  if (choice === 'off') return null;
  if (choice === 'ninetyNinesAndMax') {
    // 99s and max stay exactly as the clan has them; everything else is switched off.
    return { ...clan, skillStep: 0, totalStep: 0, totalXpStepM: 0, skillXpM: [] };
  }
  return clan;
}

// ── Matching ────────────────────────────────────────────────────────────────────────────────────

/** Does reaching `level` in a skill post under these rules? */
export function skillLevelMatches(rules: LevelRules, level: number): boolean {
  if (!Number.isInteger(level) || level < 1 || level > MAX_SKILL_LEVEL) return false;
  if (level === MAX_SKILL_LEVEL && rules.ninetyNines) return true;
  return rules.skillStep > 0 && level >= rules.skillFrom && (level - rules.skillFrom) % rules.skillStep === 0;
}

/** Does a round total-level milestone post under these rules? (Maxing is `maxTotal`, not this.) */
export function totalLevelMatches(rules: LevelRules, milestone: number): boolean {
  return (
    rules.totalStep > 0 &&
    Number.isInteger(milestone) &&
    milestone > 0 &&
    milestone % rules.totalStep === 0 &&
    milestone >= rules.totalFrom
  );
}

/**
 * The highest level in (from, to] that posts under ANY of the given rule sets, or null. A multi-level
 * jump (a lamp, a quest reward) announces once, at the top — the plugin does the same before sending.
 */
export function highestMatchingLevel(from: number, to: number, ...ruleSets: (LevelRules | null | undefined)[]): number | null {
  for (let l = Math.min(to, MAX_SKILL_LEVEL); l > from; l--) {
    if (ruleSets.some((r) => r && skillLevelMatches(r, l))) return l;
  }
  return null;
}

/** What a level-ish plugin post is about — enough to re-check it against a destination's rules. */
export type LevelPost =
  | { type: 'skill'; level: number }
  | { type: 'total'; milestone: number; maxed: boolean };

/**
 * Read the level post out of a notify `{kind, facts}`, or null when the post is not a level post.
 * Facts are already validated by lib/pluginEmbeds by the time the route asks.
 *
 *   level       { level }                       the new kind (capability 'level-rules')
 *   level99     always 99                       released plugins
 *   totalLevel  { milestone ?? total, maxed }   `milestone` is new; older plugins' `total` IS it
 */
export function levelPostOf(kind: unknown, facts: unknown): LevelPost | null {
  const f = typeof facts === 'object' && facts !== null ? (facts as Record<string, unknown>) : {};
  const int = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);
  if (kind === 'level99') return { type: 'skill', level: MAX_SKILL_LEVEL };
  if (kind === 'level') {
    const level = int(f.level);
    return level == null ? null : { type: 'skill', level };
  }
  if (kind === 'totalLevel') {
    const maxed = f.maxed === true;
    const milestone = int(f.milestone) ?? int(f.total);
    return milestone == null && !maxed ? null : { type: 'total', milestone: milestone ?? 0, maxed };
  }
  return null;
}

/** Does this destination's rule set want the post? `null` rules = the destination wants none. */
export function levelPostMatches(post: LevelPost, rules: LevelRules | null | undefined): boolean {
  if (!rules) return false;
  if (post.type === 'skill') return skillLevelMatches(rules, post.level);
  if (post.maxed) return rules.maxTotal;
  return totalLevelMatches(rules, post.milestone);
}

// ── XP milestones ───────────────────────────────────────────────────────────────────────────────

/** Does a total-XP step (millions) post under these rules? */
export function totalXpMatches(rules: XpRules, millions: number): boolean {
  return rules.totalXpStepM > 0 && millions > 0 && millions % rules.totalXpStepM === 0;
}

/** Does a per-skill XP step (RAW xp, as member_milestones stores 'xp' rows) post under these rules? */
export function skillXpMatches(rules: XpRules, rawXp: number): boolean {
  return rawXp > 0 && rawXp % 1_000_000 === 0 && rules.skillXpM.includes(rawXp / 1_000_000);
}

export interface XpMilestoneRow {
  kind: string;
  metric: string | null;
  threshold: number;
}

/** Most separate skill-XP posts one detection makes — a member back after months doesn't flood a channel. */
export const MAX_SKILL_XP_POSTS = 5;

/**
 * Which of a batch of newly recorded milestones one destination posts: the highest matching total-XP
 * step, and the highest matching XP step per skill (capped). Several steps crossed at once post only
 * the top one — the rest are still on the profile.
 */
export function xpPostsFor(
  rules: XpRules | null | undefined,
  rows: XpMilestoneRow[],
): { totalXpM: number | null; skills: { skill: string; xp: number }[] } {
  if (!rules) return { totalXpM: null, skills: [] };
  let totalXpM: number | null = null;
  const bySkill = new Map<string, number>();
  for (const r of rows) {
    if (r.kind === 'totalxp' && totalXpMatches(rules, r.threshold)) {
      if (totalXpM == null || r.threshold > totalXpM) totalXpM = r.threshold;
    } else if (r.kind === 'xp' && r.metric && skillXpMatches(rules, r.threshold)) {
      const prev = bySkill.get(r.metric);
      if (prev == null || r.threshold > prev) bySkill.set(r.metric, r.threshold);
    }
  }
  const skills = [...bySkill]
    .map(([skill, xp]) => ({ skill, xp }))
    .sort((a, b) => b.xp - a.xp || a.skill.localeCompare(b.skill))
    .slice(0, MAX_SKILL_XP_POSTS);
  return { totalXpM, skills };
}

/**
 * Keep a detected total-XP step on the profile? The usual 50M ladder always; a finer step only when
 * one of the account's destinations asks for it (`wantedStepsM`), so turning the clan's step to 10M
 * doesn't fill everyone else's profile with 10M rows.
 */
export function keepTotalXpStep(millions: number, wantedStepsM: number[]): boolean {
  if (millions % TOTAL_XP_RECORD_STEP_M === 0) return true;
  return wantedStepsM.some((s) => s > 0 && millions % s === 0);
}
