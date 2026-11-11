// The website's Feed & chat page against a real database (lib/liveData): who gets in, which seat a
// two-character person speaks as, a line sent from the website reaching the plugin exactly like one
// sent from the plugin, unread and read, staff's delete, "Only my team's chat", the Feed and the pulse.
//
// Run: npx tsx --test tests/live-feed-chat-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('live-feed-chat');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/liveData.ts');
let C: typeof import('../src/lib/eventChat.ts');
let V: typeof import('../src/lib/pluginUi/feedView.ts');

let eventId: number;
let clanId: number;
let ruby: number;
let jade: number;
const u: Record<string, number> = {};
const acct: Record<string, number> = {};
const seatOf: Record<string, number> = {};

async function person(name: string, n: number): Promise<void> {
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  const [us] = await db
    .insert(s.users)
    .values({ playerId: pl.id, displayName: name, discordId: `99300000000000${String(n).padStart(4, '0')}`, pluginTokenHash: tokenHash(`${name}-token`) })
    .returning();
  u[name] = us.id;
  acct[name] = a.id;
}

/** Every rows push while `fn` runs. */
async function pushes(fn: () => Promise<void>): Promise<{ u?: number[]; e?: number; m: { t: string; feeds: string[]; rows?: Record<string, unknown>[]; ids?: string[] } }[]> {
  const listener = new (await import('pg')).default.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  const got: { u?: number[]; e?: number; m: { t: string; feeds: string[]; rows?: Record<string, unknown>[]; ids?: string[] } }[] = [];
  listener.on('notification', (n) => {
    const p = JSON.parse(n.payload!);
    if (p.k === 'rows') got.push(p);
  });
  await listener.query('LISTEN anvil_push');
  try {
    await fn();
    await new Promise((r) => setTimeout(r, 150));
  } finally {
    await listener.end();
  }
  return got;
}

const req = (who?: string) =>
  new Request('http://site/api/plugin/ui', { headers: who ? { Authorization: `Bearer ${who}-token`, 'X-RSN': who } : {} });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/eventChat.ts');
  L = await import('../src/lib/liveData.ts');
  V = await import('../src/lib/pluginUi/feedView.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Forge' }).returning();
  clanId = clan.id;
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Winter Bingo', boardSize: 5, chatEnabled: true, tilesRevealed: 1 }).returning();
  eventId = ev.id;
  [{ id: ruby }, { id: jade }] = await db.insert(s.teams).values([{ eventId, name: 'Ruby', color: '#cf4a3e' }, { eventId, name: 'Jade', color: '#3ecf62' }]).returning();
  for (const [i, n] of ['Rikkert', 'Pkpingu', 'Saltbeard', 'Kev', 'Stranger', 'Mara', 'Twin', 'TwinAlt'].entries()) await person(n, i);
  // TwinAlt is Twin's second character: one person, two seats on two teams.
  const [twin] = await db.select({ playerId: s.users.playerId }).from(s.users).where(eq(s.users.id, u.Twin));
  await db.update(s.accounts).set({ playerId: twin.playerId! }).where(eq(s.accounts.id, acct.TwinAlt));
  const seats: [string, number][] = [['Rikkert', ruby], ['Pkpingu', ruby], ['Saltbeard', jade], ['Mara', jade], ['Twin', ruby], ['TwinAlt', jade]];
  for (const [n, team] of seats) {
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct[n], kind: 'member' }).returning();
    const [p] = await db.insert(s.eventParticipants).values({ eventId, name: n, accountId: acct[n], teamId: team, clanMemberId: m.id }).returning();
    seatOf[n] = p.id;
  }
  // Kev is the clan's moderator, not playing. Mara is a moderator who plays on Jade.
  await db.insert(s.clanStaff).values([{ clanId, userId: u.Kev, role: 'moderator' }, { clanId, userId: u.Mara, role: 'moderator' }]);
  await C.setPlatformChat(true);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const access = async (who: string, seat?: number) => (await L.liveAccess(eventId, u[who], seat)).access!;

test('the board’s players and its staff are in; an outsider is not', async () => {
  assert.equal((await access('Rikkert')).member, true);
  assert.equal((await access('Rikkert')).teamId, ruby);
  assert.equal((await access('Kev')).staff, true);
  assert.equal((await access('Kev')).member, true);
  assert.equal((await access('Stranger')).member, false);
  // Even asked directly, an outsider's action is refused before anything is sent.
  const r = await L.liveChatAct(req(), await access('Stranger'), u.Stranger, { action: 'send', msg: 'hello?', to: 'all' });
  assert.deepEqual(r, { ok: false, error: 'Only this event’s players can use its chat.', status: 403 });
});

