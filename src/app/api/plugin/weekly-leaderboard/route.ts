import { NextResponse } from 'next/server';
import { db } from '@/db';
import { resolvePluginClan } from '@/lib/auth';
import { weeklyCompetitions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { computeLeaderboard, getEffectiveParticipants } from '@/lib/weekly';
import { weeklyMetricLabel } from '@/lib/constants';
import { log } from '@/lib/logger';

// GET /api/plugin/weekly-leaderboard[?id=<competitionId>]
// Returns the ranked standings for a weekly competition (the active one when no id is given),
// for the RuneLite plugin's Anvil tab. Unauthenticated — leaderboards are public within a clan.
// Capped at the top 50 to keep the payload small; the plugin highlights the local player by RSN.
//
// "Public" meant something narrower when a deployment was one clan. Both lookups here are now
// scoped to the clan the request names: `?id=` was a plain IDOR — any competition id on the
// platform, returning every participant's RSN and gains to an anonymous caller — and the no-id form
// picked whichever active competition came back first, so a clan between competitions showed a
// stranger's standings in its own side panel.
const MAX_ENTRIES = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  const clan = await resolvePluginClan(request);
  // TEMP DEBUG — diagnosing an empty SOTW board in the plugin. Remove after.
  const authHeader = request.headers.get('authorization') || '';
  log.info('weekly-lb.debug', {
    id: idParam,
    hasAuth: !!authHeader,
    authKind: authHeader.slice(0, 7),
    tokenLen: authHeader.startsWith('Bearer ') ? authHeader.length - 7 : 0,
    clan: clan?.slug ?? null,
    ua: (request.headers.get('user-agent') || '').slice(0, 40),
  });
  if (!clan) return NextResponse.json({ competition: null, total: 0, entries: [] });

  const comp = idParam
    ? await db.query.weeklyCompetitions.findFirst({
        where: and(
          eq(weeklyCompetitions.clanId, clan.id),
          eq(weeklyCompetitions.id, parseInt(idParam, 10)),
        ),
      })
    : await db.query.weeklyCompetitions.findFirst({
        where: and(eq(weeklyCompetitions.clanId, clan.id), eq(weeklyCompetitions.status, 'active')),
      });

  if (!comp) {
    return NextResponse.json({ competition: null, total: 0, entries: [] });
  }

  // Excludes anyone whose clan_member has left the CC (unless an admin set keepIfLeft) so the
  // headcount + standings reflect current members. See getEffectiveParticipants.
  const participants = await getEffectiveParticipants(comp.id);

  // Dedupe by RSN (case-insensitive): a rename/re-enroll can leave two participant rows for the
  // same player, which otherwise shows them twice. Keep the row with the most progress.
  // Normalize whitespace too - OSRS display names can carry non-breaking spaces, so
  // "Drenvox mdps" can arrive with mismatched spacing and dodge a plain lowercase compare.
  const byRsn = new Map<string, (typeof participants)[number]>();
  for (const p of participants) {
    const key = (p.rsn ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const existing = byRsn.get(key);
    if (!existing || (p.currentValue ?? 0) > (existing.currentValue ?? 0)) {
      byRsn.set(key, p);
    }
  }

  const board = computeLeaderboard([...byRsn.values()]);
  const entries = board.slice(0, MAX_ENTRIES).map((e, i) => ({
    rank: i + 1,
    rsn: e.rsn,
    // Clamp to >= 0: a not-yet-fetched / unranked participant has currentValue null, which
    // computeLeaderboard treats as 0, yielding a spurious negative gain (0 - baseline). You
    // can't lose KC/XP, so floor it at 0.
    gained: Math.max(0, e.gained),
  }));

  return NextResponse.json({
    competition: {
      id: comp.id,
      title: comp.title,
      type: comp.type,
      metric: comp.metric,
      // The key AND its label: the plugin can't turn "phosanisNightmare" into "Phosani's Nightmare"
      // on its own, and it's the label people read in-game.
      metricLabel: weeklyMetricLabel(comp.type, comp.metric),
      startDate: comp.startDate,
      endDate: comp.endDate,
    },
    total: board.length,
    entries,
  });
}
