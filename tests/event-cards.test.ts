import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// lib/eventCards scores every card with two GROUP BYs instead of reading the clan's whole history
// into JS. That is only safe while the aggregate agrees with the rules: a completion on a tile that
// has NOT been revealed yet must not score, and a mission tile is hidden until it is announced —
// judgements that live in lib/eventRules, not in SQL. These tests pin the boards where "just sum
// the completions" is the wrong answer, because the failure would be silent: every card still
// renders, with a leader who is winning by tiles nobody can see.
//
// DB-backed, like tests/stat-history.test.ts. Run: npm run test:cards

const DB_FILE = './.test-event-cards.db';
process.env.DATABASE_URL = `file:${DB_FILE}`;

const NOW = new Date('2026-08-15T12:00:00Z');
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString();

let loadEventCards: typeof import('../src/lib/eventCards.ts')['loadEventCards'];

before(async () => {
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-wal`, { force: true });
  rmSync(`${DB_FILE}-shm`, { force: true });
  execFileSync('node', ['scripts/migrate.mjs'], { env: { ...process.env }, stdio: 'pipe' });

  ({ loadEventCards } = await import('../src/lib/eventCards.ts'));
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url: process.env.DATABASE_URL! });

  // Four boards, all finished, all with completions on tiles that must not count.
  //   1 classic points board — everything visible, the plain aggregate case
  //   2 showdown (reveal policy) — half its tiles never revealed
  //   3 classic + missions — one mission announced, one still hidden
  //   4 tile-count board — scoring is per tile, not per point, and awardedPoints must be ignored
  const stmts = [
    `insert into events (id, name, board_size, created_at, start_date, end_date, scoring_mode, format, rules)
       values (1, 'Plain points', 5, '${day(-30)}', '${day(-20)}', '${day(-10)}', 'points', 'bingo', null)`,
    `insert into events (id, name, board_size, created_at, start_date, end_date, scoring_mode, format, rules)
       values (2, 'Showdown', 5, '${day(-30)}', '${day(-20)}', '${day(-10)}', 'points', 'bingo', '{"revealPolicy":"scheduled"}')`,
    `insert into events (id, name, board_size, created_at, start_date, end_date, scoring_mode, format, rules)
       values (3, 'Missions', 5, '${day(-30)}', '${day(-20)}', '${day(-10)}', 'points', 'bingo', '{"mission":{"policy":"manual"}}')`,
    `insert into events (id, name, board_size, created_at, start_date, end_date, scoring_mode, format, rules)
       values (4, 'Tile count', 5, '${day(-30)}', '${day(-20)}', '${day(-10)}', 'tiles', 'bingo', null)`,
  ];
  for (let e = 1; e <= 4; e++) {
    stmts.push(`insert into teams (id, event_id, name, color) values (${e * 10 + 1}, ${e}, 'Alpha', '#d0553f')`);
    stmts.push(`insert into teams (id, event_id, name, color) values (${e * 10 + 2}, ${e}, 'Beta', '#4aa3d4')`);
  }

  // event 1: three 10-point tiles + one optional 50-pointer. Alpha claims two (20), Beta one (10).
  stmts.push(
    `insert into tiles (id, event_id, position, label, points, optional) values (101, 1, 0, 'a', 10, 0)`,
    `insert into tiles (id, event_id, position, label, points, optional) values (102, 1, 1, 'b', 10, 0)`,
    `insert into tiles (id, event_id, position, label, points, optional) values (103, 1, 2, 'c', 10, 0)`,
    `insert into tiles (id, event_id, position, label, points, optional) values (104, 1, 3, 'opt', 50, 1)`,
    `insert into completions (team_id, tile_id, completed_at) values (11, 101, '${day(-15)}')`,
    `insert into completions (team_id, tile_id, completed_at) values (11, 102, '${day(-15)}')`,
    `insert into completions (team_id, tile_id, completed_at) values (12, 103, '${day(-15)}')`,
    `insert into completions (team_id, tile_id, completed_at) values (11, 104, '${day(-15)}')`,
  );

  // event 2: two revealed 10s, two never-revealed 10s. Alpha claimed one of each — only the
  // revealed one scores, so Alpha is on 10, not 20.
  stmts.push(
    `insert into tiles (id, event_id, position, label, points, revealed_at) values (201, 2, 0, 'shown', 10, '${day(-18)}')`,
    `insert into tiles (id, event_id, position, label, points, revealed_at) values (202, 2, 1, 'shown', 10, '${day(-18)}')`,
    `insert into tiles (id, event_id, position, label, points, revealed_at) values (203, 2, 2, 'hidden', 10, null)`,
    `insert into tiles (id, event_id, position, label, points, revealed_at) values (204, 2, 3, 'hidden', 10, null)`,
    `insert into completions (team_id, tile_id, completed_at) values (21, 201, '${day(-15)}')`,
    `insert into completions (team_id, tile_id, completed_at) values (21, 203, '${day(-15)}')`,
  );

  // event 3: classic board (everything visible) plus two missions, one announced. A completion on
  // the un-announced mission must not score.
  stmts.push(
    `insert into tiles (id, event_id, position, label, points) values (301, 3, 0, 'board', 10)`,
    `insert into tiles (id, event_id, position, label, points, mission, revealed_at) values (302, 3, 1, 'announced', 25, 1, '${day(-14)}')`,
    `insert into tiles (id, event_id, position, label, points, mission, revealed_at) values (303, 3, 2, 'quiet', 25, 1, null)`,
    `insert into completions (team_id, tile_id, completed_at) values (31, 301, '${day(-13)}')`,
    `insert into completions (team_id, tile_id, completed_at) values (31, 302, '${day(-13)}')`,
    `insert into completions (team_id, tile_id, completed_at) values (31, 303, '${day(-13)}')`,
  );

  // event 4: tile-scored. awardedPoints is set on one completion and must be ignored — a tile is
  // worth one tile.
  stmts.push(
    `insert into tiles (id, event_id, position, label, points) values (401, 4, 0, 'a', 10)`,
    `insert into tiles (id, event_id, position, label, points) values (402, 4, 1, 'b', 10)`,
    `insert into completions (team_id, tile_id, completed_at, awarded_points) values (41, 401, '${day(-13)}', 99)`,
    `insert into completions (team_id, tile_id, completed_at) values (41, 402, '${day(-13)}')`,
  );

  await client.batch(stmts, 'write');
});

after(() => {
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-wal`, { force: true });
  rmSync(`${DB_FILE}-shm`, { force: true });
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
