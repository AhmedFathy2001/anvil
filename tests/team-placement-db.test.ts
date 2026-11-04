// Team placement against a real database (lib/teamPlacementDb): the rush of a streamer's sign-up
// link must leave teams balanced, solo must give everyone their own team, an invite link must beat
// placement, and a drafted board must behave exactly as it always has.
//
// Run: TEST_DATABASE_URL=postgres://… npm run test:placement

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('team-placement');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let TP: typeof import('../src/lib/teamPlacementDb.ts');
let clanId: number;
let tokenN = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  TP = await import('../src/lib/teamPlacementDb.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'streamer', name: 'Streamer Clan' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

type Seat = { seatId: number; accountId: number; rsn: string };

/** `n` people, each with one character holding a member seat in the host clan. */
async function people(prefix: string, n: number, accountsEach = 1): Promise<Seat[][]> {
  const out: Seat[][] = [];
  for (let i = 0; i < n; i++) {
    const [person] = await db.insert(s.players).values({ displayName: `${prefix}${i}` }).returning();
    const seats: Seat[] = [];
    for (let j = 0; j < accountsEach; j++) {
      const rsn = `${prefix}${i}${j ? `alt${j}` : ''}`;
      const [acct] = await db.insert(s.accounts).values({ playerId: person.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
      const [seat] = await db
        .insert(s.clanMemberships)
        .values({ clanId, accountId: acct.id, kind: j === 0 ? 'member' : 'guest', source: 'roster' })
        .returning();
      seats.push({ seatId: seat.id, accountId: acct.id, rsn });
    }
    out.push(seats);
  }
  return out;
}

async function makeEvent(values: Partial<typeof s.events.$inferInsert>) {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Stream Bingo', boardSize: 5, ...values }).returning();
  return ev;
}

function seat(ev: Awaited<ReturnType<typeof makeEvent>>, accounts: Seat[], extra: { inviteTeamId?: number | null; pickTeamId?: number | null } = {}) {
  return TP.seatSignupAccounts({
    event: ev,
    accounts,
    primarySeatId: accounts[0].seatId,
    inviteTeamId: extra.inviteTeamId ?? null,
    pickTeamId: extra.pickTeamId ?? null,
    timezone: null,
    now: new Date().toISOString(),
    newPlayerToken: () => `tok-${++tokenN}`,
  });
}

async function sizes(eventId: number) {
  return (await TP.teamLoads(eventId)).map((t) => ({ name: t.name, size: t.size }));
}

test('an event made without a placement keeps the draft pool (the migration default)', async () => {
  const ev = await makeEvent({});
  assert.equal(ev.teamPlacement, 'draft');
  assert.equal(ev.teamCount, null);
  assert.equal(ev.teamCap, null);
});

test('draft: sign-ups land in the pool and no teams are made — unchanged', async () => {
  const ev = await makeEvent({});
  const crowd = await people('drafty', 5);
  for (const p of crowd) assert.deepEqual(await seat(ev, p), { ok: true, teamId: null });
  assert.equal((await TP.teamLoads(ev.id)).length, 0);
  const rows = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, ev.id));
  assert.equal(rows.length, 5);
  assert.ok(rows.every((r) => r.teamId == null));
});

test('auto: 40 sign-ups at once stay balanced across the host’s 4 teams', async () => {
  const ev = await makeEvent({ teamPlacement: 'auto', teamCount: 4 });
  const crowd = await people('rush', 40);
  const results = await Promise.all(crowd.map((p) => seat(ev, p)));
  assert.ok(results.every((r) => r.ok && r.teamId != null));

  const board = await sizes(ev.id);
  assert.equal(board.length, 4, 'exactly the host’s count — no duplicate "Team 1" from a race');
  assert.deepEqual(board.map((t) => t.name), ['Team 1', 'Team 2', 'Team 3', 'Team 4']);
  const counts = board.map((t) => t.size);
  assert.equal(counts.reduce((a, b) => a + b, 0), 40);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `sizes ${counts.join(',')}`);
  const teams = await db.select().from(s.teams).where(eq(s.teams.eventId, ev.id));
  assert.equal(new Set(teams.map((t) => t.color)).size, 4, 'distinct colours');
});

test('auto: a second rush onto a board with uneven host-built teams evens them out, moving nobody', async () => {
  const ev = await makeEvent({ teamPlacement: 'auto' });
  const [red, blue] = await db
    .insert(s.teams)
    .values([
      { eventId: ev.id, name: 'Red', color: '#f00' },
      { eventId: ev.id, name: 'Blue', color: '#00f' },
    ])
    .returning();
  const early = await people('early', 6);
  for (const p of early) {
    await db.insert(s.eventParticipants).values({ eventId: ev.id, clanMemberId: p[0].seatId, accountId: p[0].accountId, name: p[0].rsn, teamId: red.id });
  }
  const crowd = await people('late', 10);
  await Promise.all(crowd.map((p) => seat(ev, p)));
  const board = await sizes(ev.id);
  assert.equal(board.length, 2, 'no count set → the host’s teams are the target');
  assert.deepEqual(board.map((t) => t.size), [8, 8]);
  // The six already on Red are still on Red.
  const reds = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.teamId, red.id));
  assert.equal(reds.filter((r) => r.name.startsWith('early')).length, 6);
  assert.ok(blue.id > 0);
});

