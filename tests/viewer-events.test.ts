// The events page's "You're in" lookup (lib/viewerEvents), against a real database.
//
// It is the batched form of lib/standingsAccess `viewerTeamIds`: one call for every listed event
// in at most three queries, where the per-event function costs several reads per event. The two
// must agree on who is "on a team" (a player by any of their characters, a captain, a team-staff
// seat), so this fixture has each of those plus an alt on another team, and asserts the same team
// ids from both, event by event.
//
// Run: npx tsx --test tests/viewer-events.test.ts   (needs TEST_DATABASE_URL, default the local dev container)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('viewer-events');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/standingsAccess.ts');
let V: typeof import('../src/lib/viewerEvents.ts');

const ev: Record<string, number> = {};
const team: Record<string, number> = {};
const people: Record<string, { userId: number; playerId: number }> = {};
let listed: number[] = [];
let upcoming: number[] = [];

/** Count the statements a call sends: every Drizzle query goes through the pool. */
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

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/standingsAccess.ts');
  V = await import('../src/lib/viewerEvents.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Forge' }).returning();
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const mkEvent = async (key: string, name: string) => {
    const [e] = await db.insert(s.events).values({ clanId: clan.id, name, boardSize: 25, endDate: soon }).returning();
    ev[key] = e.id;
  };
  await mkEvent('running', 'Running');
  await mkEvent('next', 'Next');
  await mkEvent('signupOnly', 'Sign-up only');
  await mkEvent('nothing', 'Nothing of theirs');
  await mkEvent('unlisted', 'Not on the page');
  listed = [ev.running, ev.next, ev.signupOnly, ev.nothing];
  upcoming = [ev.next, ev.signupOnly];

  const mkTeam = async (key: string, eventKey: string, name: string) => {
    const [t] = await db.insert(s.teams).values({ eventId: ev[eventKey], name, color: '#888888' }).returning();
    team[key] = t.id;
  };
  await mkTeam('red', 'running', 'Red');
  await mkTeam('blue', 'running', 'Blue');
  await mkTeam('green', 'running', 'Green');
  await mkTeam('gold', 'next', 'Gold');
  await mkTeam('silver', 'next', 'Silver');
  await mkTeam('bronze', 'next', 'Bronze');
  await mkTeam('stray', 'unlisted', 'Stray');

  const person = async (name: string) => {
    const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
    const [u] = await db.insert(s.users).values({ displayName: name, playerId: pl.id }).returning();
    people[name] = { userId: u.id, playerId: pl.id };
    return { pl, u };
  };
  const character = async (playerId: number, rsn: string, leftAt: string | null = null) => {
    const [acc] = await db.insert(s.accounts).values({ playerId, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acc.id, kind: 'member', leftAt }).returning();
    return { accountId: acc.id, seatId: seat.id };
  };

  // The viewer: a main and an alt.
  const { pl: max, u: maxUser } = await person('max');
  const main = await character(max.id, 'Max Main');
  const alt = await character(max.id, 'Max Alt');
  // Running: the main plays on Red (by seat), the alt on Blue (by account alone, the seat link gone).
  await db.insert(s.eventParticipants).values({ eventId: ev.running, name: 'Max Main', teamId: team.red, clanMemberId: main.seatId, accountId: main.accountId });
  await db.insert(s.eventParticipants).values({ eventId: ev.running, name: 'Max Alt', teamId: team.blue, clanMemberId: null, accountId: alt.accountId });
  // Next: captain of Gold, a team-staff seat on Silver, and a sign-up.
  await db.update(s.teams).set({ captainUserId: maxUser.id }).where(eq(s.teams.id, team.gold));
  await db.insert(s.teamStaff).values({ teamId: team.silver, userId: maxUser.id });
  await db.insert(s.eventSignups).values({ eventId: ev.next, userId: maxUser.id, clanMemberId: main.seatId, status: 'approved' });
  // Signed up, no team yet.
  await db.insert(s.eventSignups).values({ eventId: ev.signupOnly, userId: maxUser.id, clanMemberId: main.seatId, status: 'pending' });
  // An event the page does not list.
  await db.insert(s.eventParticipants).values({ eventId: ev.unlisted, name: 'Max Main', teamId: team.stray, clanMemberId: main.seatId, accountId: main.accountId });

  // Somebody else: on Green and captain of Bronze. None of it is the viewer's.
  const { pl: other, u: otherUser } = await person('other');
  const theirs = await character(other.id, 'Other One');
  await db.insert(s.eventParticipants).values({ eventId: ev.running, name: 'Other One', teamId: team.green, clanMemberId: theirs.seatId, accountId: theirs.accountId });
  await db.update(s.teams).set({ captainUserId: otherUser.id }).where(eq(s.teams.id, team.bronze));

  // A withdrawn sign-up is not a sign-up.
  const { pl: gone, u: goneUser } = await person('withdrawn');
  const goneSeat = await character(gone.id, 'Gone Again');
  await db.insert(s.eventSignups).values({ eventId: ev.signupOnly, userId: goneUser.id, clanMemberId: goneSeat.seatId, status: 'withdrawn' });

  await person('stranger');
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

