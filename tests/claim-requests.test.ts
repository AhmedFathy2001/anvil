// Mod-approve: the human half of the takeover fix.
//
// With auto-claim-by-RSN closed, an unclaimed roster member links one of two ways — they prove
// control by XP, or a moderator who knows them vouches. This is the vouch. A request is a
// `detected_accounts` suggestion (raised when the plugin refused to auto-claim) whose RSN names an
// unclaimed member seat in the mod's clan; approving binds the account to the requesting PERSON with
// the mod as proof.
//
// The two ways it must not go wrong:
//   - it must bind to the REQUESTER'S PERSON, not their login id (the id-space trap this whole area
//     is riddled with), and
//   - a mod of clan A must not be able to approve a claim on clan B's member by guessing an id.
//
// Run: npx tsx --test tests/claim-requests.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('claim-requests');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let R: typeof import('../src/lib/claimRequests.ts');

let clanA: number;
let clanB: number;
let modUser: number;
/** The requester: a login whose person id is deliberately not equal to its login id. */
let requesterUser: number;
let requesterPlayer: number;
let memberAccountId: number;
let requestId: number;
const RSN = 'Hells Taco';

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  R = await import('../src/lib/claimRequests.ts');

  const [a] = await db.insert(s.clans).values({ slug: 'a', name: 'A', status: 'active' }).returning();
  const [b] = await db.insert(s.clans).values({ slug: 'b', name: 'B', status: 'active' }).returning();
  clanA = a.id;
  clanB = b.id;

  // Push the id spaces apart.
  await db.insert(s.players).values([{ displayName: 'd1' }, { displayName: 'd2' }, { displayName: 'd3' }]);

  const [mod] = await db.insert(s.players).values({ displayName: 'Mod' }).returning();
  const [mu] = await db.insert(s.users).values({ playerId: mod.id, displayName: 'Mod', discordId: 'mod-1' }).returning();
  modUser = mu.id;

  const [reqP] = await db.insert(s.players).values({ displayName: 'Requester' }).returning();
  requesterPlayer = reqP.id;
  const [ru] = await db
    .insert(s.users)
    .values({ playerId: reqP.id, displayName: 'Requester', discordId: 'req-1' })
    .returning();
  requesterUser = ru.id;
  assert.notEqual(requesterUser, requesterPlayer, 'id spaces must differ or this proves nothing');

  // The member: unclaimed, established, a member seat in clan A — and it belongs to a GHOST person
  // (the one findOrCreateAccount mints for every account), NOT the requester. Approving is what moves
  // it to the requester.
  const [ghost] = await db.insert(s.players).values({ displayName: 'Ghost' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: ghost.id, rsn: RSN, rsnNormalized: 'hells taco' })
    .returning();
  memberAccountId = acct.id;
  await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: acct.id, kind: 'member', source: 'roster' });

  // The request: the requester was seen playing that RSN (plugin raised a suggestion).
  const [det] = await db
    .insert(s.detectedAccounts)
    .values({
      userId: requesterUser,
      rsn: RSN,
      rsnNormalized: 'hells taco',
      status: 'pending',
      detectedAt: '2026-08-25T00:00:00.000Z',
      lastSeenAt: '2026-08-25T00:00:00.000Z',
    })
    .returning();
  requestId = det.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function memberAccount() {
  const { db, schema: s } = await loadDb();
  const [row] = await db.select().from(s.accounts).where(eq(s.accounts.id, memberAccountId));
  return row;
}

test('the request shows up for the clan whose member it names', async () => {
  const inA = await R.pendingClaimRequests(clanA);
  assert.equal(inA.length, 1);
  assert.equal(inA[0].rsn, RSN);
  assert.equal(inA[0].requester.displayName, 'Requester', 'the RIGHT person, joined on the login not the person id');
});

test('and not for a clan the member does not belong to', async () => {
  assert.deepEqual(await R.pendingClaimRequests(clanB), []);
});

test('a mod of the wrong clan cannot approve it', async () => {
  const res = await R.approveClaimRequest(clanB, requestId, modUser);
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.code, 'not_found');
  assert.equal((await memberAccount()).claimedAt, null, 'still unclaimed');
});

test('approving binds the account to the requester’s PERSON', async () => {
  const res = await R.approveClaimRequest(clanA, requestId, modUser);
  assert.equal(res.ok, true);

  const acct = await memberAccount();
  assert.equal(acct.playerId, requesterPlayer, 'the person, not the login id');
  assert.notEqual(acct.playerId, requesterUser);
  assert.ok(acct.claimedAt);
  assert.equal(acct.verificationMethod, 'manual', 'a mod vouch');
  assert.equal(acct.provisional, 0, 'confirmed — the mod is the proof, not a step before it');
  assert.equal(acct.verifiedByUserId, modUser);
});

test('once approved it is off the queue', async () => {
  assert.deepEqual(await R.pendingClaimRequests(clanA), []);
});
