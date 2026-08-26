// The emission matrix — one person, several relationships, one social notification.
//
// The plan calls this "the probe that matters most for Part II", because a wrong answer here is a
// privacy failure that looks exactly like a working feature: an alt's pet quietly announced to a
// clan that was never told the alt exists. So the rules are pinned as a table rather than trusted to
// read correctly at the call site.
//
//   member clan     always announces (default on).
//   guest + shared  announces.
//   guest + unshared announces NOWHERE but the member clan — the shared gate is absolute.
//   per-clan off    silences one clan; per-clan on cannot open the shared gate for a guest.
//
// Run: npx tsx --test tests/emission-routing.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('emission-routing');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let R: typeof import('../src/lib/emissionRouting.ts');

let clanMember: number; // account is a MEMBER here
let clanGuestA: number; // account guests here
let clanGuestB: number; // account guests here too
let sharedAccount: number;
let unsharedAccount: number;
let person: number;
let login: number;

async function seat(accountId: number, clanId: number, kind: 'member' | 'guest') {
  const { db, schema: s } = await loadDb();
  await db.insert(s.clanMemberships).values({ clanId, accountId, kind });
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  R = await import('../src/lib/emissionRouting.ts');

  const [m] = await db.insert(s.clans).values({ slug: 'home', name: 'Home', status: 'active' }).returning();
  const [ga] = await db.insert(s.clans).values({ slug: 'visita', name: 'Visit A', status: 'active' }).returning();
  const [gb] = await db.insert(s.clans).values({ slug: 'visitb', name: 'Visit B', status: 'active' }).returning();
  clanMember = m.id;
  clanGuestA = ga.id;
  clanGuestB = gb.id;

  const [pp] = await db.insert(s.players).values({ displayName: 'Player' }).returning();
  person = pp.id;
  const [u] = await db.insert(s.users).values({ playerId: pp.id, displayName: 'Player', discordId: 'p-1' }).returning();
  login = u.id;

  // The shared account: a member of Home, a guest of Visit A and Visit B, and marked shared.
  const [shared] = await db
    .insert(s.accounts)
    .values({ playerId: pp.id, rsn: 'Main', rsnNormalized: 'main', shared: true })
    .returning();
  sharedAccount = shared.id;
  await seat(sharedAccount, clanMember, 'member');
  await seat(sharedAccount, clanGuestA, 'guest');
  await seat(sharedAccount, clanGuestB, 'guest');

  // The unshared alt: a member of Home, a guest of Visit A — but nobody's business.
  const [alt] = await db
    .insert(s.accounts)
    .values({ playerId: pp.id, rsn: 'Iron', rsnNormalized: 'iron', shared: false })
    .returning();
  unsharedAccount = alt.id;
  await seat(unsharedAccount, clanMember, 'member');
  await seat(unsharedAccount, clanGuestA, 'guest');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

function clanIds(list: { clanId: number }[]): number[] {
  return list.map((c) => c.clanId).sort((a, b) => a - b);
}

test('a shared account announces to its member clan and every clan it guests in', async () => {
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestA, clanGuestB].sort((a, b) => a - b));
  assert.equal(targets.find((t) => t.clanId === clanMember)!.kind, 'member');
  assert.equal(targets.find((t) => t.clanId === clanGuestA)!.kind, 'guest');
});

test('an UNSHARED account announces to its member clan only — never where it guests', async () => {
  const targets = await R.socialEmissionClans(unsharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember]);
  assert.equal(targets[0].kind, 'member', 'and it is there as the member, not a guest');
});

test('the per-clan OFF toggle silences one clan and no other', async () => {
  const { db, schema: s } = await loadDb();
  // Silence the shared account in Visit A.
  await db.insert(s.accountClanEmission).values({ accountId: sharedAccount, clanId: clanGuestA, enabled: false });

  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestB].sort((a, b) => a - b), 'Visit A dropped, Visit B stays');

  await db.delete(s.accountClanEmission).where(eq(s.accountClanEmission.accountId, sharedAccount));
});

