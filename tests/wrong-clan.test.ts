// "Wrong clan? Tell Anvil" (lib/wrongClan): the character's owner files a 'wrong_clan' report naming
// the clan they're really in; staff move the membership there — never to an unverified clan.
//
// Run: npx tsx --test tests/wrong-clan.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('wrongclan');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let W: typeof import('../src/lib/wrongClan.ts');

let wrong: number; // where the character is a member now
let right: number; // verified, has them as a guest
let unverified: number; // has them as a guest, never verified
let person: number;
let login: number;
let staff: number;
let n = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  W = await import('../src/lib/wrongClan.ts');
  const now = new Date().toISOString();
  wrong = (await db.insert(s.clans).values({ slug: 'wrong', name: 'Wrong Clan' }).returning())[0].id;
  right = (await db.insert(s.clans).values({ slug: 'right', name: 'Right Clan', inGameName: 'Right', ingameNameVerifiedAt: now }).returning())[0].id;
  unverified = (await db.insert(s.clans).values({ slug: 'unv', name: 'Unverified Clan' }).returning())[0].id;
  person = (await db.insert(s.players).values({ displayName: 'Player' }).returning())[0].id;
  login = (await db.insert(s.users).values({ displayName: 'Player', playerId: person }).returning())[0].id;
  staff = (await db.insert(s.users).values({ displayName: 'Op' }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** A character of `person`: member of Wrong, guest in Right and Unverified. */
async function setup() {
  n++;
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: `Main ${n}`, rsnNormalized: `main ${n}`, claimedAt: new Date().toISOString() })
    .returning();
  const seat = async (clanId: number, kind: string) =>
    (await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind, source: 'roster' }).returning())[0].id;
  return { accountId: a.id, wrongSeat: await seat(wrong, 'member'), rightSeat: await seat(right, 'guest'), unvSeat: await seat(unverified, 'guest') };
}

const seatKind = async (id: number) => (await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, id) }))?.kind;
const report = async (id: number) => (await db.select().from(s.characterReports).where(eq(s.characterReports.id, id)))[0];

test('only the character’s owner can file, and only naming a clan that has it on its list', async () => {
  const x = await setup();
  const stranger = (await db.insert(s.players).values({ displayName: 'Stranger' }).returning())[0].id;
  const no = await W.fileWrongClanReport({ accountId: x.accountId, playerId: stranger, userId: login, claimedClanId: right });
  assert.equal(no.ok, false);
  assert.equal(!no.ok && no.status, 403);

  const other = (await db.insert(s.clans).values({ slug: `o${n}`, name: 'Other' }).returning())[0].id;
  const notListed = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: other });
  assert.equal(!notListed.ok && notListed.status, 400);
  const already = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: wrong });
  assert.equal(!already.ok && already.status, 400, 'already a member there');
  const noNote = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: null });
  assert.equal(!noNote.ok && noNote.status, 400, 'an unlisted clan needs a note');
  assert.equal((await db.select().from(s.characterReports).where(eq(s.characterReports.accountId, x.accountId))).length, 0);
});

test('filing names both clans; a second press adds to the same report and follows the newest answer', async () => {
  const x = await setup();
  const first = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: unverified, note: 'hmm' });
  assert.ok(first.ok);
  const r1 = await report(first.ok ? first.reportId : 0);
  assert.equal(r1.kind, 'wrong_clan');
  assert.equal(r1.clanId, unverified);
  assert.equal(r1.claimantPlayerId, person);
  assert.equal(r1.reportedByUserId, login);
  assert.match(r1.body ?? '', /Member of now: Wrong Clan/);
  assert.match(r1.body ?? '', /Really in: Unverified Clan/);

  const second = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: right, note: 'actually Right' });
  assert.ok(second.ok && second.alreadyOpen);
  assert.equal(second.ok && second.reportId, first.ok && first.reportId, 'one thread');
  const r2 = await report(r1.id);
  assert.equal(r2.clanId, right, 'points at the clan named last');
  assert.match(r2.body ?? '', /actually Right/);
  assert.match(r2.body ?? '', /hmm/);
});

test('staff move: the named clan becomes the member clan, the old one a guest, audited on both, report closed', async () => {
  const x = await setup();
  const f = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: right });
  assert.ok(f.ok);
  const id = f.ok ? f.reportId : 0;
  const view = await W.wrongClanMoveView(x.accountId, right);
  assert.deepEqual(
    { seat: view?.targetSeat, verified: view?.targetVerified, from: view?.currentMemberClan },
    { seat: true, verified: true, from: 'Wrong Clan' },
  );

  assert.deepEqual(await W.applyWrongClanMove(id, staff, 'checked in game'), { ok: true });
  assert.equal(await seatKind(x.rightSeat), 'member');
  assert.equal(await seatKind(x.wrongSeat), 'guest');
  const r = await report(id);
  assert.equal(r.status, 'resolved');
  assert.equal(r.resolvedByUserId, staff);
  assert.equal(r.resolution, 'checked in game');

  const audit = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.actorUserId, staff));
  const into = audit.find((a) => a.clanId === right && a.eventType === 'member_chose_this_clan' && a.clanMemberId === x.rightSeat);
  const out = audit.find((a) => a.clanId === wrong && a.eventType === 'member_left_for_another_clan' && a.clanMemberId === x.wrongSeat);
  assert.equal(JSON.parse(into?.newValue ?? '{}').via, 'staff');
  assert.equal(JSON.parse(out?.newValue ?? '{}').via, 'staff');

  assert.deepEqual(await W.applyWrongClanMove(id, staff), { ok: false, error: 'That report is not open.' }, 'not twice');
});

test('staff move refuses an unverified clan, and a clan whose seat is gone — nothing changes', async () => {
  const x = await setup();
  const f = await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: unverified });
  const id = f.ok ? f.reportId : 0;
  const res = await W.applyWrongClanMove(id, staff);
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : '', /isn’t verified/);
  assert.equal(await seatKind(x.wrongSeat), 'member');
  assert.equal(await seatKind(x.unvSeat), 'guest');
  assert.equal((await report(id)).status, 'open');

  // Re-pointed at the verified clan, but its seat has since gone.
  await W.fileWrongClanReport({ accountId: x.accountId, playerId: person, userId: login, claimedClanId: right });
  await db.update(s.clanMemberships).set({ leftAt: new Date().toISOString() }).where(eq(s.clanMemberships.id, x.rightSeat));
  const gone = await W.applyWrongClanMove(id, staff);
  assert.match(!gone.ok ? gone.error : '', /no longer has this character/);
  assert.equal(await seatKind(x.wrongSeat), 'member');
  assert.equal((await report(id)).status, 'open');
  const moved = await db
    .select()
    .from(s.clanAuditLog)
    .where(and(eq(s.clanAuditLog.clanId, wrong), eq(s.clanAuditLog.clanMemberId, x.wrongSeat)));
  assert.equal(moved.length, 0, 'no audit for a refused move');
});
