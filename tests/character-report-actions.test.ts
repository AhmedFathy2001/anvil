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
let clanT: number; // a throwaway clan: anyone can make one, never verified
let ownerUser: number; // clan A's owner (a login)
let ownerPerson: number;
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

  // Clan A has proven its in-game name; B and the throwaway T have not.
  clanA = (
    await db
      .insert(s.clans)
      .values({ slug: 'a', name: 'A', status: 'active', inGameName: 'Clan A', ingameNameVerifiedAt: new Date().toISOString() })
      .returning()
  )[0].id;
  clanB = (await db.insert(s.clans).values({ slug: 'b', name: 'B', status: 'active' }).returning())[0].id;
  clanT = (await db.insert(s.clans).values({ slug: 't', name: 'T', status: 'active' }).returning())[0].id;
  // Push the person/login id spaces apart.
  await db.insert(s.players).values([{ displayName: 'd1' }, { displayName: 'd2' }, { displayName: 'd3' }]);
  ownerPerson = (await db.insert(s.players).values({ displayName: 'Owner' }).returning())[0].id;
  ownerUser = (await db.insert(s.users).values({ displayName: 'Owner', playerId: ownerPerson }).returning())[0].id;
  adminUser = (await db.insert(s.users).values({ displayName: 'Admin' }).returning())[0].id;
  modUser = (await db.insert(s.users).values({ displayName: 'Mod' }).returning())[0].id;
  staffUser = (await db.insert(s.users).values({ displayName: 'Op' }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** An unclaimed member of clan A (optionally also seated in clan B) with a pending claim request. */
async function claimSetup(opts: { alsoInB?: boolean; clan?: number } = {}) {
  n++;
  const rsn = `Claimed ${n}`;
  const [ghost] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
  await db.insert(s.clanMemberships).values({ clanId: opts.clan ?? clanA, accountId: acct.id, kind: 'member', source: 'roster' });
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

test('B: an unverified clan’s admin cannot link directly, even a single-clan character — it goes to Anvil', async () => {
  const x = await claimSetup({ clan: clanT });
  assert.equal(await C.characterOnlyInClan(x.accountId, clanT), true);
  const res = await C.vouchForClaim(clanT, x.requestId, { userId: adminUser, role: 'admin' });
  assert.equal(res.ok && res.outcome, 'sent');
  assert.match(res.ok && res.outcome === 'sent' ? res.why ?? '' : '', /hasn't been verified yet \(sync your member list from the plugin\)/);
  assert.equal((await account(x.accountId)).claimedAt, null, 'not linked');
  assert.equal((await report(res.ok && res.outcome === 'sent' ? res.reportId : 0)).status, 'open');
});

test('B: a clan verified by Anvil staff (no sync) counts as verified — its admin links directly', async () => {
  const { verifyManually } = await import('../src/lib/clanVerification.ts');
  const [clanM] = await db.insert(s.clans).values({ slug: 'm', name: 'M', status: 'active' }).returning();
  assert.deepEqual(await verifyManually(clanM.id, 'Clan M', staffUser), { ok: true });
  const x = await claimSetup({ clan: clanM.id });
  const res = await C.vouchForClaim(clanM.id, x.requestId, { userId: adminUser, role: 'admin' });
  assert.equal(res.ok && res.outcome, 'linked');
  assert.equal((await account(x.accountId)).playerId, x.person);
});

test('B: a moderator’s vouch still goes to Anvil, even for a single-clan character', async () => {
  const x = await claimSetup();
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: modUser, role: 'moderator' });
  assert.equal(res.ok && res.outcome, 'sent');
  assert.equal((await account(x.accountId)).claimedAt, null);
});

// ── C + D: claim vouch ──────────────────────────────────────────────────────────────────────

test('C: the owner’s vouch for a character also in another clan is NOT applied — Anvil decides', async () => {
  const x = await claimSetup({ alsoInB: true });
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: ownerUser, role: 'owner' });
  assert.equal(res.ok && res.outcome, 'sent');
  assert.match(res.ok && res.outcome === 'sent' ? res.why ?? '' : '', /another clan/);
  assert.equal((await account(x.accountId)).claimedAt, null, 'not linked');
});

/** A person with a character seated in clan A (so they are on the roster). */
async function rosterPerson() {
  n++;
  const [p] = await db.insert(s.players).values({ displayName: `Rightful ${n}` }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: `Alt ${n}`, rsnNormalized: `alt ${n}`, claimedAt: new Date().toISOString() }).returning();
  await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: a.id, kind: 'member' });
  return p.id;
}

