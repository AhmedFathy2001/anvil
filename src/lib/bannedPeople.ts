// A person banned from the platform is hidden from everyone outside their own clans.
//
// A site ban (players.banned, set from /staff/people) used to stop the person signing in and nothing
// else: their characters stayed on the leaderboard, in player search and on public clan pages, and so
// in search engines. The ban is the platform's "hide this person" switch; this is the one predicate
// every public read of a character adds.

import { sql } from 'drizzle-orm';

/**
 * True for a row of `accounts` whose owner is not banned. Written against the table's own name, so
 * it belongs only in queries that read `accounts` unaliased.
 */
export const ownerNotBanned = sql`not exists (select 1 from players banned_owner where banned_owner.id = "accounts"."player_id" and banned_owner.banned)`;
