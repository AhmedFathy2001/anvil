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
}

export type GoalCheck =
  | { ok: true; kind: GoalKind; metric: string; target: number }
  | { ok: false; error: string };

const bossByKey = new Map(BOSSES.map((b) => [b.key.toLowerCase(), b.key]));
const bossByLabel = new Map(BOSSES.map((b) => [b.label.toLowerCase(), b.key]));

/** Validate and normalise a goal. Bosses may be named by key or by the game's label. */
export function checkGoal(input: GoalInput): GoalCheck {
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
    const key = bossByKey.get(metric.toLowerCase()) ?? bossByLabel.get(metric.toLowerCase());
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
