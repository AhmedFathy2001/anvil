// Creator-space plans against a real database (lib/creatorPlans + lib/creatorPlansDb): the meter
// counts one event's board, a full event turns a stranger away only once FREEMIUM_ENFORCED is on,
// and the !join bot, overlay mark and directory follow the plan.
//
// Run: npm run test:creator-plans   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('creator-plans');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/clanCreate.ts');
let E: typeof import('../src/lib/eventEntry.ts');
let P: typeof import('../src/lib/creatorPlansDb.ts');
let Bot: typeof import('../src/lib/twitchBot/channels.ts');
let O: typeof import('../src/lib/overlay/overlayData.ts');

let n = 0;
async function person(name: string): Promise<{ userId: number; playerId: number; accountId: number }> {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: new Date().toISOString() })
    .returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: pl.id, displayName: name, discordId: `99400000000000${String(n).padStart(4, '0')}` })
    .returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id };
}

/** `count` players seated as guests and signed up to the event (status pending). */
async function fill(clanId: number, eventId: number, count: number, tag: string): Promise<void> {
  const pls = await db
    .insert(s.players)
    .values(Array.from({ length: count }, (_, i) => ({ displayName: `${tag}${i}` })))
    .returning();
  const accs = await db
    .insert(s.accounts)
    .values(pls.map((p, i) => ({ playerId: p.id, rsn: `${tag}${i}`, rsnNormalized: `${tag}${i}`.toLowerCase(), verifiedAt: new Date().toISOString() })))
    .returning();
  const seats = await db
    .insert(s.clanMemberships)
    .values(accs.map((a) => ({ clanId, accountId: a.id, kind: 'guest', source: 'web' })))
    .returning();
  await db.insert(s.eventSignups).values(seats.map((m) => ({ eventId, clanMemberId: m.id, status: 'pending' })));
}

let host: Awaited<ReturnType<typeof person>>;
let spaceId: number;
let eventId: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/clanCreate.ts');
  E = await import('../src/lib/eventEntry.ts');
  P = await import('../src/lib/creatorPlansDb.ts');
  Bot = await import('../src/lib/twitchBot/channels.ts');
  O = await import('../src/lib/overlay/overlayData.ts');
  host = await person('Plan Host');
  const r = await C.createCreatorSpace({ slug: 'plan-host', name: 'Plan Host', ownerUserId: host.userId });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  spaceId = r.clanId;
  [{ id: eventId }] = await db
    .insert(s.events)
    .values({ clanId: spaceId, name: 'Packed Bingo', boardSize: 5, entry: 'open', startDate: '2026-11-01T00:00:00.000Z' })
    .returning();
});

afterEach(() => {
  delete process.env.FREEMIUM_ENFORCED;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the meter counts one event’s board, and live events are the ones not ended', async () => {
  await fill(spaceId, eventId, 50, 'pk');
  assert.equal(await P.eventPlayerCount(eventId), 50);
  const [ended] = await db
    .insert(s.events)
    .values({ clanId: spaceId, name: 'Old Bingo', boardSize: 5, startDate: '2026-11-01T00:00:00.000Z', forceEndedAt: new Date().toISOString() })
    .returning();
  await fill(spaceId, ended.id, 3, 'old');
  assert.equal(await P.liveEventCount(spaceId), 1, 'the ended event is not live');
  await db.insert(s.events).values({ clanId: spaceId, name: 'Someday Bingo', boardSize: 5 });
  assert.equal(await P.liveEventCount(spaceId), 1, 'an undated draft is not live either');
  assert.deepEqual(await P.biggestCreatorEvent(spaceId), { id: eventId, name: 'Packed Bingo', players: 50 });
  assert.equal(await P.creatorPlanOfClan(spaceId), 'free');
});

test('a full Free event: still seats while generous, says "full" once enforced', async () => {
  const late = await person('Late Viewer');
  const enter = () => E.enterEvent({ eventId, playerId: late.playerId, accountId: late.accountId, actorUserId: late.userId });

  process.env.FREEMIUM_ENFORCED = 'true';
  const refused = await enter();
  assert.equal(refused.outcome, 'refused');
  assert.equal(refused.outcome === 'refused' && refused.reason, 'full');
  assert.match(refused.outcome === 'refused' ? refused.error : '', /This event is full/);
  const seat = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.accountId, late.accountId) });
  assert.equal(seat, undefined, 'nobody seated');

  // On Bronze there is room again.
  await db.update(s.clans).set({ plan: 'bronze' }).where(eq(s.clans.id, spaceId));
  assert.equal((await enter()).outcome, 'seated');
  await db.update(s.clans).set({ plan: 'free' }).where(eq(s.clans.id, spaceId));

  delete process.env.FREEMIUM_ENFORCED;
  const other = await person('Generous Viewer');
  const r = await E.enterEvent({ eventId, playerId: other.playerId, accountId: other.accountId, actorUserId: other.userId });
  assert.equal(r.outcome, 'seated', 'generous phase: nobody is turned away');
});

