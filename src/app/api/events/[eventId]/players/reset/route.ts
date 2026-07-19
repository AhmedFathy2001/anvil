import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles, submissions, completions, events } from '@/db/schema';
import { and, eq, inArray, or, isNotNull } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { parseContributionSnapshot, buildContributionSnapshot } from '@/lib/statTracking';

// Reset a single player's participation in an event — the "nuclear" option, minus the whole-team blast
// radius. Per the product decision: this resets THIS player's own progress only. Their solo/individual
// completions (which are 100% theirs) are un-completed, their submissions are voided, and their share is
// stripped from every team-mode tile's frozen contribution split — but the TEAM's completed tiles stay
// completed (we never reopen a team tile just because one member's contribution was pulled). It does NOT
// touch the clan-wide account (no ban). `remove: true` also drops them off the roster (teamId → null).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { playerId, remove } = await request.json();
  const pId = parseInt(String(playerId), 10);
  if (!Number.isFinite(pId)) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pId), eq(players.eventId, eId)),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Removing from the roster mid-draft would corrupt the snake-pick flow (same guard as the roster PATCH).
  if (remove) {
    const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
    if (event && (event.draftStatus === 'active' || event.draftStatus === 'paused')) {
      return NextResponse.json({ error: 'Cannot remove a player while the draft is in progress.' }, { status: 409 });
    }
  }

  const eventTiles = await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, eId));
  const tileIds = eventTiles.map((t) => t.id);

  let voidedSubmissions = 0;
  let removedCompletions = 0;
  let strippedFromSplits = 0;

  if (tileIds.length > 0) {
    // 1. Void their submissions on this event (whether they uploaded them or were credited).
    const delSubs = await db
      .delete(submissions)
      .where(
        and(
          inArray(submissions.tileId, tileIds),
          or(eq(submissions.playerId, pId), eq(submissions.creditPlayerId, pId)),
        ),
      )
      .returning({ id: submissions.id });
    voidedSubmissions = delSubs.length;

    // 2. Un-complete tiles they finished solo (individual stat completions are attributed to them and
    //    are entirely their own work, so resetting the player reopens them).
    const delComps = await db
      .delete(completions)
      .where(and(inArray(completions.tileId, tileIds), eq(completions.creditPlayerId, pId)))
      .returning({ id: completions.id });
    removedCompletions = delComps.length;

    // 3. Strip their share from every remaining team-mode frozen split, keeping the team's completion.
    const withSplits = await db
      .select({ id: completions.id, statContributions: completions.statContributions })
      .from(completions)
      .where(and(inArray(completions.tileId, tileIds), isNotNull(completions.statContributions)));
    for (const c of withSplits) {
      const snap = parseContributionSnapshot(c.statContributions);
      if (!snap || !snap.split.some((r) => r.playerId === pId)) continue;
      const remaining = snap.split.filter((r) => r.playerId !== pId);
      await db
        .update(completions)
        .set({ statContributions: remaining.length ? JSON.stringify(buildContributionSnapshot(snap.goal, remaining)) : null })
        .where(eq(completions.id, c.id));
      strippedFromSplits += 1;
    }
  }

  // 4. Wipe their own stat state (baseline + current + freeze), so post-reset they contribute nothing
  //    until re-baselined. If removing, also unassign from the team.
  await db
    .update(players)
    .set({
      statsSnapshot: null,
      snapshotAt: null,
      cachedStats: null,
      lastStatsFetch: null,
      pluginStats: null,
      frozenAt: null,
      frozenStats: null,
      ...(remove ? { teamId: null, pickNumber: null, pickedAt: null } : {}),
    })
    .where(eq(players.id, pId));

  return NextResponse.json({
    ok: true,
    voidedSubmissions,
    removedCompletions,
    strippedFromSplits,
    removed: !!remove,
  });
}
