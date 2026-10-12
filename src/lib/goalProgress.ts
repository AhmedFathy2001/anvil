import { BOSSES } from '@/lib/constants';
import { levelFromXp, XP_TABLE } from '@/lib/xp';

// Where each goal stands, from numbers the page already has. Pure (tests/pure-module-imports) and the
// same reading the plugin's You tab makes (GoalsView), so the two never disagree about a goal.

export interface GoalRow {
  id: number;
  kind: string;
  metric: string;
  target: number;
  /** Optional deadline, 'YYYY-MM-DD'. */
  dueOn?: string | null;
}

/** Recent gains per day — XP per skill, kills per boss — for the pace line. */
export interface GoalRates {
  skills: Record<string, number>;
  bosses: Record<string, number>;
}

export interface GoalDue {
  /** "by 1 Dec · 50 days left", "overdue by 3 days", "due today". */
  text: string;
  /** "on pace", or "needs 45K/day · doing 30K" — null when there's no rate to judge by. */
  pace: string | null;
  tone: 'ok' | 'behind' | 'overdue';
}

export interface GoalView extends GoalRow {
  label: string;
  /** Null when there is nothing to measure it with yet (no stats, log not synced). */
  current: number | null;
  /** What `current` is measured against (XP for a level, KC, slots). */
  of: number;
  text: string;
  done: boolean;
  /** Present when the goal has a deadline and isn't done yet. */
  due: GoalDue | null;
}

export interface GoalStats {
  skills: { key: string; xp: number }[];
  bosses: { key: string; kc: number }[];
  /** Null until the log is synced. */
  pages: { name: string; obtained: number; total: number }[] | null;
}

const bossLabel = new Map(BOSSES.map((b) => [b.key, b.label]));
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function goalLabel(g: GoalRow): string {
  if (g.kind === 'skill') return `${g.target} ${cap(g.metric)}`;
  if (g.kind === 'boss') return `${g.target.toLocaleString('en-US')} ${bossLabel.get(g.metric) ?? g.metric}`;
  return `${g.metric} log`;
}

const DAY = 86_400_000;

function fmtRate(n: number, kind: string): string {
  if (kind === 'skill') {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1000)}K`;
    return String(Math.round(n));
  }
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
}

/** The deadline half of a goal: how long is left, and whether recent play gets there in time. */
export function goalDue(view: GoalView, rates: GoalRates | undefined, now: Date): GoalDue | null {
  if (!view.dueOn || view.done) return null;
  // Calendar days, the way people count them: 12 Oct → 1 Dec is 50 days, whatever the hour.
  const due = Date.parse(`${view.dueOn}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const daysLeft = Math.round((due - today) / DAY);
  const when = new Date(`${view.dueOn}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(view.dueOn.slice(0, 4) !== now.toISOString().slice(0, 4) ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
  if (daysLeft < 0) {
    const late = -daysLeft;
    return { text: `overdue by ${late} day${late === 1 ? '' : 's'}`, pace: null, tone: 'overdue' };
  }
  const text = daysLeft === 0 ? 'due today' : `by ${when} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  if (view.current == null || (view.kind !== 'skill' && view.kind !== 'boss')) return { text, pace: null, tone: 'ok' };
  const rate = view.kind === 'skill' ? rates?.skills[view.metric] : rates?.bosses[view.metric];
  if (rates == null) return { text, pace: null, tone: 'ok' };
  const need = (view.of - view.current) / Math.max(1, daysLeft);
  const have = rate ?? 0;
  const unit = view.kind === 'skill' ? ' XP' : ' kills';
  if (have >= need) return { text, pace: 'on pace', tone: 'ok' };
  return {
    text,
    pace: `needs ${fmtRate(need, view.kind)}${unit}/day · doing ${fmtRate(have, view.kind)}`,
    tone: 'behind',
  };
}

export function goalProgress(
  g: GoalRow,
  stats: GoalStats,
  opts: { rates?: GoalRates; now?: Date } = {},
): GoalView {
  const view = goalProgressBase(g, stats);
  return { ...view, due: goalDue(view, opts.rates, opts.now ?? new Date()) };
}

function goalProgressBase(g: GoalRow, stats: GoalStats): GoalView {
  const label = goalLabel(g);
  if (g.kind === 'skill') {
    const s = stats.skills.find((x) => x.key === g.metric);
    if (!s) return { ...g, label, current: null, of: 1, text: 'no stats yet', done: false, due: null };
    const of = XP_TABLE[g.target] ?? XP_TABLE[99];
    const done = s.xp >= of;
    return { ...g, label, current: s.xp, of, text: done ? 'Done' : `Lv ${levelFromXp(s.xp)} / ${g.target}`, done, due: null };
  }
  if (g.kind === 'boss') {
    if (stats.skills.length === 0) return { ...g, label, current: null, of: g.target, text: 'no stats yet', done: false, due: null };
    const kc = stats.bosses.find((b) => b.key === g.metric)?.kc ?? 0;
    const done = kc >= g.target;
    return {
      ...g,
      label,
      current: kc,
      of: g.target,
      text: done ? 'Done' : `${kc.toLocaleString('en-US')} / ${g.target.toLocaleString('en-US')}`,
      done,
      due: null,
    };
  }
  const page = stats.pages?.find((p) => p.name.toLowerCase() === g.metric.toLowerCase());
  if (!page) return { ...g, label, current: null, of: 1, text: 'log not synced', done: false, due: null };
  const done = page.total > 0 && page.obtained >= page.total;
  return { ...g, label, current: page.obtained, of: page.total, text: done ? 'Done' : `${page.obtained} / ${page.total}`, done, due: null };
}
