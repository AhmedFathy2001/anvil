// The versioned Supporter name list against a real database (migration 0216 + lib/chatFlairFeed): the
// tables announce changes themselves (a gift, a plugin verification, a share toggle, a rename), a
// refresh turns them into the next version with a delta that says only what the full list would, and
// catch-up / full reads agree with it. The flair rule: shared AND verified; a clan's approval
// (provisional) doesn't decide it.
//
// Run: TEST_DATABASE_URL=postgres://… npx tsx --test tests/chat-flair-feed-db.test.ts

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { eq } from 'drizzle-orm';
import pg from 'pg';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('chat-flair-feed');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let F: typeof import('../src/lib/chatFlairFeed.ts');
let G: typeof import('../src/lib/supporterGifts.ts');
let R: typeof import('../src/lib/roster.ts');
let listener: pg.Client;
let heard: { k: string; p?: number[]; n?: string[]; m?: Record<string, unknown> }[] = [];

let n = 0;
async function person(name: string, opts: { verified?: boolean; provisional?: boolean; shared?: boolean } = {}) {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({
      playerId: pl.id,
      rsn: name,
      rsnNormalized: name.toLowerCase(),
      verifiedAt: opts.verified === false ? null : new Date().toISOString(),
      provisional: opts.provisional ? 1 : 0,
      shared: opts.shared ?? true,
    })
    .returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99600000000000${String(n).padStart(4, '0')}` }).returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id, name: name.toLowerCase() };
}

/** Wait until NOTIFYs have arrived (they're delivered after commit), then hand back the dirty scope. */
async function dirty(): Promise<{ players: number[]; names: string[] }> {
  await new Promise((r) => setTimeout(r, 150));
  const players = new Set<number>();
  const names = new Set<string>();
  for (const h of heard.filter((x) => x.k === 'flairdirty')) {
    for (const p of h.p ?? []) players.add(p);
    for (const x of h.n ?? []) names.add(x);
  }
  heard = heard.filter((x) => x.k !== 'flairdirty');
  return { players: [...players], names: [...names] };
}

async function lastDelta() {
  await new Promise((r) => setTimeout(r, 150));
  const v = heard.filter((x) => x.k === 'flairv').at(-1);
  heard = [];
  return v?.m as { v: number; from: number; names?: string[]; ix?: number[]; styles?: { c: string; s?: true }[]; del?: string[] } | undefined;
}

async function fullNames(): Promise<string[]> {
  const f = await F.flairFull();
  return (JSON.parse(gunzipSync(f.gz).toString()) as { names: string[] }).names;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  F = await import('../src/lib/chatFlairFeed.ts');
  G = await import('../src/lib/supporterGifts.ts');
  R = await import('../src/lib/roster.ts');
  listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  listener.on('notification', (m) => {
    const p = JSON.parse(m.payload ?? '{}');
    if (p.k === 'flairdirty' || p.k === 'flairv') heard.push(p);
  });
  await listener.query('LISTEN anvil_push');
});

beforeEach(() => {
  heard = [];
});

after(async () => {
  await listener.end();
  await pool.end();
  await dropDatabase(DB);
});

test('a gift is heard, and its refresh is a delta adding just that person\'s characters', async () => {
  const seed = await person('Seedy');
  await db.insert(s.supporterSubscriptions).values({ userId: seed.userId, tier: 'supporter', status: 'active', startedAt: '2026-01-01 00:00:00' });
  const base = await F.refreshChatFlair('all');
  assert.equal(base, 1);
  const a = await person('Gifty');
  const bystander = await person('Nobody');
  await dirty();
  await G.giveGift({ userId: a.userId, tier: 'patron', days: 30, actorUserId: bystander.userId });
  const scope = await dirty();
  assert.deepEqual(scope.players, [a.playerId]);
  const v = await F.refreshChatFlair(scope);
  assert.equal(v, base + 1);
  const d = await lastDelta();
  assert.equal(d?.from, base);
  assert.deepEqual(d?.names, ['gifty']);
  assert.equal(d?.styles?.[d.ix![0]].s, true, 'Patron star');
  assert.ok((await fullNames()).includes('gifty'));
  assert.ok(!(await fullNames()).includes('nobody'));
  // A plugin one behind gets the delta; one current gets nothing to do.
  F.resetChatFlairMemory();
  assert.deepEqual((await F.flairSince(base)).deltas?.map((x) => x.v), [v]);
  assert.deepEqual(await F.flairSince(v), { v });
});

test('the rule: verified + shared wears it, provisional or not; unverified and hidden do not', async () => {
  const prov = await person('Provy', { provisional: true });
  const unver = await person('Unvery', { verified: false });
  const hidden = await person('Hidey', { shared: false });
  for (const p of [prov, unver, hidden]) {
    await db.insert(s.supporterSubscriptions).values({ userId: p.userId, tier: 'supporter', status: 'active', startedAt: '2026-01-01 00:00:00' });
  }
  await F.refreshChatFlair(await dirty());
  const names = await fullNames();
  assert.ok(names.includes('provy'), 'verified + shared + provisional is in');
  assert.ok(!names.includes('unvery'));
  assert.ok(!names.includes('hidey'));

  // The plugin verifying the character (the sign-in path's write) is heard and adds it.
  heard = [];
  await R.updateAccount(unver.accountId, { verifiedAt: new Date().toISOString(), verificationMethod: 'plugin' });
  const scope = await dirty();
  assert.deepEqual(scope.players, [unver.playerId]);
  await F.refreshChatFlair(scope);
  assert.deepEqual((await lastDelta())?.names, ['unvery']);

  // Hiding a character drops it (del), and the delta carries nothing else about it.
  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.id, prov.accountId));
  await F.refreshChatFlair(await dirty());
  const d = await lastDelta();
  assert.deepEqual(d?.del, ['provy']);
  assert.deepEqual(d?.names, []);
});

test('a rename deletes the old name and sets the new; a stats-like write is silent', async () => {
  const p = await person('Oldname');
  await db.insert(s.supporterSubscriptions).values({ userId: p.userId, tier: 'champion', status: 'active', startedAt: '2026-01-01 00:00:00' });
  await F.refreshChatFlair(await dirty());
  heard = [];
  await db.update(s.accounts).set({ accountType: 'normal' }).where(eq(s.accounts.id, p.accountId));
  assert.deepEqual(await dirty(), { players: [], names: [] }, 'a column the list does not read');
  await db.update(s.accounts).set({ rsn: 'Newname', rsnNormalized: 'newname' }).where(eq(s.accounts.id, p.accountId));
  const scope = await dirty();
  assert.ok(scope.names.includes('oldname'));
  await F.refreshChatFlair(scope);
  const d = await lastDelta();
  assert.deepEqual(d?.names, ['newname']);
  assert.deepEqual(d?.del, ['oldname']);
});

test('nothing changed: no version; a fresh instance reads the same list from the log', async () => {
  const v = await F.refreshChatFlair('all');
  assert.equal(await F.refreshChatFlair('all'), v);
  const before = await fullNames();
  F.resetChatFlairMemory();
  assert.deepEqual(await fullNames(), before);
  assert.equal((await F.flairFull()).v, v);
  const legacy = JSON.parse((await F.flairLegacy()).body) as { names: { n: string }[] };
  assert.deepEqual(legacy.names.map((x) => x.n), before);
});
