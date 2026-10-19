// "Connect your Discord server": the server comes back from Discord's token response and is bound to
// the clan named in a cookie. Every way that could be abused has to be refused here — the cookie
// names a clan the approver doesn't run, the approver can't manage the server, another clan already
// holds it, the bot isn't the login app — and the happy path has to leave a VERIFIED binding.
//
// Discord is a stubbed fetch: the bot is "111" (= DISCORD_CLIENT_ID), G1 is owned by the admin's
// Discord account, G2 is somebody else's server the admin is only a plain member of.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('discord-bot-connect');

process.env.DISCORD_CLIENT_ID = '111';
process.env.DISCORD_CLIENT_SECRET = 'secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost/api/auth/discord/callback';
process.env.ANVIL_SHARED_BOT_TOKEN = 'shared-token';
delete process.env.DISCORD_BOT_TOKEN;

let botId = '111';
const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith('/users/@me')) return json({ id: botId, username: 'Anvil' });
  if (url.endsWith('/guilds/G1')) return json({ name: 'Admin Server', owner_id: 'D-ADMIN' });
  if (url.endsWith('/guilds/G2')) return json({ name: 'Someone Else', owner_id: 'D-OTHER' });
  if (url.includes('/guilds/G2/members/')) return json({ roles: [] });
  if (url.endsWith('/guilds/G2/roles')) return json([{ id: 'G2', permissions: '0' }]);
  if (url.includes('/members/')) return json({ message: 'Unknown Member' }, 404);
  if (url.endsWith('/roles')) return json([]);
  return json({});
}) as typeof fetch;

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let C: typeof import('../src/lib/discordBotConnect.ts');
let clanA: number;
let clanB: number;

const tokenSet = (guildId: string | null) => ({
  accessToken: 'a',
  refreshToken: null,
  expiresIn: 0,
  scope: 'identify bot applications.commands',
  guild: guildId ? { id: guildId, name: 'x' } : null,
});

async function guildOf(clanId: number) {
  const { db, schema: s } = await loadDb();
  const rows = await db.select().from(s.settings).where(eq(s.settings.clanId, clanId));
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  return { id: get('discord_guild_id'), verified: get('discord_guild_verified_id') };
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  C = await import('../src/lib/discordBotConnect.ts');
  const clans = await db.insert(s.clans).values([{ slug: 'alpha', name: 'Alpha' }, { slug: 'bravo', name: 'Bravo' }]).returning();
  clanA = clans[0].id;
  clanB = clans[1].id;
  const [admin, member] = await db
    .insert(s.users)
    .values([
      { discordId: 'D-ADMIN', displayName: 'Admin' },
      { discordId: 'D-MEMBER', displayName: 'Member' },
    ])
    .returning();
  await db.insert(s.clanStaff).values([
    { clanId: clanA, userId: admin.id, role: 'admin' },
    { clanId: clanA, userId: member.id, role: 'moderator' },
  ]);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a cookie naming a clan the approver does not run binds nothing', async () => {
  const r = await C.finishBotConnect({ clanIdCookie: String(clanB), tokenSet: tokenSet('G1'), discordUserId: 'D-ADMIN' });
  assert.deepEqual(r, { ok: false, clanSlug: 'bravo', error: 'not-admin' });
  assert.equal((await guildOf(clanB)).id, null);
});

test('a moderator is not enough', async () => {
  const r = await C.finishBotConnect({ clanIdCookie: String(clanA), tokenSet: tokenSet('G1'), discordUserId: 'D-MEMBER' });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.error, 'not-admin');
});

test('a server the approver cannot manage is refused', async () => {
  const r = await C.finishBotConnect({ clanIdCookie: String(clanA), tokenSet: tokenSet('G2'), discordUserId: 'D-ADMIN' });
  assert.equal(!r.ok && r.error, 'cant-manage');
  assert.equal((await guildOf(clanA)).id, null);
});

test('no server in the token response binds nothing', async () => {
  const r = await C.finishBotConnect({ clanIdCookie: String(clanA), tokenSet: tokenSet(null), discordUserId: 'D-ADMIN' });
  assert.equal(!r.ok && r.error, 'no-server');
});

test('a bot that is not the login app cannot use this path', async () => {
  botId = '222';
  try {
    const r = await C.finishBotConnect({ clanIdCookie: String(clanA), tokenSet: tokenSet('G1'), discordUserId: 'D-ADMIN' });
    assert.equal(!r.ok && r.error, 'no-shared-bot');
  } finally {
    botId = '111';
  }
});

test('an admin who owns the server binds it, verified', async () => {
  const r = await C.finishBotConnect({ clanIdCookie: String(clanA), tokenSet: tokenSet('G1'), discordUserId: 'D-ADMIN' });
  assert.deepEqual(r, { ok: true, clanSlug: 'alpha', guildName: 'x' });
  assert.deepEqual(await guildOf(clanA), { id: 'G1', verified: 'G1' });
});

test('a server another clan holds is refused', async () => {
  const { db, schema: s } = await loadDb();
  const [admin] = await db.select().from(s.users).where(eq(s.users.discordId, 'D-ADMIN'));
  await db.insert(s.clanStaff).values({ clanId: clanB, userId: admin.id, role: 'admin' });
  const r = await C.finishBotConnect({ clanIdCookie: String(clanB), tokenSet: tokenSet('G1'), discordUserId: 'D-ADMIN' });
  assert.equal(!r.ok && r.error, 'claimed');
  assert.equal((await guildOf(clanB)).id, null);
  await db.delete(s.clanStaff).where(and(eq(s.clanStaff.clanId, clanB), eq(s.clanStaff.userId, admin.id)));
});

test('a garbage cookie is an expired connect, not an error', async () => {
  const r = await C.finishBotConnect({ clanIdCookie: 'nope', tokenSet: tokenSet('G1'), discordUserId: 'D-ADMIN' });
  assert.deepEqual(r, { ok: false, clanSlug: null, error: 'connect-expired' });
});
