import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, like, notLike, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, events, users } from '@/db/schema';
import { LAB_DUMMY_LOGIN } from '@/lib/labRules';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { createLabSession, LAB_RACE_ROUTES, labClanId, labEvent, MAX_LAB_HOURS, ownLabCharacters } from '@/lib/lab';
import { addLabField, simulateLabField } from '@/lib/labField';
import { LAB_FORMATS, LAB_ROUTE_TEMPLATES, labFormat, type LabPlacement, type LabRouteTemplate } from '@/lib/labPlan';

// /api/staff/lab — tile-lab sessions (lib/lab). GET lists them with the caller's own characters
// (the only ones a session may use); POST starts one.

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
  // Your characters by name, the field only as a count: a 1000-player session must not ship 1000
  // names to a list row. Test players are told apart by the login mark only (lib/labCast).
  const ids = sessions.map((s) => s.id);
  const people = ids.length
    ? await db
        .select({ eventId: eventParticipants.eventId, name: eventParticipants.name })
        .from(eventParticipants)
        .leftJoin(accounts, eq(accounts.id, eventParticipants.accountId))
        .leftJoin(users, eq(users.playerId, accounts.playerId))
        .where(and(inArray(eventParticipants.eventId, ids), or(isNull(users.discordId), notLike(users.discordId, `${LAB_DUMMY_LOGIN}%`))))
    : [];
  const fieldCounts = ids.length
    ? await db
        .select({ eventId: eventParticipants.eventId, n: sql<number>`count(distinct ${eventParticipants.id})::int` })
        .from(eventParticipants)
        .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
        .innerJoin(users, eq(users.playerId, accounts.playerId))
        .where(and(inArray(eventParticipants.eventId, ids), like(users.discordId, `${LAB_DUMMY_LOGIN}%`)))
        .groupBy(eventParticipants.eventId)
    : [];
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      ...s,
      characters: [...new Set(people.filter((p) => p.eventId === s.id).map((p) => p.name))],
      testPlayers: fieldCounts.find((f) => f.eventId === s.id)?.n ?? 0,
    })),
    characters: await ownLabCharacters(gate.actor.user.userId),
    maxHours: MAX_LAB_HOURS,
    // Route templates only where tiles can carry a route (lib/lab LAB_RACE_ROUTES).
    raceRoutes: LAB_RACE_ROUTES,
  });
}

export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  let body: {
    name?: unknown;
    hours?: unknown;
    boardSize?: unknown;
    accountIds?: unknown;
    format?: unknown;
    placement?: unknown;
    route?: unknown;
    fieldPlayers?: unknown;
    teamSize?: unknown;
    simulate?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const wanted = Array.isArray(body.accountIds) ? body.accountIds.filter((n): n is number => Number.isInteger(n)) : [];
  const mine = await ownLabCharacters(gate.actor.user.userId);
  const picked = mine.filter((c) => wanted.includes(c.id));
  if (picked.length === 0) {
    return NextResponse.json({ error: 'Pick at least one of your own characters.' }, { status: 400 });
  }
  const format = LAB_FORMATS.some((f) => f.key === body.format) ? labFormat(body.format).key : 'classic';
  const placement: LabPlacement | undefined = body.placement === 'solo' || body.placement === 'team' ? body.placement : undefined;
  const route = LAB_ROUTE_TEMPLATES.find((t) => t.key === body.route)?.key as LabRouteTemplate | undefined;
  const actor = gate.actor.user.userId;
  const eventId = await createLabSession(actor, {
    name: typeof body.name === 'string' ? body.name.slice(0, 80) : 'Lab session',
    hours: typeof body.hours === 'number' && Number.isFinite(body.hours) ? body.hours : 2,
    boardSize: typeof body.boardSize === 'number' ? body.boardSize : labFormat(format).defaultSize,
    accounts: picked.map((c) => ({ accountId: c.id, name: c.rsn })),
    format,
    placement,
    route,
  });
  // Fill it with test players (lib/labField), and give them a head start if asked.
  const fieldPlayers = typeof body.fieldPlayers === 'number' && Number.isFinite(body.fieldPlayers) ? body.fieldPlayers : 0;
  let field = 0;
  let simulated = 0;
  if (fieldPlayers > 0) {
    field = await addLabField(actor, eventId, {
      players: fieldPlayers,
      teamSize: typeof body.teamSize === 'number' ? body.teamSize : 3,
      placement: placement ?? labFormat(format).defaultPlacement,
    });
    const event = body.simulate === true && field > 0 ? await labEvent(eventId) : null;
    if (event) simulated = await simulateLabField(event);
  }
  return NextResponse.json({ eventId, field, simulated }, { status: 201 });
}
