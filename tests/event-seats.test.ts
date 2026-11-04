// Event players and the clan "Streaming" switch, against a real database (lib/eventPlayers,
// lib/eventEntry, lib/eventAccess, lib/streamChannels).
//
//   - a viewer entering a Streaming clan's viewer event gets an EVENT seat — not a guest one — that
//     opens that event and no other, and is on no roster, guest list or member count;
//   - an ordinary clan (Streaming off) is unchanged even if the event row says otherwise;
//   - "Make guest" / back to viewer; Past viewers; seats close when the event ends;
//   - a creator-space viewer gets an event seat too, and two of its events are two seats;
//   - gates apply to a Streaming clan's viewer event, never to its own members;
//   - one stream channel, one place: the move asks, and only an admin of both may make it;
//   - the plugin's boards for an event seat are its own event only;
//   - an event seat never makes a private clan readable.
//
// Run: npm run test:event-seats   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-seats');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/clanCreate.ts');
let E: typeof import('../src/lib/eventEntry.ts');
let A: typeof import('../src/lib/eventAccess.ts');
let P: typeof import('../src/lib/eventPlayers.ts');
let Seats: typeof import('../src/lib/eventSeats.ts');
let G: typeof import('../src/lib/entryGatesDb.ts');
let SC: typeof import('../src/lib/streamChannels.ts');
let Cap: typeof import('../src/lib/member-cap.ts');
let Access: typeof import('../src/lib/clanAccess.ts');
let Adm: typeof import('../src/lib/guestAdmission.ts');
let Boards: typeof import('../src/lib/pluginBoards.ts');
let Scope: typeof import('../src/lib/seatScope.ts');

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

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

let owner: Awaited<ReturnType<typeof person>>;
let clanId: number;
let streamEvent: number;
let streamEvent2: number;
let membersEvent: number;

const enter = (who: { playerId: number; accountId: number; userId: number }, eventId: number) =>
  E.enterEvent({ eventId, playerId: who.playerId, accountId: who.accountId, actorUserId: who.userId });

const seatsOf = (accountId: number, inClan = clanId) =>
  db.query.clanMemberships.findMany({ where: and(eq(s.clanMemberships.clanId, inClan), eq(s.clanMemberships.accountId, accountId)) });

/** What the admin roster/guest list reads (api/admin/clan): member and guest seats only. */
const rosterRows = () =>
  db.select().from(s.clanRoster).where(and(eq(s.clanRoster.clanId, clanId), Scope.rosterClanSeat(), isNull(s.clanRoster.leftAt)));

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/clanCreate.ts');
  E = await import('../src/lib/eventEntry.ts');
  A = await import('../src/lib/eventAccess.ts');
  P = await import('../src/lib/eventPlayers.ts');
  Seats = await import('../src/lib/eventSeats.ts');
  G = await import('../src/lib/entryGatesDb.ts');
  SC = await import('../src/lib/streamChannels.ts');
  Cap = await import('../src/lib/member-cap.ts');
  Access = await import('../src/lib/clanAccess.ts');
  Adm = await import('../src/lib/guestAdmission.ts');
  Boards = await import('../src/lib/pluginBoards.ts');
  Scope = await import('../src/lib/seatScope.ts');

  owner = await person('Clan Owner');
  const made = await C.createClan({ slug: 'stream-clan', name: 'Stream Clan', inGameName: 'Stream Clan', ownerUserId: owner.userId });
  assert.equal(made.ok, true, JSON.stringify(made));
  if (!made.ok) return;
  clanId = made.clanId;
  // The owner is a real member of their clan.
  await db.insert(s.clanMemberships).values({ clanId, accountId: owner.accountId, kind: 'member', source: 'roster' });
  await db.update(s.clans).set({ streaming: true }).where(eq(s.clans.id, clanId));
  [{ id: streamEvent }, { id: streamEvent2 }, { id: membersEvent }] = await db
    .insert(s.events)
    .values([
      { clanId, name: 'Viewer Bingo', boardSize: 5, entry: 'open', openToViewers: true, startDate: day(-1), endDate: day(5) },
      { clanId, name: 'Viewer Race', boardSize: 5, entry: 'open', openToViewers: true, startDate: day(-1), endDate: day(5) },
      { clanId, name: 'Members Bingo', boardSize: 5, entry: 'open' },
    ])
    .returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

