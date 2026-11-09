// Clan boosts against a real database (lib/clanBoosts).
//
// What must hold: only a paying Supporter with a member seat ≥14 days old (their own) can place; a
// double submit never overfills the slots; a move waits a week, and so does a removed slot; a lapse
// pauses (keeps) the boosts and a seat that leaves stops counting; a clan counts at most two from one
// person; levels and the "Level-up" badge; strangers can be given a wall with no names; the monthly
// recruitment post is Level 3 only and once a calendar month.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/clan-boosts-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-boosts');
// Beta never posts to the Anvil Discord: the recruitment post is recorded, never sent.
process.env.ANVIL_APEX_DOMAIN = 'beta.anvil.test';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let B: typeof import('../src/lib/clanBoosts.ts');

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const ahead = new Date(Date.now() + 30 * DAY).toISOString();
const ids = {} as Record<string, number>;

async function person(name: string) {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const [u] = await db.insert(s.users).values({ playerId: p.id, displayName: name, discordId: `${name}-id` }).returning();
  return { playerId: p.id, userId: u.id };
}
async function character(playerId: number, rsn: string) {
  const [a] = await db.insert(s.accounts).values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), shared: true }).returning();
  return a.id;
}
async function seat(clanId: number, accountId: number, kind: 'member' | 'guest', joinedDaysAgo: number) {
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId, kind, joinedAt: ago(joinedDaysAgo) }).returning();
  return m.id;
}
async function setTier(userId: number, tier: 'supporter' | 'champion' | 'patron' | null, status = 'active') {
  await db.delete(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, userId));
  if (tier) {
    await db
      .insert(s.supporterSubscriptions)
      .values({ userId, tier, status, recurrence: 'monthly', currentPeriodEnd: ahead, startedAt: '2026-01-01T00:00:00Z' });
  }
}
/** Make a placed boost look `days` old (for the cooldown). */
async function age(boostId: number, days: number) {
  await db.update(s.clanBoosts).set({ placedAt: ago(days) }).where(eq(s.clanBoosts.id, boostId));
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  B = await import('../src/lib/clanBoosts.ts');
  const [alpha] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const [beta] = await db.insert(s.clans).values({ slug: 'beta', name: 'Beta' }).returning();
  ids.alpha = alpha.id;
  ids.beta = beta.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('only a paying Supporter on their own old-enough member seat can place', async () => {
  const me = await person('Me');
  ids.me = me.userId;
  ids.mePlayer = me.playerId;
  const main = await character(me.playerId, 'MyMain');
  const alt = await character(me.playerId, 'MyAlt');
  ids.mainAlpha = await seat(ids.alpha, main, 'member', 30);
  ids.altBetaNew = await seat(ids.beta, alt, 'member', 3);
  ids.mainBetaGuest = await seat(ids.beta, main, 'guest', 60);
  const other = await person('Other');
  const theirs = await character(other.playerId, 'NotMine');
  ids.theirSeat = await seat(ids.alpha, theirs, 'member', 90);

  // No tier: no slots.
  let r = await B.placeBoost(me.userId, me.playerId, ids.mainAlpha);
  assert.equal(r.ok, false);

  // Invite time alone gives no slots.
  await setTier(me.userId, 'patron', 'granted');
  r = await B.placeBoost(me.userId, me.playerId, ids.mainAlpha);
  assert.equal(r.ok, false);

  await setTier(me.userId, 'patron');
  // Someone else's seat, a guest seat, a too-new seat: all refused.
  assert.equal((await B.placeBoost(me.userId, me.playerId, ids.theirSeat)).ok, false);
  assert.equal((await B.placeBoost(me.userId, me.playerId, ids.mainBetaGuest)).ok, false);
  const young = await B.placeBoost(me.userId, me.playerId, ids.altBetaNew);
  assert.equal(young.ok, false);
  if (!young.ok) assert.match(young.error, /3 days old; boostable in 11 days/);

  r = await B.placeBoost(me.userId, me.playerId, ids.mainAlpha);
  assert.equal(r.ok, true);
  const mine = await B.myBoosts(me.userId, me.playerId);
  assert.equal(mine.slots, 2);
  assert.equal(mine.used, 1);
  assert.equal(mine.placements[0].state, 'active');
});

test('a double submit never places more boosts than slots', async () => {
  // Patron: two slots, one used. Fire three at once.
  const results = await Promise.all([1, 2, 3].map(() => B.placeBoost(ids.me, ids.mePlayer, ids.mainAlpha)));
  assert.equal(results.filter((x) => x.ok).length, 1);
  const live = await db.select().from(s.clanBoosts).where(eq(s.clanBoosts.userId, ids.me));
  assert.equal(live.filter((b) => !b.endedAt).length, 2);
  assert.deepEqual(live.map((b) => b.slot).sort(), [1, 2]);
});

test('a move waits a week; a removed slot does too', async () => {
  const [first] = (await B.myBoosts(ids.me, ids.mePlayer)).placements;
  // Age the seat in Beta so it can take a boost.
  await db.update(s.clanMemberships).set({ joinedAt: ago(20) }).where(eq(s.clanMemberships.id, ids.altBetaNew));
  let r = await B.moveBoost(ids.me, ids.mePlayer, first.id, ids.altBetaNew);
  assert.equal(r.ok, false);
  await age(first.id, 8);
  r = await B.moveBoost(ids.me, ids.mePlayer, first.id, ids.altBetaNew);
  assert.equal(r.ok, true);
  const after = await B.myBoosts(ids.me, ids.mePlayer);
  assert.deepEqual(after.placements.map((p) => p.clanName).sort(), ['Alpha', 'Beta']);

  // Remove the fresh one: its slot cools for the rest of its week.
  const fresh = after.placements.find((p) => p.clanName === 'Beta')!;
  assert.equal((await B.removeBoost(ids.me, fresh.id)).ok, true);
  const cooled = await B.myBoosts(ids.me, ids.mePlayer);
  assert.ok(cooled.coolingUntil && cooled.coolingUntil > Date.now());
  assert.equal((await B.placeBoost(ids.me, ids.mePlayer, ids.altBetaNew)).ok, false);
});

test('levels count two per person, lift with a Level-up badge, and pause on a lapse', async () => {
  // Alpha has one of mine. Add a second of mine (free the cooling slot first) and three others'.
  await db.update(s.clanBoosts).set({ reusableAt: null }).where(eq(s.clanBoosts.userId, ids.me));
  assert.equal((await B.placeBoost(ids.me, ids.mePlayer, ids.mainAlpha)).ok, true);
  let level = await B.clanBoostLevel(ids.alpha);
  assert.equal(level.counted, 2);
  assert.equal(level.level, 0);

  const friend = await person('Friend');
  await setTier(friend.userId, 'patron');
  const fSeat = await seat(ids.alpha, await character(friend.playerId, 'FriendMain'), 'member', 100);
  for (let i = 0; i < 3; i++) await B.placeBoost(friend.userId, friend.playerId, fSeat);
  level = await B.clanBoostLevel(ids.alpha);
  // Mine 2 + friend's capped at 2 = 4: Level 1.
  assert.equal(level.counted, 4);
  assert.equal(level.level, 1);
  const lifted = await db.select().from(s.clanBoosts).where(eq(s.clanBoosts.levelUp, 1));
  assert.equal(lifted.length, 1);

  const summary = await B.clanBoostSummary(ids.alpha);
  assert.deepEqual(summary.wall.map((w) => [w.rsn, w.boosts]).sort(), [['FriendMain', 2], ['MyMain', 2]]);
  // Strangers the clan keeps names from: counts only.
  const hidden = await B.clanBoostSummary(ids.alpha, { showNames: false });
  assert.ok(hidden.wall.every((w) => w.rsn === null));
  assert.ok(!JSON.stringify(hidden).includes('MyMain'));

  // My membership lapses: mine pause (kept), the clan drops to 2 counted but keeps Level 1 for its grace week.
  await setTier(ids.me, null);
  level = await B.clanBoostLevel(ids.alpha);
  assert.equal(level.counted, 2);
  assert.equal(level.level, 1);
  assert.ok(level.graceEndsAt && level.graceEndsAt > Date.now());
  const paused = await B.myBoosts(ids.me, ids.mePlayer);
  assert.ok(paused.placements.every((p) => p.state === 'paused'));
  await setTier(ids.me, 'patron');
  assert.equal((await B.clanBoostLevel(ids.alpha)).counted, 4);
});

test('a seat that leaves the roster stops counting; marks follow the seat', async () => {
  const marks = await B.boosterMarks(ids.alpha);
  assert.equal(marks.MyMain, 2);
  await db.update(s.clanMemberships).set({ leftAt: ago(0) }).where(eq(s.clanMemberships.id, ids.mainAlpha));
  assert.equal((await B.clanBoostLevel(ids.alpha)).counted, 2);
  const mine = await B.myBoosts(ids.me, ids.mePlayer);
  assert.ok(mine.placements.filter((p) => p.clanName === 'Alpha').every((p) => p.state === 'seat-gone' && p.movableAt === 0));
  await db.update(s.clanMemberships).set({ leftAt: null }).where(eq(s.clanMemberships.id, ids.mainAlpha));
});

test('the recruiting line needs Level 2; the Discord post Level 3 and once a month', async () => {
  const line = await B.setRecruitingLine(ids.alpha, 'Weekend raids', ids.me);
  assert.equal(line.ok, false);
  assert.equal((await B.setRecruitingLine(ids.alpha, '', ids.me)).ok, true);
  const post = await B.sendRecruitPost(ids.alpha, 'We are recruiting PvMers for weekend raids!', ids.me);
  assert.equal(post.ok, false);

  // Force Level 3 through the stored level (grace) to test the post's monthly limit.
  await db
    .insert(s.clanBoostState)
    .values({ clanId: ids.alpha, level: 3, droppedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: s.clanBoostState.clanId, set: { level: 3, droppedAt: new Date().toISOString() } });
  assert.equal((await B.setRecruitingLine(ids.alpha, '@everyone Weekend raids', ids.me)).ok, true);
  const [state] = await db.select().from(s.clanBoostState).where(eq(s.clanBoostState.clanId, ids.alpha));
  assert.ok(!state.recruitingLine!.includes('@everyone'));

  const [a, b] = await Promise.all([
    B.sendRecruitPost(ids.alpha, 'We are recruiting PvMers for weekend raids!', ids.me),
    B.sendRecruitPost(ids.alpha, 'We are recruiting PvMers for weekend raids!', ids.me),
  ]);
  assert.equal([a, b].filter((x) => x.ok).length, 1);
  const again = await B.sendRecruitPost(ids.alpha, 'Another post this same month, please?', ids.me);
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.status, 429);
});

