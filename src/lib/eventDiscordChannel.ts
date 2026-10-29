// "Post this event somewhere else": the channel picker on an event's (or a co-host's) Discord tab.
// The admin picks a channel in their own server and Anvil makes the webhook — or, without a bot,
// pastes one. Either way the URL is the secret that ends up in the prefs; the channel id rides along
// so the page can show "#name" without ever echoing the URL.

import { listBotChannels } from '@/lib/discord-broadcast';
import { getBotCredentials } from '@/lib/discord-roles';
import { findOrCreateAnvilWebhook } from '@/lib/discord-webhooks';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';

export type ChannelInput = undefined | null | { channelId?: unknown; webhookUrl?: unknown };

export type ChannelResult =
  | { ok: true; keep: true }
  | { ok: true; keep: false; webhookUrl: string | null; channelId: string | null }
  | { ok: false; error: string };

/** The channels the clan's bot can post to, for the picker (empty without a bot). */
export function channelChoices(clanId: number) {
  return listBotChannels(clanId).catch(() => ({ enabled: false, channels: [] }));
}

/**
 * undefined = leave the current channel, null = back to the clan's channel, { channelId } = make a
 * webhook there, { webhookUrl } = use that one.
 */
export async function resolveChannelInput(clanId: number, input: ChannelInput): Promise<ChannelResult> {
  if (input === undefined) return { ok: true, keep: true };
  if (input === null) return { ok: true, keep: false, webhookUrl: null, channelId: null };

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
