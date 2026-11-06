import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, users } from '@/db/schema';
import { apexCharacter, apexClan, type ApexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { hasPlatformRole } from '@/lib/clanRoles';
import { LAB_CLAN_SLUG } from '@/lib/lab';
import { loadPlayerCard } from '@/lib/playerCard';
import type { PlayerCard } from '@/lib/playerCardShape';
import { publicHiscoresCard } from '@/lib/publicHiscoresCard';
import { rateLimit } from '@/lib/rate-limit';
import { profileMediaForPlayer } from '@/lib/profileMedia';
import { clanSeat } from '@/lib/seatScope';

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
  if (character) return { kind: 'card', card: await loadPanelPlayerCard(character) };

  const limit = await rateLimit(request, 'player-card-lookup', { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return { kind: 'limited', retryAfterSec: Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)) };
  const result = await publicHiscoresCard(rsn);
  if (result.kind === 'card') return { kind: 'card', card: result.card };
  if (result.kind === 'busy') return { kind: 'busy', retryAfterSec: result.retryAfterSec };
  return { kind: 'missing' };
}

export async function loadPanelPlayerCard(character: ApexCharacter): Promise<PlayerCard> {
  const card = await loadPlayerCard(character);
  if (!character.personId || (!character.personPublic && !character.viewerOwns)) return card;
  const media = await profileMediaForPlayer(character.personId).catch(() => ({ avatar: null, banner: null }));
  card.panelMedia = {
    avatar: !!media.avatar,
    avatarAnimated: !!media.avatar?.animated,
    banner: !!media.banner,
    bannerAnimated: !!media.banner?.animated,
  };
  return card;
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
    columns: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true, bannerPosition: true, status: true, kind: true },
  });
  if (!clan || clan.status === 'suspended') return null;
  if ((await apexClan(slug)) != null) return clan;
  // The hidden lab clan opens for platform staff, so its test drops can be tried in the panel.
  if (clan.slug === LAB_CLAN_SLUG) return (await pluginStaff(request)) ? clan : null;

  const playerId = await viewerPlayerId(request);
  if (playerId == null) return null;
  // clan-scope: global -- does this person hold a live seat in this one clan.
  const [seat] = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    // A member or guest seat: an event player's seat opens its event, not the clan (lib/pluginBoards
    // still addresses that one board through it).
    .where(and(eq(clanMemberships.clanId, clan.id), eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt), clanSeat()))
    .limit(1);
  return seat ? clan : null;
}

/** Is the plugin's login platform staff (it may open the lab clan and react to its test drops)? */
export async function pluginStaff(request: Request): Promise<boolean> {
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return false;
  const row = await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { platformRole: true } });
  return hasPlatformRole(row?.platformRole, 'staff');
}

/** The plugin draws the Feed tab (capability 'panel-rows'): the clan card can drop its long drop log. */
export function hasFeedTab(request: Request): boolean {
  return request.headers.get('X-Anvil-Feed-Tab') === '1';
}

/** The plugin can open its own tabs from a panel row (`{ a: 'tab' }`): the Feed pointer becomes a link. */
export function hasTabLinks(request: Request): boolean {
  return request.headers.get('X-Anvil-Tab-Links') === '1';
}

/** The plugin draws `img` nodes (capability 'panel-images'): proof thumbnails in a tile's detail. */
export function hasPanelImages(request: Request): boolean {
  return request.headers.get('X-Anvil-Panel-Images') === '1';
}
