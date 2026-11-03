// The clan settings that are links (board_rules_url, discord_invite_url): checked when saved, so only a
// real web address is ever stored and later drawn as a link. Pure (tests/setting-urls.test.ts).

const DISCORD_INVITE_HOSTS = new Set(['discord.gg', 'discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com']);

export const URL_SETTINGS = ['board_rules_url', 'discord_invite_url'] as const;

/** The cleaned address, or the reason it can't be saved. Empty means "clear it". */
export function checkSettingUrl(key: string, raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (value.length > 500) return { ok: false, error: 'That link is too long.' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: 'Links must start with https:// (or http://).' };
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) {
    return { ok: false, error: 'Links must start with https:// (or http://).' };
  }
  if (key === 'discord_invite_url' && !DISCORD_INVITE_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: 'That isn’t a Discord invite link (discord.gg/…).' };
  }
  return { ok: true, value: url.toString() };
}
