// Clan-side character decisions without waiting on Anvil (lib/claimRequests vouchForClaim,
// lib/characterReportActions):
//   B. a claim on a character only ever in THIS clan is linked directly by the clan's admin;
//   C. a clan OWNER's report is carried out at once and filed as 'applied', with what is needed to
//      undo it — unless it cannot be undone cleanly (a rename onto a taken name), then it waits;
//   D. staff revert puts the character back exactly, once, and records who did it; the clan sees it.
//
// Run: npx tsx --test tests/character-report-actions.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('charreportactions');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/claimRequests.ts');
let A: typeof import('../src/lib/characterReportActions.ts');
let R: typeof import('../src/lib/characterReports.ts');

let clanA: number;
let clanB: number;
let ownerUser: number; // clan A's owner (a login)
let adminUser: number;
let modUser: number;
let staffUser: number;
let n = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/claimRequests.ts');
  A = await import('../src/lib/characterReportActions.ts');
  R = await import('../src/lib/characterReports.ts');

  clanA = (await db.insert(s.clans).values({ slug: 'a', name: 'A', status: 'active' }).returning())[0].id;
  clanB = (await db.insert(s.clans).values({ slug: 'b', name: 'B', status: 'active' }).returning())[0].id;
  // Push the person/login id spaces apart.
  await db.insert(s.players).values([{ displayName: 'd1' }, { displayName: 'd2' }, { displayName: 'd3' }]);
  ownerUser = (await db.insert(s.users).values({ displayName: 'Owner' }).returning())[0].id;
  adminUser = (await db.insert(s.users).values({ displayName: 'Admin' }).returning())[0].id;
  modUser = (await db.insert(s.users).values({ displayName: 'Mod' }).returning())[0].id;
  staffUser = (await db.insert(s.users).values({ displayName: 'Op' }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** An unclaimed member of clan A (optionally also seated in clan B) with a pending claim request. */
async function claimSetup(opts: { alsoInB?: boolean } = {}) {
  n++;
  const rsn = `Claimed ${n}`;
  const [ghost] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
  await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: acct.id, kind: 'member', source: 'roster' });
  if (opts.alsoInB) await db.insert(s.clanMemberships).values({ clanId: clanB, accountId: acct.id, kind: 'guest', source: 'roster' });
  const [person] = await db.insert(s.players).values({ displayName: `Requester ${n}` }).returning();
  const [login] = await db.insert(s.users).values({ playerId: person.id, displayName: `Requester ${n}`, discordId: `req-${n}` }).returning();
  const now = new Date().toISOString();
  const [det] = await db
    .insert(s.detectedAccounts)
    .values({ userId: login.id, rsn, rsnNormalized: rsn.toLowerCase(), status: 'pending', detectedAt: now, lastSeenAt: now })
    .returning();
  return { accountId: acct.id, ghost: ghost.id, person: person.id, login: login.id, requestId: det.id };
}

/** A claimed character in clan A held by a person with a login. */
async function heldSetup() {
  n++;
  const rsn = `Held ${n}`;
  const [holder] = await db.insert(s.players).values({ displayName: `Holder ${n}` }).returning();
  const [login] = await db.insert(s.users).values({ playerId: holder.id, displayName: `Holder ${n}` }).returning();
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({
      playerId: holder.id,
      rsn,
      rsnNormalized: rsn.toLowerCase(),
      claimedAt: now,
      verifiedAt: now,
      verificationMethod: 'plugin_first_use',
      provisional: 1,
      isPrimary: 1,
      accountHash: `hash-${n}`,
    })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: acct.id, kind: 'member' }).returning();
  return { accountId: acct.id, holder: holder.id, login: login.id, seatId: seat.id, rsn, before: acct };
}

const account = async (id: number) => (await db.select().from(s.accounts).where(eq(s.accounts.id, id)))[0];
const report = async (id: number) => (await db.select().from(s.characterReports).where(eq(s.characterReports.id, id)))[0];

// ── B ─────────────────────────────────────────────────────────────────────────────────────────

