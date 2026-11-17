/**
 * FACT IDS — the database half (lib/pluginFacts/factIds explains the keys).
 *
 * Kept in `feed_items`, the per-character key store the chat feed already uses for its own retries:
 * unique on (account, key), swept after two days by the daily sweep (lib/chatFeed sweepChatFeed).
 * The keys here start `fact:`, which no feed key does (those start with a moment kind).
 */
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { feedItems } from '@/db/schema';
import { resolvePluginMember } from '@/lib/auth';
import { factIdOfKey, factKey, factTileKey } from '@/lib/pluginFacts/factIds';

/** Whose ids these are: the token's person, and the character being played. */
export interface FactOwner {
  userId: number;
  accountId: number;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The caller as a fact owner, or null when the token names no character (nothing is remembered then). */
export async function factOwner(request: Request): Promise<FactOwner | null> {
  const member = await resolvePluginMember(request).catch(() => null);
  return member ? { userId: member.userId, accountId: member.accountId } : null;
}

async function storedIds(owner: FactOwner, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .select({ key: feedItems.dedupKey })
    .from(feedItems)
    .where(and(eq(feedItems.accountId, owner.accountId), inArray(feedItems.dedupKey, keys)));
  return new Set(rows.map((r) => factIdOfKey(owner.userId, r.key)).filter((id): id is string => id != null));
}

/** Of these ids, the ones already answered for good. */
export function settledFactIds(owner: FactOwner, ids: string[]): Promise<Set<string>> {
  return storedIds(owner, ids.map((id) => factKey(owner.userId, id)));
}

/** Of these ids, the ones whose credit on this tile is already in. */
export function tileFactIds(owner: FactOwner, ids: string[], tileId: number): Promise<Set<string>> {
  return storedIds(owner, ids.map((id) => factTileKey(owner.userId, id, tileId)));
}

/**
 * Inside the credit's own transaction: take every id for this tile, insert-if-absent against the
 * unique index. True only when ALL were new; the caller must roll back otherwise (a second request
 * with the same id waits here for the first to commit, then sees it taken).
 */
export async function claimTileFacts(tx: Tx, owner: FactOwner, ids: string[], tileId: number): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await tx
    .insert(feedItems)
    .values(ids.map((id) => ({ accountId: owner.accountId, dedupKey: factTileKey(owner.userId, id, tileId) })))
    .onConflictDoNothing()
    .returning({ id: feedItems.id });
  return rows.length === ids.length;
}

/** These facts were answered for good: a later send of any of them is set aside before matching. */
export async function settleFacts(owner: FactOwner, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .insert(feedItems)
    .values(ids.map((id) => ({ accountId: owner.accountId, dedupKey: factKey(owner.userId, id) })))
    .onConflictDoNothing();
}
