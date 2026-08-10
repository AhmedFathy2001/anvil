import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, surveyQuestions } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

// Clone an event: copy its configuration, full tile board, and survey questions into a brand-new
// event, resetting everything run-specific — no teams/players/completions/submissions/sign-ups, no
// dates, draft back to 'none', tiles hidden again, per-tile reveal state cleared. For "run last
// month's bingo again" without going through save-as-template + create-from-template.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const sourceId = parseInt(eventId, 10);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const source = await db.query.events.findFirst({ where: eq(events.id, sourceId) });
  if (!source) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const [created] = await db
    .insert(events)
    .values({
      name: `${source.name} (copy)`,
      boardSize: source.boardSize,
      scoringMode: source.scoringMode,
      format: source.format,
      // Money/sign-up configuration carries over; the WINDOW does not (all deadlines cleared below
      // with the other dates), so the clone can't accidentally open sign-ups the moment it exists.
      signupFee: source.signupFee,
      addedPrizePool: source.addedPrizePool,
      maxAccountsPerPerson: source.maxAccountsPerPerson,
      accountSlotMode: source.accountSlotMode,
      feeMode: source.feeMode,
      placementPrizes: source.placementPrizes,
      // Game rules (reveal policy, scoring modifiers) are config, not run state — per-tile reveal
      // STATE lives on the tiles and is reset in the copy below.
      rules: source.rules,
      // Everything run-specific starts fresh: no dates, draft idle, tiles hidden for private authoring.
      startDate: null,
      endDate: null,
      signupOpensAt: null,
      signupDeadline: null,
      paymentDeadline: null,
      captainSelectionDeadline: null,
      draftStatus: 'none',
      tilesRevealed: 0,
    })
    .returning({ id: events.id });

  const sourceTiles = await db
    .select()
    .from(tiles)
    .where(eq(tiles.eventId, sourceId))
    .orderBy(asc(tiles.position));
  if (sourceTiles.length > 0) {
    await db.insert(tiles).values(
      sourceTiles.map((t) => ({
        eventId: created.id,
        position: t.position,
        label: t.label,
        icon: t.icon,
        description: t.description,
        tileType: t.tileType,
        requiredAmount: t.requiredAmount,
        trackedStat: t.trackedStat,
        statType: t.statType,
        statGoal: t.statGoal,
        trackingMode: t.trackingMode,
        optional: t.optional,
        autoTrackDisabled: t.autoTrackDisabled,
        trackedItemIds: t.trackedItemIds,
        itemRequirements: t.itemRequirements,
        acceptedSources: t.acceptedSources,
        sourceNpcs: t.sourceNpcs,
        targetNpcs: t.targetNpcs,
        timedActivity: t.timedActivity,
        timeThresholdSeconds: t.timeThresholdSeconds,
        partySize: t.partySize,
        pvpMinLootValue: t.pvpMinLootValue,
        category: t.category,
        points: t.points,
        // Reveal STATE is per-run: planned times from the old run make no sense on a new
        // schedule, and revealedAt/closedAt are stamps the reveal engine sets live.
        revealAt: null,
        revealedAt: null,
        closedAt: null,
      })),
    );
  }

  const sourceQuestions = await db
    .select()
    .from(surveyQuestions)
    .where(eq(surveyQuestions.eventId, sourceId))
    .orderBy(asc(surveyQuestions.position));
  if (sourceQuestions.length > 0) {
    await db.insert(surveyQuestions).values(
      sourceQuestions.map((q) => ({
        eventId: created.id,
        position: q.position,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        required: q.required,
      })),
    );
  }

  return NextResponse.json({ id: created.id, tiles: sourceTiles.length, surveyQuestions: sourceQuestions.length });
}
