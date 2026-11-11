// A board hosted on a game-mode world (rules.worldModes). A plugin request from that mode's worlds
// credits ONLY boards that count the mode — KC / XP stat tiles, collection-log slot tiles and the
// recap counters — and never touches the account's own data: its live overlay, its collection log.
// A main-game-only board the same character is on takes nothing from the mode.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/mode-board-credit-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';

const DB = useTestDatabase('mode-board-credit');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
const ids = {} as Record<string, number>;

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const stats = (zulrah: number) =>
  JSON.stringify({ skills: { overall: { rank: 1, xp: 1000 }, attack: { rank: 1, xp: 1000 } }, bosses: { zulrah: { rank: 1, score: zulrah } }, clues: {} });

/** A hardcore world, as the plugin stamps it. */
const HARDCORE = { 'X-World-Types': 'HARDCORE_MAIN,MEMBERS', 'X-World-Activity': 'Hardcore' };
const LEAGUES = { 'X-World-Types': 'MEMBERS,SEASONAL', 'X-World-Activity': 'Leagues VI' };

function req(path: string, body: object, world: Record<string, string> = {}) {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer tok-mode',
      'X-RSN': 'Hcguy',
      'X-Account-Hash': 'hash-mode',
      ...clanHeaders('alpha'),
      'Content-Type': 'application/json',
      ...world,
    },
    body: JSON.stringify(body),
  });
}

const row = async (id: number) => (await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, id)))[0];
const done = async (tileId: number, teamId: number) =>
  (await db.select().from(s.completions).where(and(eq(s.completions.tileId, tileId), eq(s.completions.teamId, teamId)))).length > 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const [person] = await db.insert(s.players).values({ displayName: 'Hcguy' }).returning();
  await db.insert(s.users).values({ displayName: 'Hcguy', discordId: 'd-mode', pluginTokenHash: tokenHash('tok-mode'), playerId: person.id });
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Hcguy', rsnNormalized: 'hcguy', accountHash: 'hash-mode', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  ids.account = acct.id;
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster' }).returning();

  // The account's own (main-game) log already holds a Tanzanite fang from before either board started.
  await db.insert(s.memberClog).values({ accountId: acct.id, pagesSynced: 1, pagesTotal: 1, obtained: 1, total: 10, syncedAt: day(-10) });
  await db.insert(s.memberClogItems).values({ accountId: acct.id, itemId: 12922, pageName: 'Zulrah', quantity: 1, firstSeenAt: null });

  const board = async (key: string, rules: object | null) => {
    const [ev] = await db
      .insert(s.events)
      .values({ clanId: clan.id, name: `Board ${key}`, boardSize: 3, startDate: day(-1), endDate: day(5), tilesRevealed: 1, startNotified: 1, rules: rules ? JSON.stringify(rules) : null })
      .returning();
    const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: `Team ${key}`, color: '#fff' }).returning();
    const [p] = await db
      .insert(s.eventParticipants)
      .values({ eventId: ev.id, clanMemberId: seat.id, accountId: acct.id, name: 'Hcguy', teamId: team.id, statsSnapshot: stats(0), cachedStats: stats(0) })
      .returning();
    const [kc] = await db
      .insert(s.tiles)
      .values({ eventId: ev.id, position: 0, label: `${key}: 5 Zulrah`, tileType: 'stat', statType: 'boss', trackedStat: 'zulrah', statGoal: 5, points: 10 })
      .returning();
    const [clog] = await db
      .insert(s.tiles)
      .values({ eventId: ev.id, position: 1, label: `${key}: 2 Zulrah slots`, tileType: 'clog', targetNpcs: '["Zulrah"]', requiredAmount: 2, points: 10 })
      .returning();
    Object.assign(ids, { [`${key}Event`]: ev.id, [`${key}Team`]: team.id, [`${key}Player`]: p.id, [`${key}Kc`]: kc.id, [`${key}Clog`]: clog.id });
  };
  await board('hc', { worldModes: ['hardcore'] }); // hosted on hardcore worlds
  await board('main', null); // main game only
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a hardcore KC push lands on the hardcore board only, and never on the account', async () => {
  const { POST } = await import('../src/app/api/plugin/stats/route.ts');
  let res = await POST(req('/api/plugin/stats', { stats: [{ name: 'Zulrah', kc: 1 }] }, HARDCORE));
  assert.equal(res.status, 200, await res.clone().text());
  // An hour later. (Until the hardcore hiscores confirm them, a save's kills count at a believable
  // pace only — lib/modeStats — so four more in the same millisecond would be held back.)
  const first = JSON.parse((await row(ids.hcPlayer)).modeStats!);
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  first.hardcore.ft.zulrah = hourAgo;
  first.hardcore.at.zulrah = hourAgo;
  await db.update(s.eventParticipants).set({ modeStats: JSON.stringify(first) }).where(eq(s.eventParticipants.id, ids.hcPlayer));
  res = await POST(req('/api/plugin/stats', { stats: [{ name: 'Zulrah', kc: 5 }] }, HARDCORE));
  const body = await res.json();
  assert.deepEqual(body.completed, ['hc: 5 Zulrah'], 'kills 1..5 on the hardcore save complete the 5-kill tile');

  assert.ok(await done(ids.hcKc, ids.hcTeam));
  assert.equal(await done(ids.mainKc, ids.mainTeam), false, 'the main-game-only board takes nothing');
  assert.equal((await row(ids.mainPlayer)).modeStats, null);
  const stored = JSON.parse((await row(ids.hcPlayer)).modeStats!);
  assert.deepEqual([stored.hardcore.first, stored.hardcore.cur], [{ zulrah: 1 }, { zulrah: 5 }]);

  const [acct] = await db.select().from(s.accounts).where(eq(s.accounts.id, ids.account));
  assert.equal(acct.liveStats, null, 'the account overlay (profile, weekly, other boards) is untouched');
});