test('two seats: the picked one speaks; a seat that isn’t theirs falls back to their first', async () => {
  const live = await L.liveAccess(eventId, u.Twin, seatOf.TwinAlt);
  assert.deepEqual(live.seats.map((x) => x.name), ['Twin', 'TwinAlt']);
  assert.equal(live.seatId, seatOf.TwinAlt);
  assert.equal(live.access!.teamId, jade);
  assert.equal(live.access!.rsn, 'TwinAlt');
  const stray = await L.liveAccess(eventId, u.Twin, seatOf.Rikkert);
  assert.equal(stray.seatId, seatOf.Twin);
  assert.equal(stray.access!.teamId, ruby);
  // The chat's team segment follows the seat.
  const chat = await L.liveChat(live.access!, u.Twin, { f: 'team' });
  assert.equal(chat.channel, `team:${jade}`);
});

test('a line sent from the website is the same row and the same push as one from the plugin', async () => {
  const got = await pushes(async () => {
    assert.deepEqual(await L.liveChatAct(req(), await access('Rikkert'), u.Rikkert, { action: 'send', msg: 'from my phone', to: 'team' }), { ok: true });
    assert.equal(await V.chatAct(req('Pkpingu'), 'chat-send', { e: String(eventId), to: 'team' }, { msg: 'from runelite' }) != null, true);
  });
  const stored = await db
    .select({ userId: s.eventChatMessages.userId, rsn: s.eventChatMessages.rsn, channel: s.eventChatMessages.channel, teamId: s.eventChatMessages.teamId, teamOnly: s.eventChatMessages.teamOnly, fromStaff: s.eventChatMessages.fromStaff, body: s.eventChatMessages.body })
    .from(s.eventChatMessages)
    .where(eq(s.eventChatMessages.eventId, eventId))
    .orderBy(s.eventChatMessages.id);
  assert.deepEqual(stored, [
    { userId: u.Rikkert, rsn: 'Rikkert', channel: `team:${ruby}`, teamId: ruby, teamOnly: true, fromStaff: false, body: 'from my phone' },
    { userId: u.Pkpingu, rsn: 'Pkpingu', channel: `team:${ruby}`, teamId: ruby, teamOnly: true, fromStaff: false, body: 'from runelite' },
  ]);
  const rows = got.filter((p) => p.m.t === 'rows');
  assert.equal(rows.length, 2, 'one push per line');
  const [web, plugin] = rows;
  // The same audience (the team's players and the host's staff, by name) and the same list.
  assert.deepEqual([...(web.u ?? [])].sort(), [...(plugin.u ?? [])].sort());
  assert.ok(web.u!.includes(u.Pkpingu) && web.u!.includes(u.Kev) && !web.u!.includes(u.Saltbeard));
  assert.deepEqual(web.m.feeds, [`chat:${eventId}:team:${ruby}`]);
  assert.deepEqual(web.m.feeds, plugin.m.feeds);
  // The same row shape: only the id, the name, the words and the time differ.
  const strip = (r: Record<string, unknown>) => {
    const { id, who, text, at, ...rest } = r;
    void id; void who; void text; void at;
    return rest;
  };
  assert.deepEqual(strip(web.m.rows![0]), strip(plugin.m.rows![0]));
  assert.equal(web.m.rows![0].text, 'from my phone');
  assert.equal(web.m.rows![0].who, 'Rikkert');
});

test('the website keeps the plugin’s rules: links refused, Announcements staff-only, the pace', async () => {
  const salt = await access('Saltbeard');
  assert.deepEqual(await L.liveChatAct(req(), salt, u.Saltbeard, { action: 'send', msg: 'see my-gp-shop.com', to: 'all' }), { ok: false, error: 'Links are for the host and mods.', status: 400 });
  assert.deepEqual(await L.liveChatAct(req(), salt, u.Saltbeard, { action: 'send', msg: 'hi', to: 'announce' }), { ok: false, error: 'Only the host and mods post here.', status: 400 });
  const chat = await L.liveChat(salt, u.Saltbeard, { f: 'announce' });
  assert.deepEqual(chat.lock, { locked: 'Only the host and mods post here', sub: 'Reply in My team or All teams.' });
  assert.equal(chat.pace, 'slow mode 5s · Supporters chat faster');
  assert.equal(chat.prompt, 'Announce to everyone');
  assert.equal(chat.empty, 'No announcements yet.');
});

