// Where a stored Discord id came from (drizzle/0265), against a real database.
//
// The pure rules are in tests/discord-role-safety.test.ts. This checks the parts that read and write
// rows: role sync reads the source per CLAN (a hand link made by one clan's admin is not a link in
// another clan that seats the same character), the admin page's counts, the guard that stops an
// admin pointing a seat at a Discord account already proven to be another member, and the source a
// staff-typed id is stored with.
//
// Run: npx tsx --test tests/discord-link-source-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { storedDiscordLink, trustedDiscordIds } from '../src/lib/discordRoleSafety.ts';

const DB = useTestDatabase('discord-link-source');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let roles: typeof import('../src/lib/discord-roles.ts');
let staffEnteredDiscordLink: typeof import('../src/lib/discordLink.ts')['staffEnteredDiscordLink'];

let alpha: number;
let bravo: number;
let admin: number;

const person = async (name: string) => (await db.insert(s.players).values({ displayName: name }).returning())[0].id;
const login = async (playerId: number, name: string, discordId: string | null = null) =>
  (await db.insert(s.users).values({ displayName: name, playerId, discordId }).returning())[0].id;
/** An unclaimed roster character (held by a placeholder person, as the roster sync leaves it) and its seat. */
async function seat(clanId: number, rsn: string, extra: Record<string, unknown> = {}) {
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: await person(rsn), rsn, rsnNormalized: rsn.toLowerCase(), ...extra })
    .returning();
  const [row] = await db.insert(s.clanMemberships).values({ clanId, accountId: account.id, kind: 'member' }).returning();
  return { accountId: account.id, seatId: row.id, rsn };
}
const member = (x: { seatId: number; rsn: string }, discordId: string | null = null) => ({ id: x.seatId, rsn: x.rsn, playerId: null, discordId });
const adminLink = (discordId: string, clanId: number) => storedDiscordLink(discordId, 'admin', { userId: admin, clanId, at: '2026-11-15T10:00:00.000Z' });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  roles = await import('../src/lib/discord-roles.ts');
  ({ staffEnteredDiscordLink } = await import('../src/lib/discordLink.ts'));
  alpha = (await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning())[0].id;
  bravo = (await db.insert(s.clans).values({ slug: 'bravo', name: 'Bravo' }).returning())[0].id;
  admin = await login(await person('Admin'), 'Admin', '900000000000000001');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('existing rows have no source: a stored id is unknown until somebody confirms it', async () => {
  const legacy = await seat(alpha, 'Legacy', { discordId: '900000000000000010' });
  const [row] = await db.select().from(s.accounts).where(eq(s.accounts.id, legacy.accountId));
  assert.equal(row.discordIdSource, null);
  const src = await roles.seatDiscordSources(member(legacy));
  assert.equal(src.cachedDiscordId, '900000000000000010');
  assert.equal(src.cachedSource, null);
  assert.deepEqual(trustedDiscordIds(src, false), [], 'matching off: earns nothing');
  assert.deepEqual(trustedDiscordIds(src, true), ['900000000000000010'], 'matching on: as before');
});

test('a hand link is trusted with matching off, in the clan that made it and nowhere else', async () => {
  const linked = await seat(alpha, 'Linked');
  // The same character is on another clan's roster too (a member of one clan, a guest in the other).
  const [other] = await db.insert(s.clanMemberships).values({ clanId: bravo, accountId: linked.accountId, kind: 'guest' }).returning();
  await db.update(s.accounts).set(adminLink('900000000000000020', alpha)).where(eq(s.accounts.id, linked.accountId));

  const here = await roles.seatDiscordSources(member(linked));
  assert.equal(here.cachedSource, 'admin');
  assert.deepEqual(trustedDiscordIds(here, false), ['900000000000000020']);

  const there = await roles.seatDiscordSources({ id: other.id, rsn: 'Linked', playerId: null, discordId: null });
  assert.equal(there.cachedDiscordId, '900000000000000020');
  assert.equal(there.cachedSource, null, 'another clan’s admin did not make this link');
  assert.deepEqual(trustedDiscordIds(there, false), [], 'so it earns no roles in that clan’s server');
});

test('the owner signing in with a different Discord account beats a hand link', async () => {
  const claimed = await seat(alpha, 'Claimed');
  await db.update(s.accounts).set(adminLink('900000000000000030', alpha)).where(eq(s.accounts.id, claimed.accountId));
  // The real owner turns up and claims the character.
  const owner = await person('Owner');
  await login(owner, 'Owner', '900000000000000031');
  await db.update(s.accounts).set({ playerId: owner, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, claimed.accountId));

  const src = await roles.seatDiscordSources({ id: claimed.seatId, rsn: 'Claimed', playerId: owner, discordId: null });
  assert.deepEqual(trustedDiscordIds(src, false), ['900000000000000031'], 'the hand-linked account gets nothing');
});

test('the admin page counts: not linked, and stored links of unknown source', async () => {
  const [clan] = await db.insert(s.clans).values({ slug: 'counts', name: 'Counts' }).returning();
  const signedIn = await seat(clan.id, 'CountSigned');
  const owner = await person('CountOwner');
  await login(owner, 'CountOwner', '900000000000000040');
  await db.update(s.accounts).set({ playerId: owner, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, signedIn.accountId));
  const byHand = await seat(clan.id, 'CountLinked');
  await db.update(s.accounts).set(adminLink('900000000000000041', clan.id)).where(eq(s.accounts.id, byHand.accountId));
  await seat(clan.id, 'CountLegacy', { discordId: '900000000000000042' });
  const elsewhere = await seat(clan.id, 'CountElsewhere');
  await db.update(s.accounts).set(adminLink('900000000000000043', alpha)).where(eq(s.accounts.id, elsewhere.accountId));
  await seat(clan.id, 'CountNothing');

  assert.deepEqual(await roles.rosterLinkCounts(clan.id), { notLinked: 3, unconfirmed: 2 });
  assert.equal(await roles.countRosterSeatsNotLinked(clan.id), 3);
});

