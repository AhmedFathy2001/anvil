// Which of a person's accounts a clan may see.
//
//   A clan may see an account iff it holds a seat in that clan, OR the account is shared.
//
// The globalised account token forces the question. One token covers every account a person owns
// across every clan, which is the right model — Jagex tracks accounts, and re-linking per clan was
// the part everyone hated — but it means a clan holding one of your accounts must not thereby learn
// the rest. Guesting somewhere on an alt is not telling that clan about your main.
//
// The failure mode is silent in the worst direction: forgetting the rule returns MORE rows, so
// nothing errors, nothing looks wrong from the inside, and the leak is only visible to the person
// whose accounts they are.
//
// Run: npm run test:accountvis

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, sql } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('account-visibility');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let accountsVisibleToClan: typeof import('../src/lib/accountVisibility.ts')['accountsVisibleToClan'];
let hiddenAccountCount: typeof import('../src/lib/accountVisibility.ts')['hiddenAccountCount'];

let alpha: number;
let bravo: number;
let person: number;
/** Seated in alpha. */
let mainId: number;
/** Seated in bravo. */
let altId: number;
/** Seated nowhere. */
let hermitId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ accountsVisibleToClan, hiddenAccountCount } = await import('../src/lib/accountVisibility.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'bravo', name: 'Bravo' },
    ])
    .returning();
  alpha = clans[0].id;
  bravo = clans[1].id;

  const [pl] = await db.insert(s.players).values({ displayName: 'Three Accounts' }).returning();
  person = pl.id;

  const accts = await db
    .insert(s.accounts)
    // EXPLICITLY UNSHARED. These cases are about the SEAT half of the rule — what a clan may see of
    // somebody through its own roster — so they must not inherit the column default, which is now
    // `true` (drizzle/0080). A fixture that leans on a default tests whatever the default happens to
    // be that month rather than the thing it is named after.
    .values([
      { playerId: person, rsn: 'The Main', rsnNormalized: 'the main', isPrimary: 1, shared: false },
      { playerId: person, rsn: 'The Alt', rsnNormalized: 'the alt', shared: false },
      { playerId: person, rsn: 'The Hermit', rsnNormalized: 'the hermit', shared: false },
    ])
    .returning();
  mainId = accts[0].id;
  altId = accts[1].id;
  hermitId = accts[2].id;

  await db.insert(s.clanMemberships).values([
    { clanId: alpha, accountId: mainId, kind: 'member', source: 'roster' },
    { clanId: bravo, accountId: altId, kind: 'guest', source: 'application' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The rule ──────────────────────────────────────────────────────────────────────────────────

test('a clan sees the account it holds, and nothing else of theirs', async () => {
  const seen = await accountsVisibleToClan(alpha, person);
  assert.deepEqual(seen.map((a) => a.rsn), ['The Main']);
});

test('the other clan sees only its own, in the other direction', async () => {
  const seen = await accountsVisibleToClan(bravo, person);
  assert.deepEqual(seen.map((a) => a.rsn), ['The Alt']);
});

test('a clan holding neither sees nothing at all', async () => {
  const { db, schema: s } = await loadDb();
  const [stranger] = await db.insert(s.clans).values({ slug: 'stranger', name: 'Stranger' }).returning();
  assert.deepEqual(await accountsVisibleToClan(stranger.id, person), []);
});

test('publishing a character does NOT show it to a clan it is not in', async () => {
  // THE RULE CHANGED HERE, and this is the test that used to assert the opposite. `shared` meant
  // "any clan may see this", which no clan surface ever honoured — and it conflated being public on
  // the platform with being known to a particular clan. A clan sees what it holds a seat for; being
  // seen by one is now the same act as guesting with it.
  const { db, schema: s } = await loadDb();
  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.id, hermitId));

  const seen = await accountsVisibleToClan(alpha, person);
  assert.deepEqual(seen.map((a) => a.rsn), ['The Main'], 'still only the seat');
});

test('offering it as a guest is what makes it visible', async () => {
  const { db, schema: s } = await loadDb();
  const { admit } = await import('../src/lib/guestAdmission.ts');
  // An open door, so the offer is answered on the spot.
  await db.update(s.clans).set({ guestPolicy: 'open' }).where(eq(s.clans.id, alpha));

  const outcome = await admit({ clanId: alpha, accountId: hermitId, source: 'web' });
  assert.equal(outcome.outcome, 'seated');
  assert.deepEqual(
    (await accountsVisibleToClan(alpha, person)).map((a) => a.rsn).sort(),
    ['The Hermit', 'The Main'],
    'a seat is what a clan can see',
  );
});

test('and taking the seat away takes the visibility with it', async () => {
  const { db, schema: s } = await loadDb();
  const { leaveClan } = await import('../src/lib/guestAdmission.ts');
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, alpha), eq(s.clanMemberships.accountId, hermitId)),
  });
  assert.ok(await leaveClan(seat!.id, person), 'their own seat, theirs to end');

  // A DEPARTED seat still counts — see the next test for why — so the row is removed outright here,
  // which is what a clan that never admitted them looks like.
  await db.delete(s.clanMemberships).where(eq(s.clanMemberships.id, seat!.id));
  assert.deepEqual((await accountsVisibleToClan(alpha, person)).map((a) => a.rsn), ['The Main']);
  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.id, hermitId));
  await db.update(s.clans).set({ guestPolicy: 'approval' }).where(eq(s.clans.id, alpha));
});

