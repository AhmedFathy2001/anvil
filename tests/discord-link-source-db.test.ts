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
import { and, eq } from 'drizzle-orm';

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

  // A moderator's id no longer reaches this function at all (the roster routes and
  // findOrCreateClanMember drop it first, tested below); if one ever did, it is not a hand link.
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

// ── Only an admin or the owner writes a Discord id through the roster helpers ─────────────────────

test('findOrCreateClanMember drops a Discord id from a moderator, or from nobody, and keeps an admin’s', async () => {
  const { findOrCreateClanMember } = await import('../src/lib/clan.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'modrule', name: 'ModRule' }).returning();
  const stored = async (seatId: number) => {
    const [row] = await db
      .select({ discordId: s.accounts.discordId, source: s.accounts.discordIdSource })
      .from(s.clanMemberships)
      .innerJoin(s.accounts, eq(s.accounts.id, s.clanMemberships.accountId))
      .where(eq(s.clanMemberships.id, seatId));
    return row;
  };

  for (const role of ['moderator', 'treasurer', 'editor', 'member']) {
    const id = await findOrCreateClanMember(clan.id, `ModNew ${role}`, { discordId: '900000000000000070', linkedBy: { userId: admin, role } });
    assert.deepEqual(await stored(id), { discordId: null, source: null }, `new entry, ${role}`);
  }
  const anon = await findOrCreateClanMember(clan.id, 'ModNew anon', { discordId: '900000000000000070' });
  assert.deepEqual(await stored(anon), { discordId: null, source: null }, 'nobody to attribute it to');

  // An existing entry with a link an admin made: a moderator's value neither replaces nor clears it.
  const linked = await findOrCreateClanMember(clan.id, 'ModLinked', { discordId: '900000000000000071', linkedBy: { userId: admin, role: 'admin' } });
  assert.deepEqual(await stored(linked), { discordId: '900000000000000071', source: 'admin' });
  await findOrCreateClanMember(clan.id, 'ModLinked', { discordId: '900000000000000072', linkedBy: { userId: admin, role: 'moderator' } });
  assert.deepEqual(await stored(linked), { discordId: '900000000000000071', source: 'admin' });

  const byOwner = await findOrCreateClanMember(clan.id, 'ModOwner', { discordId: '900000000000000073', linkedBy: { userId: admin, role: 'owner' } });
  assert.deepEqual(await stored(byOwner), { discordId: '900000000000000073', source: 'admin' });
});

// ── Slash commands: who a Discord account is, by the same rule as role sync ───────────────────────

test('resolveInvoker: an unproven stored id is "not linked"; proof, this clan’s hand link, or matching on resolve', async () => {
  const { resolveInvoker } = await import('../src/lib/discordContext.ts');
  const [off] = await db.insert(s.clans).values({ slug: 'cmdoff', name: 'CmdOff' }).returning();
  const [on] = await db.insert(s.clans).values({ slug: 'cmdon', name: 'CmdOn' }).returning();
  await db.insert(s.settings).values({ clanId: on.id, key: 'discord_role_match_by_nickname', value: 'true' });

  // source 'name', matching off: not resolved, and flagged so the command can say how to link.
  const named = await seat(off.id, 'CmdNamed', { ...storedDiscordLink('900000000000000080', 'name') });
  const asNamed = await resolveInvoker('900000000000000080', off.id);
  assert.deepEqual([asNamed.memberIds, asNamed.accountIds, asNamed.rsn, asNamed.userId], [[], [], null, null]);
  assert.equal(asNamed.unconfirmedLink, true);

  // Unknown source (stored before sources were recorded): the same.
  await seat(off.id, 'CmdLegacy', { discordId: '900000000000000081' });
  const asLegacy = await resolveInvoker('900000000000000081', off.id);
  assert.deepEqual(asLegacy.memberIds, []);
  assert.equal(asLegacy.unconfirmedLink, true);

  // A hand link made by ANOTHER clan's admin: not that member in this clan; it is in the clan that made it.
  const shared = await seat(off.id, 'CmdShared');
  const [inOn] = await db.insert(s.clanMemberships).values({ clanId: alpha, accountId: shared.accountId, kind: 'guest' }).returning();
  await db.update(s.accounts).set(adminLink('900000000000000082', alpha)).where(eq(s.accounts.id, shared.accountId));
  assert.deepEqual((await resolveInvoker('900000000000000082', off.id)).memberIds, [], 'another clan made this link');
  assert.deepEqual((await resolveInvoker('900000000000000082', alpha)).memberIds, [inOn.id], 'trusted where it was made');

  // A hand link made by THIS clan's admin: resolved.
  const mine = await seat(off.id, 'CmdHand');
  await db.update(s.accounts).set(adminLink('900000000000000083', off.id)).where(eq(s.accounts.id, mine.accountId));
  const asHand = await resolveInvoker('900000000000000083', off.id);
  assert.deepEqual([asHand.memberIds, asHand.rsn, asHand.unconfirmedLink], [[mine.seatId], 'CmdHand', undefined]);

  // A signed-in user who owns the character: resolved by their login, as before, stored id or not.
  const owned = await seat(off.id, 'CmdOwned');
  const owner = await person('CmdOwner');
  const ownerLogin = await login(owner, 'CmdOwner', '900000000000000084');
  await db.update(s.accounts).set({ playerId: owner, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, owned.accountId));
  const asOwner = await resolveInvoker('900000000000000084', off.id);
  assert.deepEqual([asOwner.userId, asOwner.memberIds, asOwner.rsn, asOwner.unconfirmedLink], [ownerLogin, [owned.seatId], 'CmdOwned', undefined]);

  // A login with no player yet, whose sign-up proves the seat: the stored id counts.
  const signed = await seat(off.id, 'CmdSignup', { ...storedDiscordLink('900000000000000085', 'signup') });
  const [bare] = await db.insert(s.users).values({ displayName: 'CmdBare', discordId: '900000000000000085' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: off.id, name: 'Cmd Bingo', boardSize: 25 }).returning();
  assert.deepEqual((await resolveInvoker('900000000000000085', off.id)).memberIds, [], 'a stored label alone is not proof');
  await db.insert(s.eventSignups).values({ eventId: ev.id, userId: bare.id, clanMemberId: signed.seatId, profileData: '{}' });
  assert.deepEqual((await resolveInvoker('900000000000000085', off.id)).memberIds, [signed.seatId]);

  // Nobody Anvil has heard of: not linked, and not flagged.
  const stranger = await resolveInvoker('900000000000000089', off.id);
  assert.deepEqual([stranger.memberIds, stranger.unconfirmedLink], [[], undefined]);

  // Matching ON: the stored id counts whatever its source, as today.
  const onNamed = await seat(on.id, 'CmdOnNamed', { ...storedDiscordLink('900000000000000086', 'name') });
  const onLegacy = await seat(on.id, 'CmdOnLegacy', { discordId: '900000000000000087' });
  assert.deepEqual((await resolveInvoker('900000000000000086', on.id)).memberIds, [onNamed.seatId]);
  const asOnLegacy = await resolveInvoker('900000000000000087', on.id);
  assert.deepEqual([asOnLegacy.memberIds, asOnLegacy.unconfirmedLink], [[onLegacy.seatId], undefined]);
  void named;
});

// ── Removing a hand link, with and without taking the roles back (fake Discord) ───────────────────

// A rank-rule role: rule role ids are stored only when they look like Discord ids (lib/rankRules).
const RULE_ROLE = '700000000001';
const MANAGE_ROLES = (BigInt(1) << BigInt(28)).toString();
const KICK = (BigInt(1) << BigInt(1)).toString();

/** A fake Discord for one guild. Records every call; `fail` maps a role id to the status its DELETE returns. */
function fakeDiscord(o: {
  guild: string;
  botRoles?: string[];
  ownerId?: string;
  members?: Record<string, string[]>;
  fail?: Record<string, number>;
  rolesStatus?: number;
}) {
  const calls: { method: string; path: string }[] = [];
  const roles = [
    { id: o.guild, name: '@everyone', position: 0, managed: false, permissions: '0' },
    { id: 'r-bot', name: 'Anvil', position: 10, managed: true, permissions: MANAGE_ROLES },
    { id: 'r-weak', name: 'Weak bot', position: 10, managed: true, permissions: '0' },
    { id: 'r-member', name: 'Member', position: 2, managed: false, permissions: '0' },
    { id: 'r-guest', name: 'Clan Friend', position: 2, managed: false, permissions: '0' },
    { id: 'r-general', name: 'General', position: 5, managed: false, permissions: '0' },
    { id: RULE_ROLE, name: 'Veteran', position: 4, managed: false, permissions: '0' },
    { id: 'r-bingo', name: 'Bingo', position: 3, managed: false, permissions: '0' },
    { id: 'r-team', name: 'Team Red', position: 1, managed: false, permissions: '0' },
    { id: 'r-captain', name: 'Captain', position: 3, managed: false, permissions: '0' },
    { id: 'r-high', name: 'Elder', position: 12, managed: false, permissions: '0' },
    { id: 'r-friends', name: 'Friends', position: 2, managed: false, permissions: '0' },
    { id: 'r-mods', name: 'Mods', position: 6, managed: false, permissions: KICK },
  ];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace(/^\/api\/v10/, '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path });
    let m: RegExpMatchArray | null;
    if (path === '/users/@me') return Response.json({ id: 'bot-user' });
    if (path === `/guilds/${o.guild}`) return Response.json({ owner_id: o.ownerId ?? 'the-owner' });
    if (method === 'GET' && path === `/guilds/${o.guild}/roles`) {
      return o.rolesStatus ? new Response('{}', { status: o.rolesStatus }) : Response.json(roles);
    }
    if (method === 'GET' && path === `/guilds/${o.guild}/members/bot-user`) return Response.json({ roles: o.botRoles ?? ['r-bot'] });
    if (method === 'GET' && (m = path.match(new RegExp(`^/guilds/${o.guild}/members/(\\d+)$`)))) {
      const held = o.members?.[m[1]];
      return held ? Response.json({ user: { id: m[1], username: 'someone' }, roles: held }) : new Response('{}', { status: 404 });
    }
    if (method === 'DELETE' && (m = path.match(new RegExp(`^/guilds/${o.guild}/members/\\d+/roles/([^/]+)$`)))) {
      const status = o.fail?.[m[1]] ?? 204;
      return new Response(status === 204 ? null : '{}', { status });
    }
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  return {
    calls,
    deletes: () => calls.filter((c) => c.method === 'DELETE').map((c) => c.path.split('/').pop()!).sort(),
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

let unlinkSeq = 0;
/** A clan with the bot connected, a role mapping, and one member hand-linked to a Discord account. */
async function unlinkClan(opts: { connected?: boolean } = {}) {
  const n = ++unlinkSeq;
  const guild = `9100000000000000${String(n).padStart(2, '0')}`;
  const discordId = `9200000000000000${String(n).padStart(2, '0')}`;
  const [clan] = await db.insert(s.clans).values({ slug: `unlink${n}`, name: `Unlink ${n}` }).returning();
  await db.insert(s.settings).values([
    { clanId: clan.id, key: 'discord_guild_id', value: guild },
    ...(opts.connected === false ? [] : [{ clanId: clan.id, key: 'discord_guild_verified_id', value: guild }]),
    // Role sync is OFF: roles it gave earlier can still be taken back.
    { clanId: clan.id, key: 'discord_default_role_ids', value: '["r-member"]' },
    { clanId: clan.id, key: 'discord_guest_role_names', value: '["Clan Friend"]' },
    { clanId: clan.id, key: 'discord_rank_role_map', value: '{"general":"r-general","elder":"r-high","mod":"r-mods"}' },
    { clanId: clan.id, key: 'discord_auto_match_rank_by_name', value: 'false' },
    { clanId: clan.id, key: 'discord_bingo_role_id', value: 'r-bingo' },
    { clanId: clan.id, key: 'discord_captain_role_id', value: 'r-captain' },
  ]);
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: `Unlink Bingo ${n}`, boardSize: 25 }).returning();
  await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#ff0000', discordRoleId: 'r-team' });
  const target = await seat(clan.id, `Unlinked${n}`);
  await db.update(s.accounts).set(adminLink(discordId, clan.id)).where(eq(s.accounts.id, target.accountId));
  const storedId = async () => (await db.select().from(s.accounts).where(eq(s.accounts.id, target.accountId)))[0];
  const audit = async (eventType: string) =>
    db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.clanId, clan.id), eq(s.clanAuditLog.eventType, eventType)));
  return { clan, guild, discordId, target, storedId, audit, eventId: ev.id };
}
const ALL_HELD = ['r-member', 'r-guest', 'r-general', RULE_ROLE, 'r-bingo', 'r-team', 'r-captain', 'r-high', 'r-friends', 'r-mods'];

