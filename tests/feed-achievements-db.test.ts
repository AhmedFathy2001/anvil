// Clan-wide achievements against a real database (lib/momentsStore): kept with nothing running, for
// member seats only, once each, listed in the clan feed, and swept after 30 days unless a board or a
// week holds them.
//
// Run: npx tsx --test tests/feed-achievements-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('feed-achievements');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let M: typeof import('../src/lib/momentsStore.ts');
let F: typeof import('../src/lib/pluginUi/feedUi.ts');

let clanId: number;
let eventId: number;
const seat: Record<'member' | 'guest', { clanMemberId: number; rsn: string }> = {} as never;

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  M = await import('../src/lib/momentsStore.ts');
  F = await import('../src/lib/pluginUi/feedUi.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'ach', name: 'Achievers' }).returning();
  clanId = clan.id;
  // A board that has not started: nothing is running for anyone.
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Old bingo', boardSize: 5 }).returning();
  eventId = ev.id;
  for (const kind of ['member', 'guest'] as const) {
    const rsn = kind === 'member' ? 'Rikkert' : 'Visitor';
    const [pl] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind, source: 'test' }).returning();
    seat[kind] = { clanMemberId: m.id, rsn };
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const clog = (key = 'clog|dragon warhammer') => ({ kind: 'clog' as const, itemName: 'Dragon warhammer', occurredAt: now(), dedupKey: key });

async function push(who: 'member' | 'guest', observations: Parameters<typeof M.recordSeatMoments>[1]) {
  const scopes = await M.activeScopesFor(seat[who].clanMemberId, clanId);
  assert.equal(scopes.weeklies.length + (scopes.event ? 1 : 0), 0, 'nothing is running');
  return M.recordSeatMoments(seat[who], observations, scopes);
}

test('with nothing running, a member’s achievement is kept and listed in the clan feed', async () => {
  const r = await push('member', [
    clog(),
    { kind: 'diary', itemName: 'Varrock', tier: 'Hard', occurredAt: now(), dedupKey: 'diary|varrock|hard' },
    { kind: 'level', itemName: 'Slayer', quantity: 99, sourceKind: 'skill', occurredAt: now(), dedupKey: 'level|slayer|99' },
    { kind: 'level', itemName: 'Cooking', quantity: 70, sourceKind: 'skill', occurredAt: now(), dedupKey: 'level|cooking|70' },
    // Drops and pets still need something running.
    { kind: 'pet', itemName: 'Heron', occurredAt: now(), dedupKey: 'pet|heron' },
  ]);
  assert.equal(r.idle, true);
  assert.equal(r.seatKind, 'member');
  assert.deepEqual(r.inserted.map((m) => m.kind).sort(), ['clog', 'diary', 'level']);
  const clogRow = r.inserted.find((m) => m.kind === 'clog')!;
  assert.ok(clogRow.itemId != null, 'the slot carries its icon');
  assert.equal(r.inserted.find((m) => m.kind === 'level')!.sourceKind, 'skill');

  const feed = await M.momentsForClan(clanId, 80);
  assert.deepEqual(feed.map((m) => m.kind).sort(), ['clog', 'diary', 'level']);
  const rows = feed.filter((m) => F.kindGroup(m.kind) === 'achievements').map((m) => F.momentTitle(m));
  assert.ok(rows.includes('Dragon warhammer'));
  assert.ok(rows.includes('99 Slayer'));
  assert.ok(rows.includes('Hard Varrock'));
});

test('a guest seat’s achievement is not kept for the clan', async () => {
  const r = await push('guest', [{ kind: 'quest', itemName: 'Dragon Slayer II', occurredAt: now(), dedupKey: 'quest|dragon slayer ii' }]);
  assert.equal(r.stored, 0);
  const rows = await db.select().from(s.moments).where(eq(s.moments.clanMemberId, seat.guest.clanMemberId));
  assert.equal(rows.length, 0);
  assert.ok(!(await M.momentsForClan(clanId, 80)).some((m) => m.rsn === 'Visitor'));
});

