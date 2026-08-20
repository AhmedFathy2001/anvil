// Proving a clan is the clan it says it is.
//
// The in-game name was a free-text settings field, so nothing stopped someone claiming a well-known
// clan's name and standing up a site that looked official. That is impersonation, not a naming
// clash, and it is the thing being defended against.
//
// The proof is the roster payload attesting to itself: the plugin reads the member list out of the
// game, and the pusher is in that list with a rank. So the server asks something only a real member
// passes — "are you in the roster you just sent, at an owner-tier rank?"
//
// WHAT THIS IS NOT is worth pinning as hard as what it is. A modified client can send anything. The
// tests below therefore assert the things that hold regardless: first claim wins, a second claim is
// refused rather than merged, and nobody is verified by accident.
//
// Run: npm run test:verification

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
// Pure rank arithmetic — no database import, so it is safe at the top level. Anything
// reaching clanVerification waits for the dynamic import in before().
import { isOwnerTierRank } from '../src/lib/ingameRanks.ts';

const DB = useTestDatabase('clan-verification');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let V: typeof import('../src/lib/clanVerification.ts');

let clanA: number;
let clanB: number;
let staffUser: number;
let ownerAccount: number;

const ROSTER = [
  { rsnNormalized: 'the boss', rank: 'Owner' },
  { rsnNormalized: 'a deputy', rank: 'Deputy Owner' },
  { rsnNormalized: 'a grunt', rank: 'Recruit' },
];

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  V = await import('../src/lib/clanVerification.ts');

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'real', name: 'The Real One' },
      { slug: 'impostor', name: 'Definitely Them' },
    ])
    .returning();
  clanA = clans[0].id;
  clanB = clans[1].id;

  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Operator', discordId: '9920000000000001' })
    .returning();
  staffUser = u.id;

  const [pl] = await db.insert(s.players).values({ displayName: 'Boss' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'The Boss', rsnNormalized: 'the boss' })
    .returning();
  ownerAccount = acct.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Which ranks count ─────────────────────────────────────────────────────────────────────────

test('owner and deputy owner count; nothing else does', () => {
  // Deputy is included because clans routinely run day to day through one, and excluding it would
  // push most real verifications into the manual queue for no gain.
  assert.equal(isOwnerTierRank('Owner'), true);
  assert.equal(isOwnerTierRank('owner'), true);
  assert.equal(isOwnerTierRank('Deputy Owner'), true);
  assert.equal(isOwnerTierRank('Administrator'), false);
  assert.equal(isOwnerTierRank('Recruit'), false);
  assert.equal(isOwnerTierRank(null), false);
  assert.equal(isOwnerTierRank(''), false);
});

test('a renamed owner rank is NOT recognised, which is the known weakness', () => {
  // OSRS lets a clan call its ranks anything, and the plugin sends the display title. A clan whose
  // owner tier is "Emperor" cannot self-verify and needs /staff. Pinned rather than hidden: the
  // numeric ClanRank is the real fix and it is a plugin change.
  assert.equal(isOwnerTierRank('Emperor'), false);
});

// ── Claiming ──────────────────────────────────────────────────────────────────────────────────

test('a roster pushed by an owner-tier account verifies the clan', async () => {
  const r = await V.claimFromRoster({
    clanId: clanA,
    reportedClanName: 'The Real One',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'verified', inGameName: 'The Real One' });

  const state = await V.verificationOf(clanA);
  assert.equal(state.verified, true);
  assert.equal(state.claimedByAccountId, ownerAccount, 'records WHICH account proved it');
});

test('pushing again is a no-op rather than a re-verification', async () => {
  // Called on every sync, so the common answer must be "nothing to do".
  const r = await V.claimFromRoster({
    clanId: clanA,
    reportedClanName: 'The Real One',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'already' });
});

test('a second clan cannot claim a name already verified', async () => {
  // The whole defence. Refused rather than merged: two clans cannot both be the same in-game clan,
  // and picking one automatically is picking a side in a dispute.
  const r = await V.claimFromRoster({
    clanId: clanB,
    reportedClanName: 'The Real One',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'taken', byClanSlug: 'real' });
});

