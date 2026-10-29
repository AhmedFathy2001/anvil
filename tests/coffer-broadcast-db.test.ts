// The coffer's clan-chat line against a real database (lib/cofferBroadcast): a member reports only
// their own line; it joins their own coffer reading of the movement (whichever lands first) and books
// when a different member sees the same balance; it never claims someone else's movement; a
// withdrawal is custody and putting it back isn't a donation.
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

const obs = (who: number, kind: 'snapshot' | 'deposit' | 'withdrawal', b: number, a: number, own = false) =>
  CS.syncPhysicalCoffer({ clanId, eventKey: crypto.randomUUID(), clanMemberId: seats[who].seat, userId: treasurer, rsn: seats[who].rsn, pluginVersion: null, kind, beforeBalance: b, afterBalance: a, actorConfirmed: own });
const entries = async () => (await db.select().from(s.cofferEntries)).sort((x, y) => x.id - y.id);
async function fresh(balance: number) {
  await db.delete(s.clanCofferSyncEvents);
  await db.delete(s.clanCofferSyncState);
  await db.delete(s.clanCofferBroadcasts);
  await db.delete(s.cofferEntries);
  await obs(2, 'snapshot', balance, balance);
}

test('only your own line is taken', async () => {
  const r = await report(2, 'Nisbro has deposited 519 coins into the coffer.');
  assert.ok(!r.ok && r.status === 403);
});

test('your line joins your own reading, and books when another member sees the balance', async () => {
  await fresh(1_000);
  const line = await report(0, 'Nisbro has deposited 46,203,031 coins into the coffer.');
  assert.ok(line.ok && line.outcome === 'new');
  await obs(0, 'deposit', 1_000, 46_204_031, true);
  assert.equal(await confirmed(), 0, 'one person’s line and reading are one person’s word');
  assert.equal((await entries()).length, 1, 'one movement, one entry');
  const r = await obs(2, 'snapshot', 46_204_031, 46_204_031);
  assert.equal(r.outcome, 'corroborated');
  assert.equal(r.ledgerEntry?.kind, 'donation');
  assert.equal(r.ledgerEntry?.rsn, 'Nisbro');
  assert.equal(await confirmed(), 46_203_031);
});

test('your reading first, then your line: the line takes its place', async () => {
  await fresh(1_000);
  await obs(3, 'deposit', 1_000, 6_000, true);
  await report(3, 'Drenvox alt has deposited 5,000 coins into the coffer.');
  assert.deepEqual((await entries()).map((e) => e.status), ['rejected', 'pending']);
  const r = await obs(0, 'snapshot', 6_000, 6_000);
  assert.equal(r.ledgerEntry?.rsn, 'Drenvox alt');
  assert.equal(await confirmed(), 5_000);
});

test('a line can’t claim someone else’s movement of the same amount', async () => {
  await fresh(1_000);
  // Nisbro deposits on mobile; Steeldeck's open coffer reads it, unnamed. Drenvox claims it.
  await obs(2, 'deposit', 1_000, 10_001_000);
  await report(1, 'Drenvox has deposited 10,000,000 coins into the coffer.');
  assert.equal((await entries()).filter((e) => e.status === 'pending').length, 2, 'not joined');
  await obs(0, 'snapshot', 10_001_000, 10_001_000);
  const booked = (await entries()).filter((e) => e.status === 'approved');
  assert.deepEqual(booked.map((e) => [e.kind, e.rsn]), [['adjustment', null]], 'booked unnamed; the claim waits for a treasurer');
});

test('a withdrawal is custody, and putting it back is not a donation', async () => {
  await fresh(100_000_000);
  await report(1, 'Drenvox has withdrawn 50,000,000 coins from the coffer.');
  await obs(1, 'withdrawal', 100_000_000, 50_000_000, true);
  const out = await obs(0, 'snapshot', 50_000_000, 50_000_000);
  assert.equal(out.ledgerEntry?.kind, 'withdrawal');
  assert.equal(await confirmed(), 0, 'the clan still has the gp');

  await report(1, 'Drenvox has deposited 60,000,000 coins into the coffer.');
  await obs(1, 'deposit', 50_000_000, 110_000_000, true);
  await obs(2, 'snapshot', 110_000_000, 110_000_000);
  const booked = (await entries()).filter((e) => e.status === 'approved').map((e) => [e.kind, Number(e.amount)]);
  assert.deepEqual(booked.sort(), [['donation', 10_000_000], ['withdrawal', -50_000_000], ['withdrawal', 50_000_000]]);
  assert.equal(await confirmed(), 10_000_000);
});

test('another clan’s chat, and lines that aren’t coffer lines, are refused', async () => {
  const other = await report(0, 'Nisbro has deposited 5 coins into the coffer.', 'LFL');
  assert.ok(!other.ok && other.status === 409);
  const junk = await report(0, 'who has deposited 50m into the coffer');
  assert.ok(!junk.ok && junk.status === 400);
});

test('a line nobody else confirmed waits for a treasurer, who books it the same way', async () => {
  await fresh(0);
  await report(2, 'Steeldeck has deposited 1,000 coins into the coffer.');
  const [entry] = await entries();
  assert.equal(entry.status, 'pending');
  const settled = await CB.settleBroadcastEntry({ clanId, entryId: entry.id, approve: true, userId: treasurer });
  assert.equal(settled?.[0].status, 'approved');
  assert.equal(await CB.settleBroadcastEntry({ clanId, entryId: entry.id, approve: true, userId: treasurer }).then((x) => x?.length), 0, 'only once');
});
