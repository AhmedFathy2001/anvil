import { NextResponse } from 'next/server';
import { db } from '@/db';
import { normalizeRsn, resolvePluginClan } from '@/lib/auth';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { computeLeaderboard, getEffectiveParticipants } from '@/lib/weekly';
import { weeklyMetricLabel } from '@/lib/constants';
import { weeklyRsnKey } from '@/lib/weeklyRsn';
import { buildGroupStandings, competitionForClan, partnerCompetitions } from '@/lib/competitionTeamsDb';
import { weeklyGroupsPayload } from '@/lib/pluginUi/teamStandingsUi';

// GET /api/plugin/weekly-leaderboard[?id=<competitionId>]
// Returns the ranked standings for a weekly competition (the active one when no id is given),
// for the RuneLite plugin's Anvil tab. Unauthenticated — leaderboards are public within a clan.
// Capped at the top 50 to keep the payload small; the plugin highlights the local player by RSN.
// `?rsn=` adds that player's own row as `you`, wherever they rank: a big week has more players than
// the cap, and someone on +0 sorted past it read as "not on the board" when they were.
//
// "Public" meant something narrower when a deployment was one clan. Both lookups here are now
// scoped to the clan the request names: `?id=` was a plain IDOR — any competition id on the
// platform, returning every participant's RSN and gains to an anonymous caller — and the no-id form
// picked whichever active competition came back first, so a clan between competitions showed a
// stranger's standings in its own side panel.
const MAX_ENTRIES = 50;

async function pluginEntry(competitionId: number, status: string, rsn: string | null) {
  if (!rsn || status === 'completed') return null;
  const rows = await db
    .select({ optedOut: weeklyParticipants.optedOut })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, competitionId), eq(weeklyParticipants.rsnNormalized, normalizeRsn(rsn))));
  if (!rows.length) return null;
  const optedOut = rows.every((r) => r.optedOut);
  return {
    entered: true,
    optedOut,
    // "You're in · Opt out" / "You've opted out · Opt back in"
    label: optedOut ? "You've opted out" : "You're in",
    action: {
      label: optedOut ? 'Opt back in' : 'Opt out',
      method: 'POST',
      path: '/api/plugin/weekly/opt-out',
      body: { competitionId, optOut: !optedOut },
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  const clan = await resolvePluginClan(request);
  if (!clan) return NextResponse.json({ competition: null, total: 0, entries: [] });

  // The clan's own competition — or, clan vs clan, one it accepted an invite into (read-only there).
  // competitionForClan refuses anything else, so the IDOR stays closed.
  const comp = idParam
    ? (await competitionForClan(clan.id, parseInt(idParam, 10)))?.comp
    : ((await db.query.weeklyCompetitions.findFirst({
        where: and(eq(weeklyCompetitions.clanId, clan.id), eq(weeklyCompetitions.status, 'active')),
      })) ?? (await partnerCompetitions(clan.id, 'active'))[0]);

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
    const key = weeklyRsnKey(p.rsn);
    const existing = byRsn.get(key);
    if (!existing || (p.currentValue ?? 0) > (existing.currentValue ?? 0)) {
      byRsn.set(key, p);
    }
  }

  const board = computeLeaderboard([...byRsn.values()]);
  const row = (e: (typeof board)[number], i: number) => ({
    rank: i + 1,
    rsn: e.rsn,
    // Clamp to >= 0: a not-yet-fetched / unranked participant has currentValue null, which
    // computeLeaderboard treats as 0, yielding a spurious negative gain (0 - baseline). You
    // can't lose KC/XP, so floor it at 0.
    gained: Math.max(0, e.gained),
  });
  const entries = board.slice(0, MAX_ENTRIES).map(row);
  const wanted = weeklyRsnKey(searchParams.get('rsn'));
  const at = wanted ? board.findIndex((e) => weeklyRsnKey(e.rsn) === wanted) : -1;
  const you = at >= 0 ? row(board[at], at) : null;

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
      mode: comp.mode,
    },
    total: board.length,
    entries,
    you,
    // Team / clan-vs-clan standings (null on a solo competition) — lib/pluginUi/teamStandingsUi.
    // `groups.you.line` is the ready-to-print "Your team: 2nd of 4 · +1.2M XP".
    groups: weeklyGroupsPayload(comp.type, await buildGroupStandings(comp, { rsn: searchParams.get('rsn') })),
    // "You're in · Opt out" for the panel: this RSN's entry, and the call that flips it. The call is
    // token-authenticated (it acts on the logged-in character, not on this RSN).
    entry: await pluginEntry(comp.id, comp.status, searchParams.get('rsn')),
  });
}
