import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { parseEventDiscordPrefs } from '@/lib/discordPostPolicy';
import {
  loadClanEventRoleDefaults,
  loadClanPostDefaults,
  loadEventRoleSettings,
  readEventDiscordPrefs,
  saveEventDiscordPrefs,
} from '@/lib/eventDiscordPrefs';
import { getSetting } from '@/lib/settings';

/**
 * One event's Discord tab (lib/discordPostPolicy): which posts go out, who they ping, its own
 * channel, a pause, what co-hosts may show, and its team-channel and role timing. Host staff only;
 * a co-host sets its own side at /api/admin/cohosted/<id>/discord-settings.
 *
 * The event's own webhook is a secret, so it never comes back — only whether one is set.
 */

async function scope(eventIdRaw: string) {
  const eventId = Number(eventIdRaw);
  if (!Number.isInteger(eventId)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  const user = await verifyAdminOrModerator();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) } as const;
  const clan = await requireClan();
  const event = await eventInClan(clan.id, eventId);
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  return { eventId, clanId: clan.id } as const;
}

async function view(eventId: number, clanId: number) {
  const [prefs, clanPosts, clanRoles, roles, teamSync] = await Promise.all([
    readEventDiscordPrefs(eventId),
    loadClanPostDefaults(clanId),
    loadClanEventRoleDefaults(clanId),
    loadEventRoleSettings(eventId, clanId),
    getSetting(clanId, 'discord_team_sync_enabled'),
  ]);
  const { webhookUrl, ...rest } = prefs;
  return {
    prefs: rest,
    hasOwnChannel: !!webhookUrl,
    clanDefaults: { ...clanPosts, roles: clanRoles, teamChannels: teamSync === 'true' },
    roles,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  return NextResponse.json(await view(s.eventId, s.clanId));
}

/**
 * Replaces the event's choices with the body's `prefs`. `webhookUrl`: absent keeps the current
 * channel, null clears it, a string sets it (Discord webhooks only — the server posts to it).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as { prefs?: unknown; webhookUrl?: unknown };

  const current = await readEventDiscordPrefs(s.eventId);
  const next = parseEventDiscordPrefs(body.prefs ?? {});
  if (body.webhookUrl === undefined) {
    if (current.webhookUrl) next.webhookUrl = current.webhookUrl;
  } else if (body.webhookUrl !== null) {
    const url = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
    if (!isDiscordWebhookUrl(url)) {
      return NextResponse.json({ error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' }, { status: 400 });
    }
    next.webhookUrl = url;
  } else {
    delete next.webhookUrl;
  }

  await saveEventDiscordPrefs(s.eventId, next);
  return NextResponse.json(await view(s.eventId, s.clanId));
}