test('unread counts per channel, and opening one marks it read', async () => {
  const kev = await access('Kev');
  assert.deepEqual(await L.liveChatAct(req(), kev, u.Kev, { action: 'send', msg: 'gl everyone', to: 'all' }), { ok: true });
  const salt = await access('Saltbeard');
  let chat = await L.liveChat(salt, u.Saltbeard, { f: 'team' });
  assert.deepEqual(chat.channels.map((c) => [c.label, c.n, c.on]), [['My team', 0, true], ['All teams', 1, false], ['Announcements', 0, false]]);
  chat = await L.liveChat(salt, u.Saltbeard, { f: 'all', rd: chat.channel });
  assert.deepEqual(chat.lines.map((l) => l.body), ['gl everyone']);
  assert.deepEqual(chat.lines[0].tag, { label: 'MOD', color: '#8cc8ff' });
  chat = await L.liveChat(salt, u.Saltbeard, { f: 'team', rd: 'all' });
  assert.equal(chat.channels.find((c) => c.key === 'all')!.n, 0, 'read on view');
  // Rikkert's own line never counts as unread for him; Pkpingu's does.
  const rik = await L.liveChat(await access('Rikkert'), u.Rikkert, { f: 'all' });
  assert.equal(rik.channels.find((c) => c.key === 'team')!.n, 1);
  // Looking at a channel reads it, without leaving it: the event page's unread dot (lib/eventTabs) goes out.
  assert.equal((await C.sendChat(kev, u.Kev, 'round two', 'all', Date.now() + 60_000)).ok, true); // past slow mode
  assert.equal((await C.chatUnread(salt, u.Saltbeard, ['all'])).get('all'), 1);
  await L.liveChat(salt, u.Saltbeard, { f: 'all' });
  assert.equal((await C.chatUnread(salt, u.Saltbeard, ['all'])).get('all'), 0);
});

test('staff: team chips, delete on a line they outrank, and it leaves every open plugin list', async () => {
  const kev = await access('Kev');
  const chat = await L.liveChat(kev, u.Kev, { f: 'team', tm: String(ruby) });
  assert.equal(chat.channel, `team:${ruby}`);
  assert.deepEqual(chat.teamPicks?.map((t) => [t.name, t.on]), [['Jade', false], ['Ruby', true]]);
  assert.equal(chat.ownTeam, null, 'not seated: nothing to narrow to');
  const line = chat.lines.find((l) => l.body === 'from my phone')!;
  assert.equal(line.canMod, true);
  // A player sees no mod actions, and can't delete.
  const rik = await L.liveChat(await access('Rikkert'), u.Rikkert, { f: 'team' });
  assert.equal(rik.lines.find((l) => l.body === 'from runelite')!.canMod, false);
  assert.equal(rik.lines.find((l) => l.body === 'from my phone')!.mine, true);
  assert.equal((await L.liveChatAct(req(), await access('Pkpingu'), u.Pkpingu, { action: 'delete', id: line.id })).ok, false);

  const got = await pushes(async () => {
    assert.deepEqual(await L.liveChatAct(req(), kev, u.Kev, { action: 'delete', id: line.id }), { ok: true });
  });
  assert.deepEqual(got.find((p) => p.m.t === 'rowsdel')?.m.ids, [`c${line.id}`]);
  assert.equal((await L.liveChat(kev, u.Kev, { f: 'team', tm: String(ruby) })).lines.some((l) => l.id === line.id), false);
});

test('“Only my team’s chat”: a moderator who plays narrows to their team, with the panel’s words', async () => {
  let mara = await access('Mara');
  let chat = await L.liveChat(mara, u.Mara, { f: 'team', tm: String(ruby) });
  assert.deepEqual(chat.ownTeam, { on: false, label: 'Only my team’s chat', tip: 'Hide other teams’ chats while you play' });
  assert.equal(chat.channel, `team:${ruby}`, 'staff read any team’s channel');
  assert.deepEqual(await L.liveChatAct(req(), mara, u.Mara, { action: 'own-team', on: true }), { ok: true });
  mara = await access('Mara');
  chat = await L.liveChat(mara, u.Mara, { f: 'team', tm: String(ruby) });
  assert.equal(chat.channel, `team:${jade}`, 'Ruby’s channel is closed to her now');
  assert.equal(chat.teamPicks, null);
  assert.deepEqual(chat.ownTeam, { on: true, label: 'See every team’s chat', tip: 'Read and answer in every team’s chat again' });
  assert.equal((await L.liveChatAct(req(), mara, u.Mara, { action: 'send', msg: 'psst', to: `team:${ruby}` })).ok, false);
  // Her staff powers elsewhere stay: she still posts announcements.
  assert.equal((await L.liveChatAct(req(), mara, u.Mara, { action: 'send', msg: 'tile 9 is live', to: 'announce' })).ok, true);
  // A player is never offered it.
  assert.equal((await L.liveChat(await access('Saltbeard'), u.Saltbeard, { f: 'team' })).ownTeam, null);
});

