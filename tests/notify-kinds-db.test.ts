// The newer kinds' clan defaults against a real database: a character takes ITS member clan's
// defaults, a clanless one Anvil's, and a clan setting can never turn a private kind on, even when the
// stored JSON was written around the API.
// Run: npx tsx --test tests/notify-kinds-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('notify-kinds');

let D: typeof import('../src/lib/notifyDefaults.ts');
let P: typeof import('../src/lib/notifyPrefs.ts');
let clanA: number;
let inA: number;
let loner: number;

before(async () => {
  await resetDatabase(DB);
  const { db, schema: s } = await loadDb();
  D = await import('../src/lib/notifyDefaults.ts');
  P = await import('../src/lib/notifyPrefs.ts');
  const [a] = await db.insert(s.clans).values({ slug: 'kinds', name: 'Kinds', status: 'active' }).returning();
  clanA = a.id;
  // Written raw, as if around the API: kc on, and a forged GE / trade / storage switch.
  await db.insert(s.settings).values({
    clanId: clanA,
    key: 'notify_kind_defaults',
    value: JSON.stringify({ kinds: { kc: { on: true, every: 250 }, ge: { on: true }, trade: { on: true }, storage: { on: true }, ext: { on: true } }, shots: { deaths: false } }),
  });
  const [pl] = await db.insert(s.players).values({ displayName: 'K' }).returning();
  const mk = async (rsn: string) =>
    (await db.insert(s.accounts).values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning())[0].id;
  inA = await mk('InKinds');
  loner = await mk('Loner');
  await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: inA, kind: 'member' });
});
after(async () => {
  await dropDatabase(DB);
});

test('a member takes the clan default; the private kinds stay off', async () => {
  const c = await D.characterClanKinds(inA, clanA);
  assert.deepEqual(Object.keys(c.kinds), ['kc']);
  const m = P.pluginMe(P.NOTIFY_DEFAULTS, {}, P.NO_CLAN_DROPS, null, [], c);
  assert.deepEqual(m.watch.map((w) => [w.k, w.every]), [['kc', 250]]);
  assert.deepEqual(m.on, {});
  assert.deepEqual(m.noShot, ['death']);
});

test('a character with no member seat gets Anvil defaults: nothing new', async () => {
  const c = await D.characterClanKinds(loner, clanA);
  const m = P.pluginMe(P.NOTIFY_DEFAULTS, {}, P.NO_CLAN_DROPS, null, [], c);
  assert.deepEqual([m.watch, m.noShot, m.on], [[], [], {}]);
});
