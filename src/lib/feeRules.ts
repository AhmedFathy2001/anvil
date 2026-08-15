// When a paid fee is settled, and who is allowed to settle it.
//
// The rule has always been separation of duties: whoever collected the money can't also be the one
// who signs off that it arrived, so a fee sits at 'collected' until a DIFFERENT admin confirms it.
// That is the right default for a clan with several staff and real money moving.
//
// It is the wrong rule for a clan whose treasurer is the owner. There, "34 fees waiting on a second
// signature" is not a control — it is a queue that can never be cleared, because there is nobody
// else to clear it, and it becomes the loudest thing on the dashboard forever. That clan needs to
// say "marking it paid IS the sign-off", which is what a required count of 0 means.
//
// So the setting spans 0–5 rather than 1–5, and every path that settles a fee — the single confirm,
// the bulk confirm, the end-of-event auto-close, and (at 0) marking it paid — comes through this
// one decision so the rule can't drift between them.
//
// Pure and dependency-free (no `@/` imports) so tests/fee-rules.test.ts can run it directly with
// Node type-stripping, the same way lib/eventStage and lib/scheduleLanes do.

export const MAX_CONFIRMATIONS_REQUIRED = 5;

/** The default when a clan has never set one: a single second pair of eyes. */
export const DEFAULT_CONFIRMATIONS_REQUIRED = 1;

export interface FeeConfirmation {
  userId: number;
  at: string;
}

export type ConfirmOutcome =
  /** Settled: status becomes 'confirmed'. */
  | 'confirmed'
  /** Vote recorded, still short of the required count. Fee stays 'collected'. */
  | 'recorded'
  /** Nothing to do: already settled, or this admin already voted. */
  | 'noop'
  /** Refused: the collector can't sign off on their own collection. */
  | 'own-collection'
  /** Refused: nobody has marked this fee paid yet. */
  | 'not-collected';

export interface FeeState {
  status: string;
  collectedByUserId: number | null;
  confirmations: FeeConfirmation[];
}

export interface ConfirmDecision {
  outcome: ConfirmOutcome;
  /** The confirmation list to persist. Unchanged from the input unless a vote was cast. */
  confirmations: FeeConfirmation[];
  /** True when this decision settles the fee. */
  settled: boolean;
  /**
   * Whether the stored proof screenshot should be dropped now the fee is settled.
   *
   * Normally yes — it existed to support a reviewer's decision, and once that decision is made it
   * is storage nobody reads. Not when no confirmation was ever required: there was no reviewer, so
   * the screenshot is the only record the money moved, and deleting it seconds after upload would
   * throw away the very thing the collector attached.
   */
  dropProof: boolean;
}

/**
 * How many distinct staff confirmations a paid fee needs, from the raw setting value.
 *
 * 0 is meaningful and deliberate ("marking it paid settles it"); anything unparseable falls back to
 * the default rather than to 0, so a typo can never silently switch a clan's controls off.
 */
export function clampRequiredConfirmations(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_CONFIRMATIONS_REQUIRED;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_CONFIRMATIONS_REQUIRED;
  if (n < 0) return 0;
  return Math.min(n, MAX_CONFIRMATIONS_REQUIRED);
}

/** True when this clan has turned the second signature off entirely. */
export function settlesOnCollect(required: number): boolean {
  return required <= 0;
}

/**
 * Decide what one confirmation attempt does.
 *
 * `actorUserId` of 0 or less means "no human actor" — the end-of-event auto-close. That path has
 * nobody to be separate from, so it settles outright; it is gated behind its own clan setting and
 * recorded as `auto` in the audit trail so the difference stays visible afterwards.
 */
export function decideConfirmation(
  fee: FeeState,
  actorUserId: number,
  required: number,
  now: string,
  opts: { auto?: boolean } = {},
): ConfirmDecision {
  const auto = opts.auto === true;
  const unchanged = (outcome: ConfirmOutcome): ConfirmDecision => ({
    outcome,
    confirmations: fee.confirmations,
    settled: false,
    dropProof: false,
  });

  if (fee.status === 'confirmed') return unchanged('noop');
  if (!fee.collectedByUserId) return unchanged('not-collected');

  // With no confirmations required there is no second step, so there is nothing for the collector
  // to be separate from — their own collection settles.
  const noSecondSignature = settlesOnCollect(required);

  if (!auto && !noSecondSignature && fee.collectedByUserId === actorUserId) {
    return unchanged('own-collection');
  }
  if (!auto && fee.confirmations.some((c) => c.userId === actorUserId)) {
    return unchanged('noop');
  }

  // The auto path settles outright rather than casting a vote it cannot attribute to anyone.
  const confirmations =
    auto || noSecondSignature
      ? fee.confirmations
      : [...fee.confirmations, { userId: actorUserId, at: now }];

  const settled = auto || noSecondSignature || confirmations.length >= required;

  return {
    outcome: settled ? 'confirmed' : 'recorded',
    confirmations,
    settled,
    dropProof: settled && !noSecondSignature,
  };
}
