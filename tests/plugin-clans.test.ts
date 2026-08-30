// The clan switcher's data, which is the thing that makes one token usable in several clans.
//
// `resolvePluginClan` already picks a clan when the address names none, and it picks well — but it
// picks SILENTLY. This list is what lets the plugin show the member the choice and then address a
// clan outright. So the properties worth pinning are the ones a dropdown would get wrong: a seat
// somebody left is not a clan they can switch to, a suspended clan is not one either, two seats in
// one clan are one row and not two, and the board reported per clan is the same board a request to
// that clan would resolve to.
//
// Run: npx tsx --test tests/plugin-clans.test.ts

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-clans');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let pluginClansFor: typeof import('../src/lib/pluginClans.ts')['pluginClansFor'];

let userId: number;
let personId: number;
let accountId: number;
let alpha: number;
let bravo: number;

const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

async function seat(clanId: number, kind: string, joinedAt?: string) {
  const [row] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId, kind, source: 'roster', ...(joinedAt ? { joinedAt } : {}) })
    .returning();
  return row.id;
}

/** A board this seat is drafted onto. `optional` tiles are bonus and must stay out of the tallies. */
async function board(
  clanId: number,
  seatId: number,
  name: string,
  opts: { startDays: number; endDays: number; scored: number; done: number; optional?: number; points?: boolean } ,
) {
  const [ev] = await db
    .insert(s.events)
    .values({
      clanId,
      name,
      startDate: iso(opts.startDays),
      endDate: iso(opts.endDays),
      boardSize: 25,
      ...(opts.points ? { scoringMode: 'points' } : {}),
    })
    .returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Reds', color: '#c33' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ev.id, clanMemberId: seatId, teamId: team.id, name: 'Probe' });

  const madeTiles = [];
  for (let i = 0; i < opts.scored; i++) {
    const [t] = await db
      .insert(s.tiles)
      .values({ eventId: ev.id, label: `Tile ${i}`, position: i, points: opts.points ? 5 : 1 })
      .returning();
    madeTiles.push(t);
  }
  for (let i = 0; i < (opts.optional ?? 0); i++) {
    await db
      .insert(s.tiles)
      .values({ eventId: ev.id, label: `Bonus ${i}`, position: 100 + i, points: opts.points ? 5 : 1, optional: 1 })
      .returning();
  }
  for (let i = 0; i < opts.done; i++) {
    await db.insert(s.completions).values({ teamId: team.id, tileId: madeTiles[i].id });
  }
  return ev.id;
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  db = loaded.db;
  s = loaded.schema;
  ({ pluginClansFor } = await import('../src/lib/pluginClans.ts'));
});

beforeEach(async () => {
  await db.delete(s.completions);
  await db.delete(s.tiles);
  await db.delete(s.eventParticipants);
  await db.delete(s.teams);
  await db.delete(s.events);
  await db.delete(s.clanMemberships);
  await db.delete(s.accounts);
  await db.delete(s.users);
  await db.delete(s.players);
  await db.delete(s.clans);

  const made = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' },
      { slug: 'bravo', name: 'Bravo', inGameName: 'Bravo CC' },
    ])
    .returning();
  [alpha, bravo] = made.map((c) => c.id);

  const [person] = await db.insert(s.players).values({ displayName: 'Probe' }).returning();
  personId = person.id;
  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Probe', discordId: 'disc-clans', pluginToken: 'clans-token', playerId: person.id })
    .returning();
  userId = u.id;
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Probe', rsnNormalized: 'probe' })
    .returning();
  accountId = acct.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('no seats anywhere is an empty list, not an error', async () => {
  assert.deepEqual(await pluginClansFor(userId), []);
});

test('a login with no person resolves to nothing rather than everyone', async () => {
  assert.deepEqual(await pluginClansFor(null), []);
  // A user id nobody holds must not fall back to an unfiltered read.
  assert.deepEqual(await pluginClansFor(999_999), []);
});

test('both seats appear, newest first, carrying their standing', async () => {
  await seat(alpha, 'member', '2026-01-01 00:00:00');
  await seat(bravo, 'guest', '2026-06-01 00:00:00');

  const rows = await pluginClansFor(userId);
  assert.deepEqual(
    rows.map((r) => [r.slug, r.kind]),
    [
      ['bravo', 'guest'],
      ['alpha', 'member'],
    ],
  );
});

