// Drop-threshold inheritance against a real database: a character inherits ITS clan's default (per
// character, clans can differ), a clanless one gets Anvil's, personal webhooks' own filters fall back, and
// migration 0245 turns never-changed old defaults (5m, 1/10,000) into "inherit".
// Run: npx tsx --test tests/notify-defaults-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('notify-defaults');

let D: typeof import('../src/lib/notifyDefaults.ts');
let P: typeof import('../src/lib/notifyPrefs.ts');
let J: typeof import('../src/lib/notifyDrops.ts');
let clanA: number;
let clanB: number;
let inA: number;
let inB: number;
let noClan: number;
let login: number;

before(async () => {
  await resetDatabase(DB);
  const { db, schema: s } = await loadDb();
  D = await import('../src/lib/notifyDefaults.ts');
  P = await import('../src/lib/notifyPrefs.ts');
  J = await import('../src/lib/notifyDrops.ts');

  const [a] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha', status: 'active' }).returning();
  const [b] = await db.insert(s.clans).values({ slug: 'bravo', name: 'Bravo', status: 'active' }).returning();
  clanA = a.id;
  clanB = b.id;
  await db.insert(s.settings).values([
    { clanId: clanA, key: 'drop_default_value', value: '5000000' },
    { clanId: clanA, key: 'drop_default_mode', value: 'and' },
    { clanId: clanB, key: 'drop_default_rarity', value: '10000' },
  ]);
  const [pl] = await db.insert(s.players).values({ displayName: 'P' }).returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: 'P', discordId: 'nd-1' }).returning();
  login = u.id;
  const mk = async (rsn: string) =>
    (await db.insert(s.accounts).values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning())[0].id;
  inA = await mk('InAlpha');
  inB = await mk('InBravo');
  noClan = await mk('Loner');
  await db.insert(s.clanMemberships).values([
    { clanId: clanA, accountId: inA, kind: 'member' },
    { clanId: clanB, accountId: inB, kind: 'member' },
  ]);
});
after(async () => {
  await dropDatabase(DB);
});

test('each character inherits its own clan default; no member seat means Anvil defaults', async () => {
  const gate = async (acc: number) => P.dropGates(P.NOTIFY_DEFAULTS, await D.characterClanDrops(acc, clanA, null));
  const ga = await gate(inA);
  assert.deepEqual([ga.value, ga.rarity, ga.mode], [5_000_000, 1_000, 'and']);
  const gb = await gate(inB);
  assert.deepEqual([gb.value, gb.rarity, gb.mode], [1_000_000, 10_000, 'or']);
  // Addressed clan is Alpha for all three: the CHARACTER's clan decides, not the URL.
  const gn = await gate(noClan);
  assert.deepEqual([gn.value, gn.rarity, gn.mode], [1_000_000, 1_000, 'or']);
});

test('a clan change flows to everyone still inheriting, not to a custom number', async () => {
  const { db, schema: s } = await loadDb();
  const mine = P.normalizeNotifyPrefs({});
  const custom = P.normalizeNotifyPrefs({ dropMin: 3_000_000 });
  await db.update(s.settings).set({ value: '2000000' }).where(eq(s.settings.key, 'drop_default_value'));
  const clan = await D.characterClanDrops(inA, clanA, null);
  assert.equal(P.dropGates(mine, clan).value, 2_000_000);
  assert.equal(P.dropGates(custom, clan).value, 3_000_000);
});

