import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, users } from '@/db/schema';
import { apexCharacter, apexClan } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { loadPlayerCard } from '@/lib/playerCard';
import type { PlayerCard } from '@/lib/playerCardShape';
import { publicHiscoresCard } from '@/lib/publicHiscoresCard';
import { rateLimit } from '@/lib/rate-limit';

// The reads behind the plugin's cards, shared by the card routes (/api/players/<rsn>/card,
// /api/clans/<slug>/card) and the panel's views (/api/plugin/ui), so both answer the same.

/** The person behind the Account Token, as the player id visibility is judged by; null without one. */
export async function viewerPlayerId(request: Request): Promise<number | null> {
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } });
  return row?.playerId ?? null;
}

export type CardLookup =
  | { kind: 'card'; card: PlayerCard }
  | { kind: 'missing' }
  | { kind: 'busy'; retryAfterSec: number }
  | { kind: 'limited'; retryAfterSec: number };

/**
 * A character's card, with the /p/<rsn> visibility rule (apexCharacter): a shared character is
 * anyone's, an unshared one only its owner's, and everyone else is told the same as for a name not on
 * Anvil. Such a name falls back to the OSRS hiscores (lib/publicHiscoresCard) — the only path here
 * that reaches Jagex, so it alone carries the per-IP limit.
 */
export async function lookupPlayerCard(request: Request, rsn: string): Promise<CardLookup> {
  if (!rsn || rsn.length > 12) return { kind: 'missing' };
  const character = await apexCharacter(rsn, await viewerPlayerId(request));
  if (character) return { kind: 'card', card: await loadPlayerCard(character) };

  const limit = await rateLimit(request, 'player-card-lookup', { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return { kind: 'limited', retryAfterSec: Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)) };
  const result = await publicHiscoresCard(rsn);
  if (result.kind === 'card') return { kind: 'card', card: result.card };
  if (result.kind === 'busy') return { kind: 'busy', retryAfterSec: result.retryAfterSec };
  return { kind: 'missing' };
}

/**
 * A clan by slug if the caller may see it: any clan the platform lists publicly (apexClan — the test
 * the clan's public page uses), plus the caller's OWN clan whatever its listing, read off the Account
 * Token, so a member sees their clan's card even when it keeps itself off the directory.
 */
export async function visibleClan(request: Request, rawSlug: string) {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug || slug.length > 64) return null;
  // clan-scope: global -- resolving a clan by slug is what this is.
  const clan = await db.query.clans.findFirst({
    where: eq(clans.slug, slug),
    columns: { id: true, slug: true, name: true, logoUrl: true, status: true },
  });
  if (!clan || clan.status === 'suspended') return null;
  if ((await apexClan(slug)) != null) return clan;

  const playerId = await viewerPlayerId(request);
  if (playerId == null) return null;
  // clan-scope: global -- does this person hold a live seat in this one clan.
  const [seat] = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(clanMemberships.clanId, clan.id), eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt)))
    .limit(1);
  return seat ? clan : null;
}
