// Renames the in-game roster splits into "X left, Y joined" (lib/characterRename, lib/renameDetection).
//
// The roster carries names only, so a sync after a rename seats the new name as a stranger while the
// real character — event entry, baseline, owner — keeps the dead name. Every path that later learns
// the truth must FOLD the stranger into the real character rather than give up because the new name
// is taken.
//
// Run: npx tsx --test tests/character-rename.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('charrename');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/characterRename.ts');

let clanId: number;
let eventId: number;
let person: number;
let n = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/characterRename.ts');
  clanId = (await db.insert(s.clans).values({ slug: 'renamers', name: 'Renamers' }).returning())[0].id;
  eventId = (await db.insert(s.events).values({ clanId, name: 'Bingo', boardSize: 25 }).returning())[0].id;
  person = (await db.insert(s.players).values({ displayName: 'Owner' }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** The split a sync leaves: the real character (claimed, in the event, seat now a guest) and the stranger. */
async function split(
  oldRsn: string,
  newRsn: string,
  opts: { hash?: string | null; strangerClaimedBy?: number | null; strangerHash?: string | null; unclaimed?: boolean } = {},
) {
  n++;
  const now = new Date().toISOString();
  const owner = opts.unclaimed ? (await db.insert(s.players).values({ displayName: oldRsn }).returning())[0].id : person;
  const [real] = await db
    .insert(s.accounts)
    .values({
      playerId: owner,
      rsn: oldRsn,
      rsnNormalized: oldRsn.toLowerCase(),
      claimedAt: opts.unclaimed ? null : now,
      verifiedAt: opts.unclaimed ? null : now,
      accountHash: opts.hash === undefined ? `h${n}` : opts.hash,
      status: 'unranked',
    })
    .returning();
  const [realSeat] = await db.insert(s.clanMemberships).values({ clanId, accountId: real.id, kind: 'guest', source: 'roster', rank: 'Sergeant' }).returning();
  const [participant] = await db.insert(s.eventParticipants).values({ eventId, clanMemberId: realSeat.id, accountId: real.id, name: oldRsn }).returning();
  const strangerPerson = opts.strangerClaimedBy ?? (await db.insert(s.players).values({ displayName: newRsn }).returning())[0].id;
  const [stranger] = await db
    .insert(s.accounts)
    .values({
      playerId: strangerPerson,
      rsn: newRsn,
      rsnNormalized: newRsn.toLowerCase(),
      claimedAt: opts.strangerClaimedBy ? now : null,
      accountHash: opts.strangerHash ?? null,
    })
    .returning();
  const [strangerSeat] = await db.insert(s.clanMemberships).values({ clanId, accountId: stranger.id, kind: 'member', source: 'roster', rank: 'Sergeant' }).returning();
  return { real, realSeat, participant, stranger, strangerSeat };
}

test('a rename folds the stranger the sync made into the real character', async () => {
  const x = await split('Bob', 'Bobby');
  const res = await R.renameCharacter(x.real.id, 'Bobby', { actorUserId: null, via: 'staff', absorb: 'staff' });
  assert.equal(res.ok, true);

  const acct = await db.query.accounts.findFirst({ where: eq(s.accounts.id, x.real.id) });
  assert.equal(acct?.rsn, 'Bobby');
  assert.equal(acct?.status, 'active', 'the old name’s 404 was the rename — poll again');
  assert.deepEqual(JSON.parse(acct!.previousRsns!), ['Bob']);
  assert.equal(await db.query.accounts.findFirst({ where: eq(s.accounts.id, x.stranger.id) }), undefined, 'the stranger is gone');

  const seats = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, x.real.id));
  assert.equal(seats.length, 1, 'one seat in the clan');
  assert.equal(seats[0].kind, 'member', 'the roster’s membership came across with the name');

  const p = await db.query.eventParticipants.findFirst({ where: eq(s.eventParticipants.id, x.participant.id) });
  assert.equal(p?.name, 'Bobby', 'the event shows — and co-op matches — the new name');
  assert.equal(p?.accountId, x.real.id, 'same character, same baseline');
});

