// Creator spaces against a real database: making one with no in-game name, the one-each cap, and
// the entry rule — a stranger walks straight into an open creator event, an approval one still
// waits, and an ordinary clan's open event is exactly as strict as before.
//
// Run: npm run test:creators   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('creator-spaces');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/clanCreate.ts');
let E: typeof import('../src/lib/eventEntry.ts');
let A: typeof import('../src/lib/eventAccess.ts');
let L: typeof import('../src/lib/clanListing.ts');
let setupStatus: typeof import('../src/lib/setupStatus.ts')['getSetupStatus'];

let n = 0;
/** A person with a login and one verified character. */
async function person(name: string): Promise<{ userId: number; playerId: number; accountId: number }> {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: new Date().toISOString() })
    .returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: pl.id, displayName: name, discordId: `99300000000000${String(n).padStart(4, '0')}` })
    .returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id };
}

let streamer: Awaited<ReturnType<typeof person>>;
let spaceId: number;
let openEvent: number;
let approvalEvent: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/clanCreate.ts');
  E = await import('../src/lib/eventEntry.ts');
  A = await import('../src/lib/eventAccess.ts');
  L = await import('../src/lib/clanListing.ts');
  ({ getSetupStatus: setupStatus } = await import('../src/lib/setupStatus.ts'));
  streamer = await person('Streamer');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const showcase = (clanId: number, value: string) =>
  db.update(s.settings).set({ value }).where(and(eq(s.settings.clanId, clanId), eq(s.settings.key, 'public_showcase')));

test('a creator space is made with no in-game name: open, public, unlisted, owned', async () => {
  const r = await C.createCreatorSpace({
    slug: 'cool-streamer',
    name: 'Cool Streamer',
    ownerUserId: streamer.userId,
    twitchUrl: 'https://www.twitch.tv/coolstreamer',
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  spaceId = r.clanId;

  const row = (await db.query.clans.findFirst({ where: eq(s.clans.id, spaceId) }))!;
  assert.equal(row.kind, 'creator');
  assert.equal(row.inGameName, null);
  assert.equal(row.guestPolicy, 'open');
  assert.equal(row.visibility, 'public');

  const owner = await db.query.clanStaff.findFirst({
    where: and(eq(s.clanStaff.clanId, spaceId), eq(s.clanStaff.userId, streamer.userId)),
  });
  assert.equal(owner?.role, 'owner');

  const twitch = await db.query.settings.findFirst({
    where: and(eq(s.settings.clanId, spaceId), eq(s.settings.key, 'creator_twitch_url')),
  });
  assert.equal(twitch?.value, 'https://twitch.tv/coolstreamer');

  // Not in the directory until it opts in.
  const listed = async () =>
    (
      await db
        .select({ id: s.clans.id })
        .from(s.clans)
        .leftJoin(s.settings, L.showcaseJoinOn())
        .where(and(L.listedClanWhere(), eq(s.clans.id, spaceId)))
    ).length > 0;
  assert.equal(await listed(), false, 'unlisted by default');
  await showcase(spaceId, 'on');
  assert.equal(await listed(), true, 'Advertise on Anvil lists it');
  await showcase(spaceId, 'off');
  assert.equal(await listed(), false);

  // Its checklist is the creator one, and it never sends anyone to the in-game setup wizard.
  const setup = await setupStatus(spaceId);
  assert.equal(setup.creator, true);
  assert.deepEqual(
    setup.steps.map((st) => st.key),
    ['event', 'share', 'discord'],
  );
  assert.equal(setup.isFresh, false);
});

test('one creator space per person', async () => {
  assert.equal(await C.ownedCreatorSpaceCount(streamer.userId), 1);
  const again = await C.createCreatorSpace({ slug: 'second-space', name: 'Second', ownerUserId: streamer.userId });
  assert.equal(again.ok, false);
  assert.equal(await db.query.clans.findFirst({ where: eq(s.clans.slug, 'second-space') }), undefined);

  // Somebody else may still make theirs.
  const other = await person('Other Host');
  const theirs = await C.createCreatorSpace({ slug: 'other-host', name: 'Other Host', ownerUserId: other.userId });
  assert.equal(theirs.ok, true);
});

test('bad input is refused: taken address, bad stream link', async () => {
  const p = await person('Linky');
  const taken = await C.createCreatorSpace({ slug: 'cool-streamer', name: 'Dup', ownerUserId: p.userId });
  assert.equal(taken.ok, false);
  const bad = await C.createCreatorSpace({
    slug: 'linky',
    name: 'Linky',
    ownerUserId: p.userId,
    kickUrl: 'https://kick.com.evil.io/x',
  });
  assert.equal(bad.ok, false);
  assert.equal(await C.ownedCreatorSpaceCount(p.userId), 0);
});

test('a stranger entering an OPEN creator event is seated at once', async () => {
  [{ id: openEvent }, { id: approvalEvent }] = await db
    .insert(s.events)
    .values([
      { clanId: spaceId, name: 'Viewer Bingo', boardSize: 5, entry: 'open' },
      { clanId: spaceId, name: 'Careful Bingo', boardSize: 5, entry: 'approval' },
    ])
    .returning();

  const viewer = await person('Viewer');
  assert.deepEqual(await A.canEnterEvent({ eventId: openEvent, playerId: viewer.playerId }), {
    outcome: 'outsider',
    needsApproval: false,
  });

  const r = await E.enterEvent({
    eventId: openEvent,
    playerId: viewer.playerId,
    accountId: viewer.accountId,
    actorUserId: viewer.userId,
  });
  assert.equal(r.outcome, 'seated', JSON.stringify(r));
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, spaceId), eq(s.clanMemberships.accountId, viewer.accountId)),
  });
  assert.equal(seat?.kind, 'guest');
  assert.equal(seat?.leftAt, null);
  const asked = await db.query.clanJoinRequests.findFirst({ where: eq(s.clanJoinRequests.accountId, viewer.accountId) });
  assert.equal(asked, undefined, 'no request filed');

  // Seated now, so the ordinary sign-up path applies.
  assert.deepEqual(await A.canEnterEvent({ eventId: openEvent, playerId: viewer.playerId }), { outcome: 'insider' });
});

