import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { streamsEvents } from '@/lib/creatorSpaces';
import { hostTwitchChannel } from '@/lib/entryGatesDb';
import { hostYoutubeChannel } from '@/lib/gates/youtubeDb';
import { hostHighlightSettings, setHostHighlightSettings } from '@/lib/highlights/store';

/**
 * A streaming space's stream-highlight choices (lib/highlights): auto-clip big moments on its own
 * channel, and whether Anvil may feature those clips. Admins of a creator space or a clan with
 * Streaming on. Answers with two flags and whether a channel is connected — never a token.
 */
async function guard() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!streamsEvents(clan)) return { error: NextResponse.json({ error: 'Turn on Streaming first' }, { status: 404 }) };
  return { clan };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const [settings, twitch, youtube] = await Promise.all([
    hostHighlightSettings(g.clan.id),
    hostTwitchChannel(g.clan.id),
    hostYoutubeChannel(g.clan.id),
  ]);
  return NextResponse.json({ ...settings, twitch: twitch?.login ?? null, youtube: youtube?.title ?? null });
}

export async function PATCH(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const body = (await request.json().catch(() => null)) as { autoClip?: unknown; promo?: unknown } | null;
  const patch: { autoClip?: boolean; promo?: boolean } = {};
  if (typeof body?.autoClip === 'boolean') patch.autoClip = body.autoClip;
  if (typeof body?.promo === 'boolean') patch.promo = body.promo;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  const next = await setHostHighlightSettings(g.clan.id, patch);
  const actor = await verifyUser();
  await db
    .insert(clanAuditLog)
    .values({ clanId: g.clan.id, eventType: 'stream_highlights_changed', actorUserId: actor?.userId ?? null, newValue: JSON.stringify(patch) })
    .catch(() => {});
  return NextResponse.json(next);
}