test('public on Anvil is ON by default, and says nothing about any clan', async () => {
  // Flipped in drizzle/0080, and it is still the right default: an OSRS name is public anyway, and
  // the cross-clan boards would otherwise describe a person through whichever clan you were
  // standing in. What changed is its SCOPE — it is the platform's answer, not a clan's.
  const { db, schema: s } = await loadDb();
  const [fresh] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Brand New', rsnNormalized: 'brand new' })
    .returning();
  assert.equal(fresh.shared, true, 'public by default');
  assert.equal(
    (await accountsVisibleToClan(alpha, person)).some((a) => a.rsn === 'Brand New'),
    false,
    'and still invisible to a clan that holds no seat for it',
  );
  await db.delete(s.accounts).where(eq(s.accounts.id, fresh.id));
});

test('a departed seat still counts — a clan does not un-learn an RSN', async () => {
  // Its own completions and submissions name that account; pretending not to know it would put
  // holes in the clan's own history.
  const { db, schema: s } = await loadDb();
  await db
    .update(s.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(s.clanMemberships.accountId, mainId));

  assert.deepEqual((await accountsVisibleToClan(alpha, person)).map((a) => a.rsn), ['The Main']);

  await db.update(s.clanMemberships).set({ leftAt: null }).where(eq(s.clanMemberships.accountId, mainId));
});

test('the hidden count is honest about there being more', async () => {
  // Telling a clan "2 others" is fair; hiding that the count exists would be a different and worse
  // lie to somebody deciding whether to admit a guest.
  assert.equal(await hiddenAccountCount(alpha, person), 2, 'the alt and the hermit');
  assert.equal(await hiddenAccountCount(bravo, person), 2, 'the main and the hermit');
});

test('public is per character, not per person', async () => {
  // "My main is public, my ironman is nobody's business" is the actual want, and a person-level flag
  // could not say it. It governs the public pages; neither answer moves a clan's roster.
  const { db, schema: s } = await loadDb();
  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.id, mainId));

  const fromBravo = await accountsVisibleToClan(bravo, person);
  assert.deepEqual(fromBravo.map((a) => a.rsn), ['The Alt'], 'bravo still sees only its own seat');

  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.id, mainId));
});

// ── The clan's People list ────────────────────────────────────────────────────────────────────
//
// getPeopleWithCharacters had both failures at once. It matched `clan_roster.player_id` — a PERSON
// id — against `users.id`, which is a different sequence, so it listed whichever unrelated person
// happened to share the number: on the live database 59 of 60 users collide, and a member with four
// characters was shown holding one that was not theirs. And it carried no clan filter, so every
// character a person holds anywhere would have appeared on one clan's page.

