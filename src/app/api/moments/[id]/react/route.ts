import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events, moments } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { toggleReaction } from '@/lib/momentReactions';
import { rateLimit } from '@/lib/rate-limit';
import { type ReactTarget, checkReaction } from '@/lib/reactionAccess';
import { siteReactions } from '@/lib/siteReactions';

/**
 * POST /api/moments/:id/react { kind, clanId } | { kind, eventId }
 *
 * Give (or take back) a reaction from the site's moment feeds. The feed it was pressed in decides
 * who may: the same rule as the plugin panel's Feed (lib/reactionAccess checkReaction). Answers with
 * the row's chips as they now stand, so the page can settle its optimistic flip and the who line.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in to react.' }, { status: 401 });
  const momentId = Number((await params).id);
  const body = await request.json().catch(() => null);
  const clanId = Number(body?.clanId);
  const eventId = Number(body?.eventId);
  const target: ReactTarget | null =
    Number.isInteger(eventId) && eventId > 0 ? { eventId } : Number.isInteger(clanId) && clanId > 0 ? { clanId } : null;
  if (!target || !Number.isInteger(momentId) || momentId <= 0) return NextResponse.json({ error: 'Couldn’t react to that.' }, { status: 400 });

  const rl = await rateLimit(request, `site-react:${session.userId}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a little — try again in a minute.' }, { status: 429 });

  const verdict = await checkReaction(session.userId, target, momentId, body?.kind);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  const on = await toggleReaction(momentId, session.userId, verdict.kind);

  // clan-scope: global -- the moment checkReaction just placed in this feed.
  const [m] = await db.select({ kind: moments.kind }).from(moments).where(eq(moments.id, momentId)).limit(1);
  let hostClanId = 0;
  if ('eventId' in target) {
    // clan-scope: global -- the board checkReaction just admitted the viewer to.
    const [ev] = await db.select({ clanId: events.clanId }).from(events).where(eq(events.id, target.eventId)).limit(1);
    hostClanId = ev?.clanId ?? 0;
  }
  const scope = 'eventId' in target ? { eventId: target.eventId, hostClanId } : target;
  const now = await siteReactions([{ id: momentId, kind: m?.kind ?? '' }], scope, session.userId);
  return NextResponse.json({ ok: true, on, chips: now.byMoment[momentId] ?? [] });
}
