// Game-mode KC / XP checked against that mode's own hiscores table (lib/modeHiscoresQueue,
// lib/modeStats). Through the Forge drain, as the sweep runs it: a row with readings on a live board
// that counts a mode with a table gets ONE read queued for its name on that table; nothing else does
// (a mode with no table, a board that doesn't count the mode). When Forge's result lands, a reading
// the table contradicts stops counting (no completion, a note on the Stats tab), a reading it backs
// completes the tile, and an older Forge's "no such table" answer is not mistaken for an absent save.
// The account-type probe never eats a mode row.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/mode-hiscores-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, inArray } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('mode-hiscores');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let drainForgeFetches: typeof import('../src/lib/forgeFetchQueue.ts').drainForgeFetches;
let getStatStandings: typeof import('../src/lib/statStandings.ts').getStatStandings;
let mergeModePush: typeof import('../src/lib/modeStats.ts').mergeModePush;
let parseModeStats: typeof import('../src/lib/modeStats.ts').parseModeStats;
const ids = {} as Record<string, number>;

const HOUR = 3_600_000;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const stats = JSON.stringify({ skills: { overall: { rank: 1, xp: 1000 } }, bosses: { zulrah: { rank: 1, score: 0 } }, clues: {} });
const MODE_TABLES = ['hardcore_mains', 'seasonal', 'deadman', 'fresh_start', 'tournament'] as const;

/** The official index_lite.json shape, trimmed to what the test reads. */
function body(zulrah: number) {
  return JSON.stringify({
    skills: [
      { id: 0, name: 'Overall', rank: 5, level: 40, xp: 5000 },
      { id: 1, name: 'Attack', rank: 5, level: 20, xp: 5000 },
    ],
    activities: [{ id: 0, name: 'Zulrah', rank: 9, score: zulrah }],
  });
}

const modeRows = () => db.select().from(s.hiscoresFetches).where(inArray(s.hiscoresFetches.mode, [...MODE_TABLES]));
const row = async (id: number) => (await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, id)))[0];
const done = async (tileId: number, teamId: number) =>
  (await db.select().from(s.completions).where(and(eq(s.completions.tileId, tileId), eq(s.completions.teamId, teamId)))).length > 0;
const drain = () => drainForgeFetches({ work: [], due: [], apply: async () => {} });

/** What Forge does with a claimed row. */
async function forgeFetched(rsnKey: string, outcome: 'ok' | 'unranked', raw: string | null, error: string | null = null) {
  await db
    .update(s.hiscoresFetches)
    .set({ fetchedAt: new Date(Date.now() - 60_000), claimedAt: new Date(Date.now() - 60_000), outcome, body: raw, error })
    .where(and(eq(s.hiscoresFetches.rsnKey, rsnKey), eq(s.hiscoresFetches.mode, 'hardcore_mains')));
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ drainForgeFetches } = await import('../src/lib/forgeFetchQueue.ts'));
  ({ getStatStandings } = await import('../src/lib/statStandings.ts'));
  ({ mergeModePush, parseModeStats } = await import('../src/lib/modeStats.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const account = async (rsn: string) => {
    const [person] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [acct] = await db.insert(s.accounts).values({ playerId: person.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
    return { acct, seat };
  };
  const cheat = await account('Hcguy');
  const honest = await account('Honest');

  const board = async (key: string, rules: object | null) => {
    const [ev] = await db
      .insert(s.events)
      .values({ clanId: clan.id, name: `Board ${key}`, boardSize: 3, startDate: day(-1), endDate: day(5), tilesRevealed: 1, startNotified: 1, rules: rules ? JSON.stringify(rules) : null })
      .returning();
    const [tile] = await db
      .insert(s.tiles)
      .values({ eventId: ev.id, position: 0, label: `${key}: 50 Zulrah`, tileType: 'stat', statType: 'boss', trackedStat: 'zulrah', statGoal: 50, points: 10 })
      .returning();
    ids[`${key}Event`] = ev.id;
    ids[`${key}Tile`] = tile.id;
    return ev;
  };
  const seat = async (key: string, evId: number, who: typeof cheat, modeStats: string | null) => {
    const [team] = await db.insert(s.teams).values({ eventId: evId, name: `Team ${key}`, color: '#fff' }).returning();
    const [p] = await db
      .insert(s.eventParticipants)
      .values({ eventId: evId, clanMemberId: who.seat.id, accountId: who.acct.id, name: who.acct.rsn, teamId: team.id, statsSnapshot: stats, cachedStats: stats, modeStats })
      .returning();
    ids[`${key}Team`] = team.id;
    ids[key] = p.id;
  };

  // The cheat claims 1 → 120 Zulrah on hardcore, eight hours ago; the honest player 10 → 70, recently.
  const cheatPushes = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 1 }, ago(8 * HOUR)), 'hardcore', { zulrah: 120 }, ago(7.9 * HOUR));
  const honestPushes = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 10 }, ago(3 * HOUR)), 'hardcore', { zulrah: 70 }, ago(2 * HOUR));

  const hc = await board('hc', { worldModes: ['hardcore'] });
  await seat('cheat', hc.id, cheat, cheatPushes);
  await seat('honest', hc.id, honest, honestPushes);

  // Nothing to check against: Beta has no hiscores. And a board that doesn't count the mode at all.
  const beta = await board('beta', { worldModes: ['beta'] });
  await seat('betaRow', beta.id, cheat, mergeModePush(null, 'beta', { zulrah: 1 }, ago(HOUR)));
  const main = await board('main', null);
  await seat('mainRow', main.id, honest, honestPushes);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('one read per name on the mode’s table is queued, starting lines in the competition lane', async () => {
  const stats = await drain();
  const rows = await modeRows();
  assert.deepEqual(
    rows.map((r) => `${r.rsnKey}|${r.mode}|${r.priority}`).sort(),
    ['hcguy|hardcore_mains|0', 'honest|hardcore_mains|0'],
    'no Beta read (no table) and nothing for the board that does not count the mode',
  );
  assert.equal(stats.modes.queued, 2);
  // Offered again while waiting: the pending index makes it free.
  assert.equal((await drain()).modes.queued, 0);
  assert.equal((await modeRows()).length, 2);
});

