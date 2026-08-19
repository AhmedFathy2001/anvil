// Which admin pages a grant reaches.
//
// This table used to be ninety lines of nested conditionals inside middleware, decided from the role
// baked into the session cookie — untestable, and wrong the moment one deployment served more than
// one clan. Pulling it into a pure function is what makes it checkable at all.
//
// Run: npm run test:adminaccess

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redirectFor, adminLanding } from '../src/lib/adminAccess.ts';

const admin = { role: 'admin', canEditTiles: true, editorScope: 'all' };
const owner = { role: 'owner', canEditTiles: true, editorScope: 'all' };
const moderator = { role: 'moderator', canEditTiles: false, editorScope: 'all' };
const treasurer = { role: 'treasurer', canEditTiles: false, editorScope: 'all' };
const modWhoAuthors = { role: 'moderator', canEditTiles: true, editorScope: 'all' };
const boardEditor = { role: 'member', canEditTiles: true, editorScope: 'assigned' };
const plainMember = { role: 'member', canEditTiles: false, editorScope: 'all' };

/** Allowed reads better than `null` at a glance. */
const allowed = null;

test('no grant in this clan means no admin area in this clan', () => {
  // The case the whole change exists for: an admin of somewhere else arrives with no grant here.
  assert.equal(redirectFor('/admin/dashboard', null), '/');
  assert.equal(redirectFor('/admin/events', null), '/');
});

test('a plain member is not staff, however plain', () => {
  assert.equal(redirectFor('/admin/dashboard', plainMember), '/');
});

test('admins and owners reach everything', () => {
  for (const who of [admin, owner]) {
    assert.equal(redirectFor('/admin/dashboard', who), allowed);
    assert.equal(redirectFor('/admin/events/new', who), allowed);
    assert.equal(redirectFor('/admin/integrations', who), allowed);
    assert.equal(redirectFor('/admin/events/12/teams', who), allowed);
  }
});

test('moderators get the moderator surfaces and are turned away from the rest', () => {
  assert.equal(redirectFor('/admin/dashboard', moderator), allowed);
  assert.equal(redirectFor('/admin/clan', moderator), allowed);
  assert.equal(redirectFor('/admin/verifications', moderator), allowed);
  assert.equal(redirectFor('/admin/integrations', moderator), '/admin/dashboard');
  // Running events is administration, not moderation.
  assert.equal(redirectFor('/admin/events', moderator), '/admin/dashboard');
  assert.equal(redirectFor('/admin/events/new', moderator), '/admin/dashboard');
});

test('a treasurer is the same tier as a moderator', () => {
  assert.equal(redirectFor('/admin/fees', treasurer), allowed);
  assert.equal(redirectFor('/admin/dashboard', treasurer), allowed);
  assert.equal(redirectFor('/admin/integrations', treasurer), '/admin/dashboard');
});

test('authoring is a capability, so a moderator can build boards without being promoted', () => {
  assert.equal(redirectFor('/admin/events/12/tiles', modWhoAuthors), allowed);
  assert.equal(redirectFor('/admin/tile-library', modWhoAuthors), allowed);
  // Opening a board to author on is not permission to run it.
  assert.equal(redirectFor('/admin/events/12/teams', modWhoAuthors), '/admin/events/12/tiles');
  assert.equal(redirectFor('/admin/events/12', modWhoAuthors), '/admin/events/12/tiles');
  // And they keep their moderator surfaces.
  assert.equal(redirectFor('/admin/clan', modWhoAuthors), allowed);
});

test('a board editor sees their boards and nothing else', () => {
  assert.equal(redirectFor('/admin/events', boardEditor), allowed);
  assert.equal(redirectFor('/admin/events/12/tiles', boardEditor), allowed);
  assert.equal(redirectFor('/admin/tile-library', boardEditor), allowed);

  // None of the moderator surfaces.
  assert.equal(redirectFor('/admin/dashboard', boardEditor), '/admin/events');
  assert.equal(redirectFor('/admin/clan', boardEditor), '/admin/events');
  assert.equal(redirectFor('/admin/verifications', boardEditor), '/admin/events');
  // Nor creating events, which is administration.
  assert.equal(redirectFor('/admin/events/new', boardEditor), '/admin/events');
  // Inside a board: the Tiles tab only.
  assert.equal(redirectFor('/admin/events/12/teams', boardEditor), '/admin/events/12/tiles');
});

test('the tiles tab and everything under it counts as authoring', () => {
  assert.equal(redirectFor('/admin/events/12/tiles', boardEditor), allowed);
  assert.equal(redirectFor('/admin/events/12/tiles/5', boardEditor), allowed);
});

test('everyone lands somewhere they are allowed to be', () => {
  assert.equal(adminLanding(admin), '/admin/dashboard');
  assert.equal(adminLanding(moderator), '/admin/dashboard');
  assert.equal(adminLanding(boardEditor), '/admin/events');
  // A landing page that redirects is a loop, so each one has to pass its own gate.
  for (const who of [admin, moderator, treasurer, boardEditor, modWhoAuthors]) {
    assert.equal(redirectFor(adminLanding(who), who), allowed, `${who.role} lands somewhere it may be`);
  }
});
