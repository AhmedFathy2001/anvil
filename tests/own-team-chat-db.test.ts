// "Only my team's chat" against a real database (lib/eventChat, lib/pluginUi/feedView chatPane):
// the flag on a host's seats, what they read, post, see in the plugin's pane and are pushed live.
//
// Run: npx tsx --test tests/own-team-chat-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('own-team-chat');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/eventChat.ts');
let V: typeof import('../src/lib/pluginUi/feedView.ts');

let eventId: number;
let ruby: number;
let jade: number;
const u: Record<string, number> = {};

async function person(name: string, n: number): Promise<{ userId: number; accountId: number }> {
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  const [us] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99300000000000${String(n).padStart(4, '0')}` }).returning();
  return { userId: us.id, accountId: a.id };
}

let t = 1_000_000;
const later = () => (t += 20_000);

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/eventChat.ts');
  V = await import('../src/lib/pluginUi/feedView.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Forge' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Winter Bingo', boardSize: 5, chatEnabled: true }).returning();
  eventId = ev.id;
  [{ id: ruby }, { id: jade }] = await db.insert(s.teams).values([{ eventId, name: 'Ruby', color: '#cf4a3e' }, { eventId, name: 'Jade', color: '#3ecf62' }]).returning();
  // Hana hosts (clan admin) and plays on Ruby; Kev moderates without a seat; Rikkert plays Ruby, Saltbeard Jade.
  for (const [i, n] of ['Hana', 'Kev', 'Rikkert', 'Saltbeard', 'Opal'].entries()) {
    const p = await person(n, i);
    u[n] = p.userId;
    const team = n === 'Hana' || n === 'Rikkert' || n === 'Opal' ? ruby : n === 'Saltbeard' ? jade : null;
    if (team) await db.insert(s.eventParticipants).values({ eventId, name: n, accountId: p.accountId, teamId: team });
  }
  await db.insert(s.clanStaff).values([{ clanId: clan.id, userId: u.Hana, role: 'admin' }, { clanId: clan.id, userId: u.Kev, role: 'moderator' }]);
  // Opal is Anvil staff with no job in the clan, playing on Ruby.
  await db.update(s.users).set({ platformRole: 'staff' }).where(eq(s.users.id, u.Opal));
  await C.setPlatformChat(true);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const access = async (who: string) => (await C.chatAccess(eventId, u[who]))!;

test('off by default: the seated host reads every team, with team chips', async () => {
  const a = await access('Hana');
  assert.equal(a.ownTeamOnly, false);
  assert.equal(await C.mayRead(a, `team:${jade}`), true);
  const pane = await V.chatPane(a, u.Hana, eventId, { f: 'team' });
  assert.deepEqual(pane.teamPicks?.map((p) => p.label), ['Jade', 'Ruby']);
  assert.equal(pane.ownTeam?.on, false);
  assert.equal(pane.ownTeam?.act.act, 'chat-own-team');
  const target = await C.channelTarget(eventId, `team:${jade}`);
  assert.ok('u' in target && target.u.includes(u.Hana), 'Jade’s lines reach her live');
});

test('only seated event staff may turn it on', async () => {
  assert.equal((await C.setOwnTeamChat(await access('Kev'), u.Kev, true)).ok, false, 'no seat');
  assert.equal((await C.setOwnTeamChat(await access('Rikkert'), u.Rikkert, true)).ok, false, 'a player');
  assert.equal((await C.setOwnTeamChat(await access('Opal'), u.Opal, true)).ok, false, 'Anvil staff');
  assert.equal((await V.chatPane(await access('Kev'), u.Kev, eventId, { f: 'team' })).ownTeam, null);
  assert.equal((await V.chatPane(await access('Rikkert'), u.Rikkert, eventId, { f: 'team' })).ownTeam, null);
});

test('on: her own team only, like a player; announcements and moderation of what she sees stay', async () => {
  assert.deepEqual(await C.sendChat(await access('Saltbeard'), u.Saltbeard, 'jade secret', 'team', later()), { ok: true });
  assert.deepEqual(await C.setOwnTeamChat(await access('Hana'), u.Hana, true), { ok: true });
  const a = await access('Hana');
  assert.equal(a.ownTeamOnly, true);
  assert.equal(a.staff, true, 'still staff');
  assert.equal(await C.mayRead(a, `team:${jade}`), false);
  assert.equal(await C.mayRead(a, `team:${ruby}`), true);
  assert.deepEqual(await C.sendChat(a, u.Hana, 'hi jade', `team:${jade}`, later()), { ok: false, error: 'That’s another team’s channel.' });
  assert.deepEqual(await C.sendChat(a, u.Hana, 'go ruby', 'team', later()), { ok: true });
  assert.deepEqual(await C.sendChat(a, u.Hana, 'tile 9 is live', 'announce', later()), { ok: true });

  const pane = await V.chatPane(a, u.Hana, eventId, { f: 'team', tm: String(jade) });
  assert.equal(pane.channel, `team:${ruby}`, 'a picked other team falls back to her own');
  assert.equal(pane.teamPicks, null);
  assert.equal(pane.chans[0].label, 'My team');
  assert.equal(pane.ownTeam?.on, true);

  const unread = await C.chatUnread(a, u.Hana, [`team:${jade}`]);
  assert.equal(unread.get(`team:${jade}`), 0, 'no other-team counts');
  const target = await C.channelTarget(eventId, `team:${jade}`);
  assert.ok('u' in target && !target.u.includes(u.Hana) && target.u.includes(u.Kev), 'no live push of Jade’s lines to her; Kev still');
  const own = await C.channelTarget(eventId, `team:${ruby}`);
  assert.ok('u' in own && own.u.includes(u.Hana), 'her own team’s lines still reach her');

  const mod = await C.chatModLines(eventId, { ownTeam: ruby });
  assert.equal(mod.some((l) => l.body === 'jade secret'), false);
  assert.equal(mod.some((l) => l.body === 'go ruby'), true);
  const jadeLine = (await C.chatModLines(eventId)).find((l) => l.body === 'jade secret')!;
  assert.equal((await C.deleteChat(a, u.Hana, jadeLine.id)).ok, false, 'not a line she can see');
  assert.equal((await C.pauseChat(a, true, u.Hana)).ok, true, 'pause stays');
  await C.pauseChat(a, false, u.Hana);
});

test('off again: every team’s chat is back', async () => {
  assert.deepEqual(await C.setOwnTeamChat(await access('Hana'), u.Hana, false), { ok: true });
  const a = await access('Hana');
  assert.equal(a.ownTeamOnly, false);
  assert.equal(await C.mayRead(a, `team:${jade}`), true);
});
