import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { isAcceptedCohost } from '@/lib/coHost';
import { eventInClan } from '@/lib/eventScope';
import { postEventRules } from '@/lib/eventRulesPost';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Post the board's rules to Discord.
 *
 * Two callers, two reaches:
 *   HOST staff (the event is this clan's) — every clan on the board by default, or the `clanIds`
 *   subset they pick.
 *   CO-HOST staff (this clan holds an accepted co-host seat) — their OWN server only. Posting into
 *   the host's server, or a third clan's, is the host's call.
 */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();

  const body = (await request.json().catch(() => ({}))) as { clanIds?: unknown };
  const asked = Array.isArray(body.clanIds) ? body.clanIds.filter((n): n is number => Number.isInteger(n)) : undefined;

  const own = await eventInClan(clan.id, id);
  if (own) {
    const results = await postEventRules(own.id, own.clanId, asked ? { clanIds: asked } : {});
    return NextResponse.json({ results });
  }

  if (await isAcceptedCohost(id, clan.id)) {
    if (asked && asked.some((cid) => cid !== clan.id)) {
      return NextResponse.json({ error: 'A co-host can only post to its own server' }, { status: 403 });
    }
    // clan-scope: global -- the host is read off the event this clan holds an accepted co-host seat on.
    const row = await db.query.events.findFirst({ where: eq(events.id, id), columns: { clanId: true } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const results = await postEventRules(id, row.clanId, { clanIds: [clan.id] });
    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