test('the managed set is the clan’s own mapping: rank, member, guest, rule, event and team roles; never the captain role or anything else', async () => {
  process.env.DISCORD_BOT_TOKEN = 'unlink-test-token';
  const c = await unlinkClan();
  await db.insert(s.settings).values({
    clanId: c.clan.id,
    key: (await import('../src/lib/rankRules.ts')).RANK_RULES_KEY,
    value: JSON.stringify([{ rank: 'sergeant', roleId: RULE_ROLE, keep: true }]),
  });
  const guildRoles = ALL_HELD.map((id, i) => ({ id, name: id === 'r-guest' ? 'Clan Friend' : id, position: i + 1, managed: false, permissions: '0' }));
  const ids = await roles.anvilManagedRoleIds(c.clan.id, guildRoles);
  assert.ok(ids);
  // r-rule is a KEPT rank-rule role: sync gave it through the link, so it is in the set too.
  assert.deepEqual([...ids].sort(), [RULE_ROLE, 'r-bingo', 'r-general', 'r-guest', 'r-high', 'r-member', 'r-mods', 'r-team']);
  assert.ok(!ids.has('r-friends') && !ids.has('r-captain'));
  // A mapped role that is not in the server is not in the set.
  const fewer = await roles.anvilManagedRoleIds(c.clan.id, guildRoles.filter((r) => r.id !== 'r-team'));
  assert.ok(fewer && !fewer.has('r-team'));
  // Another clan's team role is not this clan's.
  const other = await unlinkClan();
  await db.update(s.teams).set({ discordRoleId: 'r-other-team' }).where(eq(s.teams.eventId, other.eventId));
  const mine = await roles.anvilManagedRoleIds(c.clan.id, [...guildRoles, { id: 'r-other-team', name: 'x', position: 1, managed: false, permissions: '0' }]);
  assert.ok(mine && !mine.has('r-other-team'));
});

