import { NextResponse } from 'next/server';
import { releaseWeeklyPool } from '@/lib/coffer';
import { competitionForRequest } from '@/lib/eventScope';
import { verifyAdminOrModerator, verifyFeeCollector } from '@/lib/auth';
import { db } from '@/db';
import { playerSnapshots, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWeeklyRepeat, setWeeklyRepeat } from '@/lib/weeklyRepeat';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  const comp = await competitionForRequest(request, compId).then((c) => (c ? [c] : []));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participants = await db.select().from(weeklyParticipants).where(eq(weeklyParticipants.competitionId, compId));

  const participantCount = participants.length;

  const repeat = await getWeeklyRepeat(comp[0].clanId, compId);
  return NextResponse.json({ ...comp[0], participantCount, participants, repeat });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  // WHOSE COMPETITION IS THIS? Ids are global and this one came from the URL. GET four lines up has
  // asked since the multi-clan conversion; this did not, so a moderator of any clan could rename or
  // re-date any other clan's week by guessing an id. The role check above is satisfied by being
  // staff SOMEWHERE, which is exactly the gap the scope guard closes.
  const scoped = await competitionForRequest(request, compId);
  if (!scoped) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { title, startDate, endDate, status, includeGuests, repeat } = await request.json();

  // Repeat on (with an optional rotation) or off. Off on the current week stops the series: the cron
  // only ever makes the next one from a week that still says repeat.
  if (repeat !== undefined) {
    // A repeating competition with prizes commits the clan's coffer again every week, so switching
    // that on is a treasurer's decision, the same bar setting the prizes sits behind. A moderator may
    // still repeat a prize-free competition, and anyone may switch repeat off.
    if (repeat && scoped.prizes && !(await verifyFeeCollector())) {
      return NextResponse.json(
        { error: 'This competition has prizes, so only a treasurer or admin can make it repeat — each new week holds the prize money again.' },
        { status: 403 },
      );
    }
    const rotation =
      repeat && Array.isArray(repeat.rotation)
        ? repeat.rotation.filter((m: unknown): m is string => typeof m === 'string' && m.length > 0).slice(0, 52)
        : null;
    await setWeeklyRepeat(scoped.clanId, compId, repeat ? { rotation: rotation && rotation.length > 0 ? rotation : null } : null);
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (status !== undefined) updates.status = status;
  // Reversible after creation: turning it off stops the cron re-entering guests; it does not remove
  // the ones already entered (that is "Drop all guests"). Turning it on enters them on the next tick.
  if (typeof includeGuests === 'boolean') updates.includeGuests = includeGuests ? 1 : 0;

  if (Object.keys(updates).length === 0) {
    if (repeat !== undefined) return NextResponse.json({ ok: true, repeat: await getWeeklyRepeat(scoped.clanId, compId) });
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(weeklyCompetitions).set(updates).where(eq(weeklyCompetitions.id, compId));

  const updated = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  if (updated.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  // Same guard, and it matters more here: unscoped, this deleted another clan's competition along
  // with every participant row and player snapshot hanging off it.
  if (!(await competitionForRequest(request, compId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete children explicitly — the schema declares ON DELETE CASCADE, but the live
  // tables predate the squashed migration baseline and may not carry it, which made
  // this delete fail with a foreign-key error.
  try {
    // Give the ladder's hold back before the competition goes. The coffer row's competition link is
    // ON DELETE SET NULL, so a reserved pool would outlive the thing it was holding gp for and sit
    // on the ledger forever with nothing left to release it.
    await releaseWeeklyPool(compId, user.userId > 0 ? user.userId : null);
    await db.delete(playerSnapshots).where(eq(playerSnapshots.weeklyCompetitionId, compId));
    await db.delete(weeklyParticipants).where(eq(weeklyParticipants.competitionId, compId));
    await db.delete(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  } catch (err) {
    return NextResponse.json({ error: `Delete failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
