// The Anvil library's rules, end to end against a real database:
//   - an imported task FOLLOWS Anvil: an Anvil save rewrites it;
//   - the clan's first edit forks it, and the next Anvil save becomes an offer instead;
//   - "take" brings Anvil's version back and follows again, "keep" stops asking until the next change;
//   - importing twice never duplicates;
//   - an approved task suggestion is applied like a staff edit (and so reaches followers);
//   - only Anvil boards take suggestions; a community board is published from an event's real tiles.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('anvil-library');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let T: typeof import('../src/lib/libraryTasks.ts');
let L: typeof import('../src/lib/tileLibrary.ts');
let P: typeof import('../src/lib/libraryProposals.ts');
let B: typeof import('../src/lib/libraryBoards.ts');
let clanA: number;
let clanB: number;
let staff: number;
let member: number;
let taskId: number;

const zenyte = { tileType: 'drop', items: [{ name: 'Zenyte shard', count: 1 }] };

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  T = await import('../src/lib/libraryTasks.ts');
  L = await import('../src/lib/tileLibrary.ts');
  P = await import('../src/lib/libraryProposals.ts');
  B = await import('../src/lib/libraryBoards.ts');
  const cs = await db.insert(s.clans).values([{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }]).returning();
  clanA = cs[0].id;
  clanB = cs[1].id;
  const us = await db
    .insert(s.users)
    .values([
      { discordId: '1', displayName: 'Staff' },
      { discordId: '2', displayName: 'Member' },
    ])
    .returning();
  staff = us[0].id;
  member = us[1].id;
  const t = await T.saveAnvilTask(null, { label: 'Zenyte shard', points: 450, category: 'Slayer', config: zenyte }, staff);
  taskId = t.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function copyOf(clanId: number) {
  const { db, schema: s } = await loadDb();
  const [row] = await db
    .select()
    .from(s.tileLibrary)
    .where(and(eq(s.tileLibrary.clanId, clanId), eq(s.tileLibrary.sourceTaskId, taskId)));
  return row;
}

test('importing twice copies once, and the copy follows', async () => {
  assert.equal(await T.importAnvilTasks(clanA, [taskId], member), 1);
  assert.equal(await T.importAnvilTasks(clanA, [taskId], member), 0);
  await T.importAnvilTasks(clanB, [taskId], member);
  const row = await copyOf(clanA);
  assert.equal(row.followsSource, true);
  assert.equal(row.points, 450);
});

test('an Anvil save rewrites every following copy', async () => {
  await T.saveAnvilTask(taskId, { label: 'Zenyte shard', points: 500, category: 'Slayer', config: zenyte }, staff);
  assert.equal((await copyOf(clanA)).points, 500);
  assert.equal((await copyOf(clanB)).points, 500);
});

test('the clan’s first edit forks its copy; the next Anvil save is an offer, not an overwrite', async () => {
  const a = await copyOf(clanA);
  await L.updateTask(clanA, a.id, { points: 600 });
  assert.equal((await copyOf(clanA)).followsSource, false);

  await T.saveAnvilTask(taskId, { label: 'Zenyte shard', points: 550, category: 'Slayer', config: zenyte }, staff);
  assert.equal((await copyOf(clanA)).points, 600, 'forked copy untouched');
  assert.equal((await copyOf(clanB)).points, 550, 'follower updated');

  const offers = await T.taskOffers(clanA);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].task.points, 550);
  assert.equal((await T.taskOffers(clanB)).length, 0, 'a follower has nothing to be offered');
});

test('keep stops asking; take brings Anvil back and follows again', async () => {
  const a = await copyOf(clanA);
  await T.answerOffer(clanA, a.id, 'keep');
  assert.equal((await T.taskOffers(clanA)).length, 0);
  assert.equal((await copyOf(clanA)).points, 600);

  await T.saveAnvilTask(taskId, { label: 'Zenyte shard', points: 575, category: 'Slayer', config: zenyte }, staff);
  assert.equal((await T.taskOffers(clanA)).length, 1, 'a newer version asks again');
  await T.answerOffer(clanA, a.id, 'take');
  const after = await copyOf(clanA);
  assert.equal(after.points, 575);
  assert.equal(after.followsSource, true);
});