test('unlink without the roles choice: the link goes, Discord is not called', async () => {
  const { removeHandLink } = await import('../src/lib/discordUnlinkRoles.ts');
  const c = await unlinkClan();
  const d = fakeDiscord({ guild: c.guild, members: { [c.discordId]: ALL_HELD } });
  try {
    const r = await removeHandLink({ clanId: c.clan.id, clanMemberId: c.target.seatId, actorUserId: admin, removeRoles: false });
    assert.ok(r.ok);
    assert.equal(r.roles, null);
    assert.match(r.message, /stay until you remove them in Discord/);
    assert.equal(d.calls.length, 0);
    assert.equal((await c.storedId()).discordId, null);
    assert.equal((await c.audit('discord_link_removed')).length, 1);
    assert.equal((await c.audit('discord_roles_removed')).length, 0);
  } finally {
    d.restore();
  }
});

test('unlink with roles: only managed roles are deleted, per-role failures are reported, and the audit names roles not accounts', async () => {
  const { removeHandLink } = await import('../src/lib/discordUnlinkRoles.ts');
  const c = await unlinkClan();
  const d = fakeDiscord({ guild: c.guild, members: { [c.discordId]: ALL_HELD }, fail: { 'r-general': 403 } });
  try {
    const r = await removeHandLink({ clanId: c.clan.id, clanMemberId: c.target.seatId, actorUserId: admin, removeRoles: true });
    assert.ok(r.ok && r.roles?.status === 'done');
    if (!r.ok || r.roles?.status !== 'done') return;
    // Asked of Discord: the managed, safe, below-the-bot roles the account holds. Nothing else.
    assert.deepEqual(d.deletes(), ['r-bingo', 'r-general', 'r-guest', 'r-member', 'r-team']);
    assert.deepEqual([...r.roles.removed].sort(), ['Bingo', 'Clan Friend', 'Member', 'Team Red']);
    assert.deepEqual(r.roles.failed.map((f) => f.role), ['General']);
    assert.deepEqual(r.roles.skipped.map((x) => x.role), ['Elder']);
    assert.match(r.message, /^Link removed\. Roles removed: /);
    assert.match(r.message, /Not removed: General/);
    assert.match(r.message, /Left: Elder/);
    // Never a kick, a ban, a nickname change or any other write.
    const writes = d.calls.filter((x) => x.method !== 'GET');
    assert.ok(writes.every((x) => x.method === 'DELETE' && /\/members\/\d+\/roles\/[^/]+$/.test(x.path)), JSON.stringify(writes));
    assert.ok(writes.every((x) => x.path.includes(`/guilds/${c.guild}/members/${c.discordId}/`)), 'one account, one server');
    // The link is gone regardless of the failure.
    assert.equal((await c.storedId()).discordId, null);
    const [entry] = await c.audit('discord_roles_removed');
    assert.ok(entry);
    assert.equal(entry.clanMemberId, c.target.seatId);
    assert.equal(entry.actorUserId, admin);
    const text = `${entry.notes} ${entry.oldValue} ${entry.newValue}`;
    assert.match(text, new RegExp(c.target.rsn));
    for (const name of ['Bingo', 'Clan Friend', 'Member', 'Team Red', 'General']) assert.match(text, new RegExp(name));
    assert.ok(!text.includes(c.discordId) && !text.includes('someone'), 'no Discord id or username');
  } finally {
    d.restore();
  }
});