test('the OFF toggle can silence even the MEMBER clan', async () => {
  const { db, schema: s } = await loadDb();
  await db.insert(s.accountClanEmission).values({ accountId: sharedAccount, clanId: clanMember, enabled: false });

  const targets = await R.socialEmissionClans(sharedAccount);
  assert.equal(targets.some((t) => t.clanId === clanMember), false, 'member clan silenced by an explicit off');

  await db.delete(s.accountClanEmission).where(eq(s.accountClanEmission.accountId, sharedAccount));
});

test('a per-clan ON toggle canNOT open the shared gate for an unshared guest', async () => {
  const { db, schema: s } = await loadDb();
  // Explicitly enable emission to Visit A for the UNSHARED alt.
  await db.insert(s.accountClanEmission).values({ accountId: unsharedAccount, clanId: clanGuestA, enabled: true });

  const targets = await R.socialEmissionClans(unsharedAccount);
  assert.equal(
    targets.some((t) => t.clanId === clanGuestA),
    false,
    'shared is absolute — an unshared alt never announces to a clan it guests in, toggle or not',
  );

  await db.delete(s.accountClanEmission).where(eq(s.accountClanEmission.accountId, unsharedAccount));
});

test('a departed seat is not a destination', async () => {
  const { db, schema: s } = await loadDb();
  await db
    .update(s.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(s.clanMemberships.clanId, clanGuestB));

  const targets = await R.socialEmissionClans(sharedAccount);
  assert.equal(targets.some((t) => t.clanId === clanGuestB), false, 'left the clan → no longer announces there');

  await db.update(s.clanMemberships).set({ leftAt: null }).where(eq(s.clanMemberships.clanId, clanGuestB));
});

// ── Personal webhooks ───────────────────────────────────────────────────────────────────────────

test('a personal webhook receives only the kinds it asked for', async () => {
  const { db, schema: s } = await loadDb();
  await db.insert(s.userWebhooks).values({ userId: login, url: 'https://d.example/a', kinds: '["rareDrops","deaths"]' });

  assert.deepEqual((await R.personalWebhookTargets(login, 'rareDrops')).map((t) => t.url), ['https://d.example/a']);
  assert.deepEqual((await R.personalWebhookTargets(login, 'deaths')).map((t) => t.url), ['https://d.example/a']);
  assert.deepEqual(await R.personalWebhookTargets(login, 'pvpKills'), [], 'not a kind it wanted');
});

test('min_rarity gates the drop-shaped kinds, and only when a value is known', async () => {
  const { db, schema: s } = await loadDb();
  await db.delete(s.userWebhooks).where(eq(s.userWebhooks.userId, login));
  await db
    .insert(s.userWebhooks)
    .values({ userId: login, url: 'https://d.example/big', kinds: '["rareDrops"]', minRarity: 1_000_000 });

  assert.deepEqual((await R.personalWebhookTargets(login, 'rareDrops', 5_000_000)).map((t) => t.url), ['https://d.example/big']);
  assert.deepEqual(await R.personalWebhookTargets(login, 'rareDrops', 50_000), [], 'below the floor');
  // No value known (e.g. a kind that isn't priced): the floor does not bite.
  assert.deepEqual((await R.personalWebhookTargets(login, 'rareDrops')).map((t) => t.url), ['https://d.example/big']);
});

test('a corrupt kinds column is read as "wants nothing", not a crash', () => {
  assert.deepEqual(R.parseKinds('not json'), []);
  assert.deepEqual(R.parseKinds('{"rareDrops":true}'), []);
  assert.deepEqual(R.parseKinds('["rareDrops",5,"deaths"]'), ['rareDrops', 'deaths']);
  assert.deepEqual(R.parseKinds(null), []);
});
