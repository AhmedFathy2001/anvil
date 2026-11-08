// The newer kinds' clan defaults against a real database: a character takes ITS member clan's
// defaults, a clanless one Anvil's, and a clan setting can never turn a private kind on, even when the
// stored JSON was written around the API.
// Run: npx tsx --test tests/notify-kinds-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('notify-kinds');

let D: typeof import('../src/lib/notifyDefaults.ts');
let P: typeof import('../src/lib/notifyPrefs.ts');
let clanA: number;
let inA: number;
let loner: number;
let seat: number;
let S: typeof import('../src/lib/momentsStore.ts');
let F: typeof import('../src/lib/pluginUi/feedLists.ts');
let boardA: number;
let boardB: number;
let ended: number;
let teamA: number;
let teamB: number;

before(async () => {
  await resetDatabase(DB);
  const { db, schema: s } = await loadDb();
  D = await import('../src/lib/notifyDefaults.ts');
  P = await import('../src/lib/notifyPrefs.ts');
  S = await import('../src/lib/momentsStore.ts');
  F = await import('../src/lib/pluginUi/feedLists.ts');
  const [a] = await db.insert(s.clans).values({ slug: 'kinds', name: 'Kinds', status: 'active' }).returning();
  clanA = a.id;
  // Written raw, as if around the API: kc on, and a forged GE / trade / storage switch.
  await db.insert(s.settings).values({
    clanId: clanA,
    key: 'notify_kind_defaults',
    value: JSON.stringify({ kinds: { kc: { on: true, every: 250 }, ge: { on: true }, trade: { on: true }, storage: { on: true }, ext: { on: true } }, shots: { deaths: false } }),
  });
  const [pl] = await db.insert(s.players).values({ displayName: 'K' }).returning();
  const mk = async (rsn: string) =>
    (await db.insert(s.accounts).values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning())[0].id;
  inA = await mk('InKinds');
  loner = await mk('Loner');
  seat = (await db.insert(s.clanMemberships).values({ clanId: clanA, accountId: inA, kind: 'member' }).returning())[0].id;
  // Two live boards the member is drafted onto, and one that already ended.
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const board = async (name: string, endDate: string) => {
    const [ev] = await db.insert(s.events).values({ clanId: clanA, name, boardSize: 3, tilesRevealed: 1, startDate: past, endDate }).returning();
    const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#f00' }).returning();
    await db.insert(s.eventParticipants).values({ eventId: ev.id, teamId: team.id, clanMemberId: seat, name: 'InKinds' });
    return [ev.id, team.id];
  };
  [boardA, teamA] = await board('Board A', future);
  [boardB, teamB] = await board('Board B', future);
  [ended] = await board('Old board', past);
});
after(async () => {
  await dropDatabase(DB);
});

test('a member takes the clan default; the private kinds stay off', async () => {
  const c = await D.characterClanKinds(inA, clanA);
  assert.deepEqual(Object.keys(c.kinds), ['kc']);
  const m = P.pluginMe(P.NOTIFY_DEFAULTS, {}, P.NO_CLAN_DROPS, null, [], c);
  assert.deepEqual(m.watch.map((w) => [w.k, w.every]), [['kc', 250]]);
  assert.deepEqual(m.on, {});
  assert.deepEqual(m.noShot, ['death']);
});

test('a character with no member seat gets Anvil defaults: nothing new', async () => {
  const c = await D.characterClanKinds(loner, clanA);
  const m = P.pluginMe(P.NOTIFY_DEFAULTS, {}, P.NO_CLAN_DROPS, null, [], c);
  assert.deepEqual([m.watch, m.noShot, m.on], [[], [], {}]);
});

test('a milestone row lands in the clan feed, under All and Milestones, not Achievements', async () => {
  const stored = await S.recordMilestoneMoment({ clanMemberId: seat, rsn: 'InKinds' }, { sub: 'kc', itemName: 'Zulrah kill count', quantity: 500, tier: null });
  assert.equal(stored.clan.length, 1);
  // The outbox resending the same post within the minute: no second row.
  assert.equal((await S.recordMilestoneMoment({ clanMemberId: seat, rsn: 'InKinds' }, { sub: 'kc', itemName: 'Zulrah kill count', quantity: 500, tier: null })).clan.length, 0);
  const names = async (f: string) => (await F.clanFeedList(clanA, f)).list.map((m) => `${m.kind}:${m.itemName}`);
  assert.deepEqual(await names('milestones'), ['milestone:Zulrah kill count']);
  assert.deepEqual(await names('all'), ['milestone:Zulrah kill count']);
  assert.deepEqual(await names('achievements'), []);
});

test('a milestone is filed on every live board too, once per board, and the clan feed keeps one copy', async () => {
  const boards = await S.liveBoardRows(seat);
  assert.deepEqual(boards.map((b) => b.eventId).sort(), [boardA, boardB].sort());
  const f = { sub: 'slayer' as const, itemName: 'Slayer task', quantity: 50, tier: null };
  const stored = await S.recordMilestoneMoment({ clanMemberId: seat, rsn: 'InKinds' }, f, boards);
  assert.equal(stored.clan.length, 1);
  assert.deepEqual(stored.boards.map((m) => [m.eventId, m.teamId]).sort(), [[boardA, teamA], [boardB, teamB]].sort());
  // A resend: nothing new anywhere.
  const again = await S.recordMilestoneMoment({ clanMemberId: seat, rsn: 'InKinds' }, f, boards);
  assert.deepEqual([again.clan.length, again.boards.length], [0, 0]);
  const board = async (e: number, filter: string) => (await F.eventFeedList(e, filter, teamA)).items.filter((i) => i.m).map((i) => `${i.m!.kind}:${i.m!.itemName}`);
  assert.deepEqual(await board(boardA, 'milestones'), ['milestone:Slayer task']);
  assert.deepEqual(await board(boardB, 'all'), ['milestone:Slayer task']);
  assert.deepEqual(await board(ended, 'milestones'), []);
  assert.deepEqual(await board(boardA, 'achievements'), []);
  // The clan's list: its own copy once, not the boards' copies as well.
  const clanRows = (await F.clanFeedList(clanA, 'milestones')).list.filter((m) => m.itemName === 'Slayer task');
  assert.equal(clanRows.length, 1);
  assert.equal(clanRows[0].eventId, null);
});
