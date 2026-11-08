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
let clanId: number;
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
  clanId = clan.id;
  [{ id: ruby }, { id: jade }] = await db.insert(s.teams).values([{ eventId, name: 'Ruby', color: '#cf4a3e' }, { eventId, name: 'Jade', color: '#3ecf62' }]).returning();
  const names = ['Rikkert', 'Pkpingu', 'Saltbeard', 'Kev', 'Stranger', 'Ada', 'Opal'];
  for (const [i, n] of names.entries()) {
    const p = await person(n, i);
    u[n] = p.userId;
    if (n === 'Rikkert' || n === 'Pkpingu') await db.insert(s.eventParticipants).values({ eventId, name: n, accountId: p.accountId, teamId: ruby });
    if (n === 'Saltbeard') await db.insert(s.eventParticipants).values({ eventId, name: n, accountId: p.accountId, teamId: jade });
  }
  // Kev is the clan's moderator, not playing.
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: u.Kev, role: 'moderator' });
  // Ada is the clan's admin; Opal is Anvil platform staff with no job in the clan.
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: u.Ada, role: 'admin' });
  await db.update(s.users).set({ platformRole: 'staff' }).where(eq(s.users.id, u.Opal));
  // Off until staff turn it on (it needs the plugin's Feed tab).
  assert.equal(await C.platformChatOn(true), false);
  await C.setPlatformChat(true);
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
  const r = await C.sendChat(await access('Stranger'), u.Stranger, 'hello?', 'all', later());
  assert.deepEqual(r, { ok: false, error: 'Only this event’s players can chat here.' });
});

test('a line to everyone, a line to the team, and who reads which', async () => {
  assert.deepEqual(await C.sendChat(await access('Rikkert'), u.Rikkert, 'anyone need a zulrah duo?', 'all', later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'ruby only: go tile 9', 'team', later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Saltbeard'), u.Saltbeard, 'gl all', 'all', later()), { ok: true });

  const all = await C.chatHistory(await access('Saltbeard'), u.Saltbeard, 'all');
  assert.deepEqual(all.map((r) => r.text), ['gl all', 'anyone need a zulrah duo?'], 'team-only lines stay out of All');
  const rubyTeam = await C.chatHistory(await access('Rikkert'), u.Rikkert, `team:${ruby}`);
  assert.deepEqual(rubyTeam.map((r) => r.text), ['ruby only: go tile 9'], 'a team channel holds only what was said in it');
  assert.equal(rubyTeam[0].tag, 'Ruby');
  const jadeTeam = await C.chatHistory(await access('Saltbeard'), u.Saltbeard, `team:${jade}`);
  assert.deepEqual(jadeTeam.map((r) => r.text), []);
  assert.equal(all[1].mine, undefined, 'not Saltbeard’s');
  assert.equal((await C.chatHistory(await access('Rikkert'), u.Rikkert, 'all'))[1].mine, true);
});

test('links and gold adverts are refused; a mod may post a link', async () => {
  assert.equal((await C.sendChat(await access('Rikkert'), u.Rikkert, 'see my-gp-shop.com', 'all', later())).ok, false);
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'rules: anvilosrs.com/c/forge', 'all', later())).ok, true);
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'tile 9 is live', 'announce', later())).ok, true);
  const mods = await C.chatHistory(await access('Kev'), u.Kev, 'announce');
  assert.deepEqual(mods.map((r) => r.tag), ['MOD']);
});

test('one person can’t flood: the second line inside the gap waits', async () => {
  const at = later();
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'one', 'all', at)).ok, true);
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'two', 'all', at + 200)).ok, false);
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
  const r = await C.sendChat(await access('Rikkert'), u.Rikkert, 'why', 'all', later());
  // The plugin's "Mute" is a ban until lifted, in the same model as the moderation page.
  assert.deepEqual(r, { ok: false, error: 'You’ve been removed from this event’s chat.' });
});

test('pause makes it read-only for players, not for staff', async () => {
  assert.deepEqual(await C.pauseChat(await access('Kev'), true), { ok: true });
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hello', 'all', later())).ok, false);
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'back in 5', 'all', later())).ok, true);
  await C.pauseChat(await access('Kev'), false);
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hello again', 'all', later())).ok, true);
});

