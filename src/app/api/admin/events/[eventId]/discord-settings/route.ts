import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { canCreateEventChannel, channelChoices, resolveChannelInput, type ChannelInput } from '@/lib/eventDiscordChannel';
import { eventChannelSlug, freeChannelName } from '@/lib/eventChannelName';
import { parseEventDiscordPrefs } from '@/lib/discordPostPolicy';
import {
  loadClanEventRoleDefaults,
  loadClanPostDefaults,
  loadEventRoleSettings,
  readEventDiscordPrefs,
  saveEventDiscordPrefs,
} from '@/lib/eventDiscordPrefs';
import { getSetting } from '@/lib/settings';
import { partnerDiscordReadiness } from '@/lib/partnerDiscordReadiness';
import { eventChannelUrls } from '@/lib/discord';
import { eventWebhookCapacity, poolView } from '@/lib/webhookCapacity';
import { botCanManageWebhooks } from '@/lib/discord-permissions';
import { getBotCredentials } from '@/lib/discord-roles';

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
  return { eventId, clanId: clan.id, eventName: event.name } as const;
}

async function view(eventId: number, clanId: number, eventName: string) {
  const [prefs, clanPosts, clanRoles, roles, teamSync] = await Promise.all([
    readEventDiscordPrefs(eventId),
    loadClanPostDefaults(clanId),
    loadClanEventRoleDefaults(clanId),
    loadEventRoleSettings(eventId, clanId),
    getSetting(clanId, 'discord_team_sync_enabled'),
  ]);
  const { webhookUrl, extraWebhookUrls, ...rest } = prefs;
  void extraWebhookUrls;
  const [channels, partners, capacity] = await Promise.all([
    channelChoices(clanId),
    partnerDiscordReadiness(eventId, clanId),
    eventWebhookCapacity(eventId, clanId, prefs),
  ]);
  // "Create a channel" only shows when the bot is in and may make one; the name is what it would get.
  // Hidden while the channel an earlier press made still exists: it is in the picker already.
  const madeOne = !!rest.createdChannelId && channels.channels.some((c) => c.id === rest.createdChannelId);
  const canCreate = channels.enabled && !madeOne && (await canCreateEventChannel(clanId));
  // May the bot add webhooks to the event's own channel? Only asked when the advice is showing.
  // A pasted webhook has no channel id here; the pool route finds its channel and says if it can't.
  let botCanAddWebhooks = channels.enabled;
  if (capacity.advice && channels.enabled && rest.channelId) {
    const creds = await getBotCredentials(clanId).catch(() => null);
    botCanAddWebhooks = !!creds && (await botCanManageWebhooks(creds.botToken, creds.guildId, rest.channelId).catch(() => ({ ok: false }))).ok;
  }
  return {
    prefs: rest,
    hasOwnChannel: !!webhookUrl,
    // The event channel's webhooks as masked ids, never URLs (lib/webhookPool).
    pool: poolView(eventChannelUrls(prefs)),
    capacity: { ...capacity, botCanAddWebhooks },
    channels: {
      ...channels,
      create: canCreate ? { name: freeChannelName(eventChannelSlug(eventName), channels.channels.map((c) => c.name)) } : null,
    },
    clanDefaults: { ...clanPosts, roles: clanRoles, teamChannels: teamSync === 'true' },
    roles,
    // Each co-host's side, as facts (lib/partnerDiscordReadiness) — never its ids.
    partners,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  return NextResponse.json(await view(s.eventId, s.clanId, s.eventName));
}

/**
 * Replaces the event's choices with the body's `prefs`. `channel` (lib/eventDiscordChannel): absent
 * keeps the event's own channel, null goes back to the clan's, { channelId } or { webhookUrl } sets one,
 * { create: true } has the bot make a channel named for the event and sets that.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as { prefs?: unknown; channel?: ChannelInput };

  const current = await readEventDiscordPrefs(s.eventId);
  const next = parseEventDiscordPrefs(body.prefs ?? {});
  const channel = await resolveChannelInput(s.clanId, body.channel, {
    eventName: s.eventName,
    createdChannelId: current.createdChannelId,
  });
  if (!channel.ok) return NextResponse.json({ error: channel.error }, { status: 400 });
  delete next.webhookUrl;
  delete next.channelId;
  delete next.createdChannelId;
  // The pool is edited only by ./pool, and belongs to one channel: it survives a save that keeps the
  // channel and is dropped with it when the channel changes.
  delete next.extraWebhookUrls;
  // The channel Anvil made outlives a switch elsewhere, so switching back reuses it.
  const created = !channel.keep && channel.createdChannelId ? channel.createdChannelId : current.createdChannelId;
  if (created) next.createdChannelId = created;
  if (channel.keep) {
    if (current.webhookUrl) next.webhookUrl = current.webhookUrl;
    if (current.channelId) next.channelId = current.channelId;
    if (current.extraWebhookUrls?.length) next.extraWebhookUrls = current.extraWebhookUrls;
  } else if (channel.webhookUrl) {
    next.webhookUrl = channel.webhookUrl;
    if (channel.channelId) next.channelId = channel.channelId;
  }

  await saveEventDiscordPrefs(s.eventId, next);
  return NextResponse.json(await view(s.eventId, s.clanId, s.eventName));
}
