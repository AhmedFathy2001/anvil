/**
 * A person's personal webhook URL is user-supplied and the SERVER posts to it, so it must be a real
 * Discord webhook and nothing else — otherwise it is an SSRF: "forward my drops to http://169.254…"
 * would have the server fetch an internal address. Restricting the host to Discord's own domains and
 * the path to /api/webhooks/ closes that: the only thing this URL can ever reach is a Discord webhook.
 */
const DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'ptb.discord.com',
  'canary.discord.com',
]);

export function isDiscordWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (!DISCORD_HOSTS.has(u.hostname.toLowerCase())) return false;
  // /api/webhooks/<id>/<token> — accept an optional /vN version segment.
  return /^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+$/.test(u.pathname);
}

/**
 * The looser check for the SENDERS, which also address a webhook's `/messages/<id>` for edits: the
 * host is Discord's and the path is under a webhook. Every server-side post goes through this, so a
 * URL that slipped past the save-time check — an old row, a route that never checked — still can
 * only ever reach Discord.
 */
export function isDiscordWebhookTarget(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  return (
    u.protocol === 'https:' &&
    DISCORD_HOSTS.has(u.hostname.toLowerCase()) &&
    /^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+(\/|$)/.test(u.pathname)
  );
}
