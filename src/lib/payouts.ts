import { db } from '@/db';
import { events, payouts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { countApprovedSignups, computePrizePool } from '@/lib/prizePool';
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
