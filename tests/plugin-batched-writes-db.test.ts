// The plugin's whole-log clog sync and progress push write in batches: changed clog rows ride the
// chunked upsert (no UPDATE per row), progress keys go up in one upsert, and the item lists are read
// in one query. Pins that a re-sync still lands every change and creates no duplicate rows.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/plugin-batched-writes-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('plugin-batched-writes');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let accountId = 0;

function req(path: string, body: object) {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer tok-batch',
      'X-RSN': 'Batcher',
      'X-Account-Hash': 'hash-batch',
      'x-anvil-clan-slug': 'alpha',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const [person] = await db.insert(s.players).values({ displayName: 'Batcher' }).returning();
  await db.insert(s.users).values({ displayName: 'Batcher', discordId: 'd-batch', pluginTokenHash: tokenHash('tok-batch'), playerId: person.id });
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Batcher', rsnNormalized: 'batcher', accountHash: 'hash-batch', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  accountId = acct.id;
  await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a whole-log re-sync updates a changed quantity in place and adds the new item once', async () => {
  const { POST } = await import('../src/app/api/plugin/clog/route.ts');
  // Tanzanite fang + Zulrah's scales (stackable).
  let res = await POST(req('/api/plugin/clog', { items: [{ id: 12922, q: 1 }, { id: 12934, q: 100 }] }));
  assert.equal(res.status, 200, await res.clone().text());

  // The scales grew, and a Pet snakeling arrived — a minute later, past the one-sync-a-minute limit.
  const realNow = Date.now;
  Date.now = () => realNow() + 61_000;
  try {
    res = await POST(req('/api/plugin/clog', { items: [{ id: 12922, q: 1 }, { id: 12934, q: 250 }, { id: 12921, q: 1 }] }));
  } finally {
    Date.now = realNow;
  }
  assert.equal(res.status, 200, await res.clone().text());

  const rows = await db.select().from(s.memberClogItems).where(eq(s.memberClogItems.accountId, accountId));
  const byItem = new Map(rows.map((r) => [r.itemId, r]));
  assert.equal(rows.length, 3, 'one row per item, no duplicates');
  assert.equal(byItem.get(12934)?.quantity, 250, 'the changed quantity landed');
  assert.equal(byItem.get(12922)?.quantity, 1);
  assert.ok(byItem.has(12921), 'the new item was added');
});

test('a progress push upserts every changed key in one go and stores a changed item list', async () => {
  const { POST } = await import('../src/app/api/plugin/progress/route.ts');
  let res = await POST(req('/api/plugin/progress', {
    progress: [{ key: 'diaryEasy', value: 2 }, { key: 'diaryMedium', value: 1 }],
    items: [{ category: 'quest', items: [{ id: 1, name: "Cook's Assistant", state: 1 }] }],
  }));
  assert.equal(res.status, 200, await res.clone().text());

  res = await POST(req('/api/plugin/progress', {
    progress: [{ key: 'diaryEasy', value: 4 }, { key: 'diaryMedium', value: 3 }],
    items: [{ category: 'quest', items: [{ id: 1, name: "Cook's Assistant", state: 2 }] }],
  }));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.updated, 2);
  assert.equal(body.itemsStored, 1);

  const progress = await db.select().from(s.memberProgress).where(eq(s.memberProgress.accountId, accountId));
  const byKey = new Map(progress.map((r) => [r.key, r.value]));
  assert.equal(byKey.get('diaryEasy'), 4);
  assert.equal(byKey.get('diaryMedium'), 3);

  const items = await db.select().from(s.memberProgressItems).where(eq(s.memberProgressItems.accountId, accountId));
  assert.equal(items.length, 1, 'the list was updated in place, not inserted again');
  assert.equal(items[0].doneCount, 1);

  // The same list again stores nothing.
  res = await POST(req('/api/plugin/progress', {
    items: [{ category: 'quest', items: [{ id: 1, name: "Cook's Assistant", state: 2 }] }],
  }));
  assert.equal((await res.json()).itemsStored, 0);
});
