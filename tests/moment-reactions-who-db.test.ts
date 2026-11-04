// Who reacted (lib/momentReactions reactorNames), shown on the panel's chips and the site's feeds,
// and the one reaction rule both share (lib/reactionAccess checkReaction).
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/moment-reactions-who-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('moment-reactions-who');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/momentReactions.ts');
let A: typeof import('../src/lib/reactionAccess.ts');
let SR: typeof import('../src/lib/siteReactions.ts');
let V: typeof import('../src/lib/pluginUi/views.ts');

const ids = { clan: 0, other: 0, pet: 0, death: 0, otherPet: 0, ev: 0, red: 0, blue: 0, boardPet: 0, bluePet: 0 };
const user = { mossy: 0, rikkert: 0, wanderer: 0, hank: 0, nobody: 0, guest: 0 };

async function person(name: string, token: string) {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const [u] = await db.insert(s.users).values({ displayName: `discord-${name}`, discordId: `d-${name}`, pluginTokenHash: tokenHash(token), playerId: p.id }).returning();
  return { playerId: p.id, userId: u.id };
}
async function seat(playerId: number, rsn: string, clanId: number, o: { kind?: string; primary?: boolean } = {}) {
  const [acc] = await db.insert(s.accounts).values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), isPrimary: o.primary ? 1 : 0 }).returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: acc.id, kind: o.kind ?? 'member' }).returning();
  return { accountId: acc.id, seatId: m.id };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/momentReactions.ts');
  A = await import('../src/lib/reactionAccess.ts');
  SR = await import('../src/lib/siteReactions.ts');
  V = await import('../src/lib/pluginUi/views.ts');

  [{ id: ids.clan }] = await db.insert(s.clans).values({ slug: 'who-clan', name: 'Who Clan' }).returning();
  [{ id: ids.other }] = await db.insert(s.clans).values({ slug: 'who-other', name: 'Other' }).returning();

  const lucky = await person('lucky', 'lucky-token');
  const luckySeat = await seat(lucky.playerId, 'Lucky One', ids.clan);

  // Mossy: a main and an alt here, and a character in another clan (never named here).
  const mossy = await person('mossy', 'mossy-token');
  user.mossy = mossy.userId;
  await seat(mossy.playerId, 'Mossy Alt', ids.clan);
  await seat(mossy.playerId, 'Mossy', ids.clan, { primary: true });
  await seat(mossy.playerId, 'Mossy Elsewhere', ids.other);
  const rikkert = await person('rikkert', 'rikkert-token');
  user.rikkert = rikkert.userId;
  const rikSeat = await seat(rikkert.playerId, 'Rikkert', ids.clan);
  // Wanderer: only ever in the other clan.
  const wanderer = await person('wanderer', 'wanderer-token');
  user.wanderer = wanderer.userId;
  const wandererSeat = await seat(wanderer.playerId, 'Wanderer B', ids.other);
  // Hank: host staff with a seat here, not playing the board.
  const hank = await person('hank', 'hank-token');
  user.hank = hank.userId;
  await seat(hank.playerId, 'Host Hank', ids.clan);
  await db.insert(s.clanStaff).values({ clanId: ids.clan, userId: hank.userId, role: 'moderator' });
  user.nobody = (await person('nobody', 'nobody-token')).userId;
  // A guest from the other clan, playing the board.
  const guest = await person('guest', 'guest-token');
  user.guest = guest.userId;

  const at = '2026-11-01 12:00:00';
  [{ id: ids.pet }] = await db.insert(s.moments).values({ clanMemberId: luckySeat.seatId, rsn: 'Lucky One', kind: 'pet', itemName: 'Pet snakeling', occurredAt: at, dedupKey: 'w1' }).returning();
  [{ id: ids.death }] = await db.insert(s.moments).values({ clanMemberId: luckySeat.seatId, rsn: 'Lucky One', kind: 'death', source: 'Zulrah', occurredAt: '2026-11-01 13:00:00', dedupKey: 'w2' }).returning();
  [{ id: ids.otherPet }] = await db.insert(s.moments).values({ clanMemberId: wandererSeat.seatId, rsn: 'Wanderer B', kind: 'pet', itemName: 'Baby mole', occurredAt: at, dedupKey: 'w3' }).returning();

  // The board, hosted here: Rikkert plays as "Rik on board", the guest as "Guesty".
  [{ id: ids.ev }] = await db.insert(s.events).values({ clanId: ids.clan, name: 'Who Board', boardSize: 2, startDate: '2026-10-01T00:00:00.000Z' }).returning();
  [{ id: ids.red }] = await db.insert(s.teams).values({ eventId: ids.ev, name: 'Reds', color: '#cc0000' }).returning();
  [{ id: ids.blue }] = await db.insert(s.teams).values({ eventId: ids.ev, name: 'Blues', color: '#0000cc' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ids.ev, teamId: ids.red, accountId: rikSeat.accountId, name: 'Rik on board' });
  const guestSeat = await seat(guest.playerId, 'Guest Main', ids.other);
  await db.insert(s.eventParticipants).values({ eventId: ids.ev, teamId: ids.blue, accountId: guestSeat.accountId, name: 'Guesty' });
  [{ id: ids.boardPet }] = await db
    .insert(s.moments)
    .values({ clanMemberId: luckySeat.seatId, eventId: ids.ev, teamId: ids.red, rsn: 'Lucky One', kind: 'pet', itemName: 'Vorki', occurredAt: '2026-11-02 10:00:00', dedupKey: 'wb1' })
    .returning();
  [{ id: ids.bluePet }] = await db
    .insert(s.moments)
    .values({ clanMemberId: guestSeat.seatId, eventId: ids.ev, teamId: ids.blue, rsn: 'Guest Main', kind: 'pet', itemName: 'Olmlet', occurredAt: '2026-11-02 11:00:00', dedupKey: 'wb2' })
    .returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a clan feed names reactors by their character in THIS clan, in the order they reacted', async () => {
  await R.toggleReaction(ids.pet, user.mossy, 'gz');
  await R.toggleReaction(ids.pet, user.rikkert, 'gz');
  // Someone from another clan (it can't happen through the action, but a stale row could exist).
  await R.toggleReaction(ids.pet, user.wanderer, 'gz');
  const who = await R.reactorNames([ids.pet], { clanId: ids.clan });
  assert.deepEqual(who.get(ids.pet)?.gz, ['Mossy', 'Rikkert', null], 'main over alt; another clan’s character never named');
  const flat = JSON.stringify([...who]);
  assert.ok(!flat.includes('Elsewhere') && !flat.includes('Wanderer') && !flat.includes('discord-'), 'no other clan’s character, no Discord name');
});