test('moderation page model: delete, timeout, ban and lift, all audited', async () => {
  // Rikkert's ban from the plugin's right-click shows on the page, and a mod may lift it.
  let list = await C.chatSanctions(await access('Kev'), u.Kev, later());
  assert.deepEqual(list.map((x) => [x.name, x.kind, x.canLift, x.byName]), [['Rikkert', 'ban', true, 'Kev']]);
  assert.deepEqual(await C.liftChatSanction(await access('Kev'), u.Kev, u.Rikkert), { ok: true });
  assert.equal((await C.sendChat(await access('Rikkert'), u.Rikkert, 'thanks', 'all', later())).ok, true);
  assert.deepEqual(await C.liftChatSanction(await access('Kev'), u.Kev, u.Rikkert), { ok: false, error: 'They aren’t timed out or banned.' });

  // Search and filters see every line, team-only ones included.
  assert.equal((await C.sendChat(await access('Saltbeard'), u.Saltbeard, 'jade team, regroup at tile 4', 'team', later())).ok, true);
  const found = await C.chatModLines(eventId, { q: 'REGROUP' });
  assert.deepEqual(found.map((l) => [l.rsn, l.teamOnly]), [['Saltbeard', true]]);
  assert.ok((await C.chatModLines(eventId, { filter: `team:${jade}` })).every((l) => l.channel === `team:${jade}`));
  assert.ok((await C.chatModLines(eventId, { filter: 'staff' })).every((l) => l.fromStaff));
  assert.equal((await C.chatModLines(eventId, { q: '100%_' })).length, 0, 'wildcards are text');

  // Delete through the shared path: gone from the page and the plugin's history.
  assert.deepEqual(await C.deleteChat(await access('Kev'), u.Kev, found[0].id), { ok: true });
  assert.equal((await C.chatModLines(eventId, { q: 'regroup' })).length, 0);
  assert.equal((await C.deleteChat(await access('Kev'), u.Kev, found[0].id)).ok, false, 'already gone');

  // A 5-minute timeout: refused with the time left, then free once it runs out.
  const t0 = later();
  assert.deepEqual(await C.sanctionChat(await access('Kev'), u.Kev, u.Saltbeard, { kind: 'timeout', minutes: 5, reason: 'spam' }, t0), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Saltbeard'), u.Saltbeard, 'hey', 'all', t0 + 60_000), {
    ok: false,
    error: 'You’re timed out of this event’s chat for 4 more minutes.',
  });
  list = await C.chatSanctions(await access('Kev'), u.Kev, t0 + 60_000);
  assert.deepEqual(list.map((x) => [x.name, x.kind, x.reason]), [['Saltbeard', 'timeout', 'spam']]);
  assert.equal((await C.chatSanctions(await access('Kev'), u.Kev, t0 + 6 * 60_000)).length, 0, 'expired timeouts leave the list');
  t = t0 + 6 * 60_000;
  assert.equal((await C.sendChat(await access('Saltbeard'), u.Saltbeard, 'back', 'all', later())).ok, true);

  // Ranks: a mod can't touch the admin; the admin can time out the mod, whose staff seat doesn't
  // exempt them; Anvil staff outrank the clan's admin; nobody can lift their own.
  assert.equal((await C.sendChat(await access('Ada'), u.Ada, 'admin here', 'all', later())).ok, true);
  assert.equal((await C.sanctionChat(await access('Kev'), u.Kev, u.Ada, { kind: 'ban' })).ok, false);
  assert.equal((await C.sanctionChat(await access('Kev'), u.Kev, u.Kev, { kind: 'ban' })).ok, false);
  assert.equal((await C.sanctionChat(await access('Kev'), u.Kev, u.Stranger, { kind: 'ban' })).ok, false, 'not on this chat');
  const t1 = later();
  assert.deepEqual(await C.sanctionChat(await access('Ada'), u.Ada, u.Kev, { kind: 'timeout', minutes: 60 }, t1), { ok: true });
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'hm', 'all', t1 + 1_000)).ok, false, 'staff aren’t exempt from a timeout');
  assert.equal((await C.chatSanctions(await access('Kev'), u.Kev, t1 + 1_000))[0].canLift, false, 'not their own');
  assert.equal((await C.liftChatSanction(await access('Kev'), u.Kev, u.Kev)).ok, false);
  assert.deepEqual(await C.liftChatSanction(await access('Ada'), u.Ada, u.Kev), { ok: true });

  assert.equal((await access('Opal')).staffKind, 'platform');
  assert.equal((await access('Kev')).staffKind, 'event');
  assert.deepEqual(await C.sanctionChat(await access('Opal'), u.Opal, u.Ada, { kind: 'ban', reason: 'test' }), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Ada'), u.Ada, 'oi', 'all', later()), { ok: false, error: 'You’ve been removed from this event’s chat.' });
  assert.equal((await C.liftChatSanction(await access('Ada'), u.Ada, u.Ada)).ok, false);
  assert.deepEqual(await C.liftChatSanction(await access('Opal'), u.Opal, u.Ada), { ok: true });

  // Pause from the page is audited too.
  await C.pauseChat(await access('Kev'), true, u.Kev);
  await C.pauseChat(await access('Kev'), false, u.Kev);

  const log = await db.select({ type: s.clanAuditLog.eventType, actor: s.clanAuditLog.actorUserId }).from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, clanId));
  const types = log.map((l) => l.type);
  for (const k of ['event_chat_banned', 'event_chat_timed_out', 'event_chat_sanction_lifted', 'event_chat_message_deleted', 'event_chat_paused', 'event_chat_resumed']) {
    assert.ok(types.includes(k), `${k} logged`);
  }
  assert.equal(types.filter((k) => k === 'event_chat_sanction_lifted').length, 3);
});

