// Clans measured against each other.
//
// The first surface that only makes sense because clans share a platform, and the one where being
// quietly wrong is easiest: a leaderboard that double-counts, or counts the wrong people, still
// renders and still looks like a leaderboard. So the tests here are mostly about EXCLUSION.
//
// Two rules do the work:
//
//   an account holds ONE member seat, so "which clan does this XP count for" has one answer. Before
//   S5, a player mid-transfer was claimed by two clans and counted twice.
//
//   a GUEST's gains belong to the clan they are a member of, not the one whose event they visited.
//   Otherwise hosting a popular open event inflates your standing using other clans' members.
//
// Run: npm run test:leaderboard

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-leaderboard');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let L: typeof import('../src/lib/clanLeaderboard.ts');

let verifiedA: number;
let verifiedB: number;
let unverified: number;
let hidden: number;

const today = new Date().toISOString().slice(0, 10);

async function gainer(clanId: number | null, rsn: string, xp: number, opts: { kind?: 'member' | 'guest'; shared?: boolean } = {}) {
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({
      playerId: pl.id,
      rsn,
      rsnNormalized: rsn.toLowerCase(),
      shared: opts.shared ?? false,
    })
    .returning();
  if (clanId != null) {
    await db.insert(s.clanMemberships).values({
      clanId,
      accountId: acct.id,
      kind: opts.kind ?? 'member',
      source: 'roster',
    });
  }
  await db.insert(s.memberDailyStats).values({
    accountId: acct.id,
    day: today,
    overallXp: xp,
    xpGained: xp,
    ehpMilliGained: 1000,
  });
  return acct.id;
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  L = await import('../src/lib/clanLeaderboard.ts');

  const stamp = new Date().toISOString();
  const rows = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC', ingameNameVerifiedAt: stamp },
      { slug: 'bravo', name: 'Bravo', inGameName: 'Bravo CC', ingameNameVerifiedAt: stamp },
      { slug: 'nobadge', name: 'No Badge', inGameName: 'Unproven' },
      { slug: 'shy', name: 'Shy Clan', inGameName: 'Shy CC', ingameNameVerifiedAt: stamp },
    ])
    .returning();
  [verifiedA, verifiedB, unverified, hidden] = rows.map((c) => c.id);

  // The shy clan opted out of being listed — the same switch the directory reads.
  await db.insert(s.settings).values({ clanId: hidden, key: 'public_showcase', value: 'off' });

  await gainer(verifiedA, 'Alpha One', 1_000_000, { shared: true });
  await gainer(verifiedA, 'Alpha Two', 500_000);
  await gainer(verifiedB, 'Bravo One', 400_000, { shared: true });
  await gainer(unverified, 'Ghost', 9_000_000, { shared: true });
  await gainer(hidden, 'Shy One', 8_000_000);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Who appears ───────────────────────────────────────────────────────────────────────────────

test('only verified clans are ranked', async () => {
  // The badge is load-bearing here, not decorative: an unverified clan can claim any name, and a
  // leaderboard is exactly where a claimed name would do damage.
  const table = await L.clanStandings('7d');
  const slugs = table.map((r) => r.slug);
  assert.ok(slugs.includes('alpha'));
  assert.equal(slugs.includes('nobadge'), false, 'unverified, despite having the most XP');
});

test('a clan that opted out of being listed is not ranked either', async () => {
  const table = await L.clanStandings('7d');
  assert.equal(table.some((r) => r.slug === 'shy'), false);
});

test('the table is ordered by what it claims to measure', async () => {
  const table = await L.clanStandings('7d');
  assert.deepEqual(table.map((r) => r.slug), ['alpha', 'bravo']);
  assert.equal(table[0].xpGained, 1_500_000, 'both of alpha’s members');
});

// ── What counts ───────────────────────────────────────────────────────────────────────────────

