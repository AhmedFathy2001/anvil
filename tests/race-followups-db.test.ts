// Race follow-ups against a real database:
//   - a stat race tile counts only what the team gains after it opened for them (a baseline is taken
//     at the open; the gate refuses and takes one when it's missing),
//   - a mid-race route edit with "roll back" removes the invalidated finishes (cascading) and records
//     the policy in the tile history; "keep" leaves them,
//   - a mission hidden until its drop is in no viewer-facing payload (plugin board, plugin config).
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/race-followups-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('race-followups-db');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let gateFn: typeof import('../src/lib/completionGate.ts')['evaluateCompletionGate'];
let raceDb: typeof import('../src/lib/raceRoutesDb.ts');

let clanId: number;
let eventId: number;
let teamId: number;
let playerId: number;
const ids: Record<string, number> = {};

const event = async () => (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
const tile = async (k: string) => (await db.query.tiles.findFirst({ where: eq(s.tiles.id, ids[k]) }))!;
const gate = async (k: string) => gateFn({ event: await event(), tile: await tile(k), teamId });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ evaluateCompletionGate: gateFn } = await import('../src/lib/completionGate.ts'));
  raceDb = await import('../src/lib/raceRoutesDb.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'follow', name: 'Follow' }).returning();
  clanId = clan.id;
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'Race', boardSize: 3, format: 'tilerace', tilesRevealed: 1, startDate: new Date(Date.now() - 86_400_000).toISOString() })
    .returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  teamId = team.id;
  // A participant with a baseline of 100 Zulrah KC and 150 now: 50 gained since the start.
  const [p] = await db
    .insert(s.eventParticipants)
    .values({
      eventId,
      teamId,
      name: 'Redman',
      statsSnapshot: JSON.stringify({ bosses: { zulrah: { score: 100 } }, skills: {} }),
      cachedStats: JSON.stringify({ bosses: { zulrah: { score: 150 } }, skills: {} }),
    })
    .returning();
  playerId = p.id;
  // A straight line: start -> zulrah (a KC tile) -> end.
  for (const [i, k] of ['start', 'zulrah', 'end'].entries()) {
    const [t] = await db
      .insert(s.tiles)
      .values({ eventId, position: i, label: k, ...(k === 'zulrah' ? { trackedStat: 'zulrah', statType: 'boss', statGoal: 10 } : {}) })
      .returning();
    ids[k] = t.id;
  }
  // A mission hidden until its drop, and one shown as Locked.
  const [hidden] = await db
    .insert(s.tiles)
    .values({ eventId, position: 10, label: 'Secret Nightmare', mission: 1, rules: JSON.stringify({ lockout: true }) })
    .returning();
  ids.hidden = hidden.id;
  const [teaser] = await db
    .insert(s.tiles)
    .values({ eventId, position: 11, label: 'Teaser mission', mission: 1, rules: JSON.stringify({ showLocked: true }) })
    .returning();
  ids.teaser = teaser.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a stat race tile counts from when it opened for the team, not from the event start', async () => {
  // The KC tile isn't open yet: refused by the route.
  assert.equal((await gate('zulrah')).raceLocked, true);
  await db.insert(s.completions).values({ teamId, tileId: ids.start });
  // Opened, but no baseline yet (the 50 KC gained before it opened mustn't count): refused, and a
  // baseline is taken there and then.
  const g = await gate('zulrah');
  assert.equal(g.allowed, false);
  assert.ok(!g.raceLocked);
  const row = await tile('zulrah');
  const stats = JSON.parse(row.revealStats!);
  assert.equal(stats[playerId].g, 50, 'the gain at the open is the baseline');
  // From here on the gate lets it through (the scorers subtract the baseline).
  assert.equal((await gate('zulrah')).allowed, true);
});

test('ensureRaceBaselines captures for open tiles and keeps an existing baseline', async () => {
  await db.update(s.eventParticipants).set({ cachedStats: JSON.stringify({ bosses: { zulrah: { score: 170 } }, skills: {} }) }).where(eq(s.eventParticipants.id, playerId));
  await raceDb.ensureRaceBaselines(eventId);
  const stats = JSON.parse((await tile('zulrah')).revealStats!);
  assert.equal(stats[playerId].g, 50, 'never moved once taken');
});

