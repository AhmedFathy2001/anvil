// "Post this event somewhere else": the channel picker on an event's (or a co-host's) Discord tab.
// The admin picks a channel in their own server and Anvil makes the webhook — or, without a bot,
// pastes one. Either way the URL is the secret that ends up in the prefs; the channel id rides along
// so the page can show "#name" without ever echoing the URL.

import { listBotChannels } from '@/lib/discord-broadcast';
import { botCanManageChannels } from '@/lib/discord-permissions';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { findOrCreateAnvilWebhook } from '@/lib/discord-webhooks';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { eventChannelSlug, freeChannelName } from '@/lib/eventChannelName';
import { log } from '@/lib/logger';
import { getSetting } from '@/lib/settings';

export type ChannelInput = undefined | null | { channelId?: unknown; webhookUrl?: unknown; create?: unknown };

export type ChannelResult =
  | { ok: true; keep: true }
  | { ok: true; keep: false; webhookUrl: string | null; channelId: string | null; createdChannelId?: string }
  | { ok: false; error: string };

/** What "Create a channel" needs to know about the event it is for. */
export interface CreateContext {
  eventName: string;
  /** The channel an earlier press made, if any (EventDiscordPrefs.createdChannelId). */
  createdChannelId?: string;
}

/** The channels the clan's bot can post to, for the picker (empty without a bot). */
export function channelChoices(clanId: number) {
  return listBotChannels(clanId).catch(() => ({ enabled: false, channels: [] }));
}

/** May the clan's bot make a channel for an event? False without a bot or Manage Channels. */
export async function canCreateEventChannel(clanId: number): Promise<boolean> {
  const creds = await getBotCredentials(clanId).catch(() => null);
  if (!creds) return false;
  return botCanManageChannels(creds.botToken, creds.guildId).catch(() => false);
}

/**
 * undefined = leave the current channel, null = back to the clan's channel, { channelId } = make a
 * webhook there, { webhookUrl } = use that one.
 */
