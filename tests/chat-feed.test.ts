// The in-game chat feed's audiences against a real database (lib/chatFeed): who hears a player's drop
// and a team's tile, read off the NOTIFYs the push server would get.
//
// Run: npx tsx --test tests/chat-feed.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('chat-feed');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let F: typeof import('../src/lib/chatFeed.ts');

const heard: { u: number[]; m: { tag: string; who: string; text: string; kind: string } }[] = [];
let listener: { query: (q: string) => Promise<unknown>; release: () => void; on: (e: string, fn: (n: { payload?: string }) => void) => void };
const ids: Record<string, { userId: number; accountId: number }> = {};
let eventId = 0;
let red = 0;

async function person(name: string, clanId: number | null, prefs?: Record<string, unknown>) {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const [u] = await db.insert(s.users).values({ displayName: name, discordId: `d-${name}`, playerId: p.id, chatFeedPrefs: prefs ? JSON.stringify(prefs) : null }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  if (clanId != null) await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' });
  ids[name] = { userId: u.id, accountId: a.id };
  return ids[name];
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  F = await import('../src/lib/chatFeed.ts');
  const client = await pool.connect();
  listener = client as unknown as typeof listener;
  listener.on('notification', (n) => {
    const p = JSON.parse(n.payload ?? '{}');
    if (p.k === 'feed') heard.push({ u: p.u, m: p.m });
  });
  await listener.query('LISTEN anvil_push');

  const [home] = await db.insert(s.clans).values({ slug: 'home', name: 'Home Clan', inGameName: 'Home CC' }).returning();
  const [away] = await db.insert(s.clans).values({ slug: 'away', name: 'Away Clan' }).returning();
  await db.insert(s.settings).values({ clanId: home.id, key: 'chat_feed_share_guests', value: 'true' });

  await person('Sender', home.id);
  await person('Clanmate', home.id, { guests: true });
  await person('Rival', away.id);
  await person('Guest', away.id, { guests: true });
  await person('Quiet', away.id);
  await person('Stale', away.id, { guests: true });
  await person('Picky', away.id, { minValue: 50_000_000 });

  const [event] = await db.insert(s.events).values({
    clanId: home.id,
    name: 'Summer Bingo',
    startDate: '2020-01-01 00:00:00',
    endDate: '2099-01-01 00:00:00',
    boardSize: 5,
    chatFeed: true,
  }).returning();
  eventId = event.id;
  const [r] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#f00' }).returning();
  const [b] = await db.insert(s.teams).values({ eventId, name: 'Blue', color: '#00f' }).returning();
  red = r.id;
  for (const [name, team] of [['Sender', r.id], ['Clanmate', b.id], ['Rival', b.id], ['Picky', b.id]] as const) {
    await db.insert(s.eventParticipants).values({ eventId, accountId: ids[name].accountId, name, teamId: team });
  }

  // Guest and Quiet sit in Home's guest channel now; Stale did, twenty minutes ago.
  await F.setGuestPresence(ids.Guest.accountId, ids.Guest.userId, 'home cc');
  await F.setGuestPresence(ids.Quiet.accountId, ids.Quiet.userId, 'Home CC');
  await F.setGuestPresence(ids.Stale.accountId, ids.Stale.userId, 'Home CC');
  await db.update(s.guestPresence).set({ seenAt: new Date(Date.now() - 20 * 60_000) }).where((await import('drizzle-orm')).eq(s.guestPresence.accountId, ids.Stale.accountId));
});

after(async () => {
  listener.release();
  await pool.end();
  await dropDatabase(DB);
});

async function settle() {
  await new Promise((r) => setTimeout(r, 150));
}

function reached(): Map<number, string> {
  const out = new Map<number, string>();
  for (const h of heard) for (const u of h.u) {
    assert.ok(!out.has(u), `user ${u} heard the same item twice`);
    out.set(u, h.m.tag);
  }
  return out;
}