test('!join: the bot skips a space whose plan lacks it, only once enforced', async () => {
  await db.insert(s.settings).values({ clanId: spaceId, key: 'creator_twitch_chat_join', value: 'on' });
  await db.insert(s.clanTwitchChannels).values({
    clanId: spaceId,
    twitchUserId: '123456',
    twitchLogin: 'planhost',
    accessToken: 'x',
    refreshToken: 'x',
    expiresAt: new Date().toISOString(),
    scope: '',
  });
  assert.deepEqual((await Bot.chatBotChannels()).map((c) => c.clanId), [spaceId]);
  process.env.FREEMIUM_ENFORCED = 'true';
  assert.deepEqual(await Bot.chatBotChannels(), [], 'Free has no !join once enforced');
  await db.update(s.clans).set({ plan: 'silver' }).where(eq(s.clans.id, spaceId));
  assert.deepEqual((await Bot.chatBotChannels()).map((c) => c.clanId), [spaceId]);
  await db.update(s.clans).set({ plan: 'free' }).where(eq(s.clans.id, spaceId));
});

test('overlay mark: on for a creator space by default, hideable per plan; never on a clan', async () => {
  assert.equal(await O.readOverlayMark(spaceId), true, 'shown by default');
  await db.insert(s.settings).values({ clanId: spaceId, key: P.OVERLAY_HIDE_MARK_SETTING, value: 'on' });
  assert.equal(await O.readOverlayMark(spaceId), false, 'generous: anyone may hide it');
  process.env.FREEMIUM_ENFORCED = 'true';
  assert.equal(await O.readOverlayMark(spaceId), true, 'Free cannot hide it once enforced');
  await db.update(s.clans).set({ plan: 'gold' }).where(eq(s.clans.id, spaceId));
  assert.equal(await O.readOverlayMark(spaceId), false, 'Gold can');
  await db.update(s.clans).set({ plan: 'free' }).where(eq(s.clans.id, spaceId));

  // An ordinary clan's overlay never carries it.
  const [clan] = await db.insert(s.clans).values({ slug: 'plain-clan', name: 'Plain Clan' }).returning();
  assert.equal(await O.readOverlayMark(clan.id), false);
});

/** `count` guest seats in a clan (no sign-ups), for racing sign-ups onto. */
async function seats(clanId: number, count: number, tag: string): Promise<number[]> {
  const pls = await db.insert(s.players).values(Array.from({ length: count }, (_, i) => ({ displayName: `${tag}${i}` }))).returning();
  const accs = await db
    .insert(s.accounts)
    .values(pls.map((p, i) => ({ playerId: p.id, rsn: `${tag}${i}`, rsnNormalized: `${tag}${i}`.toLowerCase(), verifiedAt: new Date().toISOString() })))
    .returning();
  const rows = await db.insert(s.clanMemberships).values(accs.map((a) => ({ clanId, accountId: a.id, kind: 'guest', source: 'web' }))).returning();
  return rows.map((r) => r.id);
}

