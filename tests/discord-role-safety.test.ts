import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  adminLinkStands,
  countSeatsNotLinked,
  countUnconfirmedStoredLinks,
  handLinkRefusal,
  isProvenDiscordId,
  mayHandLink,
  provenSourceOf,
  storedDiscordLink,
  storedSourceForClan,
  isSafeAutomatedRole,
  nameMatchAllowed,
  nicknameMatchingOn,
  ROLE_MATCH_BY_NICKNAME_KEY,
  trustedDiscordIds,
  seatTrustsDiscordId,
  rosterDiscordIdWrite,
  rolesToRemoveOnUnlink,
} from '../src/lib/discordRoleSafety.ts';

const bit = (position: number) => (BigInt(1) << BigInt(position)).toString();

test('automated role assignment accepts an ordinary access-marker role', () => {
  assert.equal(
    isSafeAutomatedRole({ id: 'contestant', managed: false, permissions: '0' }, 'guild'),
    true,
  );
});

test('automated role assignment rejects privileged, managed, everyone and malformed roles', () => {
  assert.equal(isSafeAutomatedRole({ id: 'admin', permissions: bit(3) }, 'guild'), false);
  assert.equal(isSafeAutomatedRole({ id: 'manager', permissions: bit(5) }, 'guild'), false);
  assert.equal(isSafeAutomatedRole({ id: 'mod', permissions: bit(40) }, 'guild'), false);
  assert.equal(isSafeAutomatedRole({ id: 'managed', managed: true, permissions: '0' }, 'guild'), false);
  assert.equal(isSafeAutomatedRole({ id: 'guild', permissions: '0' }, 'guild'), false);
  assert.equal(isSafeAutomatedRole({ id: 'broken', permissions: 'not-a-number' }, 'guild'), false);
});

test('the dangerous list uses Discord\'s real bit positions', () => {
  const role = (p: string) => isSafeAutomatedRole({ id: 'r', permissions: p }, 'guild');
  assert.equal(role(bit(33)), false, 'Manage Events');
  assert.equal(role(bit(32)), true, 'Request to Speak is harmless');
  for (const b of [22, 23, 24, 30]) assert.equal(role(bit(b)), false, `bit ${b}`);
  assert.equal(role(((BigInt(1) << BigInt(10)) | (BigInt(1) << BigInt(11))).toString()), true, 'View Channel + Send Messages');
});