test('an APPROVAL creator event still waits on the host', async () => {
  const viewer = await person('Patient Viewer');
  assert.deepEqual(await A.canEnterEvent({ eventId: approvalEvent, playerId: viewer.playerId }), {
    outcome: 'outsider',
    needsApproval: true,
  });

  const r = await E.enterEvent({
    eventId: approvalEvent,
    playerId: viewer.playerId,
    accountId: viewer.accountId,
    actorUserId: viewer.userId,
  });
  assert.equal(r.outcome, 'pending', JSON.stringify(r));
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, spaceId), eq(s.clanMemberships.accountId, viewer.accountId)),
  });
  assert.equal(seat, undefined, 'no seat until approved, although the space admits guests openly');
  const req = await db.query.clanJoinRequests.findFirst({
    where: and(eq(s.clanJoinRequests.clanId, spaceId), eq(s.clanJoinRequests.accountId, viewer.accountId)),
  });
  assert.equal(req?.status, 'pending');
});

test('the owner plays their own events on a guest seat, even while a member of a real clan', async () => {
  const [realClan] = await db
    .insert(s.clans)
    .values({ slug: 'real-clan', name: 'Real Clan', inGameName: 'Real Clan' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: realClan.id, accountId: streamer.accountId, kind: 'member', source: 'roster' });

  // Even the approval event: the host is not asking themselves.
  const r = await E.enterEvent({
    eventId: approvalEvent,
    playerId: streamer.playerId,
    accountId: streamer.accountId,
    actorUserId: streamer.userId,
  });
  assert.equal(r.outcome, 'seated', JSON.stringify(r));
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, spaceId), eq(s.clanMemberships.accountId, streamer.accountId)),
  });
  assert.equal(seat?.kind, 'guest');
});

test('an ordinary clan is unchanged: an unvouched stranger on an OPEN event still needs approval', async () => {
  const founder = await person('Founder');
  const made = await C.createClan({
    slug: 'plain-clan',
    name: 'Plain Clan',
    inGameName: 'Plain Clan',
    ownerUserId: founder.userId,
  });
  assert.equal(made.ok, true);
  if (!made.ok) return;
  const row = (await db.query.clans.findFirst({ where: eq(s.clans.id, made.clanId) }))!;
  assert.equal(row.kind, 'clan', 'clans default to kind=clan');
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: made.clanId, name: 'Clan Bingo', boardSize: 5, entry: 'open' })
    .returning();

  const stranger = await person('Stranger');
  assert.deepEqual(await A.canEnterEvent({ eventId: ev.id, playerId: stranger.playerId }), {
    outcome: 'outsider',
    needsApproval: true,
  });
  const r = await E.enterEvent({
    eventId: ev.id,
    playerId: stranger.playerId,
    accountId: stranger.accountId,
    actorUserId: stranger.userId,
  });
  assert.equal(r.outcome, 'pending');
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, made.clanId), eq(s.clanMemberships.accountId, stranger.accountId)),
  });
  assert.equal(seat, undefined);

  // And a clan still needs its in-game name.
  const nameless = await C.createClan({ slug: 'nameless', name: 'Nameless', ownerUserId: founder.userId });
  assert.equal(nameless.ok, false);

  // A clan with no showcase row is still listed (unchanged default).
  const listedClan = await db
    .select({ id: s.clans.id })
    .from(s.clans)
    .leftJoin(s.settings, L.showcaseJoinOn())
    .where(and(L.listedClanWhere(), eq(s.clans.id, made.clanId)));
  assert.equal(listedClan.length, 1);
});
