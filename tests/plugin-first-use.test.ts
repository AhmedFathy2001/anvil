// Trust on first plugin use.
//
// A roster member nobody has ever linked used to be unreachable from the plugin: the RSN alone is not
// proof, so the takeover gate turned the play into a suggestion and staff had to merge or approve by
// hand. Now the first Discord login whose plugin plays it (with a client hash) claims it PROVISIONALLY
// — live at once, and sitting on the staff review queue until a mod confirms or rejects.
//
// Run: npx tsx --test tests/plugin-first-use.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-first-use');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let clanId: number;
let n = 0;

/** A Discord login with a plugin token, and a roster member (synced, never linked) to play. */
async function setup(rsn: string, seat: Partial<typeof s.clanMemberships.$inferInsert> = {}) {
  n++;
  const token = `tok-${n}`;
  const [me] = await db.insert(s.players).values({ displayName: `discord-${n}` }).returning();
  const [login] = await db
    .insert(s.users)
    .values({ displayName: `discord-${n}`, discordId: `d-${n}`, pluginToken: token, playerId: me.id })
    .returning();
  const [ghost] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: ghost.id, rsn, rsnNormalized: rsn.toLowerCase() })
    .returning();
  const [row] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: acct.id, kind: 'member', source: 'roster', rank: 'general', ...seat })
    .returning();
  return { token, person: me.id, login: login.id, accountId: acct.id, seatId: row.id };
}

function play(token: string, rsn: string, hash: string | null, slug: string | null = 'afk') {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-RSN': rsn,
  };
  if (slug) headers['x-anvil-clan-slug'] = slug;
  if (hash) headers['X-Account-Hash'] = hash;
  return A.resolvePluginMember(new Request('https://example.test/api/plugin/config', { headers }));
}

const account = async (id: number) => (await db.select().from(s.accounts).where(eq(s.accounts.id, id)))[0];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot', inGameName: 'AFK' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('first plugin play claims the synced member, provisionally, and anchors the hash', async () => {
  const me = await setup('Synced One');
  const resolved = await play(me.token, 'Synced One', 'hash-1');
  assert.equal(resolved?.clanMemberId, me.seatId, 'resolves straight to their roster seat');

  const acct = await account(me.accountId);
  assert.equal(acct.playerId, me.person);
  assert.ok(acct.claimedAt);
  assert.equal(acct.provisional, 1, 'on the review queue');
  assert.equal(acct.verificationMethod, 'plugin_first_use');
  assert.equal(acct.accountHash, 'hash-1');

  const [seat] = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.id, me.seatId));
  assert.equal(seat.source, 'roster', 'still the roster’s seat');
  assert.equal(seat.kind, 'member');
});

test('playing again does not clear it off the review queue', async () => {
  const me = await setup('Synced Two');
  await play(me.token, 'Synced Two', 'hash-2');
  await play(me.token, 'Synced Two', 'hash-2');
  const acct = await account(me.accountId);
  assert.equal(acct.provisional, 1);
  assert.equal(acct.verificationMethod, 'plugin_first_use');
});

test('no client hash, no claim — just a suggestion', async () => {
  const me = await setup('No Hash');
  await play(me.token, 'No Hash', null);
  assert.equal((await account(me.accountId)).claimedAt, null);
});

test('a seat carrying a pending role stays gated', async () => {
  const me = await setup('Future Mod', { pendingRole: 'moderator' });
  await play(me.token, 'Future Mod', 'hash-3');
  assert.equal((await account(me.accountId)).claimedAt, null);
});

test('a dismissed suggestion (e.g. staff rejected them) blocks the re-claim', async () => {
  const me = await setup('Rejected');
  await db.insert(s.detectedAccounts).values({
    userId: me.login, rsn: 'Rejected', rsnNormalized: 'rejected', status: 'dismissed',
    detectedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  });
  await play(me.token, 'Rejected', 'hash-4');
  assert.equal((await account(me.accountId)).claimedAt, null);
});

test('on the apex (no clan in the address) a brand-new login still claims — the roster names the clan', async () => {
  // The common case: someone makes a Discord account and points the plugin at anvilosrs.com. They own
  // no seat, so the token names no clan; before, that returned before the claim could ever run.
  const me = await setup('Apex Newbie');
  const resolved = await play(me.token, 'Apex Newbie', 'hash-5', null);
  assert.equal(resolved?.clanMemberId, me.seatId);
  const acct = await account(me.accountId);
  assert.equal(acct.playerId, me.person);
  assert.equal(acct.provisional, 1);
});
