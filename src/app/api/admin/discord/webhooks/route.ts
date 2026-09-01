import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { getSetting, setSetting } from '@/lib/settings';
import { verifyAdmin } from '@/lib/auth';
import { getBotCredentials } from '@/lib/discord-roles';
import { listBotChannels } from '@/lib/discord-broadcast';
import { createChannelWebhook, findOrCreateAnvilWebhook, DEFAULT_WEBHOOK_NAME } from '@/lib/discord-webhooks';
import { botCanManageWebhooks } from '@/lib/discord-permissions';
import { parseWebhookUrls } from '@/lib/discord';
import { WEBHOOK_SETTING_KEYS } from '@/lib/pluginConfig';

// The setting keys a bot-created webhook URL may be written to — the same set the WebhookField
// component renders. Constrains the write to known webhook destinations even though this route is
// admin-gated, so a bad `settingKey` can't clobber an unrelated setting.
const WEBHOOK_KEYS = new Set([
  'discord_webhook_url',
  'discord_webhook_bingo',
  'discord_webhook_weekly',
  'discord_webhook_signups',
  // Every plugin destination, base included — derived so a channel added there is immediately
  // creatable from the bot picker instead of silently rejected by a list nobody remembered to edit.
  ...WEBHOOK_SETTING_KEYS,
]);

// Discord caps webhook names at 80 chars.
const NAME_MAX = 80;

// GET — two modes:
//   ?channelId=<id>  → { ok, reason? } whether the bot can create a webhook in that channel
//                       (checked live when the admin picks a channel).
//   (no param)       → { enabled, channels } for the picker. `enabled` false = no bot configured.
export async function GET(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
//   append  → create an additional webhook and push it onto the key's round-robin URL list.
// Returns { urls } — the full stored list after the change — so the client reflects state.
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { channelId, settingKey, mode, name } = payload as Record<string, unknown>;

  if (typeof channelId !== 'string' || !channelId) {
    return NextResponse.json({ error: 'Select a channel.' }, { status: 400 });
  }
  if (typeof settingKey !== 'string' || !WEBHOOK_KEYS.has(settingKey)) {
    return NextResponse.json({ error: 'Unknown webhook setting.' }, { status: 400 });
  }
  if (mode !== 'replace' && mode !== 'append') {
    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
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
    } else {
      // Append a distinct new webhook. Suffix the name (Anvil 2, Anvil 3…) so multiple webhooks in
      // one channel stay tellable apart in Discord's UI.
      const existing = parseWebhookUrls(await getSetting(clan.id, settingKey));
      const suffixed = existing.length === 0 ? baseName : `${baseName} ${existing.length + 1}`.slice(0, NAME_MAX);
      const wh = await createChannelWebhook(creds.botToken, channelId, suffixed);
      urls = [...existing, wh.url];
    }
    await setSetting(clan.id, settingKey, urls.length ? urls.join(' ') : null);
    return NextResponse.json({ urls });
  } catch (err) {
    // Lib functions throw a human-readable message (missing perm, channel gone, 15-webhook cap…).
    const message = err instanceof Error ? err.message : 'Failed to create webhook.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
