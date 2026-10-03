import { evaluateCollection, type CollectionRequirement } from '@/lib/collectionSets';

// Expected-effort maths for collection tiles.
//
// A collection is a small absorbing Markov process: each source is an action, a drop moves the
// current item counts forward, and after every useful drop the team may switch to whichever source
// is now fastest. Keeping this pure lets the board auditor use exactly the same groupMode /
// groupRequire semantics as tile completion without coupling the maths to the wiki datasets.

export type DropEffortRequirement = CollectionRequirement;

export interface DropEffortOutcome {
  /** Index in the requirements array. */
  requirement: number;
  /** Chance of at least one relevant hit from one action/kill. */
  chance: number;
  /** Average credited item quantity when the hit lands. */
  quantity: number;
}

export interface DropEffortAction {
  source: string;
  /** Wall-clock/person time consumed by one kill or completed raid. */
  hours: number;
  /** Raid unique tables choose one reward; ordinary NPC tables may make independent rolls. */
  exclusive: boolean;
  outcomes: DropEffortOutcome[];
}

const MAX_STATES = 100_000;

function stateKey(state: number[]): string {
  return state.map((n) => Math.round(n * 1e6) / 1e6).join(',');
}

/**
 * Expected hours to satisfy a collection from zero progress.
 *
 * For exclusive tables the next useful drop chance is the sum of its item chances. For ordinary
 * tables it is the union of the independent chances. When several independent items can land on
 * one kill, the embedded-chain approximation attributes that useful kill in proportion to their
 * individual rates. Rare bingo drops make the simultaneous-hit term negligible, while the union
 * still prevents common/multi-roll tables from claiming more than one useful kill per kill.
 *
 * Returns null when no action can finish the collection or the authored state space is too large
 * to audit safely. The caller can then fall back to an explicitly labelled rough estimate.
 */
export function expectedCollectionHours(
  requirements: DropEffortRequirement[],
  groupMode: string | null | undefined,
  actions: DropEffortAction[],
): number | null {
  if (requirements.length === 0 || actions.length === 0) return null;
  if (requirements.some((r) => !Number.isFinite(r.requiredAmount) || r.requiredAmount <= 0)) return null;

  const memo = new Map<string, number>();
  let visited = 0;

  const complete = (state: number[]): boolean =>
    evaluateCollection(
      requirements.map((r, i) => ({ ...r, currentAmount: state[i] ?? 0 })),
      groupMode,
    ).isComplete;

  const solve = (state: number[]): number => {
    if (complete(state)) return 0;
    const key = stateKey(state);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    visited += 1;
    if (visited > MAX_STATES) throw new Error('collection effort state limit exceeded');

    let best = Infinity;
    for (const action of actions) {
      if (!Number.isFinite(action.hours) || action.hours <= 0) continue;
      const active = action.outcomes.filter((o) => {
        const req = requirements[o.requirement];
        return !!req && state[o.requirement] < req.requiredAmount &&
          Number.isFinite(o.chance) && o.chance > 0 && Number.isFinite(o.quantity) && o.quantity > 0;
      });
      if (active.length === 0) continue;

      const rateSum = active.reduce((sum, o) => sum + Math.min(1, o.chance), 0);
      if (rateSum <= 0) continue;
      const progressChance = action.exclusive
        ? Math.min(1, rateSum)
        : 1 - active.reduce((none, o) => none * (1 - Math.min(1, o.chance)), 1);
      if (progressChance <= 0) continue;

      // Conditional on the next useful hit, item identity is rate-proportional. This is exact for
      // mutually exclusive rewards and the standard competing-risks approximation for independent
      // rare drops.
      let future = 0;
      for (const outcome of active) {
        const next = [...state];
        const cap = requirements[outcome.requirement].requiredAmount;
        next[outcome.requirement] = Math.min(cap, next[outcome.requirement] + outcome.quantity);
        future += (outcome.chance / rateSum) * solve(next);
      }
      best = Math.min(best, action.hours / progressChance + future);
    }

    memo.set(key, best);
    return best;
  };

  try {
    const result = solve(requirements.map(() => 0));
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
