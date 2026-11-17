// A person who came in without the plugin signs in to it later.
//
// Someone who asked staff to vouch (held) or passed the XP check (flagged) and then plays the same
// character with the plugin signed in becomes plugin-proven: the SAME character row and the SAME
// seat, no duplicate, the flags cleared, and whatever was held for them completed.
//
// Run: npm run test:pluginupgrade

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';
import { callRoute } from './helpers/routeCall.ts';

const DB = useTestDatabase('plugin-upgrade');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let manualRoute: typeof import('../src/app/api/auth/request-manual-review/route.ts');
let signupRoute: typeof import('../src/app/api/events/[eventId]/signup/route.ts');
let clanId: number;
let n = 0;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

async function login() {
  n++;
  const token = `tok-up-${n}`;
  const [p] = await db.insert(s.players).values({ displayName: `discord-${n}` }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ displayName: `discord-${n}`, discordId: `88${String(n).padStart(15, '0')}`, pluginTokenHash: tokenHash(token), playerId: p.id })
    .returning();
  return { token, playerId: p.id, userId: u.id };
}

/** One plugin poll: the token, the name the client is logged in as, its account hash. */
function play(token: string, rsn: string, hash: string, slug: string | null = null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-RSN': rsn, 'X-Account-Hash': hash };
  if (slug) Object.assign(headers, clanHeaders(slug));
  return A.resolvePluginMember(new Request('https://example.test/api/plugin/config', { headers }));
}

const accountsNamed = (rsn: string) => db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, rsn.toLowerCase()));
const seatsOf = (accountId: number) => db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, accountId));

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  manualRoute = await import('../src/app/api/auth/request-manual-review/route.ts');
  signupRoute = await import('../src/app/api/events/[eventId]/signup/route.ts');
  // Guests let in freely: asking staff to vouch seats the person here (held), which is the state these
  // tests upgrade from. Where guests need approval there is no seat to upgrade (tests/admission-tiers).
  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Iron Forge', inGameName: 'Iron Forge', guestPolicy: 'open' }).returning();
  clanId = clan.id;
});

after(async () => {
  await new Promise((r) => setTimeout(r, 500));
  await pool.end();
  await dropDatabase(DB);
});

test('asked staff to vouch, then signs in to the plugin: same character, same seat, confirmed, held entry completed', async () => {
  const me = await login();
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Held Bingo', boardSize: 25, startDate: day(5), endDate: day(9) }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Dragons', color: '#a00' }).returning();
  const [plain] = await db.insert(s.events).values({ clanId, name: 'Plain Bingo', boardSize: 25, startDate: day(5), endDate: day(9) }).returning();
  await db.insert(s.teamInvites).values({ token: 'abcdefghijkmnopq', teamId: team.id, eventId: ev.id });

  const asked = await callRoute(manualRoute.POST, { userId: me.userId, body: { rsn: 'Late Plugin', clan: '/c/forge' } });
  assert.equal(asked.status, 200, JSON.stringify(asked.json));
  const [before] = await accountsNamed('Late Plugin');
  const [seat] = await seatsOf(before.id);
  assert.equal(seat.kind, 'guest');
  for (const [eventId, inviteToken] of [[ev.id, 'abcdefghijkmnopq'], [plain.id, undefined]] as const) {
    const r = await callRoute(signupRoute.POST, { userId: me.userId, slug: 'forge', params: { eventId: String(eventId) }, body: { clanMemberIds: [seat.id], inviteToken } });
    assert.equal(r.json.held, true, JSON.stringify(r.json));
  }

  // The plugin's first report after signing in: no clan in the address, the token finds it.
  const resolved = await play(me.token, 'Late Plugin', 'hash-late');
  assert.equal(resolved?.clanMemberId, seat.id, 'resolves to the seat they already had');
  assert.equal(resolved?.accountId, before.id);

  const rows = await accountsNamed('Late Plugin');
  assert.equal(rows.length, 1, 'no second character row');
  const acct = rows[0];
  assert.equal(acct.id, before.id);
  assert.equal(acct.playerId, me.playerId);
  assert.ok(acct.verifiedAt, 'no longer awaiting staff');
  assert.equal(acct.provisional, 0, 'no longer in Needs review');
  assert.equal(acct.verificationMethod, 'plugin');
  assert.equal(acct.accountHash, 'hash-late');
  const { tierOf } = await import('../src/lib/characterState.ts');
  assert.equal(tierOf(acct), 'plugin');

  const seats = await seatsOf(acct.id);
  assert.equal(seats.length, 1, 'no second seat');
  assert.equal(seats[0].id, seat.id);

  const signups = await db.select().from(s.eventSignups).where(eq(s.eventSignups.userId, me.userId));
  assert.equal(signups.find((x) => x.eventId === ev.id)?.status, 'approved', 'the invited entry is approved');
  assert.equal(signups.find((x) => x.eventId === plain.id)?.status, 'pending', 'the plain one waits for the host');
  const [onBoard] = await db.select().from(s.eventParticipants).where(and(eq(s.eventParticipants.eventId, ev.id), eq(s.eventParticipants.accountId, acct.id)));
  assert.equal(onBoard.teamId, team.id);
  const told = await db.select().from(s.userNotices).where(eq(s.userNotices.userId, me.userId));
  assert.equal(told.length, 1);
  assert.match(told[0].title, /Late Plugin is confirmed by the plugin/);

  // Playing again changes nothing and tells nobody twice.
  await play(me.token, 'Late Plugin', 'hash-late');
  assert.equal((await db.select().from(s.userNotices).where(eq(s.userNotices.userId, me.userId))).length, 1);
  assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, 'abcdefghijkmnopq')))[0].uses, 1);
});

