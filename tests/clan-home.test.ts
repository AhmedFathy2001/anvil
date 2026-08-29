// The public clan home read (lib/clanHome) — what a stranger sees at /c/<slug>. Also proves the
// 0076 profile columns migrate cleanly (the harness runs the whole chain into a fresh DB).
//
// Run: npx tsx --test tests/clan-home.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-home');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let publicClanHomeView: typeof import('../src/lib/clanHome.ts')['publicClanHomeView'];

let clanId: number;
let bareClanId: number;

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ publicClanHomeView } = await import('../src/lib/clanHome.ts'));

  // A fully-filled clan.
  const [clan] = await db
    .insert(s.clans)
    .values({
      slug: 'afkspot',
      name: 'The AFK Spot',
      tagline: 'Slow gains, good company.',
      description: 'A relaxed PvM + skilling clan.',
      focus: ['pvm', 'skilling'],
      recruiting: true,
      openToChallenges: true,
      requirements: { minTotal: 1500, region: 'EU' },
      ingameNameVerifiedAt: daysFromNow(-10),
    })
    .returning();
  clanId = clan.id;

  // Two members (member seats → active roster rows).
  for (const rsn of ['Drenvox', 'Solivar']) {
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' });
  }

  // Two events, one finished + one live.
  await db.insert(s.events).values({ clanId, name: 'Autumn Bingo', boardSize: 25, startDate: daysFromNow(-20), endDate: daysFromNow(-13) });
  await db.insert(s.events).values({ clanId, name: 'Winter Bingo', boardSize: 25, startDate: daysFromNow(-1), endDate: daysFromNow(5) });

  // A bare clan with nothing filled in — defaults must be safe.
  const [bare] = await db.insert(s.clans).values({ slug: 'newbies', name: 'Fresh Clan' }).returning();
  bareClanId = bare.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a filled clan reads back its whole public face', async () => {
  const v = (await publicClanHomeView(clanId, 'https://discord.gg/x'))!;
  assert.ok(v, 'view exists');
  assert.equal(v.name, 'The AFK Spot');
  assert.equal(v.tagline, 'Slow gains, good company.');
  assert.deepEqual(v.focus, ['pvm', 'skilling']);
  assert.equal(v.verified, true, 'ingameNameVerifiedAt → verified badge');
  assert.equal(v.recruiting, true);
  assert.equal(v.openToChallenges, true);
  assert.equal(v.requirements.minTotal, 1500);
  assert.equal(v.requirements.region, 'EU');
  assert.equal(v.memberCount, 2);
  assert.equal(v.eventsRun, 2);
  assert.equal(v.recentEvents.length, 2);
  assert.equal(v.recentEvents[0].name, 'Winter Bingo', 'most recent first');
  assert.equal(v.discordInvite, 'https://discord.gg/x');
});

test('a brand-new clan with nothing filled in has safe defaults', async () => {
  const v = (await publicClanHomeView(bareClanId))!;
  assert.equal(v.tagline, null);
  assert.deepEqual(v.focus, []);
  assert.deepEqual(v.requirements, {});
  assert.equal(v.verified, false);
  assert.equal(v.recruiting, false);
  assert.equal(v.memberCount, 0);
  assert.equal(v.eventsRun, 0);
  assert.equal(v.recentEvents.length, 0);
  assert.equal(v.discordInvite, null);
});

test('a missing clan is null, not a throw', async () => {
  assert.equal(await publicClanHomeView(999999), null);
});
