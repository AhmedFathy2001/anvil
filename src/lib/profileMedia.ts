// A person's own avatar and banner: the database half (lib/profileMediaRules is the pure half,
// lib/profileMediaProcess the upload's decode and re-encode).

import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accountMedia, profileMedia, users } from '@/db/schema';
import { supporterForPlayer, supporterForUser, supporterForUsers } from '@/lib/supporter';
import { shownCharacterMedia, shownProfileMedia, type ProfileMediaRowLike, type ShownProfileMedia } from '@/lib/profileMediaRules';
import type { SupporterTierId } from '@/lib/supporterTiers';

export * from '@/lib/profileMediaRules';

const COLUMNS = {
  avatarUrl: profileMedia.avatarUrl,
  avatarStillUrl: profileMedia.avatarStillUrl,
  bannerUrl: profileMedia.bannerUrl,
  bannerStillUrl: profileMedia.bannerStillUrl,
  bannerPosition: profileMedia.bannerPosition,
} as const;

/** The stored row for one login, or null. */
export async function profileMediaRow(userId: number): Promise<ProfileMediaRowLike | null> {
  const rows = await db.select(COLUMNS).from(profileMedia).where(eq(profileMedia.userId, userId)).limit(1);
  return rows[0] ?? null;
}

/** What to show for one login, gated by their tier now. Decoration: a failed read is no picture. */
export async function profileMediaForUser(
  userId: number,
  opts: { still?: boolean; tier?: SupporterTierId | null } = {},
): Promise<ShownProfileMedia> {
  try {
    const [row, tier] = await Promise.all([
      profileMediaRow(userId),
      opts.tier !== undefined ? Promise.resolve(opts.tier) : supporterForUser(userId).then((s) => s?.tier.id ?? null),
    ]);
    return shownProfileMedia(row, tier, { still: opts.still });
  } catch {
    return { avatar: null, banner: null };
  }
}

/**
 * The login behind a PERSON (players.id) whose media a public page shows. A person may hold more
 * than one login; the first that has uploaded anything wins.
 */
export async function mediaUserForPlayer(playerId: number): Promise<number | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(profileMedia, eq(profileMedia.userId, users.id))
    .where(eq(users.playerId, playerId))
    .orderBy(asc(users.id))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Media for a person's public page. Lists should pass `still`. */
export async function profileMediaForPlayer(playerId: number, opts: { still?: boolean } = {}): Promise<ShownProfileMedia> {
  try {
    const userId = await mediaUserForPlayer(playerId);
    if (userId == null) return { avatar: null, banner: null };
    // The upload may live on one login while the person's subscription lives on another. Public
    // person/character cards follow the linked person, just like Supporter flair everywhere else.
    const supporter = (await supporterForUsers([userId])).get(userId) ?? null;
    return profileMediaForUser(userId, { ...opts, tier: supporter?.tier.id ?? null });
  } catch {
    return { avatar: null, banner: null };
  }
}

const ACCOUNT_COLUMNS = {
  avatarUrl: accountMedia.avatarUrl,
  avatarStillUrl: accountMedia.avatarStillUrl,
  bannerUrl: accountMedia.bannerUrl,
  bannerStillUrl: accountMedia.bannerStillUrl,
  bannerPosition: accountMedia.bannerPosition,
} as const;

/** A character's own override row (account_media), or null. */
export async function accountMediaRow(accountId: number): Promise<ProfileMediaRowLike | null> {
  const rows = await db.select(ACCOUNT_COLUMNS).from(accountMedia).where(eq(accountMedia.accountId, accountId)).limit(1);
  return rows[0] ?? null;
}

/** Override rows for several characters at once (the settings page's per-character list). */
export async function accountMediaRows(accountIds: number[]): Promise<Map<number, ProfileMediaRowLike>> {
  const out = new Map<number, ProfileMediaRowLike>();
  const ids = [...new Set(accountIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return out;
  const rows = await db.select({ accountId: accountMedia.accountId, ...ACCOUNT_COLUMNS }).from(accountMedia).where(inArray(accountMedia.accountId, ids));
  for (const { accountId, ...row } of rows) out.set(accountId, row);
  return out;
}

/**
 * What ONE CHARACTER's pages show (site profile, plugin card, plugin media route): the character's
 * own avatar/banner where it has one (account_media), else the person's (profile_media), each part on
 * its own. Gated by the person's tier now, like the person's media: motion for Champion+, otherwise
 * the still; nothing is deleted on a lapse. Callers decide visibility first (personMediaVisible).
 * Decoration: a failed read is no picture.
 */
export async function mediaForCharacter(
  accountId: number,
  personId: number | null,
  opts: { still?: boolean } = {},
): Promise<ShownProfileMedia> {
  try {
    const [override, userId] = await Promise.all([
      accountMediaRow(accountId),
      personId != null ? mediaUserForPlayer(personId) : Promise.resolve(null),
    ]);
    const [person, supporter] = await Promise.all([
      userId != null ? profileMediaRow(userId) : Promise.resolve(null),
      personId != null && (override || userId != null) ? supporterForPlayer(personId) : Promise.resolve(null),
    ]);
    return shownCharacterMedia(override, person, supporter?.tier.id ?? null, { still: opts.still });
  } catch {
    return { avatar: null, banner: null };
  }
}
