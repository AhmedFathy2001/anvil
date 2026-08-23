import { db } from '@/db';
import { events, payouts, eventParticipants } from '@/db/schema';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { countApprovedSignups, computePrizePool } from '@/lib/prizePool';
import { getTeamStandings } from '@/lib/statStandings';
import { notifyPayout } from '@/lib/discord';

// Suggested percentage split of the pool by number of paid places. First place is weighted heaviest;
// it's only the STARTING suggestion — admins set an explicit gp reward per placement in the UI.
export function defaultSplit(paidPlaces: number): number[] {
  switch (Math.max(1, paidPlaces)) {
    case 1:
      return [100];
    case 2:
      return [60, 40];
    case 3:
      return [50, 30, 20];
    default: {
      // Linearly-decaying weights normalized to 100, for 4+ places.
      const weights = Array.from({ length: paidPlaces }, (_, i) => paidPlaces - i);
      const sum = weights.reduce((a, b) => a + b, 0);
      return weights.map((w) => Math.round((w / sum) * 100));
    }
  }
}

// Turn a raw pool into a suggested gp reward per placement, using defaultSplit. Used to PREFILL the
// per-placement inputs; the admin then edits each place's reward directly.
export function suggestPlaceAmounts(totalPool: number, paidPlaces: number): number[] {
  return defaultSplit(paidPlaces).map((pct) => Math.round((totalPool * pct) / 100));
}

// The displayed prize pool for an event: host-added bonus + entry fee × approved (non-excluded) entries.
export async function getEventPrizePool(eventId: number): Promise<{
  total: number;
  added: number;
  signupFee: number;
  approvedCount: number;
}> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const approvedCount = await countApprovedSignups(eventId);
  const added = event?.addedPrizePool ?? 0;
  const signupFee = event?.signupFee ?? 0;
  return {
    total: computePrizePool({ addedPrizePool: added, signupFee, approvedCount }),
    added,
    signupFee,
    approvedCount,
  };
}

export interface PlanTeam {
  teamId: number;
  teamName: string;
  members: { clanMemberId: number; rsn: string }[];
}

export interface PayoutPlanRow {
  clanMemberId: number;
  rsn: string;
  teamId: number;
  teamName: string;
  place: number;
  amount: number;
}

// Turn ranked teams + an explicit gp reward per placement into a per-player payout plan. Each place's
// reward is split EQUALLY across that team's members (per-player split); integer-gp remainders go to
// the first members so the place total is exactly preserved. Places with no members are skipped.
export function buildPayoutPlan(opts: {
  places: PlanTeam[]; // ranked, best first; already sliced to the number of paid places
  placeAmounts: number[]; // gp reward per placement, index-aligned to `places`
}): PayoutPlanRow[] {
  const { places, placeAmounts } = opts;
  const rows: PayoutPlanRow[] = [];

  places.forEach((team, i) => {
    const placeAmount = Math.round(placeAmounts[i] ?? 0);
    const members = team.members;
    if (members.length === 0 || placeAmount <= 0) return;

    const base = Math.floor(placeAmount / members.length);
    let remainder = placeAmount - base * members.length; // spread across the first `remainder` members
    for (const m of members) {
      const amount = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      rows.push({
        clanMemberId: m.clanMemberId,
        rsn: m.rsn,
        teamId: team.teamId,
        teamName: team.teamName,
        place: i + 1,
        amount,
      });
    }
  });

  return rows;
}

