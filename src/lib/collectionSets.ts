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
//   setsRequired ('any' mode only)
//     How many sets the tile needs; absent = 1. Sets are COUNTED, across groups and within one: a
//     group counts once per full batch of its pieces (setTimes), so 2 is "Ahrim's + Dharok's, or
//     Ahrim's twice". Pieces still never mix between groups.
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
  /** How many times over this set is done (setTimes) — what 'any' mode with setsRequired > 1 counts. */
  times: number;
}

export interface CollectionState<T extends CollectionProgressItem = CollectionProgressItem> {
  mode: GroupMode;
  /** Sets the tile needs in 'any' mode (1 unless the tile says otherwise); 'all' mode ignores it. */
  setsRequired: number;
  /** Sets done so far in 'any' mode, summed across groups (capped at nothing — display clamps). */
  setsDone: number;
  /** Always-required items (no group tag). */
  ungrouped: T[];
  groups: CollectionGroupState<T>[];
  isComplete: boolean;
}

export function parseGroupMode(raw: string | null | undefined): GroupMode {
  return raw === 'all' ? 'all' : 'any';
}

/** A tile's sets-required knob, normalised: anything missing or below 1 is the historical one set. */
export function parseSetsRequired(raw: number | null | undefined): number {
  return raw != null && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

/**
 * How many times over a set is complete: the largest k such that `require` of its items each have
 * k × their own amount. A full set (require = every item) is therefore bounded by its rarest piece —
 * two Ahrim's hoods and one of everything else is ONE Ahrim's set.
 */
export function setTimes(items: CollectionProgressItem[], require: number): number {
  if (items.length === 0 || require < 1) return 0;
  const perItem = items
    .map((i) => Math.floor(i.currentAmount / Math.max(1, i.requiredAmount)))
    .sort((a, b) => b - a);
  return perItem[Math.min(require, perItem.length) - 1] ?? 0;
}

/**
 * The most of ONE item a tile can use. Each item normally caps at its own amount; in 'any' mode
 * with N sets, one group may supply all N, so a piece is useful up to N × its amount. The plugin
 * and the submission guard both cap on this, or the second Ahrim's hood would be refused.
 */
export function itemCap(
  req: Pick<CollectionRequirement, 'requiredAmount' | 'group'>,
  groupMode: string | null | undefined,
  setsRequired: number | null | undefined,
): number {
  const amount = Math.max(1, req.requiredAmount);
  if (!req.group?.trim() || parseGroupMode(groupMode) === 'all') return amount;
  return amount * parseSetsRequired(setsRequired);
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
  setsRequiredRaw?: number | null,
): CollectionState<T> {
  const mode = parseGroupMode(groupMode);
  const setsRequired = parseSetsRequired(setsRequiredRaw);
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
    return { name: bucket.name, items: bucket.items, require, met, satisfied: met >= require, times: setTimes(bucket.items, require) };
  });

  const ungroupedDone = ungrouped.every(itemMet);
  const setsDone = groups.reduce((sum, g) => sum + g.times, 0);
  const groupsDone =
    groups.length === 0 ? true : mode === 'all' ? groups.every((g) => g.satisfied) : setsDone >= setsRequired;

  return { mode, setsRequired, setsDone, ungrouped, groups, isComplete: ungroupedDone && groupsDone };
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
  setsRequired?: number | null,
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
    : Math.min(...groupCosts) * parseSetsRequired(setsRequired));
}

// ── How it counts ───────────────────────────────────────────────────────────────────────────────
// ONE sentence that tells a member what an item tile wants, written here and nowhere else: the
// board, the tile detail, the editor's preview and the RuneLite sidebar (sent as text in the plugin
// payloads) all show this, so the site and the plugin can't explain the same tile two ways again.
// Written for someone skimming — the number and the catch ("repeats count", "pieces don't mix")
// up front.

export type CountMode = 'total' | 'distinct';

