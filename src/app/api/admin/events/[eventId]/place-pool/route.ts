import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { track } from '@/lib/analytics';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { placePoolAuto, placeUnassignedPlayers } from '@/lib/enroll';
import { placementOf } from '@/lib/teamPlacement';
import { assertEventEditable } from '@/lib/eventLock';
import { refusePractice } from '@/lib/practiceGuard';

// POST — team up everyone currently sitting unassigned in the event's pool, per a non-draft
// format. Body: { placement: 'one_team' | 'individual' }. This is the Teams tab's "skip manual
// team setup" action: sign-up players, manually-added guests and auto-enrolled members all get
// their team in one click, no draft needed.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // A practice board (lib/practice) has none of this (lib/practiceGuard).
  const practiceRefused = await refusePractice(params);
  if (practiceRefused) return practiceRefused;
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
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
  // 'as-set': the way this board's own Team placement seats a sign-up (auto-balance or one each),
  // for people who are in the pool because they entered before it placed them.
  const boardPlacement = placementOf(event);
  const placement =
    body?.placement === 'as-set' ? (boardPlacement === 'auto' ? 'auto' : boardPlacement === 'solo' ? 'individual' : null) : body?.placement;
  if (placement !== 'one_team' && placement !== 'individual' && placement !== 'auto') {
    return NextResponse.json({ error: "placement must be 'one_team', 'individual' or 'as-set' on a board that places sign-ups" }, { status: 400 });
  }

  // per-person (default) groups a person's alts onto one team; per-account gives each its own.
  const slotMode = event.accountSlotMode === 'per-account' ? 'per-account' : 'per-person';
  const result =
    placement === 'auto' ? await placePoolAuto(id, event.teamCount, slotMode) : await placeUnassignedPlayers(id, placement, slotMode);
  if (result.placed > 0) track('team.balanced', { clanId: event.clanId, props: { placed: result.placed, via: 'pool' } });
  return NextResponse.json(result);
}
