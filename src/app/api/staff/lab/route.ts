import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, events } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { createLabSession, labClanId, MAX_LAB_HOURS } from '@/lib/lab';
import { personOf } from '@/lib/roster';

// /api/staff/lab — tile-lab sessions (lib/lab). GET lists them with the caller's own characters
// (the only ones a session may use); POST starts one.

/** The caller's own characters. A session quarantines its characters' real pushes, so it may only
 *  ever hold the staffer's own — never a member's. */
async function ownCharacters(userId: number) {
  const person = await personOf(userId);
  if (person == null) return [];
  return db
    .select({ id: accounts.id, rsn: accounts.rsn })
    .from(accounts)
    .where(and(eq(accounts.playerId, person), ne(accounts.status, 'ignored')));
}

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const labId = await labClanId();
  const sessions = labId == null
    ? []
    : await db
        .select({
          id: events.id,
          name: events.name,
          startDate: events.startDate,
          endDate: events.endDate,
          forceEndedAt: events.forceEndedAt,
        })
        .from(events)
        .where(eq(events.clanId, labId))
        .orderBy(desc(events.id))
        .limit(50);
  const people = sessions.length
    ? await db
        .select({ eventId: eventParticipants.eventId, name: eventParticipants.name })
        .from(eventParticipants)
        .where(inArray(eventParticipants.eventId, sessions.map((s) => s.id)))
    : [];
  return NextResponse.json({
    sessions: sessions.map((s) => ({ ...s, characters: people.filter((p) => p.eventId === s.id).map((p) => p.name) })),
    characters: await ownCharacters(gate.actor.user.userId),
    maxHours: MAX_LAB_HOURS,
  });
}

export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  let body: { name?: unknown; hours?: unknown; boardSize?: unknown; accountIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const wanted = Array.isArray(body.accountIds) ? body.accountIds.filter((n): n is number => Number.isInteger(n)) : [];
  const mine = await ownCharacters(gate.actor.user.userId);
  const picked = mine.filter((c) => wanted.includes(c.id));
  if (picked.length === 0) {
    return NextResponse.json({ error: 'Pick at least one of your own characters.' }, { status: 400 });
  }
  const eventId = await createLabSession(gate.actor.user.userId, {
    name: typeof body.name === 'string' ? body.name.slice(0, 80) : 'Lab session',
    hours: typeof body.hours === 'number' && Number.isFinite(body.hours) ? body.hours : 2,
    boardSize: typeof body.boardSize === 'number' ? body.boardSize : 3,
    accounts: picked.map((c) => ({ accountId: c.id, name: c.rsn })),
  });
  return NextResponse.json({ eventId }, { status: 201 });
}