let viewer: Awaited<ReturnType<typeof person>>;
let viewerSeat: number;

test('a viewer entering a Streaming clan’s viewer event gets an EVENT seat, not a guest one', async () => {
  viewer = await person('Viewer One');
  assert.deepEqual(await A.canEnterEvent({ eventId: streamEvent, playerId: viewer.playerId }), { outcome: 'outsider', needsApproval: false });

  const r = await enter(viewer, streamEvent);
  assert.equal(r.outcome, 'seated', JSON.stringify(r));
  const seats = await seatsOf(viewer.accountId);
  assert.equal(seats.length, 1);
  assert.equal(seats[0].kind, 'event');
  assert.equal(seats[0].eventId, streamEvent);
  assert.equal(seats[0].leftAt, null);
  viewerSeat = seats[0].id;
  assert.equal(await db.query.clanJoinRequests.findFirst({ where: eq(s.clanJoinRequests.accountId, viewer.accountId) }), undefined, 'no request');

  // Pressing again is the same seat.
  assert.equal((await enter(viewer, streamEvent)).outcome, 'insider');
  assert.equal((await seatsOf(viewer.accountId)).length, 1);
  assert.deepEqual(await A.canEnterEvent({ eventId: streamEvent, playerId: viewer.playerId }), { outcome: 'insider' });
  assert.equal((await Seats.signupSeatsFor({ id: streamEvent, clanId }, viewer.playerId)).length, 1);
});

test('the event seat opens nothing else: not another event, not the members-only one', async () => {
  // Another viewer event: an outsider again (and entering it is a second, separate seat).
  assert.deepEqual(await A.canEnterEvent({ eventId: streamEvent2, playerId: viewer.playerId }), { outcome: 'outsider', needsApproval: false });
  assert.deepEqual(await Seats.signupSeatsFor({ id: streamEvent2, clanId }, viewer.playerId), []);
  // The members-only event: exactly a stranger's answer.
  assert.deepEqual(await A.canEnterEvent({ eventId: membersEvent, playerId: viewer.playerId }), { outcome: 'outsider', needsApproval: true });
  assert.deepEqual(await Seats.signupSeatsFor({ id: membersEvent, clanId }, viewer.playerId), []);
  assert.equal(await A.involvedInEvent({ eventId: membersEvent, clanId, playerId: viewer.playerId }), false);
  assert.equal(await A.involvedInEvent({ eventId: streamEvent, clanId, playerId: viewer.playerId }), true);

  // Into the second viewer event: a second event seat; the first still opens only its own.
  assert.equal((await enter(viewer, streamEvent2)).outcome, 'seated');
  const seats = await seatsOf(viewer.accountId);
  assert.deepEqual(seats.map((x) => x.eventId).sort(), [streamEvent, streamEvent2].sort());
  assert.ok(seats.every((x) => x.kind === 'event'));
  const forFirst = await Seats.signupSeatsFor({ id: streamEvent, clanId }, viewer.playerId);
  assert.equal(forFirst.length, 1);
  assert.equal(forFirst[0].id, viewerSeat, 'each event signs up on its own seat');
});

test('viewers are on no roster, guest list or member count, and never see a private clan', async () => {
  const roster = await rosterRows();
  assert.ok(roster.every((r) => r.accountId !== viewer.accountId), 'not on the roster or guest list');
  assert.equal(await Cap.activeMemberCount(clanId), 1, 'only the owner counts');

  await db.update(s.clans).set({ visibility: 'members' }).where(eq(s.clans.id, clanId));
  assert.equal(
    await Access.canSeeClan({ clanId, visibility: 'members', playerId: viewer.playerId, userId: viewer.userId }),
    false,
    'an event seat does not open a private clan',
  );
  assert.equal(await Access.canSeeClan({ clanId, visibility: 'members', playerId: owner.playerId, userId: null }), true, 'a member seat still does');
  await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clanId));
});

