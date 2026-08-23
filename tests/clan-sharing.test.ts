// Whether a stranger may read a clan, and whether its ordinary events are visible signed out.
//
// THE BUG THIS PINS DOWN. `events.visibility` arrived defaulting to 'clan', and 'clan' was read as
// "holds a seat or a grant here" — so every board 404'd for anyone signed out. Not just strangers:
// the clan's own members before they log in, anyone following a link pasted into Discord, and the
// front page's own "See a live event" button. A clan site whose entire habit is sharing the board
// became a wall of not-founds, and nothing failed, because a 404 is a valid answer.
//
// Two settings were being read as one. `events.visibility` says which CLANS an event belongs to —
// ours, an invited one, or anybody's — which is a question about cross-clan play. Whether a stranger
// may read the clan at all belongs to the clan, and until now nobody had asked it.
//
// Run: npx tsx --test tests/clan-sharing.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
// PURE vocabulary, safe at the top level. `lib/clanAccess` imports the db, so it reads DATABASE_URL
// at module load — before useTestDatabase() has pointed it at this suite's own database — and waits
// for the dynamic import in before(). That split is exactly why the vocabulary is its own file.
import { clanVisibilityOf } from '../src/lib/clanVisibility.ts';

const DB = useTestDatabase('clan-sharing');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let canSeeEvent: typeof import('../src/lib/eventAccess.ts')['canSeeEvent'];
let canSeeClan: typeof import('../src/lib/clanAccess.ts')['canSeeClan'];

let openClan: number;
let shutClan: number;
let member: number;
let stranger: number;
let staffUser: number;

let openEvent: number;
let shutEvent: number;
let inviteOnly: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ canSeeEvent } = await import('../src/lib/eventAccess.ts'));
  ({ canSeeClan } = await import('../src/lib/clanAccess.ts'));

  const cs = await db
    .insert(s.clans)
    .values([
      { slug: 'open', name: 'Open Clan' },                            // default visibility
      { slug: 'shut', name: 'Shut Clan', visibility: 'members' },
    ])
    .returning();
  openClan = cs[0].id;
  shutClan = cs[1].id;

  // THE DEFAULT IS THE POINT. A clan created without saying anything shares.
  assert.equal(cs[0].visibility, 'public', 'a new clan shares by default');

  const people = await db
    .insert(s.players)
    .values([{ displayName: 'Member' }, { displayName: 'Stranger' }])
    .returning();
  member = people[0].id;
  stranger = people[1].id;

  const [u] = await db.insert(s.users).values({ displayName: 'Shut staff', discordId: '7710000001' }).returning();
  staffUser = u.id;

  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: member, rsn: 'A Member', rsnNormalized: 'a member' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: shutClan, accountId: acct.id, kind: 'member', source: 'roster' });
  // Authority in the shut clan, and no roster row — the case that locks an admin out of their own
  // clan if only seats are counted.
  await db.insert(s.clanStaff).values({ clanId: shutClan, userId: staffUser, role: 'admin' });

  const evs = await db
    .insert(s.events)
    .values([
      { clanId: openClan, name: 'Ordinary board', boardSize: 25 },     // visibility defaults to 'clan'
      { clanId: shutClan, name: 'Private board', boardSize: 25 },
      { clanId: openClan, name: 'By invitation', boardSize: 25, visibility: 'invited' },
    ])
    .returning();
  [openEvent, shutEvent, inviteOnly] = evs.map((e) => e.id);
  assert.equal(evs[0].visibility, 'clan', "an event's default is still 'clan'");
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The vocabulary ────────────────────────────────────────────────────────────────────────────

test('an unrecognised visibility reads as private, not public', () => {
  assert.equal(clanVisibilityOf('public'), 'public');
  assert.equal(clanVisibilityOf('members'), 'members');
  assert.equal(clanVisibilityOf('everyone'), 'members', 'the closed answer, as everywhere else');
  assert.equal(clanVisibilityOf(null), 'members');
});

// ── The regression ────────────────────────────────────────────────────────────────────────────

test('a sharing clan shows its ordinary board to somebody signed OUT', async () => {
  assert.equal(
    await canSeeEvent({ eventId: openEvent, playerId: null }),
    true,
    'this is the link people paste into Discord; it 404d for a year of habit',
  );
});

test('a sharing clan shows its board to a stranger who is signed in', async () => {
  assert.equal(await canSeeEvent({ eventId: openEvent, playerId: stranger }), true);
});

test('a clan that keeps to itself hides its board from a stranger', async () => {
  assert.equal(await canSeeEvent({ eventId: shutEvent, playerId: stranger }), false);
  assert.equal(await canSeeEvent({ eventId: shutEvent, playerId: null }), false);
});

test('its own member still sees it', async () => {
  assert.equal(await canSeeEvent({ eventId: shutEvent, playerId: member }), true);
});

test('invite-only stays invite-only even in a sharing clan', async () => {
  assert.equal(
    await canSeeEvent({ eventId: inviteOnly, playerId: stranger }),
    false,
    'clan sharing must not widen an event that was deliberately narrowed',
  );
  assert.equal(await canSeeEvent({ eventId: inviteOnly, playerId: null }), false);
});

// ── Reading the clan itself ───────────────────────────────────────────────────────────────────

test('anyone may read a sharing clan, signed in or not', async () => {
  const args = { clanId: openClan, visibility: 'public' };
  assert.equal(await canSeeClan({ ...args, playerId: null, userId: null }), true);
  assert.equal(await canSeeClan({ ...args, playerId: stranger, userId: null }), true);
});

test('a shut clan admits its member and its staff, and nobody else', async () => {
  const args = { clanId: shutClan, visibility: 'members' };
  assert.equal(await canSeeClan({ ...args, playerId: member, userId: null }), true, 'by seat');
  assert.equal(
    await canSeeClan({ ...args, playerId: null, userId: staffUser }),
    true,
    'by grant — an admin with no roster row must not be locked out of their own clan',
  );
  assert.equal(await canSeeClan({ ...args, playerId: stranger, userId: null }), false);
  assert.equal(await canSeeClan({ ...args, playerId: null, userId: null }), false);
});

test('a seat that has been left stops counting', async () => {
  const { db, schema: s } = await loadDb();
  await db
    .update(s.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(s.clanMemberships.clanId, shutClan));

  assert.equal(
    await canSeeClan({ clanId: shutClan, visibility: 'members', playerId: member, userId: null }),
    false,
  );

  await db.update(s.clanMemberships).set({ leftAt: null }).where(eq(s.clanMemberships.clanId, shutClan));
});
