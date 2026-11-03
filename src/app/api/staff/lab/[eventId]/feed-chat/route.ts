import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { platformChatOn } from '@/lib/eventChat';
import { labEvent } from '@/lib/lab';
import { labChatOn, labDrops, labSay, labSessionCast } from '@/lib/labFeedChat';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

// /api/staff/lab/<id>/feed-chat — the session's Feed & chat bench (lib/labFeedChat). GET: who can be
// made to talk, and whether chat is on. POST {action}: 'chat' {on}, 'say' {participantId, body,
// teamOnly}, 'drops' {count}.

async function state(eventId: number) {
  // clan-scope: this clan -- a lab session, checked by labEvent before this runs
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { chatEnabled: true, chatPaused: true } });
  return {
    platformOn: await platformChatOn(true),
    chatEnabled: !!ev?.chatEnabled,
    chatPaused: !!ev?.chatPaused,
    cast: await labSessionCast(eventId),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(await state(event.id));
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; on?: unknown; participantId?: unknown; body?: unknown; teamOnly?: unknown; count?: unknown }
    | null;
  let note: string | undefined;
  switch (body?.action) {
    case 'chat':
      await labChatOn(event.id, body.on === true);
      break;
    case 'say': {
      if (!Number.isInteger(body.participantId) || typeof body.body !== 'string') {
        return NextResponse.json({ error: 'participantId and body' }, { status: 400 });
      }
      const r = await labSay(event.id, body.participantId as number, body.body, body.teamOnly === true);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      break;
    }
    case 'drops': {
      const r = await labDrops(event.id, typeof body.count === 'number' ? body.count : 10);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      note = r.note;
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ...(await state(event.id)), ...(note ? { note } : {}) });
}