test('an ordinary clan (Streaming off) is unchanged, even with the viewer flag set on an event', async () => {
  const founder = await person('Plain Founder');
  const made = await C.createClan({ slug: 'plain-clan', name: 'Plain Clan', inGameName: 'Plain Clan', ownerUserId: founder.userId });
  assert.equal(made.ok, true);
  if (!made.ok) return;
  const [ev] = await db.insert(s.events).values({ clanId: made.clanId, name: 'Plain Bingo', boardSize: 5, entry: 'open', openToViewers: true }).returning();
  const stranger = await person('Plain Stranger');
  assert.deepEqual(await A.canEnterEvent({ eventId: ev.id, playerId: stranger.playerId }), { outcome: 'outsider', needsApproval: true });
  assert.equal((await enter(stranger, ev.id)).outcome, 'pending');
  assert.deepEqual(await seatsOf(stranger.accountId, made.clanId), [], 'no seat of any kind');
  const req = await db.query.clanJoinRequests.findFirst({ where: eq(s.clanJoinRequests.accountId, stranger.accountId) });
  assert.equal(req?.eventId, null, 'a clan-wide guest request, as before');
  // Approving it makes a GUEST, as it always did.
  const ok = await Adm.approveRequest(req!.id, made.clanId, founder.userId);
  assert.equal(ok.ok, true);
  assert.equal((await seatsOf(stranger.accountId, made.clanId))[0].kind, 'guest');
  assert.equal(await G.gatesForEvent(ev.id), null);
});

test('an approval viewer event asks about that event; the yes is an event seat', async () => {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Careful Viewers', boardSize: 5, entry: 'approval', openToViewers: true }).returning();
  const v = await person('Careful Viewer');
  assert.equal((await enter(v, ev.id)).outcome, 'pending');
  assert.deepEqual(await seatsOf(v.accountId), []);
  const req = await db.query.clanJoinRequests.findFirst({ where: eq(s.clanJoinRequests.accountId, v.accountId) });
  assert.equal(req?.eventId, ev.id);
  assert.equal((await Adm.approveRequest(req!.id, clanId, owner.userId)).ok, true);
  const seats = await seatsOf(v.accountId);
  assert.equal(seats.length, 1);
  assert.equal(seats[0].kind, 'event');
  assert.equal(seats[0].eventId, ev.id);
  assert.deepEqual(await A.canEnterEvent({ eventId: ev.id, playerId: v.playerId }), { outcome: 'insider' });
});

test('gates apply to a Streaming clan’s viewer events, never to its members or its members-only events', async () => {
  const gates = JSON.stringify({ anyOf: [{ kind: 'discord-booster' }] });
  const [gated] = await db.insert(s.events).values({ clanId, name: 'Boosters Only', boardSize: 5, entry: 'open', openToViewers: true, entryGates: gates }).returning();
  const [membersGated] = await db.insert(s.events).values({ clanId, name: 'Members Gated', boardSize: 5, entry: 'open', entryGates: gates }).returning();
  assert.ok(await G.gatesForEvent(gated.id), 'gates apply');
  assert.equal(await G.gatesForEvent(membersGated.id), null, 'members only: the column is ignored');

  const v = await person('Gated Viewer');
  const r = await enter(v, gated.id);
  assert.equal(r.outcome, 'gated', JSON.stringify(r));
  assert.deepEqual(await seatsOf(v.accountId), []);
  // The clan's own member is not gated.
  assert.equal(await G.entryGateVerdict({ eventId: gated.id, userId: owner.userId, playerId: owner.playerId }), null);
});

