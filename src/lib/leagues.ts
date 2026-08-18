import { getSettingText, setSetting } from '@/lib/settings';
import { log } from '@/lib/logger';

/**
 * Seasonal (Leagues) support for plugin notifications.
 *
 * A league is a separate game mode on separate worlds: the drops are absurd by main-game standards,
 * the kill counts are meaningless next to them, and mixing the two in one channel makes both
 * useless to read. So a clan can point seasonal posts at their own channel, and every seasonal post
 * is marked as one whether or not they have.
 *
 * The plugin only reports WHERE the player is (a seasonal world flag); which channel that means and
 * what it looks like is decided here, so a clan can change it without a plugin release.
 */

/** Clan override for the seasonal thumbnail — paste the current league's logo. */
const LEAGUES_ICON_SETTING = 'leagues_icon_url';
/** Cache of the last icon resolved from the wiki, so a post never waits on a scrape. */
const LEAGUES_ICON_CACHE_SETTING = 'leagues_icon_cached';
const LEAGUES_ICON_CACHED_AT_SETTING = 'leagues_icon_cached_at';

/** Every league so far has used this; it's the mode's own icon, not a season's. */
const GENERIC_LEAGUES_ICON = 'https://oldschool.runescape.wiki/images/League_icon.png';

/** Re-check the wiki at most this often — a league's art changes once a season, if that. */
const ICON_TTL_MS = 24 * 60 * 60 * 1000;

// Wrapped because the icon cache is a convenience: a read failure must degrade to "no cached icon",
// never break the seasonal banner.
async function getSetting(clanId: number, key: string): Promise<string | null> {
  try {
    return await getSettingText(clanId, key);
  } catch {
    return null;
  }
}

async function putSetting(clanId: number, key: string, value: string): Promise<void> {
  try {
    await setSetting(clanId, key, value);
  } catch (err) {
    log.info('leagues.icon-cache-write-failed', { key, err: String(err) });
  }
}

/**
 * The current league's logo, best effort.
 *
 * Asks the wiki which league is running and takes its image, because a per-season icon can't be
 * shipped ahead of a season that doesn't exist yet. Cached for a day; on any failure — offline,
 * markup moved, between seasons — it falls back to the generic Leagues icon rather than leaving the
 * embed bare. A clan that wants control sets the icon themselves and this never runs.
 */
export async function leaguesIconUrl(clanId: number): Promise<string> {
  const override = await getSetting(clanId, LEAGUES_ICON_SETTING);
  if (override) return override;

  const cachedAt = Number(await getSetting(clanId, LEAGUES_ICON_CACHED_AT_SETTING) ?? 0);
  const cached = await getSetting(clanId, LEAGUES_ICON_CACHE_SETTING);
  if (cached && Number.isFinite(cachedAt) && Date.now() - cachedAt < ICON_TTL_MS) {
    return cached;
  }

  const resolved = await resolveLeagueIconFromWiki();
  const icon = resolved ?? GENERIC_LEAGUES_ICON;
  // Cache the fallback too — a wiki that's down shouldn't be retried on every single drop.
  await putSetting(clanId, LEAGUES_ICON_CACHE_SETTING, icon);
  await putSetting(clanId, LEAGUES_ICON_CACHED_AT_SETTING, String(Date.now()));
  return icon;
}

/**
 * Scrape the wiki's Leagues hub for the newest league's logo. Deliberately forgiving: any shape
 * change, redirect or timeout returns null and the caller uses the generic icon. Never throws.
 */
async function resolveLeagueIconFromWiki(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://oldschool.runescape.wiki/w/Leagues', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Anvil clan-events (https://anvilosrs.com)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    // League logos are uploaded as "<Name>_League_logo.png" / "..._logo.png". Take the last match:
    // the hub lists leagues oldest-first, so the newest is furthest down.
    const matches = [...html.matchAll(/https:\/\/oldschool\.runescape\.wiki\/images\/[^"'\s]*[Ll]eague[^"'\s]*\.png/g)];
    const last = matches.at(-1)?.[0];
    return last ?? null;
  } catch {
    return null;
  }
}

/**
 * Mark an embed as seasonal: "[Seasonal]" on the title and the league's art as the thumbnail.
 *
 * Applied server-side to whatever the plugin composed, so every notification kind — drops, deaths,
 * CAs, pets, clog slots — is marked without the plugin knowing about any of them individually, and
 * an already-released plugin gets it on deploy. A thumbnail the embed already set is left alone:
 * the item's own sprite says more than the league's does.
 */
export function markSeasonal(
  embed: Record<string, unknown> | null,
  iconUrl: string,
): Record<string, unknown> | null {
  if (!embed) return embed;
  const title = typeof embed.title === 'string' ? embed.title : '';
  return {
    ...embed,
    title: title.startsWith('[Seasonal]') ? title : `[Seasonal] ${title}`.trim(),
    ...(embed.thumbnail ? {} : { thumbnail: { url: iconUrl } }),
  };
}
