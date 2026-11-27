// An unnamed pet split from its kill's loot across two pushes is named from the other one
// (lib/momentsStore settleUnnamedPets), against a real database.
//
// Run: TESTS_OK=1 npx tsx --test tests/pet-name-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('pet-name');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let M: typeof import('../src/lib/momentsStore.ts');

let clanId: number;
let seat: { clanMemberId: number; rsn: string };

const T = Date.now() - 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  M = await import('../src/lib/momentsStore.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'pets', name: 'Pets' }).returning();
  clanId = clan.id;
  const [pl] = await db.insert(s.players).values({ displayName: 'phantomx22x' }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'phantomx22x', rsnNormalized: 'phantomx22x' }).returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member', source: 'test' }).returning();
  seat = { clanMemberId: m.id, rsn: 'phantomx22x' };
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function push(observations: Parameters<typeof M.recordSeatMoments>[1]) {
  await M.settleUnnamedPets(seat.clanMemberId, observations);
  return M.recordSeatMoments(seat, observations, await M.activeScopesFor(seat.clanMemberId, clanId));
}

test('the pet first, the kill loot in the next push: the stored pet is renamed', async () => {
  await push([{ kind: 'pet', itemName: null, source: null, occurredAt: iso(T), dedupKey: 'pet|a' }]);
  const [before] = await db.select().from(s.moments).where(eq(s.moments.dedupKey, 'pet|a:clan'));
  assert.equal(before.itemName, null);

  await push([{ kind: 'drop', itemId: 3051, itemName: 'Grimy snapdragon', quantity: 20, valueGp: 122_360, source: 'Skotizo', sourceKind: 'npc', kc: 184, occurredAt: iso(T + 3_000), dedupKey: 'drop|b' }]);
  const [after] = await db.select().from(s.moments).where(eq(s.moments.dedupKey, 'pet|a:clan'));
  assert.equal(after.itemName, 'Skotos');
  assert.equal(after.itemId, 21273);
  assert.equal(after.source, 'Skotizo');
  assert.equal(after.kc, 184);
});

test('the loot stored first, the pet in the next push: the pet is named on the way in', async () => {
  const at = T + 20 * 60_000;
  await push([{ kind: 'drop', itemId: 4151, itemName: 'Abyssal whip', quantity: 1, valueGp: 50_000_000, source: 'Skotizo', sourceKind: 'npc', kc: 185, occurredAt: iso(at + 2_000), dedupKey: 'drop|c' }]);
  const rows = await db.select().from(s.moments).where(eq(s.moments.dedupKey, 'drop|c:clan'));
  assert.equal(rows.length, 1, 'the loot is stored');
  const obs: Parameters<typeof M.recordSeatMoments>[1] = [{ kind: 'pet', itemName: null, source: null, occurredAt: iso(at), dedupKey: 'pet|d' }];
  await push(obs);
  const [pet] = await db.select().from(s.moments).where(eq(s.moments.dedupKey, 'pet|d:clan'));
  assert.equal(pet.itemName, 'Skotos');
});

test('a named pet, or one far from the loot, is left alone', async () => {
  const at = T + 40 * 60_000;
  await push([
    { kind: 'pet', itemName: 'Vorki', source: 'Vorkath', occurredAt: iso(at), dedupKey: 'pet|e' },
    { kind: 'pet', itemName: null, source: null, occurredAt: iso(at - 5 * 60_000), dedupKey: 'pet|f' },
  ]);
  await push([{ kind: 'drop', itemId: 3051, itemName: 'Grimy snapdragon', quantity: 20, valueGp: 122_360, source: 'Skotizo', occurredAt: iso(at + 1_000), dedupKey: 'drop|g' }]);
  const [named] = await db.select().from(s.moments).where(eq(s.moments.dedupKey, 'pet|e:clan'));
  const [far] = await db.select().from(s.moments).where(eq(s.moments.dedupKey, 'pet|f:clan'));
  assert.equal(named.itemName, 'Vorki');
  assert.equal(far.itemName, null);
});