test('guild binding requires Discord ownership, Administrator, or Manage Server', async () => {
  const realFetch = globalThis.fetch;
  const realDatabaseUrl = process.env.DATABASE_URL;
  // discord-permissions reuses discordRest from the role module; that module imports the DB but this
  // pure authorization test never connects to it.
  process.env.DATABASE_URL = realDatabaseUrl || 'postgres://test:test@127.0.0.1:1/not-used';
  let ownerId = 'someone-else';
  let permissions = '0';
  globalThis.fetch = (async (input: string | URL) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/guilds/123456789012345678')) {
      return Response.json({ id: '123456789012345678', name: 'Verified guild', owner_id: ownerId });
    }
    if (path.endsWith('/members/actor')) return Response.json({ roles: ['staff-role'] });
    if (path.endsWith('/roles')) {
      return Response.json([
        { id: '123456789012345678', permissions: '0' },
        { id: 'staff-role', permissions },
      ]);
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const { discordUserCanManageGuild } = await import('../src/lib/discord-permissions.ts');
    ownerId = 'actor';
    assert.equal((await discordUserCanManageGuild('token', '123456789012345678', 'actor')).ok, true);

    ownerId = 'someone-else';
    permissions = bit(5);
    assert.equal((await discordUserCanManageGuild('token', '123456789012345678', 'actor')).ok, true);

    permissions = '0';
    const refused = await discordUserCanManageGuild('token', '123456789012345678', 'actor');
    assert.equal(refused.ok, false);
    assert.match(refused.reason ?? '', /Manage Server/);
  } finally {
    globalThis.fetch = realFetch;
    if (realDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = realDatabaseUrl;
  }
});

// ── Nickname matching is opt-in per clan ──────────────────────────────────────────────────────

test('nickname matching is off unless the clan stored an explicit yes', () => {
  assert.equal(ROLE_MATCH_BY_NICKNAME_KEY, 'discord_role_match_by_nickname');
  for (const raw of [undefined, null, '', 'false', '0', 'yes', 'TRUE']) {
    assert.equal(nicknameMatchingOn(raw), false, `${String(raw)} is off`);
  }
  assert.equal(nicknameMatchingOn('true'), true);
  assert.equal(nicknameMatchingOn('1'), true);
});

test('with nickname matching off, no name match earns roles, however clean it looks', () => {
  // The best case for a name: nobody signed in on either side, nothing proven disagrees.
  const clean = { matchedDiscordId: 'D2', seatPlayerId: null, seatOwnerDiscordId: null, matchedPlayerId: null, matchedHoldsOtherSeat: false };
  assert.equal(nameMatchAllowed({ ...clean, matchByNickname: false }), false);
  assert.equal(nameMatchAllowed({ ...clean, matchByNickname: true }), true);
  // Even the seat's own owner, matched by name: off means the Discord id has to do the matching.
  const owner = { matchedDiscordId: 'D1', seatPlayerId: 5, seatOwnerDiscordId: 'D1', matchedPlayerId: 5, matchedHoldsOtherSeat: false };
  assert.equal(nameMatchAllowed({ ...owner, matchByNickname: false }), false);
});

test('turning nickname matching on does not loosen the checks against what is proven', () => {
  const on = { matchByNickname: true, matchedDiscordId: 'D2', seatPlayerId: 5, seatOwnerDiscordId: 'D1', matchedPlayerId: null, matchedHoldsOtherSeat: false };
  assert.equal(nameMatchAllowed(on), false, 'the owner signed in with a different Discord account');
  assert.equal(nameMatchAllowed({ ...on, seatOwnerDiscordId: null, matchedPlayerId: 6 }), false, 'the match is somebody else');
});

// ── Which Discord id is proven ────────────────────────────────────────────────────────────────

const none = { ownerDiscordId: null, signupDiscordId: null, pluginDiscordId: null, cachedDiscordId: null };

test('proven by the owner signing in with Discord', () => {
  const src = { ...none, ownerDiscordId: 'OWNER' };
  assert.deepEqual(trustedDiscordIds(src, false), ['OWNER']);
  assert.equal(isProvenDiscordId('OWNER', src), true);
});

test('proven by a signed-in event sign-up, or by a plugin report from a signed-in user', () => {
  assert.deepEqual(trustedDiscordIds({ ...none, signupDiscordId: 'SIGNUP' }, false), ['SIGNUP']);
  assert.deepEqual(trustedDiscordIds({ ...none, pluginDiscordId: 'PLUGIN' }, false), ['PLUGIN']);
  assert.equal(isProvenDiscordId('SIGNUP', { ...none, signupDiscordId: 'SIGNUP' }), true);
  // Strongest first, no repeats.
  assert.deepEqual(
    trustedDiscordIds({ ownerDiscordId: 'A', signupDiscordId: 'A', pluginDiscordId: 'B', cachedDiscordId: 'A' }, false),
    ['A', 'B'],
  );
});

test('a stored-only id earns nothing while nickname matching is off', () => {
  const src = { ...none, cachedDiscordId: 'CACHED' };
  assert.deepEqual(trustedDiscordIds(src, false), [], 'off: ignored');
  assert.equal(isProvenDiscordId('CACHED', src), false);
  assert.deepEqual(trustedDiscordIds(src, true), ['CACHED'], 'on: tried, as before');
});

test('a stored id that disagrees with the owner sign-in: the owner id is used, the stored one dropped', () => {
  const src = { ...none, ownerDiscordId: 'OWNER', cachedDiscordId: 'IMPOSTOR' };
  assert.deepEqual(trustedDiscordIds(src, false), ['OWNER']);
  assert.equal(isProvenDiscordId('IMPOSTOR', src), false);
  // On keeps the old order: the stored id is only ever tried after every proven one.
  assert.deepEqual(trustedDiscordIds(src, true), ['OWNER', 'IMPOSTOR']);
});

test('a stored id that agrees with a proven one is just that proven id', () => {
  const src = { ...none, ownerDiscordId: 'OWNER', cachedDiscordId: 'OWNER' };
  assert.deepEqual(trustedDiscordIds(src, false), ['OWNER']);
  assert.equal(isProvenDiscordId('OWNER', src), true);
  assert.equal(isProvenDiscordId(null, src), false);
});

test('the not-linked count: seats no sign-in vouches for, stored ids included', () => {
  assert.equal(countSeatsNotLinked([]), 0);
  assert.equal(
    countSeatsNotLinked([
      { ...none, ownerDiscordId: 'D1' }, // signed in
      { ...none, signupDiscordId: 'D2' }, // signed up while signed in
      { ...none, pluginDiscordId: 'D3' }, // plugin report
      { ...none, cachedDiscordId: 'D4' }, // stored only: not linked
      none, // nothing at all
      { ...none, ownerDiscordId: '' }, // blank is not a link
    ]),
    3,
  );
});

// ── Where a stored id came from ───────────────────────────────────────────────────────────────

test('a hand link by this clan’s admin is trusted with nickname matching off', () => {
  const src = { ...none, cachedDiscordId: 'LINKED', cachedSource: 'admin' as const };
  assert.deepEqual(trustedDiscordIds(src, false), ['LINKED']);
  assert.deepEqual(trustedDiscordIds(src, true), ['LINKED']);
  assert.equal(adminLinkStands(src), true);
  // Trusted for roles, but still not something a sign-in proved.
  assert.equal(isProvenDiscordId('LINKED', src), false);
});

test('a stored id from a nickname match, or of unknown source, is not trusted with matching off', () => {
  for (const cachedSource of ['name', null, undefined] as const) {
    const src = { ...none, cachedDiscordId: 'STORED', cachedSource };
    assert.deepEqual(trustedDiscordIds(src, false), [], `source ${cachedSource}`);
    assert.equal(adminLinkStands(src), false);
    assert.deepEqual(trustedDiscordIds(src, true), ['STORED'], 'on: tried, as before');
  }
  // A stored copy of a proven id carries no trust of its own either.
  for (const cachedSource of ['login', 'signup', 'plugin'] as const) {
    assert.deepEqual(trustedDiscordIds({ ...none, cachedDiscordId: 'STALE', cachedSource }, false), []);
  }
});

test('a hand link that disagrees with the owner’s own sign-in loses to the sign-in', () => {
  const src = { ...none, ownerDiscordId: 'OWNER', cachedDiscordId: 'LINKED', cachedSource: 'admin' as const };
  assert.deepEqual(trustedDiscordIds(src, false), ['OWNER'], 'the linked account gets nothing');
  assert.equal(adminLinkStands(src), false);
  // Agreeing with the sign-in, it is simply that id.
  assert.deepEqual(trustedDiscordIds({ ...src, cachedDiscordId: 'OWNER' }, false), ['OWNER']);
  // Matching on keeps today's order: the stored id is still tried, last.
  assert.deepEqual(trustedDiscordIds(src, true), ['OWNER', 'LINKED']);
});

test('a hand link is tried after every proven id', () => {
  const src = { ...none, signupDiscordId: 'SIGNUP', pluginDiscordId: 'PLUGIN', cachedDiscordId: 'LINKED', cachedSource: 'admin' as const };
  assert.deepEqual(trustedDiscordIds(src, false), ['SIGNUP', 'PLUGIN', 'LINKED']);
});

test('a hand link counts only in the clan whose admin made it', () => {
  assert.equal(storedSourceForClan('admin', 5, 5), 'admin');
  assert.equal(storedSourceForClan('admin', 5, 6), null, 'another clan reads it as unknown');
  assert.equal(storedSourceForClan('admin', null, 5), null, 'no clan on record');
  assert.equal(storedSourceForClan('name', null, 5), 'name');
  assert.equal(storedSourceForClan('login', null, 5), 'login');
  assert.equal(storedSourceForClan(null, 5, 5), null);
  assert.equal(storedSourceForClan('owner', 5, 5), null, 'an unrecognised value is unknown');
});

test('which proven source gives an id', () => {
  const src = { ownerDiscordId: 'A', signupDiscordId: 'A', pluginDiscordId: 'B', cachedDiscordId: 'C' };
  assert.equal(provenSourceOf('A', src), 'login');
  assert.equal(provenSourceOf('B', src), 'plugin');
  assert.equal(provenSourceOf('A', { ...src, ownerDiscordId: null }), 'signup');
  assert.equal(provenSourceOf('C', src), null, 'the stored id proves nothing');
  assert.equal(provenSourceOf(null, src), null);
});

test('the counts: a hand link is linked; a stored id of unknown source is unconfirmed', () => {
  const seats = [
    { ...none, ownerDiscordId: 'D1' }, // signed in
    { ...none, cachedDiscordId: 'D2', cachedSource: 'admin' as const }, // linked by hand here
    { ...none, cachedDiscordId: 'D3' }, // stored, unknown source
    { ...none, cachedDiscordId: 'D4', cachedSource: 'name' as const }, // an old nickname match
    { ...none, ownerDiscordId: 'D5', cachedDiscordId: 'D5' }, // unknown source, but the sign-in backs it
    { ...none, ownerDiscordId: 'D6', cachedDiscordId: 'OLD' }, // signed in; a different old id is stored
    none,
  ];
  assert.equal(countSeatsNotLinked(seats), 3, 'unknown, name and nothing');
  assert.equal(countUnconfirmedStoredLinks(seats), 3, 'D3, D4 and the stale OLD');
});

test('what is written with a stored id: always its source, and who only for a hand link', () => {
  const by = { userId: 9, clanId: 5, at: '2026-11-15T10:00:00.000Z' };
  assert.deepEqual(storedDiscordLink('111', 'admin', by), {
    discordId: '111', discordIdSource: 'admin', discordIdLinkedByUserId: 9, discordIdLinkedAt: by.at, discordIdLinkedClanId: 5,
  });
  assert.deepEqual(storedDiscordLink('111', 'login', by), {
    discordId: '111', discordIdSource: 'login', discordIdLinkedByUserId: null, discordIdLinkedAt: null, discordIdLinkedClanId: null,
  });
  // 'admin' with nobody behind it is not a hand link.
  assert.equal(storedDiscordLink('111', 'admin').discordIdSource, null);
  assert.equal(storedDiscordLink('111', null).discordIdSource, null);
  // No id: everything cleared, whatever was asked for.
  const cleared = { discordId: null, discordIdSource: null, discordIdLinkedByUserId: null, discordIdLinkedAt: null, discordIdLinkedClanId: null };
  assert.deepEqual(storedDiscordLink(null, 'admin', by), cleared);
  assert.deepEqual(storedDiscordLink('  ', 'login'), cleared);
});

test('only an admin or the owner links by hand', () => {
  assert.equal(mayHandLink('owner'), true);
  assert.equal(mayHandLink('admin'), true);
  for (const role of ['moderator', 'treasurer', 'editor', 'member', '', null, undefined]) assert.equal(mayHandLink(role), false, String(role));
});

test('a hand link is refused for a claimed character, and for a Discord account proven to be another member', () => {
  assert.equal(handLinkRefusal({ seatClaimed: false, provenForOtherSeat: false }), null);
  assert.match(handLinkRefusal({ seatClaimed: true, provenForOtherSeat: false })!, /belongs to a player/);
  assert.match(handLinkRefusal({ seatClaimed: false, provenForOtherSeat: true })!, /already belongs to a different member/);
});

// ── Slash commands use the role rule (lib/discordContext resolveInvoker) ──────────────────────────

const noProof = { ownerDiscordId: null, signupDiscordId: null, pluginDiscordId: null };

test('a stored id from a nickname match, or of unknown source, is not that member with matching off', () => {
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: 'name' }, false), false);
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: null }, false), false);
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1' }, false), false);
  // A stored label is not proof by itself: the sign-in it names has to still be there.
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: 'login' }, false), false);
});

