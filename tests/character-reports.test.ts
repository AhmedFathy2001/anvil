// Character reports (lib/characterReports): a clan raises a character with Anvil; only platform staff
// change who owns it. Also pins that the clan-side routes which used to do it are retired.
//
// Run: npx tsx --test tests/character-reports.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('characterreports');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/characterReports.ts');

let clanId: number;
let staffUser: number;
let owner: number; // person holding the character
let ownerLogin: number;
let other: number; // person it should go to
let accountId: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/characterReports.ts');

  const [c] = await db.insert(s.clans).values({ slug: 'reporter', name: 'Reporter' }).returning();
  clanId = c.id;
  staffUser = (await db.insert(s.users).values({ displayName: 'Op' }).returning())[0].id;

  const [p1] = await db.insert(s.players).values({ displayName: 'Holder' }).returning();
  owner = p1.id;
  ownerLogin = (await db.insert(s.users).values({ displayName: 'Holder', playerId: owner }).returning())[0].id;
  const [p2] = await db.insert(s.players).values({ displayName: 'Rightful' }).returning();
  other = p2.id;

  const now = new Date().toISOString();
  const [a] = await db
    .insert(s.accounts)
    .values({
      playerId: owner,
      rsn: 'Disputed',
      rsnNormalized: 'disputed',
      claimedAt: now,
      verifiedAt: now,
      verificationMethod: 'plugin_first_use',
      provisional: 1,
      accountHash: '123',
    })
    .returning();
  accountId = a.id;
  await db.insert(s.clanMemberships).values({ clanId, accountId, kind: 'member' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('filing twice adds to one open report rather than starting a second', async () => {
  const a = await R.fileCharacterReport({ accountId, clanId, reportedByUserId: staffUser, kind: 'claim_review', body: 'not theirs' });
  const b = await R.fileCharacterReport({ accountId, clanId, reportedByUserId: staffUser, kind: 'claim_review', body: 'still not theirs' });
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(a.id, b.id);
  const [row] = await db.select().from(s.characterReports).where(eq(s.characterReports.id, a.id));
  assert.match(row.body ?? '', /not theirs[\s\S]*still not theirs/);
  assert.deepEqual([...(await R.openReportAccountIds([accountId]))], [accountId]);

  const listed = await R.listCharacterReports();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].account.ownerName, 'Holder');
  assert.equal(listed[0].clan?.slug, 'reporter');
});

test('staff detach hands the character back and stops the old plugin re-taking it', async () => {
  assert.equal(await R.detachCharacter(accountId, staffUser, 'wrong person'), true);
  const acct = await db.query.accounts.findFirst({ where: eq(s.accounts.id, accountId) });
  assert.notEqual(acct!.playerId, owner, 'no longer the holder’s');
  assert.equal(acct!.claimedAt, null);
  assert.equal(acct!.verifiedAt, null);
  assert.equal(acct!.accountHash, null, 'a first-use hash was the claimant’s, not the account’s');
  const dismissed = await db.query.detectedAccounts.findFirst({ where: eq(s.detectedAccounts.userId, ownerLogin) });
  assert.equal(dismissed?.status, 'dismissed');

  assert.equal(await R.detachCharacter(accountId, staffUser), false, 'nothing left to detach');
});

test('staff reassign gives it to the right person, vouched by staff', async () => {
  const res = await R.reassignCharacter(accountId, other, staffUser, 'proved by screenshot');
  assert.deepEqual(res, { ok: true });
  const acct = await db.query.accounts.findFirst({ where: eq(s.accounts.id, accountId) });
  assert.equal(acct!.playerId, other);
  assert.ok(acct!.claimedAt);
  assert.equal(acct!.verifiedByUserId, staffUser);
  assert.equal(acct!.provisional, 0);
});

test('resolving closes it once', async () => {
  const [open] = await R.listCharacterReports();
  assert.equal(await R.resolveCharacterReport(open.id, staffUser, 'resolved', 'reassigned'), true);
  assert.equal(await R.resolveCharacterReport(open.id, staffUser, 'dismissed'), false);
  assert.equal((await R.listCharacterReports()).length, 0);
  assert.equal((await R.listCharacterReports({ status: 'all' }))[0].resolution, 'reassigned');
});

test('the clan-side attach and detach routes are retired', async () => {
  const attach = await import('../src/app/api/admin/users/[userId]/characters/route.ts');
  const detach = await import('../src/app/api/admin/users/[userId]/characters/[memberId]/route.ts');
  assert.equal((await attach.POST()).status, 403);
  assert.equal((await detach.DELETE()).status, 403);
});
