// Lab sessions of every event type, big fields, simulated progress and mission controls, against a
// real database.
//
// What must hold:
//   - a session of each type stores the format, scoring and rules the real create route would, with
//     the right number of tiles; solo puts each character on its own team;
//   - the field is lab test users only (found by the login mark), dealt into teams of the asked size;
//   - "Simulate the field" credits test-player teams only, in race order on a race, and the credits
//     are marked; Clear simulated removes exactly them; Reset removes everything;
//   - mission controls drop a named mission, expire it, and keep MissionRules; "Test in lab" can keep
//     a tile's mission settings.
//
// Run: npx tsx --test tests/lab-event-types-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, inArray, like } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('lab-event-types');
const RSN = 'Lab Rat';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/lab.ts');
let F: typeof import('../src/lib/labField.ts');
let M: typeof import('../src/lib/labMissions.ts');

let userId: number;
let accountId: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  L = await import('../src/lib/lab.ts');
  F = await import('../src/lib/labField.ts');
  M = await import('../src/lib/labMissions.ts');
  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  [{ id: userId }] = await db.insert(s.users).values({ displayName: RSN, discordId: 'disc-lab', playerId: person.id }).returning();
  [{ id: accountId }] = await db.insert(s.accounts).values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase() }).returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const me = () => [{ accountId, name: RSN }];
const tilesOf = (eventId: number) => db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId)).orderBy(s.tiles.position);
const teamsOf = (eventId: number) => db.select().from(s.teams).where(eq(s.teams.eventId, eventId));

test('each event type stores the real shape', async () => {
  const race = await L.createLabSession(userId, { name: 'Race', hours: 1, boardSize: 8, accounts: me(), format: 'race' });
  let ev = (await L.labEvent(race))!;
  assert.equal(ev.format, 'tilerace');
  assert.equal(ev.scoringMode, 'tiles');
  assert.equal((await tilesOf(race)).length, 8);

  const leagues = await L.createLabSession(userId, { name: 'Leagues', hours: 1, boardSize: 40, accounts: me(), format: 'leagues' });
  ev = (await L.labEvent(leagues))!;
  assert.equal(ev.scoringMode, 'points');
  const lt = await tilesOf(leagues);
  assert.equal(lt.length, 40);
  assert.ok(lt.some((t) => t.points > 1));

  const bounty = await L.createLabSession(userId, { name: 'Bounty', hours: 1, boardSize: 5, accounts: me(), format: 'bounty' });
  ev = (await L.labEvent(bounty))!;
  assert.equal(JSON.parse(ev.rules!).revealPolicy, 'bounty');

  const showdown = await L.createLabSession(userId, { name: 'Showdown', hours: 1, boardSize: 4, accounts: me(), format: 'showdown' });
  assert.ok((await tilesOf(showdown)).every((t) => t.revealAt != null));

  const solo = await L.createLabSession(userId, { name: 'Solo', hours: 1, boardSize: 3, accounts: me(), format: 'solo' });
  ev = (await L.labEvent(solo))!;
  assert.equal(ev.teamPlacement, 'solo');
  assert.equal((await tilesOf(solo)).length, 9);
  const [team] = await teamsOf(solo);
  assert.equal(team.name, RSN, 'a solo team is named after the character');
});

