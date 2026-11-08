// Shared webhooks against a real database (lib/sharedWebhooks): a scan finds the same webhook id in
// two clans, staff block it, and from then on it is refused on send (for every clan, before any
// request leaves) and on save; the clans' admins are told and the block is in the operator log.
//
// Run: npx tsx --test tests/shared-webhooks-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('shared_webhooks');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

const SHARED = 'https://discord.com/api/webhooks/987654321/alphaToken';
// Beta stored the same webhook with a padded id: the canonical parser makes it the same one.
const SHARED_PADDED = 'https://discord.com/api/webhooks/000987654321/alphaToken';
// A third clan pasted the id with a made-up token.
const JUNK = 'https://discord.com/api/webhooks/987654321/junkToken';
const OWN = 'https://discord.com/api/webhooks/123456789/gammaToken';

let alpha: number;
let beta: number;
let staffId: number;
let alphaAdmin: number;
let junkClan: number;
const calls: string[] = [];
const realFetch = globalThis.fetch;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const mk = async (slug: string) => (await db.insert(s.clans).values({ slug, name: slug }).returning())[0].id;
  alpha = await mk('alpha');
  beta = await mk('beta');
  junkClan = await mk('junk');
  const us = await db.insert(s.users).values([{ discordId: '1', displayName: 'Staff' }, { discordId: '2', displayName: 'Alpha admin' }]).returning();
  staffId = us[0].id;
  alphaAdmin = us[1].id;
  await db.insert(s.clanStaff).values({ clanId: alpha, userId: alphaAdmin, role: 'admin' });
  await db.insert(s.settings).values([
    { clanId: alpha, key: 'discord_webhook_bingo', value: `${SHARED} ${OWN}` },
    { clanId: beta, key: 'discord_webhook_url', value: SHARED_PADDED },
    { clanId: junkClan, key: 'discord_webhook_url', value: JUNK },
  ]);
  // Discord: the real token exists, the made-up one does not. Posts answer 204.
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('junkToken')) return new Response(JSON.stringify({ message: 'Unknown Webhook', code: 10015 }), { status: 404 });
    if ((init?.method ?? 'GET') === 'GET') return Response.json({ id: '987654321', channel_id: '5', guild_id: '6' });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a junk-token paste of a real id, alone, creates no finding', async () => {
  const { scanSharedWebhooks, listSharedWebhooks } = await import('../src/lib/sharedWebhooks.ts');
  // Only alpha (real) and the junk clan hold the id at first: beta's row is hidden for this check.
  await db.delete(s.settings).where(eq(s.settings.clanId, beta));
  await scanSharedWebhooks();
  assert.equal((await listSharedWebhooks('all')).length, 0);
  await db.insert(s.settings).values({ clanId: beta, key: 'discord_webhook_url', value: SHARED_PADDED });
});

test('a scan raises the same webhook (id AND token, padded id or not) held by two clans, confirmed by Discord', async () => {
  const { scanSharedWebhooks, listSharedWebhooks } = await import('../src/lib/sharedWebhooks.ts');
  const res = await scanSharedWebhooks();
  assert.equal(res.shared, 1);
  const [f] = await listSharedWebhooks('open');
  assert.equal(f.webhookId, '987654321');
  assert.equal(f.verified, true);
  assert.deepEqual(f.clans.map((c) => c.id).sort(), [alpha, beta].sort(), 'the junk paster is not one of the clans');
  assert.deepEqual(f.uses.filter((u) => !u.tokenMatches).map((u) => u.clanId), [junkClan], 'shown apart');
  assert.equal(f.masked, '…4321');
  assert.ok(!JSON.stringify(f).includes('Token'), 'no token reaches the staff view');
});

test('an unconfirmed finding cannot be blocked', async () => {
  const { actOnSharedWebhook } = await import('../src/lib/sharedWebhooks.ts');
  await db.update(s.sharedWebhooks).set({ verified: false }).where(eq(s.sharedWebhooks.webhookId, '987654321'));
  const res = await actOnSharedWebhook({ webhookId: '987654321', action: 'block', actorUserId: staffId });
  assert.equal(res.ok, false);
  await db.update(s.sharedWebhooks).set({ verified: true }).where(eq(s.sharedWebhooks.webhookId, '987654321'));
});