test('unlink with roles: the bot not connected, unable to read, or without Manage Roles removes the link and says the roles were left', async () => {
  const { removeHandLink } = await import('../src/lib/discordUnlinkRoles.ts');
  const cases = [
    { name: 'not connected', clan: await unlinkClan({ connected: false }), fake: {}, says: /not connected/ },
    { name: 'no Manage Roles', clan: await unlinkClan(), fake: { botRoles: ['r-weak'] }, says: /Manage Roles permission/ },
    { name: 'roles unreadable', clan: await unlinkClan(), fake: { rolesStatus: 403 }, says: /could not read/ },
  ];
  for (const k of cases) {
    const d = fakeDiscord({ guild: k.clan.guild, members: { [k.clan.discordId]: ALL_HELD }, ...k.fake });
    try {
      const r = await removeHandLink({ clanId: k.clan.clan.id, clanMemberId: k.clan.target.seatId, actorUserId: admin, removeRoles: true });
      assert.ok(r.ok && r.roles?.status === 'refused', k.name);
      assert.match(r.ok ? r.message : '', k.says, k.name);
      assert.match(r.ok ? r.message : '', /^Link removed\./, k.name);
      assert.match(r.ok ? r.message : '', /no roles were removed/, k.name);
      assert.deepEqual(d.deletes(), [], k.name);
      assert.equal((await k.clan.storedId()).discordId, null, `${k.name}: link still removed`);
      assert.equal((await k.clan.audit('discord_roles_removed')).length, 0, k.name);
    } finally {
      d.restore();
    }
  }
});