test('B: an admin links a character only ever on this clan, logged in the clan history', async () => {
  const x = await claimSetup();
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: adminUser, role: 'admin' });
  assert.equal(res.ok && res.outcome, 'linked');
  const acct = await account(x.accountId);
  assert.equal(acct.playerId, x.person, 'the requester’s person');
  assert.ok(acct.claimedAt);
  assert.equal(acct.verifiedByUserId, adminUser);
  const log = await db
    .select()
    .from(s.clanAuditLog)
    .where(and(eq(s.clanAuditLog.clanId, clanA), eq(s.clanAuditLog.eventType, 'claim_request_approved')));
  assert.equal(log.length, 1);
  assert.equal((await db.select().from(s.characterReports).where(eq(s.characterReports.accountId, x.accountId))).length, 0, 'nothing for Anvil');
});

test('B: a character also seated in another clan is not the clan’s alone — an admin’s vouch goes to Anvil', async () => {
  const x = await claimSetup({ alsoInB: true });
  assert.equal(await C.characterOnlyInClan(x.accountId, clanA), false);
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: adminUser, role: 'admin' });
  assert.equal(res.ok && res.outcome, 'sent');
  assert.match(res.ok && res.outcome === 'sent' ? res.why ?? '' : '', /another clan/);
  assert.equal((await account(x.accountId)).claimedAt, null, 'not linked');
  const r = await report(res.ok && res.outcome === 'sent' ? res.reportId : 0);
  assert.equal(r.status, 'open');
});

test('B: a moderator’s vouch still goes to Anvil, even for a single-clan character', async () => {
  const x = await claimSetup();
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: modUser, role: 'moderator' });
  assert.equal(res.ok && res.outcome, 'sent');
  assert.equal((await account(x.accountId)).claimedAt, null);
});

// ── C + D: claim vouch ──────────────────────────────────────────────────────────────────────

test('C/D: the owner’s cross-clan vouch is linked at once; staff revert puts it back, once', async () => {
  const x = await claimSetup({ alsoInB: true });
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: ownerUser, role: 'owner' });
  assert.equal(res.ok && res.outcome, 'applied');
  const reportId = res.ok && res.outcome === 'applied' ? res.reportId : 0;
  assert.equal((await report(reportId)).status, 'applied');
  assert.equal((await account(x.accountId)).playerId, x.person);
  assert.ok((await R.listCharacterReports()).some((r) => r.id === reportId), 'still in the staff queue');

  const undo = await A.revertCharacterReport(reportId, staffUser, 'not them after all');
  assert.deepEqual(undo, { ok: true, already: false });
  const acct = await account(x.accountId);
  assert.equal(acct.claimedAt, null, 'unclaimed again');
  assert.notEqual(acct.playerId, x.person);
  assert.equal(acct.verificationMethod, null);
  const r = await report(reportId);
  assert.equal(r.status, 'reverted');
  assert.equal(r.resolvedByUserId, staffUser, 'who reverted');
  assert.equal(r.resolution, 'not them after all');
  const dismissed = await db.query.detectedAccounts.findFirst({ where: eq(s.detectedAccounts.userId, x.login) });
  assert.equal(dismissed?.status, 'dismissed', 'their plugin does not just take it again');

  assert.deepEqual(await A.revertCharacterReport(reportId, staffUser), { ok: true, already: true }, 'idempotent');

  // The clan sees it, with the note.
  const seen = (await R.clanReports(clanA)).find((v) => v.id === reportId);
  assert.equal(seen?.status, 'reverted');
  assert.equal(seen?.note, 'not them after all');
  assert.equal((await R.clanReports(clanB)).length, 0, 'another clan does not see it');
});

// ── C + D: wrong owner ──────────────────────────────────────────────────────────────────────

