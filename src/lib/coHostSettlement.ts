// Who owes whom on a co-hosted event — the cash-policy made concrete.
//
// The policy (events.cashPolicy) decides where the money sits; this turns it into a per-clan
// reconciliation the treasurers actually read. Two numbers per clan drive everything: what its
// members put IN (entry fees) and what they're owed OUT (payouts). A payout is attributed to a clan
// by its team's tag (teams.clanId); a payout with no team, or on a host team, is the host's. Entry
// fees are approximated as (that clan's entrants × signupFee) — exact for the host's own sign-ups,
// and the right shape for a co-host whose members were rostered straight onto its team.
//
//   host-holds / clans-collect-host-pays : the host settles with each clan — net = winnings − fees
//                                          (host pays the clan when positive, the clan owes when not).
//   each-settles                          : no money crosses clans — net is the clan's own surplus.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, eventParticipants, events, payouts, teams } from '@/db/schema';
import { acceptedCohostClanIds } from '@/lib/coHost';

export interface ClanSettlement {
  clanId: number;
  name: string;
  isHost: boolean;
  entrants: number;
  /** gp its members paid in (entrants × signupFee). */
  fees: number;
  /** gp its members are owed in payouts. */
  winnings: number;
  /** winnings − fees. Under host-holds/clans-collect: the host pays this to the clan (owed when < 0).
   *  Under each-settles: the clan's own surplus (or shortfall) — no transfer. */
  net: number;
}

export interface EventSettlement {
  cashPolicy: string;
  signupFee: number;
  /** True once there's a co-host and a fee — otherwise settlement is the single-clan case. */
  relevant: boolean;
  clans: ClanSettlement[];
}

export async function settlementForEvent(eventId: number): Promise<EventSettlement | null> {
  // clan-scope: global -- reads the event being settled, by id; its host clanId anchors the rows below.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;
  const hostClanId = event.clanId;
  const signupFee = event.signupFee ?? 0;

  const teamRows = await db.select({ id: teams.id, clanId: teams.clanId }).from(teams).where(eq(teams.eventId, eventId));
  const teamToClan = new Map(teamRows.map((t) => [t.id, t.clanId ?? hostClanId]));

  // Clans in play: the host + every accepted co-host.
  const cohostIds = await acceptedCohostClanIds(eventId);
  const clanIds = [...new Set([hostClanId, ...cohostIds])];
  const clanRows = await db.select({ id: clans.id, name: clans.name }).from(clans);
  const nameById = new Map(clanRows.map((c) => [c.id, c.name]));

  // Entrants per clan (participants on a team, mapped to that team's clan).
  const parts = await db
    .select({ teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId));
  const entrantsByClan = new Map<number, number>();
  for (const p of parts) {
    if (p.teamId == null) continue;
    const clanId = teamToClan.get(p.teamId) ?? hostClanId;
    entrantsByClan.set(clanId, (entrantsByClan.get(clanId) ?? 0) + 1);
  }

  // Winnings per clan (payout amount, mapped by team → clan; teamless payouts are the host's).
  const payoutRows = await db.select({ teamId: payouts.teamId, amount: payouts.amount }).from(payouts).where(eq(payouts.eventId, eventId));
  const winningsByClan = new Map<number, number>();
  for (const p of payoutRows) {
    const clanId = (p.teamId != null ? teamToClan.get(p.teamId) : hostClanId) ?? hostClanId;
    winningsByClan.set(clanId, (winningsByClan.get(clanId) ?? 0) + (p.amount ?? 0));
  }

  const clanSettlements: ClanSettlement[] = clanIds.map((clanId) => {
    const entrants = entrantsByClan.get(clanId) ?? 0;
    const fees = entrants * signupFee;
    const winnings = winningsByClan.get(clanId) ?? 0;
    return { clanId, name: nameById.get(clanId) ?? 'Clan', isHost: clanId === hostClanId, entrants, fees, winnings, net: winnings - fees };
  });
  // Host first, then by name.
  clanSettlements.sort((a, b) => (a.isHost === b.isHost ? a.name.localeCompare(b.name) : a.isHost ? -1 : 1));

  return {
    cashPolicy: event.cashPolicy,
    signupFee,
    relevant: cohostIds.length > 0 && signupFee > 0,
    clans: clanSettlements,
  };
}
