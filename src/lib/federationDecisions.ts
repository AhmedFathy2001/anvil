// Federation credit/ingest decisions — the PURE, dependency-free logic behind POST /exchange and
// POST /events. Like lib/federationRelay + lib/federationSecurity this module imports NOTHING from
// `@/` (no DB, Next, or config) so it is unit-testable under Node's native TS type-stripping
// (`node --test`) with no bundler. The route handlers resolve config/DB themselves and pass the
// already-fetched scalars/aggregates in.

// ─────────────────────────────────────────────────────────────────────────────
// §5 / decision 1 — sharedCredit + WIRE §10.4 fan-out crediting decision.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditDecision {
  /** Insert the completion on THIS clan's own tile? */
  creditHome: boolean;
  /** Run the server-side fan-out relay to the member's OTHER clans? (origin only) */
  fanOut: boolean;
  /** When we do NOT credit our own tile, why. */
  refusal?: 'exclusive';
}

/**
 * Decide whether to credit our own tile and whether to fan out (WIRE §5 / §10.4, decision 1).
 *
 * The critical correctness point (finding #2): an `exclusive` home that is *simultaneously* crediting
 * elsewhere (`fanoutCount > 1`) skips ONLY its own home credit — it STILL proceeds to relay the credit
 * to the member's other clans, each of which applies its OWN `sharedCredit` independently. We never
 * return early and drop the whole-mesh credit. A LEAF (inbound relayed) ingest that is `exclusive`
 * simply refuses — it never fans out (only the origin home does).
 */
export function decideCredit(deps: {
  sharedCredit: 'accept' | 'exclusive';
  fanoutCount: number;
  isOrigin: boolean;
}): CreditDecision {
  const exclusiveBlocked = deps.sharedCredit === 'exclusive' && deps.fanoutCount > 1;
  if (!exclusiveBlocked) {
    return { creditHome: true, fanOut: deps.isOrigin };
  }
  // exclusive + multi-clan: skip our own credit. The origin still relays onward; a leaf just refuses.
  return { creditHome: false, fanOut: deps.isOrigin, refusal: 'exclusive' };
}

