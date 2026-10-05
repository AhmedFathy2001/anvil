// Which event entry a plugin play credits: the LOGGED-IN CHARACTER's, never another character of the
// same person. Logged into an alt while the main is on a live board, verifyPluginToken used to hand
// back the main's entry — and the alt's drops, kills and XP landed on the main's team.
//
// Run: npx tsx --test tests/plugin-entry-per-character.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('entrypercharacter');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/auth.ts');
let mainEntry: number;

function play(rsn: string, hash: string) {
  return A.verifyPluginToken(
    new Request('https://example.test/api/plugin/config', {
      headers: { Authorization: 'Bearer tok-two', 'X-RSN': rsn, 'X-Account-Hash': hash, 'x-anvil-clan-slug': 'twoacc' },
    }),
  );
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  A = await import('../src/lib/auth.ts');
  const clanId = (await db.insert(s.clans).values({ slug: 'twoacc', name: 'Two Accounts' }).returning())[0].id;
  const person = (await db.insert(s.players).values({ displayName: 'Owner' }).returning())[0].id;
  await db.insert(s.users).values({ displayName: 'Owner', discordId: 'd-two', pluginToken: 'tok-two', playerId: person });
  const now = new Date().toISOString();
  const [main] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Mainy', rsnNormalized: 'mainy', accountHash: 'hash-main', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  const [alt] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Alty', rsnNormalized: 'alty', accountHash: 'hash-alt', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  const [mainSeat] = await db.insert(s.clanMemberships).values({ clanId, accountId: main.id, kind: 'member', source: 'roster' }).returning();
  await db.insert(s.clanMemberships).values({ clanId, accountId: alt.id, kind: 'guest', source: 'roster' });
  const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const eventId = (await db.insert(s.events).values({ clanId, name: 'Live', boardSize: 5, startDate: day(-1), endDate: day(5), tilesRevealed: 1 }).returning())[0].id;
  const teamId = (await db.insert(s.teams).values({ eventId, name: 'Team', color: '#fff' }).returning())[0].id;
  mainEntry = (await db.insert(s.eventParticipants).values({ eventId, clanMemberId: mainSeat.id, accountId: main.id, name: 'Mainy', teamId }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the main resolves to its own entry', async () => {
  const r = await play('Mainy', 'hash-main');
  assert.equal(r?.playerId, mainEntry);
});

test('the alt is not on the board, so nothing it does is credited anywhere', async () => {
  assert.equal(await play('Alty', 'hash-alt'), null);
});