test('a mode no board counts is still dropped with the reason', async () => {
  const { POST } = await import('../src/app/api/plugin/stats/route.ts');
  const res = await POST(req('/api/plugin/stats', { stats: [{ name: 'Zulrah', kc: 99 }] }, LEAGUES));
  assert.equal(res.status, 202);
  assert.equal((await res.json()).ignored, 'world-mode');
  assert.equal(JSON.parse((await row(ids.hcPlayer)).modeStats!).leagues, undefined);
});

test('a main-game push is unchanged: the account overlay moves', async () => {
  const { POST } = await import('../src/app/api/plugin/stats/route.ts');
  const res = await POST(req('/api/plugin/stats', { stats: [{ name: 'Zulrah', kc: 2 }] }));
  assert.equal(res.status, 200, await res.clone().text());
  const [acct] = await db.select().from(s.accounts).where(eq(s.accounts.id, ids.account));
  assert.equal(JSON.parse(acct.liveStats!).zulrah, 2);
});

test('hardcore recap counters land on the hardcore board, not the main-only one', async () => {
  const { POST } = await import('../src/app/api/plugin/counters/route.ts');
  const res = await POST(req('/api/plugin/counters', { deaths: 3 }, HARDCORE));
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await row(ids.hcPlayer)).deaths, 3);
  assert.equal((await row(ids.mainPlayer)).deaths ?? 0, 0);
});

test('a hardcore unlock line credits the hardcore board’s clog tile, even for a slot the main log holds', async () => {
  const { POST } = await import('../src/app/api/plugin/clog/route.ts');
  const res = await POST(req('/api/plugin/clog', { unlocks: [{ name: 'Tanzanite fang' }] }, HARDCORE));
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await res.json()).tileSlots, 1);

  const subs = (tileId: number) => db.select().from(s.submissions).where(eq(s.submissions.tileId, tileId));
  const hc = await subs(ids.hcClog);
  assert.equal(hc.length, 1);
  assert.equal(hc[0].itemId, 12922);
  assert.equal((await subs(ids.mainClog)).length, 0, 'the main-game-only board takes nothing');

  // The account's log is the main save's: nothing written to it.
  const items = await db.select().from(s.memberClogItems).where(eq(s.memberClogItems.accountId, ids.account));
  assert.equal(items.length, 1);
  const [header] = await db.select().from(s.memberClog).where(eq(s.memberClog.accountId, ids.account));
  assert.equal(header.obtained, 1);

  // The same line again is the same slot.
  await POST(req('/api/plugin/clog', { unlocks: [{ name: 'Tanzanite fang' }] }, HARDCORE));
  assert.equal((await subs(ids.hcClog)).length, 1);
});

test('a whole-log sync from a mode world is dropped', async () => {
  const { POST } = await import('../src/app/api/plugin/clog/route.ts');
  const res = await POST(req('/api/plugin/clog', { items: [{ id: 12922, q: 1 }, { id: 12921, q: 1 }] }, HARDCORE));
  assert.equal(res.status, 202);
  const items = await db.select().from(s.memberClogItems).where(eq(s.memberClogItems.accountId, ids.account));
  assert.equal(items.length, 1);
});

test('progress (quests, diaries, account type) from a mode world is still dropped', async () => {
  const { POST } = await import('../src/app/api/plugin/progress/route.ts');
  const res = await POST(req('/api/plugin/progress', { progress: [{ key: 'qp', value: 5 }] }, HARDCORE));
  assert.equal(res.status, 202);
});