test('unlink with roles: skipped while the account still earns them (a proven seat here, or another hand link)', async () => {
  const { removeHandLink } = await import('../src/lib/discordUnlinkRoles.ts');

  // The same Discord account signed in and owns another live seat in this clan.
  const a = await unlinkClan();
  const own = await seat(a.clan.id, 'KeptOwn');
  const me = await person('KeptMe');
  await login(me, 'KeptMe', a.discordId);
  await db.update(s.accounts).set({ playerId: me, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, own.accountId));
  // Another character in this clan is hand-linked to the same account.
  const b = await unlinkClan();
  const second = await seat(b.clan.id, 'KeptSecond');
  await db.update(s.accounts).set(adminLink(b.discordId, b.clan.id)).where(eq(s.accounts.id, second.accountId));

  for (const [k, says] of [[a, /signed in to Anvil/], [b, /another character is still linked by hand/]] as const) {
    const d = fakeDiscord({ guild: k.guild, members: { [k.discordId]: ALL_HELD } });
    try {
      const r = await removeHandLink({ clanId: k.clan.id, clanMemberId: k.target.seatId, actorUserId: admin, removeRoles: true });
      assert.ok(r.ok && r.roles?.status === 'kept');
      assert.match(r.ok ? r.message : '', says);
      assert.equal(d.calls.length, 0, 'Discord is not asked at all');
      assert.equal((await k.storedId()).discordId, null);
    } finally {
      d.restore();
    }
  }

  // A proven seat in ANOTHER clan does not keep the roles here.
  const c = await unlinkClan();
  const elsewhere = await seat(bravo, 'KeptElsewhere');
  const them = await person('KeptThem');
  await login(them, 'KeptThem', c.discordId);
  await db.update(s.accounts).set({ playerId: them, claimedAt: '2026-11-15 12:00:00' }).where(eq(s.accounts.id, elsewhere.accountId));
  const d = fakeDiscord({ guild: c.guild, members: { [c.discordId]: ['r-member'] } });
  try {
    const r = await removeHandLink({ clanId: c.clan.id, clanMemberId: c.target.seatId, actorUserId: admin, removeRoles: true });
    assert.ok(r.ok && r.roles?.status === 'done');
    assert.deepEqual(d.deletes(), ['r-member']);
  } finally {
    d.restore();
  }
});

