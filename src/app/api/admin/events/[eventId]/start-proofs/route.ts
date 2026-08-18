import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, eventParticipants, teams, eventStartProofs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { parseEventRules } from '@/lib/eventRules';
import { startKeyword, drawStartLocation } from '@/lib/startProof';

// The starting-shot review panel's payload: every enrolled player, with their shot if they've filed
// one. Driven off the ROSTER rather than the proofs table, because the interesting question at the
// start of an event is who hasn't uploaded yet — a list of what arrived can't answer that.

/**
 * Re-draw the location. The draw happens once, automatically, at the start moment — but a drawn spot
 * can turn out to be unusable (instanced, blocked, a members-only step on a free-to-play night), and
 * without this the whole clan is stuck standing somewhere they can't reach.
 *
 * Only while NOBODY has filed yet: past that, moving the goalposts would invalidate honest shots.
 * Re-drawing re-stamps the draw time, which rotates every player's keyword too — that's deliberate,
 * since the old keywords were published to whoever already read the announcement.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdminOrModerator())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  if ((body as { action?: unknown } | null)?.action !== 'redraw') {
    return NextResponse.json({ error: "action must be 'redraw'" }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const cfg = parseEventRules(event.rules).startProof;
  if (!cfg) {
    return NextResponse.json({ error: "This event doesn't ask for a starting shot." }, { status: 400 });
  }
  if (!event.startProofDrawnAt) {
    return NextResponse.json({ error: 'Nothing has been drawn yet — the event starts the draw.' }, { status: 409 });
  }

  const filed = await db
    .select({ id: eventStartProofs.id })
    .from(eventStartProofs)
    .where(eq(eventStartProofs.eventId, id))
    .limit(1);
  if (filed.length > 0) {
    return NextResponse.json(
      { error: 'Someone has already filed a shot — clear the filed shots first if you really need a new location.' },
      { status: 409 },
    );
  }

  const location = drawStartLocation(cfg.locations);
  const drawnAt = new Date().toISOString();
  await db.update(events).set({ startProofLocation: location, startProofDrawnAt: drawnAt }).where(eq(events.id, id));
  return NextResponse.json({ ok: true, location, drawnAt });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdminOrModerator())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const cfg = parseEventRules(event.rules).startProof;

  const roster = await db
    .select({
      playerId: eventParticipants.id,
      rsn: eventParticipants.name,
      teamId: eventParticipants.teamId,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(eventParticipants)
    .leftJoin(teams, eq(eventParticipants.teamId, teams.id))
    .where(eq(eventParticipants.eventId, id));

  const proofs = await db.select().from(eventStartProofs).where(eq(eventStartProofs.eventId, id));
  const byPlayer = new Map(proofs.map((p) => [p.playerId, p]));

  const rows = roster.map((r) => {
    const proof = byPlayer.get(r.playerId);
    return {
      ...r,
      // Staff see the expected keyword so they can check a hand-typed one against the screenshot
      // without squinting at a hash. It only exists after the draw.
      expectedKeyword: event.startProofDrawnAt ? startKeyword(id, r.playerId, event.startProofDrawnAt) : null,
      proof: proof
        ? {
            id: proof.id,
            imageUrl: proof.imageUrl,
            source: proof.source,
            keyword: proof.keyword,
            keywordOk: proof.keywordOk,
            capturedAt: proof.capturedAt,
            status: proof.status,
            reviewNote: proof.reviewNote,
            createdAt: proof.createdAt,
          }
        : null,
    };
  });

  const counts = {
    total: rows.length,
    accepted: rows.filter((r) => r.proof?.status === 'accepted').length,
    pending: rows.filter((r) => r.proof?.status === 'pending').length,
    rejected: rows.filter((r) => r.proof?.status === 'rejected').length,
    missing: rows.filter((r) => !r.proof).length,
  };

  return NextResponse.json({
    required: cfg != null,
    onMissing: cfg?.onMissing ?? null,
    location: event.startProofDrawnAt ? event.startProofLocation : null,
    drawnAt: event.startProofDrawnAt,
    counts,
    rows,
  });
}
