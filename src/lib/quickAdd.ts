// Quick add: paste your list. The pure rules that keep what the admin typed.
//
// Two things used to go wrong silently: a line like "30 Barrows chests" matched a library entry
// written for 20 and became 20; and a list that repeated a tile (or one already on the board) added
// it again with no word. These helpers decide both, with no UI and no database.

import { parseTaskQuery, type TaskCandidate } from '@/lib/taskMatch';
import { retitleForAmount } from '@/lib/tileAmountText';

/** The amount a candidate's config asks for (the hiscores goal for a stat tile, else the count). */
export function configAmount(config: TaskCandidate['config']): { field: 'statGoal' | 'requiredAmount'; value: number } | null {
  const c = config as { statType?: unknown; statGoal?: number | null; requiredAmount?: number | null };
  if (c.statType && typeof c.statGoal === 'number' && c.statGoal > 0) return { field: 'statGoal', value: c.statGoal };
  if (typeof c.requiredAmount === 'number' && c.requiredAmount > 0) return { field: 'requiredAmount', value: c.requiredAmount };
  if (typeof c.statGoal === 'number' && c.statGoal > 0) return { field: 'statGoal', value: c.statGoal };
  return null;
}

export interface Reconciled {
  candidate: TaskCandidate;
  /** Shown beside the row when the matched entry asked for a different amount than was typed. */
  note: string | null;
}

/**
 * Keep the amount the admin typed. A matched library entry carries its own amount; when the line
 * typed another one, the tile uses the typed amount (the title follows it) and the note says what
 * the entry had.
 */
export function reconcileTypedAmount(lineText: string, candidate: TaskCandidate): Reconciled {
  const typed = parseTaskQuery(lineText).amount;
  if (typed == null || typed <= 0) return { candidate, note: null };
  const have = configAmount(candidate.config);
  if (!have || have.value === typed) return { candidate, note: null };
  // Candidates the matcher already built at the typed amount carry the field themselves.
  if (candidate.amountField != null && candidate.amount === typed) return { candidate, note: null };
  const title = retitleForAmount(candidate.title, have.value, typed) ?? candidate.title;
  const fixed: TaskCandidate = {
    ...candidate,
    title,
    titleTemplate: title,
    amount: candidate.amountField != null ? typed : candidate.amount,
    config: { ...candidate.config, [have.field]: typed },
  };
  return {
    candidate: fixed,
    note: `Your library has ${have.value.toLocaleString('en-US')}. Using the ${typed.toLocaleString('en-US')} you typed.`,
  };
}

/** A label reduced to what makes two tiles "the same task". */
export function dupKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface DupFlag {
  /** 'board' = a tile already on the board; 'list' = an earlier line of this paste. */
  where: 'board' | 'list';
  /** For 'list': the 1-based number of the earlier line. */
  line?: number;
}

/**
 * Which lines repeat something. `labels` is each line's final tile title (null while a line is
 * unsettled); `onBoard` the titles already on the board.
 */
export function findDuplicates(labels: (string | null)[], onBoard: string[]): (DupFlag | null)[] {
  const board = new Set(onBoard.map(dupKey).filter(Boolean));
  const seen = new Map<string, number>();
  return labels.map((label, i) => {
    if (!label) return null;
    const k = dupKey(label);
    if (!k) return null;
    if (board.has(k)) return { where: 'board' };
    const first = seen.get(k);
    if (first != null) return { where: 'list', line: first + 1 };
    seen.set(k, i);
    return null;
  });
}
