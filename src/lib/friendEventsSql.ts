// Leaving friends hosts out of cross-clan reads and posts (lib/friendEventRules). Its own module so
// listing and Discord code can take it without the rest of lib/friendEvents (no import cycles).

import { eq, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { FRIENDS_KIND } from '@/lib/friendEventRules';
import { isLabClan } from '@/lib/lab';

/** WHERE fragment: this events.clan_id (or any clan id column) is NOT a friends host. The lab twin is lib/lab notLabClan. */
export function notFriendsEvent(clanIdColumn: SQLWrapper): SQL {
  return sql`${clanIdColumn} not in (select "id" from "clans" where "kind" = ${FRIENDS_KIND})`;
}

/**
 * A HIDDEN host: the tile lab (lib/lab) or a Supporter's friends host. Neither ever posts to Discord
 * or mints a stream overlay — the lab because nothing it does happened, a friends host because its
 * boards are private to the friends invited.
 */
export async function isHiddenHost(clanId: number | null | undefined): Promise<boolean> {
  if (clanId == null) return false;
  if (await isLabClan(clanId)) return true;
  // clan-scope: this clan -- the one host being asked about, for its kind.
  const [row] = await db.select({ kind: clans.kind }).from(clans).where(eq(clans.id, clanId)).limit(1);
  return row?.kind === FRIENDS_KIND;
}
