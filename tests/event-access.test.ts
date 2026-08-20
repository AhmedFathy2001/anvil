// Who may see an event, and who may enter it.
//
// Every event was its clan's alone, which was the only thing one-clan-per-deployment could express.
// Clan-versus-clan is the point of putting clans on one platform — and it needs the two questions
// kept apart, because a public board with approval entry (anyone may look, the host decides who
// plays) is the ordinary cross-clan case and neither question alone describes it.
//
// The structural piece worth remembering: event_signups.clan_member_id is NOT NULL and names a seat
// in the HOST clan, so an outsider has nowhere to sit. Entering creates a guest seat there, through
// the same admission path a guest application uses — not a second way onto a roster that skips the
// clan's policy and its bans.
//
// Run: npm run test:eventaccess

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
// Pure predicates — no database import, so safe at the top level. Anything reaching
// eventAccess waits for the dynamic import in before().
import { isEntry, isVisibility } from '../src/lib/eventVisibility.ts';

const DB = useTestDatabase('event-access');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/eventAccess.ts');
let banFromClan: typeof import('../src/lib/clanBans.ts')['banFromClan'];

let host: number;
let guestClan: number;
let strangerClan: number;
let clanEvent: number;
let invitedEvent: number;
let publicEvent: number;
/** A member of the host clan. */
let insider: number;
/** A member of guestClan — invited via their clan. */
let neighbour: number;
/** In strangerClan, invited to nothing. */
let stranger: number;
let staffUser: number;

async function seat(db: never, s: never, clanId: number, playerId: number, rsn: string) {
  const d = db as unknown as Awaited<ReturnType<typeof loadDb>>['db'];
  const sc = s as unknown as Awaited<ReturnType<typeof loadDb>>['schema'];
  const [acct] = await d
    .insert(sc.accounts)
    .values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), verifiedAt: new Date().toISOString() })
    .returning();
  await d
    .insert(sc.clanMemberships)
    .values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' });
  return acct.id;
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/eventAccess.ts');
  ({ banFromClan } = await import('../src/lib/clanBans.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host Clan' },
      { slug: 'neighbour', name: 'Neighbour Clan' },
      { slug: 'stranger', name: 'Stranger Clan' },
    ])
    .returning();
  [host, guestClan, strangerClan] = clans.map((c) => c.id);

  const people = await db
    .insert(s.players)
    .values([{ displayName: 'Insider' }, { displayName: 'Neighbour' }, { displayName: 'Stranger' }])
    .returning();
  [insider, neighbour, stranger] = people.map((x) => x.id);

  const [u] = await db.insert(s.users).values({ displayName: 'Host staff', discordId: '9930000001' }).returning();
  staffUser = u.id;

  await seat(db as never, s as never, host, insider, 'Insider');
  await seat(db as never, s as never, guestClan, neighbour, 'Neighbour');
  await seat(db as never, s as never, strangerClan, stranger, 'Stranger');

  const evs = await db
    .insert(s.events)
    .values([
      { clanId: host, name: 'Ours Alone', boardSize: 25 },
      { clanId: host, name: 'By Invitation', boardSize: 25, visibility: 'invited', entry: 'open' },
      { clanId: host, name: 'Open House', boardSize: 25, visibility: 'public', entry: 'approval' },
    ])
    .returning();
  [clanEvent, invitedEvent, publicEvent] = evs.map((e) => e.id);

  // The neighbour clan is invited to the invite-only one — the clan-versus-clan primitive.
  await db.insert(s.eventInvites).values({ eventId: invitedEvent, clanId: guestClan });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The vocabulary ────────────────────────────────────────────────────────────────────────────

test('unknown settings fall back to the closed answer, not the open one', () => {
  assert.equal(isVisibility('public'), true);
  assert.equal(isVisibility('everyone'), false);
  assert.equal(isEntry('approval'), true);
  assert.equal(isEntry('anyone'), false);
});

// ── Seeing ────────────────────────────────────────────────────────────────────────────────────

test('a clan-only event is invisible to everyone outside the clan', async () => {
  assert.equal(await A.canSeeEvent({ eventId: clanEvent, playerId: insider }), true);
  assert.equal(await A.canSeeEvent({ eventId: clanEvent, playerId: neighbour }), false);
  assert.equal(await A.canSeeEvent({ eventId: clanEvent, playerId: null }), false, 'and to the public');
});

test('an invited event is visible to the clan invited, and nobody else', async () => {
  assert.equal(await A.canSeeEvent({ eventId: invitedEvent, playerId: neighbour }), true);
  assert.equal(await A.canSeeEvent({ eventId: invitedEvent, playerId: stranger }), false);
  assert.equal(await A.canSeeEvent({ eventId: invitedEvent, playerId: null }), false);
});