test('game-mode moments live behind their own timeline; Fallen also appears under Deaths', async () => {
  const scopes = await M.activeScopesFor(seat.member.clanMemberId, clanId);
  const r = await M.recordModeMoments(seat.member, [
    { kind: 'pet', itemName: 'Pet snakeling', occurredAt: now(), dedupKey: 'mode-pet' },
    { kind: 'death', source: 'Vorkath', tier: 'hardcore', occurredAt: now(), dedupKey: 'mode-fallen' },
  ], scopes.clan, { key: 'hardcore', label: 'Hardcore' });
  assert.equal(r.stored, 2);
  assert.ok(r.inserted.every((m) => m.worldMode === 'hardcore'));
  const leagues = await M.recordModeMoments(seat.member, [
    // A combat task always names its tier (Observation.tier): one under the clan's floor keeps nothing.
    { kind: 'ca', taskName: 'League task', tier: 'Grandmaster', occurredAt: now(), dedupKey: 'mode-league-task' },
  ], scopes.clan, { key: 'leagues', label: 'Leagues' });
  assert.equal(leagues.stored, 1);

  const ordinary = await M.momentsForClan(clanId, 80);
  assert.ok(ordinary.every((m) => !m.worldMode), 'mode rows stay out of All');
  const deaths = await M.momentsForClan(clanId, 80, ['death']);
  assert.ok(deaths.some((m) => m.worldMode === 'hardcore'), 'Fallen is still reachable through Deaths');
  const modes = await M.modeMomentsForClan(clanId, 80);
  assert.deepEqual(modes.map((m) => m.kind).sort(), ['ca', 'death', 'pet']);
  assert.deepEqual((await M.modeMomentsForClan(clanId, 80, undefined, 'hardcore')).map((m) => m.kind).sort(), ['death', 'pet']);
  assert.deepEqual((await M.modeMomentsForClan(clanId, 80, undefined, 'leagues')).map((m) => m.kind), ['ca']);
  assert.deepEqual(await M.modeMomentModesForClan(clanId), [
    { key: 'hardcore', label: 'Hardcore' },
    { key: 'leagues', label: 'Leagues' },
  ]);
  assert.equal(await M.recentModeMomentCount(clanId), 3);
});

test('a log slot is stored once', async () => {
  const again = await push('member', [clog(), clog()]);
  assert.equal(again.stored, 0);
  const rows = await db.select().from(s.moments).where(eq(s.moments.kind, 'clog'));
  assert.equal(rows.length, 1);
});

test('an achievement a board already holds is not stored again for the clan', async () => {
  await db.insert(s.moments).values({
    clanMemberId: seat.member.clanMemberId,
    rsn: 'Rikkert',
    kind: 'level',
    eventId,
    itemName: 'Attack',
    quantity: 99,
    sourceKind: 'skill',
    occurredAt: now(),
    dedupKey: 'level|attack|99:e' + eventId,
  });
  const r = await push('member', [{ kind: 'level', itemName: 'Attack', quantity: 99, sourceKind: 'skill', occurredAt: now(), dedupKey: 'level|attack|99' }]);
  assert.equal(r.stored, 0);
  const attack = (await M.momentsForClan(clanId, 80)).filter((m) => m.itemName === 'Attack');
  assert.equal(attack.length, 1, 'one line on the clan feed');
});

test('the 30-day sweep removes only clan-wide achievements', async () => {
  const base = { clanMemberId: seat.member.clanMemberId, rsn: 'Rikkert', quantity: 1 };
  await db.insert(s.moments).values([
    { ...base, kind: 'quest', itemName: 'Old quest', occurredAt: daysAgo(31), dedupKey: 'quest|old:clan' },
    { ...base, kind: 'ca', itemName: 'Old task', tier: 'Elite', occurredAt: daysAgo(40), dedupKey: 'ca|old:clan' },
    { ...base, kind: 'ca', itemName: 'Board task', tier: 'Elite', eventId, occurredAt: daysAgo(40), dedupKey: `ca|board:e${eventId}` },
    { ...base, kind: 'pet', itemName: 'Old pet', occurredAt: daysAgo(40), dedupKey: 'pet|old:clan' },
    { ...base, kind: 'clog', itemName: 'Fresh slot', occurredAt: daysAgo(29), dedupKey: 'clog|fresh:clan' },
  ]);
  const gone = await M.sweepClanAchievements();
  assert.equal(gone, 2);
  const left = (await db.select({ name: s.moments.itemName }).from(s.moments).where(eq(s.moments.clanMemberId, seat.member.clanMemberId))).map((r) => r.name);
  assert.ok(!left.includes('Old quest') && !left.includes('Old task'), 'old clan-wide achievements go');
  assert.ok(left.includes('Board task'), 'a board’s row stays with the board');
  assert.ok(left.includes('Old pet'), 'not an achievement');
  assert.ok(left.includes('Fresh slot'), 'under 30 days');
  assert.equal(await M.sweepClanAchievements(), 0);
});