test("a clan's people list shows each person their characters IN THAT CLAN", async () => {
  const { db, schema: s } = await loadDb();
  const { getPeopleWithCharacters } = await import('../src/lib/identity.ts');

  // A login whose id deliberately does NOT equal its person id — the collision that made the old
  // lookup find a stranger. Postgres hands out user ids and player ids from separate sequences, so
  // this is the ordinary case rather than a contrived one.
  const [login] = await db
    .insert(s.users)
    .values({ playerId: person, displayName: 'Three Accounts', discordId: '991000000000000001' })
    .returning();
  assert.notEqual(login.id, person, 'the fixture only means something if the ids differ');

  const inAlpha = await getPeopleWithCharacters(alpha);
  const rowA = inAlpha.find((u) => u.id === login.id);
  assert.ok(rowA, 'they are on alpha\'s roster');
  assert.deepEqual(rowA!.characters.map((c) => c.rsn), ['The Main'], 'alpha sees its own seat only');

  const inBravo = await getPeopleWithCharacters(bravo);
  const rowB = inBravo.find((u) => u.id === login.id);
  assert.ok(rowB, 'and on bravo\'s');
  assert.deepEqual(rowB!.characters.map((c) => c.rsn), ['The Alt'], 'bravo likewise');
});

test('and never a character belonging to whoever shares an id number', async () => {
  const { db, schema: s } = await loadDb();
  const { getPeopleWithCharacters } = await import('../src/lib/identity.ts');

  const login = await db.query.users.findFirst({ where: eq(s.users.discordId, '991000000000000001') });
  assert.ok(login);

  // Build the collision rather than hope for it. On the live database users start at 1 and players
  // at 2, so almost every login's id belongs to some unrelated person — 59 of 60 — but a fresh test
  // database has no such offset, and a test that only fires when the numbers happen to line up is a
  // test that passes for the wrong reason.
  const decoyPersonId = login!.id;
  const existing = await db.query.players.findFirst({ where: eq(s.players.id, decoyPersonId) });
  if (!existing) {
    await db.execute(
      sql`INSERT INTO players (id, display_name) OVERRIDING SYSTEM VALUE VALUES (${decoyPersonId}, 'Coincidence')`,
    );
  }
  assert.notEqual(decoyPersonId, person, 'the decoy must be someone else');

  const [decoyAcct] = await db
    .insert(s.accounts)
    .values({ playerId: decoyPersonId, rsn: 'Not Yours', rsnNormalized: 'not yours' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: alpha, accountId: decoyAcct.id, kind: 'member', source: 'roster' });

  const people = await getPeopleWithCharacters(alpha);
  const row = people.find((u) => u.id === login!.id);
  assert.ok(row, 'the real person is still listed');
  assert.deepEqual(row!.characters.map((c) => c.rsn), ['The Main'], 'theirs, and only theirs');
  assert.equal(
    row!.characters.some((c) => c.rsn === 'Not Yours'),
    false,
    "the id-sharing stranger's character must not appear under this person",
  );
});

// ── Your own page is not the clan's view ──────────────────────────────────────────────────────
//
// The locker lists the accounts a clan CANNOT see, so the Share switch is reachable for exactly the
// accounts a person most wants to decide about. That is safe only because the page is always the
// signed-in person's own — buildLocker is called in one place, with session.playerId. Read as the
// clan's view instead, the same list would be a disclosure of everything the rule exists to hide.
//
// So this pins the boundary from both sides: what the locker shows its owner, and what the clan gets.

test("the locker lists a person's accounts that this clan has no seat for", async () => {
  const { buildLocker } = await import('../src/lib/profileLocker.ts');
  const { db, schema: s } = await loadDb();
  const loginId = (await db.query.users.findFirst({ where: eq(s.users.playerId, person) }))!.id;

  // On alpha, `The Alt` (seated in bravo) and `The Hermit` (seated nowhere) are the hidden ones.
  const locker = await buildLocker(alpha, person, loginId);
  assert.deepEqual(
    locker.accounts.map((a) => a.rsn),
    ['The Main'],
    'the clan-scoped list is still only what alpha holds',
  );
  assert.deepEqual(
    locker.otherAccounts.map((a) => a.rsn).sort(),
    ['The Alt', 'The Hermit'],
    'and the rest are reachable so their switch is',
  );
});

test('but the clan itself still sees only what the rule allows', async () => {
  // The same person, the same clan, asked the other way round. If these two ever agree, the locker
  // has become a leak.
  const seen = await accountsVisibleToClan(alpha, person);
  assert.deepEqual(seen.map((a) => a.rsn), ['The Main']);
});