test('another clan cannot answer my offers', async () => {
  const a = await copyOf(clanA);
  assert.equal(await T.answerOffer(clanB, a.id, 'take'), false);
});

test('an approved task fix is applied like a staff save, so followers get it', async () => {
  const id = await P.createProposal(member, clanB, {
    kind: 'task-edit',
    targetTaskId: taskId,
    payload: { label: 'Zenyte shard', points: 480, category: 'Slayer', config: zenyte },
    note: 'too expensive',
  });
  await P.approveProposal(id, staff, null);
  assert.equal((await copyOf(clanB)).points, 480);
  await assert.rejects(() => P.approveProposal(id, staff, null), /already been dealt with/);
});

test('a rejection needs a reason, and a new-task suggestion lands in the library once approved', async () => {
  const id = await P.createProposal(member, clanB, {
    kind: 'task-new',
    payload: { label: 'Any Godsword shard', points: 200, category: 'God Wars', config: { tileType: 'drop', requiredAmount: 1, items: [{ name: 'Godsword shard 1', count: 1 }] } },
  });
  await assert.rejects(() => P.rejectProposal(id, staff, '  '), /Say why/);
  await P.approveProposal(id, staff, 'nice');
  assert.ok((await T.listAnvilTasks()).some((t) => t.label === 'Any Godsword shard'));
});

test('community boards are published from real tiles and take no suggestions', async () => {
  const { db, schema: s } = await loadDb();
  const [ev] = await db.insert(s.events).values({ clanId: clanA, name: 'Board', boardSize: 2 }).returning();
  await db.insert(s.tiles).values([
    { eventId: ev.id, position: 0, label: 'Tile 1' },
    { eventId: ev.id, position: 1, label: 'Zenyte', tileType: 'drop', requiredAmount: 1, trackedItemIds: '[19529]' },
  ]);
  await assert.rejects(() => B.publishFromEvent(clanA, member, ev.id, { title: 'Mine' }), /at least four/);
  await db.insert(s.tiles).values(
    [2, 3, 4].map((i) => ({ eventId: ev.id, position: i, label: `Kill ${i}`, tileType: 'kill', requiredAmount: 5, targetNpcs: '["Zulrah"]' })),
  );
  const board = await B.publishFromEvent(clanA, member, ev.id, { title: 'Mine', tags: ['pvm', 'not-a-tag'], audience: 'casual' });
  assert.equal(board.tiles.length, 4, 'the untouched placeholder is left out');
  assert.deepEqual(board.tags, ['pvm']);
  assert.equal(board.origin, 'community');
  await assert.rejects(
    () => P.createProposal(member, clanB, { kind: 'board-edit', targetBoardId: board.id, payload: { meta: { title: 'Better' } } }),
    /community boards belong to their clan/,
  );
});

test('an Anvil board suggestion replaces its tiles when approved', async () => {
  const board = await B.createAnvilBoard(staff, { title: 'Anvil 2x2', mode: 'classic', boardSize: 2, tiles: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }] });
  const id = await P.createProposal(member, clanB, {
    kind: 'board-edit',
    targetBoardId: board.id,
    payload: { tiles: [{ label: 'w' }, { label: 'x' }, { label: 'y' }, { label: 'z' }] },
  });
  await P.approveProposal(id, staff, null);
  const after = await B.getBoard(board.id);
  assert.deepEqual(after?.tiles.map((t) => t.label), ['w', 'x', 'y', 'z']);
  assert.equal(after?.version, 2);
});

test('five open suggestions is the limit', async () => {
  for (let i = 0; i < 5; i++) {
    await P.createProposal(staff, null, { kind: 'task-new', payload: { label: `T${i}`, points: 1, config: { tileType: 'standard' } } });
  }
  await assert.rejects(
    () => P.createProposal(staff, null, { kind: 'task-new', payload: { label: 'one more', points: 1, config: {} } }),
    /waiting already/,
  );
});

test('a board Anvil took down leaves the library and stays marked as taken down', async () => {
  const [board] = (await B.listBoards()).filter((b) => b.origin === 'community');
  await B.setBoardStatus(board.id, 'removed');
  assert.ok(!(await B.listBoards()).some((b) => b.id === board.id), 'not offered to anyone');
  assert.equal((await B.getBoard(board.id))?.status, 'removed', 'and distinct from a clan hiding its own');
});
