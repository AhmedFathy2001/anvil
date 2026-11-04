// Friends events against a real database (lib/friendEvents + lib/friendEventRules): a Supporter's
// hidden host, the invite link, the per-tier caps (live events, and seats held at once across
// overlapping events), independence from creator plans, and staying off every public listing.
//
// Run: TEST_DATABASE_URL=postgres://… npx tsx --test tests/friend-events-db.test.ts

import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, inArray } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('friend-events');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let F: typeof import('../src/lib/friendEvents.ts');
let E: typeof import('../src/lib/eventEntry.ts');
let A: typeof import('../src/lib/eventAccess.ts');
let C: typeof import('../src/lib/clanCreate.ts');
let P: typeof import('../src/lib/creatorPlansDb.ts');
let CP: typeof import('../src/lib/creatorPlans.ts');
let D: typeof import('../src/lib/eventsDirectoryDb.ts');
let M: typeof import('../src/lib/myClans.ts');
let L: typeof import('../src/lib/clanListing.ts');

const H = 3_600_000;
const iso = (hFromNow: number) => new Date(Date.now() + hFromNow * H).toISOString();

let n = 0;
async function person(name: string, tier?: 'supporter' | 'champion' | 'patron') {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: new Date().toISOString() })
    .returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: pl.id, displayName: name, discordId: `99500000000000${String(n).padStart(4, '0')}` })
    .returning();
  if (tier) await setTier(u.id, tier);
  return { userId: u.id, playerId: pl.id, accountId: a.id, name };
}

async function setTier(userId: number, tier: 'supporter' | 'champion' | 'patron' | null) {
  await db.delete(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, userId));
  if (tier) await db.insert(s.supporterSubscriptions).values({ userId, tier, status: 'active', startedAt: '2026-01-01 00:00:00' });
}

/** A friends event made the way the create route makes one (withHostEventSlot + the forced fields). */
async function friendsEvent(host: { id: number; kind?: string | null }, name: string, start: string | null, end: string | null) {
  return F.withHostEventSlot(host, { clanId: host.id, clanPlan: null }, async (tx) => {
    const [ev] = await tx
      .insert(s.events)
      .values({ clanId: host.id, name, boardSize: 5, visibility: 'invited', entry: 'open', advertised: false, inviteToken: F.newInviteToken(), startDate: start, endDate: end })
      .returning();
    return ev;
  });
}

/** `count` strangers on this event: an event seat and an on-board sign-up each (no cap check — setup). */
async function fill(clanId: number, eventId: number, count: number, tag: string) {
  const pls = await db.insert(s.players).values(Array.from({ length: count }, (_, i) => ({ displayName: `${tag}${i}` }))).returning();
  const accs = await db
    .insert(s.accounts)
    .values(pls.map((p, i) => ({ playerId: p.id, rsn: `${tag}${i}`, rsnNormalized: `${tag}${i}`.toLowerCase(), verifiedAt: new Date().toISOString() })))
    .returning();
  const seats = await db.insert(s.clanMemberships).values(accs.map((a) => ({ clanId, accountId: a.id, kind: 'event', eventId, source: 'web' }))).returning();
  await db.insert(s.eventSignups).values(seats.map((m) => ({ eventId, clanMemberId: m.id, status: 'approved' })));
  return accs;
}

/** One sign-up through the real gate (withHostEventRoom), for a seat already made. */
async function signUp(eventId: number, seatId: number) {
  return F.withHostEventRoom({ eventId, clanPlan: null, adding: 1 }, (tx) =>
    tx.insert(s.eventSignups).values({ eventId, clanMemberId: seatId, status: 'pending' }).returning(),
  );
}

async function hostRow(id: number) {
  return (await db.query.clans.findFirst({ where: eq(s.clans.id, id) }))!;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  F = await import('../src/lib/friendEvents.ts');
  E = await import('../src/lib/eventEntry.ts');
  A = await import('../src/lib/eventAccess.ts');
  C = await import('../src/lib/clanCreate.ts');
  P = await import('../src/lib/creatorPlansDb.ts');
  CP = await import('../src/lib/creatorPlans.ts');
  D = await import('../src/lib/eventsDirectoryDb.ts');
  M = await import('../src/lib/myClans.ts');
  L = await import('../src/lib/clanListing.ts');
});

