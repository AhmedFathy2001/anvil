// The lab's emulation tools: test users, teams and roles on a lab board, your role in the lab clan,
// and viewing the site as a test user — which must never reach a real person.
//
// Run: npx tsx --test tests/lab-emulation.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('lab-emulation');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let C: typeof import('../src/lib/labCast.ts');
let T: typeof import('../src/lib/labTeams.ts');
let L: typeof import('../src/lib/lab.ts');
let staffId = 0;
let realId = 0;
let mainAccount = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  C = await import('../src/lib/labCast.ts');
  T = await import('../src/lib/labTeams.ts');
  L = await import('../src/lib/lab.ts');
  const [p] = await db.insert(s.players).values({ displayName: 'Staffer' }).returning();
  const [u] = await db.insert(s.users).values({ displayName: 'Staffer', discordId: 'd-staff', playerId: p.id, platformRole: 'staff' }).returning();
  staffId = u.id;
  const [acc] = await db.insert(s.accounts).values({ playerId: p.id, rsn: 'Staff Main', rsnNormalized: 'staff main' }).returning();
  mainAccount = acc.id;
  const [q] = await db.insert(s.players).values({ displayName: 'Real' }).returning();
  const [r] = await db.insert(s.users).values({ displayName: 'Real Person', discordId: '123456789', playerId: q.id }).returning();
  realId = r.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('test user names are always Lab~ plus letters and digits', () => {
  assert.equal(C.testUserName('captain 2!'), 'Lab~Captain2');
  assert.equal(C.testUserName('Lab~red1'), 'Lab~Red1');
  assert.equal(C.testUserName('~~~'), null);
  assert.ok(C.testUserName('averyveryverylongname')!.length <= 12);
});

test('viewing as: only a fresh, signed grant from current staff, and only onto a test user', async () => {
  const tester = await C.ensureTestUser(staffId, 'Viewer');
  assert.ok(tester);
  const ok = await A.labViewAsTarget(A.signLabViewAs(staffId, tester!.userId), staffId);
  assert.equal(ok?.id, tester!.userId);

  assert.equal(await A.labViewAsTarget(A.signLabViewAs(staffId, realId), staffId), null, 'never a real person');
  assert.equal(await A.labViewAsTarget(A.signLabViewAs(staffId, tester!.userId), realId), null, 'signed for someone else’s session');
  const signed = A.signLabViewAs(staffId, tester!.userId);
  const tampered = signed.slice(0, -1) + (signed.endsWith('0') ? '1' : '0');
  assert.equal(await A.labViewAsTarget(tampered, staffId), null, 'tampered');
  assert.equal(await A.labViewAsTarget('garbage', staffId), null);

  await db.update(s.users).set({ platformRole: 'none' }).where(eq(s.users.id, staffId));
  assert.equal(await A.labViewAsTarget(A.signLabViewAs(staffId, tester!.userId), staffId), null, 'no longer staff, no longer allowed');
  await db.update(s.users).set({ platformRole: 'staff' }).where(eq(s.users.id, staffId));
});

test('your lab clan role sticks, even through starting a new session', async () => {
  await C.setLabClanRole(staffId, 'moderator');
  assert.equal(await C.labClanRole(staffId), 'moderator');
  await C.setLabClanRole(staffId, 'member');
  await L.createLabSession(staffId, { name: 'x', hours: 1, boardSize: 1, accounts: [{ accountId: mainAccount, name: 'Staff Main' }] });
  assert.equal(await C.labClanRole(staffId), 'member', 'starting a session did not make you admin again');
  await C.setLabClanRole(staffId, 'admin');
});

test('teams: add a side of test players, move your character, and take a role', async () => {
  const eventId = await L.createLabSession(staffId, { name: 'Teams', hours: 1, boardSize: 1, accounts: [{ accountId: mainAccount, name: 'Staff Main' }] });
  const red = await T.addLabTeam(staffId, eventId, 3);
  let view = await T.labTeams(eventId, staffId);
  const redTeam = view.teams.find((t) => t.id === red)!;
  assert.equal(redTeam.name, 'Red');
  assert.deepEqual(redTeam.members.map((m) => m.name), ['Lab~Red1', 'Lab~Red2', 'Lab~Red3']);
  assert.ok(redTeam.members.every((m) => m.test));

  const mine = view.teams.flatMap((t) => t.members).find((m) => !m.test)!;
  assert.ok(await T.moveLabParticipant(eventId, mine.participantId, red));
  assert.ok(await T.setLabTeamRole(eventId, staffId, red, 'captain'));
  view = await T.labTeams(eventId, staffId);
  assert.ok(view.teams.find((t) => t.id === red)!.youCaptain);
  assert.ok(view.teams.find((t) => t.id === red)!.members.some((m) => m.participantId === mine.participantId));

  assert.ok(await T.setLabTeamRole(eventId, staffId, red, 'staff'));
  view = await T.labTeams(eventId, staffId);
  assert.ok(!view.teams.find((t) => t.id === red)!.youCaptain && view.teams.find((t) => t.id === red)!.youStaff);

  assert.ok(await T.moveLabParticipant(eventId, mine.participantId, null));
  view = await T.labTeams(eventId, staffId);
  assert.ok(view.unplaced.some((m) => m.participantId === mine.participantId), 'on no team');
});

test('a lab board’s controls never reach another board', async () => {
  const a = await L.createLabSession(staffId, { name: 'A', hours: 1, boardSize: 1, accounts: [{ accountId: mainAccount, name: 'Staff Main' }] });
  const b = await L.createLabSession(staffId, { name: 'B', hours: 1, boardSize: 1, accounts: [{ accountId: mainAccount, name: 'Staff Main' }] });
  const teamOfB = await T.addLabTeam(staffId, b, 0);
  const [pa] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, a));
  assert.equal(await T.moveLabParticipant(a, pa.id, teamOfB), false);
  assert.equal(await T.setLabTeamRole(a, staffId, teamOfB, 'captain'), false);
});