test('a hand link counts only in the clan whose admin made it', () => {
  const here = storedSourceForClan('admin', 7, 7);
  const elsewhere = storedSourceForClan('admin', 8, 7);
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: here }, false), true);
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: elsewhere }, false), false);
  // The owner signed in with a different account: their sign-in beats the hand link.
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, ownerDiscordId: 'd2', cachedDiscordId: 'd1', cachedSource: 'admin' }, false), false);
});

test('an id a sign-in, sign-up or plugin report proves is that member, matching on or off', () => {
  for (const on of [false, true]) {
    assert.equal(seatTrustsDiscordId('d1', { ...noProof, ownerDiscordId: 'd1', cachedDiscordId: null }, on), true);
    assert.equal(seatTrustsDiscordId('d1', { ...noProof, signupDiscordId: 'd1', cachedDiscordId: 'd1', cachedSource: 'signup' }, on), true);
    assert.equal(seatTrustsDiscordId('d1', { ...noProof, pluginDiscordId: 'd1', cachedDiscordId: null }, on), true);
  }
});

test('with nickname matching on, a stored id counts whatever its source, as before', () => {
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: 'name' }, true), true);
  assert.equal(seatTrustsDiscordId('d1', { ...noProof, cachedDiscordId: 'd1', cachedSource: null }, true), true);
  assert.equal(seatTrustsDiscordId('d9', { ...noProof, cachedDiscordId: 'd1', cachedSource: 'name' }, true), false, 'only the id that is stored');
  assert.equal(seatTrustsDiscordId(null, { ...noProof, cachedDiscordId: 'd1' }, true), false);
});

