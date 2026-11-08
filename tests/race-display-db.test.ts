// The race order is the same on the site and in the plugin panel, and a hidden tile never reaches
// either. The site's race data is lib/raceSummary raceViewData over the visible board (what the event
// page renders); the panel's is /api/plugin/board's buildBoard and the plugin config.
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/race-display-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('race-display-db');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let clanId: number;
let eventId: number;
const team: Record<string, number> = {};
const tile: Record<string, number> = {};

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'rd', name: 'Race display' }).returning();
  clanId = clan.id;
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'Race', boardSize: 3, format: 'tilerace', tilesRevealed: 1, rules: JSON.stringify({ revealPolicy: 'scheduled' }), startDate: new Date(Date.now() - 864e5).toISOString() })
    .returning();
  eventId = ev.id;
  for (const name of ['Aardvarks', 'Zebras']) {
    const [t] = await db.insert(s.teams).values({ eventId, name, color: '#123456' }).returning();
    team[name] = t.id;
  }
  const at = new Date(Date.now() - 864e5).toISOString();
  for (const [i, k] of ['start', 'second', 'secret'].entries()) {
    const [t] = await db
      .insert(s.tiles)
      .values({ eventId, position: i, label: k === 'secret' ? 'SecretTile' : k, revealedAt: k === 'secret' ? null : at, revealAt: k === 'secret' ? new Date(Date.now() + 864e5).toISOString() : at })
      .returning();
    tile[k] = t.id;
  }
  // Same steps; Zebras got there first. Names would put Aardvarks first.
  await db.insert(s.completions).values([
    { teamId: team.Aardvarks, tileId: tile.start, completedAt: '2026-11-01 10:00:00' },
    { teamId: team.Zebras, tileId: tile.start, completedAt: '2026-11-01 09:00:00' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the same race order on the site and in the plugin payloads', async () => {
  const { raceViewData } = await import('../src/lib/raceSummary.ts');
  const { visibleTiles, parseEventRules } = await import('../src/lib/eventRules.ts');
  const { raceStandingsForEvent } = await import('../src/lib/raceRoutesDb.ts');
  const { buildBoard } = await import('../src/app/api/plugin/board/route.ts');
  const ev = (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
  const tiles = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  const teams = await db.select().from(s.teams).where(eq(s.teams.eventId, eventId));
  const comps = await db.select().from(s.completions);

  const site = raceViewData({ visibleBoardTiles: visibleTiles(parseEventRules(ev.rules), tiles), teams, completions: comps, withFirsts: true }).standings;
  const roster = (await raceStandingsForEvent(ev))!.standings;
  const board = await buildBoard(ev, team.Aardvarks, null);
  const panel = (board as unknown as { race: { standings: { teamId: number; rank: number }[]; rank: number } }).race;

  const pick = (r: { teamId: number; rank: number }[]) => r.map((x) => [x.teamId, x.rank]);
  assert.deepEqual(pick(site), [[team.Zebras, 1], [team.Aardvarks, 2]], 'Zebras got there first');
  assert.deepEqual(pick(roster), pick(site));
  assert.deepEqual(pick(panel.standings), pick(site));
  assert.equal(panel.rank, 2, "the caller's own rank in the panel");
});

test('a hidden tile never appears in the race page data or the panel payloads', async () => {
  const { raceViewData } = await import('../src/lib/raceSummary.ts');
  const { visibleTiles, parseEventRules } = await import('../src/lib/eventRules.ts');
  const { buildBoard } = await import('../src/app/api/plugin/board/route.ts');
  const ev = (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
  const tiles = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  const teams = await db.select().from(s.teams).where(eq(s.teams.eventId, eventId));
  const comps = await db.select().from(s.completions);
  const site = raceViewData({ visibleBoardTiles: visibleTiles(parseEventRules(ev.rules), tiles), teams, completions: comps, withFirsts: true });
  assert.ok(!JSON.stringify(site).includes('SecretTile'));
  assert.equal(site.steps, 2);

  const board = await buildBoard(ev, team.Aardvarks, null);
  const json = JSON.stringify(board);
  assert.ok(!json.includes('SecretTile'), 'plugin board');
  assert.equal((board as unknown as { race: { steps: number } }).race.steps, 2, 'the step count is the visible route');

  const enrolled = await import('../src/lib/pluginConfigEnrolled.ts');
  const clanCtx = await import('../src/lib/clanContext.ts');
  const clan = (await clanCtx.resolveClanById(clanId))!;
  const cfg = await enrolled.buildEnrolledConfig({ eventId, teamId: team.Aardvarks, clan, viewer: null });
  assert.ok(cfg.ok);
  assert.ok(!JSON.stringify(cfg.body).includes('SecretTile'), 'plugin config');
});
