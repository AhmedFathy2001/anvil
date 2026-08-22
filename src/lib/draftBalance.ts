import { computePlayerProfiles, type PlayerProfile } from '@/lib/playerProfile';
import { STRENGTH_EXPONENT, spreadCapVerdict } from '@/lib/draftMath';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Draft-side balance helpers (balance-engine plan, Part C). One profile engine underneath every
// mode; these helpers turn profiles into the three things the draft needs:
//   - tiers (S/A/B/C by rating quartile within THIS event's pool)
//   - projected team strength (Σ rating^1.5 — the backtest's sharpen exponent, which matched the
//     power-law shape of real contributions)
//   - pick steering: tier-coverage eligibility (tiered-snake) and weakest-picks-next ordering
//     (dynamic-order)
// Everything here is advisory arithmetic — event start is never blocked by any of it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type Tier = 'S' | 'A' | 'B' | 'C';
const SHARPEN = STRENGTH_EXPONENT;
/** Tiers whose stacking the tiered-snake mode polices. B/C picks stay pure captain agency. */
const COVERAGE_TIERS: Tier[] = ['S', 'A'];

export interface DraftBalance {
  profiles: PlayerProfile[];
  /** Every player row id → the person's profile (multi-account rows share one profile). */
  byPlayerId: Map<number, PlayerProfile>;
  tierByPersonKey: Map<string, Tier>;
}

export async function buildDraftBalance(eventId: number): Promise<DraftBalance> {
  const profiles = await computePlayerProfiles({ eventId });
  const byPlayerId = new Map<number, PlayerProfile>();
  for (const p of profiles) for (const id of p.playerIds) byPlayerId.set(id, p);
  // Quartile tiers within the pool (rating-sorted already): top 25% S, then A, then B, rest C.
  const tierByPersonKey = new Map<string, Tier>();
  const n = profiles.length;
  profiles.forEach((p, i) => {
    const q = n <= 1 ? 0 : i / n;
    tierByPersonKey.set(p.personKey, q < 0.25 ? 'S' : q < 0.5 ? 'A' : q < 0.75 ? 'B' : 'C');
  });
  return { profiles, byPlayerId, tierByPersonKey };
}

export function tierOf(balance: DraftBalance, playerId: number): Tier | null {
  const profile = balance.byPlayerId.get(playerId);
  return profile ? (balance.tierByPersonKey.get(profile.personKey) ?? null) : null;
}

/** Projected strength per team: Σ rating^1.5 of the people currently on it. */
export function projectedStrengths(balance: DraftBalance, teamIds: number[]): Map<number, number> {
  const strengths = new Map<number, number>(teamIds.map((id) => [id, 0]));
  for (const p of balance.profiles) {
    if (p.teamId == null || !strengths.has(p.teamId)) continue;
    strengths.set(p.teamId, (strengths.get(p.teamId) ?? 0) + Math.pow(p.rating, SHARPEN));
  }
  return strengths;
}

/**
 * Tiered-snake eligibility: a team may take an S/A-tier player only while its count of that tier
 * doesn't exceed the lowest count across all teams — "every team takes an S before anyone takes a
 * second S". Returns null when eligible, else a human-readable reason for the 400.
 */
export function tierPickBlockReason(
  balance: DraftBalance,
  playerId: number,
  pickingTeamId: number,
  teamIds: number[],
): string | null {
  const tier = tierOf(balance, playerId);
  if (tier == null || !COVERAGE_TIERS.includes(tier)) return null;
  const counts = new Map<number, number>(teamIds.map((id) => [id, 0]));
  for (const p of balance.profiles) {
    if (p.teamId == null || !counts.has(p.teamId)) continue;
    if (balance.tierByPersonKey.get(p.personKey) === tier) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
  }
  const mine = counts.get(pickingTeamId) ?? 0;
  const min = Math.min(...counts.values());
  if (mine <= min) return null;
  // Blocking only matters while a same-tier player is actually available to the lagging team.
  const poolHasTier = balance.profiles.some(
    (p) => p.teamId == null && balance.tierByPersonKey.get(p.personKey) === tier,
  );
  if (!poolHasTier) return null;
  return `Tier-${tier} coverage: every team takes a tier-${tier} player before anyone takes another. Pick from a lower tier this turn.`;
}

