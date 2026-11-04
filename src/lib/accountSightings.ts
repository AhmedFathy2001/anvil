// A claimed character played through somebody else's plugin.
//
// The Account Token says which Anvil login set up this RuneLite, not who is at the keyboard. So a
// claimed character turning up under a DIFFERENT login's token is ambiguous: siblings sharing one
// RuneLite, a friend logging in at your PC, or a character linked to the wrong person in the first
// place. Nothing can tell those apart from the wire, so nothing here moves ownership. What it does:
//
//   - remembers the sighting, so the owner's profile can say "also played from another Anvil
//     account" (they can Remove it there if it isn't theirs);
//   - lets /api/plugin/config tell the player their account is linked to somebody else, instead of
//     the old silent nothing;
//   - is the evidence staff read when either side disputes (POST /api/plugin/account 'dispute').

import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accountSightingDays, accountSightings, users } from '@/db/schema';

/**
 * Refresh an existing sighting at most this often. The plugin polls /config every 30 seconds; on a
 * shared PC that would otherwise be a write per poll for as long as the other person plays.
 */
export const SIGHTING_REFRESH_MS = 6 * 60 * 60 * 1000;

/** True when `lastSeenAt` is old enough that this play should bump it. */
export function sightingIsStale(lastSeenAt: string, nowIso: string): boolean {
  const last = Date.parse(lastSeenAt);
  if (!Number.isFinite(last)) return true;
  return Date.parse(nowIso) - last >= SIGHTING_REFRESH_MS;
}

/**
 * This login's plugin just played `accountId`, which another person owns. Best-effort: a failure
 * here must never break plugin auth, so callers wrap it.
 */
export async function recordForeignSighting(
  accountId: number,
  userId: number,
  hashMatched: boolean,
  nowIso: string,
): Promise<void> {
  await recordSightingDay(accountId, userId, hashMatched, nowIso);
  const prior = await db.query.accountSightings.findFirst({
    where: and(eq(accountSightings.accountId, accountId), eq(accountSightings.userId, userId)),
  });
  if (!prior) {
    await db
      .insert(accountSightings)
      .values({ accountId, userId, hashMatched: hashMatched ? 1 : 0, firstSeenAt: nowIso, lastSeenAt: nowIso })
      .onConflictDoNothing();
    return;
  }
  // A hash match is sticky: once the real character has been seen, a later RSN-only play doesn't
  // downgrade the evidence.
  const upgrade = hashMatched && prior.hashMatched !== 1;
  if (!upgrade && !sightingIsStale(prior.lastSeenAt, nowIso)) return;
  await db
    .update(accountSightings)
    .set({ lastSeenAt: nowIso, ...(upgrade ? { hashMatched: 1 } : {}) })
    .where(eq(accountSightings.id, prior.id));
}

/** How often a day row's `lastAt` moves while the same login keeps playing that day. */
export const SIGHTING_DAY_REFRESH_MS = 60 * 60 * 1000;

/**
 * The per-day row the event fair-play check reads (lib/footprintCheck): at most one per (character,
 * login, UTC day), its `lastAt` refreshed at most hourly. Callers record only hash-matched plays.
 */
async function recordSightingDay(accountId: number, userId: number, hashMatched: boolean, nowIso: string): Promise<void> {
  const day = nowIso.slice(0, 10);
  const cutoff = new Date(Date.parse(nowIso) - SIGHTING_DAY_REFRESH_MS).toISOString();
  await db
    .insert(accountSightingDays)
    .values({ accountId, userId, day, hashMatched: hashMatched ? 1 : 0, firstAt: nowIso, lastAt: nowIso })
    .onConflictDoUpdate({
      target: [accountSightingDays.accountId, accountSightingDays.userId, accountSightingDays.day],
      set: {
        lastAt: nowIso,
        hashMatched: sql`greatest(${accountSightingDays.hashMatched}, ${hashMatched ? 1 : 0})`,
      },
      // Only when it is worth a write: an hour on, or a hash match the day row didn't have yet.
      setWhere: hashMatched
        ? sql`${accountSightingDays.lastAt} < ${cutoff} or ${accountSightingDays.hashMatched} = 0`
        : lt(accountSightingDays.lastAt, cutoff),
    });
}

export type ForeignSighting = { accountId: number; userId: number; hashMatched: boolean; lastSeenAt: string };

/**
 * For the owner's own characters: who ELSE has been seeing them. Excludes the owner's own login, in
 * case a sighting predates them claiming it. Newest first.
 */
export async function foreignSightingsFor(accountIds: number[], ownerUserId: number): Promise<ForeignSighting[]> {
  if (accountIds.length === 0) return [];
  const rows = await db
    .select({
      accountId: accountSightings.accountId,
      userId: accountSightings.userId,
      hashMatched: accountSightings.hashMatched,
      lastSeenAt: accountSightings.lastSeenAt,
    })
    .from(accountSightings)
    // Hash-matched only. This list NAMES the other login to the owner, and a bare name is free: on
    // a name-only sighting anybody could put "Anvil Staff" in front of a stranger's character. The
    // name-only rows exist for staff's fair-play check, which says how weak they are.
    .where(and(
      inArray(accountSightings.accountId, accountIds),
      ne(accountSightings.userId, ownerUserId),
      eq(accountSightings.hashMatched, 1),
    ));
  return rows
    .map((r) => ({ ...r, hashMatched: r.hashMatched === 1 }))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/**
 * Sightings for the profile's account list, grouped by account, with each other login's display
 * name — the owner needs "my brother's RuneLite" to recognise a shared PC. Only the last
 * {@link SIGHTING_SHOW_DAYS} days: an old visit isn't worth a warning forever.
 */
export const SIGHTING_SHOW_DAYS = 30;

export async function alsoPlayedFromByAccount(
  accountIds: number[],
  ownerUserId: number,
  nowMs: number = Date.now(),
): Promise<Map<number, { name: string; lastSeenAt: string }[]>> {
  const cutoff = nowMs - SIGHTING_SHOW_DAYS * 86_400_000;
  const sightings = (await foreignSightingsFor(accountIds, ownerUserId)).filter(
    (s) => Date.parse(s.lastSeenAt) >= cutoff,
  );
  const out = new Map<number, { name: string; lastSeenAt: string }[]>();
  if (sightings.length === 0) return out;
  const logins = await db
    .select({ id: users.id, displayName: users.displayName, discordUsername: users.discordUsername })
    .from(users)
    .where(inArray(users.id, [...new Set(sightings.map((s) => s.userId))]));
  const nameOf = new Map(logins.map((l) => [l.id, l.displayName || l.discordUsername || 'another Anvil user']));
  for (const s of sightings) {
    const list = out.get(s.accountId) ?? [];
    list.push({ name: nameOf.get(s.userId) ?? 'another Anvil user', lastSeenAt: s.lastSeenAt });
    out.set(s.accountId, list);
  }
  return out;
}
