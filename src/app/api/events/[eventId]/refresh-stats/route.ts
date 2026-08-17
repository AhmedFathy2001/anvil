import { NextResponse } from 'next/server';
import { db } from '@/db';
import { getSetting, setSetting } from '@/lib/settings';
import { players, teams, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, verifyUser, resolveTeamMembership } from '@/lib/auth';
import { getHiscoresStats } from '@/lib/hiscores';
import { assertEventEditable } from '@/lib/eventLock';

// Manual stat refresh is a STAFF override, not a per-member button: admins refresh the whole event,
// captains refresh their own team. Regular members rely on the periodic stats cron for freshness
// (avoids everyone hammering the OSRS hiscores).
//
// The 1-hour cooldown is persisted in `settings` — deliberately NOT keyed off players.lastStatsFetch,
// which the cron keeps fresh; keying off that would permanently block the manual override.
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check + stamp a persisted cooldown for `key`. Returns blocked=true (with nextRefresh) if still
// within the window; otherwise records "now" and returns blocked=false.
async function takeCooldown(key: string): Promise<{ blocked: boolean; nextRefresh?: string }> {
  const stored = await getSetting(key);
  const last = stored ? new Date(stored).getTime() : 0;
  const nowMs = Date.now();
  if (last && nowMs - last < REFRESH_COOLDOWN_MS) {
    return { blocked: true, nextRefresh: new Date(last + REFRESH_COOLDOWN_MS).toISOString() };
  }
  const nowIso = new Date(nowMs).toISOString();
  await setSetting(key, nowIso);
  return { blocked: false };
}

// Sequentially re-fetch each player's hiscores, paced 1.2s apart so a whole team/event doesn't
// burst the OSRS hiscores.
async function refreshPlayers(list: { id: number; name: string }[], nowIso: string) {
  const results: { playerId: number; name: string; success: boolean }[] = [];
  for (const p of list) {
    try {
      const stats = await getHiscoresStats(p.name);
      await db
        .update(players)
        .set({ cachedStats: JSON.stringify(stats), lastStatsFetch: nowIso })
        .where(eq(players.id, p.id));
      results.push({ playerId: p.id, name: p.name, success: true });
    } catch {
      results.push({ playerId: p.id, name: p.name, success: false });
    }
    await delay(1200);
  }
  return results;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { playerId, teamId } = await request.json();

  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  // Discord web session — resolved to a captain against the target team below.
  const webUser = !isAdmin && !captain ? await verifyUser() : null;
  if (!isAdmin && !captain && !webUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (!isAdmin && event.startDate && new Date().toISOString() < event.startDate) {
    return NextResponse.json({ error: 'Event has not started yet' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Single player — admin-only targeted override (no cooldown; staff-only, low volume). Members and
  // captains no longer refresh individual players; captains use the team refresh below.
  if (playerId) {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only an admin can refresh a single player.' }, { status: 403 });
    }
    const target = await db.query.players.findFirst({
      where: and(eq(players.id, playerId), eq(players.eventId, eId)),
    });
    if (!target) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    try {
      const stats = await getHiscoresStats(target.name);
      await db
        .update(players)
        .set({ cachedStats: JSON.stringify(stats), lastStatsFetch: nowIso })
        .where(eq(players.id, playerId));
      return NextResponse.json({ success: true, playerId, lastFetch: nowIso });
    } catch {
      return NextResponse.json({ error: `Failed to fetch stats for ${target.name}` }, { status: 500 });
    }
  }

  // Team refresh — captain of this team (legacy cookie or Discord session) or admin. 1h cooldown.
  if (teamId) {
    let isTeamCaptain = !!captain && captain.teamId === teamId;
    if (!isAdmin && !isTeamCaptain && webUser) {
      const m = await resolveTeamMembership(eId, teamId);
      if (m?.isCaptain) isTeamCaptain = true;
    }
    if (!isAdmin && !isTeamCaptain) {
      return NextResponse.json({ error: 'Only this team\'s captain or an admin can refresh it.' }, { status: 403 });
    }

    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
    });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const cd = await takeCooldown(`refresh_cooldown:team:${teamId}`);
    if (cd.blocked) {
      return NextResponse.json(
        { error: 'This team\'s stats were refreshed within the last hour — try again later.', nextRefresh: cd.nextRefresh },
        { status: 429 },
      );
    }

    const teamPlayers = await db.query.players.findMany({
      where: and(eq(players.teamId, teamId), eq(players.eventId, eId)),
    });
    const results = await refreshPlayers(teamPlayers, nowIso);
    return NextResponse.json({ success: true, teamId, lastFetch: nowIso, results });
  }

  // Admin: refresh every player in the event. 1h cooldown.
  if (isAdmin) {
    const cd = await takeCooldown(`refresh_cooldown:event:${eId}`);
    if (cd.blocked) {
      return NextResponse.json(
        { error: 'Event stats were refreshed within the last hour — try again later.', nextRefresh: cd.nextRefresh },
        { status: 429 },
      );
    }
    const allPlayers = await db.query.players.findMany({ where: eq(players.eventId, eId) });
    const results = await refreshPlayers(allPlayers, nowIso);
    return NextResponse.json({ success: true, lastFetch: nowIso, results });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
