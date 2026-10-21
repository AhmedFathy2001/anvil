import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { getSettingMap, setSetting } from '@/lib/settings';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { findOrCreateAnvilWebhook } from '@/lib/discord-webhooks';
import { log } from '@/lib/logger';
import {
  QUICK_SETUP_GROUPS,
  QUICK_SETUP_KEYS,
  isQuickSetupLayout,
  setupNotes,
} from '@/lib/discordQuickSetup';

const CHANNEL_TEXT = 0;
const CHANNEL_CATEGORY = 4;
const CHANNEL_ANNOUNCEMENT = 5;
const CATEGORY_NAME = 'Anvil';

interface RawChannel {
  id: string;
  name: string;
  type: number;
}

interface QuickSetupRow {
  settingKey: string;
  channelId: string | null;
  channelName: string | null;
  created: boolean;
  error?: string;
}

async function discordError(res: Response, what: string): Promise<string> {
  let message = '';
  try {
    message = ((await res.clone().json()) as { message?: string }).message ?? '';
  } catch {
    /* not JSON */
  }
  if (res.status === 403) return `The bot isn’t allowed to ${what}. Give its role “Manage Channels” and “Manage Webhooks”.`;
  return `Discord ${res.status}${message ? `: ${message}` : ''} while trying to ${what}.`;
}

// POST { layout: 'one' | 'few' | 'all', reuse?: { [settingKey]: channelId } }
//
// For each setting the layout writes: use the reused channel if given, else a text channel with the
// exact name, else create it under an "Anvil" category (made once if missing). Then find-or-create
// the Anvil webhook there and store its URL in the setting (replace, as the webhooks route's
// "replace" mode does). Other routing keys are left alone; `notes` says which of them still win.
// Sequential and partial-failure tolerant.
//   → { rows: [{ settingKey, channelId, channelName, created, error? }], notes: string[] }
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as { layout?: unknown; reuse?: unknown } | null;
  if (!payload || !isQuickSetupLayout(payload.layout)) {
    return NextResponse.json({ error: 'Pick a layout.' }, { status: 400 });
  }
  const layout = payload.layout;
  const targets = QUICK_SETUP_GROUPS[layout];
  const reuse: Record<string, string> = {};
  if (payload.reuse && typeof payload.reuse === 'object' && !Array.isArray(payload.reuse)) {
    for (const [k, v] of Object.entries(payload.reuse as Record<string, unknown>)) {
      if (typeof v === 'string' && /^\d{1,25}$/.test(v) && targets.some((t) => t.settingKey === k)) reuse[k] = v;
    }
  }

  const creds = await getBotCredentials(clan.id);
  if (!creds) return NextResponse.json({ error: 'Add the bot to your server first.' }, { status: 400 });

  const chRes = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`);
  if (!chRes.ok) return NextResponse.json({ error: await discordError(chRes, 'list your channels') }, { status: 400 });
  const channels = (await chRes.json()) as RawChannel[];
  // Only channels in THIS clan's server are usable — a reuse id from anywhere else is ignored.
  const postable = new Map(
    channels.filter((c) => c.type === CHANNEL_TEXT || c.type === CHANNEL_ANNOUNCEMENT).map((c) => [c.id, c]),
  );

  const before = Object.fromEntries(await getSettingMap(clan.id, [...QUICK_SETUP_KEYS]));

  let categoryId: string | null =
    channels.find((c) => c.type === CHANNEL_CATEGORY && c.name.toLowerCase() === CATEGORY_NAME.toLowerCase())?.id ?? null;

  const rows: QuickSetupRow[] = [];
  for (const target of targets) {
    try {
      let channel: RawChannel | undefined = reuse[target.settingKey] ? postable.get(reuse[target.settingKey]) : undefined;
      if (!channel) channel = [...postable.values()].find((c) => c.name === target.channelName);
      let created = false;
      if (!channel) {
        if (!categoryId) {
          const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`, {
            method: 'POST',
            body: JSON.stringify({ name: CATEGORY_NAME, type: CHANNEL_CATEGORY }),
          });
          if (!res.ok) throw new Error(await discordError(res, 'make the Anvil category'));
          categoryId = ((await res.json()) as RawChannel).id;
        }
        const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`, {
          method: 'POST',
          body: JSON.stringify({ name: target.channelName, type: CHANNEL_TEXT, parent_id: categoryId }),
        });
        if (!res.ok) throw new Error(await discordError(res, `make #${target.channelName}`));
        channel = (await res.json()) as RawChannel;
        postable.set(channel.id, channel);
        created = true;
      }
      const wh = await findOrCreateAnvilWebhook(creds.botToken, channel.id);
      for (const key of [target.settingKey, ...(target.alsoKeys ?? [])]) await setSetting(clan.id, key, wh.url);
      rows.push({ settingKey: target.settingKey, channelId: channel.id, channelName: channel.name, created });
    } catch (err) {
      rows.push({
        settingKey: target.settingKey,
        channelId: null,
        channelName: null,
        created: false,
        error: err instanceof Error ? err.message : 'Setup failed.',
      });
    }
  }

  log.info('discord.quick-setup', {
    clanId: clan.id,
    layout,
    ok: rows.filter((r) => !r.error).length,
    failed: rows.filter((r) => r.error).length,
  });
  return NextResponse.json({ rows, notes: setupNotes(layout, before) });
}
