/**
 * Bot-driven webhook provisioning — create an incoming webhook in a channel via the Discord
 * REST API instead of making the admin paste one from Discord's UI. The bot already creates
 * roles + channels (lib/discord-teams.ts); this is the same pattern for `POST /channels/{id}/webhooks`.
 *
 * Only *creates* webhooks. Sending to them lives in lib/discord.ts, which stays URL-only so the
 * cron/notify paths never need a bot token. Reuses the shared REST helper (discordRest) from
 * lib/discord-roles.ts, so 429 handling lives in one place.
 *
 * Requires the bot to have Manage Webhooks on the target channel. A created webhook's response
 * includes its `token`, which we bake into the standard webhook URL. GET returns the token too,
 * but only for bot-owned webhooks — which is exactly what find-or-reuse looks at.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discordRest } from '@/lib/discord-roles';

// Give a newly-created webhook the site's own favicon as its avatar, so its posts show the clan's
// branding. Read once from public/ (the instance's own icon — self-hosters get theirs) and cached as
// a data URI. If it can't be read the webhook is still created, just without a custom avatar.
let cachedAvatar: string | null | undefined; // undefined = not tried yet
async function siteAvatarDataUri(): Promise<string | null> {
  if (cachedAvatar !== undefined) return cachedAvatar;
  try {
    const bytes = await readFile(join(process.cwd(), 'public', 'icon-192.png'));
    cachedAvatar = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    cachedAvatar = null;
  }
  return cachedAvatar;
}

// Default name for Anvil-created webhooks. A stable name lets find-or-reuse detect and reuse an
// existing one instead of spawning a duplicate on every click (Discord caps 15 webhooks/channel).
export const DEFAULT_WEBHOOK_NAME = 'Anvil';

export interface CreatedWebhook {
  id: string;
  name: string;
  url: string;
}

interface RawWebhook {
  id: string;
  name: string;
  token?: string;
  // 1 = Incoming Webhook (the only kind with a usable token we can post to).
  type: number;
}

function buildWebhookUrl(id: string, token: string): string {
  return `https://discord.com/api/webhooks/${id}/${token}`;
}

/**
 * Human-readable reason for a failed webhook call, naming the likely fix — mirrors
 * describeSendError in lib/discord-broadcast.ts so admins get an actionable message.
 */
async function describeWebhookError(res: Response): Promise<string> {
  let message = '';
  let code: number | undefined;
  try {
    const body = (await res.clone().json()) as { message?: string; code?: number };
    message = body.message ?? '';
    code = body.code;
  } catch {
    /* body not JSON */
  }
  const base = `Discord ${res.status}${message ? `: ${message}` : ''}${code ? ` (code ${code})` : ''}`;
  if (res.status === 401) return `${base} — the bot token is invalid or was reset. Re-check DISCORD_BOT_TOKEN.`;
  if (res.status === 403 || code === 50013) {
    return `${base} — the bot can't manage webhooks here. Give it "Manage Webhooks" on that channel.`;
  }
  if (res.status === 404 || code === 10003) {
    return `${base} — that channel no longer exists. Reload the channel list and pick again.`;
  }
  if (res.status === 400 && code === 30007) {
    return `${base} — this channel already has the maximum 15 webhooks. Delete some in Discord, or pick another channel.`;
  }
  return base;
}

/**
 * Create a new incoming webhook in `channelId` named `name`. Always creates — callers wanting
 * idempotency (no dupes on re-click) use findOrCreateAnvilWebhook. Throws with a human message
 * on failure so the route can surface it verbatim.
 */
export async function createChannelWebhook(
  botToken: string,
  channelId: string,
  name: string,
): Promise<CreatedWebhook> {
  const avatar = await siteAvatarDataUri();
  const res = await discordRest(botToken, `/channels/${channelId}/webhooks`, {
    method: 'POST',
    body: JSON.stringify(avatar ? { name, avatar } : { name }),
  });
  if (!res.ok) throw new Error(await describeWebhookError(res));
  const wh = (await res.json()) as RawWebhook;
  if (!wh.token) throw new Error('Discord did not return a webhook token — try again.');
  return { id: wh.id, name: wh.name, url: buildWebhookUrl(wh.id, wh.token) };
}

/**
 * Return an existing Anvil-owned webhook of `name` in the channel, or create one. Idempotent:
 * re-running won't pile up duplicates. The GET only exposes tokens for bot-owned webhooks, so we
 * can rebuild the URL of one we made earlier. If the GET is denied (missing perm) we fall through
 * to create, which surfaces the proper "give the bot Manage Webhooks" error.
 */
export async function findOrCreateAnvilWebhook(
  botToken: string,
  channelId: string,
  name: string = DEFAULT_WEBHOOK_NAME,
): Promise<CreatedWebhook> {
  const res = await discordRest(botToken, `/channels/${channelId}/webhooks`);
  if (res.ok) {
    const list = (await res.json()) as RawWebhook[];
    const existing = list.find((w) => w.name === name && !!w.token);
    if (existing?.token) {
      return { id: existing.id, name: existing.name, url: buildWebhookUrl(existing.id, existing.token) };
    }
  }
  return createChannelWebhook(botToken, channelId, name);
}
