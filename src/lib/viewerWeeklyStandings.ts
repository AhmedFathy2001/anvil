import { and, eq, inArray } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clans, weeklyCompetitionClans, weeklyCompetitionTeams, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import type { PersonStanding, SideStanding, WeeklyViewer } from '@/lib/competitionRows';
import { competitionMode, groupStandingsFromRows, teamColour, type GroupDef } from '@/lib/competitionTeams';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { computeLeaderboard, countsTowardLeaderboard } from '@/lib/weekly';
import { viewerPlace } from '@/lib/weeklyPlace';
import { competitionBoard } from '@/lib/itemHuntDb';

/**
 * Where the viewer stands in each weekly competition they are entered in, for the events page's and
 * the clan home's rows ("You: #6 of 24 · 5 KC behind #5", "Your team: Grim Kebab · 2nd of 3").
 *
 * BATCHED: two queries for the whole list however many competitions are in it, and none for a
 * signed-out viewer or one with nothing entered. (1) every counted participant of the competitions
 * asked about, with the roster seat that tells which rows are the viewer's; (2) the teams or racing
 * clans those competitions are split into, only when one of them is a team or clan-vs-clan week.
 *
 * NO SECOND RANKING. The place is lib/weeklyPlace `viewerPlace` over `computeLeaderboard`, the same
 * pair the competition page uses; a team's or clan's place is `groupStandingsFromRows`, the very
 * function `buildGroupStandings` calls for the page's standings table. tests/viewer-weekly-
 * standings.test.ts holds a row's place equal to the page's, on a fixture.
 *
 * VISIBILITY, as the page applies it: an opted-out entrant is off the board (countsTowardLeaderboard),
 * so has no place; a clan-vs-clan week is readable only when every racing clan's privacy lets this
 * viewer in, and until that is known it shows no place. `readable` is how a caller that has already
 * asked (lib/weeklyCards does, once per clan-vs-clan card) says so for free; without it, a week with
 * a private clan racing in it names nothing, never a private partner's numbers.
 */