test('deleting follows rank: own lines, or a sender strictly below you', async () => {
  const say = async (who: string, text: string) => {
    assert.equal((await C.sendChat(await access(who), u[who], text, 'all', later())).ok, true);
    return (await C.chatModLines(eventId, { q: text }))[0].id;
  };
  const adaLine = await say('Ada', 'admin words');
  assert.deepEqual(await C.deleteChat(await access('Kev'), u.Kev, adaLine), { ok: false, error: 'Only someone above them on staff can remove that.' });
  // The plugin's menu doesn't offer it either.
  const kevView = await C.chatHistory(await access('Kev'), u.Kev, 'all');
  assert.equal(kevView.find((r) => r.text === 'admin words')?.menu, undefined);
  assert.equal((await C.chatHistory(await access('Ada'), u.Ada, 'all')).find((r) => r.text === 'admin words')?.menu, undefined, 'own line: no menu');

  const kevLine = await say('Kev', 'mod words');
  assert.deepEqual(await C.deleteChat(await access('Ada'), u.Ada, kevLine), { ok: true }, 'an admin can remove a mod’s line');
  assert.deepEqual(await C.deleteChat(await access('Opal'), u.Opal, adaLine), { ok: true }, 'Anvil staff can remove anyone’s');
  const ownLine = await say('Kev', 'oops typo');
  assert.deepEqual(await C.deleteChat(await access('Kev'), u.Kev, ownLine), { ok: true }, 'their own line');
  const rikLine = await say('Rikkert', 'player words');
  assert.equal((await C.deleteChat(await access('Rikkert'), u.Rikkert, rikLine)).ok, false, 'players can’t delete, even their own (as before)');
  assert.deepEqual(await C.deleteChat(await access('Kev'), u.Kev, rikLine), { ok: true });
});

test('a timeout that runs out is swept and the person’s box unlocks', async () => {
  const listener = new (await import('pg')).default.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  const locks: { u?: number[]; m: { t: string; locked: string | null; warn?: number } }[] = [];
  listener.on('notification', (n) => {
    const p = JSON.parse(n.payload!);
    if (p.k === 'rows' && p.m?.t === 'rowslock') locks.push(p);
  });
  await listener.query('LISTEN anvil_push');

  const t0 = Date.now();
  // Earlier tests ran on a fake clock: their timeouts are long expired. Clear them first.
  await C.sweepExpiredChatTimeouts(t0);
  assert.deepEqual(await C.sanctionChat(await access('Kev'), u.Kev, u.Pkpingu, { kind: 'timeout', minutes: 5 }, t0), { ok: true });
  assert.equal(await C.sweepExpiredChatTimeouts(t0 + 60_000), 0, 'still running');
  assert.equal(await C.sweepExpiredChatTimeouts(t0 + 6 * 60_000), 1);
  assert.equal(await C.chatBlockOf(eventId, u.Pkpingu, t0 + 6 * 60_000), null);
  assert.equal((await db.select().from(s.eventChatMutes).where(eq(s.eventChatMutes.userId, u.Pkpingu))).length, 0);
  // A ban is never swept.
  await C.sanctionChat(await access('Kev'), u.Kev, u.Pkpingu, { kind: 'ban' }, t0);
  assert.equal(await C.sweepExpiredChatTimeouts(t0 + 365 * 86_400_000), 0);
  await C.liftChatSanction(await access('Kev'), u.Kev, u.Pkpingu);

  await new Promise((r) => setTimeout(r, 150));
  await listener.end();
  const mine = locks.filter((l) => l.u?.includes(u.Pkpingu)).map((l) => l.m.locked);
  assert.deepEqual(mine.slice(0, 2), ['You’re timed out · 5m left', null], 'locked with the reason, then unlocked at expiry');
});

