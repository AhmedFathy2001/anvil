// Easier options on a tile race against a real database: an option stays hidden and uncreditable
// until the clock or a lifeline turns it on, finishing a live one finishes its board tile, a
// lifeline is one team's alone, and the minute tick announces each easing interval once.
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/race-ease-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('race-ease-db');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let ease: typeof import('../src/lib/raceEaseDb.ts');
let hideDb: typeof import('../src/lib/raceHideAheadDb.ts');
let gate: typeof import('../src/lib/completionGate.ts');
let combo: typeof import('../src/lib/comboCompletion.ts');
let tick: typeof import('../src/lib/raceEaseTick.ts');

let eventId: number;
let clanId: number;
let red: number;
let blue: number;
const ids: Record<string, number> = {};

const H = 3_600_000;
const event = async () => (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
const tile = async (id: number) => (await db.query.tiles.findFirst({ where: eq(s.tiles.id, id) }))!;
const setRules = async (rules: object | null) => {
  await db.update(s.events).set({ rules: rules ? JSON.stringify(rules) : null }).where(eq(s.events.id, eventId));
  ease.bumpEaseContext(eventId);
};
const done = async (teamId: number, tileId: number) =>
  !!(await db.query.completions.findFirst({ where: and(eq(s.completions.teamId, teamId), eq(s.completions.tileId, tileId)) }));
/** Finish a tile the way every completion writer does: through the gate, then the child-row sync. */
async function finish(teamId: number, tileId: number): Promise<boolean> {
  const row = await tile(tileId);
  const g = await gate.evaluateCompletionGate({ event: await event(), tile: row, teamId });
  if (!g.allowed) return false;
  await db.insert(s.completions).values({ teamId, tileId, awardedPoints: g.awardedPoints }).onConflictDoNothing();
  await combo.afterPartCompletion(row, teamId, { change: 'added', silent: true });
  return true;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ease = await import('../src/lib/raceEaseDb.ts');
  hideDb = await import('../src/lib/raceHideAheadDb.ts');
  gate = await import('../src/lib/completionGate.ts');
  combo = await import('../src/lib/comboCompletion.ts');
  tick = await import('../src/lib/raceEaseTick.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'ease', name: 'Ease Test' }).returning();
  clanId = clan.id;
  // Started 30 hours ago: with a 24-hour interval the race is on easing tick 1.
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Race', boardSize: 4, format: 'tilerace', tilesRevealed: 1, startDate: new Date(Date.now() - 30 * H).toISOString() })
    .returning();
  eventId = ev.id;
  red = (await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning())[0].id;
  blue = (await db.insert(s.teams).values({ eventId, name: 'Blue', color: '#0000ff' }).returning())[0].id;
  // A straight line: one -> two -> three -> four. One and two each carry an easier option.
  for (const [i, k] of ['one', 'two', 'three', 'four'].entries()) {
    const [t] = await db.insert(s.tiles).values({ eventId, position: i, label: `Hard ${k}` }).returning();
    ids[k] = t.id;
  }
  for (const k of ['one', 'two']) {
    const [t] = await db.insert(s.tiles).values({ eventId, position: 0, label: `Easy ${k}`, parentTileId: ids[k], easeLevel: 1, points: 0 }).returning();
    ids[`easy-${k}`] = t.id;
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('both switches off: an easier option is hidden from players and can’t credit', async () => {
  const ev = await event();
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-one'], red), false);
  const all = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  const seen = await hideDb.maskRaceTilesForTeams(ev, [red], all);
  assert.deepEqual(seen.map((t) => t.id).sort(), [ids.one, ids.two, ids.three, ids.four].sort());
  assert.equal(await finish(red, ids['easy-one']), false);
  assert.equal(await done(red, ids.one), false);
  // A post naming it would stay with the team; a public reply loses its name.
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids['easy-one'], red), true);
  const rows = await hideDb.publicRaceLabels(ev, [{ tileId: ids['easy-one'], label: 'Easy one' }, { tileId: ids.one, label: 'Hard one' }]);
  assert.notEqual(rows[0].label, 'Easy one');
  assert.equal(rows[1].label, 'Hard one');
});

test('timed easing: the first step’s option is live for everyone after one interval, the second step’s is not', async () => {
  await setRules({ raceEase: { hours: 24 } });
  const ev = await event();
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-one'], red), true);
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-one'], blue), true);
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-two'], red), false);
  const all = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  const seen = await hideDb.maskRaceTilesForTeams(ev, [blue], all);
  assert.ok(seen.some((t) => t.id === ids['easy-one']));
  assert.ok(!seen.some((t) => t.id === ids['easy-two']));
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids['easy-one'], red), false);
  const view = (await ease.teamEaseView(ev, red))!;
  assert.deepEqual(view.tiles.get(ids.one)!.live.map((o) => o.label), ['Easy one']);
  assert.equal(view.tiles.get(ids.two)!.locked, 1);
  assert.ok(view.tiles.get(ids.two)!.nextTimedAt! > Date.now());
  assert.equal(view.lifelines, null);
});