test('blocking refuses the id on send for every clan, before a request leaves, and keeps the rest', async () => {
  const { actOnSharedWebhook, refuseBlockedWebhooks, listSharedWebhooks } = await import('../src/lib/sharedWebhooks.ts');
  const { deliverWebhook } = await import('../src/lib/discord.ts');
  const res = await actOnSharedWebhook({ webhookId: '987654321', action: 'block', actorUserId: staffId, reason: 'cross-clan' });
  assert.deepEqual(res, { ok: true });

  calls.length = 0;
  const init = () => ({ method: 'POST', body: '{}' });
  const lone = await deliverWebhook(SHARED_PADDED, init);
  assert.equal(lone.ok, false);
  assert.equal(lone.blocked, true);
  assert.deepEqual(calls, [], 'nothing was sent through the blocked webhook');

  // A pool keeps posting through what is left of it.
  const pooled = await deliverWebhook({ urls: [SHARED, OWN], cursorKey: 'alpha:bingo' }, init);
  assert.equal(pooled.ok, true);
  assert.deepEqual(calls, [OWN]);

  // Saving it again is refused, with either token.
  assert.match((await refuseBlockedWebhooks([SHARED_PADDED])) ?? '', /disabled by Anvil staff/);
  assert.equal(await refuseBlockedWebhooks([OWN]), null);

  const [f] = await listSharedWebhooks('all');
  assert.equal(f.status, 'blocked');
  assert.equal(f.blocked, true);
});

test('the event channel save path refuses a blocked webhook', async () => {
  const { resolveChannelInput } = await import('../src/lib/eventDiscordChannel.ts');
  const r = await resolveChannelInput(alpha, { webhookUrl: SHARED_PADDED });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /disabled by Anvil staff/);
});

test("the clans' admins are told, the block is a platform_* audit row per clan, and the dashboard card names where", async () => {
  const notices = await db.select().from(s.userNotices).where(eq(s.userNotices.userId, alphaAdmin));
  assert.equal(notices.length, 1);
  assert.match(notices[0].body, /shared with another clan\. Add a new one\./);
  const junkNotices = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, junkClan));
  assert.equal(junkNotices.length, 0, 'the junk paster is not treated as an owner');
  const audit = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'platform_webhook_blocked'));
  assert.deepEqual(audit.map((a) => a.clanId).sort(), [alpha, beta].sort());
  assert.ok(audit.every((a) => !String(a.newValue).includes('Token')));
  const { clanBlockedWebhookUses } = await import('../src/lib/sharedWebhooks.ts');
  assert.deepEqual(await clanBlockedWebhookUses(alpha), ['Setting discord_webhook_bingo']);
});

test('unblock lets it post again; dismiss takes it off the queue until a new clan joins', async () => {
  const { actOnSharedWebhook, listSharedWebhooks, scanSharedWebhooks } = await import('../src/lib/sharedWebhooks.ts');
  const { deliverWebhook } = await import('../src/lib/discord.ts');
  await actOnSharedWebhook({ webhookId: '987654321', action: 'unblock', actorUserId: staffId });
  calls.length = 0;
  assert.equal((await deliverWebhook(SHARED_PADDED, () => ({ method: 'POST', body: '{}' }))).ok, true);
  assert.equal(calls.length, 1);

  assert.deepEqual(await actOnSharedWebhook({ webhookId: '987654321', action: 'dismiss', actorUserId: staffId }), { ok: true });
  assert.equal((await listSharedWebhooks('open')).length, 0);
  await scanSharedWebhooks(['987654321']);
  assert.equal((await listSharedWebhooks('open')).length, 0, 'same clans: stays dismissed');

  const [third] = await db.insert(s.clans).values({ slug: 'gamma', name: 'gamma' }).returning();
  await db.insert(s.settings).values({ clanId: third.id, key: 'discord_webhook_weekly', value: SHARED });
  await scanSharedWebhooks(['987654321']);
  assert.equal((await listSharedWebhooks('open')).length, 1, 'a new clan reopens it');
});