test('a mid-race edit that invalidates finishes: preview, then roll back with history', async () => {
  await db.insert(s.completions).values({ teamId, tileId: ids.zulrah });
  // New route: zulrah moves to the end, end comes second — the zulrah finish no longer follows.
  const entries = [
    { id: ids.start, step: 0, next: [ids.end] },
    { id: ids.end, step: 1, next: [ids.zulrah] },
    { id: ids.zulrah, step: 2, next: [] },
  ];
  const preview = await raceDb.previewRouteEdit(eventId, entries);
  assert.equal(preview.teams.length, 1);
  assert.deepEqual(preview.teams[0].tiles.map((t) => t.id), [ids.zulrah]);

  await raceDb.applyLiveRouteEdit({ event: await event(), entries, order: [ids.start, ids.end, ids.zulrah], policy: 'rollback', discord: 'keep', actorUserId: null });
  const done = (await db.select().from(s.completions).where(eq(s.completions.teamId, teamId))).map((c) => c.tileId);
  assert.deepEqual(done, [ids.start], 'the invalidated finish is gone; the start stays');
  const history = await db.select().from(s.tileAuditLog).where(eq(s.tileAuditLog.eventId, eventId));
  assert.ok(history.some((h) => h.newValue?.includes('"policy":"rollback"') && h.tileId == null), 'the route row names the policy');
  assert.ok(history.some((h) => h.tileId === ids.zulrah && h.changedFields?.includes('rolled back')), 'the tile row says what happened');
  assert.equal((await tile('zulrah')).raceStep, 2);
  assert.equal((await tile('zulrah')).revealStats, null, 'locked again: its baseline is forgotten, retaken when it reopens');
});

test('keep leaves finishes in place and they still hold their step', async () => {
  await db.insert(s.completions).values({ teamId, tileId: ids.end });
  // Back to start -> zulrah -> end: the end finish no longer follows (zulrah isn't done).
  const entries = [
    { id: ids.start, step: 0, next: [ids.zulrah] },
    { id: ids.zulrah, step: 1, next: [ids.end] },
    { id: ids.end, step: 2, next: [] },
  ];
  const preview = await raceDb.previewRouteEdit(eventId, entries);
  assert.equal(preview.teams.length, 1);
  await raceDb.applyLiveRouteEdit({ event: await event(), entries, order: [ids.start, ids.zulrah, ids.end], policy: 'keep', discord: 'keep', actorUserId: null });
  const done = (await db.select().from(s.completions).where(eq(s.completions.teamId, teamId))).map((c) => c.tileId).sort();
  assert.deepEqual(done, [ids.start, ids.end].sort());
});

test('a mission hidden until its drop is in no viewer-facing payload', async () => {
  const { buildBoard } = await import('../src/app/api/plugin/board/route.ts');
  const board = await buildBoard(await event(), teamId, null);
  const boardJson = JSON.stringify(board);
  assert.ok(!boardJson.includes('Secret Nightmare'), 'plugin board: no name');
  assert.ok(!board.tiles.some((t: { tileId: number }) => t.tileId === ids.hidden), 'plugin board: no tile');
  assert.ok(!boardJson.includes('Teaser mission'), 'a show-as-Locked mission is not a board tile either');
  assert.ok(!('hiddenTileCount' in board) || board.hiddenTileCount === 0, 'not counted as hidden either');

  const enrolled = await import('../src/lib/pluginConfigEnrolled.ts');
  const clanCtx = await import('../src/lib/clanContext.ts');
  const clan = (await clanCtx.resolveClanById(clanId))!;
  const cfg = await enrolled.buildEnrolledConfig({ eventId, teamId, clan, viewer: { playerId, userId: null, rsn: 'Redman', request: new Request('http://site/api/plugin/config') } });
  assert.ok(cfg.ok);
  const cfgJson = JSON.stringify(cfg.body);
  assert.ok(!cfgJson.includes('Secret Nightmare'), 'plugin config: no name');
  assert.ok(!cfgJson.includes(`"tileId":${ids.hidden}`), 'plugin config: no tile id');
  // The site's preview list (event page, plugin panel): the shown-as-Locked one, by name only.
  const { lockedMissionPreviews } = await import('../src/lib/eventRules.ts');
  const all = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  assert.deepEqual(lockedMissionPreviews(all).map((m) => m.label), ['Teaser mission']);
});