test('Make guest, and back to a viewer of one event', async () => {
  const r = await P.makeGuest(clanId, viewerSeat, owner.userId);
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  const seats = await seatsOf(viewer.accountId);
  const guest = seats.find((x) => x.kind === 'guest');
  assert.ok(guest && guest.leftAt == null, 'a guest seat now');
  assert.ok(seats.some((x) => x.id === viewerSeat && x.kind === 'event' && x.leftAt == null), 'the event seat stays: their sign-up is on it');
  assert.ok((await rosterRows()).some((x) => x.id === guest!.id), 'on the guest list');
  // As a guest: the members-only (open) event opens to them.
  assert.deepEqual(await A.canEnterEvent({ eventId: membersEvent, playerId: viewer.playerId }), { outcome: 'insider' });
  // Their sign-up for the first event still uses the event seat.
  assert.equal((await Seats.signupSeatsFor({ id: streamEvent, clanId }, viewer.playerId))[0].id, viewerSeat);
  assert.equal((await P.makeGuest(clanId, viewerSeat, owner.userId)).ok, false, 'already a guest');

  // Back to a viewer of the members-only event: the guest seat becomes that event's seat.
  const back = await P.makeEventPlayer(clanId, guest!.id, membersEvent, owner.userId);
  assert.equal(back.ok, true, JSON.stringify(back));
  const after = await seatsOf(viewer.accountId);
  assert.equal(after.filter((x) => x.kind === 'guest' && x.leftAt == null).length, 0, 'no longer a guest');
  assert.ok((await rosterRows()).every((x) => x.accountId !== viewer.accountId));
  assert.ok(after.some((x) => x.kind === 'event' && x.eventId === membersEvent && x.leftAt == null));

  // Make guest again: still one member/guest row for the account here.
  const again = await P.makeGuest(clanId, viewerSeat, owner.userId);
  assert.equal(again.ok, true);
  const guests = (await seatsOf(viewer.accountId)).filter((x) => x.kind !== 'event');
  assert.equal(guests.length, 1);
  // Only this clan's seats, events and guests.
  assert.equal((await P.makeEventPlayer(clanId, viewerSeat, membersEvent, owner.userId)).ok, false, 'an event seat is not a guest');
});

test('Past viewers lists event players by event; seats close when the event ends, the record stays', async () => {
  const list = await P.pastViewers(clanId);
  const first = list.find((g) => g.eventId === streamEvent);
  assert.ok(first);
  assert.ok(first.viewers.some((v) => v.seatId === viewerSeat && v.nowGuest));

  await db.update(s.events).set({ endDate: day(-0.01) }).where(eq(s.events.id, streamEvent2));
  const closed = await P.closeFinishedEventSeats();
  assert.ok(closed >= 1);
  const seat2 = (await seatsOf(viewer.accountId)).find((x) => x.eventId === streamEvent2)!;
  assert.notEqual(seat2.leftAt, null, 'closed');
  const again = (await P.pastViewers(clanId)).find((g) => g.eventId === streamEvent2)!;
  assert.equal(again.over, true);
  assert.ok(again.viewers.some((v) => v.seatId === seat2.id && v.closed), 'still on the record');
  // The live event's seats were left alone.
  assert.equal((await seatsOf(viewer.accountId)).find((x) => x.id === viewerSeat)!.leftAt, null);
});

test('a creator-space viewer gets an event seat; one event never opens the other', async () => {
  const streamer = await person('Streamer');
  const r = await C.createCreatorSpace({ slug: 'a-streamer', name: 'A Streamer', ownerUserId: streamer.userId });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const [{ id: e1 }, { id: e2 }] = await db
    .insert(s.events)
    .values([
      { clanId: r.clanId, name: 'Stream One', boardSize: 5, entry: 'open' },
      { clanId: r.clanId, name: 'Stream Two', boardSize: 5, entry: 'approval' },
    ])
    .returning();
  const v = await person('Creator Viewer');
  assert.equal((await enter(v, e1)).outcome, 'seated');
  const seats = await seatsOf(v.accountId, r.clanId);
  assert.equal(seats.length, 1);
  assert.equal(seats[0].kind, 'event');
  assert.equal(seats[0].eventId, e1);
  assert.deepEqual(await A.canEnterEvent({ eventId: e2, playerId: v.playerId }), { outcome: 'outsider', needsApproval: true });
  assert.equal((await enter(v, e2)).outcome, 'pending');
  assert.deepEqual(await Seats.signupSeatsFor({ id: e2, clanId: r.clanId }, v.playerId), []);
});

