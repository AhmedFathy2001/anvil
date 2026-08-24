// Proving a character is yours, without being in a clan.
//
// `accounts.verifiedAt` has carried this note since it was written: "Global, because it is a fact
// about the account and not about any clan: proving ownership once proves it everywhere, and nobody
// should have to re-prove the same RSN per clan." The routes did not honour it — both ends of the
// stat-delta flow called requireClan() and finished by seating you — so the only way to say who you
// were was to already be somewhere. Which is the one thing a new arrival cannot do.
//
// FOUR BUGS LIVED IN THAT FLOW, and every one of them passed typecheck, lint and the full suite.
//
//   THE WRONG ID SPACE, WRITTEN. Both branches wrote `playerId: session.userId` — a LOGIN id into a
//   PERSON column. The sequences diverged long ago (on the preview data not ONE of the sixty logins
//   has id = player_id), so it never failed: it attached the freshly-proven character to a real,
//   unrelated person.
//
//   THE WRONG ID SPACE, COMPARED. The ownership guards read `existing.playerId !== session.userId`,
//   comparing a person against a login — unrelated numbers that collide often enough to look right.
//
//   THE OWNERSHIP CHECK COULD NOT SEE SEATLESS ACCOUNTS. It ran through `clan_roster`, which needs a
//   seat, so a character owned by somebody currently in no clan read as free to take. This flow now
//   creates exactly those on purpose, which turns a stale check into a way to take somebody's
//   character off them.
//
//   THE FIRST CHARACTER 500'd. `update(accounts).set({isPrimary:1}).where(eq(clanMemberships.id,…))`
//   — an UPDATE on one table keyed on a column of another, which Postgres rejects outright. It ran
//   only when the person had no primary yet, so the one case it broke was somebody's FIRST
//   character: the link committed and the request then failed on the next line.
//
// Run: npx tsx --test tests/account-claim.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('account-claim');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let C: typeof import('../src/lib/accountClaim.ts');

/** Two people, each with a login, whose person ids deliberately do NOT match their login ids. */
let meUser: number;
let mePlayer: number;
let themPlayer: number;
let clanId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  C = await import('../src/lib/accountClaim.ts');

  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'somewhere', name: 'Somewhere', status: 'active' })
    .returning();
  clanId = clan.id;

  // PUSH THE SEQUENCES APART FIRST. If players.id and users.id happen to line up, every assertion
  // below passes with the login id written into the person column — which is precisely how the bug
  // survived. These decoys make the two spaces disagree, the way real data does.
  await db.insert(s.players).values([
    { displayName: 'decoy one' },
    { displayName: 'decoy two' },
    { displayName: 'decoy three' },
  ]);

  const [me] = await db.insert(s.players).values({ displayName: 'Me' }).returning();
  mePlayer = me.id;
  const [u] = await db
    .insert(s.users)
    .values({ playerId: me.id, displayName: 'Me', discordId: 'me-1' })
    .returning();
  meUser = u.id;

  const [them] = await db.insert(s.players).values({ displayName: 'Them' }).returning();
  themPlayer = them.id;
  await db.insert(s.users).values({ playerId: them.id, displayName: 'Them', discordId: 'them-1' });

  assert.notEqual(meUser, mePlayer, 'the two id spaces must disagree or this suite proves nothing');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function accountByRsn(rsnNormalized: string) {
  const { db, schema: s } = await loadDb();
  const [row] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, rsnNormalized));
  return row;
}

// ── The claim attaches to a PERSON ────────────────────────────────────────────────────────────

test('a claimed character belongs to the person, not to whoever shares the login id', async () => {
  const r = await C.claimAccountForPerson({
    playerId: mePlayer,
    rsn: 'My Main',
    rsnNormalized: 'my main',
    method: 'stat_delta',
    provisional: true,
    actorUserId: meUser,
  });
  assert.equal(r.ok, true);

  const acct = await accountByRsn('my main');
  assert.equal(acct.playerId, mePlayer, 'the person');
  assert.notEqual(acct.playerId, meUser, 'emphatically NOT the login');
  assert.equal(acct.verificationMethod, 'stat_delta');
  assert.equal(acct.provisional, 1, 'Hiscores movement does not say WHICH human');
  assert.ok(acct.claimedAt);
});

test('and no seat appears anywhere — a claim is not a membership', async () => {
  const { db, schema: s } = await loadDb();
  const seats = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.clanId, clanId));
  assert.equal(seats.length, 0, 'proving who you are says nothing about anyone’s roster');
});

test('the first character becomes the primary one', async () => {
  // The line this replaces threw on exactly this case, because the WHERE named another table. It
  // only ran when the person had no primary — so the flow worked for everybody EXCEPT a new user.
  const acct = await accountByRsn('my main');
  assert.equal(acct.isPrimary, 1);
});

