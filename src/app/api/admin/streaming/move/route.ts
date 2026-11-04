import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { streamsEvents } from '@/lib/creatorSpaces';
import { isStreamChannelPlatform, moveOffer, moveStreamChannel } from '@/lib/streamChannels';

/**
 * "This channel is connected to <X>. Move it here?" (lib/streamChannels) — after a Twitch, Kick or
 * YouTube connect found the channel already connected to another place this admin also runs.
 *
 *   GET  ?platform=twitch|kick|youtube&from=<clanId>  → { offer } (null when they may not move it)
 *   POST { platform, from }                           → { ok, channel }
 *
 * Admin of THIS space (which must stream) here, and lib/streamChannels re-checks admin of both.
 */
async function guard() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!streamsEvents(clan)) return { error: NextResponse.json({ error: 'Turn on Streaming first' }, { status: 404 }) };
  const session = await verifyUser();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { clan, session };
}

function parse(platform: unknown, from: unknown) {
  const id = Number(from);
  if (!isStreamChannelPlatform(platform) || !Number.isInteger(id) || id <= 0) return null;
  return { platform, from: id };
}

export async function GET(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const url = new URL(request.url);
  const p = parse(url.searchParams.get('platform'), url.searchParams.get('from'));
  if (!p) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  return NextResponse.json({ offer: await moveOffer(p.platform, p.from, g.clan.id, g.session.userId) });
}

export async function POST(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const body = (await request.json().catch(() => null)) as { platform?: unknown; from?: unknown } | null;
  const p = parse(body?.platform, body?.from);
  if (!p) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const r = await moveStreamChannel({ platform: p.platform, fromClanId: p.from, toClanId: g.clan.id, userId: g.session.userId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ ok: true, channel: r.channel });
}
