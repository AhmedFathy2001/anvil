import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { competitionForRequest } from '@/lib/eventScope';
import { addManualDrop, myHuntSeats } from '@/lib/itemHuntDb';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

// "I got it": a member asks for a drop to count on an item hunt, for one of their OWN characters,
// with a screenshot and the kill count or XP at the drop. It counts only once staff approve it
// (lib/itemHuntDb addManualDrop, decideHuntDrop).

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  if (!comp || comp.type !== 'hunt') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  // Only for a character of theirs that is entered in this hunt.
  const seats = await myHuntSeats(comp.id, user.playerId);
  const seat = seats.find((s) => s.id === num(body.participantId)) ?? (seats.length === 1 && body.participantId == null ? seats[0] : null);
  if (!seat) return NextResponse.json({ error: 'You can only ask for a character of yours that is entered in this hunt.' }, { status: 403 });

  const limit = await rateLimitByKey('hunt-proof', String(user.userId), { limit: 6, windowMs: 60 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'That is a lot of requests. Try again later.' }, { status: 429, headers: rateLimitHeaders(limit) });

  const result = await addManualDrop(
    comp,
    {
      participantId: seat.id,
      itemId: num(body.itemId),
      itemName: typeof body.itemName === 'string' ? body.itemName : '',
      source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : null,
      quantity: num(body.quantity) ?? 1,
      occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt : '',
      kc: num(body.kc),
      xp: num(body.xp),
      xpSkill: typeof body.xpSkill === 'string' ? body.xpSkill : null,
      screenshotUrl: typeof body.screenshotUrl === 'string' ? body.screenshotUrl : '',
      note: typeof body.note === 'string' ? body.note : null,
    },
    { userId: user.userId, staff: false },
  );
  return result.ok ? NextResponse.json({ ok: true, pending: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