/**
 * Spread-cap eligibility: how far above the average roster a team may put itself with this pick.
 *
 * Stronger than tiered-snake, which only polices the top two tiers — this binds on every pick, and
 * binds hardest on whoever is already ahead.
 *
 * Two cases, because a threshold alone degenerates:
 *   - the team can stay under the cap → they may only take someone who keeps them there.
 *   - the team is ALREADY over it → every pick breaches, so a pure threshold would stop applying
 *     exactly when the lead is worst. Instead they may only take from the least-damaging options
 *     left: "you're over, so pick from the bottom."
 *
 * Never stalls: the allowed set is non-empty in both cases, because the second case is defined by
 * the minimum achievable rather than by a fixed number.
 *
 * There is deliberately NO "don't block the team that's behind on picks" rule. A snake draft keeps
 * every team within one pick of each other, so such a rule fires for everyone at the start of each
 * round and the cap becomes a no-op — which is exactly what it did when it was written that way.
 */
export function spreadCapBlockReason(
  balance: DraftBalance,
  playerId: number,
  pickingTeamId: number,
  teamIds: number[],
  capPct: number,
): string | null {
  const person = balance.byPlayerId.get(playerId);
  if (!person) return null;

  const rosters = new Map<number, number[]>(teamIds.map((id) => [id, []]));
  for (const p of balance.profiles) {
    if (p.teamId != null && rosters.has(p.teamId)) rosters.get(p.teamId)!.push(p.rating);
  }

  const verdict = spreadCapVerdict({
    rosters,
    pickingTeamId,
    candidateRating: person.rating,
    poolRatings: balance.profiles
      .filter((p) => p.teamId == null && p.playerIds.length > 0)
      .map((p) => p.rating),
    capPct,
  });
  if (verdict.allowed) return null;

  // "per pick" is not padding: the panel's bars measure TOTAL roster strength, and these two
  // numbers legitimately differ mid-round. Saying which one this is stops them reading as a
  // contradiction on the same screen.
  return verdict.kind === 'over-cap'
    ? `Balance cap: taking them would put your team ${Math.round(verdict.devPct)}% above the average roster per pick, past the ${capPct}% cap. Pick someone lower-rated this turn.`
    : `Balance cap: your team is already ${Math.round(verdict.devPct)}% above the average roster per pick, so you can only take from the lowest-rated players left.`;
}

/**
 * Dynamic-order turn: among the teams with the fewest picks taken (round fairness — everyone ends
 * a round within one pick of each other), the LOWEST projected strength picks next. Falls back to
 * draft-order position as the tiebreak so the sequence is deterministic.
 */
export function dynamicNextTeam(
  balance: DraftBalance,
  teamOrder: number[],
  picksTakenByTeam: Map<number, number>,
): number {
  const strengths = projectedStrengths(balance, teamOrder);
  const minPicks = Math.min(...teamOrder.map((id) => picksTakenByTeam.get(id) ?? 0));
  const eligible = teamOrder.filter((id) => (picksTakenByTeam.get(id) ?? 0) === minPicks);
  return eligible.sort(
    (a, b) =>
      (strengths.get(a) ?? 0) - (strengths.get(b) ?? 0) || teamOrder.indexOf(a) - teamOrder.indexOf(b),
  )[0];
}

/** Distinct pick numbers per team — a multi-account person is one pick. */
export function picksTakenByTeam(
  players: { teamId: number | null; pickNumber: number | null }[],
): Map<number, number> {
  const seen = new Map<number, Set<number>>();
  for (const p of players) {
    if (p.teamId == null || p.pickNumber == null) continue;
    let set = seen.get(p.teamId);
    if (!set) seen.set(p.teamId, (set = new Set()));
    set.add(p.pickNumber);
  }
  return new Map([...seen.entries()].map(([teamId, set]) => [teamId, set.size]));
}

