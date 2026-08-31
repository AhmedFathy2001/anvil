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
import { eq, sql } from 'drizzle-orm';

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

test('sharing an account makes it visible to a clan it is not in', async () => {
  const { db, schema: s } = await loadDb();
  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.id, hermitId));

  const seen = await accountsVisibleToClan(alpha, person);
  assert.deepEqual(seen.map((a) => a.rsn).sort(), ['The Hermit', 'The Main']);
});

test('and says WHY it is visible, since those mean different things', async () => {
  // A clan looking at a guest wants to distinguish "on our roster" from "they published this".
  const seen = await accountsVisibleToClan(alpha, person);
  const main = seen.find((a) => a.rsn === 'The Main')!;
  const hermit = seen.find((a) => a.rsn === 'The Hermit')!;
  assert.equal(main.viaSharing, false, 'seated here');
  assert.equal(hermit.viaSharing, true, 'shared, not seated');
});

test('unsharing takes it back', async () => {
  const { db, schema: s } = await loadDb();
  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.id, hermitId));
  assert.deepEqual((await accountsVisibleToClan(alpha, person)).map((a) => a.rsn), ['The Main']);
});

test('sharing is ON by default — this is a cross-clan record', async () => {
  // Flipped in drizzle/0080. Off, the leaderboards and the clan directory could only describe a
  // person through whichever clan you happened to be looking at, which is the silo one site was
  // meant to end. An OSRS name is public anyway. Privacy is still one click, per character.
  const { db, schema: s } = await loadDb();
  const [fresh] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Brand New', rsnNormalized: 'brand new' })
    .returning();
  assert.equal(fresh.shared, true);
  assert.equal(
    (await accountsVisibleToClan(alpha, person)).some((a) => a.rsn === 'Brand New'),
    true,
    'a clan with no seat for it can see a shared character',
  );

  // And turning it off still takes it back — the rule did not change, only its default answer.
  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.id, fresh.id));
  assert.equal(
    (await accountsVisibleToClan(alpha, person)).some((a) => a.rsn === 'Brand New'),
    false,
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
  // Telling a clan "3 others, not shared" is fair; hiding that the count exists would be a
  // different and worse lie to someone deciding whether to admit a guest.
  assert.equal(await hiddenAccountCount(alpha, person), 2, 'the alt and the hermit');
  assert.equal(await hiddenAccountCount(bravo, person), 2, 'the main and the hermit');
});

test('sharing is per account, not per person', async () => {
  // "My main is public, my ironman is nobody's business" is the actual want, and a person-level
  // flag could not say it.
  const { db, schema: s } = await loadDb();
  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.id, mainId));

  const fromBravo = await accountsVisibleToClan(bravo, person);
  assert.deepEqual(fromBravo.map((a) => a.rsn).sort(), ['The Alt', 'The Main']);
  assert.equal(fromBravo.some((a) => a.rsn === 'The Hermit'), false, 'the ironman stays private');

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
