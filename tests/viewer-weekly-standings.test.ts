// The events page's and the clan home's "where do I stand" line on a weekly row
// (lib/viewerWeeklyStandings), against a real database.
//
// The row must say what the weekly page says: the same place, the same gap, the same team or clan
// place, because both come out of the same functions. So every competition here is read twice, once
// the way the page reads it (buildCompetitionView + buildGroupStandings, the viewer's seats from
// viewerMemberIds) and once by the batched lookup, and the numbers are compared. It also holds the
// query budget (at most two for all of it, none for a signed-out viewer or one with nothing
// entered) and the visibility rules (opted out, a private partner clan, nothing scored).
//
// Run: npx tsx --test tests/viewer-weekly-standings.test.ts   (needs TEST_DATABASE_URL, default the local dev container)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('viewer-weekly-standings');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let W: typeof import('../src/lib/viewerWeeklyStandings.ts');
let V: typeof import('../src/lib/competitionView.ts');
let T: typeof import('../src/lib/competitionTeamsDb.ts');
let R: typeof import('../src/lib/competitionRows.ts');

let hostClan: number;
const comp: Record<string, number> = {};
const viewer = { playerId: 0, userId: 0 };

async function counting<T>(run: () => Promise<T>): Promise<{ result: T; queries: number }> {
  const original = pool.query;
  let queries = 0;
  (pool as { query: unknown }).query = function (this: unknown, ...args: unknown[]) {
    queries += 1;
    return (original as (...a: unknown[]) => unknown).apply(this, args);
  };
  try {
    return { result: await run(), queries };
  } finally {
    (pool as { query: unknown }).query = original;
  }
}

async function mkComp(clanId: number, mode: string, title: string, over: Record<string, unknown> = {}) {
  const [c] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'boss',
      metric: 'zulrah',
      title,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T00:00:00.000Z',
      status: 'active',
      mode,
      ...over,
    })
    .returning();
  return c;
}

/** A roster seat for a new person in a clan; returns the seat id. */
async function seat(clanId: number, rsn: string, playerId?: number) {
  const pid = playerId ?? (await db.insert(s.players).values({ displayName: rsn }).returning())[0].id;
  const [acc] = await db.insert(s.accounts).values({ playerId: pid, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
  const [m] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: acc.id, kind: 'member' })
    .returning();
  return { seatId: m.id, playerId: pid };
}

