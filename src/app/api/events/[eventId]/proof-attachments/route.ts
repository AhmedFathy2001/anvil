// Extra screenshots and links on a proof (lib/proofAttachments), from the web.
//
//   GET    ?tileId=&teamId=        your saved start screenshot(s) on that tile — drafts, yours alone
//   POST   { tileId, teamId, items, submissionId? }
//            no submissionId → save a draft: it moves onto the next proof you send for that tile
//            submissionId    → add to a proof already sent (the end shot you came back for)
//   DELETE ?id=                   remove one extra
//
// Who: a draft is the caller's own, so only someone on the team keeps one. Adding to a sent proof is
// for whoever sent it or is credited by it, the team's captain, and clan staff. Removing: whoever
// added it, the captain, staff.

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { submissionAttachments, submissions, tiles } from '@/db/schema';
import { resolveTeamMembership, verifyAdminOrModerator, verifyUser } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { assertEventEditable } from '@/lib/eventLock';
import { MAX_ATTACHMENTS, parseAttachments } from '@/lib/proofAttachments';
import { addAttachments, attachmentCount, draftsFor, ownsAttachmentImages } from '@/lib/proofAttachmentsDb';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { claimUploads } from '@/lib/uploadClaims';
import { isManagedMediaUrl } from '@/lib/storage';

type Ctx = { params: Promise<{ eventId: string }> };

const int = (v: unknown) => (typeof v === 'number' ? v : parseInt(String(v ?? ''), 10));

/** The tile, if it is on this event. */
async function eventTile(eventId: number, tileId: number) {
  if (!Number.isInteger(tileId) || tileId < 1) return null;
  return db.query.tiles.findFirst({ where: and(eq(tiles.id, tileId), eq(tiles.eventId, eventId)) });
}

export async function GET(request: Request, { params }: Ctx) {
  const eId = parseInt((await params).eventId, 10);
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const tileId = int(searchParams.get('tileId'));
  const teamId = int(searchParams.get('teamId'));
  const user = await verifyUser();
  if (!user || !Number.isInteger(teamId) || !(await eventTile(eId, tileId))) return NextResponse.json({ drafts: [] });
  return NextResponse.json({ drafts: await draftsFor(tileId, teamId, user.userId) });
}

export async function POST(request: Request, { params }: Ctx) {
  const rl = await rateLimit(request, 'proof-attachments', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const eId = parseInt((await params).eventId, 10);
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const locked = await assertEventEditable(eId);
  if (locked) return locked;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const parsed = parseAttachments(body.items, isManagedMediaUrl);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.items.length === 0) return NextResponse.json({ error: 'Nothing to add' }, { status: 400 });

  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Log in to add proof' }, { status: 401 });
  const isStaff = !!(await verifyAdminOrModerator());
  if (!(await ownsAttachmentImages(parsed.items, user.userId))) {
    return NextResponse.json({ error: 'Upload screenshots here yourself before attaching them' }, { status: 400 });
  }
  if (!(await claimUploads(parsed.items.filter((a) => a.kind === 'image').map((a) => a.url), eId))) {
    return NextResponse.json({ error: 'That screenshot is already on another event’s proof' }, { status: 409 });
  }

  if (body.submissionId != null) {
    const sub = await db.query.submissions.findFirst({ where: eq(submissions.id, int(body.submissionId)) });
    const tile = sub ? await eventTile(eId, sub.tileId) : null;
    if (!sub || !tile) return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
    if (!isStaff) {
      const m = await resolveTeamMembership(eId, sub.teamId);
      const own = !!m && (m.isCaptain || (m.playerId != null && (m.playerId === sub.playerId || m.playerId === sub.creditPlayerId)));
      if (!own) return NextResponse.json({ error: 'Only whoever sent this proof, their captain or staff can add to it' }, { status: 403 });
    }
    if ((await attachmentCount({ submissionId: sub.id })) + parsed.items.length > MAX_ATTACHMENTS) {
      return NextResponse.json({ error: `A proof holds at most ${MAX_ATTACHMENTS} extras` }, { status: 400 });
    }
    const added = await addAttachments({ submissionId: sub.id, tileId: sub.tileId, teamId: sub.teamId, userId: user.userId }, parsed.items);
    return NextResponse.json({ added }, { status: 201 });
  }

  const tileId = int(body.tileId);
  const teamId = int(body.teamId);
  if (!(await eventTile(eId, tileId)) || !Number.isInteger(teamId)) return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  // A draft is yours, for your team: being staff doesn't put you on a team.
  if (!(await resolveTeamMembership(eId, teamId))) return NextResponse.json({ error: 'You are not on this team' }, { status: 403 });
  if ((await attachmentCount({ tileId, teamId, userId: user.userId })) + parsed.items.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `At most ${MAX_ATTACHMENTS} saved screenshots per tile` }, { status: 400 });
  }
  const added = await addAttachments({ submissionId: null, tileId, teamId, userId: user.userId }, parsed.items);
  return NextResponse.json({ added }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const eId = parseInt((await params).eventId, 10);
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const locked = await assertEventEditable(eId);
  if (locked) return locked;
  const id = int(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // clan-scope: global -- one row by id; its tile is checked against this event just below.
  const row = await db.query.submissionAttachments.findFirst({ where: eq(submissionAttachments.id, id) });
  if (!row || !(await eventTile(eId, row.tileId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const allowed =
    row.userId === user.userId ||
    !!(await verifyAdminOrModerator()) ||
    !!(await resolveTeamMembership(eId, row.teamId))?.isCaptain;
  if (!allowed) return NextResponse.json({ error: 'Not yours to remove' }, { status: 403 });
  await db.delete(submissionAttachments).where(eq(submissionAttachments.id, id));
  return NextResponse.json({ ok: true });
}
