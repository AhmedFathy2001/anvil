import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { channelChoices, resolveChannelInput, type ChannelInput } from '@/lib/eventDiscordChannel';
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
  const channels = await channelChoices(clanId);
  return {
    prefs: rest,
    hasOwnChannel: !!webhookUrl,
    channels,
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
 * Replaces the event's choices with the body's `prefs`. `channel` (lib/eventDiscordChannel): absent
 * keeps the event's own channel, null goes back to the clan's, { channelId } or { webhookUrl } sets one.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as { prefs?: unknown; channel?: ChannelInput };

  const current = await readEventDiscordPrefs(s.eventId);
  const next = parseEventDiscordPrefs(body.prefs ?? {});
  const channel = await resolveChannelInput(s.clanId, body.channel);
  if (!channel.ok) return NextResponse.json({ error: channel.error }, { status: 400 });
  delete next.webhookUrl;
  delete next.channelId;
  if (channel.keep) {
    if (current.webhookUrl) next.webhookUrl = current.webhookUrl;
    if (current.channelId) next.channelId = current.channelId;
  } else if (channel.webhookUrl) {
    next.webhookUrl = channel.webhookUrl;
    if (channel.channelId) next.channelId = channel.channelId;
  }

  await saveEventDiscordPrefs(s.eventId, next);
  return NextResponse.json(await view(s.eventId, s.clanId));
}
