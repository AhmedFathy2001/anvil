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

test('any rank in the roster verifies the clan — the owner-tier gate is gone', async () => {
  const { db, schema: s } = await loadDb();
  const [c] = await db.insert(s.clans).values({ slug: 'grunts', name: 'Grunts' }).returning();

  const r = await V.claimFromRoster({
    clanId: c.id,
    reportedClanName: 'Grunts',
    pusherRsnNormalized: 'a grunt',
    pusherAccountId: null,
    roster: ROSTER,
  });
  assert.equal(r.outcome, 'verified');
  assert.equal((await V.verificationOf(c.id)).verified, true);
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

test('the database also refuses duplicate unverified clan names', async () => {
  // A clan name gates roster sync before verification. Allowing two pending clans to hold it would
  // route one in-game roster to both sites, so migration 0082 reserves it at creation time.
  const { db, schema: s } = await loadDb();
  await db.insert(s.clans).values({ slug: 'hopeful-a', name: 'Hopeful A', inGameName: 'Contested Name' });
  await assert.rejects(
    () => db.insert(s.clans).values({ slug: 'hopeful-b', name: 'Hopeful B', inGameName: 'contested name ' }),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505',
    'case and surrounding whitespace cannot create a second reservation',
  );
});

test('an UNVERIFIED name is no reservation: a clan that proves membership takes it over', async () => {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  const [squatter] = await db
    .insert(s.clans)
    .values({ slug: 'squatter', name: 'Typed It First', inGameName: 'Iron Foundry' })
    .returning();
  const [real] = await db.insert(s.clans).values({ slug: 'iron-foundry', name: 'Iron Foundry' }).returning();

  const r = await V.claimFromRoster({
    clanId: real.id,
    reportedClanName: 'Iron Foundry',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'verified', inGameName: 'Iron Foundry' });
  const [after] = await db.select().from(s.clans).where(eq(s.clans.id, squatter.id));
  assert.equal(after.inGameName, null, 'the typed-in claim is released');
  const log = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, squatter.id));
  assert.ok(log.some((l) => l.eventType === 'ingame_name_released'), 'and the release is on record');
});

test('…but without the proof, the unverified holder keeps it', async () => {
  const { db, schema: s } = await loadDb();
  await db.insert(s.clans).values({ slug: 'holder-two', name: 'Holder', inGameName: 'Quiet Clan' });
  const [other] = await db.insert(s.clans).values({ slug: 'claimer-two', name: 'Claimer' }).returning();
  const r = await V.claimFromRoster({
    clanId: other.id,
    reportedClanName: 'Quiet Clan',
    pusherRsnNormalized: 'not in it',
    pusherAccountId: null,
    roster: ROSTER,
  });
  assert.equal(r.outcome, 'not-in-roster');
});

test('…while a clan that signed up this week keeps its unverified name: the proof is client-side', async () => {
  const { db, schema: s } = await loadDb();
  const [young] = await db
    .insert(s.clans)
    .values({ slug: 'brand-new', name: 'Brand New', inGameName: 'Fresh Clan' })
    .returning();
  await db.insert(s.clanAuditLog).values({ clanId: young.id, eventType: 'clan_created', newValue: '{}' });
  const [rival] = await db.insert(s.clans).values({ slug: 'rival', name: 'Rival' }).returning();
  const r = await V.claimFromRoster({
    clanId: rival.id,
    reportedClanName: 'Fresh Clan',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'taken', byClanSlug: 'brand-new' });
});

// ── Owner tier outranks a lower-rank verification ─────────────────────────────────────────────
//
// Any rank verifies, so a recruit can stand a site up under their clan's name before its leaders
// arrive. That verification is provisional against the clan's own owner tier: an owner or deputy
// pushing the same name from another Anvil clan takes it over. One an owner-tier rank (or staff)
// made keeps first-claim-wins.

