import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

// lib/eventCards scores every card with two GROUP BYs instead of reading the clan's whole history
// into JS. That is only safe while the aggregate agrees with the rules: a completion on a tile that
// has NOT been revealed yet must not score, and a mission tile is hidden until it is announced —
// judgements that live in lib/eventRules, not in SQL. These tests pin the boards where "just sum
// the completions" is the wrong answer, because the failure would be silent: every card still
// renders, with a leader who is winning by tiles nobody can see.
//
// Seeds through Drizzle rather than SQL strings. The original seeded with hand-written INSERTs,
// which is exactly why it was the one suite the Postgres port broke — the assertions were portable,
// the fixture was not. See tests/helpers/testDb.
//
// Run: npm run test:cards

const DB = useTestDatabase('event-cards');

const NOW = new Date('2026-08-15T12:00:00Z');
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString();

let loadEventCards: typeof import('../src/lib/eventCards.ts')['loadEventCards'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ loadEventCards } = await import('../src/lib/eventCards.ts'));

  // Four boards, all finished, all with completions on tiles that must not count.
  //   1 classic points board — everything visible, the plain aggregate case
  //   2 showdown (reveal policy) — half its tiles never revealed
  //   3 classic + missions — one mission announced, one still hidden
  //   4 tile-count board — scoring is per tile, not per point, and awardedPoints must be ignored
  // Every clan-scoped table needs an owning clan now.
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'cards', name: 'Cards Clan' })
    .returning({ id: s.clans.id });
  const clanId = clan!.id;

  await db.insert(s.events).values([
    { id: 1, clanId, name: 'Plain points', boardSize: 5, createdAt: day(-30), startDate: day(-20), endDate: day(-10), scoringMode: 'points', format: 'bingo', rules: null },
    { id: 2, clanId, name: 'Showdown', boardSize: 5, createdAt: day(-30), startDate: day(-20), endDate: day(-10), scoringMode: 'points', format: 'bingo', rules: '{"revealPolicy":"scheduled"}' },
    { id: 3, clanId, name: 'Missions', boardSize: 5, createdAt: day(-30), startDate: day(-20), endDate: day(-10), scoringMode: 'points', format: 'bingo', rules: '{"mission":{"policy":"manual"}}' },
    { id: 4, clanId, name: 'Tile count', boardSize: 5, createdAt: day(-30), startDate: day(-20), endDate: day(-10), scoringMode: 'tiles', format: 'bingo', rules: null },
  ]);

  await db.insert(s.teams).values(
    [1, 2, 3, 4].flatMap((e) => [
      { id: e * 10 + 1, eventId: e, name: 'Alpha', color: '#d0553f' },
      { id: e * 10 + 2, eventId: e, name: 'Beta', color: '#4aa3d4' },
    ]),
  );

  await db.insert(s.tiles).values([
    // event 1: three 10-point tiles + one optional 50-pointer.
    { id: 101, eventId: 1, position: 0, label: 'a', points: 10, optional: 0 },
    { id: 102, eventId: 1, position: 1, label: 'b', points: 10, optional: 0 },
    { id: 103, eventId: 1, position: 2, label: 'c', points: 10, optional: 0 },
    { id: 104, eventId: 1, position: 3, label: 'opt', points: 50, optional: 1 },
    // event 2: two revealed 10s, two never-revealed 10s.
    { id: 201, eventId: 2, position: 0, label: 'shown', points: 10, revealedAt: day(-18) },
    { id: 202, eventId: 2, position: 1, label: 'shown', points: 10, revealedAt: day(-18) },
    { id: 203, eventId: 2, position: 2, label: 'hidden', points: 10, revealedAt: null },
    { id: 204, eventId: 2, position: 3, label: 'hidden', points: 10, revealedAt: null },
    // event 3: classic board plus two missions, one announced.
    { id: 301, eventId: 3, position: 0, label: 'board', points: 10 },
    { id: 302, eventId: 3, position: 1, label: 'announced', points: 25, mission: 1, revealedAt: day(-14) },
    { id: 303, eventId: 3, position: 2, label: 'quiet', points: 25, mission: 1, revealedAt: null },
    // event 4: tile-scored.
    { id: 401, eventId: 4, position: 0, label: 'a', points: 10 },
    { id: 402, eventId: 4, position: 1, label: 'b', points: 10 },
  ]);

  await db.insert(s.completions).values([
    // Alpha claims two (20), Beta one (10). The optional 50-pointer is claimed but off-board.
    { teamId: 11, tileId: 101, completedAt: day(-15) },
    { teamId: 11, tileId: 102, completedAt: day(-15) },
    { teamId: 12, tileId: 103, completedAt: day(-15) },
    { teamId: 11, tileId: 104, completedAt: day(-15) },
    // Alpha claimed one revealed and one hidden — only the revealed one scores, so Alpha is on 10.
    { teamId: 21, tileId: 201, completedAt: day(-15) },
    { teamId: 21, tileId: 203, completedAt: day(-15) },
    // A completion on the un-announced mission must not score.
    { teamId: 31, tileId: 301, completedAt: day(-13) },
    { teamId: 31, tileId: 302, completedAt: day(-13) },
    { teamId: 31, tileId: 303, completedAt: day(-13) },
    // awardedPoints is set on one completion and must be ignored — a tile is worth one tile.
    { teamId: 41, tileId: 401, completedAt: day(-13), awardedPoints: 99 },
    { teamId: 41, tileId: 402, completedAt: day(-13) },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const card = async (id: number) => {
  const cards = await loadEventCards({ includeUpcoming: true }, NOW);
  const found = cards.find((c) => c.id === id);
  assert.ok(found, `no card for event ${id}`);
  return found;
};

test('points board: the leader is summed from the board, optional tiles excluded', async () => {
  const c = await card(1);
  assert.equal(c.top?.name, 'Alpha');
  assert.equal(c.top?.score, 20);
  // 30, not 80: the optional 50-pointer is not part of the board.
  assert.equal(c.top?.total, 30);
  assert.equal(c.top?.unit, 'pts');
});

test('points board: the claimed chip counts optional tiles too', async () => {
  const c = await card(1);
  assert.ok(c.chips.includes('4 claimed'), `chips were ${JSON.stringify(c.chips)}`);
});

test('reveal policy: a completion on an unrevealed tile does not score', async () => {
  const c = await card(2);
  // Alpha claimed two tiles worth 10 each; one was never revealed.
  assert.equal(c.top?.score, 10);
  // The denominator is still the WHOLE board, hidden tiles included — otherwise a reveal board
  // reads as nearly finished the moment it starts.
  assert.equal(c.top?.total, 40);
});

test('reveal policy: hidden claims still count toward the claimed chip', async () => {
  const c = await card(2);
  assert.ok(c.chips.includes('2 claimed'), `chips were ${JSON.stringify(c.chips)}`);
});

test('missions: an un-announced mission does not score, an announced one does', async () => {
  const c = await card(3);
  // 10 (board tile) + 25 (announced mission); the quiet mission's 25 is not counted.
  assert.equal(c.top?.score, 35);
});

test('tile-scored board: awardedPoints is ignored, a tile is worth one tile', async () => {
  const c = await card(4);
  assert.equal(c.top?.score, 2);
  assert.equal(c.top?.unit, 'tiles');
  assert.equal(c.top?.total, 2);
});

test('a team with no completions never becomes the leader', async () => {
  const c = await card(4);
  assert.equal(c.top?.name, 'Alpha');
});

test('pastLimit caps finished events without touching live ones', async () => {
  const all = await loadEventCards({ includeUpcoming: true }, NOW);
  const capped = await loadEventCards({ includeUpcoming: true, pastLimit: 2 }, NOW);
  assert.equal(all.length, 4);
  assert.equal(capped.length, 2);
  // Same derivation either way — paging must not change what a card says.
  const first = all.find((c) => c.id === capped[0].id);
  assert.deepEqual(capped[0], first);
});