test('C/D: the owner’s wrong-owner report detaches now; revert restores the holder exactly', async () => {
  const h = await heldSetup();
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'wrong_owner', body: 'not theirs' },
    { apply: true },
  );
  assert.equal(out.applied, true);
  const mid = await account(h.accountId);
  assert.equal(mid.claimedAt, null);
  assert.notEqual(mid.playerId, h.holder);
  const placeholder = mid.playerId;

  // Approving is a separate path; here staff revert.
  assert.deepEqual(await A.revertCharacterReport(out.id, staffUser, null), { ok: true, already: false });
  const back = await account(h.accountId);
  for (const k of ['playerId', 'claimedAt', 'verifiedAt', 'verificationMethod', 'provisional', 'isPrimary', 'accountHash'] as const) {
    assert.equal(back[k], h.before[k], `${k} restored`);
  }
  const det = await db.query.detectedAccounts.findFirst({ where: eq(s.detectedAccounts.userId, h.login) });
  assert.equal(det, undefined, 'the dismissed suggestion detach wrote is gone again');
  assert.equal(
    (await db.select().from(s.players).where(eq(s.players.id, placeholder))).length,
    0,
    'the placeholder person was folded away',
  );
  assert.equal((await report(out.id)).resolution, 'Reverted by Anvil staff');
});

test('D: revert refuses when the character changed hands since, and the report stays applied', async () => {
  const h = await heldSetup();
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'wrong_owner', body: 'not theirs' },
    { apply: true },
  );
  assert.equal(out.applied, true);
  const [someone] = await db.insert(s.players).values({ displayName: 'Someone' }).returning();
  await R.reassignCharacter(h.accountId, someone.id, staffUser, 'proved by XP');

  const res = await A.revertCharacterReport(out.id, staffUser, null);
  assert.equal(res.ok, false);
  assert.equal((await account(h.accountId)).playerId, someone.id, 'left alone');
  assert.equal((await report(out.id)).status, 'applied', 'still waiting for a decision');

  // Approve closes it.
  assert.equal(await R.resolveCharacterReport(out.id, staffUser, 'resolved', 'Approved'), true);
  assert.equal((await report(out.id)).status, 'resolved');
  assert.equal(await R.resolveCharacterReport(out.id, staffUser, 'resolved'), false, 'once');
});

test('C: a non-owner’s report waits, as before', async () => {
  const h = await heldSetup();
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: adminUser, kind: 'wrong_owner', body: 'hm' },
    { apply: false },
  );
  assert.equal(out.applied, false);
  assert.equal((await report(out.id)).status, 'open');
  assert.ok((await account(h.accountId)).claimedAt, 'untouched');
});

// ── C + D: rename ───────────────────────────────────────────────────────────────────────────

test('C/D: the owner’s rename to a free name is applied; revert puts the old name back', async () => {
  const h = await heldSetup();
  await db.update(s.accounts).set({ previousRsns: JSON.stringify(['Older']) }).where(eq(s.accounts.id, h.accountId));
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'rename', requestedRsn: `New ${n}`, body: 'renamed' },
    { apply: true },
  );
  assert.equal(out.applied, true);
  assert.equal((await account(h.accountId)).rsn, `New ${n}`);

  assert.deepEqual(await A.revertCharacterReport(out.id, staffUser, null), { ok: true, already: false });
  const back = await account(h.accountId);
  assert.equal(back.rsn, h.rsn);
  assert.equal(back.previousRsns, JSON.stringify(['Older']), 'name history as it was');
});

test('C: a rename onto a name another entry holds is not applied — the clan is told why', async () => {
  const h = await heldSetup();
  const [other] = await db.insert(s.players).values({ displayName: 'x' }).returning();
  await db.insert(s.accounts).values({ playerId: other.id, rsn: 'Taken Name', rsnNormalized: 'taken name' });
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'rename', requestedRsn: 'Taken Name', body: 'renamed' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.match(out.why ?? '', /Another entry already uses the name Taken Name/);
  const r = await report(out.id);
  assert.equal(r.status, 'open');
  assert.match(r.body ?? '', /Not applied right away/);
  assert.equal((await account(h.accountId)).rsn, h.rsn);
});

test('C: a merge always waits for Anvil', async () => {
  const h = await heldSetup();
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'merge', body: 'same as Foo' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.ok(out.why);
});

test('D: only an applied report can be reverted', async () => {
  const h = await heldSetup();
  const filed = await R.fileCharacterReport({ accountId: h.accountId, clanId: clanA, reportedByUserId: adminUser, kind: 'other', body: 'x' });
  const res = await A.revertCharacterReport(filed.id, staffUser, null);
  assert.equal(res.ok, false);
  assert.equal((await report(filed.id)).status, 'open');
});