async function enter(
  competitionId: number,
  clanId: number,
  seatId: number,
  rsn: string,
  gain: number,
  extra: { teamId?: number | null; clanOfSide?: number | null; optedOut?: boolean } = {},
) {
  await db.insert(s.weeklyParticipants).values({
    competitionId,
    clanMemberId: seatId,
    clanId: extra.clanOfSide ?? null,
    teamId: extra.teamId ?? null,
    rsn,
    rsnNormalized: rsn.toLowerCase(),
    baselineValue: 100,
    currentValue: 100 + gain,
    gainAt: gain > 0 ? '2026-11-05T10:00:00Z' : null,
    optedOut: extra.optedOut ? true : false,
  });
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  W = await import('../src/lib/viewerWeeklyStandings.ts');
  V = await import('../src/lib/competitionView.ts');
  T = await import('../src/lib/competitionTeamsDb.ts');
  R = await import('../src/lib/competitionRows.ts');

  const [host, guest, hush] = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Iron Host', visibility: 'public' },
      { slug: 'guest', name: 'Guest Clan', visibility: 'public' },
      { slug: 'hush', name: 'Hush Clan', visibility: 'members' },
    ])
    .returning();
  hostClan = host.id;

  const me = await seat(host.id, 'Max Main');
  viewer.playerId = me.playerId;
  const [u] = await db.insert(s.users).values({ displayName: 'Max', playerId: me.playerId }).returning();
  viewer.userId = u.id;

  // Seven others in the host clan, one in each other clan.
  const others: { seatId: number; rsn: string }[] = [];
  for (const rsn of ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay', 'Gil']) others.push({ ...(await seat(host.id, rsn)), rsn });
  const guestSeat = { ...(await seat(guest.id, 'Gwen')), rsn: 'Gwen' };
  const guestSeat2 = { ...(await seat(guest.id, 'Gus')), rsn: 'Gus' };
  const hushSeat = { ...(await seat(hush.id, 'Hazel')), rsn: 'Hazel' };

  // SOLO: Ann 90, Bob 70, Max 60 (3rd, 10 behind Bob), Cat 20, Dan 5.
  const solo = await mkComp(host.id, 'solo', 'Solo');
  comp.solo = solo.id;
  await enter(solo.id, host.id, others[0].seatId, 'Ann', 90);
  await enter(solo.id, host.id, others[1].seatId, 'Bob', 70);
  await enter(solo.id, host.id, me.seatId, 'Max Main', 60);
  await enter(solo.id, host.id, others[2].seatId, 'Cat', 20);
  await enter(solo.id, host.id, others[3].seatId, 'Dan', 5);

  // LEADING: the viewer is first, 12 ahead.
  const lead = await mkComp(host.id, 'solo', 'Leading');
  comp.lead = lead.id;
  await enter(lead.id, host.id, me.seatId, 'Max Main', 50);
  await enter(lead.id, host.id, others[0].seatId, 'Ann', 38);
  await enter(lead.id, host.id, others[1].seatId, 'Bob', 4);

  // NOT SCORED: entered, nothing gained yet.
  const quiet = await mkComp(host.id, 'solo', 'Quiet');
  comp.quiet = quiet.id;
  await enter(quiet.id, host.id, me.seatId, 'Max Main', 0);
  await enter(quiet.id, host.id, others[0].seatId, 'Ann', 3);

  // OPTED OUT: off the board, so no place.
  const out = await mkComp(host.id, 'solo', 'Opted out');
  comp.out = out.id;
  await enter(out.id, host.id, me.seatId, 'Max Main', 40, { optedOut: true });
  await enter(out.id, host.id, others[0].seatId, 'Ann', 3);

  // TEAMS: Red (Ann 90 + Bob 70), Max's team Blue (Max 60 + Cat 20 = 80), Green (Dan 5). Blue is 2nd of 3.
  const teams = await mkComp(host.id, 'teams', 'Teams');
  comp.teams = teams.id;
  const [red, blue, green] = await db
    .insert(s.weeklyCompetitionTeams)
    .values([
      { competitionId: teams.id, name: 'Red Raiders', sortOrder: 0 },
      { competitionId: teams.id, name: 'Blue Barrels', sortOrder: 1 },
      { competitionId: teams.id, name: 'Green Gang', sortOrder: 2 },
    ])
    .returning();
  await enter(teams.id, host.id, others[0].seatId, 'Ann', 90, { teamId: red.id });
  await enter(teams.id, host.id, others[1].seatId, 'Bob', 70, { teamId: red.id });
  await enter(teams.id, host.id, me.seatId, 'Max Main', 60, { teamId: blue.id });
  await enter(teams.id, host.id, others[2].seatId, 'Cat', 20, { teamId: blue.id });
  await enter(teams.id, host.id, others[3].seatId, 'Dan', 5, { teamId: green.id });

  // CLAN VS CLAN, both public: the host (Max 60 + Ann 10) beats the guest (Gwen 30 + Gus 20).
  const cvc = await mkComp(host.id, 'clans', 'Clan vs clan');
  comp.cvc = cvc.id;
  await db.insert(s.weeklyCompetitionClans).values({ competitionId: cvc.id, clanId: guest.id, status: 'accepted' });
  await enter(cvc.id, host.id, me.seatId, 'Max Main', 60);
  await enter(cvc.id, host.id, others[0].seatId, 'Ann', 10);
  await enter(cvc.id, guest.id, guestSeat.seatId, 'Gwen', 30, { clanOfSide: guest.id });
  await enter(cvc.id, guest.id, guestSeat2.seatId, 'Gus', 20, { clanOfSide: guest.id });

  // CLAN VS CLAN with a private partner: the page refuses it to a viewer outside that clan.
  const priv = await mkComp(host.id, 'clans', 'Private partner');
  comp.priv = priv.id;
  await db.insert(s.weeklyCompetitionClans).values({ competitionId: priv.id, clanId: hush.id, status: 'accepted' });
  await enter(priv.id, host.id, me.seatId, 'Max Main', 60);
  await enter(priv.id, hush.id, hushSeat.seatId, 'Hazel', 99, { clanOfSide: hush.id });

  // Someone who is in none of it.
  await seat(host.id, 'Stranger');
  void guestSeat; void guestSeat2; void hushSeat;
  void eq;
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

const ALL = () => [comp.solo, comp.lead, comp.quiet, comp.out, comp.teams, comp.cvc, comp.priv];

/** The weekly page's own reading for the viewer. */
async function pageReads(id: number) {
  const [c] = await db.select().from(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.id, id));
  const memberIds = await V.viewerMemberIds(hostClan, { playerId: viewer.playerId });
  const view = await V.buildCompetitionView(c, memberIds);
  const groups = await T.buildGroupStandings(c, { memberIds });
  return { view, groups };
}

