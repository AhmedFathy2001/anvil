import { isFallenDeath } from '@/lib/hardcoreFall';

// Back-to-back repeats in a feed, shown once with "×N". Someone dying to Vorkath fifteen times in a
// row is one story, not fifteen rows pushing everything else off the list.
//
// A RUN is consecutive entries in a feed's display order (newest first) by the same person with
// nothing else between them:
//   - deaths by the same person, whatever killed them (the killer is named when it's always the same);
//   - anything else only when the row would read identically: same kind, person, item, amount, source.
//     Two different drops, pets or achievements are two stories and never merge.
// A Hardcore Worlds fall is the end of a character, never part of a run.
//
// The run shows as its NEWEST entry: that row's id, time and reactions. Pure: every feed (the plugin
// panel, its live rows in lib/panelRows, the site's Moments lists) runs its own ordered list through it.

/** Neighbours further apart than this aren't "back-to-back": a death today and one yesterday are two rows. */
export const RUN_GAP_MS = 6 * 60 * 60 * 1000;

/** What a moment needs for its run to be judged. */
export interface Runnable {
  id: number;
  rsn: string;
  kind: string;
  itemId?: number | null;
  itemName?: string | null;
  quantity?: number;
  source?: string | null;
  tier?: string | null;
  sourceKind?: string | null;
  occurredAt: string;
}

/** A run's facts, on its newest entry. Only present when the run is two or more. */
export interface RunInfo {
  /** How many entries it stands for. */
  n: number;
  /** The oldest entry's time (the newest's is the row's own). */
  firstAt: string;
  /** Deaths to different killers: the row names only the latest. */
  mixed: boolean;
  /** Every entry's id, newest first (the row's own first). */
  ids: number[];
}

export type WithRun<T> = T & { run?: RunInfo };

const norm = (rsn: string) => rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');

/** A stored timestamp in either form ('YYYY-MM-DD HH:MM:SS' UTC or ISO) as ms; NaN when unreadable. */
export function stampMs(s: string): number {
  if (!s) return NaN;
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

/**
 * The key a moment's run is judged by: equal keys side by side merge. Null never merges (and breaks
 * any run it sits in).
 */
export function runKey(m: Runnable): string | null {
  if (m.kind === 'death') return isFallenDeath(m) ? null : `death|${norm(m.rsn)}`;
  return [m.kind, norm(m.rsn), m.itemId ?? '', m.itemName ?? '', m.quantity ?? 1, m.source ?? '', m.tier ?? '', m.sourceKind ?? ''].join('|');
}

/**
 * Consecutive entries with the same non-null key, each within `gapMs` of the one before it, grouped.
 * `list` is in display order (newest first) and is not re-sorted: what sits between two entries on
 * screen is what sits between them here. Each group's members keep that order, newest first.
 */
export function collapseRuns<T>(list: readonly T[], keyOf: (x: T) => string | null, atOf: (x: T) => number, gapMs = RUN_GAP_MS): T[][] {
  const out: T[][] = [];
  let key: string | null = null;
  for (const x of list) {
    const k = keyOf(x);
    const cur = out[out.length - 1];
    const prev = cur?.[cur.length - 1];
    if (cur && k != null && k === key && prev !== undefined && Math.abs(atOf(prev) - atOf(x)) <= gapMs) {
      cur.push(x);
      continue;
    }
    out.push([x]);
    key = k;
  }
  return out;
}

/** A group's run facts, or undefined for a group of one. */
export function runInfoOf(members: readonly Runnable[]): RunInfo | undefined {
  if (members.length < 2) return undefined;
  const head = members[0];
  return {
    n: members.length,
    firstAt: members[members.length - 1].occurredAt,
    mixed: head.kind === 'death' && members.some((m) => (m.source ?? '') !== (head.source ?? '')),
    ids: members.map((m) => m.id),
  };
}

/** A moment list in display order, each run down to its newest entry carrying `run`. */
export function collapseMomentRuns<T extends Runnable>(list: readonly T[], gapMs = RUN_GAP_MS): WithRun<T>[] {
  return collapseRuns(list, runKey, (m) => stampMs(m.occurredAt), gapMs).map((g) => {
    const run = runInfoOf(g);
    return run ? { ...g[0], run } : g[0];
  });
}

/** "×12": the count a collapsed row carries after its text. */
export function runSuffix(run: { n: number } | undefined | null): string {
  return run && run.n > 1 ? ` ×${run.n}` : '';
}

/** A hover line for a collapsed row on the site: "12 in a row, 14:02 to 16:40". */
export function runTooltip(run: RunInfo | undefined, lastAt: string): string | undefined {
  if (!run) return undefined;
  const fmt = (s: string) => {
    const ms = stampMs(s);
    return Number.isNaN(ms) ? '' : new Date(ms).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };
  const a = fmt(run.firstAt);
  const b = fmt(lastAt);
  return a && b ? `${run.n} in a row, ${a} to ${b} UTC` : `${run.n} in a row`;
}