test('C/D: the owner gives a single-clan character to a rostered person at once; revert gives it back, once', async () => {
  const h = await heldSetup();
  const rightful = await rosterPerson();
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'claim_request', claimantPlayerId: rightful, body: 'it is theirs' },
    { apply: true },
  );
  assert.equal(out.applied, true, out.why ?? '');
  assert.equal((await report(out.id)).status, 'applied');
  assert.equal((await account(h.accountId)).playerId, rightful);
  assert.ok((await R.listCharacterReports()).some((r) => r.id === out.id), 'still in the staff queue');

  const undo = await A.revertCharacterReport(out.id, staffUser, 'not them after all');
  assert.deepEqual(undo, { ok: true, already: false });
  const back = await account(h.accountId);
  assert.equal(back.playerId, h.holder, 'back with the holder');
  assert.equal(back.claimedAt, h.before.claimedAt);
  assert.equal(back.accountHash, h.before.accountHash);
  const r = await report(out.id);
  assert.equal(r.status, 'reverted');
  assert.equal(r.resolvedByUserId, staffUser, 'who reverted');
  assert.equal(r.resolution, 'not them after all');

  assert.deepEqual(await A.revertCharacterReport(out.id, staffUser), { ok: true, already: true }, 'idempotent');

  // The clan sees it, with the note; another clan does not.
  const seen = (await R.clanReports(clanA)).find((v) => v.id === out.id);
  assert.equal(seen?.status, 'reverted');
  assert.equal(seen?.note, 'not them after all');
  assert.equal((await R.clanReports(clanB)).length, 0);
});

// ── C: refusals — the owner's word is only enough where the clan alone has a stake ─────────────

test('C refuses: a throwaway (unverified) clan’s owner cannot take a character', async () => {
  const h = await heldSetup();
  await db.update(s.clanMemberships).set({ clanId: clanT }).where(eq(s.clanMemberships.id, h.seatId));
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanT, reportedByUserId: ownerUser, kind: 'wrong_owner', body: 'mine now' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.match(out.why ?? '', /hasn't been verified yet/);
  assert.equal((await report(out.id)).status, 'open');
  assert.equal((await account(h.accountId)).playerId, h.holder, 'untouched');
});

test('C refuses: a character also seated (even departed) in another clan', async () => {
  const h = await heldSetup();
  await db.insert(s.clanMemberships).values({ clanId: clanB, accountId: h.accountId, kind: 'guest', leftAt: new Date().toISOString() });
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'wrong_owner', body: 'x' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.match(out.why ?? '', /another clan's roster/);
  assert.ok((await account(h.accountId)).claimedAt, 'untouched');
});

test('C refuses: a holder who plays in another clan (on a different character)', async () => {
  const h = await heldSetup();
  const [alt] = await db.insert(s.accounts).values({ playerId: h.holder, rsn: `HAlt ${n}`, rsnNormalized: `halt ${n}` }).returning();
  await db.insert(s.clanMemberships).values({ clanId: clanB, accountId: alt.id, kind: 'member' });
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'wrong_owner', body: 'x' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.match(out.why ?? '', /also plays in another clan/);
});

test('C refuses: the owner giving a character to themselves', async () => {
  const h = await heldSetup();
  const [own] = await db.insert(s.accounts).values({ playerId: ownerPerson, rsn: 'Owner Main', rsnNormalized: 'owner main' }).returning();
  await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: own.id, kind: 'member' });
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'claim_request', claimantPlayerId: ownerPerson, body: 'mine' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.match(out.why ?? '', /yourself/);
  assert.equal((await account(h.accountId)).playerId, h.holder);
});

test('C refuses: giving it to someone not on this clan’s roster', async () => {
  const h = await heldSetup();
  const [stranger] = await db.insert(s.players).values({ displayName: 'Stranger' }).returning();
  const out = await A.raiseCharacterReport(
    { accountId: h.accountId, clanId: clanA, reportedByUserId: ownerUser, kind: 'claim_request', claimantPlayerId: stranger.id, body: 'theirs' },
    { apply: true },
  );
  assert.equal(out.applied, false);
  assert.match(out.why ?? '', /isn't on your roster/);
});

test('B: an admin cannot link a claim request that is their own', async () => {
  const x = await claimSetup();
  const res = await C.vouchForClaim(clanA, x.requestId, { userId: x.login, role: 'owner' });
  assert.equal(res.ok && res.outcome, 'sent');
  assert.equal((await account(x.accountId)).claimedAt, null);
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
