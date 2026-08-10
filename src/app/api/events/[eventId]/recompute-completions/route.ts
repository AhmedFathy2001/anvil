import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, teams, completions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { syncDropTileCompletion } from '@/lib/submissions';
import { assertEventEditable } from '@/lib/eventLock';

export const dynamic = 'force-dynamic';

// POST /api/events/[eventId]/recompute-completions — admin maintenance. Re-runs the submission-backed
// completion check for every (team, tile) that ISN'T already complete, healing tiles that were already at
// their target BEFORE a completion rule changed (syncDropTileCompletion otherwise only re-runs on a NEW
// submission — e.g. a full item set collected before the collection-completion fix shipped). It only ever
// touches pairs with NO completion yet, so it can only ADD — never revert a manual/auto completion.
// Notifications are suppressed (silent) so old completions don't re-announce.
export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
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

  let healed = 0;
  for (const team of eventTeams) {
    for (const tile of eventTiles) {
      if (alreadyDone.has(`${team.id}-${tile.id}`)) continue; // never revert an existing completion
      const res = await syncDropTileCompletion(tile.id, team.id, { silent: true });
      if (res?.isComplete) healed += 1;
    }
  }

  return NextResponse.json({ healed });
}