test('personal webhooks: their drop filters are read, and unset ones fall back to the person', async () => {
  const { db, schema: s } = await loadDb();
  await db.delete(s.userWebhooks).where(eq(s.userWebhooks.userId, login));
  const [plain, loose, mode] = await db
    .insert(s.userWebhooks)
    .values([
      { userId: login, url: 'https://d.example/plain', kinds: '["rareDrops"]' },
      { userId: login, url: 'https://d.example/loose', kinds: '["rareDrops"]', minValue: 100_000 },
      { userId: login, url: 'https://d.example/mode', kinds: '["rareDrops"]', minDropMode: 'and' },
    ])
    .returning();
  await db.insert(s.userWebhooks).values({ userId: login, url: 'https://d.example/pets', kinds: '["pets"]', minValue: 1 });
  const hooks = await D.dropHookFilters(login);
  assert.equal(hooks.length, 3); // the pets-only one takes no drops
  const byId = new Map(hooks.map((h) => [h.id, h]));
  assert.deepEqual(byId.get(plain.id), { id: plain.id, minValue: null, minRarity: null, mode: null });
  assert.equal(byId.get(loose.id)?.minValue, 100_000);
  assert.equal(byId.get(mode.id)?.mode, 'and');

  const clan = await D.characterClanDrops(noClan, clanA, null); // Anvil defaults: 1m or 1/1000
  const ctx = { prefs: P.NOTIFY_DEFAULTS, clan, mode: null, guaranteed: {}, nameOf: () => undefined };
  const mid = J.judgeDropFor({ source: 'X', sourceKind: 'npc', items: [{ id: 1, name: 'Mid', qty: 1, value: 300_000 }] }, ctx, hooks);
  assert.ok(mid);
  assert.equal(mid.clan, false);
  assert.deepEqual(mid.hooks, [loose.id]);
  const rich = J.judgeDropFor({ source: 'X', sourceKind: 'npc', items: [{ id: 2, name: 'Rich', qty: 1, value: 9_000_000 }] }, ctx, hooks);
  assert.ok(rich);
  assert.equal(rich.clan, true);
  assert.deepEqual(rich.hooks.sort(), [plain.id, loose.id].sort()); // the "both" hook wants rarity too
});

test('migration 0245: old defaults become inherit; other values stay custom; junk is untouched', async () => {
  const { db, pool, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'M' }).returning();
  const mk = async (id: string, prefs: string | null) =>
    (await db.insert(s.users).values({ playerId: pl.id, displayName: id, discordId: id, notifyPrefs: prefs }).returning())[0].id;
  const untouched = await mk('m-1', JSON.stringify({ drops: true, dropMin: 5_000_000, rarity: 10_000, pets: false }));
  const half = await mk('m-2', JSON.stringify({ dropMin: 5_000_000, rarity: 5_000 }));
  const custom = await mk('m-3', JSON.stringify({ dropMin: 2_000_000, rarity: 20_000 }));
  const junk = await mk('m-4', '{not json');
  const never = await mk('m-5', null);

  const sql = readFileSync(new URL('../drizzle/0245_notify_inherit_defaults.sql', import.meta.url), 'utf8');
  await pool.query(sql.split('--> statement-breakpoint')[0]);

  const read = async (id: number) => (await db.select({ p: s.users.notifyPrefs }).from(s.users).where(eq(s.users.id, id)))[0].p;
  const pU = JSON.parse((await read(untouched))!);
  assert.equal('dropMin' in pU, false);
  assert.equal('rarity' in pU, false);
  assert.equal(pU.pets, false); // everything else kept
  assert.equal(P.parseNotifyPrefs(await read(untouched)).dropMin, null);
  const pH = JSON.parse((await read(half))!);
  assert.deepEqual([pH.dropMin, pH.rarity], [undefined, 5_000]);
  assert.deepEqual(JSON.parse((await read(custom))!), { dropMin: 2_000_000, rarity: 20_000 });
  assert.equal(await read(junk), '{not json');
  assert.equal(await read(never), null);
});

test('migration 0245 copies an old gp floor on a webhook into min_value', async () => {
  const { db, pool, schema: s } = await loadDb();
  const [row] = await db.insert(s.userWebhooks).values({ userId: login, url: 'https://d.example/old', kinds: '["rareDrops"]', minRarity: 750_000 }).returning();
  const sql = readFileSync(new URL('../drizzle/0245_notify_inherit_defaults.sql', import.meta.url), 'utf8');
  for (const stmt of sql.split('--> statement-breakpoint').slice(1)) await pool.query(stmt);
  const [after2] = await db.select().from(s.userWebhooks).where(eq(s.userWebhooks.id, row.id));
  assert.equal(after2.minValue, 750_000);
});