test('a seat you left is not a clan you can switch to', async () => {
  const gone = await seat(alpha, 'member');
  await seat(bravo, 'guest');
  await db
    .update(s.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where((await import('drizzle-orm')).eq(s.clanMemberships.id, gone));

  const rows = await pluginClansFor(userId);
  assert.deepEqual(rows.map((r) => r.slug), ['bravo']);
});

test('a suspended clan is not offered — picking it would 404 the member', async () => {
  await seat(alpha, 'member');
  await seat(bravo, 'guest');
  const { eq } = await import('drizzle-orm');
  await db.update(s.clans).set({ status: 'suspended' }).where(eq(s.clans.id, bravo));

  const rows = await pluginClansFor(userId);
  assert.deepEqual(rows.map((r) => r.slug), ['alpha']);
});

test('a main and an alt in one clan are one row, and the membership outranks the guest pass', async () => {
  // Two OSRS accounts, one person, both on Alpha's roster — the alt let in as a guest first, the
  // main a full member. The clan is the switchable thing, not the seat, so this is ONE dropdown row.
  const [alt] = await db
    .insert(s.accounts)
    .values({ playerId: personId, rsn: 'Probe Alt', rsnNormalized: 'probe alt' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: alpha, accountId: alt.id, kind: 'guest', source: 'application', joinedAt: '2026-01-01 00:00:00' });
  await seat(alpha, 'member', '2026-02-01 00:00:00');

  const rows = await pluginClansFor(userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'member');
});

test('the live board is reported per clan, with optional tiles left out', async () => {
  const a = await seat(alpha, 'member');
  const b = await seat(bravo, 'guest');
  await board(alpha, a, 'Alpha Bingo', { startDays: -1, endDays: 7, scored: 10, done: 3, optional: 4 });
  await board(bravo, b, 'Bravo Bingo', { startDays: -2, endDays: 7, scored: 5, done: 5 });

  const rows = await pluginClansFor(userId);
  const byslug = Object.fromEntries(rows.map((r) => [r.slug, r]));
  assert.deepEqual(byslug.alpha.live, {
    kind: 'bingo',
    eventId: byslug.alpha.live!.eventId,
    eventName: 'Alpha Bingo',
    tilesComplete: 3,
    tilesTotal: 10,
    pointsScored: false,
  });
  assert.ok(byslug.alpha.live!.eventId > 0, 'the id is what dedups a co-hosted board');
  assert.equal(byslug.bravo.live?.tilesComplete, 5);
});

test('a points board reports points, not tile counts', async () => {
  const a = await seat(alpha, 'member');
  await board(alpha, a, 'Leagues', { startDays: -1, endDays: 7, scored: 4, done: 2, points: true });

  const [row] = await pluginClansFor(userId);
  assert.deepEqual(row.live, {
    kind: 'bingo',
    eventId: row.live!.eventId,
    eventName: 'Leagues',
    tilesComplete: 10,
    tilesTotal: 20,
    pointsScored: true,
  });
});

test('an event that has not started yet is not what you are playing', async () => {
  const a = await seat(alpha, 'member');
  await board(alpha, a, 'Next month', { startDays: 14, endDays: 30, scored: 9, done: 0 });

  const [row] = await pluginClansFor(userId);
  assert.equal(row.live, null, 'an upcoming board must not read as live');
});

test('a finished event is not live either', async () => {
  const a = await seat(alpha, 'member');
  await board(alpha, a, 'Last month', { startDays: -30, endDays: -2, scored: 9, done: 9 });

  const [row] = await pluginClansFor(userId);
  assert.equal(row.live, null);
});

test('two live boards in one clan: the freshest start wins, as everywhere else', async () => {
  const a = await seat(alpha, 'member');
  await board(alpha, a, 'Older', { startDays: -10, endDays: 7, scored: 4, done: 1 });
  await board(alpha, a, 'Newer', { startDays: -1, endDays: 7, scored: 4, done: 2 });

  const [row] = await pluginClansFor(userId);
  assert.equal(row.live?.eventName, 'Newer');
});

test("somebody else's seat is never in your list", async () => {
  await seat(alpha, 'member');

  const [otherPerson] = await db.insert(s.players).values({ displayName: 'Other' }).returning();
  const [otherUser] = await db
    .insert(s.users)
    .values({ displayName: 'Other', discordId: 'disc-other', pluginToken: 'other-token', playerId: otherPerson.id })
    .returning();
  const [otherAcct] = await db
    .insert(s.accounts)
    .values({ playerId: otherPerson.id, rsn: 'Other', rsnNormalized: 'other' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: bravo, accountId: otherAcct.id, kind: 'member', source: 'roster' });

  assert.deepEqual((await pluginClansFor(userId)).map((r) => r.slug), ['alpha']);
  assert.deepEqual((await pluginClansFor(otherUser.id)).map((r) => r.slug), ['bravo']);
});

test('a co-hosted board appears under both clans, carrying the SAME event id', async () => {
  // One event, two hosts, one person seated in each. The client has to be able to tell this from two
  // separate boards, and the name cannot tell it — the id can.
  const a = await seat(alpha, 'member');
  const b = await seat(bravo, 'guest');
  const eventId = await board(alpha, a, 'Cross-Clan Cup', { startDays: -1, endDays: 7, scored: 6, done: 2 });
  const { eq } = await import('drizzle-orm');
  const [team] = await db.select().from(s.teams).where(eq(s.teams.eventId, eventId));
  await db.insert(s.eventParticipants).values({ eventId, clanMemberId: b, teamId: team.id, name: 'Probe' });

  const rows = await pluginClansFor(userId);
  const byslug = Object.fromEntries(rows.map((r) => [r.slug, r]));
  assert.equal(byslug.alpha.live?.eventId, eventId);
  assert.equal(byslug.bravo.live?.eventId, eventId, 'same board, so the same id under both clans');
});

// ── A competition is something running too ────────────────────────────────────────────────────
//
// Reported from the field: a clan with an active Skill of the Week read as "Nothing live". It was —
// this only ever looked at bingo boards, and SOTW/BOTW live in their own table.

async function weekly(clanId: number, title: string, status = 'active') {
  const [w] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'skill',
      metric: 'slayer',
      title,
      startDate: iso(-1),
      endDate: iso(6),
      status,
    })
    .returning();
  return w.id;
}