// ── Who may write a Discord id on the roster forms ────────────────────────────────────────────────

test('only an admin or the owner sets, changes or clears a Discord id on the roster', () => {
  for (const role of ['owner', 'admin']) {
    assert.deepEqual(rosterDiscordIdWrite(role, '123'), { write: true, ignored: false }, role);
    assert.deepEqual(rosterDiscordIdWrite(role, ''), { write: true, ignored: false }, `${role} clears`);
    assert.deepEqual(rosterDiscordIdWrite(role, null), { write: true, ignored: false }, `${role} clears with null`);
  }
  for (const role of ['moderator', 'treasurer', 'editor', 'member', null, undefined]) {
    assert.deepEqual(rosterDiscordIdWrite(role, '123'), { write: false, ignored: true }, String(role));
    assert.deepEqual(rosterDiscordIdWrite(role, ''), { write: false, ignored: true }, `${role} cannot clear`);
    assert.deepEqual(rosterDiscordIdWrite(role, null), { write: false, ignored: true }, `${role} cannot clear with null`);
  }
  // The field was not sent: nothing to write and nothing ignored, whoever asks.
  for (const role of ['owner', 'admin', 'moderator']) {
    assert.deepEqual(rosterDiscordIdWrite(role, undefined), { write: false, ignored: false }, role);
  }
});

