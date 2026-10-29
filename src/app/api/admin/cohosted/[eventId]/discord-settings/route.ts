import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { isAcceptedCohost } from '@/lib/coHost';
import { channelChoices, resolveChannelInput, type ChannelInput } from '@/lib/eventDiscordChannel';
import { parsePartnerDiscordPrefs } from '@/lib/discordPostPolicy';
import { cohostSignupClanFor } from '@/lib/eventEditors';
import { getSetting } from '@/lib/settings';
import { readEventDiscordPrefs, readPartnerDiscordPrefs, savePartnerDiscordPrefs } from '@/lib/eventDiscordPrefs';

/**
 * A co-host clan's side of a board's Discord (lib/discordPostPolicy decidePartnerPost): what its own
 * server shows, where, who it pings, and the roles its bot hands its own players. Capped by what the
 * host shares, which is returned so the page can say why something is unavailable. Staff of the
 * co-host clan only (the same seat the co-hosted page asks for).
 */

async function scope(eventIdRaw: string) {
  const eventId = Number(eventIdRaw);
  if (!Number.isInteger(eventId)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  const [session, clan] = await Promise.all([verifyUser(), requireClan()]);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) } as const;
  if (!(await isAcceptedCohost(eventId, clan.id))) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  if ((await cohostSignupClanFor(eventId, session.userId)) !== clan.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) } as const;
  }
  return { eventId, clanId: clan.id } as const;
}

async function view(eventId: number, clanId: number) {
  const [prefs, host, roleSync] = await Promise.all([
    readPartnerDiscordPrefs(eventId, clanId),
    readEventDiscordPrefs(eventId),
    getSetting(clanId, 'discord_cohost_role_sync_enabled'),
  ]);
  const { webhookUrl, ...rest } = prefs;
  const channels = await channelChoices(clanId);
  return {
    prefs: rest,
    hasOwnChannel: !!webhookUrl,
    channels,
    host: { share: host.cohosts === false ? 'none' : (host.partnerShare ?? 'all') },
    // What "give my players the role" is when this board hasn't been set: the clan-wide switch.
    playerRoleDefault: roleSync === 'true',
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  return NextResponse.json(await view(s.eventId, s.clanId));
}

export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as { prefs?: unknown; channel?: ChannelInput };

  const current = await readPartnerDiscordPrefs(s.eventId, s.clanId);
  const next = parsePartnerDiscordPrefs(body.prefs ?? {});
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

  await savePartnerDiscordPrefs(s.eventId, s.clanId, next);
  return NextResponse.json(await view(s.eventId, s.clanId));
}
