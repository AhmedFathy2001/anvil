import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { getSetting, setSetting } from '@/lib/settings';
import { verifyAdmin } from '@/lib/auth';
import { getBotCredentials } from '@/lib/discord-roles';
import { listBotChannels } from '@/lib/discord-broadcast';
import {
  createChannelWebhook,
  createMoreAnvilWebhooks,
  findOrCreateAnvilWebhook,
  lookupWebhookChannel,
  DEFAULT_WEBHOOK_NAME,
} from '@/lib/discord-webhooks';
import { poolChannels } from '@/lib/webhookCapacity';
import { MAX_RECOMMENDED_WEBHOOKS } from '@/lib/webhookPool';
import { noteWebhookSave } from '@/lib/sharedWebhooks';
import { botCanManageWebhooks } from '@/lib/discord-permissions';
import { parseWebhookUrls } from '@/lib/discord';
import { WEBHOOK_SETTING_KEYS } from '@/lib/pluginConfig';
import { WEBHOOK_URL_KEYS } from '@/lib/webhookFields';

// The setting keys a bot-created webhook URL may be written to. Constrains the write to known
// webhook destinations even though this route is admin-gated, so a bad `settingKey` can't clobber
// an unrelated setting.
//
// DERIVED, both halves. This used to be a hand-written list beside a comment warning about lists
// nobody remembers to edit, and then the coffer channel was added and nobody remembered to edit it:
// the field rendered, a pasted URL saved, and the bot picker answered "Unknown webhook setting."
// Now the fields themselves are the list, plus every plugin destination, so a channel added in
// either place is creatable the same day.
const WEBHOOK_KEYS = new Set<string>([...WEBHOOK_URL_KEYS, ...WEBHOOK_SETTING_KEYS]);

// Discord caps webhook names at 80 chars.
const NAME_MAX = 80;

// GET — two modes:
//   ?channelId=<id>  → { ok, reason? } whether the bot can create a webhook in that channel
//                       (checked live when the admin picks a channel).
//   ?pool=<key>      → { count, mixed, unknown } whether a multi-webhook setting all posts to ONE
//                       channel (pooling is for one channel; lib/webhookPool).
//   (no param)       → { enabled, channels } for the picker. `enabled` false = no bot configured.
export async function GET(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const poolKey = new URL(request.url).searchParams.get('pool');
  if (poolKey) {
    if (!WEBHOOK_KEYS.has(poolKey)) return NextResponse.json({ error: 'Unknown webhook setting.' }, { status: 400 });
    const urls = parseWebhookUrls(await getSetting(clan.id, poolKey));
    if (urls.length < 2) return NextResponse.json({ count: urls.length, mixed: false, unknown: 0 });
    const { mixed, unknown } = await poolChannels(urls);
    return NextResponse.json({ count: urls.length, mixed, unknown });
  }

  const channelId = new URL(request.url).searchParams.get('channelId');
  if (channelId) {
    const creds = await getBotCredentials(clan.id);
    if (!creds) return NextResponse.json({ ok: false, reason: 'Discord bot is not configured.' });
    const result = await botCanManageWebhooks(creds.botToken, creds.guildId, channelId);
    return NextResponse.json(result);
  }

  const data = await listBotChannels(clan.id);
  return NextResponse.json(data);
}

// POST — create a webhook in a channel and store its URL.
//   { channelId, settingKey, mode: 'replace' | 'append', name? }
//   replace → find-or-reuse an "Anvil" webhook and set the key to that single URL (idempotent).
//   append  → create an additional webhook and push it onto the key's round-robin URL list. Refused
//             when the picked channel isn't the one the list already posts to: a pool is ONE channel.
//   more    → { settingKey, count } the bot adds `count` more webhooks to the channel the list already
//             posts to (no channel pick needed).
// Returns { urls } — the full stored list after the change — so the client reflects state.
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { settingKey, mode, name, count } = payload as Record<string, unknown>;
  let { channelId } = payload as Record<string, unknown>;

  if (typeof settingKey !== 'string' || !WEBHOOK_KEYS.has(settingKey)) {
    return NextResponse.json({ error: 'Unknown webhook setting.' }, { status: 400 });
  }
  if (mode !== 'replace' && mode !== 'append' && mode !== 'more') {
    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
  }
  const existingUrls = parseWebhookUrls(await getSetting(clan.id, settingKey));
  // The channel the list already posts to — where 'more' adds, and what 'append' must match.
  const poolChannel = mode !== 'replace' && existingUrls.length ? (await lookupWebhookChannel(existingUrls[0]))?.channelId ?? null : null;
  if (mode === 'more') {
    if (!poolChannel) {
      return NextResponse.json({ error: 'Couldn’t tell which channel this posts to. Pick the channel and press “Post here” first.' }, { status: 400 });
    }
    channelId = poolChannel;
  }
  if (typeof channelId !== 'string' || !channelId) {
    return NextResponse.json({ error: 'Select a channel.' }, { status: 400 });
  }
  if (mode === 'append' && poolChannel && poolChannel !== channelId) {
    return NextResponse.json(
      { error: 'Extra webhooks have to be in the same channel as the first one: they share its posts. Pick that channel, or use “Post here” to switch channels.' },
      { status: 400 },
    );
  }
  // The shared bot sits in many servers: only a channel in this clan's own server.
  const { channels } = await listBotChannels(clan.id);
  if (!channels.some((c) => c.id === channelId)) {
    return NextResponse.json({ error: 'That channel isn’t in your server.' }, { status: 400 });
  }
  const baseName = (typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_WEBHOOK_NAME).slice(0, NAME_MAX);

  const creds = await getBotCredentials(clan.id);
  if (!creds) {
    return NextResponse.json(
      { error: 'Discord bot is not configured. Set DISCORD_BOT_TOKEN and the Server ID first.' },
      { status: 400 },
    );
  }

  try {
    let urls: string[];
    if (mode === 'replace') {
      const wh = await findOrCreateAnvilWebhook(creds.botToken, channelId, baseName);
      urls = [wh.url];
    } else if (mode === 'more') {
      const want = Math.max(1, Math.min(MAX_RECOMMENDED_WEBHOOKS - existingUrls.length, Math.floor(Number(count) || 1)));
      if (existingUrls.length >= MAX_RECOMMENDED_WEBHOOKS) {
        return NextResponse.json({ error: `That’s the most Anvil uses for one channel (${MAX_RECOMMENDED_WEBHOOKS}).` }, { status: 400 });
      }
      const { created } = await createMoreAnvilWebhooks(creds.botToken, channelId, want, baseName);
      urls = [...existingUrls, ...created.map((c) => c.url)];
    } else {
      // Append a distinct new webhook. Suffix the name (Anvil 2, Anvil 3…) so multiple webhooks in
      // one channel stay tellable apart in Discord's UI.
      const existing = existingUrls;
      const suffixed = existing.length === 0 ? baseName : `${baseName} ${existing.length + 1}`.slice(0, NAME_MAX);
      const wh = await createChannelWebhook(creds.botToken, channelId, suffixed);
      urls = [...existing, wh.url];
    }
    await setSetting(clan.id, settingKey, urls.length ? urls.join(' ') : null);
    noteWebhookSave(urls);
    return NextResponse.json({ urls });
  } catch (err) {
    // Lib functions throw a human-readable message (missing perm, channel gone, 15-webhook cap…).
    const message = err instanceof Error ? err.message : 'Failed to create webhook.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
