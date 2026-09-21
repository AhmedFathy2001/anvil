// Somebody the in-game roster dropped, who is still playing.
//
// Two paths put a seat back, and they exist for the same reason: leaving the clan chat is not
// leaving the site. The clan still holds their history, their plugin may still be pointed here, and
// marking them gone deleted them from every clan surface while they carried on playing — which is
// how a person in the clan's Discord, turning up on its boards every day, became invisible to it.
//
// This file drives the PLAY path end to end, because that is the one that heals a seat already
// marked gone. The sync half is a pure rule (lib/rosterSync.departureFor) and is tested beside the
// rest of the roster diff.
//
// MEMBERSHIP IS NOT WHAT COMES BACK. A guest is what returns — the in-game roster remains the only
// thing that makes a member, which is the property the last two tests hold down.
//
// Run: npm run test:leaverguest

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('leaver-stays-guest');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');

let clanId: number;
let otherClanId: number;
const TOKEN = 'test-token-leaver-guest';
const RSN = 'IMPURITY';

/** A plugin request as middleware hands it on: the token, the character, and the clan by slug. */
const play = (slug: string, rsn = RSN, token = TOKEN) =>
  new Request('https://example.test/api/plugin/config', {
    headers: { Authorization: `Bearer ${token}`, 'X-RSN': rsn, 'x-anvil-clan-slug': slug },
  });

const seatIn = async (clan: number, rsn: string) => {
  const [row] = await db
    .select({
      id: s.clanMemberships.id,
      kind: s.clanMemberships.kind,
      leftAt: s.clanMemberships.leftAt,
      source: s.clanMemberships.source,
      lastSeenInClan: s.clanMemberships.lastSeenInClan,
    })
    .from(s.clanMemberships)
    .innerJoin(s.accounts, eq(s.accounts.id, s.clanMemberships.accountId))
    .where(and(eq(s.clanMemberships.clanId, clan), eq(s.accounts.rsnNormalized, rsn.toLowerCase())));
  return row;
};

/** A character owned by `playerId`, seated in `clan` exactly as described. */
async function character(
  playerId: number,
  rsn: string,
  seat?: { clan: number; kind: 'member' | 'guest'; source?: string; left?: boolean },
) {
  const [acct] = await db
    .insert(s.accounts)
    .values({
      playerId,
      rsn,
      rsnNormalized: rsn.toLowerCase(),
      claimedAt: new Date('2024-01-01').toISOString(),
      verifiedAt: new Date('2024-01-01').toISOString(),
    })
    .returning();
  if (seat) {
    await db.insert(s.clanMemberships).values({
      clanId: seat.clan,
      accountId: acct.id,
      kind: seat.kind,
      source: seat.source ?? 'roster',
      leftAt: seat.left ? new Date('2025-06-01').toISOString() : null,
    });
  }
  return acct.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'afk', name: 'The AFK Spot', inGameName: 'AFK Spot' },
      { slug: 'lfl', name: 'LFL', inGameName: 'LFL' },
    ])
    .returning();
  [clanId, otherClanId] = clans.map((c) => c.id);

  const [person] = await db.insert(s.players).values({ displayName: 'tolleybt' }).returning();
  await db
    .insert(s.users)
    .values({ displayName: 'tolleybt', discordId: 'disc-leaver', pluginToken: TOKEN, playerId: person.id })
    .returning();

  // The case from production: a member the roster dropped months ago, still played every day.
  await character(person.id, RSN, { clan: clanId, kind: 'member', left: true });
  // A live member, to prove a seat that is fine is left alone.
  await character(person.id, 'DEXTERITY', { clan: clanId, kind: 'member' });
  // A seat an admin ended by hand — their decision, not the plugin's to undo.
  await character(person.id, 'MONGED', { clan: clanId, kind: 'guest', source: 'admin', left: true });
  // A character with no seat here at all.
  await character(person.id, 'CREDIT');

  // Somebody else entirely, with their own login and their own departed seat.
  const [stranger] = await db.insert(s.players).values({ displayName: 'stranger' }).returning();
  await db
    .insert(s.users)
    .values({ displayName: 'stranger', discordId: 'disc-stranger', pluginToken: 'token-stranger', playerId: stranger.id })
    .returning();
  await character(stranger.id, 'FASCIST', { clan: clanId, kind: 'member', left: true });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a departed seat comes back as a guest when its owner plays', async () => {
  const before = await seatIn(clanId, RSN);
  assert.notEqual(before.leftAt, null, 'starts out marked gone');

  await A.resolvePluginMember(play('afk'));

  const after = await seatIn(clanId, RSN);
  assert.equal(after.leftAt, null, 'they are on the roster again');
  assert.equal(after.kind, 'guest', 'as a guest — the in-game roster is what makes a member');
  assert.ok(after.lastSeenInClan, 'and the clan can see they are still around');
});

test('a live member who plays stays a member', async () => {
  await A.resolvePluginMember(play('afk', 'DEXTERITY'));
  const seat = await seatIn(clanId, 'DEXTERITY');
  assert.equal(seat.kind, 'member', 'playing never demotes anybody');
  assert.equal(seat.leftAt, null);
});

test('a seat an admin ended stays ended', async () => {
  await A.resolvePluginMember(play('afk', 'MONGED'));
  const seat = await seatIn(clanId, 'MONGED');
  assert.notEqual(seat.leftAt, null, 'a plugin ping is not an argument against an admin');
});

test('a character with no seat here gets a guest one', async () => {
  await A.resolvePluginMember(play('afk', 'CREDIT'));
  const seat = await seatIn(clanId, 'CREDIT');
  assert.ok(seat, 'seated');
  assert.equal(seat.kind, 'guest');
  assert.equal(seat.leftAt, null);
});

test('playing for one clan leaves the other clan’s rosters alone', async () => {
  await A.resolvePluginMember(play('afk'));
  const elsewhere = await seatIn(otherClanId, RSN);
  assert.equal(elsewhere, undefined, 'LFL gained nothing from a session played for the AFK Spot');
});

test('somebody else’s character is not seated by your client', async () => {
  // The token is tolleybt's; the RSN belongs to the stranger. Ownership is the gate.
  await A.resolvePluginMember(play('afk', 'FASCIST'));
  const seat = await seatIn(clanId, 'FASCIST');
  assert.notEqual(seat.leftAt, null, 'their seat is still theirs, and still departed');
});
