import { NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { parseWebhookUrls } from '@/lib/discord';
import { listBotChannels } from '@/lib/discord-broadcast';
import { getBotCredentials } from '@/lib/discord-roles';
import { findOrCreateAnvilWebhook } from '@/lib/discord-webhooks';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { DISCORD_FEEDS, FEED_KEYS, FEEDS_OFF_KEY, GAME_CATCH_ALL, SITE_CATCH_ALL, feedById, parseFeedsOff } from '@/lib/discordFeeds';
import { getSetting, getSettingMap, setSetting } from '@/lib/settings';

/**
 * "What goes where" on Admin → Discord (lib/discordFeeds): every feed with the channel it posts to
 * today — its own, or the fallback it lands in — and whether it is switched off.
 *
 * Webhook URLs are secrets, so they never come back. Instead each set webhook is asked which
 * channel it posts into (a webhook's own URL answers that without a bot token), and the page shows
 * the channel's name.
 */

const channelCache = new Map<string, { at: number; channelId: string | null }>();
const CHANNEL_TTL_MS = 10 * 60_000;

async function webhookChannelId(url: string): Promise<string | null> {
  const hit = channelCache.get(url);
  if (hit && Date.now() - hit.at < CHANNEL_TTL_MS) return hit.channelId;
  let channelId: string | null = null;
  try {
    if (isDiscordWebhookUrl(url)) {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) channelId = ((await res.json()) as { channel_id?: string }).channel_id ?? null;
    }
  } catch {
    channelId = null;
  }
  channelCache.set(url, { at: Date.now(), channelId });
  return channelId;
}

const CATCH_ALLS = [SITE_CATCH_ALL, GAME_CATCH_ALL];

async function view(clanId: number) {
  const [map, channels] = await Promise.all([
    getSettingMap(clanId, [...FEED_KEYS, FEEDS_OFF_KEY, 'discord_cohost_posts_enabled']),
    listBotChannels(clanId).catch(() => ({ enabled: false, channels: [] })),
  ]);
  const keys: Record<string, { set: boolean; channelId: string | null }> = {};
  await Promise.all(
    FEED_KEYS.map(async (key) => {
      const first = parseWebhookUrls(map.get(key))[0];
      keys[key] = { set: !!first, channelId: first ? await webhookChannelId(first) : null };
    }),
  );
  const off = [...parseFeedsOff(map.get(FEEDS_OFF_KEY))];
  const cohost = map.get('discord_cohost_posts_enabled')?.trim();
  if (cohost === 'false' || cohost === '0') off.push('cohost');
  return {
    feeds: DISCORD_FEEDS,
    catchAlls: { site: SITE_CATCH_ALL, game: GAME_CATCH_ALL },
    keys,
    off,
    channels,
  };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  return NextResponse.json(await view(clan.id));
}

/**
 * One change at a time:
 *   { feed, off: boolean }                  switch a feed on or off
 *   { key, channelId }                      point a feed's (or a catch-all's) setting at a channel
 *   { key, webhookUrl }                     … or at a pasted webhook
 *   { key, clear: true }                    blank it, so it falls back again
 * `key` must be one of the page's settings.
 */
export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.feed === 'string' && typeof body.off === 'boolean') {
    const feed = feedById(body.feed);
    if (!feed || feed.off === 'perPost') return NextResponse.json({ error: 'Unknown feed.' }, { status: 400 });
    if (feed.off === 'cohost') {
      await setSetting(clan.id, 'discord_cohost_posts_enabled', body.off ? 'false' : 'true');
    } else {
      const off = parseFeedsOff(await getSetting(clan.id, FEEDS_OFF_KEY));
      if (body.off) off.add(feed.id);
      else off.delete(feed.id);
      await setSetting(clan.id, FEEDS_OFF_KEY, JSON.stringify([...off]));
    }
    return NextResponse.json(await view(clan.id));
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const allowed = CATCH_ALLS.includes(key) || DISCORD_FEEDS.some((f) => f.key === key);
  if (!allowed) return NextResponse.json({ error: 'Unknown channel setting.' }, { status: 400 });

  if (body.clear === true) {
    await setSetting(clan.id, key, null);
    return NextResponse.json(await view(clan.id));
  }

  if (typeof body.channelId === 'string' && body.channelId) {
    // Only a channel in THIS clan's server — the shared bot sits in many.
    const { enabled, channels } = await listBotChannels(clan.id).catch(() => ({ enabled: false, channels: [] }));
    if (!enabled) return NextResponse.json({ error: 'Connect your Discord bot first, or paste a webhook URL.' }, { status: 400 });
    if (!channels.some((c) => c.id === body.channelId)) return NextResponse.json({ error: 'That channel is not in your server.' }, { status: 400 });
    const creds = await getBotCredentials(clan.id);
    if (!creds) return NextResponse.json({ error: 'Connect your Discord bot first.' }, { status: 400 });
    try {
      const hook = await findOrCreateAnvilWebhook(creds.botToken, body.channelId);
      await setSetting(clan.id, key, hook.url);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
    return NextResponse.json(await view(clan.id));
  }

  const url = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
  if (!isDiscordWebhookUrl(url)) {
    return NextResponse.json({ error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' }, { status: 400 });
  }
  await setSetting(clan.id, key, url);
  return NextResponse.json(await view(clan.id));
}