test('auto: a person’s second account joins their first account’s team', async () => {
  const ev = await makeEvent({ teamPlacement: 'auto', teamCount: 3 });
  await Promise.all((await people('solo-ish', 2)).map((p) => seat(ev, p)));
  const [duo] = await people('duo', 1, 2);
  const r = await seat(ev, duo);
  assert.ok(r.ok && r.teamId != null);
  const rows = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, ev.id));
  const theirs = rows.filter((x) => x.name.startsWith('duo'));
  assert.equal(theirs.length, 2);
  assert.equal(theirs[0].teamId, theirs[1].teamId);
});

test('solo: every player gets their own team named after their character, even all at once', async () => {
  const ev = await makeEvent({ teamPlacement: 'solo' });
  const crowd = await people('lone', 15);
  const results = await Promise.all(crowd.map((p) => seat(ev, p)));
  const teamIds = results.map((r) => (r.ok ? r.teamId : null));
  assert.equal(new Set(teamIds).size, 15, 'one team each');
  const board = await sizes(ev.id);
  assert.equal(board.length, 15);
  assert.ok(board.every((t) => t.size === 1));
  assert.deepEqual(board.map((t) => t.name).sort(), crowd.map((p) => p[0].rsn).sort());
  // Signing up again changes nothing.
  const again = await seat(ev, crowd[0]);
  assert.equal(again.ok && again.teamId, teamIds[0]);
  assert.equal((await TP.teamLoads(ev.id)).length, 15);
});

test('an invite link wins over placement', async () => {
  const ev = await makeEvent({ teamPlacement: 'auto', teamCount: 2 });
  await Promise.all((await people('pre', 4)).map((p) => seat(ev, p)));
  const board = await TP.teamLoads(ev.id);
  // Load Team 1 so balancing would never choose it, then invite somebody onto it.
  await Promise.all((await people('pad', 1)).map((p) => seat(ev, p)));
  const heavy = (await TP.teamLoads(ev.id)).sort((a, b) => b.size - a.size)[0];
  const [guest] = await people('invited', 1);
  const r = await seat(ev, guest, { inviteTeamId: heavy.id });
  assert.deepEqual(r, { ok: true, teamId: heavy.id });
  assert.equal(board.length, 2);

  // A solo board too: the invited player joins that team instead of getting their own.
  const soloEv = await makeEvent({ teamPlacement: 'solo' });
  const [host] = await people('streamer', 1);
  const first = await seat(soloEv, host);
  const [buddy] = await people('buddy', 1);
  const viaLink = await seat(soloEv, buddy, { inviteTeamId: first.ok ? first.teamId : null });
  assert.equal(viaLink.ok && viaLink.teamId, first.ok && first.teamId);
  assert.equal((await TP.teamLoads(soloEv.id)).length, 1);
});

test('pick: players go straight onto the team they chose, and a capped team refuses the extra one under a rush', async () => {
  const ev = await makeEvent({ teamPlacement: 'pick', teamCap: 3 });
  const [red, blue] = await db
    .insert(s.teams)
    .values([
      { eventId: ev.id, name: 'Red', color: '#f00' },
      { eventId: ev.id, name: 'Blue', color: '#00f' },
    ])
    .returning();
  const crowd = await people('picker', 5);
  const results = await Promise.all(crowd.map((p) => seat(ev, p, { pickTeamId: red.id })));
  assert.equal(results.filter((r) => r.ok).length, 3);
  assert.equal(results.filter((r) => !r.ok && r.reason === 'full').length, 2);
  assert.deepEqual(await sizes(ev.id), [
    { name: 'Red', size: 3 },
    { name: 'Blue', size: 0 },
  ]);

  // A refused player picks Blue instead.
  const refused = crowd[results.findIndex((r) => !r.ok)];
  assert.deepEqual(await seat(ev, refused, { pickTeamId: blue.id }), { ok: true, teamId: blue.id });

  // Before the start, switching is allowed while there is room — and refused when there is not.
  const onRed = crowd[results.findIndex((r) => r.ok)];
  assert.deepEqual(await seat(ev, onRed, { pickTeamId: blue.id }), { ok: true, teamId: blue.id });
  assert.deepEqual(await sizes(ev.id), [
    { name: 'Red', size: 2 },
    { name: 'Blue', size: 2 },
  ]);
});

test('pick: with no team chosen (no teams built yet) they wait in the pool', async () => {
  const ev = await makeEvent({ teamPlacement: 'pick' });
  const [p] = await people('early-bird', 1);
  assert.deepEqual(await seat(ev, p), { ok: true, teamId: null });
});

test('a pool player is placed when the board later switches to auto', async () => {
  const ev = await makeEvent({});
  const [p] = await people('switcher', 1);
  await seat(ev, p);
  await db.update(s.events).set({ teamPlacement: 'auto', teamCount: 2 }).where(eq(s.events.id, ev.id));
  const [now] = await db.select().from(s.events).where(eq(s.events.id, ev.id));
  const r = await seat(now, p);
  assert.ok(r.ok && r.teamId != null);
  assert.equal((await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, ev.id))).length, 1);
});