test('the second does not steal primary from the first', async () => {
  await C.claimAccountForPerson({
    playerId: mePlayer,
    rsn: 'My Iron',
    rsnNormalized: 'my iron',
    method: 'stat_delta',
    actorUserId: meUser,
  });
  assert.equal((await accountByRsn('my iron')).isPrimary, 0);
  assert.equal((await accountByRsn('my main')).isPrimary, 1);
});

// ── Somebody else's ───────────────────────────────────────────────────────────────────────────

test('a character somebody else has claimed cannot be taken', async () => {
  const r = await C.claimAccountForPerson({
    playerId: themPlayer,
    rsn: 'My Main',
    rsnNormalized: 'my main',
    method: 'stat_delta',
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.code, 'owned_by_other');
  assert.equal((await accountByRsn('my main')).playerId, mePlayer, 'and it did not move');
});

test('the pre-check sees a claimed character with NO seat', async () => {
  // The whole point. The old check went through clan_roster, which cannot see an account that holds
  // no seat — and this flow creates those deliberately. 'My Main' has never been on any roster.
  const blocked = await C.claimBlockedBy('my main', themPlayer);
  assert.ok(blocked, 'somebody owns it');
  assert.equal(blocked!.rsn, 'My Main');

  // And it does not block the owner from re-proving their own character.
  assert.equal(await C.claimBlockedBy('my main', mePlayer), null);
});

test('an unclaimed character is free, and an unknown one is not "taken"', async () => {
  const { db, schema: s } = await loadDb();
  // A roster-synced RSN nobody has claimed: it HAS a person — every account does, so that claiming
  // later merges two people instead of inventing one — and that person is not evidence of a claim.
  const [ghostPerson] = await db.insert(s.players).values({ displayName: 'Roster Ghost' }).returning();
  await db
    .insert(s.accounts)
    .values({ playerId: ghostPerson.id, rsn: 'Roster Ghost', rsnNormalized: 'roster ghost' });

  assert.equal(await C.claimBlockedBy('roster ghost', mePlayer), null, 'a person is not a claim');
  assert.equal(await C.claimBlockedBy('never heard of them', mePlayer), null);
});

test('claiming an unclaimed roster ghost moves it to the claimer', async () => {
  const before = await accountByRsn('roster ghost');
  const r = await C.claimAccountForPerson({
    playerId: mePlayer,
    rsn: 'Roster Ghost',
    rsnNormalized: 'roster ghost',
    method: 'stat_delta',
    actorUserId: meUser,
  });
  assert.equal(r.ok, true);

  const after = await accountByRsn('roster ghost');
  assert.equal(after.id, before.id, 'the same account row — not a duplicate');
  assert.equal(after.playerId, mePlayer);
});

test('re-proving a character you already own is allowed and says so', async () => {
  const r = await C.claimAccountForPerson({
    playerId: mePlayer,
    rsn: 'My Main',
    rsnNormalized: 'my main',
    method: 'plugin',
    actorUserId: meUser,
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.alreadyOurs, true);

  const acct = await accountByRsn('my main');
  assert.equal(acct.verificationMethod, 'plugin', 'upgraded to the stronger proof');
  assert.equal(acct.provisional, 0, 'the account hash does say which human');
});

test('claiming keeps the original claimedAt rather than resetting it', async () => {
  const acct = await accountByRsn('my main');
  const first = acct.claimedAt;
  await C.claimAccountForPerson({
    playerId: mePlayer,
    rsn: 'My Main',
    rsnNormalized: 'my main',
    method: 'plugin',
  });
  assert.equal((await accountByRsn('my main')).claimedAt, first, 'when they got it, not when last seen');
});

// ── The account hash outranks the RSN ─────────────────────────────────────────────────────────

test('a renamed character is recognised by its hash, not re-created under the new name', async () => {
  const { db, schema: s } = await loadDb();
  await db
    .update(s.accounts)
    .set({ accountHash: 'hash-abc' })
    .where(eq(s.accounts.rsnNormalized, 'my iron'));

  const r = await C.claimAccountForPerson({
    playerId: mePlayer,
    rsn: 'Renamed Iron',
    rsnNormalized: 'renamed iron',
    method: 'plugin',
    accountHash: 'hash-abc',
  });
  assert.equal(r.ok, true);

  const rows = await db
    .select()
    .from(s.accounts)
    .where(and(eq(s.accounts.playerId, mePlayer), eq(s.accounts.accountHash, 'hash-abc')));
  assert.equal(rows.length, 1, 'one account, not two');
  assert.equal(rows[0].rsnNormalized, 'my iron', 'still keyed by the row it found');
});
