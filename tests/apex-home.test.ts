// The signed-in apex: what wants you, across every clan you play in.
//
// Two things here are easy to get wrong and impossible to notice, because both failures look like a
// working feature:
//
//   1. "Have I entered this?" is a question about the PERSON. `event_signups` is keyed to a SEAT, and
//      a person holds one seat per clan per account — so checking the seat you happened to look up
//      keeps offering somebody an event they are already playing on their alt.
//
//   2. The sign-up window belongs to `lib/signup.ts`. The first cut of this query invented its own
//      and closed on `endDate` instead of `startDate`, which offered a "Sign up" button on every
//      event that was already under way. Nothing on the preview exercised it — no event happened to
//      be mid-flight that evening — so it shipped green.
//
// Both are asserted below against real rows rather than argued about.
//
// Run: npx tsx --test tests/apex-home.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('apex-home');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let H: typeof import('../src/lib/apexHome.ts');

let homeClan: number;
let guestClan: number;
/** The person, who plays two characters. */
let me: number;
/** Somebody else entirely, to prove nothing leaks across people. */
let other: number;

let mainSeat: number;
let altSeat: number;

let upcoming: number;
let midFlight: number;
let enteredOnAlt: number;
let closedDeadline: number;
let notOpenYet: number;
let otherClansEvent: number;

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  H = await import('../src/lib/apexHome.ts');

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'home', name: 'Home Clan' },
      { slug: 'guest', name: 'Guest Clan' },
      { slug: 'elsewhere', name: 'Elsewhere' },
    ])
    .returning();
  homeClan = clans[0].id;
  guestClan = clans[1].id;
  const elsewhere = clans[2].id;

  const people = await db
    .insert(s.players)
    .values([{ displayName: 'Me' }, { displayName: 'Other' }])
    .returning();
  me = people[0].id;
  other = people[1].id;

  // ONE PERSON, TWO CHARACTERS. The main is a member of the home clan; the alt guests elsewhere.
  // This is the shape the whole platform is built for, and the shape that breaks a per-seat check.
  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: me, rsn: 'My Main', rsnNormalized: 'my main' },
      { playerId: me, rsn: 'My Alt', rsnNormalized: 'my alt' },
      { playerId: other, rsn: 'Someone Else', rsnNormalized: 'someone else' },
    ])
    .returning();

  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: homeClan, accountId: accts[0].id, kind: 'member', source: 'roster' },
      { clanId: guestClan, accountId: accts[1].id, kind: 'guest', source: 'roster' },
      { clanId: homeClan, accountId: accts[2].id, kind: 'member', source: 'roster' },
    ])
    .returning();
  mainSeat = seats[0].id;
  altSeat = seats[1].id;

  const evs = await db
    .insert(s.events)
    .values([
      { clanId: homeClan, name: 'Starts next week', boardSize: 25, startDate: iso(7 * DAY) },
      // Under way: started yesterday, ends next week. Its sign-up form is LOCKED.
      { clanId: homeClan, name: 'Already under way', boardSize: 25, startDate: iso(-DAY), endDate: iso(7 * DAY) },
      // In the clan the ALT guests in, and the alt is the seat that entered it.
      { clanId: guestClan, name: 'Entered on the alt', boardSize: 25, startDate: iso(10 * DAY) },
      { clanId: homeClan, name: 'Deadline passed', boardSize: 25, startDate: iso(7 * DAY), signupDeadline: iso(-DAY) },
      { clanId: homeClan, name: 'Opens later', boardSize: 25, startDate: iso(20 * DAY), signupOpensAt: iso(3 * DAY) },
      { clanId: elsewhere, name: 'Somebody elses', boardSize: 25, startDate: iso(7 * DAY) },
    ])
    .returning();
  [upcoming, midFlight, enteredOnAlt, closedDeadline, notOpenYet, otherClansEvent] = evs.map((e) => e.id);

  // The entry sits on the ALT's seat. A per-seat check that looked at the main would miss it.
  await db
    .insert(s.eventSignups)
    .values({ eventId: enteredOnAlt, clanMemberId: altSeat, status: 'approved' });

  // A day of experience on the main, none on the alt — so the character list has an order to hold.
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(s.memberDailyStats).values({
    accountId: accts[0].id,
    day: today,
    overallXp: 5_000_000,
    xpGained: 250_000,
  });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Sign-ups ──────────────────────────────────────────────────────────────────────────────────