test('passed the XP check, then signs in to the plugin: the review flag clears on the same row and seat', async () => {
  const me = await login();
  const now = new Date().toISOString();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: me.playerId, rsn: 'Xp First', rsnNormalized: 'xp first', claimedAt: now, verifiedAt: now, provisional: 1, verificationMethod: 'stat_delta', isPrimary: 1 })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'guest', source: 'application' }).returning();

  const resolved = await play(me.token, 'Xp First', 'hash-xp');
  assert.equal(resolved?.clanMemberId, seat.id);
  const [acct] = await accountsNamed('Xp First');
  assert.equal(acct.provisional, 0);
  assert.equal(acct.verificationMethod, 'plugin');
  assert.equal(acct.accountHash, 'hash-xp');
  assert.equal(acct.verifiedAt, now, 'the first proof’s date is kept');
  assert.equal((await seatsOf(acct.id)).length, 1);
});

test('passed the XP check with no clan at all, then signs in to the plugin: upgraded, still no seat', async () => {
  const me = await login();
  const now = new Date().toISOString();
  await db
    .insert(s.accounts)
    .values({ playerId: me.playerId, rsn: 'Xp Clanless', rsnNormalized: 'xp clanless', claimedAt: now, verifiedAt: now, provisional: 1, verificationMethod: 'stat_delta', isPrimary: 1 });

  assert.equal(await play(me.token, 'Xp Clanless', 'hash-clanless'), null, 'no clan, so no seat to resolve');
  const rows = await accountsNamed('Xp Clanless');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].provisional, 0);
  assert.equal(rows[0].verificationMethod, 'plugin');
  assert.equal(rows[0].accountHash, 'hash-clanless');
  assert.equal((await seatsOf(rows[0].id)).length, 0);
});

test('the plugin does not upgrade somebody ELSE’S XP-checked character by reporting its name', async () => {
  const owner = await login();
  const other = await login();
  const now = new Date().toISOString();
  await db
    .insert(s.accounts)
    .values({ playerId: owner.playerId, rsn: 'Not Yours', rsnNormalized: 'not yours', claimedAt: now, verifiedAt: now, provisional: 1, verificationMethod: 'stat_delta', isPrimary: 1 });
  await play(other.token, 'Not Yours', 'hash-forged');
  const [acct] = await accountsNamed('Not Yours');
  assert.equal(acct.playerId, owner.playerId);
  assert.equal(acct.provisional, 1);
  assert.equal(acct.verificationMethod, 'stat_delta');
  assert.equal(acct.accountHash, null);
});

test('asked staff, then the in-game list named the character: the plugin confirms it on the member seat the list gave', async () => {
  const me = await login();
  await callRoute(manualRoute.POST, { userId: me.userId, body: { rsn: 'Now Listed', clan: '/c/forge' } });
  const [before] = await accountsNamed('Now Listed');
  const [seat] = await seatsOf(before.id);
  // What the next roster sync does to a seat whose character the in-game list names (the same row
  // promoted; membership is only ever the list's word).
  await db.update(s.clanMemberships).set({ kind: 'member', source: 'roster', rank: 'recruit' }).where(eq(s.clanMemberships.id, seat.id));

  const resolved = await play(me.token, 'Now Listed', 'hash-listed');
  assert.equal(resolved?.clanMemberId, seat.id);
  const [acct] = await accountsNamed('Now Listed');
  assert.ok(acct.verifiedAt);
  assert.equal(acct.provisional, 0);
  const seats = await seatsOf(acct.id);
  assert.equal(seats.length, 1);
  assert.equal(seats[0].kind, 'member');
});