export async function viewerWeeklyStandings(
  person: { playerId: number | null },
  competitionIds: number[],
  opts: { readable?: ReadonlySet<number> } = {},
): Promise<Map<number, WeeklyViewer>> {
  const out = new Map<number, WeeklyViewer>();
  const { playerId } = person;
  if (playerId == null || competitionIds.length === 0) return out;

  // clan-scope: global -- the viewer's own entries in the listed competitions, which the caller took from a clan-scoped list; the roster join only says which rows are theirs.
  const rows = await db
    .select({
      competitionId: weeklyParticipants.competitionId,
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      gainAt: weeklyParticipants.gainAt,
      teamId: weeklyParticipants.teamId,
      clanId: weeklyParticipants.clanId,
      clanMemberId: weeklyParticipants.clanMemberId,
      seatPlayerId: clanRoster.playerId,
      seatClanId: clanRoster.clanId,
      seatLeftAt: clanRoster.leftAt,
      seatKind: clanRoster.kind,
      mode: weeklyCompetitions.mode,
      hostClanId: weeklyCompetitions.clanId,
      type: weeklyCompetitions.type,
      hunt: weeklyCompetitions.hunt,
      startDate: weeklyCompetitions.startDate,
      endDate: weeklyCompetitions.endDate,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyParticipants.competitionId))
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(and(inArray(weeklyParticipants.competitionId, competitionIds), countsTowardLeaderboard()));

  const byComp = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byComp.get(r.competitionId);
    if (list) list.push(r);
    else byComp.set(r.competitionId, [r]);
  }

  // The viewer's rows, as the page's `viewerMemberIds` reads them: a live member or guest seat of
  // theirs, in the clan the competition belongs to (any racing clan, for clan vs clan).
  const mineOf = (list: typeof rows) =>
    list.filter(
      (r) =>
        r.seatPlayerId === playerId &&
        r.seatLeftAt == null &&
        r.seatKind !== 'event' &&
        (competitionMode(r.mode) === 'clans' || r.seatClanId === r.hostClanId),
    );
  const entered = [...byComp].filter(([, list]) => mineOf(list).length > 0);
  if (entered.length === 0) return out;

  // The groups the team and clan weeks are split into: one read for all of them.
  const wantGroups = entered.filter(([, l]) => competitionMode(l[0].mode) !== 'solo');
  const teamIds = wantGroups.filter(([, l]) => competitionMode(l[0].mode) === 'teams').map(([id]) => id);
  const clanIds = wantGroups.filter(([, l]) => competitionMode(l[0].mode) === 'clans').map(([id]) => id);
  const parts = [
    teamIds.length
      ? db
          .select({
            competitionId: weeklyCompetitionTeams.competitionId,
            groupId: weeklyCompetitionTeams.id,
            name: weeklyCompetitionTeams.name,
            slug: sql<string | null>`null::text`.as('slug'),
            visibility: sql<string | null>`null::text`.as('visibility'),
            sort: weeklyCompetitionTeams.sortOrder,
          })
          .from(weeklyCompetitionTeams)
          .where(inArray(weeklyCompetitionTeams.competitionId, teamIds))
      : null,
    clanIds.length
      ? db
          .select({
            competitionId: weeklyCompetitions.id,
            groupId: clans.id,
            name: clans.name,
            slug: sql<string | null>`${clans.slug}`.as('slug'),
            visibility: sql<string | null>`${clans.visibility}`.as('visibility'),
            sort: sql<number>`-1`.as('sort'),
          })
          .from(weeklyCompetitions)
          .innerJoin(clans, eq(clans.id, weeklyCompetitions.clanId))
          .where(inArray(weeklyCompetitions.id, clanIds))
      : null,
    clanIds.length
      ? db
          .select({
            competitionId: weeklyCompetitionClans.competitionId,
            groupId: clans.id,
            name: clans.name,
            slug: sql<string | null>`${clans.slug}`.as('slug'),
            visibility: sql<string | null>`${clans.visibility}`.as('visibility'),
            sort: weeklyCompetitionClans.id,
          })
          .from(weeklyCompetitionClans)
          .innerJoin(clans, eq(clans.id, weeklyCompetitionClans.clanId))
          .where(and(inArray(weeklyCompetitionClans.competitionId, clanIds), eq(weeklyCompetitionClans.status, 'accepted')))
      : null,
  ].filter((q): q is NonNullable<typeof q> => q != null);
  // The three selects share one shape; Drizzle's union typing is too strict to see it across tables.
  type GroupRow = { competitionId: number; groupId: number; name: string; slug: string | null; visibility: string | null; sort: number };
  const [first, second, ...rest] = parts;
  const groupRows: GroupRow[] = !first
    ? []
    : !second
      ? await first
      : ((await unionAll(first as never, second as never, ...(rest as never[]))) as GroupRow[]);
  const groupsOf = new Map<number, typeof groupRows>();
  for (const g of [...groupRows].sort((a, b) => a.sort - b.sort || a.groupId - b.groupId)) {
    const list = groupsOf.get(g.competitionId);
    if (list) list.push(g);
    else groupsOf.set(g.competitionId, [g]);
  }

  for (const [id, list] of entered) {
    const mine = mineOf(list);
    const mode = competitionMode(list[0].mode);
    const groups = groupsOf.get(id) ?? [];
    // A clan-vs-clan week names players of every racing clan: the page refuses it unless every one
    // lets this viewer in. Known readable (the caller asked), or every clan public; otherwise no place.
    if (mode === 'clans' && !opts.readable?.has(id) && groups.some((g) => clanVisibilityOf(g.visibility) !== 'public')) continue;

    // An item hunt places by its drops (lib/itemHuntDb), everything else by the gain.
    const board = list[0].type === 'hunt' ? await competitionBoard({ id, type: 'hunt', hunt: list[0].hunt, startDate: list[0].startDate, endDate: list[0].endDate }, list) : computeLeaderboard(list);
    const place = viewerPlace(board, new Set(mine.map((r) => r.rsn)));
    const personStanding: PersonStanding | null = place
      ? { rank: place.rank, total: place.total, scored: place.gained > 0, behind: place.behind?.amount ?? null, lead: place.lead }
      : null;

    let side: SideStanding | null = null;
    if (mode !== 'solo') {
      const defs: GroupDef[] = groups.map((g, i) => ({ key: g.groupId, name: g.name, colour: mode === 'clans' ? teamColour(null, i) : null }));
      const standings = groupStandingsFromRows(
        { clanId: list[0].hostClanId, mode: list[0].mode },
        list,
        defs,
        { memberIds: mine.map((r) => r.clanMemberId).filter((m): m is number => m != null) },
      );
      const mineGroup = standings?.groups.find((g) => g.isYours);
      if (standings && mineGroup) {
        side = {
          kind: mode === 'clans' ? 'clan' : 'team',
          name: mineGroup.name,
          rank: mineGroup.rank,
          of: standings.groups.length,
          // A place means something once there is more than one side and this one has scored.
          scored: standings.groups.length > 1 && mineGroup.total > 0,
          clearLead: standings.groups.length > 1 && mineGroup.rank === 1 && mineGroup.total > (standings.groups[1]?.total ?? 0),
        };
      }
    }
    if (personStanding || side) out.set(id, { person: personStanding, side });
  }
  return out;
}