test('offers an upcoming event in a clan the person belongs to', async () => {
  const open = await H.openSignups(me, [homeClan, guestClan]);
  const ids = open.map((o) => o.eventId);
  assert.ok(ids.includes(upcoming), 'the one thing this list exists to surface');
});

test('an event already under way is NOT offered — the window closes on start, not end', async () => {
  const open = await H.openSignups(me, [homeClan, guestClan]);
  const ids = open.map((o) => o.eventId);
  assert.ok(
    !ids.includes(midFlight),
    'offering it puts a "Sign up" button on a form lib/signup.ts has already locked',
  );
});

test('entering with ANY of your characters counts — the check is per person, not per seat', async () => {
  const open = await H.openSignups(me, [homeClan, guestClan]);
  const ids = open.map((o) => o.eventId);
  assert.ok(
    !ids.includes(enteredOnAlt),
    'the entry is on the alt\'s seat; a check keyed to the main would re-offer it',
  );
});

test('a passed deadline and an unopened window are both closed', async () => {
  const ids = (await H.openSignups(me, [homeClan, guestClan])).map((o) => o.eventId);
  assert.ok(!ids.includes(closedDeadline), 'deadline passed');
  assert.ok(!ids.includes(notOpenYet), 'window has not opened');
});

test('never reaches into a clan the person does not belong to', async () => {
  const ids = (await H.openSignups(me, [homeClan, guestClan])).map((o) => o.eventId);
  assert.ok(!ids.includes(otherClansEvent));
});

test('somebody with no clans is offered nothing', async () => {
  assert.deepEqual(await H.openSignups(other, []), []);
});

test('a withdrawn sign-up comes back — withdrawing is not declining forever', async () => {
  const { db, schema: s } = await loadDb();
  const [row] = await db
    .insert(s.eventSignups)
    .values({ eventId: upcoming, clanMemberId: mainSeat, status: 'approved' })
    .returning();

  let ids = (await H.openSignups(me, [homeClan, guestClan])).map((o) => o.eventId);
  assert.ok(!ids.includes(upcoming), 'entered, so not offered');

  await db.update(s.eventSignups).set({ status: 'withdrawn' }).where(eq(s.eventSignups.id, row.id));
  ids = (await H.openSignups(me, [homeClan, guestClan])).map((o) => o.eventId);
  assert.ok(ids.includes(upcoming), 'withdrawn, so offered again while the window is open');

  await db.delete(s.eventSignups).where(eq(s.eventSignups.id, row.id));
});

// ── Characters ────────────────────────────────────────────────────────────────────────────────

test('lists every character the person plays, best week first', async () => {
  const chars = await H.characterList(me);
  assert.deepEqual(chars.map((c) => c.rsn), ['My Main', 'My Alt']);
  assert.equal(chars[0].xpThisWeek, 250_000);
  assert.equal(chars[1].xpThisWeek, 0);
});

test("a character's clan is its own member seat, not the person's other clans", async () => {
  const chars = await H.characterList(me);
  const byRsn = Object.fromEntries(chars.map((c) => [c.rsn, c.clanName]));
  assert.equal(byRsn['My Main'], 'Home Clan');
  assert.equal(
    byRsn['My Alt'],
    null,
    'the alt only GUESTS in the guest clan — a guest seat is not belonging to it',
  );
});

test('one person never sees another person\'s characters', async () => {
  const chars = await H.characterList(other);
  assert.deepEqual(chars.map((c) => c.rsn), ['Someone Else']);
});
