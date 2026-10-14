import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tiles, teams, completions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { syncDropTileCompletion } from '@/lib/submissions';
import { assertEventEditable } from '@/lib/eventLock';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';

export const dynamic = 'force-dynamic';

// POST /api/events/[eventId]/recompute-completions — admin maintenance. Re-runs the submission-backed
// completion check for every (team, tile) that ISN'T already complete, healing tiles that were already at
// their target BEFORE a completion rule changed (syncDropTileCompletion otherwise only re-runs on a NEW
// submission — e.g. a full item set collected before the collection-completion fix shipped). It only ever
// touches pairs with NO completion yet, so it can only ADD — never revert a manual/auto completion.
// Notifications are suppressed (silent) so old completions don't re-announce.
//
// Stat tiles (XP / KC goals) are re-checked too, off every member's live gain. Those only complete on a
// plugin push that touches their key or on a sweep fetch of a team member; a pushing account the sweep
// leaves to the plugin, whose push could not find its board, left tiles sitting past their goal. Those
// completions ARE announced — they never were.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
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
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, id) });
  const eventTeams = await db.query.teams.findMany({ where: eq(teams.eventId, id) });
  const eventTileIds = eventTiles.map((t) => t.id);
  const existing = eventTileIds.length
    ? await db.query.completions.findMany({ where: inArray(completions.tileId, eventTileIds) })
    : [];
  const alreadyDone = new Set(existing.map((c) => `${c.teamId}-${c.tileId}`));

  // The sweep's definition (lib/statsSweep), so the repair reaches exactly the tiles it would.
  const isStatTile = (t: (typeof eventTiles)[number]) =>
    !!t.trackedStat && !!t.statType && !!t.statGoal && !t.autoTrackDisabled;
  const statTiles = eventTiles.filter(isStatTile);

  let healed = 0;
  for (const team of eventTeams) {
    for (const tile of eventTiles) {
      if (isStatTile(tile)) continue;
      if (alreadyDone.has(`${team.id}-${tile.id}`)) continue; // never revert an existing completion
      const res = await syncDropTileCompletion(tile.id, team.id, { silent: true });
      if (res?.isComplete) healed += 1;
    }
    const open = statTiles.filter((t) => !alreadyDone.has(`${team.id}-${t.id}`));
    healed += (await creditStatTilesForTeam({ eventId: id, teamId: team.id, statTiles: open })).length;
  }

  return NextResponse.json({ healed });
}
