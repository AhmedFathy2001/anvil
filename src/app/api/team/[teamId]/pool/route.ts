import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { draftShortlists, teams } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { buildWarRoom } from '@/lib/warRoom';

/**
 * The captain's war room, as one payload: the pool, what's known about everyone in it, and the
 * captain's own shortlist.
 *
 * Captain-gated on the team in the URL. The applicants endpoint next door is deliberately narrower
 * (sign-ups only, no ratings); this one is the scouting surface, and it stays clear of anything
 * fee-related, which is admin/treasurer business.
 */

async function captainOf(teamId: number, userId: number) {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  if (team.captainUserId !== userId) {
    return { error: NextResponse.json({ error: 'Captains only' }, { status: 403 }) };
  }
  return { team };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const found = await captainOf(tId, session.userId);
  if ('error' in found) return found.error;

  const warRoom = await buildWarRoom({
    clanId: clan.id,
    eventId: found.team.eventId,
    teamId: tId,
    userId: session.userId,
  });
  if (!warRoom) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json(warRoom);
}

/**
 * Replace the shortlist wholesale: the client owns the order, so it sends the list it wants rather
 * than a diff. Positions are re-densed here, which makes reordering, adding and removing the same
 * write and leaves no gaps for a later insert to trip over.
 *
 * Body: { personKeys: string[], notes?: Record<string, string> }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const found = await captainOf(tId, session.userId);
  if ('error' in found) return found.error;

  let body: { personKeys?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const personKeys = Array.isArray(body.personKeys)
    ? [...new Set(body.personKeys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 64))]
    : null;
  if (!personKeys) return NextResponse.json({ error: 'personKeys must be an array' }, { status: 400 });
  // A shortlist longer than the pool is a bug or a bot; cap it rather than write it.
  if (personKeys.length > 200) {
    return NextResponse.json({ error: 'Shortlist is too long' }, { status: 400 });
  }

  const notes: Record<string, string> = {};
  if (body.notes && typeof body.notes === 'object') {
    for (const [key, value] of Object.entries(body.notes as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) notes[key] = value.trim().slice(0, 500);
    }
  }

  const eventId = found.team.eventId;
  const scope = and(eq(draftShortlists.eventId, eventId), eq(draftShortlists.userId, session.userId));

  // Drop what's no longer on the list, then upsert the rest at its new position. Two statements
  // instead of delete-all-and-reinsert so a note written months ago survives a reorder.
  if (personKeys.length === 0) {
    await db.delete(draftShortlists).where(scope);
    return NextResponse.json({ ok: true, count: 0 });
  }

  await db.delete(draftShortlists).where(
    and(scope, sql`${draftShortlists.personKey} NOT IN (${sql.join(personKeys.map((k) => sql`${k}`), sql`, `)})`),
  );

  const existing = await db
    .select({ personKey: draftShortlists.personKey })
    .from(draftShortlists)
    .where(and(scope, inArray(draftShortlists.personKey, personKeys)));
  const known = new Set(existing.map((e) => e.personKey));

  const now = new Date().toISOString();
  for (const [index, personKey] of personKeys.entries()) {
    if (known.has(personKey)) {
      await db
        .update(draftShortlists)
        .set({
          position: index,
          // An absent note means "unchanged"; an empty one means "cleared".
          ...(personKey in notes ? { note: notes[personKey] } : {}),
          updatedAt: now,
        })
        .where(and(scope, eq(draftShortlists.personKey, personKey)));
    } else {
      await db.insert(draftShortlists).values({
        eventId,
        userId: session.userId,
        personKey,
        position: index,
        note: notes[personKey] ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ ok: true, count: personKeys.length });
}
