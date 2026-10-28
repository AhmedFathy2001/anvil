// The coffer's clan-chat line against a real database (lib/cofferBroadcast): two people make it money,
// one person's two clients don't, a withdrawal is custody and putting it back isn't a donation, and
// once lines arrive the coffer screen stops booking.
//
// Run: npx tsx --test tests/coffer-broadcast-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('coffer-broadcast');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let CB: typeof import('../src/lib/cofferBroadcast.ts');
let CS: typeof import('../src/lib/cofferSync.ts');
let C: typeof import('../src/lib/coffer.ts');

let clanId = 0;
let treasurer = 0;
const seats: { seat: number; rsn: string }[] = [];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  CB = await import('../src/lib/cofferBroadcast.ts');
  CS = await import('../src/lib/cofferSync.ts');
  C = await import('../src/lib/coffer.ts');
  clanId = (await db.insert(s.clans).values({ slug: 'afk', name: 'AFK', inGameName: 'The AFK Spot' }).returning())[0].id;
  treasurer = (await db.insert(s.users).values({ displayName: 'Treasurer', discordId: 'cb-t' }).returning())[0].id;
  // Nisbro, Drenvox, Steeldeck — and Drenvox's alt, the same person.
  const people = ['Nisbro', 'Drenvox', 'Steeldeck'];
  const ids: number[] = [];
  for (const name of people) {
    const [p] = await db.insert(s.players).values({ displayName: name }).returning();
    ids.push(p.id);
  }
  for (const [rsn, who] of [['Nisbro', 0], ['Drenvox', 1], ['Steeldeck', 2], ['Drenvox alt', 1]] as const) {
    const [a] = await db.insert(s.accounts).values({ playerId: ids[who], rsn, rsnNormalized: rsn.toLowerCase(), shared: false }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' }).returning();
    seats.push({ seat: m.id, rsn });
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const report = (who: number, line: string, clanName = 'The AFK Spot') =>
  CB.recordCofferBroadcast({ clanId, clanMemberId: seats[who].seat, rsn: seats[who].rsn, line, clanName });
const confirmed = async () => (await C.getCofferBalance(clanId)).confirmed;

test('one person’s lines alone don’t switch the coffer screen off', async () => {
  await report(0, 'Nisbro has deposited 2,000,000,000 coins into the coffer.');
  await CS.syncPhysicalCoffer({ clanId, eventKey: crypto.randomUUID(), clanMemberId: seats[0].seat, userId: treasurer, rsn: 'Nisbro', pluginVersion: null, kind: 'snapshot', beforeBalance: 7, afterBalance: 7, actorConfirmed: false });
  const r = await CS.syncPhysicalCoffer({ clanId, eventKey: crypto.randomUUID(), clanMemberId: seats[0].seat, userId: treasurer, rsn: 'Nisbro', pluginVersion: null, kind: 'deposit', beforeBalance: 7, afterBalance: 9, actorConfirmed: true });
  const [ev] = await db.select().from(s.clanCofferSyncEvents).where((await import('drizzle-orm')).eq(s.clanCofferSyncEvents.eventKey, (await db.select().from(s.clanCofferSyncState))[0].lastEventKey!));
  assert.equal(r.outcome, 'movement');
  assert.ok(ev.cofferEntryId != null, 'the reading still files an entry');
  await db.delete(s.clanCofferSyncEvents);
  await db.delete(s.clanCofferSyncState);
  await db.delete(s.clanCofferBroadcasts);
  await db.delete(s.cofferEntries);
});

test('a deposit seen by two people is a donation by the person named', async () => {
  const line = 'Nisbro has deposited 46,203,031 coins into the coffer.';
  const first = await report(0, line);
  assert.ok(first.ok && first.outcome === 'new');
  assert.equal(await confirmed(), 0, 'one report is a claim');
  const second = await report(2, line);
  assert.ok(second.ok && second.outcome === 'booked');
  assert.equal(second.booked[0].kind, 'donation');
  assert.equal(second.booked[0].rsn, 'Nisbro');
  assert.equal(second.booked[0].clanMemberId, seats[0].seat);
  assert.equal(await confirmed(), 46_203_031);
  const third = await report(1, line);
  assert.ok(third.ok && third.outcome === 'seen', 'a third report books nothing more');
  assert.equal(await confirmed(), 46_203_031);
});

test('one person’s two clients are one report', async () => {
  const line = 'Steeldeck has deposited 696,969 coins into the coffer.';
  assert.ok((await report(1, line)).ok);
  const alt = await report(3, line);
  assert.ok(alt.ok && alt.outcome === 'repeat');
  assert.equal(await confirmed(), 46_203_031);
});

test('a withdrawal is custody, and putting it back is not a donation', async () => {
  const out = 'Drenvox has withdrawn 50,000,000 coins from the coffer.';
  await report(1, out);
  const booked = await report(0, out);
  assert.ok(booked.ok && booked.outcome === 'booked' && booked.booked[0].kind === 'withdrawal');
  const before = await confirmed();
  assert.equal(before, 46_203_031, 'the clan still has the gp');

  const back = 'Drenvox has deposited 60,000,000 coins into the coffer.';
  await report(1, back);
  const r = await report(2, back);
  assert.ok(r.ok && r.outcome === 'booked');
  assert.deepEqual(r.booked.map((e) => [e.kind, e.amount]), [['withdrawal', 50_000_000], ['donation', 10_000_000]]);
  assert.equal(await confirmed(), before + 10_000_000);
});

test('another clan’s chat, and lines that aren’t coffer lines, are refused', async () => {
  const other = await report(0, 'Nisbro has deposited 5 coins into the coffer.', 'LFL');
  assert.ok(!other.ok && other.status === 409);
  const junk = await report(0, 'who has deposited 50m into the coffer');
  assert.ok(!junk.ok && junk.status === 400);
});

test('a line only one person saw waits for a treasurer, who books it the same way', async () => {
  await report(2, 'Steeldeck has deposited 1,000 coins into the coffer.');
  const [entry] = await db.select().from(s.cofferEntries).where((await import('drizzle-orm')).eq(s.cofferEntries.amount, 1000));
  assert.equal(entry.status, 'pending');
  const settled = await CB.settleBroadcastEntry({ clanId, entryId: entry.id, approve: true, userId: treasurer });
  assert.equal(settled?.[0].status, 'approved');
  assert.equal(await CB.settleBroadcastEntry({ clanId, entryId: entry.id, approve: true, userId: treasurer }).then((x) => x?.length), 0, 'only once');
});

test('once lines arrive, the coffer screen books nothing', async () => {
  const before = await confirmed();
  const obs = (who: number, kind: 'snapshot' | 'deposit', b: number, a: number) =>
    CS.syncPhysicalCoffer({ clanId, eventKey: crypto.randomUUID(), clanMemberId: seats[who].seat, userId: treasurer, rsn: seats[who].rsn, pluginVersion: null, kind, beforeBalance: b, afterBalance: a, actorConfirmed: true });
  await obs(0, 'snapshot', 0, 0);
  const moved = await obs(0, 'deposit', 0, 5_000_000);
  assert.equal(moved.outcome, 'movement');
  await obs(2, 'snapshot', 5_000_000, 5_000_000);
  assert.equal(await confirmed(), before);
  assert.equal((await CS.getPhysicalCofferState(clanId))?.balance, 5_000_000, 'the physical balance is still kept');
});
