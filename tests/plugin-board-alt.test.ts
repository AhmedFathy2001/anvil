// The sidebar's board when the character being played isn't the enrolled one: a person's main is on
// a team, they log in on an alt. /config still shows them that board (homeBoardForUser), so
// /api/plugin/board has to answer it — read-only — instead of a 401 the panel reads as
// "Couldn't load the board".
//
// Run: npm run test:pluginboard

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-board-alt');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let eventId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  const [clan] = await db.insert(s.clans).values({ slug: 'alt', name: 'Alt clan' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Live Bingo', boardSize: 5, tilesRevealed: 1, startDate: new Date(Date.now() - 864e5).toISOString() })
    .returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#f00' }).returning();
  await db.insert(s.tiles).values({ eventId, position: 0, label: 'Fire cape', tileType: 'drop' });

  const [person] = await db.insert(s.players).values({ displayName: 'Two Accounts' }).returning();
  await db.insert(s.users).values({ playerId: person.id, displayName: 'Two Accounts', discordId: 'board-alt', pluginToken: 'board-alt-token' });
  const [main, alt] = await db
    .insert(s.accounts)
    .values([
      { playerId: person.id, rsn: 'Main RSN', rsnNormalized: 'main rsn' },
      { playerId: person.id, rsn: 'Alt RSN', rsnNormalized: 'alt rsn' },
    ])
    .returning();
  const [mainSeat] = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: clan.id, accountId: main.id, kind: 'member', source: 'roster' },
      { clanId: clan.id, accountId: alt.id, kind: 'guest', source: 'roster' },
    ])
    .returning();
  await db.insert(s.eventParticipants).values({ eventId, teamId: team.id, clanMemberId: mainSeat.id, accountId: main.id, name: 'Main RSN' });
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

test('playing an alt shows the main’s board read-only instead of failing', async () => {
  const { GET } = await import('../src/app/api/plugin/board/route.ts');
  const res = await GET(new Request('https://example.test/api/plugin/board', {
    headers: { Authorization: 'Bearer board-alt-token', 'X-RSN': 'Alt RSN', 'x-anvil-clan-slug': 'alt' },
  }));
  assert.equal(res.status, 200);
  const board = (await res.json()) as { eventId: number; readOnly: boolean; tiles: unknown[] };
  assert.equal(board.eventId, eventId);
  assert.equal(board.readOnly, true, 'claims stay with the enrolled character');
  assert.equal(board.tiles.length, 1);
});

test('no token is still refused', async () => {
  const { GET } = await import('../src/app/api/plugin/board/route.ts');
  const res = await GET(new Request('https://example.test/api/plugin/board', { headers: { 'x-anvil-clan-slug': 'alt' } }));
  assert.equal(res.status, 401);
});
