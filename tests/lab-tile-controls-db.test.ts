// Lab tile controls and lab stat pushes against a real database.
//
// What must hold:
//   - a stats push from a character in a lab session credits the LAB board's KC tile through the real
//     /api/plugin/stats route (and completes it at the goal). Real play also reaches the character's
//     real account overlay and real board; a replayed scenario reaches nothing real;
//   - staff can set progress on, complete, and clear any tile for any team, credited to a chosen
//     player, through the real crediting code; lowering progress un-completes; clear wipes it all;
//   - nothing reaches a team, tile or player that is not on the session's board.
//
// Run: npm run test:labtiles   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';

const DB = useTestDatabase('lab-tile-controls');

const RSN = 'Lab Rat';
const TOKEN = 'lab-token';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/lab.ts');
let C: typeof import('../src/lib/labTileControls.ts');

let userId: number;
let accountId: number;
let realEvent: number;
let realTile: number;
let labEventId: number;
let labTeam: number;
let me: number; // the staffer's character on the lab board
let mate: number; // a second player on the same team
let otherTeam: number;
let otherPlayer: number;

const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

function statsPush(body: object, scenario?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    'X-RSN': RSN,
    ...clanHeaders('alpha'),
    'Content-Type': 'application/json',
  };
  if (scenario) headers['X-Anvil-Scenario'] = scenario;
  return new Request('https://anvilosrs.com/api/plugin/stats', { method: 'POST', headers, body: JSON.stringify(body) });
}

async function labEventRow() {
  return (await L.labEvent(labEventId))!;
}

async function setTile(position: number, values: Partial<typeof s.tiles.$inferInsert>) {
  const [row] = await db.update(s.tiles).set(values).where(and(eq(s.tiles.eventId, labEventId), eq(s.tiles.position, position))).returning();
  return row;
}

