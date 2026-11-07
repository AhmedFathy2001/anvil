// Clan permission rules shared by every path that hands out, takes away or checks a staff job.
//
// Pure: the comparators in lib/clanRoles and the routing table in lib/adminAccess, plus source checks
// on the routes that must call them. The routes themselves need a signed session to drive, so the
// checks here pin that each one ASKS the shared rule rather than carrying its own copy of it — the
// shape every bug in this file was: one path (the roster's "Set role", the bulk bar, the Boards
// picker) that forgot to ask.
//
// Run: node --import tsx --test tests/clan-permission-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { canSetPendingRole, holdsModeratorTier } from '../src/lib/clanRoles.ts';
import { adminLanding, redirectFor } from '../src/lib/adminAccess.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── Pre-assigned roles follow the Staff & roles rule ──────────────────────────────────────────

test('only the owner may pre-assign Admin; an admin may pre-assign below it', () => {
  assert.equal(canSetPendingRole('owner', 'admin'), true);
  assert.equal(canSetPendingRole('admin', 'admin'), false, 'an admin cannot mint another admin via the roster');
  assert.equal(canSetPendingRole('admin', 'moderator'), true);
  assert.equal(canSetPendingRole('admin', 'treasurer'), true);
  assert.equal(canSetPendingRole('moderator', 'moderator'), false);
  assert.equal(canSetPendingRole('treasurer', 'moderator'), false, 'treasurer and moderator tie');
});

test('owner is never pre-assignable, unknown roles never pass, board builder needs admin', () => {
  assert.equal(canSetPendingRole('owner', 'owner'), false);
  assert.equal(canSetPendingRole('owner', 'superuser'), false);
  assert.equal(canSetPendingRole('admin', 'editor'), true);
  assert.equal(canSetPendingRole('moderator', 'editor'), false);
  // Clearing is gated by the route's own admin check, not by rank.
  assert.equal(canSetPendingRole('admin', null), true);
});

// ── Moderator tier ────────────────────────────────────────────────────────────────────────────

test('a clan treasurer is moderator tier; a board-only grant is not', () => {
  assert.equal(holdsModeratorTier({ role: 'treasurer', treasurerScope: 'all' }), true);
  assert.equal(holdsModeratorTier({ role: 'treasurer', treasurerScope: 'assigned' }), false);
  assert.equal(holdsModeratorTier({ role: 'editor', editorScope: 'all' }), true);
  assert.equal(holdsModeratorTier({ role: 'editor', editorScope: 'assigned' }), false);
  assert.equal(holdsModeratorTier({ role: 'moderator' }), true);
  assert.equal(holdsModeratorTier({ role: 'owner' }), true);
  assert.equal(holdsModeratorTier({ role: 'member' }), false);
  assert.equal(holdsModeratorTier(null), false);
});

// ── Routing: a board-only treasurer, and the money pages ──────────────────────────────────────

const boardTreasurer = { role: 'treasurer', canEditTiles: false, editorScope: 'all', treasurerScope: 'assigned' };
const clanTreasurer = { role: 'treasurer', canEditTiles: false, editorScope: 'all', treasurerScope: 'all' };
const moderator = { role: 'moderator', canEditTiles: false, editorScope: 'all' };

test('a board-only treasurer reaches their boards’ money tabs and nothing else', () => {
  assert.equal(redirectFor('/admin/events', boardTreasurer), null);
  assert.equal(redirectFor('/admin/events/7/signups', boardTreasurer), null);
  assert.equal(redirectFor('/admin/events/7/payouts', boardTreasurer), null);
  // Not the board's other tabs…
  assert.equal(redirectFor('/admin/events/7/teams', boardTreasurer), '/admin/events/7/signups');
  assert.equal(redirectFor('/admin/events/7', boardTreasurer), '/admin/events/7/signups');
  assert.equal(redirectFor('/admin/events/new', boardTreasurer), '/admin/events');
  // …and none of the moderator surfaces: dashboard, roster and join requests, activity log, ledger.
  for (const p of ['/admin/dashboard', '/admin/people', '/admin/clan/audit', '/admin/schedule', '/admin/fees', '/admin/coffer', '/admin/proofs']) {
    assert.equal(redirectFor(p, boardTreasurer), '/admin/events', p);
  }
  assert.equal(adminLanding(boardTreasurer), '/admin/events');
  assert.equal(redirectFor(adminLanding(boardTreasurer), boardTreasurer), null, 'lands somewhere it may be');
});

