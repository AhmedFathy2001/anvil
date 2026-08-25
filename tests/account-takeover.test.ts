// Preventing hostile account takeover.
//
// RuneLite is not an authenticated client. The plugin sends three things and only ONE is a secret:
//   Authorization: Bearer <token>  — the PERSON's secret. Proves who is holding the plugin.
//   X-RSN: <name>                  — PUBLIC. Everyone knows everyone's name.
//   X-Account-Hash: <hash>         — client.getAccountHash(), read from a client we do not control.
//
// The attack, demonstrated against a real roster member on preview before this landed: an attacker
// with their OWN valid token sends a VICTIM's public RSN plus a made-up hash, and the server hands
// them the victim's account — its history, its identity, its hiscores. All they typed was a name.
//
// The false premise was that the account hash is "unforgeable". It is not: a modified client puts any
// 64-bit value on the wire. What an attacker CANNOT do is produce a hash that is already anchored to
// a row they do not control. So the rule is: an anchored-hash match is proof; a public RSN is not;
// and — the subtle one — a hash that matches NOTHING is not proof and its mere presence must never
// waive the check. The careful path had exactly that waiver (`!byHash && !accountHash`), so sending a
// random hash DISABLED the guard meant to stop the takeover.
//
// Run: npx tsx --test tests/account-takeover.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('account-takeover');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/auth.ts');

let clanId: number;
/** The victim's login+person, and the attacker's — with the id spaces deliberately pushed apart. */
let victimUser: number;
let attackerUser: number;
/** The victim's established, UNCLAIMED roster-member account and its RSN. */
let victimAccountId: number;
const VICTIM_RSN = 'Hells Taco';

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/auth.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'clan', name: 'Clan', status: 'active' }).returning();
  clanId = clan.id;

  // Decoys so players.id and users.id cannot coincide — without this the id-space half of the bug
  // hides, because a login id written into a person column happens to land on the right person.
  await db.insert(s.players).values([{ displayName: 'd1' }, { displayName: 'd2' }, { displayName: 'd3' }]);

  const [attacker] = await db.insert(s.players).values({ displayName: 'Attacker' }).returning();
  const [au] = await db
    .insert(s.users)
    .values({ playerId: attacker.id, displayName: 'Attacker', discordId: 'atk-1', pluginToken: 'atk-token' })
    .returning();
  attackerUser = au.id;

  // The victim: a real in-game roster member, unclaimed, NO hash on file (roster sync never captures
  // other members' hashes — this is the state all 358 unclaimed members are in).
  const [victimPerson] = await db.insert(s.players).values({ displayName: 'Victim' }).returning();
  const [vu] = await db
    .insert(s.users)
    .values({ playerId: victimPerson.id, displayName: 'Victim', discordId: 'vic-1' })
    .returning();
  victimUser = vu.id;
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: victimPerson.id, rsn: VICTIM_RSN, rsnNormalized: 'hells taco' })
    .returning();
  victimAccountId = acct.id;
  await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' });

  assert.notEqual(attackerUser, au.playerId, 'the id spaces must disagree or this suite proves nothing');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function victimAccount() {
  const { db, schema: s } = await loadDb();
  const [row] = await db.select().from(s.accounts).where(eq(s.accounts.id, victimAccountId));
  return row;
}

// ── The gate itself, exhaustively ─────────────────────────────────────────────────────────────

test('an anchored-hash match is the only thing that lets an established row auto-claim', () => {
  const member = { kind: 'member', verifiedAt: null, pendingRole: null };
  const verified = { kind: 'guest', verifiedAt: '2026-01-01', pendingRole: null };
  const roleRow = { kind: 'guest', verifiedAt: null, pendingRole: 'admin' };
  const ghost = { kind: 'guest', verifiedAt: null, pendingRole: null };

  // Matched by an anchored hash → proof, every kind auto-claims.
  for (const row of [member, verified, roleRow, ghost]) {
    assert.equal(A.autoClaimAllowed(row, true), true);
  }

  // NOT matched by hash → only the bare ghost auto-claims. The three established shapes need proof.
  assert.equal(A.autoClaimAllowed(member, false), false, 'a roster member is not claimable by name');
  assert.equal(A.autoClaimAllowed(verified, false), false, 'nor a verified account');
  assert.equal(A.autoClaimAllowed(roleRow, false), false, 'nor a role-carrying row — worst case');
  assert.equal(A.autoClaimAllowed(ghost, false), true, 'a bare ghost has no identity to steal');
});

// ── The waiver bug: a present-but-non-matching hash must not lower the bar ─────────────────────

test('a RANDOM hash does not let an attacker claim a member by their public RSN', async () => {
  // The exact exploit, through the careful path. `byHash` is null because the random hash is
  // anchored to nothing; the old guard read `!byHash && !accountHash`, so a non-null accountHash
  // made `!accountHash` false and skipped it. It must now be refused.
  const result = await A.claimAccountForUser(clanId, attackerUser, VICTIM_RSN, 'hells taco', '9999999999999999');
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'needs-verification');

  const acct = await victimAccount();
  assert.equal(acct.claimedAt, null, 'still unclaimed');
  assert.notEqual(acct.playerId, null);
  const { db, schema: s } = await loadDb();
  const [attackerPerson] = await db
    .select({ playerId: s.users.playerId })
    .from(s.users)
    .where(eq(s.users.id, attackerUser));
  assert.notEqual(acct.playerId, attackerPerson.playerId, 'and NOT the attacker’s');
});

test('a bare RSN with no hash at all is refused too', async () => {
  const result = await A.claimAccountForUser(clanId, attackerUser, VICTIM_RSN, 'hells taco', null);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'needs-verification');
});

// ── The legit owner still gets in ─────────────────────────────────────────────────────────────

test('the real owner, once their hash is anchored, one-clicks — and that is the ONLY way a hash helps', async () => {
  const { db, schema: s } = await loadDb();
  // The member played and their real hash was anchored to the row by a proven interaction.
  await db.update(s.accounts).set({ accountHash: 'real-victim-hash' }).where(eq(s.accounts.id, victimAccountId));

  // The attacker STILL cannot take it — they do not have that hash.
  const attackerTry = await A.claimAccountForUser(clanId, attackerUser, VICTIM_RSN, 'hells taco', 'real-victim-hash-GUESS');
  assert.equal(attackerTry.ok, false, 'a guessed hash is still a non-match');

  // The owner, whose client reports the anchored hash, claims in one click.
  const ownerTry = await A.claimAccountForUser(clanId, victimUser, VICTIM_RSN, 'hells taco', 'real-victim-hash');
  assert.equal(ownerTry.ok, true);

  const acct = await victimAccount();
  const [victimPerson] = await db
    .select({ playerId: s.users.playerId })
    .from(s.users)
    .where(eq(s.users.id, victimUser));
  assert.equal(acct.playerId, victimPerson.playerId, 'the victim’s own person, not their login id');
  assert.ok(acct.claimedAt);
});