test('finishing a live easier option finishes its board tile, and the route moves on', async () => {
  assert.equal(await finish(red, ids['easy-one']), true);
  assert.equal(await done(red, ids.one), true);
  // Blue did nothing: its tile is untouched.
  assert.equal(await done(blue, ids.one), false);
  // Red now plays tile two; its easier option is still locked, so it can't credit.
  assert.equal(await finish(red, ids['easy-two']), false);
  assert.equal(await done(red, ids.two), false);
});

test('an easier option only credits on a tile the team is playing', async () => {
  // Blue is still on tile one. Even with tile two's option forced live by a lifeline rule, tile two isn't open for Blue.
  await setRules({ raceEase: { hours: 1 } });
  const ev = await event();
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-two'], blue), true);
  assert.equal(await finish(blue, ids['easy-two']), false);
  assert.equal(await done(blue, ids.two), false);
  await setRules({ raceEase: { hours: 24 } });
});

test('a lifeline opens the option for the team that spent it, and only for them', async () => {
  await setRules({ raceLifelines: { count: 1, afterHours: 0, opens: 'first' } });
  const ev = await event();
  const before = (await ease.teamEaseView(ev, red))!;
  assert.deepEqual(before.lifelines, { left: 1, total: 1 });
  assert.equal(before.tiles.get(ids.two)!.lifeline.state, 'ready');
  // Blue isn't on tile two yet.
  assert.equal((await ease.teamEaseView(ev, blue))!.tiles.get(ids.two)!.lifeline.state, 'not-open');

  const spent = await ease.spendLifeline(ev, red, ids.two, null);
  assert.deepEqual(spent, { ok: true, opened: [{ id: ids['easy-two'], label: 'Easy two' }] });
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-two'], red), true);
  assert.equal(await ease.easeOptionLiveForTeam(ev, ids['easy-two'], blue), false);
  // Blue's lists never carry it; a post naming it stays with Red.
  const all = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  assert.ok(!(await hideDb.maskRaceTilesForTeams(ev, [blue], all)).some((t) => t.id === ids['easy-two']));
  assert.ok((await hideDb.maskRaceTilesForTeams(ev, [red], all)).some((t) => t.id === ids['easy-two']));
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids['easy-two'], red), true);

  const after = (await ease.teamEaseView(ev, red))!;
  assert.deepEqual(after.lifelines, { left: 0, total: 1 });
  assert.equal(after.tiles.get(ids.two)!.lifeline.state, 'spent');
  // None left, and never twice on one tile.
  assert.equal((await ease.spendLifeline(ev, red, ids.two, null)).ok, false);

  assert.equal(await finish(red, ids['easy-two']), true);
  assert.equal(await done(red, ids.two), true);
});

test('a lifeline waits until the tile has been open long enough', async () => {
  await setRules({ raceLifelines: { count: 3, afterHours: 12, opens: 'first' } });
  const ev = await event();
  // Blue has been on tile one since the start, 30 hours ago: ready. (Its option isn't live: no timed easing now.)
  assert.equal((await ease.teamEaseView(ev, blue))!.tiles.get(ids.one)!.lifeline.state, 'ready');
  await setRules({ raceLifelines: { count: 3, afterHours: 48, opens: 'first' } });
  const view = (await ease.teamEaseView(await event(), blue))!;
  assert.equal(view.tiles.get(ids.one)!.lifeline.state, 'wait');
  const refused = await ease.spendLifeline(await event(), blue, ids.one, null);
  assert.equal(refused.ok, false);
});

test('an admin gives a lifeline back', async () => {
  await setRules({ raceLifelines: { count: 1, afterHours: 0, opens: 'first' } });
  assert.equal(await ease.refundLifeline(eventId, red, ids.two), true);
  assert.deepEqual((await ease.teamEaseView(await event(), red))!.lifelines, { left: 1, total: 1 });
  assert.equal(await ease.refundLifeline(eventId, red, ids.two), false);
});

test('the minute tick announces each easing interval once', async () => {
  await setRules({ raceEase: { hours: 24 } });
  assert.equal((await event()).raceEaseTick, 0);
  assert.equal(await tick.processRaceEasing(), 1);
  assert.equal((await event()).raceEaseTick, 1);
  assert.equal(await tick.processRaceEasing(), 0);
  // Two intervals on: tile two's option opens (tile one's has no second level).
  assert.equal(await tick.processRaceEasing(Date.now() + 24 * H), 1);
  assert.equal((await event()).raceEaseTick, 2);
});

