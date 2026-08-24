// Who is offered a way IN to the surfaces they are allowed to use.
//
// A DIFFERENT FAILURE FROM AUTHORISATION, and a quieter one. Nothing here is a security hole — the
// gates on /admin and /staff were correct throughout. The bug was that the shell decided who to
// show the links to using a hand-written list of role names instead of the ranking every gate uses,
// and the list left out `owner`. So the one person who certainly runs a clan opened it and saw no
// Admin link at all, while `editor` — which is not a clan role, only a capability — sat in the list
// doing nothing. `/staff` had it worse: the page existed and NOTHING in the app linked to it.
//
// This is untestable through the gates, because the gates were right. It is tested here at the
// predicate the shell actually asks.
//
// Run: npx tsx --test tests/staff-links.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLAN_ROLES, hasPlatformRole, isStaffRole, PLATFORM_ROLES } from '../src/lib/clanRoles.ts';

/** Exactly what src/app/layout.tsx computes for the clan nav's Admin link. */
const showsAdminLink = (role: string | null | undefined, canEditTiles = false) =>
  isStaffRole(role) || canEditTiles;

/** Exactly what it computes for the rail's Platform link. */
const showsPlatformLink = (platformRole: string | null | undefined) =>
  hasPlatformRole(platformRole, 'support');

test('an owner is offered their own clan admin — the bug this file exists for', () => {
  assert.equal(
    showsAdminLink('owner'),
    true,
    'the hand-written list was [admin, treasurer, moderator, editor]; owner outranks every one of them',
  );
});

test('every role at moderator or above is offered it', () => {
  for (const role of ['moderator', 'treasurer', 'admin', 'owner']) {
    assert.equal(showsAdminLink(role), true, role);
  }
});

test('a plain member is not — unless they hold the authoring capability', () => {
  assert.equal(showsAdminLink('member'), false);
  assert.equal(
    showsAdminLink('member', true),
    true,
    'a board-scoped editor reaches the tiles surface, so they need the door (lib/adminAccess)',
  );
});

test('somebody with no grant in this clan is offered nothing', () => {
  assert.equal(showsAdminLink(null), false);
  assert.equal(showsAdminLink(undefined), false);
});

test('the link set matches the ROLE LIST, so a new role cannot be silently forgotten', () => {
  // The original bug in one assertion: any clan role that outranks a member must get the link.
  // Written against CLAN_ROLES rather than a copy of it, so adding a rank fails here first.
  for (const role of CLAN_ROLES) {
    const expected = role !== 'member';
    assert.equal(showsAdminLink(role), expected, `${role} should ${expected ? '' : 'not '}see Admin`);
  }
});

// ── The platform axis ─────────────────────────────────────────────────────────────────────────

test('a platform operator is offered /staff, and a clan role never confers it', () => {
  assert.equal(showsPlatformLink('root'), true);
  assert.equal(showsPlatformLink('staff'), true);
  assert.equal(showsPlatformLink('support'), true, 'the lowest rung app/staff/layout admits');
  assert.equal(showsPlatformLink('none'), false);
  assert.equal(showsPlatformLink(null), false);
  // The two axes are independent: owning every clan on the platform grants nothing over it.
  assert.equal(showsPlatformLink('owner'), false, 'a clan role is not a platform role');
});

test('every platform role except none opens the platform surface', () => {
  for (const role of PLATFORM_ROLES) {
    assert.equal(showsPlatformLink(role), role !== 'none', role);
  }
});
