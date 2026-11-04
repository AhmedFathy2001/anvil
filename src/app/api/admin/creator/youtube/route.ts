import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { streamsEvents } from '@/lib/creatorSpaces';
import { youtubeConfigured } from '@/lib/gates/youtube';
import { disconnectHostYoutube, hostYoutubeChannel } from '@/lib/gates/youtubeDb';

/**
 * A creator space's connected YouTube channel — what the subscriber/member gates check against.
 * Status and disconnect here; connecting is the OAuth round trip at /api/auth/youtube/start?as=host.
 * Tokens never leave the server: this answers with the channel's title, handle and a broken flag.
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
  const configured = youtubeConfigured();
  const ch = configured ? await hostYoutubeChannel(g.clan.id) : null;
  return NextResponse.json({
    configured,
    channel: ch ? { title: ch.title, handle: ch.handle, broken: ch.broken } : null,
    // The client appends &return=<its own path>.
    connectUrl: configured ? `/api/auth/youtube/start?as=host&space=${g.clan.id}` : null,
  });
}

export async function DELETE() {
  const g = await guard();
  if ('error' in g) return g.error;
  const actor = await verifyUser();
  await disconnectHostYoutube(g.clan.id);
  await db
    .insert(clanAuditLog)
    .values({ clanId: g.clan.id, eventType: 'creator_youtube_disconnected', actorUserId: actor?.userId ?? null })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