// ── Roles taken back when a hand link is removed ──────────────────────────────────────────────────

const guildRoles = [
  { id: 'guild', name: '@everyone', position: 0, permissions: '0' },
  { id: 'member', name: 'Member', position: 2, permissions: '0' },
  { id: 'general', name: 'General', position: 3, permissions: '0' },
  { id: 'team', name: 'Team Red', position: 1, permissions: '0' },
  { id: 'booster', name: 'Server Booster', position: 4, permissions: '0', managed: true },
  { id: 'friends', name: 'Friends', position: 2, permissions: '0' },
  { id: 'mods', name: 'Mods', position: 5, permissions: bit(1) },
  { id: 'high', name: 'Veteran', position: 9, permissions: '0' },
];
const unlink = (over: Partial<Parameters<typeof rolesToRemoveOnUnlink>[0]> = {}) =>
  rolesToRemoveOnUnlink({
    guildId: 'guild',
    managedRoleIds: ['member', 'general', 'team', 'high', 'mods', 'booster', 'guild', 'gone'],
    heldRoleIds: ['member', 'general', 'team', 'friends', 'booster', 'mods', 'high', 'guild'],
    guildRoles,
    botTopPosition: 8,
    isGuildOwner: false,
    ...over,
  });

test('unlink removes only held roles from the managed set', () => {
  const d = unlink();
  assert.deepEqual(d.remove.map((r) => r.id).sort(), ['general', 'member', 'team']);
  assert.deepEqual(d.remove.find((r) => r.id === 'general'), { id: 'general', name: 'General' });
});

