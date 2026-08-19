// A person's seats belong to the clan they are in, and a clan may only reach its own.
//
// `seatsOwnedBy` used to take a login and return `eq(playerId, …)` — every seat that person holds
// ANYWHERE. Its callers are clan-side routes acting for one clan, so an admin of clan A passing a
// seat id from clan B got a match whenever the same person owned both. That is how
// `admin/users/[id]/characters/[memberId]` could unclaim another clan's row.
//
// The fix is a signature, not a filter: the clan argument is required, and reaching across clans is
// a differently-named function you have to ask for. These tests hold that boundary, and check the
// one caller that legitimately crosses it still does.
//
// Run: npm run test:seatscope

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('seat-scope');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let seatsOwnedBy: typeof import('../src/lib/roster.ts')['seatsOwnedBy'];
let seatsOwnedByAnywhere: typeof import('../src/lib/roster.ts')['seatsOwnedByAnywhere'];
let findRosterSeats: typeof import('../src/lib/roster.ts')['findRosterSeats'];

let alpha: number;
let bravo: number;
let login: number;
let alphaSeat: number;
let bravoSeat: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ seatsOwnedBy, seatsOwnedByAnywhere, findRosterSeats } = await import('../src/lib/roster.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'bravo', name: 'Bravo' },
    ])
    .returning();
  alpha = clans[0].id;
  bravo = clans[1].id;

  // One human, one login, an account seated in each clan — the ordinary case this is all about.
  const [person] = await db.insert(s.players).values({ displayName: 'Two Clans' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Two Clans', discordId: '990000000000000001' })
    .returning();
  login = u.id;

  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: person.id, rsn: 'Main Here', rsnNormalized: 'main here' },
      { playerId: person.id, rsn: 'Alt There', rsnNormalized: 'alt there' },
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

test('a clan sees only its own seat for a person who is in two', async () => {
  const inAlpha = await findRosterSeats(await seatsOwnedBy(alpha, login));
  assert.deepEqual(inAlpha.map((r) => r.id), [alphaSeat]);

  const inBravo = await findRosterSeats(await seatsOwnedBy(bravo, login));
  assert.deepEqual(inBravo.map((r) => r.id), [bravoSeat]);
});

test('naming another clan\'s seat id does not reach it', async () => {
  const { db, schema: s } = await loadDb();
  // Exactly the shape of the bug: the id comes from a URL, ids are global, so the clan filter is the
  // only thing standing between an admin of alpha and a row belonging to bravo.
  const reached = await db
    .select({ id: s.clanRoster.id })
    .from(s.clanRoster)
    .where(and(eq(s.clanRoster.id, bravoSeat), await seatsOwnedBy(alpha, login)));
  assert.equal(reached.length, 0, "alpha's admin must not find bravo's row");
});

test('the cross-clan variant still exists, and is the one that sees both', async () => {
  // Kept for the reads that are genuinely about the PERSON — "do they already have a primary
  // account" is not a question about any one clan.
  const everywhere = await findRosterSeats(await seatsOwnedByAnywhere(login));
  assert.deepEqual(everywhere.map((r) => r.id).sort((a, b) => a - b), [alphaSeat, bravoSeat].sort((a, b) => a - b));
});

test('a login with no person matches nothing, rather than matching by number', async () => {
  const { db, schema: s } = await loadDb();
  // The failure this replaced: passing the user id straight into a player_id comparison, which
  // matched whichever unrelated person happened to share the number.
  const [orphan] = await db
    .insert(s.users)
    .values({ displayName: 'No person', discordId: '990000000000000002' })
    .returning();

  assert.equal((await findRosterSeats(await seatsOwnedBy(alpha, orphan.id))).length, 0);
  assert.equal((await findRosterSeats(await seatsOwnedByAnywhere(orphan.id))).length, 0);
});

test('null and undefined logins match nothing', async () => {
  assert.equal((await findRosterSeats(await seatsOwnedBy(alpha, null))).length, 0);
  assert.equal((await findRosterSeats(await seatsOwnedBy(alpha, undefined))).length, 0);
});

test('a departed seat is still THEIR seat — leftAt is the caller\'s filter, not this one', async () => {
  // Worth pinning: callers add `isNull(leftAt)` themselves, and several depend on being able to
  // find a departed row (rejoining, history). If this filtered departures the rejoin paths break.
  const { db, schema: s } = await loadDb();
  await db
    .update(s.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(s.clanMemberships.id, alphaSeat));

  const all = await findRosterSeats(await seatsOwnedBy(alpha, login));
  assert.equal(all.length, 1, 'still found');

  const live = await findRosterSeats(and(await seatsOwnedBy(alpha, login), isNull(s.clanRoster.leftAt))!);
  assert.equal(live.length, 0, 'and the caller can exclude it');
});
