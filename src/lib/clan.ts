import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';

/**
 * Upsert a clan member by normalized RSN. Returns the clan_member id.
 *
 * Used by enrollment flows (bingo player creation, weekly participant enrollment)
 * so the global roster stays in sync with per-event rosters even before the
 * plugin has done a proper clan-sync. New rows default to `isGuest=1` + `source='manual'`
 * so admins can promote them later from the clan roster UI.
 */
export async function findOrCreateClanMember(
  rsn: string,
  options: { discordId?: string | null; asGuest?: boolean } = {},
): Promise<number> {
  const trimmed = rsn.trim();
  if (!trimmed) throw new Error('rsn is required');

  const normalized = normalizeRsn(trimmed);
  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, normalized),
  });

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (options.discordId && !existing.discordId) patch.discordId = options.discordId;
    if (existing.leftAt) patch.leftAt = null;
    if (Object.keys(patch).length > 0) {
      await db.update(clanMembers).set(patch).where(eq(clanMembers.id, existing.id));
    }
    return existing.id;
  }

  const [row] = await db
    .insert(clanMembers)
    .values({
      rsn: trimmed,
      rsnNormalized: normalized,
      discordId: options.discordId ?? null,
      source: 'manual',
      isGuest: options.asGuest === false ? 0 : 1,
    })
    .returning();
  return row.id;
}
