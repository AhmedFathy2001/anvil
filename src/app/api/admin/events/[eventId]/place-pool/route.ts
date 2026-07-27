import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { placeUnassignedPlayers } from '@/lib/enroll';
import { assertEventEditable } from '@/lib/eventLock';

// POST — team up everyone currently sitting unassigned in the event's pool, per a non-draft
// format. Body: { placement: 'one_team' | 'individual' }. This is the Teams tab's "skip manual
// team setup" action: sign-up players, manually-added guests and auto-enrolled members all get
// their team in one click, no draft needed.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(id);
  if (lockedResponse) return lockedResponse;

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  // The team set is frozen once a snake draft is underway/complete — mirror the auto-enroll guard.
  if (event.draftStatus !== 'none') {
    return NextResponse.json(
      { error: 'Teams are locked once the draft starts. Reset the draft first.' },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as { placement?: string } | null;
  if (body?.placement !== 'one_team' && body?.placement !== 'individual') {
    return NextResponse.json({ error: "placement must be 'one_team' or 'individual'" }, { status: 400 });
  }

  const result = await placeUnassignedPlayers(id, body.placement);
  return NextResponse.json(result);
}