test('an owner-tier sync takes over a name a lower rank verified elsewhere', async () => {
  const { db, schema: s } = await loadDb();
  const { eq, and } = await import('drizzle-orm');
  const [early] = await db.insert(s.clans).values({ slug: 'recruit-site', name: 'Recruit Site' }).returning();
  const [real] = await db.insert(s.clans).values({ slug: 'owners-site', name: 'Owners Site' }).returning();

  const first = await V.claimFromRoster({
    clanId: early.id,
    reportedClanName: 'Rank Ladder',
    pusherRsnNormalized: 'a grunt',
    pusherAccountId: null,
    roster: ROSTER,
  });
  assert.equal(first.outcome, 'verified');
  const verifiedRow = (
    await db
      .select()
      .from(s.clanAuditLog)
      .where(and(eq(s.clanAuditLog.clanId, early.id), eq(s.clanAuditLog.eventType, 'ingame_name_verified')))
  )[0];
  const recorded = JSON.parse(verifiedRow.newValue!);
  assert.equal(recorded.rank, 'Recruit', 'the verifying rank is recorded');
  assert.equal(recorded.ownerTier, false);

  // A member seat the early clan's roster sync made.
  const [pl] = await db.insert(s.players).values({ displayName: 'Synced' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'Synced', rsnNormalized: 'synced' })
    .returning();
  await db.insert(s.clanMemberships).values({ clanId: early.id, accountId: acct.id, kind: 'member', source: 'roster' });

  const r = await V.claimFromRoster({
    clanId: real.id,
    reportedClanName: 'rank ladder',
    pusherRsnNormalized: 'a deputy',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'verified', inGameName: 'rank ladder' });

  const [oldClan] = await db.select().from(s.clans).where(eq(s.clans.id, early.id));
  assert.equal(oldClan.inGameName, null, 'the old holder loses the name');
  assert.equal(oldClan.ingameNameVerifiedAt, null);
  const [seat] = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, acct.id));
  assert.equal(seat.kind, 'guest', 'its roster member seats are released, like a staff unverify');

  const oldLog = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, early.id));
  assert.ok(oldLog.some((l) => l.eventType === 'ingame_name_unverified'), 'logged on the old holder');
  const newLog = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, real.id));
  const takeover = newLog.find((l) => l.eventType === 'ingame_name_verified');
  assert.equal(JSON.parse(takeover!.newValue!).takenFrom, 'recruit-site', 'and on the new one');
});

test('a lower-rank pusher cannot take over a lower-rank verification', async () => {
  const { db, schema: s } = await loadDb();
  const [a] = await db.insert(s.clans).values({ slug: 'grunt-one', name: 'Grunt One' }).returning();
  const [b] = await db.insert(s.clans).values({ slug: 'grunt-two', name: 'Grunt Two' }).returning();
  const base = { reportedClanName: 'Low Ranks', pusherRsnNormalized: 'a grunt', pusherAccountId: null, roster: ROSTER };
  assert.equal((await V.claimFromRoster({ ...base, clanId: a.id })).outcome, 'verified');
  assert.deepEqual(await V.claimFromRoster({ ...base, clanId: b.id }), { outcome: 'taken', byClanSlug: 'grunt-one' });
});

test('once the owner tier has synced the holder, the name is no longer open to takeover', async () => {
  const { db, schema: s } = await loadDb();
  const [a] = await db.insert(s.clans).values({ slug: 'confirmed', name: 'Confirmed' }).returning();
  const [b] = await db.insert(s.clans).values({ slug: 'late-owner', name: 'Late Owner' }).returning();
  await V.claimFromRoster({
    clanId: a.id,
    reportedClanName: 'Confirmed Clan',
    pusherRsnNormalized: 'a grunt',
    pusherAccountId: null,
    roster: ROSTER,
  });
  await V.confirmOwnerTier(a.id, 'Owner', ownerAccount);
  const r = await V.claimFromRoster({
    clanId: b.id,
    reportedClanName: 'Confirmed Clan',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'taken', byClanSlug: 'confirmed' });
});

test('a staff verification is not open to takeover either', async () => {
  const { db, schema: s } = await loadDb();
  const [a] = await db.insert(s.clans).values({ slug: 'staff-made', name: 'Staff Made' }).returning();
  const [b] = await db.insert(s.clans).values({ slug: 'staff-rival', name: 'Staff Rival' }).returning();
  assert.equal((await V.verifyManually(a.id, 'Staff Clan', staffUser)).ok, true);
  const r = await V.claimFromRoster({
    clanId: b.id,
    reportedClanName: 'Staff Clan',
    pusherRsnNormalized: 'the boss',
    pusherAccountId: ownerAccount,
    roster: ROSTER,
  });
  assert.deepEqual(r, { outcome: 'taken', byClanSlug: 'staff-made' });
});
