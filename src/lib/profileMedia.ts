// A person's own avatar and banner: the database half (lib/profileMediaRules is the pure half,
// lib/profileMediaProcess the upload's decode and re-encode).

import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { profileMedia, users } from '@/db/schema';
import { supporterForUser } from '@/lib/supporter';
import { shownProfileMedia, type ProfileMediaRowLike, type ShownProfileMedia } from '@/lib/profileMediaRules';
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
    return profileMediaForUser(userId, opts);
  } catch {
    return { avatar: null, banner: null };
  }
}
