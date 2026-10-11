// The launcher hint (X-RSN-Hint): at the login screen the plugin knows which character the Jagex
// Launcher is about to log in, but nothing has proved it. The hint may pick which of the person's OWN
// characters a read is about, and must never do the claim/link/verify work a played X-RSN does.
//
// Run: npx tsx --test tests/plugin-rsn-hint.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-rsn-hint');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let mainEntry: number;
let eventIdLive: number;
let mainId: number;
let syncedId: number;

function req(headers: Record<string, string>) {
  return new Request('https://example.test/api/plugin/config', {
    headers: { Authorization: 'Bearer tok-hint', 'x-anvil-clan-slug': 'hint', ...headers },
  });
}

const account = async (id: number) => (await db.select().from(s.accounts).where(eq(s.accounts.id, id)))[0];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  const clanId = (await db.insert(s.clans).values({ slug: 'hint', name: 'Hint Clan' }).returning())[0].id;
  const person = (await db.insert(s.players).values({ displayName: 'Owner' }).returning())[0].id;
  await db.insert(s.users).values({ displayName: 'Owner', discordId: 'd-hint', pluginToken: 'tok-hint', playerId: person });
  const now = new Date().toISOString();

  // Theirs, claimed but not yet verified or hash-anchored — exactly what a played X-RSN would upgrade.
  const [main] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Main Guy', rsnNormalized: 'main guy', claimedAt: now })
    .returning();
  mainId = main.id;
  const [mainSeat] = await db.insert(s.clanMemberships).values({ clanId, accountId: main.id, kind: 'member', source: 'roster' }).returning();

  // A synced roster member nobody has claimed — the first-use claim's target.
  const ghost = (await db.insert(s.players).values({ displayName: 'Synced Guy' }).returning())[0].id;
  const [synced] = await db.insert(s.accounts).values({ playerId: ghost, rsn: 'Synced Guy', rsnNormalized: 'synced guy' }).returning();
  syncedId = synced.id;
  await db.insert(s.clanMemberships).values({ clanId, accountId: synced.id, kind: 'member', source: 'roster' });

  const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const eventId = (await db.insert(s.events).values({ clanId, name: 'Live', boardSize: 5, startDate: day(-1), endDate: day(5), tilesRevealed: 1 }).returning())[0].id;
  eventIdLive = eventId;
  const teamId = (await db.insert(s.teams).values({ eventId, name: 'Team', color: '#fff' }).returning())[0].id;
  mainEntry = (await db.insert(s.eventParticipants).values({ eventId, clanMemberId: mainSeat.id, accountId: main.id, name: 'Main Guy', teamId }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the hint resolves their own character to its live entry', async () => {
  const r = await A.verifyPluginToken(req({ 'X-RSN-Hint': 'Main Guy' }), { hintOnly: true });
  assert.equal(r?.playerId, mainEntry);
});

test('the hint writes nothing: no verify, no hash anchor', async () => {
  await A.verifyPluginToken(req({ 'X-RSN-Hint': 'Main Guy', 'X-Account-Hash': 'hash-main' }), { hintOnly: true });
  const acct = await account(mainId);
  assert.equal(acct.verifiedAt, null);
  assert.equal(acct.accountHash, null);
});

test('the hint cannot claim an unclaimed synced member', async () => {
  assert.equal(await A.verifyPluginToken(req({ 'X-RSN-Hint': 'Synced Guy' }), { hintOnly: true }), null);
  const acct = await account(syncedId);
  assert.equal(acct.claimedAt, null);
  assert.notEqual(acct.verificationMethod, 'plugin_first_use');
});

test('without hint mode the hint header is not an RSN', async () => {
  assert.equal(await A.verifyPluginToken(req({ 'X-RSN-Hint': 'Main Guy' })), null);
});

test('a played RSN outranks the hint', () => {
  assert.equal(A.pluginRsnHintOnly(req({ 'X-RSN-Hint': 'Main Guy' })), true);
  assert.equal(A.pluginRsnHintOnly(req({ 'X-RSN': 'Main Guy', 'X-RSN-Hint': 'Other' })), false);
  assert.equal(A.pluginViewerRsn(req({ 'X-RSN': 'Main Guy', 'X-RSN-Hint': 'Other' })), 'Main Guy');
  assert.equal(A.pluginViewerRsn(req({ 'X-RSN-Hint': 'Other' })), 'Other');
});

test('the named-board read takes the hint, and the claim write does not', async () => {
  const read = await A.verifyPluginTokenForEvent(req({ 'X-RSN-Hint': 'Main Guy' }), eventIdLive, { hintOnly: true });
  assert.equal(read?.playerId, mainEntry);
  // Claims call it without opts — a hint alone identifies nobody there.
  assert.equal(await A.verifyPluginTokenForEvent(req({ 'X-RSN-Hint': 'Main Guy' }), eventIdLive), null);
});
