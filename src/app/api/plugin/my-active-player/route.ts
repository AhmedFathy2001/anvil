import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, players, teams } from '@/db/schema';
import { eq, inArray, or } from 'drizzle-orm';
import { normalizeRsn, verifyAdminPluginToken } from '@/lib/auth';

// GET /api/plugin/my-active-player?rsn=X
//
// Authenticated by the admin plugin token. Resolves the calling user → their
// clan_members rows → player rows → returns the active event's playerToken so the
// plugin can self-bootstrap into the player UI (drop tracking, codeword, etc.)
// without the user pasting a per-event token.
//
// Picks an "active" event when possible: started + not ended + not force-ended.
// Falls back to the first non-ended match if nothing is currently live.
export async function GET(request: Request) {
  const auth = await verifyAdminPluginToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const rsnParam = url.searchParams.get('rsn');
  const normalizedRsn = rsnParam ? normalizeRsn(rsnParam) : null;

  // Match clan_members owned by this user; also match by rsn so guests added before
  // they linked their account still resolve.
  const memberRows = await db
    .select({ id: clanMembers.id })
    .from(clanMembers)
    .where(
      normalizedRsn
        ? or(eq(clanMembers.userId, auth.userId), eq(clanMembers.rsnNormalized, normalizedRsn))
        : eq(clanMembers.userId, auth.userId),
    );

  if (memberRows.length === 0) {
    return NextResponse.json({ player: null });
  }

  const memberIds = memberRows.map((r) => r.id);

  // Pull all player rows for those clan_members, joined with their event + team.
  const playerRows = await db
    .select({
      playerId: players.id,
      playerName: players.name,
      playerToken: players.playerToken,
      teamId: players.teamId,
      eventId: players.eventId,
      eventName: events.name,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      eventForceEndedAt: events.forceEndedAt,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .leftJoin(teams, eq(players.teamId, teams.id))
    .where(inArray(players.clanMemberId, memberIds));

  const nowIso = new Date().toISOString();
  const stillRunning = playerRows.filter(
    (p) => !p.eventForceEndedAt && (!p.eventEndDate || p.eventEndDate > nowIso),
  );

  if (stillRunning.length === 0) {
    return NextResponse.json({ player: null });
  }

  const active = stillRunning.find(
    (p) => p.eventStartDate && p.eventStartDate <= nowIso,
  );
  const pick = active ?? stillRunning[0];

  return NextResponse.json({
    player: {
      playerId: pick.playerId,
      playerToken: pick.playerToken,
      playerName: pick.playerName,
      eventId: pick.eventId,
      eventName: pick.eventName,
      teamId: pick.teamId,
      teamName: pick.teamName,
      teamColor: pick.teamColor,
    },
  });
}