/**
 * Greedy auto-balance: unassigned people (rating-desc) go one by one to the currently weakest
 * team. Returns per-person team assignments (playerIds already grouped per person). Deliberately
 * simple and explainable — captains can still trade afterwards; "keep us together" constraints
 * arrive with the sign-up prefill work.
 */
export function greedyAssignments(
  balance: DraftBalance,
  teamIds: number[],
): { personKey: string; rsn: string; playerIds: number[]; teamId: number }[] {
  const strengths = projectedStrengths(balance, teamIds);
  const counts = new Map<number, number>(teamIds.map((id) => [id, 0]));
  for (const p of balance.profiles) {
    if (p.teamId != null && counts.has(p.teamId)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
  }
  const out: { personKey: string; rsn: string; playerIds: number[]; teamId: number }[] = [];
  const pool = balance.profiles.filter((p) => p.teamId == null && p.playerIds.length > 0);
  for (const person of pool) {
    // Weakest team first; equal strength → the smaller roster; then stable order.
    const target = [...teamIds].sort(
      (a, b) =>
        (strengths.get(a) ?? 0) - (strengths.get(b) ?? 0) ||
        (counts.get(a) ?? 0) - (counts.get(b) ?? 0) ||
        teamIds.indexOf(a) - teamIds.indexOf(b),
    )[0];
    out.push({ personKey: person.personKey, rsn: person.rsn, playerIds: person.playerIds, teamId: target });
    strengths.set(target, (strengths.get(target) ?? 0) + Math.pow(person.rating, SHARPEN));
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return out;
}

/**
 * The single person-swap between two teams that most shrinks the projected spread. Advisory only —
 * surfaced with the start-now warning so "your teams are lopsided" always arrives with a concrete,
 * minimal fix. Null when no swap improves things by a meaningful margin.
 */
export function bestBalancingSwap(
  balance: DraftBalance,
  teamIds: number[],
): { give: string; giveTeamId: number; take: string; takeTeamId: number; spreadBeforePct: number; spreadAfterPct: number } | null {
  const strengths = projectedStrengths(balance, teamIds);
  const spreadOf = (m: Map<number, number>) => {
    const vals = [...m.values()];
    const max = Math.max(...vals);
    return max > 0 ? (max - Math.min(...vals)) / max : 0;
  };
  const before = spreadOf(strengths);
  const assigned = balance.profiles.filter((p) => p.teamId != null && teamIds.includes(p.teamId));
  let best: ReturnType<typeof bestBalancingSwap> = null;
  for (const a of assigned) {
    for (const b of assigned) {
      if (a.teamId === b.teamId) continue;
      const sim = new Map(strengths);
      const aPow = Math.pow(a.rating, SHARPEN);
      const bPow = Math.pow(b.rating, SHARPEN);
      sim.set(a.teamId!, (sim.get(a.teamId!) ?? 0) - aPow + bPow);
      sim.set(b.teamId!, (sim.get(b.teamId!) ?? 0) - bPow + aPow);
      const after = spreadOf(sim);
      if (after < before - 0.03 && (best == null || after < best.spreadAfterPct / 100)) {
        best = {
          give: a.rsn,
          giveTeamId: a.teamId!,
          take: b.rsn,
          takeTeamId: b.teamId!,
          spreadBeforePct: Math.round(before * 100),
          spreadAfterPct: Math.round(after * 100),
        };
      }
    }
  }
  return best;
}

/** Projected spread (max−min)/max over current team strengths, as a 0–100 pct. */
export function projectedSpreadPct(balance: DraftBalance, teamIds: number[]): number {
  const strengths = projectedStrengths(balance, teamIds);
  const vals = [...strengths.values()];
  if (!vals.length) return 0;
  const max = Math.max(...vals);
  return max > 0 ? Math.round(((max - Math.min(...vals)) / max) * 100) : 0;
}
