import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { isAcceptedCohost } from '@/lib/coHost';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { parsePartnerDiscordPrefs } from '@/lib/discordPostPolicy';
import { cohostSignupClanFor } from '@/lib/eventEditors';
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
  const [prefs, host] = await Promise.all([readPartnerDiscordPrefs(eventId, clanId), readEventDiscordPrefs(eventId)]);
  const { webhookUrl, ...rest } = prefs;
  return {
    prefs: rest,
    hasOwnChannel: !!webhookUrl,
    host: { share: host.cohosts === false ? 'none' : (host.partnerShare ?? 'all') },
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
  const body = (await request.json().catch(() => ({}))) as { prefs?: unknown; webhookUrl?: unknown };

  const current = await readPartnerDiscordPrefs(s.eventId, s.clanId);
  const next = parsePartnerDiscordPrefs(body.prefs ?? {});
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

  await savePartnerDiscordPrefs(s.eventId, s.clanId, next);
  return NextResponse.json(await view(s.eventId, s.clanId));
}