test('pause: the box locks for players with the panel’s words, staff keep talking', async () => {
  const kev = await access('Kev');
  assert.deepEqual(await L.liveChatAct(req(), kev, u.Kev, { action: 'pause', on: true }), { ok: true });
  const salt = await access('Saltbeard');
  assert.deepEqual((await L.liveChat(salt, u.Saltbeard, { f: 'all' })).lock, { locked: 'The host has paused chat.' });
  assert.equal((await L.liveChat(await access('Kev'), u.Kev, { f: 'all' })).lock, null);
  await L.liveChatAct(req(), await access('Kev'), u.Kev, { action: 'pause', on: false });
  assert.equal((await L.liveChat(await access('Saltbeard'), u.Saltbeard, { f: 'all' })).lock, null);
});

test('the Feed: the board’s moments and finished tiles, newest first, the panel’s filters, reactions', async () => {
  const [m1] = await db
    .insert(s.moments)
    .values({ clanMemberId: (await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, acct.Saltbeard)))[0].id, rsn: 'Saltbeard', kind: 'pet', itemId: 12_921, itemName: 'Pet snakeling', eventId, teamId: jade, occurredAt: '2026-11-09T10:00:00.000Z', dedupKey: 'p1' })
    .returning();
  const [tile] = await db.insert(s.tiles).values({ eventId, label: 'Any Zulrah unique', position: 1 }).returning();
  await db.insert(s.completions).values({ teamId: ruby, tileId: tile.id, completedAt: '2026-11-09 11:00:00' });
  const feed = await L.liveFeed(await access('Rikkert'), u.Rikkert, 'all', undefined);
  assert.deepEqual(feed.filters.map((f) => f.id), ['all', 'tiles', 'drops', 'pets', 'achievements', 'deaths', 'milestones', 'team']);
  assert.deepEqual(feed.rows.map((r) => r.title), ['Any Zulrah unique', 'Pet: Pet snakeling']);
  assert.equal(feed.rows[0].mine, true, 'Rikkert’s team finished it');
  assert.equal(feed.more, false);
  assert.equal(feed.reactions?.canReact, true);
  assert.deepEqual(feed.reactions?.byMoment[m1.id]?.map((c) => c.kind), ['gz']);
  const pets = await L.liveFeed(await access('Rikkert'), u.Rikkert, 'pets', undefined);
  assert.deepEqual(pets.rows.map((r) => r.title), ['Pet: Pet snakeling']);
  // A filter that isn't one, or My team for someone with no team, is All.
  assert.equal((await L.liveFeed(await access('Kev'), u.Kev, 'team', undefined)).filter, 'all');
  assert.equal((await L.liveFeed(await access('Kev'), u.Kev, 'nonsense', undefined)).filter, 'all');
});

test('the pulse moves with a new line and a new moment, and holds still otherwise', async () => {
  const salt = await access('Saltbeard');
  const wait = () => new Promise((r) => setTimeout(r, 5_100));
  const a = await L.livePulse(salt);
  assert.deepEqual(await L.liveChatAct(req(), await access('Twin'), u.Twin, { action: 'send', msg: 'pulse check', to: 'all' }), { ok: true });
  await wait();
  const b = await L.livePulse(salt);
  assert.notEqual(b.c, a.c);
  assert.equal(b.f, a.f);
  await db.insert(s.moments).values({ clanMemberId: (await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, acct.Rikkert)))[0].id, rsn: 'Rikkert', kind: 'death', source: 'Vorkath', eventId, teamId: ruby, occurredAt: '2026-11-09T12:00:00.000Z', dedupKey: 'd1' });
  await wait();
  const c = await L.livePulse(salt);
  assert.equal(c.c, b.c);
  assert.notEqual(c.f, b.f);
});

test('the push ticket follows chatAccess: a player their team, a host every team, “Only my team’s chat” theirs, an outsider none', async () => {
  const rik = await L.liveTicket(await access('Rikkert'), u.Rikkert);
  assert.deepEqual(rik, { userId: u.Rikkert, eventIds: [eventId], teamId: ruby, rows: true, web: true });
  const kev = await L.liveTicket(await access('Kev'), u.Kev);
  assert.deepEqual(kev, { userId: u.Kev, eventIds: [eventId], teamId: null, rows: true, web: true, teamIds: [ruby, jade] });
  // Mara chose "Only my team's chat" above: just Jade, like a player.
  let mara = await access('Mara');
  assert.equal(mara.ownTeamOnly, true);
  assert.deepEqual(await L.liveTicket(mara, u.Mara), { userId: u.Mara, eventIds: [eventId], teamId: jade, rows: true, web: true });
  assert.deepEqual(await L.liveChatAct(req(), mara, u.Mara, { action: 'own-team', on: false }), { ok: true });
  mara = await access('Mara');
  assert.deepEqual((await L.liveTicket(mara, u.Mara))?.teamIds, [ruby]);
  assert.equal(await L.liveTicket(await access('Stranger'), u.Stranger), null);
  assert.equal(await L.liveTicket(null, u.Stranger), null);
});