// Post the paid winners + amounts to the bingo Discord webhook and stamp events.payoutsAnnouncedAt.
// Called automatically once every payout for the event is paid, and by the manual "Announce" button.
// Best-effort: returns false (without stamping) when there's nothing paid or the event is gone.
export async function announcePayouts(eventId: number): Promise<boolean> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return false;

  const rows = await db.select().from(payouts).where(eq(payouts.eventId, eventId));
  const paid = rows.filter((r) => r.status === 'paid');
  if (paid.length === 0) return false;

  const totalPaid = paid.reduce((sum, r) => sum + (r.amount || 0), 0);
  const ok = await notifyPayout({
    clanId: event.clanId,
    eventId,
    eventName: event.name,
    totalPaid,
    recipients: paid.map((r) => ({ rsn: r.rsn, teamName: r.teamName, place: r.place, amount: r.amount })),
  });

  // Only stamp when the post actually went out — otherwise (e.g. no bingo webhook configured) a
  // later manual "Announce" or the next payment can still fire it instead of being silently blocked.
  if (ok) {
    await db
      .update(events)
      .set({ payoutsAnnouncedAt: new Date().toISOString() })
      .where(eq(events.id, eventId));
  }
  return ok;
}

// Are all payouts for the event paid (and there's at least one)? Drives the auto-announce trigger.
export async function allPayoutsPaid(eventId: number): Promise<boolean> {
  const rows = await db
    .select({ status: payouts.status })
    .from(payouts)
    .where(eq(payouts.eventId, eventId));
  return rows.length > 0 && rows.every((r) => r.status === 'paid');
}

// Count of still-pending payouts (used to decide whether marking one paid finishes the set).
export async function pendingPayoutCount(eventId: number): Promise<number> {
  const rows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(and(eq(payouts.eventId, eventId), eq(payouts.status, 'pending')));
  return rows.length;
}

// ─── Prize-per-placement structure + generation ───────────────────────────────────────────────

// Parse events.placementPrizes (JSON array of gp amounts by place) into a clean number[].
export function parsePlacementPrizes(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0));
  } catch {
    return [];
  }
}

// Persist the prize-per-placement structure on the event, independent of generating payout rows.
// Saving fixed amounts CLEARS any percentage split: the two are alternative answers to the same
// question, and leaving the old one behind would make the winner arbitrary.
export async function savePlacementPrizes(eventId: number, placeAmounts: number[]): Promise<number[]> {
  const clean = placeAmounts.map((n) => Math.max(0, Math.round(Number(n) || 0)));
  await db
    .update(events)
    .set({ placementPrizes: JSON.stringify(clean), placementSplitPct: null })
    .where(eq(events.id, eventId));
  return clean;
}

// ─── Prizes as a share of the pool ────────────────────────────────────────────────────────────

/** Parse events.placementSplitPct (JSON array of percentages by place) into a clean number[]. */
export function parsePlacementSplit(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0))
      // Round to a tenth: hosts think in whole percents, and 33.3 is a legitimate third.
      .map((n) => Math.round(n * 10) / 10);
  } catch {
    return [];
  }
}

/**
 * Persist the split as SHARES of the pool.
 *
 * The point of the mode: a pool that grows with every approved entry should carry prizes that grow
 * with it. Fixed amounts are frozen the moment they're typed, so a board that doubled its entries
 * still advertises the smaller prize — and the alternative was a host remembering to come back and
 * retype three numbers every time somebody signed up.
 */
export async function savePlacementSplit(eventId: number, placePercents: number[]): Promise<number[]> {
  const clean = placePercents.map((n) => Math.max(0, Math.min(100, Math.round(Number(n) * 10 || 0) / 10)));
  await db
    .update(events)
    .set({ placementSplitPct: JSON.stringify(clean), placementPrizes: null })
    .where(eq(events.id, eventId));
  return clean;
}

/**
 * What each place is actually worth right now.
 *
 * A percentage split is resolved against the live pool (added bonus + fee × approved entries), so
 * this is the ONE function every prize display and the payout generator should ask — otherwise the
 * event page and the payouts tab quote different numbers for the same board.
 */
export function placementAmounts(
  event: { placementPrizes?: string | null; placementSplitPct?: string | null },
  poolTotal: number,
): number[] {
  const pct = parsePlacementSplit(event.placementSplitPct);
  if (pct.length > 0) return pct.map((p) => Math.round((poolTotal * p) / 100));
  return parsePlacementPrizes(event.placementPrizes);
}