const completionOf = async (teamId: number, tileId: number) =>
  (await db.select().from(s.completions).where(and(eq(s.completions.teamId, teamId), eq(s.completions.tileId, tileId))))[0] ?? null;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  L = await import('../src/lib/lab.ts');
  C = await import('../src/lib/labTileControls.ts');

  const [alpha] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' }).returning();
  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  [{ id: userId }] = await db
    .insert(s.users)
    .values({ displayName: RSN, discordId: 'disc-lab', pluginTokenHash: tokenHash(TOKEN), playerId: person.id })
    .returning();
  [{ id: accountId }] = await db.insert(s.accounts).values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase() }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: alpha.id, accountId, kind: 'member', source: 'roster' }).returning();

  // A real bingo the character plays, with the same Vorkath tile — it must never move.
  const [ev] = await db.insert(s.events).values({ clanId: alpha.id, name: 'Real Bingo', startDate: iso(-2), endDate: iso(5), boardSize: 5 }).returning();
  realEvent = ev.id;
  const [realTeam] = await db.insert(s.teams).values({ eventId: realEvent, name: 'Reds', color: '#f00' }).returning();
  await db.insert(s.eventParticipants).values({
    eventId: realEvent,
    clanMemberId: seat.id,
    accountId,
    name: RSN,
    teamId: realTeam.id,
    statsSnapshot: JSON.stringify({ bosses: { vorkath: { score: 100 } }, skills: {} }),
  });
  [{ id: realTile }] = await db
    .insert(s.tiles)
    .values({ eventId: realEvent, position: 0, label: 'Real Vorkath', trackedStat: 'vorkath', statType: 'boss', statGoal: 10 })
    .returning();

  labEventId = await L.createLabSession(userId, { name: 'Tile controls', hours: 2, boardSize: 3, accounts: [{ accountId, name: RSN }] });
  [{ id: labTeam }] = await db.select().from(s.teams).where(eq(s.teams.eventId, labEventId));
  [{ id: me }] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, labEventId));
  [{ id: mate }] = await db.insert(s.eventParticipants).values({ eventId: labEventId, name: 'Mate', teamId: labTeam }).returning();
  [{ id: otherTeam }] = await db.insert(s.teams).values({ eventId: labEventId, name: 'Blue', color: '#00f' }).returning();
  [{ id: otherPlayer }] = await db.insert(s.eventParticipants).values({ eventId: labEventId, name: 'Blue1', teamId: otherTeam }).returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a real stats push during a session credits the lab board once AND the real board; a replay credits only the lab', async () => {
  const tile = await setTile(0, { label: 'Vorkath KC', trackedStat: 'vorkath', statType: 'boss', statGoal: 10 });
  const route = await import('../src/app/api/plugin/stats/route.ts');

  // Real play. First sight of the key is the lab board's starting line (no hiscores baseline there
  // yet); on the real board it is 700 over the starting 100, which clears the real tile.
  let res = await route.POST(statsPush({ stats: [{ kc: 800, name: 'Vorkath' }] }));
  assert.equal(res.status, 200);
  let body = await res.json();
  assert.equal(body.quarantined, undefined, 'real play is not held back');
  assert.deepEqual(body.completed, ['Real Vorkath'], 'the real board, not the lab board that wins the plugin pick');
  assert.ok(await completionOf((await db.select().from(s.teams).where(eq(s.teams.eventId, realEvent)))[0].id, realTile));
  let [acct] = await db.select().from(s.accounts).where(eq(s.accounts.id, accountId));
  assert.equal(JSON.parse(acct.liveStats!).vorkath, 800, "the account's own overlay moved");

  res = await route.POST(statsPush({ stats: [{ kc: 806, name: 'Vorkath' }] }));
  body = await res.json();
  assert.deepEqual(body.completed, [], '6 of 10 on the lab board');
  assert.equal(await completionOf(labTeam, tile.id), null);

  // A replayed scenario from the session character credits the lab board, and only the lab board.
  res = await route.POST(statsPush({ stats: [{ kc: 810, name: 'Vorkath' }] }, 'vorkath-kc'));
  body = await res.json();
  assert.equal(body.quarantined, 'stats');
  assert.deepEqual(body.completed, ['Vorkath KC']);
  const done = await completionOf(labTeam, tile.id);
  assert.ok(done, 'completed at the goal');
  assert.equal(JSON.parse(done.statContributions!).total, 10, 'credited once per push, never twice');
  [acct] = await db.select().from(s.accounts).where(eq(s.accounts.id, accountId));
  assert.equal(JSON.parse(acct.liveStats!).vorkath, 806, 'the replay never reached the overlay');

  // Every push was logged, the replay under its scenario name.
  const log = await db.select().from(s.labLog).where(eq(s.labLog.eventId, labEventId));
  assert.deepEqual(log.map((r) => r.endpoint).sort(), ['stats', 'stats', 'stats · vorkath-kc']);

  // The real entrant is an ordinary one: never pinned the way a lab entrant is.
  const [realEntrant] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, realEvent));
  assert.equal(realEntrant.frozenAt, null);

  await L.resetLabSession(labEventId);
});

test('set progress on a count tile: below the goal, at it, and back below it', async () => {
  const event = await labEventRow();
  const tile = await setTile(1, { label: '10 chickens', tileType: 'kill', requiredAmount: 10, targetNpcs: '["Chicken"]' });

  let r = await C.labSetTileProgress(event, labTeam, tile.id, mate, 4);
  assert.deepEqual([r.complete, r.progress, r.goal, r.store], [false, 4, 10, 'count']);
  const subs = await db.select().from(s.submissions).where(eq(s.submissions.tileId, tile.id));
  assert.deepEqual(subs.map((x) => [x.amount, x.creditPlayerId]), [[4, mate]]);

  // A count-only kind waits for a screenshot on a real board; the lab finishes it, crediting the player.
  r = await C.labSetTileProgress(event, labTeam, tile.id, mate, 10);
  assert.equal(r.complete, true);
  assert.equal((await completionOf(labTeam, tile.id))?.creditPlayerId, mate);
  assert.equal((await db.select().from(s.submissions).where(eq(s.submissions.tileId, tile.id))).length, 1, 'replaced, not added');

  r = await C.labSetTileProgress(event, labTeam, tile.id, mate, 3);
  assert.equal(r.complete, false, 'lowering it un-completes');
  assert.equal(await completionOf(otherTeam, tile.id), null, 'the other team is untouched throughout');
});

