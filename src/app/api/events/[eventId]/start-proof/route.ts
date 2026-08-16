import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, players, clanMembers, eventStartProofs } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdmin, verifyUser, verifyPluginToken } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { isManagedMediaUrl } from '@/lib/storage';
import { parseEventRules } from '@/lib/eventRules';
import {
  autoAcceptDecision,
  keywordMatches,
  startKeyword,
  startProofState,
  type StartProofSource,
} from '@/lib/startProof';

// THE STARTING SHOT upload (lib/startProof). One row per (event, player): the screenshot that says
// "I was standing at the drawn location, after the event went live". Both clients land here —
// the plugin button (authenticated by its token, keyword baked into the banner it just captured)
// and the site's upload card (desktop or phone, keyword retyped by hand).
//
// The image itself has already been through /api/upload, so all we take is its managed-media URL.

/** GET — what this player still owes, for the member card. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!Number.isInteger(eId)) return NextResponse.json({ error: 'Bad event id' }, { status: 400 });

  const resolved = await resolveCaller(request, eId, null);
  if ('error' in resolved) return resolved.error;
  const { event, player } = resolved;

  const proof = await db.query.eventStartProofs.findFirst({
    where: and(eq(eventStartProofs.eventId, eId), eq(eventStartProofs.playerId, player.id)),
  });

  return NextResponse.json(
    startProofState({
      cfg: parseEventRules(event.rules).startProof,
      event,
      playerId: player.id,
      proof,
    }),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // Same shape of write as an image upload — one per player, but retries are cheap to spam.
  const rl = await rateLimit(request, 'start-proof', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!Number.isInteger(eId)) return NextResponse.json({ error: 'Bad event id' }, { status: 400 });

  // A finished event is read-only like everywhere else — a starting shot filed after the fact
  // proves nothing anyway.
  const locked = await assertEventEditable(eId);
  if (locked) return locked;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const { imageUrl, keyword, capturedAt, playerId: bodyPlayerId } = body as {
    imageUrl?: unknown; keyword?: unknown; capturedAt?: unknown; playerId?: unknown;
  };

  const resolved = await resolveCaller(request, eId, typeof bodyPlayerId === 'number' ? bodyPlayerId : null);
  if ('error' in resolved) return resolved.error;
  const { event, player, source } = resolved;

  const cfg = parseEventRules(event.rules).startProof;
  if (!cfg) {
    return NextResponse.json({ error: "This event doesn't ask for a starting shot." }, { status: 400 });
  }
  // No draw yet = the event isn't live, so there's no location to be at and no keyword to show.
  if (!event.startProofDrawnAt) {
    return NextResponse.json(
      { error: "The event hasn't started yet — your starting shot is taken once it goes live." },
      { status: 409 },
    );
  }

  if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
  }
  if (!isManagedMediaUrl(imageUrl.trim())) {
    return NextResponse.json(
      { error: 'imageUrl must be an uploaded proof URL — upload via /api/upload first' },
      { status: 400 },
    );
  }
  if (keyword != null && (typeof keyword !== 'string' || keyword.length > 64)) {
    return NextResponse.json({ error: 'keyword must be a string' }, { status: 400 });
  }
  if (capturedAt != null && (typeof capturedAt !== 'string' || capturedAt.length > 40)) {
    return NextResponse.json({ error: 'capturedAt must be an ISO timestamp' }, { status: 400 });
  }

  // An accepted shot is settled — re-uploading over it would let a player swap the evidence after
  // it passed review. Staff clear it from the admin panel if there's a genuine reason to re-take.
  const existing = await db.query.eventStartProofs.findFirst({
    where: and(eq(eventStartProofs.eventId, eId), eq(eventStartProofs.playerId, player.id)),
  });
  if (existing?.status === 'accepted') {
    return NextResponse.json(
      { error: 'Your starting shot is already accepted. Ask staff if you need to replace it.' },
      { status: 409 },
    );
  }

  const expected = startKeyword(eId, player.id, event.startProofDrawnAt);
  const keywordOk = keywordMatches(typeof keyword === 'string' ? keyword : null, expected);
  const status = autoAcceptDecision(cfg, source, keywordOk);

  const row = {
    eventId: eId,
    playerId: player.id,
    teamId: player.teamId,
    rsn: player.name,
    imageUrl: imageUrl.trim(),
    source,
    keyword: typeof keyword === 'string' ? keyword.slice(0, 64) : null,
    keywordOk,
    capturedAt: typeof capturedAt === 'string' ? capturedAt : null,
    status,
    // A re-upload clears the previous verdict — the note and reviewer belonged to the old image.
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
  };

  if (existing) {
    await db.update(eventStartProofs).set(row).where(eq(eventStartProofs.id, existing.id));
  } else {
    await db.insert(eventStartProofs).values(row);
  }

  return NextResponse.json({ ok: true, status, keywordOk });
}

/**
 * Who is filing this shot, and for which enrolment.
 *
 * Three doors: the plugin token (already scoped to one player row), a logged-in member (their own
 * enrolment in this event — `playerId` disambiguates a multi-account entry), and an admin filing on
 * someone's behalf (must name the playerId). Everything else is a 401.
 */
async function resolveCaller(
  request: Request,
  eventId: number,
  requestedPlayerId: number | null,
): Promise<
  | { event: typeof events.$inferSelect; player: { id: number; teamId: number | null; name: string }; source: StartProofSource }
  | { error: NextResponse }
> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };

  const pluginAuth = await verifyPluginToken(request);
  if (pluginAuth && pluginAuth.eventId === eventId) {
    const row = await db.query.players.findFirst({ where: eq(players.id, pluginAuth.playerId) });
    if (!row) return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
    return { event, player: { id: row.id, teamId: row.teamId, name: row.name }, source: 'plugin' };
  }

  const user = await verifyUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  // Admin filing on behalf: they name the enrolment, we don't guess.
  if (requestedPlayerId != null) {
    const admin = await verifyAdmin();
    const row = await db.query.players.findFirst({
      where: and(eq(players.id, requestedPlayerId), eq(players.eventId, eventId)),
    });
    if (!row) return { error: NextResponse.json({ error: 'Player not found on this event' }, { status: 404 }) };
    if (!admin) {
      // Not staff — the named enrolment still has to be one of theirs.
      const mine = await myPlayerRows(user.userId, eventId);
      if (!mine.some((p) => p.id === row.id)) {
        return { error: NextResponse.json({ error: 'Not your enrolment' }, { status: 403 }) };
      }
    }
    return { event, player: { id: row.id, teamId: row.teamId, name: row.name }, source: 'web' };
  }

  const mine = await myPlayerRows(user.userId, eventId);
  if (mine.length === 0) {
    return { error: NextResponse.json({ error: "You're not enrolled in this event" }, { status: 403 }) };
  }
  if (mine.length > 1) {
    return {
      error: NextResponse.json(
        { error: 'You entered more than one account — say which with playerId.', playerIds: mine.map((p) => p.id) },
        { status: 400 },
      ),
    };
  }
  return { event, player: mine[0], source: 'web' };
}

/** This user's enrolments in one event, across every roster identity they own. */
async function myPlayerRows(userId: number, eventId: number) {
  const members = await db
    .select({ id: clanMembers.id })
    .from(clanMembers)
    .where(eq(clanMembers.userId, userId));
  if (members.length === 0) return [];
  return db
    .select({ id: players.id, teamId: players.teamId, name: players.name })
    .from(players)
    .where(and(eq(players.eventId, eventId), inArray(players.clanMemberId, members.map((m) => m.id))));
}
