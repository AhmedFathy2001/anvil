// The plugin's Lookup on a name with no Anvil account: a card off the OSRS hiscores, cached.
//
// Two things matter more than the card itself. A PRIVATE account must never fall back — a hiscores
// card where everyone else gets a 404 would announce the account that sharing withholds. And a cached
// answer must not reach Jagex again until its TTL is up; that cache is what makes a public endpoint
// that calls the hiscores safe to expose at all.
//
// Run: npx tsx --test tests/public-hiscores-card.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';
import type { SnapshotFetch } from '../src/lib/hiscores.ts';
import { PUBLIC_HISCORES_TTL_MS } from '../src/lib/publicHiscoresPolicy.ts';

const DB = useTestDatabase('public-hiscores-card');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let publicHiscoresCard: typeof import('../src/lib/publicHiscoresCard.ts')['publicHiscoresCard'];

const snapshot = (zulrah: number): SnapshotFetch => ({
  kind: 'value',
  snapshot: {
    skills: {
      overall: { rank: 1000, level: 1500, xp: 50_000_000 },
      hitpoints: { rank: 1000, level: 80, xp: 2_000_000 },
      attack: { rank: 1000, level: 75, xp: 1_300_000 },
      strength: { rank: 1000, level: 80, xp: 2_000_000 },
      defence: { rank: 1000, level: 70, xp: 750_000 },
    },
    bosses: { zulrah: { rank: 5000, score: zulrah } },
  },
});

/** A fetcher that records every call and answers from a queue. */
function fetcher(...answers: SnapshotFetch[]) {
  const calls: string[] = [];
  return {
    calls,
    fetch: async (rsn: string) => {
      calls.push(rsn);
      const next = answers.shift();
      if (!next) throw new Error(`unexpected hiscores fetch for ${rsn}`);
      return next;
    },
  };
}

const always = async () => true;
const T0 = Date.parse('2026-10-15T12:00:00.000Z');

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ publicHiscoresCard } = await import('../src/lib/publicHiscoresCard.ts'));

  const [person] = await db.insert(s.players).values({ displayName: 'Someone' }).returning();
  await db.insert(s.accounts).values([
    { playerId: person.id, rsn: 'Quiet Iron', rsnNormalized: 'quiet iron', shared: false },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a private account gets the same public hiscores card as a stranger — nothing of the account', async () => {
  const f = fetcher(snapshot(10));
  const res = await publicHiscoresCard('quiet_IRON', { fetch: f.fetch, acquire: always, now: () => T0 });
  assert.equal(res.kind, 'card');
  if (res.kind !== 'card') return;
  // Indistinguishable from a name Anvil never saw: hiscores-sourced, no clan, no account type.
  assert.equal(res.card.source, 'hiscores');
  assert.equal(res.card.clan, null);
  assert.equal(res.card.accountType, null);
  await db.delete(s.publicHiscoresCache);
});

test('a stranger is fetched once, then served from cache until the TTL is up', async () => {
  const f = fetcher(snapshot(100), snapshot(250));

  const first = await publicHiscoresCard('Zezima', { fetch: f.fetch, acquire: always, now: () => T0 });
  assert.equal(first.kind, 'card');
  if (first.kind !== 'card') return;
  assert.equal(first.card.source, 'hiscores');
  assert.equal(first.card.fetchedAt, new Date(T0).toISOString());
  assert.equal(first.card.rsn, 'Zezima');
  assert.equal(first.card.clan, null);
  assert.equal(first.card.clog, null);
  assert.equal(first.card.totalLevel, 1500);
  assert.equal(first.card.overallXp, 50_000_000);
  assert.equal(first.card.bosses.find((b) => b.key === 'zulrah')?.kc, 100);
  assert.equal(f.calls.length, 1);

  // Inside the TTL: from cache, no fetch (and no budget taken).
  const never = async () => {
    throw new Error('budget consulted on a cache hit');
  };
  const again = await publicHiscoresCard('zezima', { fetch: f.fetch, acquire: never, now: () => T0 + 60_000 });
  assert.equal(again.kind, 'card');
  assert.equal(f.calls.length, 1, 'served from cache');

  // Past the TTL: fetched again, and the new numbers replace the old.
  const later = T0 + PUBLIC_HISCORES_TTL_MS.value + 1;
  const refreshed = await publicHiscoresCard('Zezima', { fetch: f.fetch, acquire: always, now: () => later });
  assert.equal(f.calls.length, 2, 'expired entry refetched');
  assert.equal(refreshed.kind === 'card' && refreshed.card.bosses.find((b) => b.key === 'zulrah')?.kc, 250);
  assert.equal(refreshed.kind === 'card' && refreshed.card.fetchedAt, new Date(later).toISOString());
});

test('over the global budget with nothing cached is busy; with a stale entry it serves the stale one', async () => {
  const f = fetcher();
  const over = async () => false;
  const busy = await publicHiscoresCard('Not Cached', { fetch: f.fetch, acquire: over, now: () => T0 });
  assert.equal(busy.kind, 'busy');

  const stale = await publicHiscoresCard('Zezima', { fetch: f.fetch, acquire: over, now: () => T0 + 10 * PUBLIC_HISCORES_TTL_MS.value });
  assert.equal(stale.kind, 'card');
  assert.equal(f.calls.length, 0);
});

test('a transient failure is not cached', async () => {
  const f = fetcher({ kind: 'transient' }, snapshot(5));
  const blip = await publicHiscoresCard('Flaky Guy', { fetch: f.fetch, acquire: always, now: () => T0 });
  assert.equal(blip.kind, 'busy');
  const retry = await publicHiscoresCard('Flaky Guy', { fetch: f.fetch, acquire: always, now: () => T0 + 1000 });
  assert.equal(retry.kind, 'card');
  assert.equal(f.calls.length, 2, 'the blip left nothing behind to serve');
});

test('not on the hiscores is cached as unranked for a day', async () => {
  const f = fetcher({ kind: 'unranked' }, { kind: 'unranked' });
  const miss = await publicHiscoresCard('Typo Name', { fetch: f.fetch, acquire: always, now: () => T0 });
  assert.equal(miss.kind, 'unranked');

  const soon = await publicHiscoresCard('Typo Name', { fetch: f.fetch, acquire: always, now: () => T0 + PUBLIC_HISCORES_TTL_MS.value * 2 });
  assert.equal(soon.kind, 'unranked');
  assert.equal(f.calls.length, 1, 'unranked outlives the value TTL');

  await publicHiscoresCard('Typo Name', { fetch: f.fetch, acquire: always, now: () => T0 + PUBLIC_HISCORES_TTL_MS.unranked + 1 });
  assert.equal(f.calls.length, 2, 'and is rechecked after a day');
});

test('a name the hiscores could never hold is unranked without a fetch', async () => {
  const f = fetcher();
  const res = await publicHiscoresCard('<script>', { fetch: f.fetch, acquire: always, now: () => T0 });
  assert.equal(res.kind, 'unranked');
  assert.equal(f.calls.length, 0);
});