test('set progress on a stat tile sets the team total; clear takes everyone back to zero', async () => {
  const event = await labEventRow();
  const tile = await setTile(0, { label: '50 Zulrah', trackedStat: 'zulrah', statType: 'boss', statGoal: 50 });

  // The mate already has 8 on it; "progress 20" means the chosen player has 20 and the team 20.
  const { simulateStatGain } = await import('../src/lib/labStats.ts');
  await simulateStatGain(labEventId, { participantId: mate, statType: 'boss', key: 'zulrah', baseline: 0, gain: 8 });
  let r = await C.labSetTileProgress(event, labTeam, tile.id, me, 20);
  assert.deepEqual([r.complete, r.progress, r.store], [false, 20, 'stat']);

  r = await C.labCompleteTile(event, labTeam, tile.id, me);
  assert.equal(r.complete, true);
  assert.equal(r.progress, 50);
  const split = JSON.parse((await completionOf(labTeam, tile.id))!.statContributions!);
  assert.deepEqual(split.split.map((x: { playerId: number }) => x.playerId), [me], 'credited to the chosen player');

  r = await C.labClearTile(event, labTeam, tile.id);
  assert.deepEqual([r.complete, r.progress], [false, 0]);
  // And it stays clear: the next real check finds no gain to complete it with.
  const { creditStatTilesForTeam } = await import('../src/lib/statTileCredit.ts');
  const [fresh] = await db.select().from(s.tiles).where(eq(s.tiles.id, tile.id));
  assert.deepEqual(await creditStatTilesForTeam({ eventId: labEventId, teamId: labTeam, statTiles: [fresh] }), []);
});

test('a standard tile completes and clears; it has no number to set', async () => {
  const event = await labEventRow();
  const tile = await setTile(2, { label: 'Do a thing', tileType: 'standard' });
  await assert.rejects(C.labSetTileProgress(event, otherTeam, tile.id, otherPlayer, 3), C.LabTileError);

  const r = await C.labCompleteTile(event, otherTeam, tile.id, otherPlayer);
  assert.deepEqual([r.complete, r.store], [true, null]);
  assert.equal((await completionOf(otherTeam, tile.id))?.creditPlayerId, otherPlayer);
  assert.equal(await completionOf(labTeam, tile.id), null);

  assert.equal((await C.labClearTile(event, otherTeam, tile.id)).complete, false);
  assert.equal(await completionOf(otherTeam, tile.id), null);
});

test('timed and distinct-item tiles store their own shapes', async () => {
  const event = await labEventRow();
  const timed = await setTile(3, { label: 'Fast run', tileType: 'timed', timedActivity: 'Fortis Colosseum', timeThresholdSeconds: 60 });
  assert.equal((await C.labSetTileProgress(event, labTeam, timed.id, me, 75)).complete, false, 'over the cap');
  assert.equal((await C.labSetTileProgress(event, labTeam, timed.id, me, 55)).complete, true, 'under it');
  const [run] = await db.select().from(s.submissions).where(eq(s.submissions.tileId, timed.id));
  assert.equal(run.durationSeconds, 55);

  const pool = await setTile(4, { label: '3 different', tileType: 'drop', requiredAmount: 3, countMode: 'distinct', trackedItemIds: '[4151,11840]' });
  const r = await C.labSetTileProgress(event, labTeam, pool.id, me, 3);
  assert.equal(r.complete, true);
  const rows = await db.select().from(s.submissions).where(eq(s.submissions.tileId, pool.id));
  assert.equal(new Set(rows.map((x) => x.itemId)).size, 3);

  // Clear wipes the team's rows and completion.
  await C.labClearTile(event, labTeam, pool.id);
  assert.equal((await db.select().from(s.submissions).where(eq(s.submissions.tileId, pool.id))).length, 0);
  assert.equal(await completionOf(labTeam, pool.id), null);
});

test('nothing off this board can be reached', async () => {
  const event = await labEventRow();
  const [tile] = await db.select().from(s.tiles).where(eq(s.tiles.eventId, labEventId));
  await assert.rejects(C.labCompleteTile(event, labTeam, realTile, me), /not on this board/);
  const [realTeam] = await db.select().from(s.teams).where(eq(s.teams.eventId, realEvent));
  await assert.rejects(C.labClearTile(event, realTeam.id, tile.id), /not on this board/);
  await assert.rejects(C.labCompleteTile(event, labTeam, tile.id, otherPlayer), /not on this team/);
});