test('a guest’s gains belong to their own clan, not the one hosting them', async () => {
  // Otherwise hosting a popular open event inflates your standing with other clans' members.
  const { db, schema: s } = await loadDb();
  const before = (await L.clanStandings('7d')).find((r) => r.slug === 'bravo')!.xpGained;

  const acct = await db
    .select({ id: s.accounts.id })
    .from(s.accounts)
    .where(eq(s.accounts.rsnNormalized, 'alpha one'));
  await db
    .insert(s.clanMemberships)
    .values({ clanId: verifiedB, accountId: acct[0].id, kind: 'guest', source: 'application' });

  const after = (await L.clanStandings('7d')).find((r) => r.slug === 'bravo')!.xpGained;
  assert.equal(after, before, 'a visitor adds nothing to the host');
});

test('and the same person is still counted exactly once, for their own clan', async () => {
  const table = await L.clanStandings('7d');
  const alpha = table.find((r) => r.slug === 'alpha')!;
  assert.equal(alpha.xpGained, 1_500_000, 'not doubled by the guest seat elsewhere');
});

test('a departed member stops counting', async () => {
  const { db, schema: s } = await loadDb();
  const acct = await db
    .select({ id: s.accounts.id })
    .from(s.accounts)
    .where(eq(s.accounts.rsnNormalized, 'alpha two'));
  await db
    .update(s.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(s.clanMemberships.accountId, acct[0].id));

  const alpha = (await L.clanStandings('7d')).find((r) => r.slug === 'alpha')!;
  assert.equal(alpha.xpGained, 1_000_000, 'their gains left with them');

  await db
    .update(s.clanMemberships)
    .set({ leftAt: null })
    .where(eq(s.clanMemberships.accountId, acct[0].id));
});

test('roster size is not multiplied by the number of daily rows', async () => {
  // The classic way to get a plausible wrong number: fold the count into the same aggregate as the
  // joined stat rows. Alpha has two members and two stat rows; a broken version says four.
  const alpha = (await L.clanStandings('7d')).find((r) => r.slug === 'alpha')!;
  assert.equal(alpha.members, 2);
  assert.equal(alpha.actives, 2);
});

test('a clan with members but no gains still appears, at zero', async () => {
  // A quiet clan is not an absent one — dropping it would make the table look like a list of who is
  // playing rather than who is here.
  const { db, schema: s } = await loadDb();
  const stamp = new Date().toISOString();
  const [quiet] = await db
    .insert(s.clans)
    .values({ slug: 'quiet', name: 'Quiet', inGameName: 'Quiet CC', ingameNameVerifiedAt: stamp })
    .returning();
  const [pl] = await db.insert(s.players).values({ displayName: 'Idle' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'Idle', rsnNormalized: 'idle' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: quiet.id, accountId: acct.id, kind: 'member', source: 'roster' });

  const row = (await L.clanStandings('7d')).find((r) => r.slug === 'quiet');
  assert.ok(row, 'listed');
  assert.equal(row!.xpGained, 0);
  assert.equal(row!.actives, 0);
  assert.equal(row!.members, 1);
});

// ── Players ───────────────────────────────────────────────────────────────────────────────────

test('only shared accounts are named in the player table', async () => {
  // The apex holds no seats, so the visibility rule reduces to sharing. A cross-clan table is not a
  // way around a privacy setting.
  const players = await L.topPlayers('7d');
  const names = players.map((p) => p.rsn);
  assert.ok(names.includes('Alpha One'), 'shared');
  assert.equal(names.includes('Alpha Two'), false, 'not shared, so not named');
});

test('an unshared player still counts towards their clan’s total', async () => {
  // Which is the point: private about yourself, still part of your clan.
  const alpha = (await L.clanStandings('7d')).find((r) => r.slug === 'alpha')!;
  assert.equal(alpha.xpGained, 1_500_000, 'includes the unshared member');
});

test('a shared player in an unlisted clan is named without their clan being ranked', async () => {
  // Sharing is the person's decision; listing is the clan's. Neither overrides the other.
  const players = await L.topPlayers('7d');
  const ghost = players.find((p) => p.rsn === 'Ghost');
  assert.ok(ghost, 'their own choice to be visible stands');
  assert.equal((await L.clanStandings('7d')).some((r) => r.slug === 'nobadge'), false);
});
