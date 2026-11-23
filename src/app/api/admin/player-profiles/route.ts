import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyAdminOrModerator } from '@/lib/auth';
import { computePlayerProfiles } from '@/lib/playerProfile';
import { eventInClan } from '@/lib/eventScope';
import { strengthOf } from '@/lib/draftMath';
import { db } from '@/db';
import { teams, tiles } from '@/db/schema';
import { boardActivityKeys, coverageGaps, describeGap } from '@/lib/draftCoverage';
import { eq } from 'drizzle-orm';

// Staff-only TEAM strengths for the Teams & Draft tab (balance-engine plan). ?eventId=N rates that
// event's roster / sign-up pool. Ratings are computed here and never leave: the response carries one
// strength per team and a pool headcount, no per-person rating, tier or evidence (member privacy,
// even from their own clan admins). Built from this clan's own events and roster alone
// (lib/playerProfile), never from what a member did in another clan.
export async function GET(request: Request) {
  const clan = await requireClan();
  const staff = await verifyAdminOrModerator();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventIdRaw = url.searchParams.get('eventId');
  const eventId = eventIdRaw != null ? parseInt(eventIdRaw, 10) : undefined;
  if (eventIdRaw != null && !Number.isFinite(eventId)) {
    return NextResponse.json({ error: 'eventId must be a number' }, { status: 400 });
  }
  // Event ids are global: one from another clan rated THAT clan's board roster for whoever asked.
  if (eventId != null && !(await eventInClan(clan.id, eventId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (eventId == null) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }
  // clan-scope: global -- the event was verified in this clan above (eventInClan), teams hang off it.
  const [profiles, eventTeams, boardTiles] = await Promise.all([
    computePlayerProfiles(clan.id, { eventId }),
    db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, eventId)),
    db
      .select({ trackedStat: tiles.trackedStat, timedActivity: tiles.timedActivity, sourceNpcs: tiles.sourceNpcs })
      .from(tiles)
      .where(eq(tiles.eventId, eventId)),
  ]);
  const nameOf = new Map(eventTeams.map((t) => [t.id, t.name]));
  // Team-level only: which teams have nobody for the board's hard content. Never who.
  const coverage =
    eventTeams.length >= 2
      ? coverageGaps(profiles, eventTeams.map((t) => t.id), boardActivityKeys(boardTiles)).map((g) =>
          describeGap(g, (id) => nameOf.get(id) ?? 'A team'),
        )
      : [];
  return NextResponse.json({
    teams: eventTeams.map((t) => ({
      teamId: t.id,
      strength: strengthOf(profiles.filter((p) => p.teamId === t.id).map((p) => p.rating)),
    })),
    poolCount: profiles.filter((p) => p.teamId == null).length,
    coverage,
    nothingToRate:
      profiles.length > 0 && profiles.every((p) => p.evidenceEvents === 0 && p.capabilityMarkers.length === 0),
  });
}
