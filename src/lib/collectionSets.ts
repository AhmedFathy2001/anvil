// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Collection-tile set logic: which items a tile needs, and when the set(s) count as done.
//
// A collection tile is a drop tile carrying per-item requirements. Items can be tagged with a GROUP,
// and two knobs decide what the groups mean:
//
//   groupMode 'any' (default, and what every pre-existing collection does)
//     Groups are OR-ed alternatives: satisfying ONE of them (plus every ungrouped item) completes
//     the tile. "Collect any one Barrows set."
//
//   groupMode 'all'
//     Groups are AND-ed: EVERY group must be satisfied. Paired with a per-group `groupRequire` of 1
//     this expresses "one of many from each source" — a unique from each DT2 boss, a pet from each
//     GWD boss — which is an AND of ORs and was previously inexpressible: the engine only did OR-ed
//     full sets, so one boss's items finished the whole tile.
//
//   groupRequire (per group)
//     How many DISTINCT items in that group satisfy it. Unset = all of them (a full set), which is
//     why an existing collection is unaffected. `groupRequire: 3` on a six-item group is "any 3 of
//     these 6". Rows within a group should agree; if they disagree (hand-edited JSON) the strictest
//     value wins, clamped to the group's size.
//
// Ungrouped items are ALWAYS required in both modes — they're the "and also" part of a tile.
// Pure and dependency-free (see tests/collection-sets.test.ts): the completion writer, the board's
// per-item display, and the tile editor all read the same rule from here.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type GroupMode = 'any' | 'all';

export interface CollectionRequirement {
  itemId: number;
  name: string;
  requiredAmount: number;
  /** Set name; blank/absent = an always-required item. */
  group?: string | null;
  /** How many distinct items in this group satisfy it. Absent/0 = all of them. */
  groupRequire?: number | null;
}

/** A requirement with the team's progress on it folded in. */
export type CollectionProgressItem = CollectionRequirement & { currentAmount: number };

export interface CollectionGroupState<T extends CollectionProgressItem = CollectionProgressItem> {
  /** Display name, as first written (grouping itself is case-insensitive). */
  name: string;
  items: T[];
  /** How many of `items` must be met — resolved from groupRequire, defaulting to all of them. */
  require: number;
  /** How many are met right now. */
  met: number;
  satisfied: boolean;
}

export interface CollectionState<T extends CollectionProgressItem = CollectionProgressItem> {
  mode: GroupMode;
  /** Always-required items (no group tag). */
  ungrouped: T[];
  groups: CollectionGroupState<T>[];
  isComplete: boolean;
}

export function parseGroupMode(raw: string | null | undefined): GroupMode {
  return raw === 'all' ? 'all' : 'any';
}

/** An item counts once its own required amount is collected. */
export function itemMet(item: CollectionProgressItem): boolean {
  return item.currentAmount >= item.requiredAmount;
}

/**
 * Group rows by their `group` tag (case-insensitively, keeping the first spelling for display) and
 * resolve each group's require count. Order follows first appearance so the board and the CSV
 * round-trip keep the authored order.
 */
export function evaluateCollection<T extends CollectionProgressItem>(
  reqs: T[],
  groupMode: string | null | undefined,
): CollectionState<T> {
  const mode = parseGroupMode(groupMode);
  const ungrouped: T[] = [];
  const order: string[] = [];
  const byKey = new Map<string, { name: string; items: T[]; declared: number[] }>();

  for (const r of reqs) {
    const tag = r.group?.trim();
    if (!tag) {
      ungrouped.push(r);
      continue;
    }
    const key = tag.toLowerCase();
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { name: tag, items: [], declared: [] };
      byKey.set(key, bucket);
      order.push(key);
    }
    bucket.items.push(r);
    if (r.groupRequire != null && r.groupRequire > 0) bucket.declared.push(r.groupRequire);
  }

  const groups = order.map((key) => {
    const bucket = byKey.get(key)!;
    // Strictest declaration wins, clamped to the group's size — a stale "any 4 of" on a group that
    // has since shrunk to 3 items must stay satisfiable.
    const declared = bucket.declared.length > 0 ? Math.max(...bucket.declared) : bucket.items.length;
    const require = Math.min(Math.max(1, declared), bucket.items.length);
    const met = bucket.items.filter(itemMet).length;
    return { name: bucket.name, items: bucket.items, require, met, satisfied: met >= require };
  });

  const ungroupedDone = ungrouped.every(itemMet);
  const groupsDone =
    groups.length === 0 ? true : mode === 'all' ? groups.every((g) => g.satisfied) : groups.some((g) => g.satisfied);

  return { mode, ungrouped, groups, isComplete: ungroupedDone && groupsDone };
}

/**
 * The X in a collection's "X items" display total: the SHORTEST path to completing it. Every
 * ungrouped item, plus — per group — the cheapest `require` items in it. 'any' mode adds only the
 * cheapest group (satisfy one), 'all' mode adds every group (satisfy each). Display only; the real
 * verdict is evaluateCollection, which checks the right items rather than a total.
 */
export function collectionDisplayTotal(
  reqs: CollectionRequirement[],
  groupMode: string | null | undefined,
): number {
  // The evaluator resolves grouping + require counts; borrow it with zero progress.
  const state = evaluateCollection(reqs.map((r) => ({ ...r, currentAmount: 0 })), groupMode);
  const ungroupedSum = state.ungrouped.reduce((sum, r) => sum + r.requiredAmount, 0);
  if (state.groups.length === 0) return ungroupedSum;
  const groupCosts = state.groups.map((g) =>
    [...g.items]
      .map((i) => i.requiredAmount)
      .sort((a, b) => a - b)
      .slice(0, g.require)
      .reduce((sum, n) => sum + n, 0),
  );
  return ungroupedSum + (state.mode === 'all'
    ? groupCosts.reduce((sum, n) => sum + n, 0)
    : Math.min(...groupCosts));
}

/**
 * The line that tells a member what the groups mean, so a board never leaves them guessing whether
 * pieces mix. Null when there are no groups (a flat collection needs no explanation).
 */
export function groupModeHint(state: CollectionState): string | null {
  if (state.groups.length === 0) return null;
  const partial = state.groups.some((g) => g.require < g.items.length);
  if (state.mode === 'all') {
    return partial
      ? 'Every set below must be satisfied — each needs the number of items shown.'
      : 'Every set below must be completed in full.';
  }
  return partial
    ? 'Satisfy any ONE set below — each needs the number of items shown, and sets don’t mix.'
    : 'Complete any ONE set below — pieces from different sets don’t mix.';
}
