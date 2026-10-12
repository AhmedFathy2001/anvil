import { BOSSES, SKILLS } from '@/lib/constants';
import { clogPageNames } from '@/lib/clogDataset';

// What a goal may say, decided without a database (tests/pure-module-imports). The route stores what
// this returns and nothing else, so a tampered client can't plant a key nothing will ever match.

export const MAX_GOALS = 12;
export type GoalKind = 'skill' | 'boss' | 'clog';

export interface GoalInput {
  kind?: unknown;
  metric?: unknown;
  target?: unknown;
  /** Optional deadline, 'YYYY-MM-DD'. Empty or absent = none. */
  dueOn?: unknown;
}

export type GoalCheck =
  | { ok: true; kind: GoalKind; metric: string; target: number; dueOn: string | null }
  | { ok: false; error: string };

const fold = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
const bossByFold = new Map<string, string>();
for (const b of BOSSES) {
  bossByFold.set(fold(b.key), b.key);
  bossByFold.set(fold(b.label), b.key);
}

/**
 * The plugin offers RuneLite's boss names, which mostly fold to ours ("Alchemical Hydra" ↔
 * alchemicalHydra) and occasionally say more ("Barrows Chests" for our "Barrows") — so an exact fold
 * first, then the longest of ours that the name starts with.
 */
function bossKey(name: string): string | undefined {
  const f = fold(name);
  const exact = bossByFold.get(f);
  if (exact) return exact;
  let best: string | undefined;
  let bestLen = 0;
  for (const [k, key] of bossByFold) {
    if (k.length >= 4 && f.startsWith(k) && k.length > bestLen) {
      best = key;
      bestLen = k.length;
    }
  }
  return best;
}

const DAY = 86_400_000;

/**
 * A deadline: a real calendar day, not already past, and within ten years. Yesterday is let through so
 * a deadline set late at night in one timezone isn't refused by another.
 */
export function checkDueOn(raw: unknown, now: Date = new Date()): { ok: true; dueOn: string | null } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, dueOn: null };
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: 'A date like 2026-12-01.' };
  const t = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== raw) return { ok: false, error: 'That date doesn’t exist.' };
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (t < today - DAY) return { ok: false, error: 'Pick a date that hasn’t passed.' };
  if (t > today + 3653 * DAY) return { ok: false, error: 'Within the next ten years.' };
  return { ok: true, dueOn: raw };
}

/** Validate and normalise a goal. Bosses may be named by key or by the game's label. */
export function checkGoal(input: GoalInput, now: Date = new Date()): GoalCheck {
  const due = checkDueOn(input.dueOn, now);
  if (!due.ok) return due;
  const goal = checkGoalBody(input);
  return goal.ok ? { ...goal, dueOn: due.dueOn } : goal;
}

function checkGoalBody(input: GoalInput): { ok: true; kind: GoalKind; metric: string; target: number } | { ok: false; error: string } {
  const kind = input.kind;
  const metric = typeof input.metric === 'string' ? input.metric.trim() : '';
  const target = typeof input.target === 'number' && Number.isFinite(input.target) ? Math.floor(input.target) : NaN;
  if (!metric) return { ok: false, error: 'Pick what the goal is for.' };

  if (kind === 'skill') {
    const key = metric.toLowerCase();
    if (key === 'overall' || !(SKILLS as readonly string[]).includes(key)) return { ok: false, error: 'Unknown skill.' };
    if (!(target >= 2 && target <= 99)) return { ok: false, error: 'A level between 2 and 99.' };
    return { ok: true, kind, metric: key, target };
  }
  if (kind === 'boss') {
    const key = bossKey(metric);
    if (!key) return { ok: false, error: 'Unknown boss.' };
    if (!(target >= 1 && target <= 100_000)) return { ok: false, error: 'A kill count between 1 and 100,000.' };
    return { ok: true, kind, metric: key, target };
  }
  if (kind === 'clog') {
    const page = clogPageNames().find((p) => p.toLowerCase() === metric.toLowerCase());
    if (!page) return { ok: false, error: 'Unknown collection log page.' };
    return { ok: true, kind, metric: page, target: 0 };
  }
  return { ok: false, error: 'A goal is a skill, a boss, or a log page.' };
}
