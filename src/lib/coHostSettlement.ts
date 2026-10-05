// Who owes whom on a co-hosted event — the cash-policy made concrete.
//
// Per clan: what its players paid IN (entry fees) and what they're owed OUT (payouts), then what
// the policy makes of those two numbers.
//
// FEES ARE THE REAL FEE ROWS, not entrants × signupFee. The estimate counted a person entering two
// characters twice under per-person fees, counted comped / sub-in entries (excludeFromPrizePool) as
// paying, and counted nobody still in the draft pool. Approved, pool-counting sign-ups and their
// signup_fees amount are what the prize pool itself counts (lib/prizePool).
//
// ATTRIBUTION: a fee belongs to the clan of the team the entry ended up on (teams.clanId; untagged =
// the host). Not on a team yet → the clan of the seat it signed up with, if that clan is running
// the event; else the host. A payout follows its team the same way; teamless = the host's.
//
// WHAT EACH POLICY MEANS (`transfer` > 0: host pays the clan; < 0: the clan pays the host;
// `keeps`: what the clan holds once transfers and its own payouts are done):
//   each-settles            no money crosses clans. A clan keeps its players' fees and pays its own
//                           winners → keeps = fees − winnings. (This was shown as winnings − fees,
//                           so a clan holding 230M read as −230M.)
//   host-holds              the host collected every fee and pays every winner directly. Nothing
//                           crosses → co-hosts keep 0; the host keeps all fees − all winnings.
//   clans-collect-host-pays each clan gathers its players' fees and sends them to the host, who pays
//                           every winner → a co-host transfers −fees and keeps 0; the host keeps
//                           all fees − all winnings.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, clans, eventParticipants, eventSignups, events, payouts, signupFees, teams } from '@/db/schema';
import { acceptedCohostClanIds } from '@/lib/coHost';

export interface ClanSettlement {
  clanId: number;
  name: string;
  isHost: boolean;
  /** Approved, pool-counting entries attributed to this clan. */
  entrants: number;
  /** gp its players owe/paid in entry fees (the real fee rows). */
  fees: number;
  /** gp its players are owed in payouts. */
  winnings: number;
  /** Money between this clan and the host under the policy: > 0 host pays the clan, < 0 the clan pays the host. */
  transfer: number;
  /** What this clan holds once transfers and its own payouts are done. */
  keeps: number;
}

export interface EventSettlement {
  cashPolicy: string;
  signupFee: number;
  /** True once there's a co-host and a fee — otherwise settlement is the single-clan case. */
  relevant: boolean;
  clans: ClanSettlement[];
  totals: { fees: number; winnings: number };
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
  const running = new Set(clanIds);
  const clanRows = await db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, clanIds));
  const nameById = new Map(clanRows.map((c) => [c.id, c.name]));

  // The entries the pot counts, each with its fee and where it sits.
  const entries = await db
    .select({
      seatClanId: clanMemberships.clanId,
      accountId: clanMemberships.accountId,
      fee: signupFees.amount,
    })
    .from(eventSignups)
    .innerJoin(clanMemberships, eq(clanMemberships.id, eventSignups.clanMemberId))
    .leftJoin(signupFees, eq(signupFees.signupId, eventSignups.id))
    .where(
      and(
        eq(eventSignups.eventId, eventId),
        eq(eventSignups.status, 'approved'),
        eq(eventSignups.excludeFromPrizePool, false),
      ),
    );
  // The team each character ended up on (participants are one per account per event).
  const parts = await db
    .select({ accountId: eventParticipants.accountId, teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId));
  const teamByAccount = new Map(parts.filter((p) => p.accountId != null).map((p) => [p.accountId!, p.teamId]));

  const entrantsByClan = new Map<number, number>();
  const feesByClan = new Map<number, number>();
  for (const e of entries) {
    const teamId = teamByAccount.get(e.accountId) ?? null;
    const clanId =
      teamId != null ? teamToClan.get(teamId) ?? hostClanId : running.has(e.seatClanId) ? e.seatClanId : hostClanId;
    entrantsByClan.set(clanId, (entrantsByClan.get(clanId) ?? 0) + 1);
    feesByClan.set(clanId, (feesByClan.get(clanId) ?? 0) + (e.fee ?? 0));
  }

  // Winnings per clan (payout amount, mapped by team → clan; teamless payouts are the host's).
  const payoutRows = await db.select({ teamId: payouts.teamId, amount: payouts.amount }).from(payouts).where(eq(payouts.eventId, eventId));
  const winningsByClan = new Map<number, number>();
  for (const p of payoutRows) {
    const clanId = (p.teamId != null ? teamToClan.get(p.teamId) : hostClanId) ?? hostClanId;
    winningsByClan.set(clanId, (winningsByClan.get(clanId) ?? 0) + (p.amount ?? 0));
  }

  const totals = {
    fees: [...feesByClan.values()].reduce((a, b) => a + b, 0),
    winnings: [...winningsByClan.values()].reduce((a, b) => a + b, 0),
  };
  const policy = event.cashPolicy ?? 'host-holds';

  const clanSettlements: ClanSettlement[] = clanIds.map((clanId) => {
    const isHost = clanId === hostClanId;
    const fees = feesByClan.get(clanId) ?? 0;
    const winnings = winningsByClan.get(clanId) ?? 0;
    let transfer = 0;
    let keeps: number;
    if (policy === 'each-settles') {
      keeps = fees - winnings;
    } else if (policy === 'clans-collect-host-pays') {
      transfer = isHost ? 0 : -fees;
      keeps = isHost ? totals.fees - totals.winnings : 0;
    } else {
      // host-holds (and any unrecognised value — the host holding everything is the default).
      keeps = isHost ? totals.fees - totals.winnings : 0;
    }
    return {
      clanId,
      name: nameById.get(clanId) ?? 'Clan',
      isHost,
      entrants: entrantsByClan.get(clanId) ?? 0,
      fees,
      winnings,
      transfer,
      keeps,
    };
  });
  // Host first, then by name.
  clanSettlements.sort((a, b) => (a.isHost === b.isHost ? a.name.localeCompare(b.name) : a.isHost ? -1 : 1));

  return {
    cashPolicy: policy,
    signupFee,
    relevant: cohostIds.length > 0 && signupFee > 0,
    clans: clanSettlements,
    totals,
  };
}
