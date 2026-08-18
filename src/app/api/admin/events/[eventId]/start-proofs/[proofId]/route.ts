import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventStartProofs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { del } from '@/lib/storage';

// Review one starting shot: accept it, reject it (the player is asked to re-take), or clear it
// entirely so they start over. Rejecting keeps the image — the whole point of a rejection is that
// someone may want to look at it again — while clearing deletes it.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; proofId: string }> },
) {
  const staff = await verifyAdminOrModerator();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId, proofId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const pId = parseInt(proofId, 10);
  if (!Number.isFinite(eId) || !Number.isFinite(pId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = (body as { status?: unknown } | null)?.status;
  const note = (body as { note?: unknown } | null)?.note;
  if (status !== 'accepted' && status !== 'rejected' && status !== 'pending') {
    return NextResponse.json({ error: "status must be 'accepted', 'rejected' or 'pending'" }, { status: 400 });
  }
  if (note != null && (typeof note !== 'string' || note.length > 500)) {
    return NextResponse.json({ error: 'note must be a string of at most 500 characters' }, { status: 400 });
  }

  const updated = await db
    .update(eventStartProofs)
    .set({
      status,
      reviewNote: typeof note === 'string' && note.trim() ? note.trim() : null,
      reviewedBy: staff.userId,
      reviewedAt: new Date().toISOString(),
    })
    .where(and(eq(eventStartProofs.id, pId), eq(eventStartProofs.eventId, eId)))
    .returning({ id: eventStartProofs.id, status: eventStartProofs.status });

  if (updated.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, ...updated[0] });
}

/** Clear a shot so the player uploads a fresh one. Removes the stored image too. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; proofId: string }> },
) {
  if (!(await verifyAdminOrModerator())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId, proofId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const pId = parseInt(proofId, 10);
  if (!Number.isFinite(eId) || !Number.isFinite(pId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const removed = await db
    .delete(eventStartProofs)
    .where(and(eq(eventStartProofs.id, pId), eq(eventStartProofs.eventId, eId)))
    .returning({ imageUrl: eventStartProofs.imageUrl });

  if (removed.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Best-effort: a stranded object costs pennies, a failed delete shouldn't fail the action.
  await del(removed[0].imageUrl).catch(() => {});
  return NextResponse.json({ ok: true });
}