test('a stranger that is somebody else’s character is a dispute, not a rename', async () => {
  const other = (await db.insert(s.players).values({ displayName: 'Other' }).returning())[0].id;
  const x = await split('Carl', 'Carla', { strangerClaimedBy: other });
  const res = await R.renameCharacter(x.real.id, 'Carla', { actorUserId: null, via: 'roster', absorb: 'staff' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.reason, 'owned_by_other');
  assert.equal((await db.query.accounts.findFirst({ where: eq(s.accounts.id, x.real.id) }))?.rsn, 'Carl', 'nothing moved');
});

test('two different account hashes are two different accounts', async () => {
  const x = await split('Dan', 'Dana', { hash: 'hd1', strangerHash: 'hd2' });
  const res = await R.renameCharacter(x.real.id, 'Dana', { actorUserId: null, via: 'staff', absorb: 'staff' });
  assert.equal(res.ok === false && res.reason, 'different_account');
});

test('a hashless character whose old name is gone is the one the plugin is playing', async () => {
  const p2 = (await db.insert(s.players).values({ displayName: 'XpLinked' }).returning())[0].id;
  const now = new Date().toISOString();
  const [main] = await db.insert(s.accounts).values({ playerId: p2, rsn: 'Ed', rsnNormalized: 'ed', claimedAt: now, status: 'unranked' }).returning();
  await db.insert(s.accounts).values({ playerId: p2, rsn: 'EdAlt', rsnNormalized: 'edalt', claimedAt: now, status: 'active' });
  assert.equal(await R.hashlessRenameCandidate(p2, 'eddie'), main.id);

  // Two of their names gone at once: ambiguous, so no guess.
  await db.update(s.accounts).set({ status: 'unranked' }).where(eq(s.accounts.rsnNormalized, 'edalt'));
  assert.equal(await R.hashlessRenameCandidate(p2, 'eddie'), null);
});

async function logSplit(leftSeat: number, joinedSeat: number, newRsn: string) {
  const at = new Date().toISOString();
  await db.insert(s.clanAuditLog).values([
    { clanId, clanMemberId: leftSeat, eventType: 'left', occurredAt: at },
    { clanId, clanMemberId: joinedSeat, eventType: 'joined', newValue: JSON.stringify({ rsn: newRsn, rank: 'Sergeant' }), occurredAt: at },
  ]);
}

test('absorbing needs the roster split as evidence, unless staff decide', async () => {
  const x = await split('Gus', 'Gussy');
  const res = await R.renameCharacter(x.real.id, 'Gussy', { actorUserId: null, via: 'plugin', absorb: 'split' });
  assert.equal(res.ok === false && res.reason, 'needs_review', 'no split on record: claiming a taken name is not proof');
  await logSplit(x.realSeat.id, x.strangerSeat.id, 'Gussy');
  const again = await R.renameCharacter(x.real.id, 'Gussy', { actorUserId: null, via: 'plugin', absorb: 'split' });
  assert.equal(again.ok, true);
});

test('a holder anchored to another hash is refused even when ours has none yet', async () => {
  const x = await split('Hal', 'Hally', { hash: null, strangerHash: 'someone-else' });
  await logSplit(x.realSeat.id, x.strangerSeat.id, 'Hally');
  const res = await R.renameCharacter(x.real.id, 'Hally', { actorUserId: null, via: 'plugin', absorb: 'split', reportingHash: 'mine' });
  assert.equal(res.ok === false && res.reason, 'different_account');
  const blind = await R.renameCharacter(x.real.id, 'Hally', { actorUserId: null, via: 'plugin', absorb: 'split' });
  assert.equal(blind.ok === false && blind.reason, 'needs_review', 'nothing to compare its hash with');
});

test('the cron heals an unclaimed split and sends a claimed one to Anvil', async () => {
  const D = await import('../src/lib/renameDetection.ts');
  const C = await import('../src/lib/characterReports.ts');

  const u = await split('Ivy', 'Ivie', { unclaimed: true });
  const c = await split('Jo', 'Joey');
  // Distinct XP per pair — identical ones would make each 'left' match both 'joined', and an
  // ambiguous pair is (rightly) never applied without a human.
  for (const [x, xp] of [[u, 50_000_000], [c, 120_000_000]] as const) {
    await db.update(s.accounts).set({ statsOverallXp: xp }).where(eq(s.accounts.id, x.real.id));
    await db.update(s.accounts).set({ statsOverallXp: xp + 10_000 }).where(eq(s.accounts.id, x.stranger.id));
  }
  await logSplit(u.realSeat.id, u.strangerSeat.id, 'Ivie');
  await new Promise((r) => setTimeout(r, 5)); // distinct pairs, both within the window
  await logSplit(c.realSeat.id, c.strangerSeat.id, 'Joey');

  const other = (await db.insert(s.clans).values({ slug: 'elsewhere', name: 'Elsewhere' }).returning())[0].id;
  assert.deepEqual(await D.detectSuspectedRenames(other), [], 'another clan sees nothing of it');

  await D.applyConfidentRenames({ liveFetchCap: 0 });
  assert.equal((await db.query.accounts.findFirst({ where: eq(s.accounts.id, u.real.id) }))?.rsn, 'Ivie', 'the clan’s own roster data heals');
  assert.equal((await db.query.accounts.findFirst({ where: eq(s.accounts.id, c.real.id) }))?.rsn, 'Jo', 'a player’s character is not renamed by a sync');
  const open = await C.listCharacterReports();
  assert.ok(open.some((r) => r.account.id === c.real.id && r.kind === 'rename' && r.requestedRsn === 'Joey'), 'it went to Anvil');
});

test('the cron never folds in a stranger that another clan also rosters', async () => {
  const D = await import('../src/lib/renameDetection.ts');
  const x = await split('Kim', 'Kimmy', { unclaimed: true });
  await db.update(s.accounts).set({ statsOverallXp: 80_000_000 }).where(eq(s.accounts.id, x.real.id));
  await db.update(s.accounts).set({ statsOverallXp: 80_005_000 }).where(eq(s.accounts.id, x.stranger.id));
  const otherClan = (await db.insert(s.clans).values({ slug: 'neighbours', name: 'Neighbours' }).returning())[0].id;
  await db.insert(s.clanMemberships).values({ clanId: otherClan, accountId: x.stranger.id, kind: 'guest', source: 'roster' });
  await logSplit(x.realSeat.id, x.strangerSeat.id, 'Kimmy');

  await D.applyConfidentRenames({ liveFetchCap: 0 });
  assert.equal((await db.query.accounts.findFirst({ where: eq(s.accounts.id, x.real.id) }))?.rsn, 'Kim', 'not this clan’s alone — staff decide');
  assert.ok(await db.query.accounts.findFirst({ where: eq(s.accounts.id, x.stranger.id) }), 'the other clan’s entry is untouched');
});

test('a smaller account on the old name is not this character', async () => {
  const D = await import('../src/lib/renameDetection.ts');
  assert.equal(D.xpVerdict(50_000_000, 1_000_000)?.ok, false, 'XP never goes down');
  assert.equal(D.xpVerdict(50_000_000, 50_100_000)?.ok, true);
});
