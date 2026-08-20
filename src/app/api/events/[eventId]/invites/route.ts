import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, eventInvites, events, players } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { isEntry, isVisibility } from '@/lib/eventAccess';

/**
 * Inviting another clan — or one person — to an event, and setting who may see it.
 *
 * Admin of the HOSTING clan only. eventForRequest is what ties the event to the clan whose site this
 * is; without it an admin of one clan could invite people to another clan's event, since event ids
 * are global.
 */

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await db
    .select({
      id: eventInvites.id,
      clanId: eventInvites.clanId,
      playerId: eventInvites.playerId,
      note: eventInvites.note,
      invitedAt: eventInvites.invitedAt,
      clanName: clans.name,
      clanSlug: clans.slug,
      playerName: players.displayName,
    })
    .from(eventInvites)
    .leftJoin(clans, eq(clans.id, eventInvites.clanId))
    .leftJoin(players, eq(players.id, eventInvites.playerId))
    .where(eq(eventInvites.eventId, eventId));

  return NextResponse.json({
    visibility: event.visibility,
    entry: event.entry,
    invites: rows,
  });
}

/** Change visibility/entry, or add an invite. */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  // ── Settings ──────────────────────────────────────────────────────────────────────────────
  if ('visibility' in body || 'entry' in body) {
    const patch: Partial<typeof events.$inferInsert> = {};
    if ('visibility' in body) {
      if (!isVisibility(body.visibility)) return NextResponse.json({ error: 'Bad visibility' }, { status: 400 });
      patch.visibility = body.visibility;
    }
    if ('entry' in body) {
      if (!isEntry(body.entry)) return NextResponse.json({ error: 'Bad entry' }, { status: 400 });
      patch.entry = body.entry;
    }
    await db.update(events).set(patch).where(eq(events.id, eventId));
    return NextResponse.json({ ok: true, ...patch });
  }

  // ── An invitation ─────────────────────────────────────────────────────────────────────────
  const clanSlug = typeof body.clanSlug === 'string' ? body.clanSlug.trim().toLowerCase() : null;
  const playerId = Number.isInteger(body.playerId) ? Number(body.playerId) : null;

  if ((clanSlug && playerId) || (!clanSlug && !playerId)) {
    return NextResponse.json({ error: 'Invite a clan or a person, not both' }, { status: 400 });
  }

  let inviteClanId: number | null = null;
  if (clanSlug) {
    const target = await db.query.clans.findFirst({ where: eq(clans.slug, clanSlug) });
    if (!target) return NextResponse.json({ error: 'No clan with that address' }, { status: 404 });
    if (target.id === event.clanId) {
      return NextResponse.json({ error: 'That is the clan hosting this event' }, { status: 400 });
    }
    inviteClanId = target.id;
  }

  try {
    const [row] = await db
      .insert(eventInvites)
      .values({
        eventId,
        clanId: inviteClanId,
        playerId,
        invitedByUserId: session.userId,
        note: typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null,
      })
      .returning();
    return NextResponse.json({ ok: true, invite: row });
  } catch (e) {
    // The unique indexes are the arbiter — inviting the same clan twice is a no-op worth saying
    // plainly rather than a server error.
    if ((e as { cause?: { code?: string } }).cause?.code === '23505') {
      return NextResponse.json({ error: 'Already invited' }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  // Scoped to this event as well as the id: invite ids are global, and this route already knows
  // which event the caller is allowed to touch.
  const [gone] = await db
    .delete(eventInvites)
    .where(and(eq(eventInvites.id, id), eq(eventInvites.eventId, eventId)))
    .returning();

  if (!gone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Deliberately does NOT remove anyone who already entered. They were invited, they accepted, and
  // they are a guest of the clan now — withdrawing the invitation is not the same as removing a
  // person, which is a roster decision with its own path.
  return NextResponse.json({ ok: true });
}