test('the panel’s Feed puts the who line on a clanmate’s GZ chip', async () => {
  const req = new Request('http://site/api/plugin/ui', { headers: { Authorization: 'Bearer rikkert-token', 'X-RSN': 'Rikkert' } });
  const v = await V.pluginView(req, 'feed', { s: 'clan:who-clan' });
  const rows = (JSON.parse(JSON.stringify(v!.ui)).c as { t: string; rows?: { id: string; gz?: { n: number; who?: string } }[] }[]).find((n) => n.t === 'feed')?.rows ?? [];
  const pet = rows.find((r) => r.id === `m${ids.pet}`);
  assert.ok(pet?.gz, 'the pet row has its GZ chip');
  assert.equal(pet!.gz!.n, 3);
  assert.equal(pet!.gz!.who, 'GZ · Mossy, Rikkert and 1 other');
});

test('a board names its players as they play there, host staff by their seat in the host clan', async () => {
  await R.toggleReaction(ids.boardPet, user.rikkert, 'gz');
  await R.toggleReaction(ids.boardPet, user.hank, 'gz');
  await R.toggleReaction(ids.boardPet, user.guest, 'gz');
  const who = await R.reactorNames([ids.boardPet], { eventId: ids.ev, hostClanId: ids.clan });
  assert.deepEqual(who.get(ids.boardPet)?.gz, ['Rik on board', 'Host Hank', 'Guesty']);
});

