// The event chat against a real database (lib/eventChat): who may read and talk, team-only lines,
// the host's staff deleting and muting, pause, and the host's and platform's switches.
//
// Run: npx tsx --test tests/event-chat-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-chat');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/eventChat.ts');

let eventId: number;
let ruby: number;
let jade: number;
const u: Record<string, number> = {};

async function person(name: string, n: number): Promise<{ userId: number; accountId: number }> {
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  const [us] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99200000000000${String(n).padStart(4, '0')}` }).returning();
  return { userId: us.id, accountId: a.id };
}

let t = 1_000_000;
const later = () => (t += 20_000);

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/eventChat.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Forge' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Winter Bingo', boardSize: 5, chatEnabled: true }).returning();
  eventId = ev.id;
  [{ id: ruby }, { id: jade }] = await db.insert(s.teams).values([{ eventId, name: 'Ruby', color: '#cf4a3e' }, { eventId, name: 'Jade', color: '#3ecf62' }]).returning();
  const names = ['Rikkert', 'Pkpingu', 'Saltbeard', 'Kev', 'Stranger'];
  for (const [i, n] of names.entries()) {
    const p = await person(n, i);
    u[n] = p.userId;
    if (n === 'Rikkert' || n === 'Pkpingu') await db.insert(s.eventParticipants).values({ eventId, name: n, accountId: p.accountId, teamId: ruby });
    if (n === 'Saltbeard') await db.insert(s.eventParticipants).values({ eventId, name: n, accountId: p.accountId, teamId: jade });
  }
  // Kev is the clan's moderator, not playing.
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: u.Kev, role: 'moderator' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const access = async (who: string) => (await C.chatAccess(eventId, u[who]))!;

test('players and the host’s staff are in; anyone else is not', async () => {
  assert.equal((await access('Rikkert')).member, true);
  assert.equal((await access('Rikkert')).teamId, ruby);
  assert.equal((await access('Kev')).staff, true);
  assert.equal((await access('Kev')).role, 'mod');
  assert.equal((await access('Stranger')).member, false);
  const r = await C.sendChat(await access('Stranger'), u.Stranger, 'hello?', false, later());
  assert.deepEqual(r, { ok: false, error: 'Only this event’s players can chat here.' });
});

test('a line to everyone, a line to the team, and who reads which', async () => {
  assert.deepEqual(await C.sendChat(await access('Rikkert'), u.Rikkert, 'anyone need a zulrah duo?', false, later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'ruby only: go tile 9', true, later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Saltbeard'), u.Saltbeard, 'gl all', false, later()), { ok: true });

  const all = await C.chatHistory(await access('Saltbeard'), u.Saltbeard, 'all');
  assert.deepEqual(all.map((r) => r.text), ['gl all', 'anyone need a zulrah duo?'], 'team-only lines stay out of All');
  const rubyTeam = await C.chatHistory(await access('Rikkert'), u.Rikkert, 'team');
  assert.deepEqual(rubyTeam.map((r) => r.text), ['ruby only: go tile 9', 'anyone need a zulrah duo?']);
  assert.equal(rubyTeam[0].tag, 'TEAM');
  const jadeTeam = await C.chatHistory(await access('Saltbeard'), u.Saltbeard, 'team');
  assert.deepEqual(jadeTeam.map((r) => r.text), ['gl all']);
  assert.equal(all[1].mine, undefined, 'not Saltbeard’s');
  assert.equal((await C.chatHistory(await access('Rikkert'), u.Rikkert, 'all'))[1].mine, true);
});

test('links and gold adverts are refused; a mod may post a link', async () => {
  assert.equal((await C.sendChat(await access('Rikkert'), u.Rikkert, 'see my-gp-shop.com', false, later())).ok, false);
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'rules: anvilosrs.com/c/forge', false, later())).ok, true);
  const mods = await C.chatHistory(await access('Kev'), u.Kev, 'mods');
  assert.deepEqual(mods.map((r) => r.tag), ['MOD']);
});

test('one person can’t flood: the second line inside the gap waits', async () => {
  const at = later();
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'one', false, at)).ok, true);
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'two', false, at + 200)).ok, false);
});

test('a mod deletes a line and mutes its sender; staff see the menu, players don’t', async () => {
  const kevView = await C.chatHistory(await access('Kev'), u.Kev, 'all');
  const target = kevView.find((r) => r.text === 'gl all')!;
  assert.equal(target.menu?.length, 2);
  assert.equal((await C.chatHistory(await access('Rikkert'), u.Rikkert, 'all')).find((r) => r.text === 'gl all')?.menu, undefined);

  const id = Number(target.id.slice(1));
  assert.equal((await C.deleteChat(await access('Rikkert'), u.Rikkert, id)).ok, false, 'players can’t');
  assert.deepEqual(await C.deleteChat(await access('Kev'), u.Kev, id), { ok: true });
  assert.equal((await C.chatHistory(await access('Kev'), u.Kev, 'all')).some((r) => r.text === 'gl all'), false);

  const rik = (await C.chatHistory(await access('Kev'), u.Kev, 'all')).find((r) => r.who === 'Rikkert')!;
  assert.deepEqual(await C.muteChat(await access('Kev'), u.Kev, Number(rik.id.slice(1))), { ok: true });
  const r = await C.sendChat(await access('Rikkert'), u.Rikkert, 'why', false, later());
  assert.deepEqual(r, { ok: false, error: 'You’re muted in this event’s chat.' });
});

test('pause makes it read-only for players, not for staff', async () => {
  assert.deepEqual(await C.pauseChat(await access('Kev'), true), { ok: true });
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hello', false, later())).ok, false);
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'back in 5', false, later())).ok, true);
  await C.pauseChat(await access('Kev'), false);
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hello again', false, later())).ok, true);
});

test('the host’s switch and the platform’s each close it', async () => {
  await C.setEventChat(eventId, false);
  assert.equal((await access('Pkpingu')).open, false);
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hi', false, later())).ok, false);
  await C.setEventChat(eventId, true);

  await C.setPlatformChat(false);
  const a = await access('Pkpingu');
  assert.equal(a.open, false);
  assert.equal(a.closedWhy, 'Event chat is switched off on Anvil right now.');
  await C.setPlatformChat(true);
  assert.equal((await access('Pkpingu')).open, true);
});

test('chat from a long-finished event is swept', async () => {
  await db.update(s.events).set({ endDate: '2020-01-01T00:00:00.000Z' }).where(eq(s.events.id, eventId));
  await C.sweepEventChat();
  assert.equal((await db.select().from(s.eventChatMessages)).length, 0);
  assert.equal((await db.select().from(s.eventChatMutes)).length, 0);
});