test('the plugin config watches an easier option only once it is live for that team, folded under its tile', async () => {
  // Red is on tile three. Give it a drop-kind easier option and one lifeline.
  const [opt] = await db
    .insert(s.tiles)
    .values({ eventId, position: 2, label: 'Easy three drop', tileType: 'drop', trackedItemIds: '[4151]', requiredAmount: 1, parentTileId: ids.three, easeLevel: 1, points: 0 })
    .returning();
  await setRules({ raceLifelines: { count: 2, afterHours: 0, opens: 'first' } });
  const enrolled = await import('../src/lib/pluginConfigEnrolled.ts');
  const clanCtx = await import('../src/lib/clanContext.ts');
  const clan = (await clanCtx.resolveClanById(clanId))!;
  const config = async (teamId: number) => {
    const cfg = await enrolled.buildEnrolledConfig({ eventId, teamId, clan, viewer: null });
    assert.ok(cfg.ok);
    return cfg.body as unknown as { trackedDrops?: { tileId?: number; partOf?: number }[] };
  };
  assert.ok(!JSON.stringify(await config(red)).includes('Easy three drop'), 'locked: the plugin never hears its name');

  assert.equal((await ease.spendLifeline(await event(), red, ids.three, null)).ok, true);
  const mine = await config(red);
  const row = (mine.trackedDrops ?? []).find((d) => d.tileId === opt.id);
  assert.ok(row, 'live: it rides the tracked drops');
  assert.equal(row!.partOf, ids.three, 'tagged with its tile, so the plugin folds it and stops when the tile is done');
  assert.ok(!JSON.stringify(await config(blue)).includes('Easy three drop'), 'another team still never hears of it');

  // The tile finished (either way): the option is no longer worth watching.
  assert.equal(await finish(red, ids.three), true);
  assert.ok(!((await config(red)).trackedDrops ?? []).some((d) => d.tileId === opt.id));
});

test('kills on an easier option count from when the tile opened: past the easier number, it finishes the moment it opens', async () => {
  const raceDb = await import('../src/lib/raceRoutesDb.ts');
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'KC race', boardSize: 3, format: 'tilerace', tilesRevealed: 1, startDate: new Date(Date.now() - 30 * H).toISOString(), rules: JSON.stringify({ raceLifelines: { count: 1, afterHours: 0, opens: 'first' } }) })
    .returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Green', color: '#00ff00' }).returning();
  const stats = (kc: number) => JSON.stringify({ bosses: { zulrah: { score: kc } }, skills: {} });
  // 100 Zulrah KC at the event start, 150 by the time the KC tile opens: those 50 must not count.
  const [p] = await db.insert(s.eventParticipants).values({ eventId: ev.id, teamId: team.id, name: 'Greenman', statsSnapshot: stats(100), cachedStats: stats(150) }).returning();
  const [start] = await db.insert(s.tiles).values({ eventId: ev.id, position: 0, label: 'Start' }).returning();
  const [hard] = await db.insert(s.tiles).values({ eventId: ev.id, position: 1, label: '100 Zulrah', trackedStat: 'zulrah', statType: 'boss', statGoal: 100 }).returning();
  await db.insert(s.tiles).values({ eventId: ev.id, position: 2, label: 'End' });
  const [easy] = await db.insert(s.tiles).values({ eventId: ev.id, position: 1, label: '20 Zulrah', trackedStat: 'zulrah', statType: 'boss', statGoal: 20, parentTileId: hard.id, easeLevel: 1, points: 0 }).returning();
  const kcEvent = async () => (await db.query.events.findFirst({ where: eq(s.events.id, ev.id) }))!;
  const setKc = (kc: number) => db.update(s.eventParticipants).set({ cachedStats: stats(kc) }).where(eq(s.eventParticipants.id, p.id));

  // The team reaches the KC tile: both it and its (hidden) easier option take their baseline there.
  await db.insert(s.completions).values({ teamId: team.id, tileId: start.id });
  await raceDb.ensureRaceBaselines(ev.id, [team.id]);
  const base = JSON.parse((await tile(easy.id)).revealStats!);
  assert.equal(base[p.id].g, 50, 'the easier option counts from the open, like its tile');

  // 10 kills later the team spends its lifeline: 10 of 20, so nothing finishes.
  await setKc(160);
  assert.equal((await ease.spendLifeline(await kcEvent(), team.id, hard.id, null)).ok, true);
  assert.equal(await done(team.id, hard.id), false);

  // Give it back; the team plays on to 25 kills since the open, still far from the hard 100.
  assert.equal(await ease.refundLifeline(ev.id, team.id, hard.id), true);
  await setKc(175);
  await ease.settleEasedTiles(ev.id, [team.id]);
  assert.equal(await done(team.id, hard.id), false, 'locked again: 25 kills finish nothing');

  // Spent again: the 25 kills since the tile opened are past the easier 20, so the tile is done at once.
  assert.equal((await ease.spendLifeline(await kcEvent(), team.id, hard.id, null)).ok, true);
  assert.equal(await done(team.id, easy.id), true);
  assert.equal(await done(team.id, hard.id), true);
});