test('an unshared account is invisible to a clan even while its owner sees it listed', async () => {
  const { buildLocker } = await import('../src/lib/profileLocker.ts');
  const { db, schema: s } = await loadDb();
  const loginId = (await db.query.users.findFirst({ where: eq(s.users.playerId, person) }))!.id;

  const hermit = await db.query.accounts.findFirst({ where: eq(s.accounts.id, hermitId) });
  assert.equal(hermit!.shared, false, 'nothing has been shared');

  const locker = await buildLocker(bravo, person, loginId);
  assert.ok(
    locker.otherAccounts.some((a) => a.rsn === 'The Hermit'),
    'their own page shows it, so they can decide about it',
  );
  assert.equal(
    (await accountsVisibleToClan(bravo, person)).some((a) => a.rsn === 'The Hermit'),
    false,
    'and bravo cannot see it',
  );
});

// ── The rule on a clan surface ───────────────────────────────────────────────
//
// The persona card on a member's profile is where a clan learns who else somebody is, so it is the
// surface that shows what the rule decided. It briefly listed published characters — that was the
// "seat OR shared" rule, and it is gone.

test('a member with one seat here has no persona — a persona of one is the page you are on', async () => {
  const { getPersona } = await import('../src/lib/memberProfile.ts');
  const { db, schema: s } = await loadDb();
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, alpha), eq(s.clanMemberships.accountId, mainId)),
  });
  assert.equal(await getPersona(seat!.id), null);
});

test('publishing a character does not put it on the card', async () => {
  const { getPersona } = await import('../src/lib/memberProfile.ts');
  const { db, schema: s } = await loadDb();
  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.id, hermitId));

  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, alpha), eq(s.clanMemberships.accountId, mainId)),
  });
  assert.equal(await getPersona(seat!.id), null, 'public on Anvil is not a seat here');
});

test('guesting with it does', async () => {
  const { getPersona } = await import('../src/lib/memberProfile.ts');
  const { admit } = await import('../src/lib/guestAdmission.ts');
  const { db, schema: s } = await loadDb();
  await db.update(s.clans).set({ guestPolicy: 'open' }).where(eq(s.clans.id, alpha));
  await admit({ clanId: alpha, accountId: hermitId, source: 'web' });

  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(s.clanMemberships.clanId, alpha), eq(s.clanMemberships.accountId, mainId)),
  });
  const persona = await getPersona(seat!.id);
  assert.ok(persona, 'two seats here now, so there is something to say');
  assert.deepEqual(persona!.accounts.map((a) => a.rsn).sort(), ['The Hermit', 'The Main']);
  // Every row on the card is a seat in THIS clan, which is what its numbers are keyed by.
  assert.ok(persona!.accounts.every((a) => typeof a.id === 'number'));
});

test('the locker says which characters are already waiting at this clan’s door', async () => {
  // So the row can say "asked" instead of offering the same button a second time. The door itself
  // is idempotent either way (lib/guestAdmission), but a button that looks unpressed is a lie about
  // what you already did.
  const { buildLocker } = await import('../src/lib/profileLocker.ts');
  const { admit } = await import('../src/lib/guestAdmission.ts');
  const { db, schema: s } = await loadDb();
  await db.update(s.clans).set({ guestPolicy: 'approval' }).where(eq(s.clans.id, bravo));
  const loginId = (await db.query.users.findFirst({ where: eq(s.users.playerId, person) }))!.id;

  const before = await buildLocker(bravo, person, loginId);
  const hermitBefore = before.otherAccounts.find((a) => a.rsn === 'The Hermit');
  assert.equal(hermitBefore?.guestRequestPending, false, 'nothing asked yet');

  const outcome = await admit({ clanId: bravo, accountId: hermitId, source: 'web' });
  assert.equal(outcome.outcome, 'requested', 'an approval door files a request');

  const after = await buildLocker(bravo, person, loginId);
  const hermitAfter = after.otherAccounts.find((a) => a.rsn === 'The Hermit');
  assert.equal(hermitAfter?.guestRequestPending, true);
  // Still not visible to bravo: a request is not a seat, and only the seat is the answer.
  assert.equal(
    (await accountsVisibleToClan(bravo, person)).some((a) => a.rsn === 'The Hermit'),
    false,
  );
});