afterEach(() => {
  delete process.env.FREEMIUM_ENFORCED;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a Supporter gets a hidden host on first use; a non-Supporter is refused', async () => {
  const sup = await person('Fe Sup', 'supporter');
  const r = await F.ensureFriendsHost(sup.userId);
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  const again = await F.ensureFriendsHost(sup.userId);
  assert.equal(again.ok && again.host.id, r.host.id, 'one host per person');
  const row = await hostRow(r.host.id);
  assert.equal(row.kind, 'friends');
  assert.equal(row.visibility, 'members');
  assert.equal(row.platformHidden, true);
  assert.equal(row.inGameName, null);
  assert.equal(row.friendsOwnerUserId, sup.userId);
  const staff = await db.query.clanStaff.findFirst({ where: and(eq(s.clanStaff.clanId, r.host.id), eq(s.clanStaff.userId, sup.userId)) });
  assert.equal(staff?.role, 'owner');

  const free = await person('Fe Free');
  const no = await F.ensureFriendsHost(free.userId);
  assert.equal(no.ok, false);
  assert.equal(!no.ok && no.reason, 'not-supporter');
  assert.equal(await F.friendsHostOf(free.userId), null);
});

test('creating an event needs a tier in force; a lapsed host keeps its events but cannot add one', async () => {
  const p = await person('Fe Lapse', 'supporter');
  const r = await F.ensureFriendsHost(p.userId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const host = await hostRow(r.host.id);
  const ev = await friendsEvent(host, 'Lapse Bingo', null, null);
  assert.ok(ev.id);
  await setTier(p.userId, null);
  await assert.rejects(() => friendsEvent(host, 'Second', null, null), (e: Error) => e instanceof P.PlanLimitError && /Supporter perk/.test(e.message));
  assert.ok(await db.query.events.findFirst({ where: eq(s.events.id, ev.id) }), 'the first event is still there');
  // An edit to the existing event that changes no dates goes through.
  await F.withHostEventSlot(host, { clanId: host.id, clanPlan: null, exceptEventId: ev.id }, (tx) => tx.update(s.events).set({ name: 'Renamed' }).where(eq(s.events.id, ev.id)));
});

test('live events at once: Supporter and Champion run one, a Patron two', async () => {
  for (const [tier, limit] of [['supporter', 1], ['champion', 1], ['patron', 2]] as const) {
    const p = await person(`Fe Live ${tier}`, tier);
    const r = await F.ensureFriendsHost(p.userId);
    assert.ok(r.ok);
    if (!r.ok) return;
    const host = await hostRow(r.host.id);
    for (let i = 0; i < limit; i++) await friendsEvent(host, `${tier} live ${i}`, iso(-1), iso(24));
    await assert.rejects(() => friendsEvent(host, `${tier} one too many`, iso(-1), iso(24)), (e: Error) => e instanceof P.PlanLimitError, tier);
    // A draft is not live: still allowed.
    await friendsEvent(host, `${tier} draft`, null, null);
    // A finished event does not count either.
    await friendsEvent(host, `${tier} done`, iso(-48), iso(-24));
  }
});

test('the invite link: invisible without it, visible once pressed, dead once replaced', async () => {
  const owner = await person('Fe Owner', 'supporter');
  const friend = await person('Fe Friend');
  const r = await F.ensureFriendsHost(owner.userId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const ev = await friendsEvent(await hostRow(r.host.id), 'Invite Bingo', null, null);
  assert.equal(await A.canSeeEvent({ eventId: ev.id, playerId: friend.playerId }), false, 'private without the link');
  assert.equal(await A.canSeeEvent({ eventId: ev.id, playerId: null }), false, 'and to strangers signed out');

  const target = await F.acceptInvite({ token: ev.inviteToken!, playerId: friend.playerId, userId: friend.userId });
  assert.equal(target?.eventId, ev.id);
  assert.equal(await A.canSeeEvent({ eventId: ev.id, playerId: friend.playerId }), true);

  // Join: an EVENT seat, never a member or guest one.
  const res = await E.enterEvent({ eventId: ev.id, playerId: friend.playerId, accountId: friend.accountId, actorUserId: friend.userId });
  assert.equal(res.outcome, 'seated', JSON.stringify(res));
  const seat = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.accountId, friend.accountId) });
  assert.equal(seat?.kind, 'event');
  assert.equal(seat?.eventId, ev.id);

  // The owner plays their own board on an event seat too, never a member seat.
  const own = await E.enterEvent({ eventId: ev.id, playerId: owner.playerId, accountId: owner.accountId, actorUserId: owner.userId });
  assert.ok(own.outcome === 'seated' || own.outcome === 'insider', JSON.stringify(own));
  const ownerSeats = await db.query.clanMemberships.findMany({ where: eq(s.clanMemberships.accountId, owner.accountId) });
  assert.ok(ownerSeats.every((m) => m.kind !== 'member'), 'nobody is a member of a friends host');

  const old = ev.inviteToken!;
  const fresh = await F.rotateInviteToken(ev.id);
  assert.ok(fresh && fresh !== old);
  assert.equal(await F.inviteTarget(old), null, 'the old link stops working');
  assert.equal((await F.inviteTarget(fresh!))?.eventId, ev.id);
});