test('the host’s switch and the platform’s each close it', async () => {
  await C.setEventChat(eventId, false);
  assert.equal((await access('Pkpingu')).open, false);
  assert.equal((await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hi', 'all', later())).ok, false);
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

test('one person, two characters on two teams of one board: each client speaks and reads as its own character', async () => {
  // Drenvox (Ruby) and Denoverse (Sapphire): one Anvil person, both clients signed in as them.
  const [clan] = await db.insert(s.clans).values({ slug: 'twoseat', name: 'Two Seat' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Alt Bingo', boardSize: 5, chatEnabled: true }).returning();
  const [{ id: rubyT }, { id: sapphire }] = await db
    .insert(s.teams)
    .values([{ eventId: ev.id, name: 'Ruby', color: '#cf4a3e' }, { eventId: ev.id, name: 'Sapphire', color: '#3e6acf' }])
    .returning();
  const [pl] = await db.insert(s.players).values({ displayName: 'Dren' }).returning();
  const [dren] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'Drenvox', rsnNormalized: 'drenvox', accountHash: '1111' }).returning();
  const [deno] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'Denoverse', rsnNormalized: 'denoverse', accountHash: '2222' }).returning();
  const [me] = await db.insert(s.users).values({ playerId: pl.id, displayName: 'Dren', discordId: '99210000000000001' }).returning();
  await db.insert(s.eventParticipants).values([
    { eventId: ev.id, name: 'Drenvox', accountId: dren.id, teamId: rubyT },
    { eventId: ev.id, name: 'Denoverse', accountId: deno.id, teamId: sapphire },
  ]);

  // How the plugin's requests name them (lib/pluginUi/feedView chatCharacter): hash first, else the name.
  const asDeno = (await C.chatAccess(ev.id, me.id, { accountHash: '2222', rsn: 'Denoverse' }))!;
  const asDren = (await C.chatAccess(ev.id, me.id, { rsn: 'drenvox' }))!;
  assert.equal(asDeno.teamId, sapphire);
  assert.equal(asDeno.rsn, 'Denoverse');
  assert.equal(asDren.teamId, rubyT);
  assert.equal(asDren.rsn, 'Drenvox');
  // A renamed character still found by its hash; no character named falls back to the first seat (as before).
  assert.equal((await C.chatAccess(ev.id, me.id, { accountHash: '2222', rsn: 'Old Name' }))!.teamId, sapphire);
  assert.equal((await C.chatAccess(ev.id, me.id, null))!.teamId, rubyT);
  // A character of theirs that ISN'T seated here (GIM Drenvox) speaks as nobody on this board: no
  // seat, no team, no rsn borrowed from Drenvox or Denoverse.
  const asGim = (await C.chatAccess(ev.id, me.id, { accountHash: '9999', rsn: 'GIM Drenvox' }))!;
  assert.equal(asGim.teamId, null);
  assert.notEqual(asGim.rsn, 'Drenvox');
  assert.notEqual(asGim.rsn, 'Denoverse');

  const listener = new (await import('pg')).default.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  const notices: { u?: number[]; e?: number; m: { feeds: string[]; rows: { text: string }[] } }[] = [];
  listener.on('notification', (n) => {
    const p = JSON.parse(n.payload!);
    if (p.k === 'rows' && p.m?.t === 'rows') notices.push(p);
  });
  await listener.query('LISTEN anvil_push');

  assert.deepEqual(await C.sendChat(asDeno, me.id, 'from the sapphire client', 'all', later()), { ok: true });
  assert.deepEqual(await C.sendChat(asDren, me.id, 'from the ruby client', 'all', later()), { ok: true });
  assert.deepEqual(await C.sendChat(asDeno, me.id, 'sapphire only', 'team', later()), { ok: true });
  await new Promise((r) => setTimeout(r, 150));
  await listener.end();

  const stored = await db
    .select({ rsn: s.eventChatMessages.rsn, teamId: s.eventChatMessages.teamId, teamOnly: s.eventChatMessages.teamOnly, body: s.eventChatMessages.body })
    .from(s.eventChatMessages)
    .where(eq(s.eventChatMessages.eventId, ev.id))
    .orderBy(s.eventChatMessages.id);
  assert.deepEqual(stored, [
    { rsn: 'Denoverse', teamId: sapphire, teamOnly: false, body: 'from the sapphire client' },
    { rsn: 'Drenvox', teamId: rubyT, teamOnly: false, body: 'from the ruby client' },
    { rsn: 'Denoverse', teamId: sapphire, teamOnly: true, body: 'sapphire only' },
  ]);

  // The team-only line is pushed for Sapphire's team feed alone, never Ruby's.
  const teamOnly = notices.find((n) => n.m.rows[0]?.text === 'sapphire only')!;
  assert.deepEqual(teamOnly.m.feeds, [`chat:${ev.id}:team:${sapphire}`]);

  // My team: each client reads its own character's team. "Mine" is the PERSON's lines (Ahmed asked
  // for it per person): Denoverse's line is still theirs when read from the Drenvox client.
  assert.deepEqual(await C.sendChat(asDren, me.id, 'ruby only', 'team', later()), { ok: true });
  const rubyFeed = await C.chatHistory(asDren, me.id, `team:${rubyT}`);
  assert.deepEqual(rubyFeed.map((r) => r.text), ['ruby only']);
  const sapphireFeed = await C.chatHistory(asDeno, me.id, `team:${sapphire}`);
  assert.deepEqual(sapphireFeed.map((r) => r.text), ['sapphire only']);
  const allAsDren = await C.chatHistory(asDren, me.id, 'all');
  assert.deepEqual(allAsDren.map((r) => [r.text, r.mine ?? false]), [
    ['from the ruby client', true],
    ['from the sapphire client', true],
  ]);
});

test('channels: a team reads only its own, staff read every team’s, only staff announce', async () => {
  const salt = await access('Saltbeard');
  assert.deepEqual(await C.chatHistory(salt, u.Saltbeard, `team:${ruby}`), [], 'Jade can’t read Ruby’s channel');
  assert.deepEqual(await C.sendChat(salt, u.Saltbeard, 'spying', `team:${ruby}`, later()), { ok: false, error: 'That’s another team’s channel.' });
  assert.deepEqual(await C.sendChat(await access('Rikkert'), u.Rikkert, 'ruby: tile 12 next', 'team', later()), { ok: true });
  for (const who of ['Kev', 'Ada', 'Opal']) {
    const rows = await C.chatHistory(await access(who), u[who], `team:${ruby}`);
    assert.ok(rows.some((r) => r.text === 'ruby: tile 12 next'), `${who} (staff) reads Ruby’s channel`);
  }
  assert.ok((await C.chatHistory(salt, u.Saltbeard, 'all')).every((r) => r.text !== 'ruby: tile 12 next'), 'a team line stays off All teams');

  assert.deepEqual(await C.sendChat(await access('Rikkert'), u.Rikkert, 'listen up', 'announce', later()), { ok: false, error: 'Only the host and mods post here.' });
  assert.deepEqual(await C.sendChat(await access('Ada'), u.Ada, 'reveal at 14:30', 'announce', later()), { ok: true });
  const ann = await C.chatHistory(salt, u.Saltbeard, 'announce');
  assert.equal(ann[0].text, 'reveal at 14:30', 'everyone reads announcements');
  assert.equal(ann[0].tag, 'HOST');
});

test('channels: pause closes All and teams for players, staff still announce; a timeout closes every channel', async () => {
  await C.setEventChatPaused(eventId, true);
  assert.deepEqual(await C.sendChat(await access('Rikkert'), u.Rikkert, 'hello', 'all', later()), { ok: false, error: 'The host has paused chat.' });
  assert.deepEqual(await C.sendChat(await access('Rikkert'), u.Rikkert, 'hello', 'team', later()), { ok: false, error: 'The host has paused chat.' });
  assert.deepEqual(await C.sendChat(await access('Kev'), u.Kev, 'paused for a sec', 'announce', later()), { ok: true });
  await C.setEventChatPaused(eventId, false);

  const at = later();
  assert.deepEqual(await C.sanctionChat(await access('Ada'), u.Ada, u.Kev, { kind: 'timeout', minutes: 9 }, at), { ok: true });
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'still here?', 'announce', at + 1_000)).ok, false, 'a timed-out mod can’t announce');
  assert.equal((await C.sendChat(await access('Kev'), u.Kev, 'still here?', `team:${ruby}`, at + 2_000)).ok, false);
  await C.liftChatSanction(await access('Ada'), u.Ada, u.Kev);
});

