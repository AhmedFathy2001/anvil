/**
 * Anti-spam for cross-clan invites — weekly clan-vs-clan (weekly_competition_clans) and event
 * co-hosting (event_cohosts).
 *
 *  - An owner/admin can "Decline & block" an incoming invite. A blocked clan's later invites are
 *    refused SILENTLY: the sender's invite reads as declined, the blocker never sees it, and nothing
 *    says "you're blocked".
 *  - The blocker can't invite a clan it blocked either (it is told to unblock first — it knows).
 *  - A rate limit backs it up: per sending clan, at most MAX_PENDING_INVITES_PER_TARGET open invites
 *    to the same clan, and MAX_INVITES_PER_DAY sent in 24 hours, across both invite types.
 */
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanBlocks, clanStaff, clans, eventCohosts, events, weeklyCompetitionClans, weeklyCompetitions } from '@/db/schema';
import { atLeast } from '@/lib/clanRoles';

/** Open (pending) invites one clan may have out to the same clan at once, both invite types together. */
export const MAX_PENDING_INVITES_PER_TARGET = 5;
/** Invites one clan may send in a rolling 24 hours, both invite types together. */
export const MAX_INVITES_PER_DAY = 30;

export type InviteGate =
  | { kind: 'ok' }
  /** The target blocked the sender: write the invite already declined, say nothing. */
  | { kind: 'silent' }
  /** The sender may be told: it blocked the target itself, or it hit the rate limit. */
  | { kind: 'refused'; error: string; status: number };

async function blocked(clanId: number, blockedClanId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: clanBlocks.id })
    .from(clanBlocks)
    .where(and(eq(clanBlocks.clanId, clanId), eq(clanBlocks.blockedClanId, blockedClanId)))
    .limit(1);
  return !!row;
}

/** Invites `senderClanId` has sent, pending to `targetClanId` and in the last day — both tables. */
async function sentCounts(senderClanId: number, targetClanId: number): Promise<{ pendingToTarget: number; lastDay: number }> {
  const dayAgo = sql`to_char((now() - interval '1 day') at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;
  // clan-scope: this clan -- invites SENT by senderClanId (the competition/event's own clan).
  const [w] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${weeklyCompetitionClans.clanId} = ${targetClanId} and ${weeklyCompetitionClans.status} = 'pending')`,
      day: sql<number>`count(*) filter (where ${weeklyCompetitionClans.createdAt} >= ${dayAgo})`,
    })
    .from(weeklyCompetitionClans)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyCompetitionClans.competitionId))
    .where(eq(weeklyCompetitions.clanId, senderClanId));
  // clan-scope: this clan -- co-host invites sent by senderClanId's events.
  const [e] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${eventCohosts.clanId} = ${targetClanId} and ${eventCohosts.status} = 'pending')`,
      day: sql<number>`count(*) filter (where ${eventCohosts.createdAt} >= ${dayAgo})`,
    })
    .from(eventCohosts)
    .innerJoin(events, eq(events.id, eventCohosts.eventId))
    .where(eq(events.clanId, senderClanId));
  return {
    pendingToTarget: Number(w?.pending ?? 0) + Number(e?.pending ?? 0),
    lastDay: Number(w?.day ?? 0) + Number(e?.day ?? 0),
  };
}

/** May `senderClanId` send a NEW invite to `targetClanId`? Call before writing a fresh pending row. */
export async function inviteGate(senderClanId: number, targetClanId: number): Promise<InviteGate> {
  if (await blocked(targetClanId, senderClanId)) return { kind: 'silent' };
  if (await blocked(senderClanId, targetClanId)) {
    return { kind: 'refused', error: 'You blocked this clan. Unblock it in Settings → Blocked clans first.', status: 400 };
  }
  const c = await sentCounts(senderClanId, targetClanId);
  if (c.pendingToTarget >= MAX_PENDING_INVITES_PER_TARGET) {
    return { kind: 'refused', error: `That clan already has ${MAX_PENDING_INVITES_PER_TARGET} open invites from you — wait for an answer.`, status: 429 };
  }
  if (c.lastDay >= MAX_INVITES_PER_DAY) {
    return { kind: 'refused', error: `Your clan has sent ${MAX_INVITES_PER_DAY} invites today — try again tomorrow.`, status: 429 };
  }
  return { kind: 'ok' };
}

/** Record a block. Idempotent. Authority is the caller's (an owner/admin of `clanId`). */
export async function blockClan(clanId: number, blockedClanId: number, byUserId: number | null): Promise<void> {
  if (clanId === blockedClanId) return;
  await db.insert(clanBlocks).values({ clanId, blockedClanId, blockedByUserId: byUserId }).onConflictDoNothing();
  // Anything still pending from them goes quiet too.
  await db.execute(sql`
    update ${weeklyCompetitionClans} set status = 'declined', decided_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
    where ${weeklyCompetitionClans.clanId} = ${clanId} and ${weeklyCompetitionClans.status} = 'pending'
      and ${weeklyCompetitionClans.competitionId} in (select id from ${weeklyCompetitions} where clan_id = ${blockedClanId})`);
  await db.execute(sql`
    update ${eventCohosts} set status = 'declined', decided_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
    where ${eventCohosts.clanId} = ${clanId} and ${eventCohosts.status} = 'pending'
      and ${eventCohosts.eventId} in (select id from ${events} where clan_id = ${blockedClanId})`);
}

/** Owner/admin of `clanId` (clan_staff) — the bar for every Blocked clans read and write. */
export async function isAdminOf(clanId: number, userId: number): Promise<boolean> {
  const [staff] = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)));
  return !!staff && atLeast(staff.role, 'admin');
}

/** Settings → Blocked clans. Owner/admin of `clanId` only. */
export async function blockClanAsUser(clanId: number, blockedClanId: number, userId: number): Promise<boolean> {
  if (!(await isAdminOf(clanId, userId))) return false;
  await blockClan(clanId, blockedClanId, userId);
  return true;
}

export async function unblockClan(clanId: number, blockedClanId: number, userId: number): Promise<boolean> {
  if (!(await isAdminOf(clanId, userId))) return false;
  await db.delete(clanBlocks).where(and(eq(clanBlocks.clanId, clanId), eq(clanBlocks.blockedClanId, blockedClanId)));
  return true;
}

export async function listBlockedClans(clanId: number): Promise<{ clanId: number; name: string; slug: string; createdAt: string }[]> {
  return db
    .select({ clanId: clans.id, name: clans.name, slug: clans.slug, createdAt: clanBlocks.createdAt })
    .from(clanBlocks)
    .innerJoin(clans, eq(clans.id, clanBlocks.blockedClanId))
    .where(eq(clanBlocks.clanId, clanId))
    .orderBy(clans.name);
}

/** The Blocked clans list, for an owner/admin of `clanId` only; null for anyone else. */
export async function listBlockedClansAsUser(clanId: number, userId: number) {
  if (!(await isAdminOf(clanId, userId))) return null;
  return listBlockedClans(clanId);
}
