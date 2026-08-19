// A clan barring someone from itself — and the ways that could accidentally become more than that.
//
// This was one flag. The clan-side "ban" wrote `users.banned`, which verifyUser refuses a session
// on, so a moderator of one clan signed the person out of EVERY clan on the deployment and off the
// platform. Fine while a clan owned its whole database; a privilege escalation the moment they
// share one.
//
// So the tests here are mostly about REACH: what a clan ban must leave alone. The one that matters
// most is that the in-game roster cannot quietly undo it — a banned member who is still in the
// in-game clan would otherwise be re-seated on the very next sync, which makes the ban decorative.
//
// Run: npm run test:clanbans

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-bans');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let banFromClan: typeof import('../src/lib/clanBans.ts')['banFromClan'];
let liftClanBan: typeof import('../src/lib/clanBans.ts')['liftClanBan'];
let isBannedFromClan: typeof import('../src/lib/clanBans.ts')['isBannedFromClan'];

let alpha: number;
let bravo: number;
/** One person, one account seated in each clan. */
let person: number;
let alphaSeat: number;
let bravoSeat: number;
let staffUser: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ banFromClan, liftClanBan, isBannedFromClan } = await import('../src/lib/clanBans.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'bravo', name: 'Bravo' },
    ])
    .returning();
  alpha = clans[0].id;
  bravo = clans[1].id;

  const [p1] = await db.insert(s.players).values({ displayName: 'Wanderer' }).returning();
  person = p1.id;
  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Staff', discordId: '980000000000000001' })
    .returning();
  staffUser = u.id;

  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: person, rsn: 'Wander Main', rsnNormalized: 'wander main' },
      { playerId: person, rsn: 'Wander Alt', rsnNormalized: 'wander alt' },
    ])
    .returning();

  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: alpha, accountId: accts[0].id, kind: 'member', source: 'roster' },
      { clanId: bravo, accountId: accts[1].id, kind: 'guest', source: 'application' },
    ])
    .returning();
  alphaSeat = seats[0].id;
  bravoSeat = seats[1].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Reach ─────────────────────────────────────────────────────────────────────────────────────

test('a ban in one clan says nothing about another', async () => {
  const r = await banFromClan({ clanId: alpha, playerId: person, byUserId: staffUser });
  assert.equal(r.ok, true);

  assert.equal(await isBannedFromClan(alpha, person), true);
  assert.equal(await isBannedFromClan(bravo, person), false, 'bravo never asked for this');
});

test('and leaves the person themselves untouched', async () => {
  // The whole bug: this used to be a platform ban wearing a clan button.
  const { db, schema: s } = await loadDb();
  const row = await db.query.players.findFirst({ where: eq(s.players.id, person) });
  assert.equal(row?.banned, false, "the PLATFORM ban belongs to /staff, not to a clan");

  const login = await db.query.users.findFirst({ where: eq(s.users.id, staffUser) });
  assert.equal(login?.banned, false);
});

test('their seat in the other clan survives', async () => {
  const { db, schema: s } = await loadDb();
  const seat = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, bravoSeat) });
  assert.equal(seat?.leftAt, null, 'bravo did not remove them; alpha has no say there');
});

test('every seat of theirs in the banning clan is emptied, not just the one', async () => {
  // Keyed on the person: leaving an alt seated would make the ban decorative, and an alt is exactly
  // how someone walks back in.
  const { db, schema: s } = await loadDb();
  const live = await db
    .select()
    .from(s.clanMemberships)
    .where(and(eq(s.clanMemberships.clanId, alpha), isNull(s.clanMemberships.leftAt)));
  assert.equal(live.length, 0);
});

test('the seat is emptied, never deleted', async () => {
  // Completions, submissions and audit rows point at it; a clan's record of an event should not
  // develop holes because someone was removed afterwards.
  const { db, schema: s } = await loadDb();
  const seat = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, alphaSeat) });
  assert.ok(seat, 'the row is still there');
  assert.ok(seat!.leftAt, 'just departed');
});

