import { NextResponse } from 'next/server';
import { PlanLimitError } from '@/lib/creatorPlansDb';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import {
  autoEnrollActivePluginMembers,
  listEligiblePluginMembers,
  type EnrollPlacement, withinAccountCap } from '@/lib/enroll';
import { assertEventEditable } from '@/lib/eventLock';

const PLACEMENTS: EnrollPlacement[] = ['one_team', 'draft_pool', 'individual'];

// GET — preview: how many plugin-active members are eligible, and how many aren't enrolled yet.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
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
  const [eligible, ev] = await Promise.all([
    listEligiblePluginMembers(id).then((list) => withinAccountCap(id, list)),
    db.query.events.findFirst({ where: eq(events.id, id), columns: { autoEnroll: true } }),
  ]);
  return NextResponse.json({
    eligible: eligible.length,
    notEnrolled: eligible.filter((m) => m.enrolledPlayerId == null).length,
    keep: ev?.autoEnroll ?? null,
  });
}

// POST — enroll every plugin-active member. Body: { placement: 'one_team'|'draft_pool'|'individual' }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(id);
  if (lockedResponse) return lockedResponse;
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { placement?: string; keep?: boolean } | null;
  // "Keep adding new plugin members" (lib/enroll autoEnrollTick): just the switch, or with a run.
  if (body?.keep === false) {
    await db.update(events).set({ autoEnroll: null }).where(eq(events.id, id));
    if (!body.placement) return NextResponse.json({ keep: null });
  }
  const placement = body?.placement as EnrollPlacement | undefined;
  if (!placement || !PLACEMENTS.includes(placement)) {
    return NextResponse.json(
      { error: `placement must be one of: ${PLACEMENTS.join(', ')}` },
      { status: 400 },
    );
  }

  // The team set is frozen once the draft starts, so placements that create teams (one_team /
  // individual) are blocked mid/post-draft. Pool placement only needs the snake flow to be idle.
  if (event.draftStatus === 'active' || event.draftStatus === 'paused') {
    return NextResponse.json(
      { error: 'Auto-enroll is unavailable while the draft is running. Reset the draft first.' },
      { status: 409 },
    );
  }
  if ((placement === 'one_team' || placement === 'individual') && event.draftStatus !== 'none') {
    return NextResponse.json(
      { error: 'Teams are locked once the draft starts. Reset the draft, or use the draft-pool placement.' },
      { status: 409 },
    );
  }

  // 'individual' honors the event's slot mode: per-person groups a person's alts onto one team.
  const slotMode = event.accountSlotMode === 'per-account' ? 'per-account' : 'per-person';
  try {
    const result = await autoEnrollActivePluginMembers(id, placement, slotMode);
    if (body?.keep === true) await db.update(events).set({ autoEnroll: placement }).where(eq(events.id, id));
    return NextResponse.json({ ...result, keep: body?.keep === true ? placement : body?.keep === false ? null : event.autoEnroll });
  } catch (e) {
    // The plan's cap on players at once across the host's overlapping events (lib/creatorPlansDb).
    if (e instanceof PlanLimitError) return NextResponse.json({ error: e.message, reason: 'full' }, { status: 403 });
    throw e;
  }
}
