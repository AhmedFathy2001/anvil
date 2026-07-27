import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, completions, submissions } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { del } from '@/lib/storage';
import { verifyAdmin, verifyAdminOrModerator } from '@/lib/auth';
import { notifyEventForceEnd, notifyEventStart } from '@/lib/discord';
import { getEventStartReadiness } from '@/lib/eventLifecycle';
import { describeStartBlockers } from '@/lib/eventReadiness';
import { autoGeneratePayoutsOnEnd } from '@/lib/payouts';
import { writePlayerEventFacts } from '@/lib/playerEventFacts';
import { parseEventRules, hasRevealPolicy, visibleTiles, validateEventRules } from '@/lib/eventRules';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const allEventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, id),
    orderBy: (tiles, { asc }) => [asc(tiles.position)],
  });

  // Reveal-policy events: members only receive the revealed subset — hidden tile content must
  // never reach the client. Staff keep the full board so admin tooling (and previews) work.
  const rules = parseEventRules(event.rules);
  let eventTiles = allEventTiles;
  if (hasRevealPolicy(rules)) {
    const staff = await verifyAdminOrModerator();
    if (!staff) eventTiles = visibleTiles(rules, allEventTiles);
  }

  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, id),
  });

  // Get all completions for tiles in this event
  const tileIds = eventTiles.map((t) => t.id);
  let eventCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    eventCompletions = await db.select().from(completions)
      .where(inArray(completions.tileId, tileIds));
  }

  // Strip captain passwords from team data
  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  return NextResponse.json({
    ...event,
    tiles: eventTiles,
    // Reveal-policy events: how many tiles the caller can't see yet (0 for staff/classic) —
    // lets boards render "N tiles still hidden" without knowing what they are.
    hiddenTileCount: allEventTiles.length - eventTiles.length,
    teams: safeTeams,
    completions: eventCompletions,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  const body = await request.json();

  // Handle force-end action
  if (body.action === 'force-end') {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Validate event is active (started, not ended, not already force-ended)
    if (event.forceEndedAt) {
      return NextResponse.json({ error: 'Event is already force-ended' }, { status: 400 });
    }
    if (event.startDate && event.startDate > now) {
      return NextResponse.json({ error: 'Event has not started yet' }, { status: 400 });
    }
    if (event.endDate && event.endDate < now) {
      return NextResponse.json({ error: 'Event has already ended' }, { status: 400 });
    }

    // Save original end date and force-end
    const [updated] = await db
      .update(events)
      .set({
        originalEndDate: event.endDate,
        endDate: now,
        forceEndedAt: now,
        endNotified: 1,
      })
      .where(eq(events.id, id))
      .returning();

    // Compute standings for Discord notification
    const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
    const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, id));
    const eventTileIds = eventTiles.map(t => t.id);
    const eventCompletions = eventTileIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
      : [];

    // Points-scoring events tally summed point weights of non-optional tiles;
    // classic events tally raw completed-tile counts. Mirrors eventLifecycle: frozen
    // awardedPoints win over live weights, and only revealed tiles count in the total.
    const forceEndRules = parseEventRules(event.rules);
    const pointsMode = event.scoringMode === 'points';
    const scoredTiles = visibleTiles(forceEndRules, eventTiles).filter(t => !t.optional);
    const weightById = new Map(scoredTiles.map(t => [t.id, pointsMode ? (t.points ?? 0) : 1]));
    const totalScore = scoredTiles.reduce((sum, t) => sum + (pointsMode ? (t.points ?? 0) : 1), 0);

    const standings = eventTeams.map(team => {
      const teamScore = eventCompletions
        .filter(c => c.teamId === team.id && weightById.has(c.tileId))
        .reduce(
          (sum, c) => sum + (pointsMode && c.awardedPoints != null ? c.awardedPoints : weightById.get(c.tileId) || 0),
          0,
        );
      return { teamName: team.name, tilesCompleted: teamScore };
    });

    notifyEventForceEnd({
      eventId: event.id,
      eventName: event.name,
      standings,
      totalTiles: pointsMode ? totalScore : scoredTiles.length,
      unit: pointsMode ? 'pts' : 'tiles',
    }).catch(() => {});

    // Auto-build payouts from the configured prize structure + final standings (no-op if no
    // structure or payouts already exist). Fire-and-forget — a payout hiccup mustn't fail the end.
    autoGeneratePayoutsOnEnd(event.id).catch(() => {});

    // Materialize player_event_facts (longitudinal profile evidence). Fire-and-forget like payouts.
    writePlayerEventFacts(event.id).catch(() => {});

    return NextResponse.json(updated);
  }

  // Handle resume action
  if (body.action === 'resume') {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.forceEndedAt) {
      return NextResponse.json({ error: 'Event is not force-ended' }, { status: 400 });
    }

    const [updated] = await db
      .update(events)
      .set({
        endDate: event.originalEndDate,
        forceEndedAt: null,
        originalEndDate: null,
        endNotified: 0,
      })
      .where(eq(events.id, id))
      .returning();

    return NextResponse.json(updated);
  }

  // Handle start-now action — kick the bingo off immediately from the admin UI instead of
  // waiting for the scheduled start to be reached by the cron. Sets the start to now, reveals
  // the tiles to members, and announces the start on Discord (exactly once). The end date is
  // left untouched, so the event still ends when it was configured to.
  if (body.action === 'start-now') {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (event.forceEndedAt) {
      return NextResponse.json({ error: 'Event is force-ended. Resume it before starting.' }, { status: 400 });
    }
    // An end date is required so the bingo has a defined finish (see the "Keep end date as-is"
    // decision) — and it must still be in the future, or the event would start already-ended.
    if (!event.endDate) {
      return NextResponse.json({ error: 'Set an end date before starting the bingo.' }, { status: 400 });
    }
    if (event.endDate <= now) {
      return NextResponse.json({ error: 'The end date has already passed. Update it before starting.' }, { status: 400 });
    }

    // START SAFEGUARD (lib/eventReadiness): refuse to go live mid-draft / with no teams assigned.
    // 409 + the blocker list so the UI can explain; `force: true` is the explicit admin override
    // (the UI re-confirms before sending it).
    if (body.force !== true) {
      const readiness = await getEventStartReadiness(event.id, event.draftStatus);
      if (!readiness.ready) {
        return NextResponse.json(
          {
            error: `The bingo isn't ready to start: ${describeStartBlockers(readiness.blockers)}.`,
            blockers: readiness.blockers,
          },
          { status: 409 },
        );
      }
    }

    // Flip startNotified atomically first — only the request that wins the flip sends the
    // Discord embed, so a retried start-now (or the cron reaching the start time) can't
    // double-post it.
    const flipped = await db
      .update(events)
      .set({ startNotified: 1 })
      .where(and(eq(events.id, id), eq(events.startNotified, 0)))
      .returning({ id: events.id });

    const [updated] = await db
      .update(events)
      .set({ startDate: now, tilesRevealed: 1 })
      .where(eq(events.id, id))
      .returning();

    if (flipped.length > 0) {
      notifyEventStart({
        eventId: updated.id,
        eventName: updated.name,
        startDate: updated.startDate!,
        endDate: updated.endDate,
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  }

  // Handle change-mode action — switch the event's base type (classic / leagues / race)
  // before it starts. Each type redefines the board shape and tile count, so we wipe the
  // existing tiles and regenerate a fresh placeholder set (label + icon carried over by
  // position where they overlap; per-tile config like points/type resets). Gated to
  // not-yet-started events so we never reshape a board out from under live participants.
  if (body.action === 'change-mode') {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const started = !!event.startDate && event.startDate <= now;
    if (started || event.forceEndedAt) {
      return NextResponse.json(
        { error: 'Cannot change the type of an event that has already started.' },
        { status: 400 },
      );
    }

    const { format, scoringMode, boardSize } = body;
    if (format !== 'bingo' && format !== 'tilerace') {
      return NextResponse.json({ error: "format must be 'bingo' or 'tilerace'" }, { status: 400 });
    }
    if (scoringMode !== 'tiles' && scoringMode !== 'points') {
      return NextResponse.json({ error: "scoringMode must be 'tiles' or 'points'" }, { status: 400 });
    }
    // A tile race is always scored by furthest tile reached; force 'tiles' there.
    const resolvedScoringMode = format === 'tilerace' ? 'tiles' : scoringMode;

    // Rules preset travels with the type change (showdown/luckydraw/bounty carry a reveal
    // policy; the three classic types clear it). Same validation + shape constraint as create.
    const rulesResult = validateEventRules(body.rules);
    if ('error' in rulesResult) {
      return NextResponse.json({ error: rulesResult.error }, { status: 400 });
    }
    const resolvedRules = rulesResult.rules;
    if (resolvedRules && hasRevealPolicy(parseEventRules(resolvedRules)) && (format !== 'bingo' || resolvedScoringMode !== 'points')) {
      return NextResponse.json(
        { error: 'Reveal policies (showdown / lucky draw / bounty) require the points-scored bingo format.' },
        { status: 400 },
      );
    }
    if (!Number.isInteger(boardSize) || boardSize < 1) {
      return NextResponse.json({ error: 'boardSize must be a positive integer' }, { status: 400 });
    }
    const isClassicGrid = format === 'bingo' && resolvedScoringMode === 'tiles';
    if (isClassicGrid && boardSize > 12) {
      return NextResponse.json({ error: 'A classic grid is capped at 12×12.' }, { status: 400 });
    }
    if (!isClassicGrid && boardSize > 1000) {
      return NextResponse.json({ error: 'Events are capped at 1000 tiles.' }, { status: 400 });
    }
    const expectedTiles = isClassicGrid ? boardSize * boardSize : boardSize;

    const updated = await db.transaction(async (tx) => {
      const oldTiles = await tx
        .select({ position: tiles.position, label: tiles.label, icon: tiles.icon })
        .from(tiles)
        .where(eq(tiles.eventId, id));
      const byPosition = new Map(oldTiles.map((t) => [t.position, t]));
      await tx.delete(tiles).where(eq(tiles.eventId, id));
      const tileValues = Array.from({ length: expectedTiles }, (_, i) => ({
        eventId: id,
        position: i,
        label: byPosition.get(i)?.label ?? `Tile ${i + 1}`,
        icon: byPosition.get(i)?.icon ?? null,
      }));
      await tx.insert(tiles).values(tileValues);
      const [row] = await tx
        .update(events)
        .set({ format, scoringMode: resolvedScoringMode, boardSize, rules: resolvedRules })
        .where(eq(events.id, id))
        .returning();
      return row;
    });

    return NextResponse.json(updated);
  }

  // Default: update dates and/or sign-up config
  const updates: Record<string, unknown> = {};
  // Admin-controlled member-facing tile reveal. Coerce to 0/1 so a bare boolean works.
  if ('tilesRevealed' in body) updates.tilesRevealed = body.tilesRevealed ? 1 : 0;
  // Per-event game rules (lib/eventRules) — lets admins tune interval/bonus settings in place.
  // The reveal POLICY itself shouldn't hop between kinds mid-event; the change-type action (which
  // is pre-start-gated and rebuilds tiles) is the way to switch modes.
  if ('rules' in body) {
    const rulesResult = validateEventRules(body.rules);
    if ('error' in rulesResult) {
      return NextResponse.json({ error: rulesResult.error }, { status: 400 });
    }
    updates.rules = rulesResult.rules;
  }
  if ('startDate' in body) {
    updates.startDate = body.startDate;
    // Re-arm the start-hold warning: a rescheduled start that again arrives unready warns anew.
    updates.startHoldNotified = 0;
  }
  if ('endDate' in body) updates.endDate = body.endDate;
  if ('signupOpensAt' in body) updates.signupOpensAt = body.signupOpensAt;
  if ('signupDeadline' in body) updates.signupDeadline = body.signupDeadline;
  if ('paymentDeadline' in body) updates.paymentDeadline = body.paymentDeadline;
  if ('captainSelectionDeadline' in body) updates.captainSelectionDeadline = body.captainSelectionDeadline;
  if ('signupFee' in body) {
    if (body.signupFee !== null && (typeof body.signupFee !== 'number' || !Number.isFinite(body.signupFee) || body.signupFee < 0)) {
      return NextResponse.json({ error: 'signupFee must be a non-negative number or null' }, { status: 400 });
    }
    updates.signupFee = body.signupFee;
  }
  if ('addedPrizePool' in body) {
    if (body.addedPrizePool !== null && (typeof body.addedPrizePool !== 'number' || !Number.isFinite(body.addedPrizePool) || body.addedPrizePool < 0)) {
      return NextResponse.json({ error: 'addedPrizePool must be a non-negative number or null' }, { status: 400 });
    }
    updates.addedPrizePool = body.addedPrizePool;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Validate ISO strings and enforce end > start (using the final values: new or existing).
  const isIsoString = (v: unknown): v is string =>
    typeof v === 'string' && !Number.isNaN(Date.parse(v));

  for (const field of ['startDate', 'endDate', 'signupOpensAt', 'signupDeadline', 'paymentDeadline', 'captainSelectionDeadline'] as const) {
    if (field in body && body[field] !== null && !isIsoString(body[field])) {
      return NextResponse.json({ error: `${field} must be an ISO date string or null` }, { status: 400 });
    }
  }

  const existing = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const finalStart = 'startDate' in body ? (body.startDate as string | null) : existing.startDate;
  const finalEnd = 'endDate' in body ? (body.endDate as string | null) : existing.endDate;
  if (finalStart && finalEnd && finalEnd <= finalStart) {
    return NextResponse.json(
      { error: 'endDate must be after startDate' },
      { status: 400 },
    );
  }

  // Sign-up sequencing: opens ≤ deadline ≤ captain-selection ≤ start. Each pair is checked
  // individually so partial updates against existing values still validate.
  const finalSignupOpens = 'signupOpensAt' in body ? (body.signupOpensAt as string | null) : existing.signupOpensAt;
  const finalSignupDeadline = 'signupDeadline' in body ? (body.signupDeadline as string | null) : existing.signupDeadline;
  const finalCaptainDeadline = 'captainSelectionDeadline' in body ? (body.captainSelectionDeadline as string | null) : existing.captainSelectionDeadline;

  if (finalSignupOpens && finalSignupDeadline && finalSignupDeadline <= finalSignupOpens) {
    return NextResponse.json({ error: 'signupDeadline must be after signupOpensAt' }, { status: 400 });
  }
  if (finalSignupDeadline && finalCaptainDeadline && finalCaptainDeadline < finalSignupDeadline) {
    return NextResponse.json({ error: 'captainSelectionDeadline must be on or after signupDeadline' }, { status: 400 });
  }
  if (finalCaptainDeadline && finalStart && finalCaptainDeadline > finalStart) {
    return NextResponse.json({ error: 'captainSelectionDeadline must be on or before startDate' }, { status: 400 });
  }
  if (finalSignupDeadline && finalStart && finalSignupDeadline > finalStart) {
    return NextResponse.json({ error: 'signupDeadline must be on or before startDate' }, { status: 400 });
  }

  const [updated] = await db
    .update(events)
    .set(updates)
    .where(eq(events.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/events/[eventId] — permanently removes an event and everything it owns
// (tiles, teams, completions, players, submissions, signups all cascade in the schema).
// Admin-only and gated on the event already being over so we can't delete a live one
// out from under participants — force-end first if you need to delete a running event.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Bad event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const isOver = !!event.forceEndedAt || (!!event.endDate && event.endDate < now);
  // "Not started" covers both unscheduled drafts and upcoming events whose start is
  // still in the future — neither has live participants, so both are safe to delete.
  const notStarted = !event.forceEndedAt && (!event.startDate || event.startDate > now);
  if (!isOver && !notStarted) {
    return NextResponse.json(
      { error: 'Event is still active. Force-end it first or wait for it to end.' },
      { status: 400 },
    );
  }

  // Free the submission screenshots from Blob storage before the rows cascade away with the event —
  // otherwise the images are orphaned and bill forever (the DB delete drops the rows, not the blobs).
  // Best-effort and chunked so a single failed delete never blocks tearing the event down.
  const eventTiles = await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, id));
  const tileIds = eventTiles.map((t) => t.id);
  if (tileIds.length > 0) {
    const subs = await db
      .select({ imageUrl: submissions.imageUrl })
      .from(submissions)
      .where(inArray(submissions.tileId, tileIds));
    const urls = subs.map((s) => s.imageUrl).filter((u): u is string => !!u);
    for (let i = 0; i < urls.length; i += 100) {
      await del(urls.slice(i, i + 100)).catch(() => {});
    }
  }

  await db.delete(events).where(eq(events.id, id));
  return NextResponse.json({ success: true });
}