test('unlink with roles: the server owner is skipped, someone not in the server has nothing to remove', async () => {
  const { removeHandLink } = await import('../src/lib/discordUnlinkRoles.ts');
  const a = await unlinkClan();
  let d = fakeDiscord({ guild: a.guild, ownerId: a.discordId, members: { [a.discordId]: ['r-member', 'r-friends'] } });
  try {
    const r = await removeHandLink({ clanId: a.clan.id, clanMemberId: a.target.seatId, actorUserId: admin, removeRoles: true });
    assert.ok(r.ok && r.roles?.status === 'done');
    if (r.ok && r.roles?.status === 'done') assert.deepEqual([r.roles.removed, r.roles.skipped.map((x) => x.role)], [[], ['Member']]);
    assert.deepEqual(d.deletes(), []);
  } finally {
    d.restore();
  }
  const b = await unlinkClan();
  d = fakeDiscord({ guild: b.guild, members: {} });
  try {
    const r = await removeHandLink({ clanId: b.clan.id, clanMemberId: b.target.seatId, actorUserId: admin, removeRoles: true });
    assert.ok(r.ok && r.roles?.status === 'not-in-server');
    assert.match(r.ok ? r.message : '', /not in your server/);
    assert.deepEqual(d.deletes(), []);
  } finally {
    d.restore();
  }
});

test('unlink refuses a seat with no hand link of this clan, and another clan’s seat', async () => {
  const { removeHandLink } = await import('../src/lib/discordUnlinkRoles.ts');
  const c = await unlinkClan();
  const plain = await seat(c.clan.id, 'NoLink', { discordId: '900000000000000095' });
  const foreign = await seat(c.clan.id, 'ForeignLink');
  await db.update(s.accounts).set(adminLink('900000000000000096', alpha)).where(eq(s.accounts.id, foreign.accountId));
  const d = fakeDiscord({ guild: c.guild });
  try {
    for (const x of [plain, foreign]) {
      const r = await removeHandLink({ clanId: c.clan.id, clanMemberId: x.seatId, actorUserId: admin, removeRoles: true });
      assert.deepEqual([r.ok, r.ok ? 0 : r.status], [false, 409]);
    }
    const wrongClan = await removeHandLink({ clanId: bravo, clanMemberId: c.target.seatId, actorUserId: admin, removeRoles: true });
    assert.deepEqual([wrongClan.ok, wrongClan.ok ? 0 : wrongClan.status], [false, 404]);
    assert.equal(d.calls.length, 0);
    // Untouched: the unknown-source id, the other clan's link, and this clan's own link.
    assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.id, plain.accountId)))[0].discordId, '900000000000000095');
    assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.id, foreign.accountId)))[0].discordId, '900000000000000096');
    assert.equal((await c.storedId()).discordId, c.discordId);
  } finally {
    d.restore();
  }
});