test('a staff gift gives boost slots only when granted with them', async () => {
  const G = await import('../src/lib/supporterGifts.ts');
  const giftee = await person('Giftee');
  const gSeat = await seat(ids.beta, await character(giftee.playerId, 'GifteeMain'), 'member', 60);
  await G.giveGift({ userId: giftee.userId, tier: 'patron', days: 30, actorUserId: ids.me });
  assert.equal((await B.boostSlotsFor(giftee.userId)).slots, 0);
  assert.equal((await B.placeBoost(giftee.userId, giftee.playerId, gSeat)).ok, false);
  const withSlots = await G.giveGift({ userId: giftee.userId, tier: 'patron', days: 30, actorUserId: ids.me, boostSlots: true });
  assert.equal(withSlots.boostSlots, true);
  assert.equal((await B.boostSlotsFor(giftee.userId)).slots, 2);
  assert.equal((await B.placeBoost(giftee.userId, giftee.playerId, gSeat)).ok, true);
  const listed = await G.listGifts(giftee.userId);
  assert.deepEqual(listed.map((g) => g.boostSlots).sort(), [false, true]);
});

test('the hourly reconcile records a drop when it happens, and only once an hour', async () => {
  // Beta is at whatever level the last test left; give it a clean Level 1 from three boosters.
  await db.delete(s.clanBoostState).where(eq(s.clanBoostState.clanId, ids.beta));
  const people = await Promise.all(['R1', 'R2', 'R3'].map((n) => person(n)));
  for (const p of people) {
    await setTier(p.userId, 'champion');
    const st = await seat(ids.beta, await character(p.playerId, `${p.userId}Char`), 'member', 30);
    assert.equal((await B.placeBoost(p.userId, p.playerId, st)).ok, true);
  }
  await db.delete(s.platformSettings).where(eq(s.platformSettings.key, 'clan_boosts_reconciled_at'));
  const t0 = Date.now();
  assert.ok((await B.reconcileClanBoostLevels(t0)) >= 0);
  const lvl = async () => (await db.select().from(s.clanBoostState).where(eq(s.clanBoostState.clanId, ids.beta)))[0];
  assert.ok((await lvl()).level >= 1);

  // Three lapse; nobody opens a page. Within the hour the sweep is not due…
  for (const p of people) await setTier(p.userId, null);
  assert.equal(await B.reconcileClanBoostLevels(t0 + 10 * 60_000), -1);
  // …an hour on it runs, and the grace starts at that run, not at some later page view.
  const t1 = t0 + B.RECONCILE_EVERY_MS;
  assert.ok((await B.reconcileClanBoostLevels(t1)) >= 1);
  const row = await lvl();
  assert.ok(row.level >= 1, 'perks kept through the grace week');
  assert.equal(Date.parse(row.droppedAt!), t1);
  // Running again changes nothing (idempotent).
  await db.delete(s.platformSettings).where(eq(s.platformSettings.key, 'clan_boosts_reconciled_at'));
  assert.equal(await B.reconcileClanBoostLevels(t1 + 60_000), 0);
  assert.equal(Date.parse((await lvl()).droppedAt!), t1);
});