test('a big field is test users only, dealt into teams of three, and the simulation marks its credits', async () => {
  const eventId = await L.createLabSession(userId, { name: 'Crowd race', hours: 1, boardSize: 10, accounts: me(), format: 'race' });
  const added = await F.addLabField(userId, eventId, { players: 90, teamSize: 3, placement: 'team' });
  assert.equal(added, 90);
  const teams = await teamsOf(eventId);
  assert.equal(teams.length, 31, 'yours plus 30 teams of 3');
  const field = await db
    .select({ discordId: s.users.discordId })
    .from(s.eventParticipants)
    .innerJoin(s.accounts, eq(s.accounts.id, s.eventParticipants.accountId))
    .innerJoin(s.users, eq(s.users.playerId, s.accounts.playerId))
    .where(and(eq(s.eventParticipants.eventId, eventId), like(s.users.discordId, 'lab-dummy-%')));
  assert.equal(field.length, 90);

  const event = (await L.labEvent(eventId))!;
  const credited = await F.simulateLabField(event, { intensity: 1, seed: 9 });
  assert.ok(credited > 0);
  const labTeam = teams.find((t) => t.name === 'Lab')!;
  const tiles = await tilesOf(eventId);
  const order = new Map(tiles.map((t, i) => [t.id, i]));
  const rows = await db.select().from(s.completions).where(inArray(s.completions.teamId, teams.map((t) => t.id)));
  assert.ok(!rows.some((r) => r.teamId === labTeam.id), 'your own team is never simulated');
  // Race order: every team holds a prefix of the track.
  const byTeam = new Map<number, number[]>();
  for (const r of rows) byTeam.set(r.teamId, [...(byTeam.get(r.teamId) ?? []), order.get(r.tileId)!]);
  for (const [, idx] of byTeam) assert.deepEqual([...idx].sort((a, b) => a - b), idx.map((_, i) => i).sort((a, b) => a - b));

  const marked = await F.simulatedCompletionIds(eventId);
  assert.equal(marked.size, rows.length);

  // A real credit for your own team survives Clear simulated.
  await db.insert(s.completions).values({ teamId: labTeam.id, tileId: tiles[0].id });
  assert.equal(await F.clearSimulatedField(eventId), rows.length);
  const left = await db.select().from(s.completions).where(inArray(s.completions.teamId, teams.map((t) => t.id)));
  assert.deepEqual(left.map((r) => r.teamId), [labTeam.id]);

  await F.simulateLabField(event, { intensity: 1, seed: 2 });
  await L.resetLabSession(eventId);
  assert.equal((await db.select().from(s.completions).where(inArray(s.completions.teamId, teams.map((t) => t.id)))).length, 0);
  assert.equal((await F.simulatedCompletionIds(eventId)).size, 0);
});

test('solo field: every test player on their own', async () => {
  const eventId = await L.createLabSession(userId, { name: 'Big solo', hours: 1, boardSize: 5, accounts: me(), format: 'solo' });
  await F.addLabField(userId, eventId, { players: 12, teamSize: 3, placement: 'solo' });
  const teams = await teamsOf(eventId);
  assert.equal(teams.length, 13);
  const people = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, eventId));
  assert.equal(new Set(people.map((p) => p.teamId)).size, 13);
});

test('mission controls: add, rules, announce now, expire now, reset', async () => {
  const eventId = await L.createLabSession(userId, { name: 'Missions', hours: 1, boardSize: 2, accounts: me(), format: 'classic' });
  let event = (await L.labEvent(eventId))!;
  const tileId = await M.addLabMission(event, 'Kill a dragon');
  event = (await L.labEvent(eventId))!;
  assert.equal(JSON.parse(event.rules!).mission.announceMode, 'manual');
  let [tile] = await db.select().from(s.tiles).where(eq(s.tiles.id, tileId));
  assert.equal(tile.mission, 1);
  assert.equal(tile.revealedAt, null);
  assert.ok(!/^Lab mission/.test(tile.label) && tile.tileType !== 'manual');
  assert.ok(tile.targetNpcs || tile.trackedItemIds || tile.timedActivity || (tile.requiredAmount ?? 0) > 1);
  const second = await M.addLabMission(event);
  const [t2] = await db.select().from(s.tiles).where(eq(s.tiles.id, second));
  const labels = (await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId))).map((t) => t.label);
  assert.ok(!/^Lab mission/.test(t2.label) && t2.tileType);
  assert.equal(new Set(labels).size, labels.length);
  await db.delete(s.tiles).where(eq(s.tiles.id, second));

  const rules = await M.setLabMissionRules(event, tileId, { lockout: true, expiryHours: 2, reward: { places: [{ points: 50, gp: 0, unfundedPoints: null }], restPoints: 0, maxClaims: 3 } });
  assert.equal(rules.reward?.maxClaims, 3);

  assert.equal(await M.announceLabMission(event, tileId), 1);
  [tile] = await db.select().from(s.tiles).where(eq(s.tiles.id, tileId));
  assert.ok(tile.revealedAt);
  await assert.rejects(M.announceLabMission(event, tileId), /already out/);

  await M.expireLabMission(event, tileId);
  [tile] = await db.select().from(s.tiles).where(eq(s.tiles.id, tileId));
  assert.ok(tile.closedAt);

  await M.resetLabMission(event, tileId, 'hidden');
  [tile] = await db.select().from(s.tiles).where(eq(s.tiles.id, tileId));
  assert.equal(tile.revealedAt, null);
  assert.equal(tile.closedAt, null);

  // Mark an ordinary tile, then unmark it.
  const [plain] = await tilesOf(eventId);
  await M.markLabMission(event, plain.id, true);
  assert.equal((await db.select().from(s.tiles).where(eq(s.tiles.id, plain.id)))[0].mission, 1);
  await M.markLabMission(event, plain.id, false);
  assert.equal((await db.select().from(s.tiles).where(eq(s.tiles.id, plain.id)))[0].mission, 0);

  await M.setMissionPolicy(event, { announceMode: 'interval', intervalMinutes: 10 });
  assert.equal(JSON.parse((await L.labEvent(eventId))!.rules!).mission.intervalMinutes, 10);
});

