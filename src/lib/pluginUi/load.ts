import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';

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
import { mediaForCharacter } from '@/lib/profileMedia';
import { clanSeat } from '@/lib/seatScope';
import { avatarUrl } from '@/lib/discord-oauth';
import { displayCaseForPlayer } from '@/lib/displayCase';
import { luckCandidates } from '@/lib/clogLuckBoard';
import { pinLuck } from '@/lib/pinLuck';
import { supporterForPlayer } from '@/lib/supporter';
import { canAnimateProfileMedia } from '@/lib/profileMediaRules';
import { mediaRevision } from '@/lib/pluginUi/mediaRevision';

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
  if (!character.personId || !character.personMedia) return card;
  // Their own uploads show on every character by default; the Discord picture fallback says who the
  // person is, so it only stands in where they link characters publicly.
  const discordOk = character.personPublic || character.viewerOwns;
  const [media, discordAvatar, displayCase] = await Promise.all([
    mediaForCharacter(character.accountId, character.personId).catch(() => ({ avatar: null, banner: null })),
    discordOk ? panelDiscordAvatar(character.personId) : Promise.resolve(null),
    displayCaseForPlayer(character.personId, { accountId: character.accountId, publicView: !character.viewerOwns }),
  ]);
  card.panelMedia = {
    avatar: !!media.avatar || !!discordAvatar,
    avatarAnimated: !!media.avatar?.animated || (!media.avatar && !!discordAvatar?.animated),
    banner: !!media.banner,
    bannerAnimated: !!media.banner?.animated,
    // A character override is a different URL, so switching to/from one changes this; the banner's
    // focal point is in it too, since the panel crops there.
    revision: mediaRevision(media.avatar?.src, media.banner?.src, media.banner ? `p${media.banner.position}` : null, discordAvatar?.src),
  };
  const cands = luckCandidates();
  const kcOf = (key: string) => [...card.bosses, ...card.topBosses].find((b) => b.key === key)?.kc ?? 0;
  card.displayCase = displayCase.map((p) => {
    const luck = (p.kind === 'drop' || p.kind === 'clog') && p.itemId > 0 ? pinLuck({ itemId: p.itemId, source: p.source, kc: p.kc, qty: p.qty }, cands, kcOf) : null;
    return luck ? { ...p, luck } : p;
  });
  return card;
}

/** Most recently used Discord login for a person, used only when they uploaded no Anvil avatar. */
export async function panelDiscordAvatar(playerId: number): Promise<{ src: string; animated: boolean } | null> {
  try {
    const [[row], supporter] = await Promise.all([
      db
        .select({ discordId: users.discordId, discordAvatar: users.discordAvatar })
        .from(users)
        .where(and(eq(users.playerId, playerId), isNotNull(users.discordId), isNotNull(users.discordAvatar)))
        .orderBy(desc(users.lastLoginAt), desc(users.id))
        .limit(1),
      supporterForPlayer(playerId).catch(() => null),
    ]);
    if (!row?.discordId) return null;
    const src = avatarUrl(row.discordId, row.discordAvatar);
    const mayMove = canAnimateProfileMedia(supporter?.tier.id ?? null);
    return src ? { src, animated: mayMove && !!row.discordAvatar?.startsWith('a_') } : null;
  } catch {
    return null;
  }
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
/** The plugin draws the Supporter tenure shapes (glyphs 'star-ring', 'star-hex', 'hex'), not only 'star'. */
export function hasTenureGlyphs(request: Request): boolean {
  return request.headers.get('X-Anvil-Glyphs') === '1';
}

export function hasFeedTab(request: Request): boolean {
  return request.headers.get('X-Anvil-Feed-Tab') === '1';
}

/** The plugin can open its own tabs from a panel row (`{ a: 'tab' }`): the Feed pointer becomes a link. */
export function hasTabLinks(request: Request): boolean {
  return Number(request.headers.get('X-Anvil-Tab-Links')) >= 1;
}

/** ...and open the Feed tab ON a given list (`{ a: 'tab', tab: 'feed', args }`): a board's feed or chat. */
export function hasTabArgs(request: Request): boolean {
  return Number(request.headers.get('X-Anvil-Tab-Links')) >= 2;
}

/** The plugin draws `img` nodes (capability 'panel-images'): proof thumbnails in a tile's detail. */
export function hasPanelImages(request: Request): boolean {
  return request.headers.get('X-Anvil-Panel-Images') === '1';
}
