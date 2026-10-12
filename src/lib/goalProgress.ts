import { BOSSES } from '@/lib/constants';
import { levelFromXp, XP_TABLE } from '@/lib/xp';

// Where each goal stands, from numbers the page already has. Pure (tests/pure-module-imports) and the
// same reading the plugin's You tab makes (GoalsView), so the two never disagree about a goal.

export interface GoalRow {
  id: number;
  kind: string;
  metric: string;
  target: number;
}

export interface GoalView extends GoalRow {
  label: string;
  /** Null when there is nothing to measure it with yet (no stats, log not synced). */
  current: number | null;
  /** What `current` is measured against (XP for a level, KC, slots). */
  of: number;
  text: string;
  done: boolean;
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

export function goalProgress(g: GoalRow, stats: GoalStats): GoalView {
  const label = goalLabel(g);
  if (g.kind === 'skill') {
    const s = stats.skills.find((x) => x.key === g.metric);
    if (!s) return { ...g, label, current: null, of: 1, text: 'no stats yet', done: false };
    const of = XP_TABLE[g.target] ?? XP_TABLE[99];
    const done = s.xp >= of;
    return { ...g, label, current: s.xp, of, text: done ? 'Done' : `Lv ${levelFromXp(s.xp)} / ${g.target}`, done };
  }
  if (g.kind === 'boss') {
    if (stats.skills.length === 0) return { ...g, label, current: null, of: g.target, text: 'no stats yet', done: false };
    const kc = stats.bosses.find((b) => b.key === g.metric)?.kc ?? 0;
    const done = kc >= g.target;
    return {
      ...g,
      label,
      current: kc,
      of: g.target,
      text: done ? 'Done' : `${kc.toLocaleString('en-US')} / ${g.target.toLocaleString('en-US')}`,
      done,
    };
  }
  const page = stats.pages?.find((p) => p.name.toLowerCase() === g.metric.toLowerCase());
  if (!page) return { ...g, label, current: null, of: 1, text: 'log not synced', done: false };
  const done = page.total > 0 && page.obtained >= page.total;
  return { ...g, label, current: page.obtained, of: page.total, text: done ? 'Done' : `${page.obtained} / ${page.total}`, done };
}