test('"Test in lab" keeps a mission as a mission only when asked', async () => {
  const [clan] = await db.insert(s.clans).values({ slug: 'real', name: 'Real' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Real', boardSize: 3 }).returning();
  const [source] = await db
    .insert(s.tiles)
    .values({ eventId: ev.id, position: 0, label: 'Real mission', mission: 1, rules: JSON.stringify({ lockout: true, expiryHours: 5 }), revealedAt: new Date().toISOString() })
    .returning();

  const plainId = (await L.labSessionFromTile(userId, source))!;
  const [plain] = await tilesOf(plainId);
  assert.equal(plain.mission, 0);
  assert.equal(plain.revealedAt, null);

  const keptId = (await L.labSessionFromTile(userId, source, { keepMission: true }))!;
  const [kept] = await tilesOf(keptId);
  assert.equal(kept.mission, 1);
  assert.equal(kept.revealedAt, null, 'arrives hidden');
  assert.equal(JSON.parse(kept.rules!).expiryHours, 5);
  assert.equal(JSON.parse((await L.labEvent(keptId))!.rules!).mission.announceMode, 'manual');
});

test('a full-size field fills in bulk, reuses its test users, and never adopts a real name', async () => {
  const { MAX_LAB_FIELD, fieldPlayerName } = await import('../src/lib/labPlan.ts');
  const C = await import('../src/lib/labCast.ts');
  // A REAL character already holds the 950th field name: it must be left out, never taken over.
  const [realPerson] = await db.insert(s.players).values({ displayName: 'Real' }).returning();
  await db.insert(s.accounts).values({ playerId: realPerson.id, rsn: 'Lab~Field950', rsnNormalized: 'lab~field950' });

  const usersBefore = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.discordId, 'lab-dummy-%'))).length;
  const first = await L.createLabSession(userId, { name: 'Huge', hours: 1, boardSize: 20, accounts: me(), format: 'leagues' });
  const started = Date.now();
  const added = await F.addLabField(userId, first, { players: MAX_LAB_FIELD, teamSize: 1, placement: 'solo' });
  const took = Date.now() - started;
  assert.equal(added, MAX_LAB_FIELD - 1, 'every name but the real one');
  assert.ok(took < 20_000, `bulk fill is quick (${took}ms)`);
  const people = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, first));
  assert.equal(people.length, MAX_LAB_FIELD); // the field minus one, plus your character
  assert.ok(people.some((p) => p.name === `Lab~${fieldPlayerName(MAX_LAB_FIELD)}`));
  assert.ok(!people.some((p) => p.name === 'Lab~Field950'));

  const usersMid = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.discordId, 'lab-dummy-%'))).length;
  const second = await L.createLabSession(userId, { name: 'Huge again', hours: 1, boardSize: 20, accounts: me(), format: 'leagues' });
  await F.addLabField(userId, second, { players: MAX_LAB_FIELD, teamSize: 4, placement: 'team' });
  const usersAfter = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.discordId, 'lab-dummy-%'))).length;
  assert.ok(usersMid > usersBefore);
  assert.equal(usersAfter, usersMid, 'the second fill reuses every test user');
  const reused = await C.ensureTestUsers(userId, ['Field1', 'Field950']);
  assert.deepEqual(reused.map((u) => u.rsn), ['Lab~Field1']);

  const credited = await F.simulateLabField((await L.labEvent(first))!, { intensity: 0.5, seed: 4 });
  assert.ok(credited > 0);
  assert.equal((await F.simulatedCompletionIds(first)).size, credited);
});