// Core payout generation. (Re)builds per-player payout rows for the top `placeAmounts.length` teams,
// splitting each place's reward equally across that team's members (frozen/subbed-out excluded unless
// includeSubbed). Existing PAID rows are preserved; stale pending auto-rows are pruned. Returns the
// resulting rows sorted for display.
export async function generatePayouts(
  eventId: number,
  opts: { placeAmounts: number[]; includeSubbed?: boolean },
): Promise<(typeof payouts.$inferSelect)[]> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return [];

  const standings = await getTeamStandings(eventId, event.scoringMode);
  const paidPlaces = Math.min(Math.max(1, opts.placeAmounts.length), standings.length || 1);
  const placeAmounts = opts.placeAmounts.slice(0, paidPlaces).map((n) => Math.max(0, Math.round(n)));
  const topTeams = standings.slice(0, paidPlaces);

  const teamIds = topTeams.map((t) => t.teamId);
  const memberFilters = [
    eq(eventParticipants.eventId, eventId),
    inArray(eventParticipants.teamId, teamIds),
    isNotNull(eventParticipants.clanMemberId),
    ...(opts.includeSubbed ? [] : [isNull(eventParticipants.frozenAt)]),
  ];
  const teamPlayers = teamIds.length ? await db.select().from(eventParticipants).where(and(...memberFilters)) : [];
  const membersByTeam = new Map<number, { clanMemberId: number; rsn: string }[]>();
  for (const p of teamPlayers) {
    if (p.clanMemberId == null || p.teamId == null) continue;
    const list = membersByTeam.get(p.teamId) ?? [];
    list.push({ clanMemberId: p.clanMemberId, rsn: p.name });
    membersByTeam.set(p.teamId, list);
  }

  const places: PlanTeam[] = topTeams.map((t) => ({
    teamId: t.teamId,
    teamName: t.name,
    members: membersByTeam.get(t.teamId) ?? [],
  }));
  const plan = buildPayoutPlan({ places, placeAmounts });
  const planMemberIds = new Set(plan.map((r) => r.clanMemberId));

  const existing = await db.select().from(payouts).where(eq(payouts.eventId, eventId));
  const existingByMember = new Map(
    existing.filter((r) => r.clanMemberId != null).map((r) => [r.clanMemberId as number, r]),
  );

  // Prune stale pending auto-rows (a team that dropped out of the paid places). Paid + manual rows stay.
  for (const r of existing) {
    if (r.status === 'pending' && r.place != null && r.clanMemberId != null && !planMemberIds.has(r.clanMemberId)) {
      await db.delete(payouts).where(eq(payouts.id, r.id));
    }
  }
  for (const row of plan) {
    const current = existingByMember.get(row.clanMemberId);
    if (current) {
      if (current.status === 'paid') continue; // never overwrite a completed payment
      await db
        .update(payouts)
        .set({ rsn: row.rsn, teamId: row.teamId, teamName: row.teamName, place: row.place, amount: row.amount })
        .where(eq(payouts.id, current.id));
    } else {
      await db
        .insert(payouts)
        .values({
          eventId,
          clanMemberId: row.clanMemberId,
          rsn: row.rsn,
          teamId: row.teamId,
          teamName: row.teamName,
          place: row.place,
          amount: row.amount,
          status: 'pending',
        })
        .onConflictDoNothing();
    }
  }

  const rows = await db.select().from(payouts).where(eq(payouts.eventId, eventId));
  return rows.sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || b.amount - a.amount);
}

// Auto-generate payouts when an event ends — but only when a placement structure is configured and no
// payouts exist yet. Idempotent, so it's safe to call from every end path (scheduled + force-end).
export async function autoGeneratePayoutsOnEnd(eventId: number): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return;
  const placeAmounts = parsePlacementPrizes(event.placementPrizes);
  if (placeAmounts.length === 0) return; // no structure set — nothing to auto-generate
  const existing = await db.select({ id: payouts.id }).from(payouts).where(eq(payouts.eventId, eventId));
  if (existing.length > 0) return; // already has payouts (manual, or a prior auto-run)
  await generatePayouts(eventId, { placeAmounts });
}
