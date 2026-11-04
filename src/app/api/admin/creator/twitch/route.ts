import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { disconnectHostTwitch, hostTwitchChannel } from '@/lib/entryGatesDb';
import { twitchConfigured } from '@/lib/twitch';

/**
 * A creator space's connected Twitch channel — what the follower/subscriber gates check against.
 * Status and disconnect here; connecting is the OAuth round trip at /api/auth/twitch/start?as=host.
 * Tokens never leave the server: this answers with the channel name and two flags.
 */
async function guard() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isCreatorSpace(clan)) return { error: NextResponse.json({ error: 'Not a creator space' }, { status: 404 }) };
  return { clan };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const configured = twitchConfigured();
  return NextResponse.json({
    configured,
    channel: configured ? await hostTwitchChannel(g.clan.id) : null,
    // The client appends &return=<its own path>.
    connectUrl: configured ? `/api/auth/twitch/start?as=host&space=${g.clan.id}` : null,
  });
}

export async function DELETE() {
  const g = await guard();
  if ('error' in g) return g.error;
  const actor = await verifyUser();
  await disconnectHostTwitch(g.clan.id);
  await db
    .insert(clanAuditLog)
    .values({ clanId: g.clan.id, eventType: 'creator_twitch_disconnected', actorUserId: actor?.userId ?? null })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