test('an active SOTW is live, even with no board running', async () => {
  await seat(alpha, 'member');
  const id = await weekly(alpha, 'Slayer SOTW');

  const [row] = await pluginClansFor(userId);
  assert.deepEqual(row.live, {
    kind: 'weekly',
    eventId: id,
    eventName: 'Slayer SOTW',
    tilesComplete: 0,
    tilesTotal: 0,
    pointsScored: false,
  });
});

test('a board outranks a competition when both are running', async () => {
  const a = await seat(alpha, 'member');
  await board(alpha, a, 'Summer Bingo', { startDays: -1, endDays: 7, scored: 5, done: 1 });
  await weekly(alpha, 'Slayer SOTW');

  const [row] = await pluginClansFor(userId);
  assert.equal(row.live?.kind, 'bingo', 'the board is the richer thing and what "playing" means');
  assert.equal(row.live?.eventName, 'Summer Bingo');
});

test('a finished or upcoming competition is not live', async () => {
  await seat(alpha, 'member');
  await weekly(alpha, 'Last week', 'completed');
  await weekly(alpha, 'Next week', 'upcoming');

  const [row] = await pluginClansFor(userId);
  assert.equal(row.live, null);
});

test("another clan's competition is not yours", async () => {
  await seat(alpha, 'member');
  await weekly(bravo, 'Their SOTW');

  const [row] = await pluginClansFor(userId);
  assert.equal(row.live, null, 'no seat in bravo, and alpha has nothing running');
});

test('a weekly id and a board id may collide, which is why the kind is part of the identity', async () => {
  // Two tables, two id sequences. A client deduping a merged list on the id alone would fold these
  // two unrelated things into one.
  const a = await seat(alpha, 'member');
  const b = await seat(bravo, 'guest');
  const boardId = await board(alpha, a, 'Summer Bingo', { startDays: -1, endDays: 7, scored: 5, done: 1 });
  const weeklyId = await weekly(bravo, 'Slayer SOTW');

  const rows = await pluginClansFor(userId);
  const byslug = Object.fromEntries(rows.map((r) => [r.slug, r]));
  assert.equal(byslug.alpha.live?.kind, 'bingo');
  assert.equal(byslug.bravo.live?.kind, 'weekly');
  // The ids are free to be equal; the pair never is.
  assert.notEqual(
    `${byslug.alpha.live?.kind}:${boardId}`,
    `${byslug.bravo.live?.kind}:${weeklyId}`,
  );
});
