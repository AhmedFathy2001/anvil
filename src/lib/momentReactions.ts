// Reactions on a clan's moments from the plugin panel's Recent drops: a "GZ" any clanmate can give, and a
// gold one that is an Anvil Supporter perk. A death takes "Sad" or "Sit" instead (lib/pluginUi/feedUi
// rowReactKinds says which a row offers). Counts only, never text, so there is nothing to moderate.
// One of each kind per person per moment; pressing it again takes it back.

import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, eventParticipants, momentReactions, moments, users } from '@/db/schema';

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

// ── Who reacted ──────────────────────────────────────────────────────────────────────────────────

/** Where the row is read, which decides whose name a reactor goes by. */
export type ReactorScope = { clanId: number } | { eventId: number; hostClanId: number };

/** Per moment, per kind: the reactors in the order they reacted, by name there (null = no character there). */
export type ReactorLists = Map<number, Partial<Record<ReactionKind, (string | null)[]>>>;

/**
 * Who gave each reaction, as the CHARACTER they are in this clan (or on this board) — never their
 * Discord / person name, and never a character from another clan (the clan/character boundary):
 *   - a clan's feed: their seat's RSN in that clan (a live member seat first, then a past one or a
 *     guest seat; their main among several alts);
 *   - a board's feed: their participant name on that board, else their seat in the host clan (host
 *     staff who aren't playing).
 * Nobody under either gets null: counted in "and N others", never named.
 */
export async function reactorNames(momentIds: number[], scope: ReactorScope): Promise<ReactorLists> {
  const out: ReactorLists = new Map();
  const ids = [...new Set(momentIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return out;
  const rows = await db
    .select({ momentId: momentReactions.momentId, kind: momentReactions.kind, userId: momentReactions.userId })
    .from(momentReactions)
    .where(inArray(momentReactions.momentId, ids))
    .orderBy(asc(momentReactions.id));
  if (rows.length === 0) return out;
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const names = new Map<number, string>();
  if ('eventId' in scope) {
    // clan-scope: global -- pinned to this one board's participants.
    const parts = await db
      .select({ userId: users.id, name: eventParticipants.name, id: eventParticipants.id })
      .from(eventParticipants)
      .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
      .innerJoin(users, eq(users.playerId, accounts.playerId))
      .where(and(eq(eventParticipants.eventId, scope.eventId), inArray(users.id, userIds)))
      .orderBy(asc(eventParticipants.id));
    for (const p of parts) if (!names.has(p.userId) && p.name.trim()) names.set(p.userId, p.name);
  }
  const clanId = 'eventId' in scope ? scope.hostClanId : scope.clanId;
  const missing = userIds.filter((u) => !names.has(u));
  if (missing.length) {
    // clan-scope: global -- the join pins every seat to this one clan.
    const seats = await db
      .select({
        userId: users.id,
        rsn: accounts.rsn,
        kind: clanMemberships.kind,
        leftAt: clanMemberships.leftAt,
        primary: accounts.isPrimary,
        seatId: clanMemberships.id,
      })
      .from(users)
      .innerJoin(accounts, eq(accounts.playerId, users.playerId))
      .innerJoin(clanMemberships, eq(clanMemberships.accountId, accounts.id))
      .where(and(inArray(users.id, missing), eq(clanMemberships.clanId, clanId), ne(clanMemberships.kind, 'event')));
    const rank = (x: (typeof seats)[number]) => (x.leftAt == null ? 0 : 4) + (x.kind === 'member' ? 0 : 2) + (x.primary ? 0 : 1);
    seats.sort((a, b) => rank(a) - rank(b) || a.seatId - b.seatId);
    for (const x of seats) if (!names.has(x.userId)) names.set(x.userId, x.rsn);
  }
  for (const r of rows) {
    const kind = REACTION_KINDS.find((k) => k === r.kind);
    if (!kind) continue;
    const per = out.get(r.momentId) ?? {};
    (per[kind] ??= []).push(names.get(r.userId) ?? null);
    out.set(r.momentId, per);
  }
  return out;
}
