// Reactions on a clan's moments from the plugin panel's Recent drops: a "GZ" any clanmate can give, and a
// gold one that is an Anvil Supporter perk. A death takes "Sad" or "Sit" instead (lib/pluginUi/feedUi
// rowReactKinds says which a row offers). Counts only, never text, so there is nothing to moderate.
// One of each kind per person per moment; pressing it again takes it back.

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, momentReactions, moments, users } from '@/db/schema';

export type ReactionKind = 'gz' | 'gold' | 'sad' | 'sit';
export const REACTION_KINDS: ReactionKind[] = ['gz', 'gold', 'sad', 'sit'];

export interface ReactionSummary {
  gz: number;
  gold: number;
  mineGz: boolean;
  mineGold: boolean;
  /** A death's: "Sad" and "Sit". */
  sad: number;
  sit: number;
  mineSad: boolean;
  mineSit: boolean;
}

export const NO_REACTIONS: ReactionSummary = { gz: 0, gold: 0, mineGz: false, mineGold: false, sad: 0, sit: 0, mineSad: false, mineSit: false };

/** One kind's count and whether the viewer gave it, off a summary. */
export function tallyOf(s: ReactionSummary, kind: ReactionKind): { n: number; mine: boolean } {
  if (kind === 'gold') return { n: s.gold, mine: s.mineGold };
  if (kind === 'sad') return { n: s.sad, mine: s.mineSad };
  if (kind === 'sit') return { n: s.sit, mine: s.mineSit };
  return { n: s.gz, mine: s.mineGz };
}

/** Counts for each moment, and which the viewer gave. Moments nobody reacted to are absent. */
export async function reactionSummaries(momentIds: number[], viewerUserId: number | null): Promise<Map<number, ReactionSummary>> {
  const out = new Map<number, ReactionSummary>();
  const ids = [...new Set(momentIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      momentId: momentReactions.momentId,
      kind: momentReactions.kind,
      n: sql<number>`count(*)::int`,
      mine: viewerUserId
        ? sql<boolean>`bool_or(${momentReactions.userId} = ${viewerUserId})`
        : sql<boolean>`false`,
    })
    .from(momentReactions)
    .where(inArray(momentReactions.momentId, ids))
    .groupBy(momentReactions.momentId, momentReactions.kind);
  for (const r of rows) {
    const s = out.get(r.momentId) ?? { ...NO_REACTIONS };
    if (r.kind === 'gz') {
      s.gz = r.n;
      s.mineGz = !!r.mine;
    } else if (r.kind === 'gold') {
      s.gold = r.n;
      s.mineGold = !!r.mine;
    } else if (r.kind === 'sad') {
      s.sad = r.n;
      s.mineSad = !!r.mine;
    } else if (r.kind === 'sit') {
      s.sit = r.n;
      s.mineSit = !!r.mine;
    }
    out.set(r.momentId, s);
  }
  return out;
}

/**
 * Does this login hold a live MEMBER seat in the clan (any of the person's characters)? Reacting is
 * for clanmates: a public clan's feed can be read by anyone, but a GZ comes from inside.
 */
export async function isClanMember(userId: number, clanId: number): Promise<boolean> {
  // clan-scope: global -- the join pins the seat to this one clan.
  const [row] = await db
    .select({ id: clanMemberships.id })
    .from(users)
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .innerJoin(clanMemberships, eq(clanMemberships.accountId, accounts.id))
    .where(and(eq(users.id, userId), eq(clanMemberships.clanId, clanId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
    .limit(1);
  return !!row;
}

/** Is this moment one of this clan's (a member's, not a guest's on some board)? */
export async function momentInClan(momentId: number, clanId: number): Promise<boolean> {
  return (await clanMomentKind(momentId, clanId)) != null;
}

/** The moment's kind ('death', 'pet', …) when it is one of this clan's, else null. */
export async function clanMomentKind(momentId: number, clanId: number): Promise<string | null> {
  // clan-scope: global -- the join pins the moment to this one clan.
  const [row] = await db
    .select({ kind: moments.kind })
    .from(moments)
    .innerJoin(clanMemberships, eq(moments.clanMemberId, clanMemberships.id))
    .where(and(eq(moments.id, momentId), eq(clanMemberships.clanId, clanId), eq(clanMemberships.kind, 'member')))
    .limit(1);
  return row?.kind ?? null;
}

/** The moment's kind and team when it was filed on this board, else null. */
export async function boardMoment(momentId: number, eventId: number): Promise<{ kind: string; teamId: number | null } | null> {
  // clan-scope: global -- by the board id the caller already checked the viewer is on.
  const [row] = await db
    .select({ kind: moments.kind, teamId: moments.teamId })
    .from(moments)
    .where(and(eq(moments.id, momentId), eq(moments.eventId, eventId)))
    .limit(1);
  return row ?? null;
}

/** Give the reaction, or take it back if it was already given. Returns whether it is now on. */
export async function toggleReaction(momentId: number, userId: number, kind: ReactionKind): Promise<boolean> {
  const removed = await db
    .delete(momentReactions)
    .where(and(eq(momentReactions.momentId, momentId), eq(momentReactions.userId, userId), eq(momentReactions.kind, kind)))
    .returning({ id: momentReactions.id });
  if (removed.length) return false;
  await db.insert(momentReactions).values({ momentId, userId, kind }).onConflictDoNothing();
  return true;
}
