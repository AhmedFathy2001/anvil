// Who the clan home's "Ask to join as a guest" button is for.
//
// The apply GET decided "already in" as "nothing to apply with, and the clan has anyone seated" —
// true of every real clan, so a signed-in newcomer with no verified character got alreadyIn and the
// button vanished. "Already in" has to be about the visitor's own characters.
//
// Run: npm run test:clanapply

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-apply');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let applyChoices: typeof import('../src/lib/clanApply.ts')['applyChoices'];
let clanId: number;
let otherClan: number;

async function person(name: string) {
  const { db, schema: s } = await loadDb();
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  return p.id;
}

async function character(playerId: number, rsn: string, verified = true) {
  const { db, schema: s } = await loadDb();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), verifiedAt: verified ? new Date().toISOString() : null })
    .returning();
  return a.id;
}

async function seat(clan: number, accountId: number) {
  const { db, schema: s } = await loadDb();
  await db.insert(s.clanMemberships).values({ clanId: clan, accountId, kind: 'member' });
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ applyChoices } = await import('../src/lib/clanApply.ts'));
  const clans = await db
    .insert(s.clans)
    .values([{ slug: 'host', name: 'Host' }, { slug: 'elsewhere', name: 'Elsewhere' }])
    .returning();
  [clanId, otherClan] = clans.map((c) => c.id);
  // The clan has members — the condition the old check mistook for "you are one of them".
  await seat(clanId, await character(await person('Regular'), 'Regular'));
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a newcomer with no characters is not "already in" — they are pointed at verifying one', async () => {
  const r = await applyChoices(clanId, await person('Newcomer'));
  assert.deepEqual(r, { alreadyIn: false, options: [] });
});

test('an unverified character is not something to apply with, and not a seat either', async () => {
  const p = await person('Unproven');
  await character(p, 'Unproven', false);
  assert.deepEqual(await applyChoices(clanId, p), { alreadyIn: false, options: [] });
});

test('a verified character with no seat here is offered, even if seated in another clan', async () => {
  const p = await person('Visitor');
  const a = await character(p, 'Visitor');
  await seat(otherClan, a);
  assert.deepEqual(await applyChoices(clanId, p), { alreadyIn: false, options: [{ id: a, rsn: 'Visitor' }] });
});

test('only seated characters are left out of the options', async () => {
  const p = await person('Two Alts');
  const main = await character(p, 'MainAlt');
  const alt = await character(p, 'SecondAlt');
  await seat(clanId, main);
  const r = await applyChoices(clanId, p);
  assert.equal(r.alreadyIn, false);
  assert.deepEqual(r.options, [{ id: alt, rsn: 'SecondAlt' }]);
});

test('every character seated here is "already in"', async () => {
  const p = await person('Member');
  await seat(clanId, await character(p, 'MemberOne'));
  await seat(clanId, await character(p, 'MemberTwo'));
  assert.deepEqual(await applyChoices(clanId, p), { alreadyIn: true, options: [] });
});