test('a role outside the managed set is never removed, whatever else is true', () => {
  const d = unlink();
  assert.ok(!d.remove.some((r) => r.id === 'friends'));
  assert.ok(!d.skipped.some((r) => r.id === 'friends'));
  // Nothing managed: nothing removed, even though the account holds plenty.
  assert.deepEqual(unlink({ managedRoleIds: [] }), { remove: [], skipped: [] });
  // Managed but not held: not removed either.
  assert.deepEqual(unlink({ heldRoleIds: ['friends'] }), { remove: [], skipped: [] });
});

test('unlink never touches @everyone, an integration role, or a role with moderation powers, even if mapped', () => {
  const d = unlink();
  for (const id of ['guild', 'booster', 'mods']) {
    assert.ok(!d.remove.some((r) => r.id === id), id);
    assert.ok(!d.skipped.some((r) => r.id === id), id);
  }
});

test('a managed role at or above the bot is skipped with a reason, not attempted', () => {
  const d = unlink();
  assert.deepEqual(d.skipped, [{ id: 'high', name: 'Veteran', reason: 'above-bot' }]);
  // Exactly at the bot's own position counts as above: Discord needs strictly below.
  const level = unlink({ botTopPosition: 3 });
  assert.deepEqual(level.skipped.map((r) => r.id).sort(), ['general', 'high']);
  assert.deepEqual(level.remove.map((r) => r.id).sort(), ['member', 'team']);
});

test('the server owner has every managed role skipped, none removed', () => {
  const d = unlink({ isGuildOwner: true });
  assert.deepEqual(d.remove, []);
  assert.deepEqual(d.skipped.map((r) => [r.id, r.reason]).sort(), [
    ['general', 'server-owner'],
    ['high', 'server-owner'],
    ['member', 'server-owner'],
    ['team', 'server-owner'],
  ]);
});

test('a managed role that is no longer in the server, or held twice in the list, is handled once or not at all', () => {
  const d = unlink({ heldRoleIds: ['member', 'member', 'gone'] });
  assert.deepEqual(d, { remove: [{ id: 'member', name: 'Member' }], skipped: [] });
});

// ── The roster routes apply the rule (read from source: they need a signed-in request to run) ─────

test('every roster write of a Discord id sits behind the admin-or-owner rule', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['src/app/api/admin/clan/route.ts', 'src/app/api/admin/clan/[id]/route.ts']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(src, /rosterDiscordIdWrite\(user\.role,/, `${file} asks the rule with the caller's role`);
    const writes = [...src.matchAll(/await staffEnteredDiscordLink\(/g)];
    assert.ok(writes.length > 0, file);
    for (const w of writes) {
      assert.match(src.slice(Math.max(0, w.index! - 700), w.index!), /discordWrite\.write/, `${file}: a write outside the rule`);
    }
    assert.match(src, /DISCORD_ID_ADMIN_ONLY/, `${file} tells the moderator`);
  }
  // The shared helper behind event-player import and weekly enrolment drops it too.
  const lib = readFileSync(new URL('../src/lib/clan.ts', import.meta.url), 'utf8');
  assert.match(lib, /!mayHandLink\(options\.linkedBy\.role\)\) options = \{ \.\.\.options, discordId: null \}/);
});