test('the batched lookup names the same teams as viewerTeamIds, event by event', async () => {
  for (const name of ['max', 'other', 'withdrawn', 'stranger']) {
    const who = people[name];
    const batched = await V.viewerEventEntries(who, listed, upcoming);
    for (const id of listed) {
      assert.deepEqual(
        sorted(batched.get(id)?.teamIds ?? []),
        sorted(await A.viewerTeamIds(id, who)),
        `${name}, event ${id}`,
      );
    }
  }
});

test('player, alt, captain and team-staff seat all count; names come with them', async () => {
  const mine = await V.viewerEventEntries(people.max, listed, upcoming);
  assert.deepEqual(sorted(mine.get(ev.running)!.teamIds), sorted([team.red, team.blue]), 'main on Red, alt on Blue');
  assert.deepEqual(mine.get(ev.running)!.teamNames, ['Blue', 'Red']);
  assert.equal(mine.get(ev.running)!.signedUp, false);
  assert.deepEqual(sorted(mine.get(ev.next)!.teamIds), sorted([team.gold, team.silver]), 'captain of Gold, staff seat on Silver');
  assert.deepEqual(mine.get(ev.next)!.teamNames, ['Gold', 'Silver']);
  assert.equal(mine.get(ev.next)!.signedUp, true);
  assert.deepEqual(mine.get(ev.signupOnly), { teamIds: [], teamNames: [], signedUp: true });
  assert.equal(mine.has(ev.nothing), false);
  assert.equal(mine.has(ev.unlisted), false, 'an event the page does not list is not asked about');
});

test('only the userId, or only the playerId, still finds its half', async () => {
  const asUser = await V.viewerEventEntries({ userId: people.max.userId, playerId: null }, listed, upcoming);
  assert.equal(asUser.has(ev.running), false);
  assert.deepEqual(sorted(asUser.get(ev.next)!.teamIds), sorted([team.gold, team.silver]));
  const asPlayer = await V.viewerEventEntries({ userId: null, playerId: people.max.playerId }, listed, upcoming);
  assert.deepEqual(sorted(asPlayer.get(ev.running)!.teamIds), sorted([team.red, team.blue]));
  assert.equal(asPlayer.has(ev.next), false);
  for (const id of listed) {
    assert.deepEqual(sorted(asUser.get(id)?.teamIds ?? []), sorted(await A.viewerTeamIds(id, { userId: people.max.userId, playerId: null })));
    assert.deepEqual(sorted(asPlayer.get(id)?.teamIds ?? []), sorted(await A.viewerTeamIds(id, { userId: null, playerId: people.max.playerId })));
  }
});

test('a seat that left the clan stops counting, in both', async () => {
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'leaver' }).returning();
  const [acc] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'Leaver', rsnNormalized: 'leaver' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: 1, accountId: acc.id, kind: 'member' }).returning();
  // Seat-only row (no account on it), so the seat is the only link.
  await db.insert(s.eventParticipants).values({ eventId: ev.running, name: 'Leaver', teamId: team.green, clanMemberId: seat.id, accountId: null });
  const who = { userId: null, playerId: pl.id };
  assert.deepEqual((await V.viewerEventEntries(who, listed, upcoming)).get(ev.running)?.teamIds, [team.green]);
  await db.update(s.clanMemberships).set({ leftAt: '2026-01-01 00:00:00' }).where(eq(s.clanMemberships.id, seat.id));
  assert.equal((await V.viewerEventEntries(who, listed, upcoming)).has(ev.running), false);
  assert.deepEqual(await A.viewerTeamIds(ev.running, who), []);
});

test('at most three queries however many events are listed; none when signed out or nothing is listed', async () => {
  const full = await counting(() => V.viewerEventEntries(people.max, listed, upcoming));
  assert.equal(full.queries, 3);
  assert.equal(full.result.size, 3);
  const many = [...listed, ...Array.from({ length: 200 }, (_, i) => 10_000 + i)];
  assert.equal((await counting(() => V.viewerEventEntries(people.max, many, many))).queries, 3);
  assert.equal((await counting(() => V.viewerEventEntries(people.max, listed, []))).queries, 2, 'no upcoming events: no sign-up read');
  assert.equal((await counting(() => V.viewerEventEntries({ userId: null, playerId: null }, listed, upcoming))).queries, 0);
  assert.equal((await counting(() => V.viewerEventEntries(people.max, [], []))).queries, 0);

  // What it replaced, for the same viewer and the same four events.
  const perEvent = await counting(async () => {
    for (const id of listed) await A.viewerTeamIds(id, people.max);
  });
  assert.ok(perEvent.queries > 3 * 3, `per-event lookup sent ${perEvent.queries}`);
  console.log(`# queries: batched ${full.queries}, per-event viewerTeamIds over ${listed.length} events ${perEvent.queries}`);
});