test('a person can be invited by name, without their clan', async () => {
  const { db, schema: s } = await loadDb();
  assert.equal(await A.canSeeEvent({ eventId: invitedEvent, playerId: stranger }), false);
  await db.insert(s.eventInvites).values({ eventId: invitedEvent, playerId: stranger });
  assert.equal(await A.canSeeEvent({ eventId: invitedEvent, playerId: stranger }), true);
});

test('a public event is visible to a signed-out visitor', async () => {
  assert.equal(await A.canSeeEvent({ eventId: publicEvent, playerId: null }), true);
});

test('host staff can see their own clan-only event with no roster seat', async () => {
  // Authority without a seat is common, and an admin who could not open their own event would be a
  // strange way to enforce privacy.
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'Seatless Admin' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: pl.id, displayName: 'Seatless Admin', discordId: '9930000002' })
    .returning();
  await db.insert(s.clanStaff).values({ clanId: host, userId: u.id, role: 'admin' });

  assert.equal(await A.canSeeEvent({ eventId: clanEvent, playerId: pl.id }), true);
});

// ── Entering ──────────────────────────────────────────────────────────────────────────────────

test('someone already in the host clan is an insider, not an applicant', async () => {
  const v = await A.canEnterEvent({ eventId: publicEvent, playerId: insider });
  assert.deepEqual(v, { outcome: 'insider' });
});

test('an outsider at a public approval event has to be accepted', async () => {
  const v = await A.canEnterEvent({ eventId: publicEvent, playerId: stranger });
  assert.deepEqual(v, { outcome: 'outsider', needsApproval: true });
});

test('an INVITED outsider is not asked to apply as well', async () => {
  // The invitation was the decision. Asking again would be asking twice.
  const { db, schema: s } = await loadDb();
  await db.update(s.events).set({ entry: 'approval' }).where(eq(s.events.id, invitedEvent));

  const v = await A.canEnterEvent({ eventId: invitedEvent, playerId: neighbour });
  assert.deepEqual(v, { outcome: 'outsider', needsApproval: false });
});

test('an outsider cannot enter what they cannot see', async () => {
  const v = await A.canEnterEvent({ eventId: clanEvent, playerId: neighbour });
  assert.deepEqual(v, { outcome: 'refused', reason: 'not-visible' });
});

test('a signed-out visitor can read a public event but not enter it', async () => {
  assert.equal(await A.canSeeEvent({ eventId: publicEvent, playerId: null }), true);
  const v = await A.canEnterEvent({ eventId: publicEvent, playerId: null });
  assert.deepEqual(v, { outcome: 'refused', reason: 'signed-out' });
});

test('a clan ban keeps somebody out of that clan’s PUBLIC events too', async () => {
  // The host clan has said no to this person, and an event is that clan's. A public setting is an
  // invitation to strangers, not an override of a decision already made about someone.
  await banFromClan({ clanId: host, playerId: stranger, byUserId: staffUser });
  const v = await A.canEnterEvent({ eventId: publicEvent, playerId: stranger });
  assert.deepEqual(v, { outcome: 'refused', reason: 'banned' });
});

// ── Defaults ──────────────────────────────────────────────────────────────────────────────────

test('an existing event is unchanged: its clan’s, open to its clan', async () => {
  // The migration must not quietly publish a board that is running right now.
  const { db, schema: s } = await loadDb();
  const [e] = await db.insert(s.events).values({ clanId: host, name: 'Just Made', boardSize: 25 }).returning();
  assert.equal(e.visibility, 'clan');
  assert.equal(e.entry, 'open');
  assert.equal(await A.canSeeEvent({ eventId: e.id, playerId: neighbour }), false);
});

// ── Invitations ───────────────────────────────────────────────────────────────────────────────

test('an invite names a clan or a person, never both and never neither', async () => {
  const { db, schema: s } = await loadDb();
  await assert.rejects(
    () => db.insert(s.eventInvites).values({ eventId: publicEvent, clanId: guestClan, playerId: stranger }),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23514',
    'both is ambiguous about what was invited',
  );
  await assert.rejects(
    () => db.insert(s.eventInvites).values({ eventId: publicEvent }),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23514',
    'neither invites nobody',
  );
});

test('inviting the same clan twice is refused rather than duplicated', async () => {
  const { db, schema: s } = await loadDb();
  await assert.rejects(
    () => db.insert(s.eventInvites).values({ eventId: invitedEvent, clanId: guestClan }),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505',
  );
});

test('withdrawing an invitation closes the door again', async () => {
  const { db, schema: s } = await loadDb();
  await db.delete(s.eventInvites).where(eq(s.eventInvites.playerId, stranger));
  // The stranger is also banned by now, but visibility is the narrower claim being checked here.
  assert.equal(await A.canSeeEvent({ eventId: invitedEvent, playerId: stranger }), false);
});
