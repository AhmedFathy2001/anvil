// Staff & roles → "Boards…": the per-person board picker, against a real database.
//
// The picker diffed a clan's checkbox list against EVERY board grant the person held, on any clan, and
// revoked whatever was not ticked — so saving it in one clan silently took away the boards other
// clans had handed them. Reads and writes are now scoped to the clan doing the saving.
//
// Run: node --import tsx --test tests/board-grant-scope.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('board-grant-scope');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let lib: typeof import('../src/lib/eventEditors.ts');

let alpha: number;
let bravo: number;
let alphaBoards: number[];
let bravoBoard: number;
let person: number;
let admin: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  lib = await import('../src/lib/eventEditors.ts');

  const [a, b] = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'bravo', name: 'Bravo' },
    ])
    .returning();
  alpha = a.id;
  bravo = b.id;
  const evs = await db
    .insert(s.events)
    .values([
      { clanId: alpha, name: 'Alpha One', boardSize: 5 },
      { clanId: alpha, name: 'Alpha Two', boardSize: 5 },
      { clanId: bravo, name: 'Bravo One', boardSize: 5 },
    ])
    .returning();
  alphaBoards = [evs[0].id, evs[1].id];
  bravoBoard = evs[2].id;
  const users = await db
    .insert(s.users)
    .values([
      { displayName: 'Builder', discordId: '970000000000000001' },
      { displayName: 'Admin', discordId: '970000000000000002' },
    ])
    .returning();
  person = users[0].id;
  admin = users[1].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('saving one clan’s picker leaves another clan’s grant alone', async () => {
  const { db, schema: s } = await loadDb();
  // Bravo hands them a board; Alpha then picks one of its own.
  await lib.grantEventEditor(bravoBoard, person, admin, 'editor');
  await lib.setUserAssignedEvents(alpha, person, [alphaBoards[0]], admin);

  assert.deepEqual(await lib.assignedEventIdsForUser(person, 'editor', alpha), [alphaBoards[0]]);
  assert.deepEqual(await lib.assignedEventIdsForUser(person, 'editor', bravo), [bravoBoard], 'bravo’s grant survives');

  // Alpha clears its picker entirely: still only Alpha's grants go.
  await lib.setUserAssignedEvents(alpha, person, [], admin);
  assert.deepEqual(await lib.assignedEventIdsForUser(person, 'editor', alpha), []);
  assert.deepEqual(await lib.assignedEventIdsForUser(person, 'editor', bravo), [bravoBoard]);

  // And the scoped editor role Alpha gave them is taken back — a grant in Bravo is no reason to keep
  // a door open in Alpha.
  const alphaRow = await db.query.clanStaff.findFirst({
    where: and(eq(s.clanStaff.clanId, alpha), eq(s.clanStaff.userId, person)),
  });
  assert.equal(alphaRow?.role, 'member');
  const bravoRow = await db.query.clanStaff.findFirst({
    where: and(eq(s.clanStaff.clanId, bravo), eq(s.clanStaff.userId, person)),
  });
  assert.equal(bravoRow?.role, 'editor', 'bravo’s scoped editor is untouched');
});

test('the unscoped read still lists every grant, for callers that filter themselves', async () => {
  await lib.grantEventEditor(alphaBoards[1], person, admin, 'treasurer');
  const all = await lib.assignedEventIdsForUser(person);
  assert.deepEqual(new Set(all), new Set([bravoBoard, alphaBoards[1]]));
  assert.deepEqual(await lib.assignedEventIdsForUser(person, 'treasurer', alpha), [alphaBoards[1]]);
  assert.deepEqual(await lib.assignedEventIdsForUser(person, 'editor', alpha), [], 'a treasurer grant is not a board to build');
});