test('a Discord account proven to be a different member of the clan cannot be linked to another seat', async () => {
  const [clan] = await db.insert(s.clans).values({ slug: 'guard', name: 'Guard' }).returning();
  const target = await seat(clan.id, 'GuardGeneral');

  // By sign-in: they own another live seat here.
  const mine = await seat(clan.id, 'GuardRecruit');
  const me = await person('GuardMe');
  const meLogin = await login(me, 'GuardMe', '900000000000000050');
  await db.update(s.accounts).set({ playerId: me, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, mine.accountId));
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, target.seatId, '900000000000000050'), true);
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, mine.seatId, '900000000000000050'), false, 'their own seat is not "another"');

  // By sign-up: a signed-in user signed up for an event as a different seat.
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Guard Bingo', boardSize: 25 }).returning();
  const signedUpAs = await seat(clan.id, 'GuardSignup');
  const su = await login(await person('GuardSu'), 'GuardSu', '900000000000000051');
  await db.insert(s.eventSignups).values({ eventId: ev.id, userId: su, clanMemberId: signedUpAs.seatId, profileData: '{}' });
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, target.seatId, '900000000000000051'), true);

  // By plugin: a signed-in user's plugin reported playing a different character on this roster.
  const playedAs = await seat(clan.id, 'GuardPlugin');
  const pl = await login(await person('GuardPl'), 'GuardPl', '900000000000000052');
  await db.insert(s.detectedAccounts).values({ userId: pl, rsn: 'GuardPlugin', rsnNormalized: 'guardplugin', detectedAt: '2026-11-15 12:00:00', lastSeenAt: '2026-11-15 12:00:00' });
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, target.seatId, '900000000000000052'), true);
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, playedAs.seatId, '900000000000000052'), false);

  // Nobody has signed in with it, or they have but hold nothing in THIS clan: allowed.
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, target.seatId, '900000000000000059'), false);
  assert.equal(await roles.discordProvenForOtherSeat(bravo, null, '900000000000000050'), false);
  // A seat they have left does not count.
  await db.update(s.clanMemberships).set({ leftAt: '2026-11-15 13:00:00' }).where(eq(s.clanMemberships.id, mine.seatId));
  assert.equal(await roles.discordProvenForOtherSeat(clan.id, target.seatId, '900000000000000050'), false);
  void meLogin;
});

test('a Discord id typed by staff is a hand link only from an admin, for a real id, on an unclaimed character', async () => {
  const [clan] = await db.insert(s.clans).values({ slug: 'typed', name: 'Typed' }).returning();
  const target = await seat(clan.id, 'TypedTarget');
  const base = { clanId: clan.id, seatId: target.seatId, claimed: false, discordId: '900000000000000060' };

  const byAdmin = await staffEnteredDiscordLink({ ...base, actor: { userId: admin, role: 'admin' } });
  assert.equal(byAdmin.discordIdSource, 'admin');
  assert.equal(byAdmin.discordIdLinkedByUserId, admin);
  assert.equal(byAdmin.discordIdLinkedClanId, clan.id);
  assert.ok(byAdmin.discordIdLinkedAt);
  assert.equal((await staffEnteredDiscordLink({ ...base, actor: { userId: admin, role: 'owner' } })).discordIdSource, 'admin');

  // A moderator may type it, as before, but it is not a hand link.
  for (const role of ['moderator', 'treasurer', 'editor', 'member']) {
    const r = await staffEnteredDiscordLink({ ...base, actor: { userId: admin, role } });
    assert.deepEqual([r.discordId, r.discordIdSource, r.discordIdLinkedByUserId], ['900000000000000060', null, null], role);
  }
  assert.equal((await staffEnteredDiscordLink({ ...base })).discordIdSource, null, 'nobody to attribute it to');
  // A username is not a Discord id.
  assert.equal((await staffEnteredDiscordLink({ ...base, discordId: 'someone#1234', actor: { userId: admin, role: 'admin' } })).discordIdSource, null);
  // A claimed character's Discord comes from its owner.
  assert.equal((await staffEnteredDiscordLink({ ...base, claimed: true, actor: { userId: admin, role: 'admin' } })).discordIdSource, null);
  // The admin's OWN Discord account, when they already hold a seat here: not a hand link.
  const adminsSeat = await seat(clan.id, 'TypedAdmin');
  const [adminRow] = await db.select().from(s.users).where(eq(s.users.id, admin));
  await db.update(s.accounts).set({ playerId: adminRow.playerId!, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, adminsSeat.accountId));
  const self = await staffEnteredDiscordLink({ ...base, discordId: '900000000000000001', actor: { userId: admin, role: 'admin' } });
  assert.equal(self.discordIdSource, null, 'an admin cannot give their own Discord account another member’s rank this way');
  // Cleared: everything goes.
  assert.deepEqual(await staffEnteredDiscordLink({ ...base, discordId: '', actor: { userId: admin, role: 'admin' } }), storedDiscordLink(null, null));
});