export async function resolveChannelInput(clanId: number, input: ChannelInput, create?: CreateContext): Promise<ChannelResult> {
  if (input === undefined) return { ok: true, keep: true };
  if (input === null) return { ok: true, keep: false, webhookUrl: null, channelId: null };

  if (input.create === true) {
    if (!create) return { ok: false, error: 'Anvil can only make a channel for an event.' };
    return createEventChannel(clanId, create);
  }

  if (typeof input.channelId === 'string' && input.channelId) {
    const channelId = input.channelId;
    // Only a channel in THIS clan's server: the shared bot sits in many guilds, and a channel id from
    // another one would let a clan post into a server it doesn't own.
    const { enabled, channels } = await channelChoices(clanId);
    if (!enabled) return { ok: false, error: 'Connect your Discord bot first, or paste a webhook URL.' };
    if (!channels.some((c) => c.id === channelId)) return { ok: false, error: 'That channel is not in your server.' };
    const creds = await getBotCredentials(clanId);
    if (!creds) return { ok: false, error: 'Connect your Discord bot first, or paste a webhook URL.' };
    try {
      const hook = await findOrCreateAnvilWebhook(creds.botToken, channelId);
      return { ok: true, keep: false, webhookUrl: hook.url, channelId };
    } catch (e) {
      return { ok: false, error: (e as Error).message || 'Discord would not make a webhook there — the bot needs Manage Webhooks.' };
    }
  }

  const url = typeof input.webhookUrl === 'string' ? input.webhookUrl.trim() : '';
  if (!isDiscordWebhookUrl(url)) {
    return { ok: false, error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' };
  }
  return { ok: true, keep: false, webhookUrl: url, channelId: null };
}

const CHANNEL_TEXT = 0;

interface RawChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

/** Discord's answer to a channel create, in the member's words. */
async function createError(res: Response): Promise<string> {
  let message = '';
  let code: number | undefined;
  try {
    const body = (await res.clone().json()) as { message?: string; code?: number };
    message = body.message ?? '';
    code = body.code;
  } catch {
    /* not JSON */
  }
  if (res.status === 403 || code === 50013) {
    return 'The bot isn’t allowed to make channels. Give its role “Manage Channels” in Server Settings → Roles, then try again.';
  }
  if (res.status === 429) return 'Discord is asking the bot to slow down. Wait a minute and try again.';
  if (code === 30013) return 'Your server has reached Discord’s 500-channel limit. Delete a channel, or pick an existing one.';
  if (res.status === 401) return 'Discord turned the bot’s token down. Reconnect the bot under Admin → Discord.';
  return `Discord would not make the channel (${res.status}${message ? `: ${message}` : ''}).`;
}

/** The category the clan's bingo channel sits in, so the event's channel lands beside it. */
async function bingoCategory(clanId: number, botToken: string, channels: RawChannel[]): Promise<string | null> {
  const [bingo, general] = await Promise.all([
    getSetting(clanId, 'discord_webhook_bingo'),
    getSetting(clanId, 'discord_webhook_url'),
  ]);
  // Same fallback as the send path (lib/discord), first URL of a list.
  const m = /\/api\/(?:v\d+\/)?webhooks\/(\d+)\/([\w-]+)/.exec(bingo?.trim() || general?.trim() || '');
  if (!m) return null;
  const res = await discordRest(botToken, `/webhooks/${m[1]}/${m[2]}`);
  if (!res.ok) return null;
  const hook = (await res.json()) as { channel_id?: string };
  // Only a channel in this server's list counts — a pasted webhook can point anywhere.
  return channels.find((c) => c.id === hook.channel_id)?.parent_id ?? null;
}

/**
 * Make a text channel for the event (named from it, beside the clan's bingo channel), then a webhook
 * in it, and hand back the same result picking that channel would. A channel an earlier press made
 * that still exists is reused rather than doubled.
 */
async function createEventChannel(clanId: number, ctx: CreateContext): Promise<ChannelResult> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return { ok: false, error: 'Connect your Discord bot first, or paste a webhook URL.' };
  if (!(await botCanManageChannels(creds.botToken, creds.guildId))) {
    return { ok: false, error: 'The bot isn’t allowed to make channels. Give its role “Manage Channels” in Server Settings → Roles, then try again.' };
  }

  const listRes = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`);
  if (!listRes.ok) return { ok: false, error: await createError(listRes) };
  const channels = (await listRes.json()) as RawChannel[];

  let channel = ctx.createdChannelId ? channels.find((c) => c.id === ctx.createdChannelId && c.type === CHANNEL_TEXT) : undefined;
  let made = false;
  if (!channel) {
    const name = freeChannelName(eventChannelSlug(ctx.eventName), channels.map((c) => c.name));
    const parentId = await bingoCategory(clanId, creds.botToken, channels).catch(() => null);
    const post = (parent: string | null) =>
      discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`, {
        method: 'POST',
        body: JSON.stringify(parent ? { name, type: CHANNEL_TEXT, parent_id: parent } : { name, type: CHANNEL_TEXT }),
      });
    let res = await post(parentId);
    // A full category (50 channels) answers 400: put it at the top level rather than failing.
    if (!res.ok && res.status === 400 && parentId) res = await post(null);
    if (!res.ok) {
      log.warn('event-channel.create-fail', { clanId, status: res.status });
      return { ok: false, error: await createError(res) };
    }
    channel = (await res.json()) as RawChannel;
    made = true;
  }

  try {
    const hook = await findOrCreateAnvilWebhook(creds.botToken, channel.id);
    return { ok: true, keep: false, webhookUrl: hook.url, channelId: channel.id, createdChannelId: channel.id };
  } catch {
    // A channel nothing posts to is clutter: take back the one just made.
    const removed = made && (await discordRest(creds.botToken, `/channels/${channel.id}`, { method: 'DELETE' })).ok;
    return {
      ok: false,
      error: removed
        ? 'The bot made the channel but isn’t allowed to add a webhook to it, so it removed it again. Give its role “Manage Webhooks”, then try again.'
        : `The bot can’t add a webhook to #${channel.name}. Give its role “Manage Webhooks”, then pick #${channel.name} above.`,
    };
  }
}