test('two sign-ups racing for the last place: exactly one gets it', async () => {
  const [{ id: race }] = await db.insert(s.events).values({ clanId: spaceId, name: 'Race Bingo', boardSize: 5 }).returning();
  await fill(spaceId, race, 49, 'rc');
  const [a, b] = await seats(spaceId, 2, 'racer');
  process.env.FREEMIUM_ENFORCED = 'true';
  const signUp = (seat: number) =>
    P.withEventRoom({ eventId: race, clanPlan: 'free', adding: 1 }, (tx) =>
      tx.insert(s.eventSignups).values({ eventId: race, clanMemberId: seat, status: 'pending' }).returning(),
    );
  const results = await Promise.allSettled([signUp(a), signUp(b)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, JSON.stringify(results));
  const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.ok(failed.reason instanceof P.PlanLimitError, String(failed.reason));
  assert.equal(await P.eventPlayerCount(race), 50, 'the loser’s row was rolled back');

  // Not metered (generous phase passes null): both would go in.
  const [c] = await seats(spaceId, 1, 'free-for-now');
  await P.withEventRoom({ eventId: race, clanPlan: null, adding: 1 }, (tx) =>
    tx.insert(s.eventSignups).values({ eventId: race, clanMemberId: c, status: 'pending' }),
  );
  assert.equal(await P.eventPlayerCount(race), 51);
  await db.delete(s.events).where(eq(s.events.id, race));
});

test('a rejected sign-up does not count, so it cannot be traded for a place', async () => {
  const [{ id: ev }] = await db.insert(s.events).values({ clanId: spaceId, name: 'Rejects', boardSize: 5 }).returning();
  await fill(spaceId, ev, 50, 'rj');
  const [seat] = await seats(spaceId, 1, 'rejected');
  await db.insert(s.eventSignups).values({ eventId: ev, clanMemberId: seat, status: 'rejected' });
  assert.equal(await P.eventPlayerCount(ev), 50, 'rejected is not on the board');
  await db.delete(s.events).where(eq(s.events.id, ev));
});

test('two creates at once on a one-at-a-time plan: exactly one is made', async () => {
  const p = await person('Racing Host');
  const r = await C.createCreatorSpace({ slug: 'racing-host', name: 'Racing Host', ownerUserId: p.userId });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const create = (name: string) =>
    P.withLiveEventSlot({ clanId: r.clanId, clanPlan: 'free' }, (tx) =>
      tx.insert(s.events).values({ clanId: r.clanId, name, boardSize: 5, startDate: '2026-11-01T00:00:00.000Z' }).returning(),
    );
  process.env.FREEMIUM_ENFORCED = 'true';
  const results = await Promise.allSettled([create('One'), create('Two')]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1, JSON.stringify(results));
  assert.equal(await P.liveEventCount(r.clanId), 1);

  // RESUME over the limit: a force-ended event coming back while another is live is refused…
  const [ended] = await db
    .insert(s.events)
    .values({ clanId: r.clanId, name: 'Ended', boardSize: 5, startDate: '2026-11-01T00:00:00.000Z', forceEndedAt: new Date().toISOString() })
    .returning();
  const resume = () =>
    P.withLiveEventSlot({ clanId: r.clanId, clanPlan: 'free', exceptEventId: ended.id }, (tx) =>
      tx.update(s.events).set({ forceEndedAt: null }).where(eq(s.events.id, ended.id)).returning(),
    );
  await assert.rejects(resume(), (e) => e instanceof P.PlanLimitError);
  assert.equal((await db.query.events.findFirst({ where: eq(s.events.id, ended.id) }))?.forceEndedAt != null, true, 'still ended');

  // …and allowed once the other one has ended (the event itself is not counted against itself).
  await db
    .update(s.events)
    .set({ forceEndedAt: new Date().toISOString() })
    .where(eq(s.events.clanId, r.clanId));
  await db.update(s.events).set({ forceEndedAt: new Date().toISOString() }).where(eq(s.events.id, ended.id));
  await resume();
  assert.equal(await P.liveEventCount(r.clanId), 1);

  // Silver runs several: a second resume-style reopen passes.
  const [other] = await db
    .insert(s.events)
    .values({ clanId: r.clanId, name: 'Other', boardSize: 5, startDate: '2026-11-01T00:00:00.000Z', forceEndedAt: new Date().toISOString() })
    .returning();
  await P.withLiveEventSlot({ clanId: r.clanId, clanPlan: 'silver', exceptEventId: other.id }, (tx) =>
    tx.update(s.events).set({ forceEndedAt: null }).where(eq(s.events.id, other.id)),
  );
  assert.equal(await P.liveEventCount(r.clanId), 2);
});

test('a second live event: refused on Free once enforced, fine on Silver', async () => {
  const CP = await import('../src/lib/creatorPlans.ts');
  const live = await P.liveEventCount(spaceId);
  assert.equal(CP.newEventVerdict({ clanPlan: 'free', liveEvents: live }).ok, true, 'generous');
  process.env.FREEMIUM_ENFORCED = 'true';
  assert.equal(CP.newEventVerdict({ clanPlan: 'free', liveEvents: live }).ok, false);
  assert.equal(CP.newEventVerdict({ clanPlan: 'silver', liveEvents: live }).ok, true);
});