test('join cap: a Supporter event holds 10 seats; the 11th is refused at entry and at sign-up', async () => {
  const owner = await person('Fe Cap', 'supporter');
  const r = await F.ensureFriendsHost(owner.userId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const host = await hostRow(r.host.id);
  const ev = await friendsEvent(host, 'Cap Bingo', iso(-1), iso(24));
  await fill(host.id, ev.id, 10, 'capf');

  const late = await person('Fe Late');
  await F.acceptInvite({ token: ev.inviteToken!, playerId: late.playerId, userId: late.userId });
  const refused = await E.enterEvent({ eventId: ev.id, playerId: late.playerId, accountId: late.accountId, actorUserId: late.userId });
  assert.equal(refused.outcome, 'refused');
  assert.equal(refused.outcome === 'refused' && refused.reason, 'full');

  // Even with a seat in hand (a race past the early check), the sign-up itself is refused under the lock.
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: host.id, accountId: late.accountId, kind: 'event', eventId: ev.id, source: 'web' }).returning();
  await assert.rejects(() => signUp(ev.id, seat.id), (e: Error) => e instanceof P.PlanLimitError && /full/.test(e.message));
  const rows = await db.query.eventSignups.findMany({ where: eq(s.eventSignups.eventId, ev.id) });
  assert.equal(rows.length, 10, 'rolled back');

  // Enforced always: FREEMIUM_ENFORCED off changes nothing for a friends event.
  delete process.env.FREEMIUM_ENFORCED;
  await assert.rejects(() => signUp(ev.id, seat.id));

  // Champion: room for 15 more.
  await setTier(owner.userId, 'champion');
  await signUp(ev.id, seat.id);
  assert.equal(await P.eventPlayerCount(ev.id), 11);
});

