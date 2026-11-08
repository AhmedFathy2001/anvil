import { NextResponse } from 'next/server';
import { db } from '@/db';
import { resolvePluginClan, resolvePluginMember, verifyPluginTokenUser } from '@/lib/auth';
import { users, weeklyCompetitions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { rankMove, weeklyBaselineRanks, weeklyBoard } from '@/lib/rankMoves';
import { weeklyMetricLabel } from '@/lib/constants';
import { weeklyRsnKey } from '@/lib/weeklyRsn';
import { buildGroupStandings, competitionForClan, competitionReadableBy, entryStatus, partnerCompetitions } from '@/lib/competitionTeamsDb';
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

// The entry is the TOKEN's own character's, never the ?rsn= the request names: a name in the query is
// anyone's, and whether someone opted out is theirs to know (the opt-out call acts on the token too).
async function pluginEntry(request: Request, competitionId: number, status: string) {
  if (status === 'completed') return null;
  const member = await resolvePluginMember(request).catch(() => null);
  if (!member) return null;
  const { entered, optedOut } = await entryStatus(competitionId, { accountId: member.accountId });
  if (!entered) return null;
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

/** The plugin token's person, for the privacy gate; nobody when no (valid) token is sent. */
async function pluginViewer(request: Request): Promise<{ playerId: number | null; userId: number | null }> {
  const auth = await verifyPluginTokenUser(request).catch(() => null);
  if (!auth) return { playerId: null, userId: null };
  const row = await db.query.users.findFirst({ where: eq(users.id, auth.userId), columns: { playerId: true } });
  return { playerId: row?.playerId ?? null, userId: auth.userId };
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
  // A clan-vs-clan board lists every racing clan's players, so it is read under every racing clan's
  // privacy — the same gate as the site's /weekly/[id] (competitionReadableBy). Without it, a public
  // partner's address served a private host's (or another partner's) members to anyone.
  if (!(await competitionReadableBy(comp, await pluginViewer(request)))) {
    return NextResponse.json({ competition: null, total: 0, entries: [] });
  }

  // Excludes anyone whose clan_member has left the CC (unless an admin set keepIfLeft) so the
  // headcount + standings reflect current members; one row per name (lib/rankMoves weeklyBoard).
  const [board, since] = await Promise.all([weeklyBoard(comp.id), comp.status === 'active' ? weeklyBaselineRanks(comp.id) : Promise.resolve(null)]);
  const row = (e: (typeof board)[number], i: number) => ({
    rank: i + 1,
    rsn: e.rsn,
    // Clamp to >= 0: a not-yet-fetched / unranked participant has currentValue null, which
    // computeLeaderboard treats as 0, yielding a spurious negative gain (0 - baseline). You
    // can't lose KC/XP, so floor it at 0.
    gained: Math.max(0, e.gained),
    // Places climbed since the UTC day began; null when unchanged or not yet recorded.
    move: rankMove(since?.get(weeklyRsnKey(e.rsn)), i + 1),
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
    entry: await pluginEntry(request, comp.id, comp.status),
  });
}