// ─────────────────────────────────────────────────────────────────────────────
// #1 over-submission cap — mirrors the native submissions route (…/submissions/route.ts).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when the tile is ALREADY at/over its required threshold — never credit past completion, for
 * BOTH a home credit and a relayed cross-clan ingest (finding #1). Each clan checks its OWN tile, so
 * an origin whose home tile is complete can still relay to clans that are not (the caller gates
 * fan-out separately). The caller fetches the relevant aggregate (SUM / MAX / per-item SUM) and passes
 * it in; this only holds the mode→threshold comparison so it stays pure + testable.
 */
export function tileAtCapacity(deps: {
  tileType: string;
  requiredAmount: number | null;
  simpleTotal?: number; // SUM(amount) over tile+team (simple count tiles + valuetotal)
  bestHaul?: number; // MAX(amount) over tile+team (value tiles — independent hauls)
  itemRequired?: number | null; // per-item requiredAmount when the tile is per-item tracked
  itemTotal?: number; // SUM(amount) over tile+team+itemId
}): boolean {
  // Per-item tracked tile: the cap is the specific item's own required amount.
  if (deps.itemRequired != null) {
    return (deps.itemTotal ?? 0) >= deps.itemRequired;
  }
  const required = deps.requiredAmount ?? 0;
  if (required <= 0) return false; // no threshold → never "complete" by amount alone
  if (deps.tileType === 'value') {
    // value: each submission is an independent haul — complete once a single haul met the target.
    return (deps.bestHaul ?? 0) >= required;
  }
  // valuetotal + simple + all count tiles: cumulative sum toward the target.
  return (deps.simpleTotal ?? 0) >= required;
}

/**
 * #9 over-submission REMAINDER clamp — mirror the native submissions route (…/submissions/route.ts):
 * `tileAtCapacity` only refuses a tile ALREADY at/over its threshold, but an under-threshold tile must
 * still not be credited PAST it (amount 5 on a 0/3 tile must write 3, not 5). Returns the amount to
 * actually credit, clamped to the remaining need. Runs for BOTH the home credit and a relayed leaf
 * ingest — each clan clamps against its OWN tile.
 *
 * Modes that DON'T clamp (mirroring native): `value` (each submission is an independent haul that may
 * overshoot) and `valuetotal` (the final haul may overshoot the aggregate target). Per-item and simple
 * cumulative-count tiles clamp to the item's / tile's remaining. No threshold → never clamped.
 */
export function clampCreditAmount(deps: {
  requestedAmount: number;
  tileType: string;
  requiredAmount: number | null;
  simpleTotal?: number; // SUM(amount) over tile+team (simple count tiles)
  itemRequired?: number | null; // per-item requiredAmount when the tile is per-item tracked
  itemTotal?: number; // SUM(amount) over tile+team+itemId
}): number {
  const requested = deps.requestedAmount;
  // Per-item tracked tile: clamp to the specific item's own remaining need.
  if (deps.itemRequired != null) {
    const remaining = deps.itemRequired - (deps.itemTotal ?? 0);
    return remaining > 0 ? Math.min(requested, remaining) : 0;
  }
  const required = deps.requiredAmount ?? 0;
  if (required <= 0) return requested; // no threshold → never clamped
  // value + valuetotal: independent / overshoot-allowed hauls — never remainder-clamped (native parity).
  if (deps.tileType === 'value' || deps.tileType === 'valuetotal') return requested;
  // simple + all cumulative count tiles: clamp to the tile's remaining need.
  const remaining = required - (deps.simpleTotal ?? 0);
  return remaining > 0 ? Math.min(requested, remaining) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// #3 home-credit gate — a home-side "can't credit here" condition on the ORIGIN must SKIP the home
// credit but STILL relay to the member's other clans (a force-ended / non-enrolled HOME must not
// silently drop the credit at still-live clans). On a LEAF there is nothing to relay → it aborts.
// ─────────────────────────────────────────────────────────────────────────────

export type HomeGate = 'credit' | 'skip-relay' | 'abort';

/**
 * Decide what a home-side gating condition does. `blockedReason == null` → the home credit proceeds.
 * Otherwise: the ORIGIN skips its own credit but keeps fanning out (`skip-relay`); a LEAF (inbound
 * relayed write) has nothing to relay, so the same condition aborts (`abort`). Only genuine
 * auth/malformed-request failures abort unconditionally — those never reach this gate.
 */
export function homeCreditGate(deps: { isOrigin: boolean; blockedReason: string | null }): HomeGate {
  if (!deps.blockedReason) return 'credit';
  return deps.isOrigin ? 'skip-relay' : 'abort';
}

// ─────────────────────────────────────────────────────────────────────────────
// #1 proof enforcement — runs on the LEAF too (not just the origin). A proof-required tile must carry
// a proof reference; a relayed leaf write MUST carry the origin's proof (federatedProofUrl).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when a submission satisfies its tile's proof requirement. Count-only tiles never require proof.
 * Otherwise the ORIGIN needs its own uploaded (managed) image; a FEDERATED leaf write needs the origin's
 * proof reference (`federatedProofUrl`, stored audit-only). finding #1: enforce on the LEAF path too —
 * a proof-required tile with NEITHER an image NOR a federated proof ref must be REJECTED, not credited.
 */
export function federatedProofSatisfied(deps: {
  isCountOnly: boolean;
  isOrigin: boolean;
  hasOwnImage: boolean; // origin: an uploaded managed-media proof is present
  hasFederatedProof: boolean; // leaf: the origin's audit-only proof reference is present
}): boolean {
  if (deps.isCountOnly) return true; // count-only tiles never require a screenshot
  return deps.isOrigin ? deps.hasOwnImage : deps.hasFederatedProof;
}

// ─────────────────────────────────────────────────────────────────────────────
// #11 auto-guest conflict resolution — never mint a token for a departed (leftAt) guest.
// ─────────────────────────────────────────────────────────────────────────────

export type GuestConflictPlan = 'reuse' | 'reactivate' | 'missing';

/**
 * After an `onConflictDoNothing` guest insert lost the race with an EXISTING row of the same
 * rsn_normalized, decide what to do with that row (finding #11). The unique index is on rsn_normalized
 * regardless of `leftAt`, so the conflicting row may be a SOFT-REMOVED (departed) guest — we must NOT
 * return it as-is and mint a token for a `leftAt` member. An active row is reused; a departed row is
 * reactivated (cleared `leftAt`) so the caller can safely reuse it as an inert guest again.
 */
export function planGuestConflict(row: { leftAt: string | null } | null | undefined): GuestConflictPlan {
  if (!row) return 'missing';
  return row.leftAt == null ? 'reuse' : 'reactivate';
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared-RSN claim classification ("Share my RSN with this clan"). A home-attested RSN claim may
// only ever land on a FEDERATION GUEST row of the same discord identity — never bind to, rename, or
// reactivate anyone else's row (identity-takeover class). But "anyone else's" must not include the
// member THEMSELVES: an account they already linked here directly (account token / roster claim) is
// the same identity holding the name through a STRONGER path, so the claim is satisfied, not a
// takeover — treating it as a conflict made sharing look like it silently did nothing.
// ─────────────────────────────────────────────────────────────────────────────

export type SharedRsnClaim =
  | 'free' // no row holds the name — the claimant may create/rename onto it
  | 'own-guest' // an existing federation guest of this same identity — reusable/renamable
  | 'satisfied' // the same identity already holds the name via a non-federation row — nothing to do
  | 'conflict'; // someone else's row — refuse and audit

export function classifySharedRsnClaim(
  row:
    | { isGuest: number | null; source: string | null; discordId: string | null; userId: number | null }
    | null
    | undefined,
  discordId: string,
  ownerUserId: number | null,
): SharedRsnClaim {
  if (!row) return 'free';
  if (row.isGuest === 1 && row.source === 'federation' && row.discordId === discordId) {
    return 'own-guest';
  }
  if (row.discordId === discordId || (ownerUserId != null && row.userId === ownerUserId)) {
    return 'satisfied';
  }
  return 'conflict';
}

/**
 * May a shared-RSN claim RENAME the anchor row the exchange token is bound to? Only a disposable
 * federation PLACEHOLDER may be — never a real row someone actually plays as.
 *
 * Both conditions are load-bearing. `source` alone misses a federation guest an admin promoted via
 * "Promote to member": that flips isGuest to 0 but leaves source='federation', so a rename would hit
 * a now-REAL member row on the next relay. `isGuest` alone would let a federated claim rename an
 * ordinary roster-created guest. An ADOPTED anchor (a real row picked up by ensureFederationGuest)
 * fails both and is left alone, which is the point.
 */
export function anchorRenamable(
  anchor: { source: string | null; isGuest: number | null } | null | undefined,
): boolean {
  if (!anchor) return false;
  return anchor.source === 'federation' && anchor.isGuest === 1;
}

// #12 the `missing` conflict plan (the conflicting row vanished between the failed insert and the
// re-read — astronomically unlikely) retries the find-or-create, but that retry must be BOUNDED: the
// prior implementation recursed with no depth counter, so a pathological churn could recurse forever /
// blow the stack. One retry is enough; after that the caller surfaces an error.
export const MAX_GUEST_CONFLICT_RETRIES = 1;

/** True once the guest find-or-create has used up its bounded retry budget (finding #12). */
export function guestConflictExhausted(attempt: number): boolean {
  return attempt >= MAX_GUEST_CONFLICT_RETRIES;
}

// ─────────────────────────────────────────────────────────────────────────────
// #14 rate-limit keying — the EXCHANGE caller is the relaying home site (one IP for the whole clan),
// so IP-based limits collapse every member into one bucket. Key on the MEMBER identity (`sub` /
// discord_id from the VERIFIED assertion) so limits are per-member, not per-home-clan.
// ─────────────────────────────────────────────────────────────────────────────

export function exchangeRateLimitKey(sub: string): string {
  return `sub:${sub}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// #5 replay-before-budget ordering — a replayed assertion must be rejected WITHOUT consuming the
// victim member's per-member exchange budget. Replaying one captured assertion 30× would otherwise
// drain `sub`'s bucket before the single-use check ever runs. This orchestrator makes the ordering
// explicit + unit-testable: the single-use (jti) check runs first, and the budget is consumed ONLY on
// a fresh (non-replay) assertion.
// ─────────────────────────────────────────────────────────────────────────────

export type ReplayBudgetGate<B> =
  | { outcome: 'replay' }
  | { outcome: 'rate-limited'; budget: B }
  | { outcome: 'ok'; budget: B };

/**
 * finding #5: run the single-use `recordJti` check BEFORE consuming the per-member budget. On a replay
 * (`recordJti` → false) return `replay` and NEVER call `consumeBudget` — the victim's bucket is
 * untouched. Only a fresh assertion consumes the budget (exactly once).
 */
export async function gateReplayThenBudget<B>(deps: {
  recordJti: () => Promise<boolean>; // true = fresh (first use); false = replay
  consumeBudget: () => Promise<B>; // called ONLY when fresh
  budgetOk: (budget: B) => boolean;
}): Promise<ReplayBudgetGate<B>> {
  const fresh = await deps.recordJti();
  if (!fresh) return { outcome: 'replay' };
  const budget = await deps.consumeBudget();
  return deps.budgetOk(budget) ? { outcome: 'ok', budget } : { outcome: 'rate-limited', budget };
}

export function guestRateLimitKey(sub: string): string {
  return `guest:${sub}`;
}