test('the site shows counts to anyone, names only to someone who may react there', async () => {
  const pub = await SR.siteReactions([{ id: ids.pet, kind: 'pet' }], { clanId: ids.clan }, null);
  assert.equal(pub.canReact, false);
  assert.deepEqual(pub.byMoment[ids.pet].map((c) => [c.kind, c.n, c.who]), [['gz', 3, undefined]]);
  const outsider = await SR.siteReactions([{ id: ids.pet, kind: 'pet' }], { clanId: ids.clan }, user.wanderer);
  assert.equal(outsider.canReact, false);
  assert.ok(!JSON.stringify(outsider).includes('Mossy'), 'another clan’s member gets no names');
  const mate = await SR.siteReactions([{ id: ids.pet, kind: 'pet' }, { id: ids.death, kind: 'death' }], { clanId: ids.clan }, user.mossy);
  assert.equal(mate.canReact, true);
  const gz = mate.byMoment[ids.pet].find((c) => c.kind === 'gz')!;
  assert.equal(gz.mine, true);
  assert.equal(gz.who, 'GZ · Mossy, Rikkert and 1 other');
  assert.deepEqual(mate.byMoment[ids.death].map((c) => c.kind), ['sad', 'sit'], 'a death offers Sad and Sit, no GZ');
  assert.equal(mate.byMoment[ids.pet].some((c) => c.kind === 'gold'), false, 'no gold chip for a non-Supporter when none was given');
  // On a board: a player sees names, a stranger only counts.
  const player = await SR.siteReactions([{ id: ids.boardPet, kind: 'pet' }], { eventId: ids.ev, hostClanId: ids.clan }, user.guest);
  assert.equal(player.byMoment[ids.boardPet][0].who, 'GZ · Rik on board, Host Hank and Guesty');
  const stranger = await SR.siteReactions([{ id: ids.boardPet, kind: 'pet' }], { eventId: ids.ev, hostClanId: ids.clan }, user.nobody);
  assert.equal(stranger.byMoment[ids.boardPet][0].who, undefined);
});

test('the shared rule: an outsider is refused, kinds follow the row, gold is a Supporter’s', async () => {
  const clan = { clanId: ids.clan };
  const refused = await A.checkReaction(user.wanderer, clan, ids.pet, 'gz');
  assert.deepEqual(refused, { ok: false, status: 403, error: A.REACT_ERRORS.notClanmate });
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.death, 'gz'), { ok: false, status: 400, error: A.REACT_ERRORS.bad }, 'no GZ on a death');
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.pet, 'sit'), { ok: false, status: 400, error: A.REACT_ERRORS.bad }, 'no Sit on a pet');
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.pet, 'heart'), { ok: false, status: 400, error: A.REACT_ERRORS.bad });
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.death, 'sit'), { ok: true, kind: 'sit' });
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.otherPet, 'gz'), { ok: false, status: 404, error: A.REACT_ERRORS.notInClan });
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.pet, 'gold'), { ok: false, status: 403, error: A.REACT_ERRORS.gold });
  await db.insert(s.supporterSubscriptions).values({ userId: user.mossy, tier: 'supporter', status: 'active', startedAt: '2026-10-01T00:00:00Z' });
  assert.deepEqual(await A.checkReaction(user.mossy, clan, ids.pet, 'gold'), { ok: true, kind: 'gold' });
  // A Supporter clanmate is offered the gold chip beside the GZ.
  const mate = await SR.siteReactions([{ id: ids.pet, kind: 'pet' }], clan, user.mossy);
  assert.deepEqual(mate.byMoment[ids.pet].map((c) => c.kind), ['gz', 'gold']);

  const board = { eventId: ids.ev };
  assert.deepEqual(await A.checkReaction(user.nobody, board, ids.boardPet, 'gz'), { ok: false, status: 403, error: A.REACT_ERRORS.notPlayer });
  assert.deepEqual(await A.checkReaction(user.guest, board, ids.boardPet, 'gz'), { ok: true, kind: 'gz' }, 'a guest player on the board');
  assert.deepEqual(await A.checkReaction(user.hank, board, ids.boardPet, 'gz'), { ok: true, kind: 'gz' }, 'host staff');
  assert.deepEqual(await A.checkReaction(user.guest, board, ids.pet, 'gz'), { ok: false, status: 404, error: A.REACT_ERRORS.notInEvent }, 'off the board');
  // Behind the curtain a player reacts only to their own team's rows; staff to all.
  await db.update(s.events).set({ rules: JSON.stringify({ standings: { visibility: 'at-end' } }) }).where(eq(s.events.id, ids.ev));
  assert.deepEqual(await A.checkReaction(user.guest, board, ids.boardPet, 'gz'), { ok: false, status: 404, error: A.REACT_ERRORS.notInEvent });
  assert.deepEqual(await A.checkReaction(user.guest, board, ids.bluePet, 'gz'), { ok: true, kind: 'gz' });
  assert.deepEqual(await A.checkReaction(user.hank, board, ids.boardPet, 'gz'), { ok: true, kind: 'gz' });
});