test('a clan treasurer keeps the moderator surfaces, roster and schedule included', () => {
  for (const p of ['/admin/dashboard', '/admin/people', '/admin/schedule', '/admin/fees', '/admin/coffer']) {
    assert.equal(redirectFor(p, clanTreasurer), null, p);
  }
  assert.equal(adminLanding(clanTreasurer), '/admin/dashboard');
});

test('a moderator is not sent to pages only a treasurer can act on', () => {
  assert.equal(redirectFor('/admin/fees', moderator), '/admin/dashboard');
  assert.equal(redirectFor('/admin/coffer', moderator), '/admin/dashboard');
  assert.equal(redirectFor('/admin/schedule', moderator), null);
});

// ── The routes ask the shared rule ────────────────────────────────────────────────────────────

test('Roster "Set role" and bulk set-role apply the Staff & roles grant rule', () => {
  const single = src('src/app/api/admin/clan/[id]/pending-role/route.ts');
  assert.match(single, /canSetPendingRole\(session\.role, role\)/);
  assert.match(single, /canModify\(session\.role, await highestClanRoleOfPerson/);
  const bulk = src('src/app/api/admin/clan/bulk/route.ts');
  assert.match(bulk, /canSetPendingRole\(actor\.role, role\)/);
});

test('bulk ban/unban is admin-only and rank-checked like the per-person route', () => {
  const bulk = src('src/app/api/admin/clan/bulk/route.ts');
  const mod = bulk.match(/const MODERATOR_ACTIONS = new Set<BulkAction>\(\[([^\]]*)\]\)/);
  assert.ok(mod, 'MODERATOR_ACTIONS is declared');
  assert.doesNotMatch(mod![1], /'ban'|'unban'/);
  assert.match(bulk, /canModify\(actor\.role, await highestClanRoleOfPerson\(clan\.id, m\.playerId\)\)/);
});

test('every board/role audit entry names its clan, so it shows on the Activity log', () => {
  const files = [
    'src/app/api/admin/clan/[id]/pending-role/route.ts',
    'src/app/api/admin/clan/bulk/route.ts',
    'src/app/api/admin/users/[userId]/editor-events/route.ts',
    'src/app/api/events/[eventId]/editors/route.ts',
  ];
  for (const f of files) {
    const body = src(f);
    const writes = body.split('db.insert(clanAuditLog)').slice(1);
    assert.ok(writes.length > 0, f);
    for (const w of writes) assert.match(w.slice(0, 400), /clanId:/, `${f}: an audit write without clanId`);
  }
});

test('the Boards picker reads and writes this clan only, with membership and rank checks', () => {
  const r = src('src/app/api/admin/users/[userId]/editor-events/route.ts');
  assert.match(r, /setUserAssignedEvents\(clan\.id, /);
  assert.doesNotMatch(r, /assignedEventIdsForUser\(uId\)/, 'an unscoped read is what revoked other clans’ grants');
  assert.match(r, /hasClanPresence\(clan\.id, uId\)/);
  assert.match(r, /canModify\(session\.role/);
  assert.doesNotMatch(r, /columns: \{[^}]*editorScope: true/, 'no legacy global users.role / editorScope');
});

test('roster list and schedule use the same moderator-tier gate as roster writes', () => {
  for (const f of ['src/app/api/admin/clan/route.ts', 'src/app/api/admin/schedule/route.ts', 'src/app/api/admin/viewers/route.ts']) {
    const body = src(f);
    assert.match(body, /verifyAdminOrModerator\(\)/, f);
    assert.doesNotMatch(body, /role === 'treasurer'/, `${f}: treasurer singled out again`);
  }
  assert.match(src('src/app/admin/fees/page.tsx'), /verifyFeeCollector\(\)/);
});

test('a person banned from a clan holds no authority there, whatever row survived the ban', () => {
  // The backstop in verifyUser: lib/clanBans strips the row on ban; this refuses one that outlived it.
  const auth = src('src/lib/auth.ts');
  assert.match(auth, /const bannedHere = heldGrant != null && clan != null && \(await isBannedFromClan\(clan\.id, playerId\)\)/);
  assert.match(auth, /const grant = bannedHere \? null : heldGrant;/);
  assert.match(auth, /hasBoardGrantInClan\(clan\.id, dbUser\.id\)\) && !\(await isBannedFromClan\(clan\.id, playerId\)\)/);
});