test('Discord hears a lifeline and an easing interval, without ever naming the tile or what opened', async () => {
  // The clan's channel is a Discord webhook; the network is stood in for, so the posts are read here.
  await db.insert(s.settings).values({ clanId, key: 'discord_webhook_url', value: 'https://discord.com/api/webhooks/123456789012345678/test-token' });
  const sent: { title?: string; description?: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    try {
      const body = JSON.parse(String(init?.body ?? '{}')) as { embeds?: { title?: string; description?: string }[] };
      for (const e of body.embeds ?? []) sent.push(e);
    } catch {
      /* not a post body */
    }
    return new Response(JSON.stringify({ id: '1', channel_id: '1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    // A fresh straight race, started 30 hours ago: Hard A (with an easier option) then Hard B (with one).
    const [ev] = await db
      .insert(s.events)
      .values({ clanId, name: 'Post race', boardSize: 2, format: 'tilerace', tilesRevealed: 1, startDate: new Date(Date.now() - 30 * H).toISOString(), rules: JSON.stringify({ raceLifelines: { count: 2, afterHours: 0, opens: 'first' } }) })
      .returning();
    const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Posters', color: '#123456' }).returning();
    const [a] = await db.insert(s.tiles).values({ eventId: ev.id, position: 0, label: 'Secret Hard A' }).returning();
    const [b] = await db.insert(s.tiles).values({ eventId: ev.id, position: 1, label: 'Secret Hard B' }).returning();
    await db.insert(s.tiles).values({ eventId: ev.id, position: 0, label: 'Secret Easy A', parentTileId: a.id, easeLevel: 1, points: 0 });
    await db.insert(s.tiles).values({ eventId: ev.id, position: 1, label: 'Secret Easy B', parentTileId: b.id, easeLevel: 1, points: 0 });
    const fresh = async () => (await db.query.events.findFirst({ where: eq(s.events.id, ev.id) }))!;
    const waitFor = async (match: (e: { title?: string }) => boolean) => {
      for (let i = 0; i < 50 && !sent.some(match); i++) await new Promise((r) => setTimeout(r, 100));
      return sent.find(match);
    };

    assert.equal((await ease.spendLifeline(await fresh(), team.id, a.id, null)).ok, true);
    const life = await waitFor((e) => /^Posters used a lifeline/.test(e.title ?? ''));
    assert.ok(life, 'the lifeline post went out');
    assert.equal(life!.title, 'Posters used a lifeline at the start');
    assert.match(life!.description ?? '', /1 of 2 lifelines left/);

    // Timed easing switched on at 24 hours: the tick opens step 1's option and says so, once.
    await db.update(s.events).set({ rules: JSON.stringify({ raceEase: { hours: 24 } }) }).where(eq(s.events.id, ev.id));
    ease.bumpEaseContext(ev.id);
    await tick.processRaceEasing();
    const eased = await waitFor((e) => /^Post race: .*just got easier/.test(e.title ?? ''));
    assert.ok(eased, 'the easing post went out');
    assert.equal(eased!.title, 'Post race: Start just got easier');
    await tick.processRaceEasing();
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(sent.filter((e) => /^Post race: .*just got easier/.test(e.title ?? '')).length, 1, 'announced once');

    // Neither post names a tile or an easier option.
    assert.ok(!JSON.stringify(sent).includes('Secret'), 'no tile or option name in any post');
  } finally {
    globalThis.fetch = realFetch;
    await db.delete(s.settings).where(and(eq(s.settings.clanId, clanId), eq(s.settings.key, 'discord_webhook_url')));
  }
});

test('once the race is over nothing is hidden', async () => {
  await setRules(null);
  await db.update(s.events).set({ forceEndedAt: new Date().toISOString() }).where(eq(s.events.id, eventId));
  ease.bumpEaseContext(eventId);
  const ev = await event();
  const all = await db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId));
  assert.equal((await hideDb.maskRaceTilesForTeams(ev, [blue], all)).length, all.length);
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids['easy-two'], red), false);
});