test('one stream channel, one place: an admin of both may move it; anybody else may not', async () => {
  const [other] = await db.insert(s.clans).values({ slug: 'other-space', name: 'Other Space', kind: 'creator', plan: 'creator_free' }).returning();
  await db.insert(s.clanStaff).values({ clanId: other.id, userId: owner.userId, role: 'owner' });
  await db.insert(s.clanTwitchChannels).values({
    clanId: other.id,
    twitchUserId: '424242',
    twitchLogin: 'ownerchannel',
    accessToken: 'x',
    refreshToken: 'y',
    expiresAt: day(1),
    scope: 's',
  });

  // Connecting the same channel to the clan: the owner runs both, so they are asked to move it.
  assert.deepEqual(await SC.connectConflict('twitch', '424242', clanId, owner.userId), { outcome: 'elsewhere', fromClanId: other.id });
  // A stranger who admins only the destination is told it is taken.
  const stranger = await person('Other Admin');
  await db.insert(s.clanStaff).values({ clanId, userId: stranger.userId, role: 'admin' });
  assert.deepEqual(await SC.connectConflict('twitch', '424242', clanId, stranger.userId), { outcome: 'taken' });
  assert.equal(await SC.connectConflict('twitch', '999', clanId, owner.userId), null, 'a free channel');

  assert.equal((await SC.moveStreamChannel({ platform: 'twitch', fromClanId: other.id, toClanId: clanId, userId: stranger.userId })).ok, false);
  const offer = await SC.moveOffer('twitch', other.id, clanId, owner.userId);
  assert.equal(offer?.fromName, 'Other Space');
  assert.equal(offer?.channel, 'ownerchannel');
  const moved = await SC.moveStreamChannel({ platform: 'twitch', fromClanId: other.id, toClanId: clanId, userId: owner.userId });
  assert.equal(moved.ok, true);
  const rows = await db.select().from(s.clanTwitchChannels).where(eq(s.clanTwitchChannels.twitchUserId, '424242'));
  assert.deepEqual(rows.map((x) => x.clanId), [clanId]);

  // Never into a clan without Streaming.
  await db.update(s.clans).set({ streaming: false }).where(eq(s.clans.id, clanId));
  assert.equal(await SC.moveOffer('twitch', clanId, other.id, owner.userId) != null, true, 'into the creator space is fine');
  assert.equal(await SC.moveOffer('twitch', other.id, clanId, owner.userId), null, 'into a clan with Streaming off is not');
  await db.update(s.clans).set({ streaming: true }).where(eq(s.clans.id, clanId));
});

test('the plugin’s boards for an event seat are its own event only', async () => {
  const v = await person('Board Viewer');
  assert.equal((await enter(v, streamEvent)).outcome, 'seated');
  const seat = (await seatsOf(v.accountId)).find((x) => x.eventId === streamEvent)!;
  const [t1] = await db.insert(s.teams).values({ eventId: streamEvent, name: 'Red', color: '#f00' }).returning();
  const [t2] = await db.insert(s.teams).values({ eventId: membersEvent, name: 'Blue', color: '#00f' }).returning();
  await db.update(s.events).set({ startDate: day(-1), endDate: day(5) }).where(eq(s.events.id, membersEvent));
  // On its own board through the seat; and a stray row on another board that points at the same
  // seat (no account on it) — the seat must not carry it there.
  await db.insert(s.eventParticipants).values([
    { eventId: streamEvent, name: 'Board Viewer', accountId: v.accountId, clanMemberId: seat.id, teamId: t1.id },
    { eventId: membersEvent, name: 'Board Viewer', clanMemberId: seat.id, teamId: t2.id },
  ]);
  const boards = await Boards.liveBoardsForCharacter(new Request('https://example.test/x'), v.accountId);
  assert.deepEqual(boards.map((b) => b.eventId), [streamEvent]);
});