test("a member's drop: the board's other clan, and the clan's guests right now — once each, never the clanmate", async () => {
  heard.length = 0;
  const n = await F.emitPersonalItem(ids.Sender, { kind: 'drop', who: 'Sender', text: 'received Twisted bow (1.2b)', valueGp: 5_000_000 });
  await settle();
  const got = reached();
  assert.equal(got.get(ids.Rival.userId), 'Summer Bingo');
  assert.equal(got.get(ids.Guest.userId), 'Home Clan', 'guesting now, bridge on');
  assert.ok(!got.has(ids.Clanmate.userId), 'same in-game clan: the game already told them');
  assert.ok(!got.has(ids.Quiet.userId), 'never turned the bridge on');
  assert.ok(!got.has(ids.Stale.userId), 'not in the channel any more');
  assert.ok(!got.has(ids.Picky.userId), 'below their floor');
  assert.ok(!got.has(ids.Sender.userId));
  assert.equal(n, 2);
});

test("a guest's drop reaches the clan's members who turned the bridge on", async () => {
  heard.length = 0;
  await F.emitPersonalItem(ids.Guest, { kind: 'pet', who: 'Guest', text: 'got a pet' });
  await settle();
  const got = reached();
  assert.equal(got.get(ids.Clanmate.userId), 'Guest');
  assert.ok(!got.has(ids.Sender.userId), "members need the bridge on too, and Sender's is off");
  assert.ok(!got.has(ids.Rival.userId), 'same clan as the guest');
});

test("a tile: every other team on the board, clanmates included; not the team's own", async () => {
  heard.length = 0;
  await F.emitTileCompletion({ eventId, teamId: red, teamName: 'Red', tileLabel: 'Barrows set', finisher: 'Sender' });
  await settle();
  const got = reached();
  assert.deepEqual([...got.keys()].sort(), [ids.Clanmate.userId, ids.Rival.userId, ids.Picky.userId].sort());
  assert.equal(heard[0].m.text, 'completed Barrows set (Sender)');
});

test('the board switch off, or its standings hidden, keeps other teams out', async () => {
  const { eq } = await import('drizzle-orm');
  await db.update(s.events).set({ rules: JSON.stringify({ standings: { visibility: 'at-end' } }) }).where(eq(s.events.id, eventId));
  heard.length = 0;
  await F.emitTileCompletion({ eventId, teamId: red, teamName: 'Red', tileLabel: 'x' });
  await settle();
  assert.equal(heard.length, 0, 'hidden standings: no tiles to other teams');

  await db.update(s.events).set({ rules: null, chatFeed: false }).where(eq(s.events.id, eventId));
  heard.length = 0;
  await F.emitPersonalItem(ids.Sender, { kind: 'drop', who: 'Sender', text: 'x', valueGp: 5_000_000 });
  await settle();
  assert.ok(!reached().has(ids.Rival.userId), 'feed off: the board carries nothing');
  await db.update(s.events).set({ chatFeed: true }).where(eq(s.events.id, eventId));
});

test('an item key is claimed once', async () => {
  assert.equal(await F.claimFeedItem(ids.Sender.accountId, 'drop:abc'), true);
  assert.equal(await F.claimFeedItem(ids.Sender.accountId, 'drop:abc'), false);
});

test('a guest channel that is no clan here stores nothing', async () => {
  assert.equal(await F.setGuestPresence(ids.Quiet.accountId, ids.Quiet.userId, 'Nobody Knows'), null);
  const rows = await db.select().from(s.guestPresence);
  assert.ok(!rows.some((r) => r.accountId === ids.Quiet.accountId));
});

test("team progress: the sender's own team only, once per burst, never a finished tile", async () => {
  const { eq } = await import('drizzle-orm');
  const blue = (await db.select().from(s.teams).where(eq(s.teams.name, 'Blue')))[0].id;
  heard.length = 0;
  const go = (current: number, label = 'Abyssal whip') =>
    F.emitTeamProgress({ eventId, teamId: blue, senderUserId: ids.Rival.userId, who: 'Rival', tileLabel: label, current, required: 10 });
  await go(4);
  await settle();
  assert.deepEqual([...reached().keys()].sort(), [ids.Clanmate.userId, ids.Picky.userId].sort(), 'teammates, not the sender or Red');
  assert.equal(heard[0].m.text, 'Abyssal whip 4/10');
  assert.equal(heard[0].m.kind, 'progress');
  heard.length = 0;
  await go(5);
  await settle();
  assert.equal(heard.length, 0, 'a second drop straight after is held');
  await go(10, 'Dragon limbs');
  await settle();
  assert.equal(heard.length, 0, 'a finished tile has its own announcement');
});