test('a solo week: the row has the page\'s place, field and gap, in the page\'s unit', async () => {
  const got = (await W.viewerWeeklyStandings(viewer, ALL())).get(comp.solo)!;
  const { view } = await pageReads(comp.solo);
  assert.equal(got.person?.rank, view.me?.rank);
  assert.equal(got.person?.total, view.entries.length);
  assert.equal(got.person?.behind, view.me?.behind?.amount);
  assert.equal(got.side, null);
  assert.equal(R.weeklyRow(week(comp.solo), got).standing, 'You: #3 of 5 · 10 KC behind #2');
});

test('first place says how far ahead; a week they have not scored in says nothing', async () => {
  const all = await W.viewerWeeklyStandings(viewer, ALL());
  const { view } = await pageReads(comp.lead);
  assert.equal(all.get(comp.lead)!.person?.rank, view.me?.rank);
  assert.equal(R.weeklyRow(week(comp.lead), all.get(comp.lead)).standing, 'You’re leading by 12 KC');
  assert.equal(R.weeklyRow(week(comp.quiet), all.get(comp.quiet)).standing, null);
});

test('an opted-out entrant is off the board, so the row gives no place', async () => {
  const all = await W.viewerWeeklyStandings(viewer, ALL());
  assert.equal(all.has(comp.out), false);
  const { view } = await pageReads(comp.out);
  assert.equal(view.me, null);
});

test('a team week names their team and its place, the page\'s group standings', async () => {
  const got = (await W.viewerWeeklyStandings(viewer, ALL())).get(comp.teams)!;
  const { groups, view } = await pageReads(comp.teams);
  const mine = groups!.groups.find((g) => g.isYours)!;
  assert.equal(got.side?.name, mine.name);
  assert.equal(got.side?.rank, mine.rank);
  assert.equal(got.side?.of, groups!.groups.length);
  assert.equal(got.person?.rank, view.me?.rank);
  assert.equal(R.weeklyRow(week(comp.teams), got).yours, 'Your team: Blue Barrels · 2nd of 3');
});

test('a clan-vs-clan week names their clan and says leading when it is ahead', async () => {
  const got = (await W.viewerWeeklyStandings(viewer, ALL())).get(comp.cvc)!;
  const { groups } = await pageReads(comp.cvc);
  const mine = groups!.groups.find((g) => g.isYours)!;
  assert.equal(got.side?.name, mine.name);
  assert.equal(got.side?.rank, mine.rank);
  assert.equal(R.weeklyRow(week(comp.cvc), got).yours, 'Your clan: Iron Host · leading');
});

test('a private partner clan keeps the row dark, unless the caller already knows the viewer may read it', async () => {
  const dark = await W.viewerWeeklyStandings(viewer, ALL());
  assert.equal(dark.has(comp.priv), false, 'never a private partner\'s numbers');
  const lit = await W.viewerWeeklyStandings(viewer, ALL(), { readable: new Set([comp.priv]) });
  assert.equal(lit.has(comp.priv), true);
});

test('two queries for every week at once; none signed out, none with nothing entered', async () => {
  const withAll = await counting(() => W.viewerWeeklyStandings(viewer, ALL()));
  assert.ok(withAll.queries <= 2, `asked ${withAll.queries}`);
  const soloOnly = await counting(() => W.viewerWeeklyStandings(viewer, [comp.solo, comp.lead]));
  assert.equal(soloOnly.queries, 1);
  assert.equal((await counting(() => W.viewerWeeklyStandings({ playerId: null }, ALL()))).queries, 0);
  assert.equal((await counting(() => W.viewerWeeklyStandings(viewer, []))).queries, 0);
  const stranger = (await db.select().from(s.players).where(eq(s.players.displayName, 'Stranger')))[0];
  const none = await counting(() => W.viewerWeeklyStandings({ playerId: stranger.id }, ALL()));
  assert.equal(none.result.size, 0);
  assert.ok(none.queries <= 2);
});

function week(id: number): import('../src/lib/competitionRows.ts').WeeklyRowInput {
  return {
    id,
    kind: 'botw',
    name: 'Week',
    metricLabel: 'Zulrah',
    iconUrl: null,
    state: 'live',
    startDate: '2026-11-01 00:00:00',
    endDate: '2026-11-30 00:00:00',
    entrants: 5,
    unit: 'KC',
    top: null,
  };
}