test('private clans can’t stream, and a Streaming clan can’t go private', async () => {
  const SW = await import('../src/lib/streamingSwitch.ts');
  const founder = await person('Private Founder');
  const made = await C.createClan({ slug: 'quiet-clan', name: 'Quiet Clan', inGameName: 'Quiet Clan', ownerUserId: founder.userId });
  assert.equal(made.ok, true);
  if (!made.ok) return;
  await db.update(s.clans).set({ visibility: 'members' }).where(eq(s.clans.id, made.clanId));
  assert.deepEqual(await SW.setClanStreaming(made.clanId, true), { ok: false, error: SW.STREAMING_NEEDS_PUBLIC });
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, made.clanId) }))?.streaming, false);
  // Public: on. Then going private is refused until Streaming is off.
  await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, made.clanId));
  assert.deepEqual(await SW.setClanStreaming(made.clanId, true), { ok: true });
  assert.deepEqual(await SW.visibilityChangeVerdict(made.clanId, 'members'), { ok: false, error: SW.PRIVATE_NEEDS_STREAMING_OFF });
  assert.deepEqual(await SW.visibilityChangeVerdict(made.clanId, 'public'), { ok: true });
  assert.deepEqual(await SW.setClanStreaming(made.clanId, false), { ok: true });
  assert.deepEqual(await SW.visibilityChangeVerdict(made.clanId, 'members'), { ok: true });
});

test('a Streaming clan keeps its clan plan; its viewer events are metered as the same creator tier', async () => {
  const CP = await import('../src/lib/creatorPlans.ts');
  const PD = await import('../src/lib/creatorPlansDb.ts');
  assert.equal(CP.streamPlanId({ kind: 'clan', plan: 'free' }), 'creator_free');
  assert.equal(CP.streamPlanId({ kind: 'clan', plan: 'silver' }), 'creator_silver');
  assert.equal(CP.streamPlanId({ kind: 'clan', plan: 'custom' }), 'creator_partner');
  assert.equal(CP.streamPlanId({ kind: 'creator', plan: 'creator_gold' }), 'creator_gold');

  await db.update(s.clans).set({ plan: 'silver' }).where(eq(s.clans.id, clanId));
  assert.equal(await PD.streamPlanOfEvent(streamEvent), 'creator_silver', 'the viewer event, read as creator Silver');
  assert.equal(await PD.streamPlanOfEvent(membersEvent), null, 'members-only: metered by the roster, as before');
  const row = await db.query.clans.findFirst({ where: eq(s.clans.id, clanId), columns: { plan: true } });
  assert.equal(row?.plan, 'silver', 'the clan row keeps its clan plan id');
  // A creator plan id can never be written onto a clan row.
  await assert.rejects(db.update(s.clans).set({ plan: 'creator_silver' }).where(eq(s.clans.id, clanId)));
  await db.update(s.clans).set({ plan: 'free' }).where(eq(s.clans.id, clanId));
});

test('an event seat never earns member Discord roles, a member nickname tier, or a role sync', async () => {
  const D = await import('../src/lib/discord-roles.ts');
  // Roles: only a member seat earns member roles — never "not all guests".
  assert.equal(D.holdsMemberRoles([{ kind: 'event' }]), false);
  assert.equal(D.holdsMemberRoles([{ kind: 'guest' }, { kind: 'event' }]), false);
  assert.equal(D.holdsMemberRoles([{ kind: 'member' }, { kind: 'event' }]), true);
  // Nickname order: an event seat here does not make the name a member's.
  const ordered = D.orderNicknameAccounts(
    [
      { rsn: 'Aa Viewer', isPrimary: 0, kind: 'event', clanId },
      { rsn: 'Zz Member', isPrimary: 0, kind: 'member', clanId },
    ],
    clanId,
  );
  assert.deepEqual(ordered.map((a) => a.rsn), ['Zz Member', 'Aa Viewer'], 'the event-only name sorts with guests, last');
  // The per-seat sync refuses an event seat outright.
  const r = await D.syncRolesForClanMember(viewerSeat);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /event player/);
});