test('and the refusal is case-insensitive, since clan names are', async () => {
  const r = await V.claimFromRoster({
    clanId: clanB,
    reportedClanName: 'the REAL one',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.equal(r.outcome, 'taken');
});

test('someone not in the roster they pushed proves nothing', async () => {
  const { db, schema: s } = await loadDb();
  const [other] = await db.insert(s.clans).values({ slug: 'outsider', name: 'Outsider' }).returning();

  const r = await V.claimFromRoster({
    clanId: other.id,
    reportedClanName: 'Some Other Clan',
    pusherRsnNormalized: 'a stranger',
    pusherAccountId: null,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'not-in-roster' });
  assert.equal((await V.verificationOf(other.id)).verified, false);
});

test('a rank-and-file member cannot verify their own clan', async () => {
  const { db, schema: s } = await loadDb();
  const [c] = await db.insert(s.clans).values({ slug: 'grunts', name: 'Grunts' }).returning();

  const r = await V.claimFromRoster({
    clanId: c.id,
    reportedClanName: 'Grunts',
    pusherRsnNormalized: 'a grunt',
    pusherAccountId: null,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'not-owner', rank: 'Recruit' });
});

test('an empty clan name verifies nothing', async () => {
  const { db, schema: s } = await loadDb();
  const [c] = await db.insert(s.clans).values({ slug: 'nameless', name: 'Nameless' }).returning();
  const r = await V.claimFromRoster({
    clanId: c.id,
    reportedClanName: '   ',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.equal(r.outcome, 'not-in-roster');
});

// ── By hand ───────────────────────────────────────────────────────────────────────────────────

test('an operator can verify what the automatic path cannot reach', async () => {
  const { db, schema: s } = await loadDb();
  const [c] = await db.insert(s.clans).values({ slug: 'emperor', name: 'Emperors' }).returning();

  const r = await V.verifyManually(c.id, 'Emperors Of Gielinor', staffUser);
  assert.equal(r.ok, true);
  const state = await V.verificationOf(c.id);
  assert.equal(state.verified, true);
  assert.equal(state.inGameName, 'Emperors Of Gielinor');
});

test('not even an operator can verify a name another clan holds', async () => {
  const { db, schema: s } = await loadDb();
  const [c] = await db.insert(s.clans).values({ slug: 'greedy', name: 'Greedy' }).returning();
  const r = await V.verifyManually(c.id, 'The Real One', staffUser);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /already verified/);
});

test('withdrawing a badge frees the name for the clan that should have it', async () => {
  // A dispute resolved the other way has to actually resolve — otherwise the impostor keeps the
  // name and the real clan is permanently locked out.
  await V.unverify(clanA, staffUser, 'dispute: not their clan');
  assert.equal((await V.verificationOf(clanA)).verified, false);

  const r = await V.claimFromRoster({
    clanId: clanB,
    reportedClanName: 'The Real One',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.equal(r.outcome, 'verified');
});

test('the database refuses two verified clans with one name', async () => {
  const { db, schema: s } = await loadDb();
  const [c] = await db.insert(s.clans).values({ slug: 'dupe', name: 'Dupe' }).returning();
  await assert.rejects(
    () =>
      db
        .update(s.clans)
        .set({ inGameName: 'The Real One', ingameNameVerifiedAt: new Date().toISOString() })
        .where(eq(s.clans.id, c.id)),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505',
    'the index is the backstop behind the checks',
  );
});

test('but two UNVERIFIED clans may hold the same placeholder', async () => {
  // They have proved nothing, so they reserve nothing. Reserving names on an unproven claim would
  // let anyone squat a clan name by typing it.
  const { db, schema: s } = await loadDb();
  await db.insert(s.clans).values([
    { slug: 'hopeful-a', name: 'Hopeful A', inGameName: 'Contested Name' },
    { slug: 'hopeful-b', name: 'Hopeful B', inGameName: 'Contested Name' },
  ]);
  // No throw is the assertion.
});
