// Co-hosted events (lib/coHost): a host invites a clan, an admin of that clan accepts, and accepting
// provisions their team + delegated staff. Also proves the 0077 migration and that a co-host clan's
// members gain access to the event.
//
// Run: npx tsx --test tests/cohost.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('cohost');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/coHost.ts');
let canSeeEvent: typeof import('../src/lib/eventAccess.ts')['canSeeEvent'];

let hostClan: number;
let guestClan: number;
let eventId: number;
let cohostId: number;
let gAdmin: number; // an admin user of the guest clan
let gMod: number; // a moderator of the guest clan
let gOutsiderUser: number; // a guest-clan member with no staff role
let gMemberPlayer: number; // a player in the guest clan (for the access test)

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/coHost.ts');
  ({ canSeeEvent } = await import('../src/lib/eventAccess.ts'));

  const [host] = await db.insert(s.clans).values({ slug: 'host', name: 'Host Clan' }).returning();
  hostClan = host.id;
  const [guest] = await db.insert(s.clans).values({ slug: 'guest', name: 'Guest Clan' }).returning();
  guestClan = guest.id;

  const mkUser = async (name: string) => (await db.insert(s.users).values({ displayName: name }).returning())[0].id;
  gAdmin = await mkUser('G Admin');
  gMod = await mkUser('G Mod');
  gOutsiderUser = await mkUser('G Member');
  const hostUser = await mkUser('Host Admin');

  // Guest clan's staff: an admin (can accept), a moderator (gets a team seat but can't accept).
  await db.insert(s.clanStaff).values([
    { clanId: guestClan, userId: gAdmin, role: 'admin' },
    { clanId: guestClan, userId: gMod, role: 'moderator' },
    { clanId: hostClan, userId: hostUser, role: 'owner' },
  ]);

  // A playing member of the guest clan, for the access check.
  const [p] = await db.insert(s.players).values({ displayName: 'Guesty' }).returning();
  gMemberPlayer = p.id;
  const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: 'Guesty', rsnNormalized: 'guesty' }).returning();
  await db.insert(s.clanMemberships).values({ clanId: guestClan, accountId: a.id, kind: 'member' });

  // A host event, invited-visibility (so access must come from the co-host relationship).
  const [ev] = await db.insert(s.events).values({ clanId: hostClan, name: 'Rumble', boardSize: 25, visibility: 'invited' }).returning();
  eventId = ev.id;

  const invite = await C.inviteCoHost(eventId, guestClan, hostUser);
  assert.equal(invite.created, true);
  cohostId = invite.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the invite is pending and shows up for the invited clan', async () => {
  const pending = await C.pendingCoHostInvites(guestClan);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].eventName, 'Rumble');
  assert.equal(pending[0].status, 'pending');
});

test('inviting the same clan twice is a no-op, not a duplicate', async () => {
  const again = await C.inviteCoHost(eventId, guestClan, gAdmin);
  assert.equal(again.created, false);
  assert.equal(again.id, cohostId);
});

test('a non-admin of the invited clan cannot accept', async () => {
  const r = await C.acceptCoHostInvite(cohostId, gMod);
  assert.equal(r.ok, false);
});

test('an admin accepting provisions a team tagged to their clan + staff seats', async () => {
  const r = await C.acceptCoHostInvite(cohostId, gAdmin);
  assert.equal(r.ok, true);
  const teamId = (r as { ok: true; teamId: number }).teamId;

  const team = await db.select().from(s.teams).where(eq(s.teams.id, teamId)).then((x) => x[0]);
  assert.equal(team.clanId, guestClan, 'team tagged to the co-host clan');
  assert.equal(team.name, 'Guest Clan');

  // Staff seats went to the guest clan's admin + moderator (moderator-and-up), not the plain member.
  const staff = await db.select().from(s.teamStaff).where(eq(s.teamStaff.teamId, teamId));
  const staffUsers = new Set(staff.map((x) => x.userId));
  assert.ok(staffUsers.has(gAdmin), 'admin got a seat');
  assert.ok(staffUsers.has(gMod), 'moderator got a seat');
  assert.ok(!staffUsers.has(gOutsiderUser), 'a non-staff member did not');

  // The co-host row is now accepted with the team recorded.
  const row = await db.select().from(s.eventCohosts).where(eq(s.eventCohosts.id, cohostId)).then((x) => x[0]);
  assert.equal(row.status, 'accepted');
  assert.equal(row.teamId, teamId);
});

test('accepting again is idempotent — no second team, no duplicate staff', async () => {
  const teamsBefore = await db.select().from(s.teams).where(and(eq(s.teams.eventId, eventId), eq(s.teams.clanId, guestClan)));
  const r = await C.acceptCoHostInvite(cohostId, gAdmin);
  assert.equal(r.ok, true);
  const teamsAfter = await db.select().from(s.teams).where(and(eq(s.teams.eventId, eventId), eq(s.teams.clanId, guestClan)));
  assert.equal(teamsAfter.length, teamsBefore.length, 'no duplicate team');
  assert.equal(teamsAfter.length, 1);

  const staff = await db.select().from(s.teamStaff).where(eq(s.teamStaff.teamId, teamsAfter[0].id));
  const uniqueUsers = new Set(staff.map((x) => x.userId));
  assert.equal(staff.length, uniqueUsers.size, 'no duplicate staff seats');
});

test('a member of the accepted co-host clan can now see the invited-only event', async () => {
  assert.equal(await canSeeEvent({ eventId, playerId: gMemberPlayer }), true);
  // A signed-out stranger still cannot.
  assert.equal(await canSeeEvent({ eventId, playerId: null }), false);
});