test('channels: pushes reach only who may read; unread counts move', async () => {
  const listener = new (await import('pg')).default.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  const notices: { u?: number[]; e?: number; m: { t: string; feeds: string[]; rows?: { text: string }[]; locked?: string | null; warn?: number } }[] = [];
  listener.on('notification', (n) => {
    const p = JSON.parse(n.payload!);
    if (p.k === 'rows') notices.push(p);
  });
  await listener.query('LISTEN anvil_push');

  // Saltbeard reads All teams and Announcements now: nothing unread after.
  const salt = await access('Saltbeard');
  await C.chatHistory(salt, u.Saltbeard, 'all');
  await C.chatHistory(salt, u.Saltbeard, 'announce');
  assert.deepEqual([...(await C.chatUnread(salt, u.Saltbeard, ['all', 'announce', `team:${ruby}`]))], [['all', 0], ['announce', 0], [`team:${ruby}`, 0]]);

  assert.deepEqual(await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'ruby secret', 'team', later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hi all', 'all', later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Pkpingu'), u.Pkpingu, 'hi all again', 'all', later()), { ok: true });
  assert.deepEqual(await C.sendChat(await access('Kev'), u.Kev, 'gl', 'announce', later()), { ok: true });
  // A timeout's lock is coral and names every channel.
  const at = later();
  await C.sanctionChat(await access('Kev'), u.Kev, u.Saltbeard, { kind: 'timeout', minutes: 9 }, at);
  await C.liftChatSanction(await access('Kev'), u.Kev, u.Saltbeard);
  await new Promise((r) => setTimeout(r, 200));
  await listener.end();

  const secret = notices.find((n) => n.m.t === 'rows' && n.m.rows?.[0]?.text === 'ruby secret')!;
  assert.deepEqual(secret.m.feeds, [`chat:${eventId}:team:${ruby}`]);
  assert.equal(secret.e, undefined, 'never the board’s room');
  for (const who of ['Rikkert', 'Pkpingu', 'Kev', 'Ada']) assert.ok(secret.u!.includes(u[who]), `${who} hears Ruby’s channel`);
  assert.ok(!secret.u!.includes(u.Saltbeard), 'Jade doesn’t hear Ruby’s channel');
  const announce = notices.find((n) => n.m.t === 'rows' && n.m.rows?.[0]?.text === 'gl')!;
  assert.equal(announce.e, eventId, 'announcements go to the whole board');
  assert.deepEqual(announce.m.feeds, [`chat:${eventId}:announce`]);
  const lock = notices.find((n) => n.m.t === 'rowslock' && n.u?.includes(u.Saltbeard) && n.m.locked)!;
  assert.deepEqual([lock.m.feeds, lock.m.locked, lock.m.warn], [[`chat:${eventId}`], 'You’re timed out · 9m left', 1]);
  const reopen = notices.filter((n) => n.m.t === 'rowslock' && n.u?.includes(u.Saltbeard) && !n.m.locked);
  assert.deepEqual(reopen.map((n) => n.m.feeds), [[`chat:${eventId}:all`, `chat:${eventId}:team`]], 'a player’s Announcements box stays read-only');

  const unread = await C.chatUnread(salt, u.Saltbeard, ['all', 'announce', `team:${ruby}`]);
  assert.deepEqual([...unread], [['all', 2], ['announce', 1], [`team:${ruby}`, 0]], 'a channel they can’t read counts nothing');
  assert.equal((await C.chatUnread(await access('Pkpingu'), u.Pkpingu, ['all'])).get('all'), 0, 'their own lines aren’t unread');
  await C.chatHistory(salt, u.Saltbeard, 'all');
  assert.equal((await C.chatUnread(salt, u.Saltbeard, ['all'])).get('all'), 0, 'viewing a channel reads it');
  await C.markChannelRead(eventId, u.Saltbeard, 'announce');
  assert.equal((await C.chatUnread(salt, u.Saltbeard, ['announce'])).get('announce'), 0, 'leaving a channel reads it too');
  // Staff's count for a team's channel moves like anyone's.
  assert.ok(((await C.chatUnread(await access('Ada'), u.Ada, [`team:${ruby}`])).get(`team:${ruby}`) ?? 0) >= 1);
});