test('the Patron 50 is shared by overlapping events, and whole for events that never overlap', async () => {
  const owner = await person('Fe Patron', 'patron');
  const r = await F.ensureFriendsHost(owner.userId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const host = await hostRow(r.host.id);
  const a = await friendsEvent(host, 'Overlap A', iso(-1), iso(48));
  const b = await friendsEvent(host, 'Overlap B', iso(24), iso(72)); // overlaps A for a day
  await fill(host.id, a.id, 30, 'ova');
  await fill(host.id, b.id, 19, 'ovb');
  assert.equal((await F.friendsJoinCheck(b.id, 1))?.ok, true, '30 + 20 = 50 fits');
  assert.equal((await F.friendsJoinCheck(b.id, 2))?.ok, false, '30 + 21 does not');
  assert.equal((await F.friendsJoinCheck(a.id, 2))?.ok, false, 'the same peak from the other side');

  // A third, dated after both end (a Patron may have two live; this one is upcoming but live by the
  // rule, so end one first): it gets the full 50.
  await db.update(s.events).set({ forceEndedAt: new Date().toISOString() }).where(eq(s.events.id, a.id));
  const c = await friendsEvent(host, 'Later C', iso(100), iso(120));
  assert.equal((await F.friendsJoinCheck(c.id, 50))?.ok, true);
  assert.equal((await F.friendsJoinCheck(c.id, 51))?.ok, false);

  // Re-dating C onto B past the cap is refused; moving it apart again is fine.
  await fill(host.id, c.id, 40, 'ovc');
  await assert.rejects(
    () => F.withHostEventSlot(host, { clanId: host.id, clanPlan: null, exceptEventId: c.id }, (tx) => tx.update(s.events).set({ startDate: iso(30), endDate: iso(60) }).where(eq(s.events.id, c.id))),
    (e: Error) => e instanceof P.PlanLimitError && /overlap/.test(e.message),
  );
  await F.withHostEventSlot(host, { clanId: host.id, clanPlan: null, exceptEventId: c.id }, (tx) => tx.update(s.events).set({ startDate: iso(110), endDate: iso(120) }).where(eq(s.events.id, c.id)));
});

test('seats, not people: one friend on two overlapping boards counts twice', async () => {
  const owner = await person('Fe Seats', 'supporter');
  const r = await F.ensureFriendsHost(owner.userId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const host = await hostRow(r.host.id);
  // A Supporter runs one live at a time, so the second board is a dated-but-upcoming one created while
  // the first is still a draft, then the first is dated — both checked by the schedule rule.
  const a = await friendsEvent(host, 'Seats A', null, null);
  const accs = await fill(host.id, a.id, 5, 'same');
  // The same five people on board B too.
  const b = await friendsEvent(host, 'Seats B', null, null);
  const seatsB = await db.insert(s.clanMemberships).values(accs.map((x) => ({ clanId: host.id, accountId: x.id, kind: 'event', eventId: b.id, source: 'web' }))).returning();
  await db.insert(s.eventSignups).values(seatsB.map((m) => ({ eventId: b.id, clanMemberId: m.id, status: 'approved' })));
  // Undated, each is alone: 5 of 10.
  assert.equal((await F.friendsJoinCheck(a.id, 5))?.ok, true);
  // Champion runs one live at a time too; Patron for this check (two live), then back to Supporter.
  await setTier(owner.userId, 'patron');
  await F.withHostEventSlot(host, { clanId: host.id, clanPlan: null }, (tx) => tx.update(s.events).set({ startDate: iso(-1), endDate: iso(24) }).where(inArray(s.events.id, [a.id, b.id])));
  await setTier(owner.userId, 'supporter');
  // Overlapping now: 5 + 5 = 10 seats though only five people — the Supporter cap is full.
  assert.equal((await F.friendsJoinCheck(a.id, 1))?.ok, false);
});

test('independent of creator plans: a creator who is a Patron gets 50 on friends and the plan’s number on the space, never the sum', async () => {
  process.env.FREEMIUM_ENFORCED = 'true';
  const both = await person('Fe Both', 'patron');
  const space = await C.createCreatorSpace({ slug: 'fe-both', name: 'Fe Both', ownerUserId: both.userId });
  assert.ok(space.ok, JSON.stringify(space));
  if (!space.ok) return;
  await db.update(s.clans).set({ plan: 'creator_bronze' }).where(eq(s.clans.id, space.clanId)); // 150 per event, one at a time
  const spaceRow = await hostRow(space.clanId);
  const [creatorEv] = await db
    .insert(s.events)
    .values({ clanId: space.clanId, name: 'Stream Bingo', boardSize: 5, entry: 'open', startDate: iso(-1), endDate: iso(24) })
    .returning();

  const fr = await F.ensureFriendsHost(both.userId);
  assert.ok(fr.ok);
  if (!fr.ok) return;
  const friendsHost = await hostRow(fr.host.id);
  assert.notEqual(friendsHost.id, spaceRow.id, 'two hosts, one each');
  // Two live friends events (Patron) while the creator space has its one live event: neither counts the other.
  const f1 = await friendsEvent(friendsHost, 'Friends 1', iso(-1), iso(24));
  await friendsEvent(friendsHost, 'Friends 2', iso(-1), iso(24));
  assert.equal(await P.liveEventCount(space.clanId), 1, 'friends events never use a creator allowance');
  // And the space's live limit (one at a time on Bronze) still bites on the space alone.
  await assert.rejects(() =>
    F.withHostEventSlot(spaceRow, { clanId: space.clanId, clanPlan: CP.meteredPlan(spaceRow) }, (tx) =>
      tx.insert(s.events).values({ clanId: space.clanId, name: 'Second stream', boardSize: 5, startDate: iso(-1), endDate: iso(24) }),
    ),
  );

  // Friends: 50, not 50 + 150.
  await fill(friendsHost.id, f1.id, 50, 'bothf');
  assert.equal((await F.friendsJoinCheck(f1.id, 1))?.ok, false);
  // Creator: 150, not 150 + 50.
  await fill(space.clanId, creatorEv.id, 150, 'bothc');
  assert.equal(await P.streamPlanOfEvent(creatorEv.id), 'creator_bronze');
  assert.equal(CP.eventRoomVerdict({ clanPlan: 'creator_bronze', players: await P.eventPlayerCount(creatorEv.id), adding: 1 }).ok, false);
  assert.equal(await F.friendsJoinCheck(creatorEv.id, 1), null, 'a creator event is never metered by the friends rule');
  // The creator event's entry says full by its plan alone.
  const viewer = await person('Fe Viewer');
  const v = await E.enterEvent({ eventId: creatorEv.id, playerId: viewer.playerId, accountId: viewer.accountId, actorUserId: viewer.userId });
  assert.equal(v.outcome === 'refused' && v.reason, 'full');
});

test('never listed: not in the events directory, the clan listing, or anybody’s clans', async () => {
  const owner = await person('Fe Hidden', 'patron');
  const friend = await person('Fe Hidden Friend');
  const r = await F.ensureFriendsHost(owner.userId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const host = await hostRow(r.host.id);
  const ev = await friendsEvent(host, 'Secret Bingo', iso(-1), iso(24));
  // Even forced into the most public shape a row can have, it never lists.
  await db.update(s.events).set({ advertised: true, visibility: 'public' }).where(eq(s.events.id, ev.id));
  D.forgetDirectory?.();
  const listed = await D.loadDirectoryEvents();
  assert.equal(listed.some((e) => e.eventId === ev.id), false, 'not in /events');

  const clansListed = await db
    .select({ id: s.clans.id })
    .from(s.clans)
    .leftJoin(s.settings, L.showcaseJoinOn())
    .where(L.listedClanWhere());
  assert.equal(clansListed.some((c) => c.id === host.id), false, 'not in /clans');
  assert.equal(L.isClanListed(host, 'on'), false);

  await F.acceptInvite({ token: ev.inviteToken!, playerId: friend.playerId, userId: friend.userId });
  await E.enterEvent({ eventId: ev.id, playerId: friend.playerId, accountId: friend.accountId, actorUserId: friend.userId });
  assert.equal((await M.clansOfPerson(owner.playerId, owner.userId)).some((c) => c.id === host.id), false, 'not the owner’s clan');
  assert.equal((await M.clansOfPerson(friend.playerId, friend.userId)).some((c) => c.id === host.id), false, 'nor a player’s');

  // The host's own list does have it.
  const mine = await F.friendsEventsFor(owner.userId);
  assert.ok(mine.events.some((e) => e.id === ev.id));
});