test('a reading the table contradicts stops counting; one it backs completes the tile', async () => {
  await forgeFetched('hcguy', 'ok', body(40));
  await forgeFetched('honest', 'ok', body(70));
  // An older Forge, asked for a table it doesn't have, answers "unranked" without a request.
  await db.insert(s.hiscoresFetches).values({
    rsn: 'Someone',
    rsnKey: 'someone',
    mode: 'seasonal',
    priority: 1,
    fetchedAt: new Date(),
    outcome: 'unranked',
    error: 'unknown hiscores mode: "seasonal"',
  });

  const stats = await drain();
  assert.equal(stats.modes.read, 3);
  assert.equal(stats.modes.applied, 2);
  assert.equal(stats.modes.unsupported, 1);
  // The mode drain took them, not the account-type probe.
  assert.ok((await modeRows()).every((r) => r.consumedAt != null));

  const cheat = parseModeStats((await row(ids.cheat)).modeStats).hardcore;
  assert.equal(cheat.hs?.status, 'ok');
  assert.equal(cheat.hs?.v.zulrah, 40);
  assert.equal(await done(ids.hcTile, ids.cheatTeam), false, '120 pushed, 40 on the table read 7.9h later: 40 counts, short of 50');
  assert.equal(await done(ids.hcTile, ids.honestTeam), true, '10 → 70, and the table says 70');

  const standings = await getStatStandings(ids.hcEvent);
  const tile = standings.find((t) => t.tileId === ids.hcTile)!;
  const cheatRow = tile.players.find((p) => p.playerId === ids.cheat)!;
  assert.equal(cheatRow.gained, 40);
  assert.ok(cheatRow.modeNotes?.some((n) => /only the hiscores number counts/.test(n)), JSON.stringify(cheatRow.modeNotes));
  assert.equal(tile.players.find((p) => p.playerId === ids.honest)!.modeNotes, undefined);
});

test('a settled save is not read again until its readings move', async () => {
  assert.equal((await drain()).modes.queued, 0);
  const honestNow = (await row(ids.honest)).modeStats;
  // A new boss on the honest save: its starting line wants a read — but not within ten minutes of the last.
  await db
    .update(s.eventParticipants)
    .set({ modeStats: mergeModePush(honestNow, 'hardcore', { vorkath: 1 }) })
    .where(eq(s.eventParticipants.id, ids.honest));
  assert.equal((await drain()).modes.queued, 0, 'read a minute ago');
});

test('while Forge lacks the tables, only a single canary read is offered', async () => {
  // Two saves with fresh readings and no read yet; the "unknown hiscores mode" answer from the
  // previous test is under an hour old.
  for (const id of [ids.cheat, ids.honest]) {
    const json = JSON.parse((await row(id)).modeStats!);
    delete json.hardcore.hs;
    await db.update(s.eventParticipants).set({ modeStats: JSON.stringify(json) }).where(eq(s.eventParticipants.id, id));
  }
  assert.equal((await drain()).modes.queued, 1);
});
