import type { StatDeltas } from '@/lib/statDeltas';

// This week against last, per skill and per boss, from the daily rows' deltas. Pure, so the profile
// can compute it in the browser from the series it already has (tests/pure-module-imports).

export interface StatTrend {
  /** Gained in the last 7 days (XP for a skill, kills for a boss). */
  week: number;
  /** Gained in the 7 days before that. */
  prev: number;
  /** The last 8 weeks, oldest first — the row's little chart. */
  weeks: number[];
}

export interface Trends {
  skills: Record<string, StatTrend>;
  bosses: Record<string, StatTrend>;
  /** Days the series covers — fewer than 14 and "vs last week" isn't a fair comparison yet. */
  days: number;
}

const WEEKS = 8;

/** `series` oldest first, one entry per day (getDailySeries densifies it). */
export function statTrends(series: { day: string; deltas?: StatDeltas }[]): Trends {
  const out: Trends = { skills: {}, bosses: {}, days: series.length };
  const recent = series.slice(-WEEKS * 7);
  // Week index counted back from the newest day, so "this week" is always the last 7 days.
  for (let i = 0; i < recent.length; i++) {
    const weekFromEnd = Math.floor((recent.length - 1 - i) / 7);
    const slot = WEEKS - 1 - weekFromEnd;
    const d = recent[i].deltas;
    if (!d) continue;
    for (const [kind, map] of [['skills', d.skills], ['bosses', d.bosses]] as const) {
      for (const [key, raw] of Object.entries(map ?? {})) {
        const v = typeof raw === 'number' && raw > 0 ? raw : 0;
        if (!v) continue;
        const t = (out[kind][key] ??= { week: 0, prev: 0, weeks: new Array(WEEKS).fill(0) });
        t.weeks[slot] += v;
      }
    }
  }
  for (const kind of ['skills', 'bosses'] as const) {
    for (const t of Object.values(out[kind])) {
      t.week = t.weeks[WEEKS - 1];
      t.prev = t.weeks[WEEKS - 2];
    }
  }
  return out;
}

/** "▲ 38%", "▼ 12%", "new", or "" when there's nothing to compare. */
export function trendLabel(t: StatTrend | undefined): { text: string; tone: 'up' | 'down' | 'flat' | 'none' } {
  if (!t || (t.week === 0 && t.prev === 0)) return { text: '', tone: 'none' };
  if (t.prev === 0) return { text: 'new', tone: 'up' };
  const pct = Math.round(((t.week - t.prev) / t.prev) * 100);
  if (pct === 0) return { text: '±0%', tone: 'flat' };
  return pct > 0 ? { text: `▲ ${pct}%`, tone: 'up' } : { text: `▼ ${Math.abs(pct)}%`, tone: 'down' };
}
