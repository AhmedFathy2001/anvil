import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  countSeatsNotLinked,
  isSafeAutomatedRole,
  nameMatchAllowed,
  nicknameMatchingOn,
  ROLE_MATCH_BY_NICKNAME_KEY,
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

test('the not-linked count: seats with neither a signed-in owner nor a linked Discord account', () => {
  assert.equal(countSeatsNotLinked([]), 0);
  assert.equal(
    countSeatsNotLinked([
      { ownerDiscordId: 'D1', linkedDiscordId: null }, // signed in
      { ownerDiscordId: null, linkedDiscordId: 'D2' }, // linked to a Discord account
      { ownerDiscordId: null, linkedDiscordId: null }, // nickname only
      { ownerDiscordId: '', linkedDiscordId: '' }, // blank is not a link
    ]),
    2,
  );
});