// ── Lifting ───────────────────────────────────────────────────────────────────────────────────

test('banning twice is refused rather than stacking', async () => {
  const again = await banFromClan({ clanId: alpha, playerId: person, byUserId: staffUser });
  assert.equal(again.ok, false);
});

test('lifting is recorded, not erased', async () => {
  const { db, schema: s } = await loadDb();
  assert.equal(await liftClanBan(alpha, person, staffUser), true);
  assert.equal(await isBannedFromClan(alpha, person), false);

  const rows = await db.select().from(s.clanBans).where(eq(s.clanBans.clanId, alpha));
  assert.equal(rows.length, 1, 'the row stays — "we un-banned them in March" is a real question');
  assert.ok(rows[0].liftedAt);
});

test('lifting does not put them back on the roster', async () => {
  // Coming back is a fresh join, which is the clan's decision to make again.
  const { db, schema: s } = await loadDb();
  const seat = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, alphaSeat) });
  assert.ok(seat!.leftAt, 'still departed');
});

test('a lifted ban does not block a later one', async () => {
  const r = await banFromClan({ clanId: alpha, playerId: person, reason: 'again', byUserId: staffUser });
  assert.equal(r.ok, true, 'the unique index is partial on lifted_at for exactly this');
  await liftClanBan(alpha, person, staffUser);
});

test('an unclaimed account has no person, so nothing to ban', async () => {
  assert.equal(await isBannedFromClan(alpha, null), false);
  assert.equal(await isBannedFromClan(alpha, undefined), false);
});

// ── The ban must survive the things that put people back ──────────────────────────────────────
//
// A ban that the next roster sync undoes is not a ban. Four places in the codebase clear `leftAt`;
// these cover the shared helper they mostly funnel through, plus the invariant itself.

test('the shared find-or-create will not resurrect a banned seat', async () => {
  const { db, schema: s } = await loadDb();
  const { findOrCreateClanMember } = await import('../src/lib/clan.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'resurrect', name: 'Resurrect' }).returning();
  const [who] = await db.insert(s.players).values({ displayName: 'Returner' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: who.id, rsn: 'Returner', rsnNormalized: 'returner' })
    .returning();
  const [seat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster' })
    .returning();

  await banFromClan({ clanId: clan.id, playerId: who.id, byUserId: staffUser });

  // What an import, an admin add, or anything else routed through here would do next.
  const got = await findOrCreateClanMember(clan.id, 'Returner');
  assert.equal(got, seat.id, 'same seat, not a second one');

  const after = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, seat.id) });
  assert.ok(after!.leftAt, 'still departed — the ban outranks the re-add');
});

test('and does resurrect once the ban is lifted', async () => {
  // The guard must be the ban, not a blanket refusal to ever bring anyone back.
  const { db, schema: s } = await loadDb();
  const { findOrCreateClanMember } = await import('../src/lib/clan.ts');

  const clan = await db.query.clans.findFirst({ where: eq(s.clans.slug, 'resurrect') });
  const who = await db.query.players.findFirst({ where: eq(s.players.displayName, 'Returner') });
  await liftClanBan(clan!.id, who!.id, staffUser);

  const seatId = await findOrCreateClanMember(clan!.id, 'Returner');
  const after = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, seatId) });
  assert.equal(after!.leftAt, null, 'back on the roster');
});

test('one live ban per person per clan, enforced by the database', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'onlyone', name: 'Only One' }).returning();
  const [who] = await db.insert(s.players).values({ displayName: 'Dupe' }).returning();

  await db.insert(s.clanBans).values({ clanId: clan.id, playerId: who.id });
  await assert.rejects(
    () => db.insert(s.clanBans).values({ clanId: clan.id, playerId: who.id }),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505',
    'two live bans for one person in one clan is not a state that should exist',
  );
});