export function parseCountMode(raw: string | null | undefined): CountMode {
  return raw === 'distinct' ? 'distinct' : 'total';
}

export interface HowItCountsTile {
  tileType: string | null | undefined;
  requiredAmount: number | null | undefined;
  /** Drop pools: how many items are in the pool. */
  poolSize?: number | null;
  countMode?: string | null;
  itemRequirements?: CollectionRequirement[] | null;
  groupMode?: string | null;
  setsRequired?: number | null;
}

// "Ahrim's set" and "Ahrim's" both read as "the Ahrim's set", never "the Ahrim's set set".
const setName = (name: string) => name.replace(/\s+set$/i, '');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${SPELLED[n] ?? n} times`);

/** The sentence for an item tile, or null for a tile that isn't one. */
export function howItCounts(tile: HowItCountsTile): string | null {
  const reqs = tile.itemRequirements ?? [];
  if (reqs.length > 0) return collectionSentence(reqs, tile.groupMode, tile.setsRequired);
  if (tile.tileType !== 'drop') return null;

  const need = Math.max(1, tile.requiredAmount ?? 1);
  const pool = tile.poolSize ?? 0;
  if (pool <= 1) {
    return need === 1 ? 'Get the item below.' : `Get ${need} of the item below — every drop adds to the total.`;
  }
  if (parseCountMode(tile.countMode) === 'distinct') {
    return need === 1
      ? 'Get any ONE of the items below.'
      : `Get ${need} DIFFERENT items from the list below — getting the same item again doesn’t count.`;
  }
  return need === 1
    ? 'Get any ONE of the items below.'
    : `Get ${need} drops of any items below — mix and match, and repeats count (${need}× the same item is fine).`;
}

function collectionSentence(reqs: CollectionRequirement[], groupMode: string | null | undefined, setsRequiredRaw: number | null | undefined): string {
  const state = evaluateCollection(reqs.map((r) => ({ ...r, currentAmount: 0 })), groupMode, setsRequiredRaw);
  const allOnes = (list: CollectionRequirement[]) => list.every((r) => Math.max(1, r.requiredAmount) === 1);
  if (state.groups.length === 0) {
    return allOnes(reqs)
      ? `Get EVERY item below — one of each (${plural(reqs.length, 'item')}).`
      : 'Get EVERY item below, in the amount shown next to each.';
  }

  const always = state.ungrouped.length > 0 ? ' Plus every item under “Always required”.' : '';
  const partial = state.groups.some((g) => g.require < g.items.length);
  const pieces = (g: CollectionGroupState) => (g.require < g.items.length ? `any ${g.require} of its ${g.items.length} pieces` : `all ${g.items.length} pieces`);

  if (state.mode === 'all') {
    return (partial
      ? 'Complete EVERY set below — each needs the number of pieces shown.'
      : 'Complete EVERY set below in full.') + always;
  }

  const n = state.setsRequired;
  const sameSize = state.groups.every((g) => g.require === state.groups[0].require && g.items.length === state.groups[0].items.length);
  const what = !sameSize
    ? ' — each set needs the pieces shown'
    : n === 1
      ? ` — ${pieces(state.groups[0])} of the SAME set`
      : ` — each one needs ${pieces(state.groups[0])} of the same set`;
  if (state.groups.length === 1) {
    const g = setName(state.groups[0].name);
    return (n === 1
      ? `Complete the ${g} set${what}.`
      : `Complete the ${g} set ${times(n)}${what}.`) + always;
  }
  if (n === 1) {
    return `Complete ANY ONE set below${what}. Pieces from different sets don’t mix.${always}`;
  }
  const [a, b] = state.groups.map((g) => setName(g.name));
  return `Complete ${n} sets${what}. Any ${n} count — e.g. ${a} + ${b}, or ${a} ${times(n)}. Pieces from different sets don’t mix.${always}`;
}
