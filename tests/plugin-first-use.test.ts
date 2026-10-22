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

test('first plugin play also links a member staff added before their Discord login', async () => {
  const me = await setup('Admin Added', { source: 'admin' });
  const resolved = await play(me.token, 'Admin Added', 'hash-admin-added');
  assert.equal(resolved?.clanMemberId, me.seatId, 'the existing staff-created seat resolves immediately');

  const acct = await account(me.accountId);
  assert.equal(acct.playerId, me.person, 'the RuneLite account is attached to the Discord person');
  assert.equal(acct.provisional, 1, 'staff can still review the first-use association');
  assert.equal(acct.verificationMethod, 'plugin_first_use');
  assert.equal(acct.accountHash, 'hash-admin-added');

  const [seat] = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.id, me.seatId));
  assert.equal(seat.source, 'admin', 'linking identity does not rewrite how membership was granted');
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

test('the real config endpoint claims before it asks the token which clan it belongs to', async () => {
  // This is the production deadlock the resolvePluginMember unit path did not cover. /config used to
  // ask resolvePluginClan first; a new Discord person owns no seat until resolvePluginMember claims
  // this roster row, so the route returned 404 before the claim code could ever run.
  const me = await setup('Cfg Newbie');
  const { GET } = await import('../src/app/api/plugin/config/route.ts');
  const response = await GET(
    new Request('https://anvilosrs.com/api/plugin/config', {
      headers: {
        Authorization: `Bearer ${me.token}`,
        'X-RSN': 'Cfg Newbie',
        'X-Account-Hash': 'hash-config',
      },
    }),
  );

  assert.equal(response.status, 200, await response.text());
  const acct = await account(me.accountId);
  assert.equal(acct.playerId, me.person, 'the config request performed the claim');
  assert.equal(acct.accountHash, 'hash-config');
  assert.ok(acct.claimedAt);
});

test('an XP-verified account can later connect RuneLite and gain its tracking anchor', async () => {
  const me = await setup('XP Then Plug');
  const { claimAccountForPerson } = await import('../src/lib/accountClaim.ts');
  const proof = await claimAccountForPerson({
    playerId: me.person,
    rsn: 'XP Then Plug',
    rsnNormalized: 'xp then plug',
    method: 'stat_delta',
    provisional: false,
    actorUserId: me.login,
  });
  assert.ok(proof.ok, JSON.stringify(proof));

  const before = await account(me.accountId);
  assert.equal(before.verificationMethod, 'stat_delta');
  assert.equal(before.accountHash, null);

  const resolved = await play(me.token, 'XP Then Plug', 'hash-after-xp');
  assert.equal(resolved?.clanMemberId, me.seatId);
  const after = await account(me.accountId);
  assert.equal(after.verificationMethod, 'plugin');
  assert.equal(after.accountHash, 'hash-after-xp');
  assert.equal(after.provisional, 0);
  assert.ok(after.verifiedAt);
});

// No clan anywhere — sign in, play, join a clan later (or never). Nothing used to record the play.
async function clanlessLogin() {
  n++;
  const token = `tok-${n}`;
  const [me] = await db.insert(s.players).values({ displayName: `discord-${n}` }).returning();
  await db.insert(s.users).values({ displayName: `discord-${n}`, discordId: `d-${n}`, pluginToken: token, playerId: me.id });
  return { token, person: me.id };
}
const accountByRsn = async (rsn: string) =>
  (await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, rsn.toLowerCase())))[0];

test('clanless: a brand-new character links to the person on first play, provisionally, with no seat', async () => {
  const me = await clanlessLogin();
  const resolved = await play(me.token, 'Fresh Face', 'hash-fresh', null);
  assert.equal(resolved, null, 'still no member — there is no clan to resolve against');
  const acct = await accountByRsn('Fresh Face');
  assert.equal(acct?.playerId, me.person);
  assert.ok(acct.claimedAt);
  assert.equal(acct.provisional, 1);
  assert.equal(acct.verificationMethod, 'plugin_first_use');
  assert.equal(acct.accountHash, 'hash-fresh');
  const seats = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, acct.id));
  assert.equal(seats.length, 0);
});

test('clanless: no client hash, no link', async () => {
  const me = await clanlessLogin();
  await play(me.token, 'Hashless Hal', null, null);
  assert.equal(await accountByRsn('Hashless Hal'), undefined);
});

test('clanless: a character someone else owns is left alone', async () => {
  const owner = await clanlessLogin();
  await play(owner.token, 'Taken Tom', 'hash-tom', null);
  const other = await clanlessLogin();
  await play(other.token, 'Taken Tom', 'hash-other', null);
  assert.equal((await accountByRsn('Taken Tom')).playerId, owner.person);
});

test('clanless: a character with roster history is not linked on a name', async () => {
  // Departed from the AFK roster: the token names no clan and the roster fallback only takes LIVE
  // unclaimed seats, so this reaches the clanless path — which must still refuse it.
  const seat = await setup('Old Member', { leftAt: new Date().toISOString() });
  const me = await clanlessLogin();
  await play(me.token, 'Old Member', 'hash-old', null);
  assert.notEqual((await account(seat.accountId)).playerId, me.person);
  assert.equal((await account(seat.accountId)).claimedAt, null);
});

test('clanless: a released ("Not my account") character stays released', async () => {
  const me = await clanlessLogin();
  const [login] = await db.select().from(s.users).where(eq(s.users.pluginToken, me.token));
  await db.insert(s.detectedAccounts).values({
    userId: login.id, rsn: 'Sibling Sam', rsnNormalized: 'sibling sam', status: 'dismissed',
    detectedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  });
  await play(me.token, 'Sibling Sam', 'hash-sam', null);
  assert.equal(await accountByRsn('Sibling Sam'), undefined);
});

test('one person cannot squat a roster: past two unconfirmed first-use claims it becomes a suggestion', async () => {
  const me = await setup('Squat One');
  assert.ok(await play(me.token, 'Squat One', 'hash-sq-1'));
  // Two more roster members, same login.
  const extra = async (rsn: string) => {
    const [ghost] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [acct] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member', source: 'roster', rank: 'general' });
    return acct.id;
  };
  const second = await extra('Squat Two');
  const third = await extra('Squat Three');
  await play(me.token, 'Squat Two', 'hash-sq-2');
  await play(me.token, 'Squat Three', 'hash-sq-3');

  assert.equal((await account(second)).playerId, me.person, 'a second character still claims');
  const thirdAcct = await account(third);
  assert.notEqual(thirdAcct.playerId, me.person, 'the third waits for proof');
  assert.equal(thirdAcct.claimedAt, null);
  const [suggestion] = await db
    .select()
    .from(s.detectedAccounts)
    .where(eq(s.detectedAccounts.rsnNormalized, 'squat three'));
  assert.equal(suggestion?.status, 'pending', 'it lands as an opt-in suggestion instead');
});

test('a token stored only as its hash still authenticates (the plain column is going away)', async () => {
  const [p] = await db.insert(s.players).values({ displayName: 'hash-only' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'hash-only', discordId: 'd-hash-only', playerId: p.id, pluginTokenHash: A.hashPluginToken('secret-tok') })
    .returning();
  const req = (t: string) => new Request('https://example.test/api/plugin/me', { headers: { Authorization: `Bearer ${t}` } });
  assert.deepEqual(await A.verifyPluginTokenUser(req('secret-tok')), { userId: u.id });
  assert.equal(await A.verifyPluginTokenUser(req('wrong-tok')), null);
  assert.equal(await A.verifyPluginTokenUser(req(A.hashPluginToken('secret-tok'))), null, 'the hash itself is not a token');
});
