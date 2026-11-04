// The Anvil Discord through the Gumroad webhook: a new membership is announced once (not a trial,
// not a renewal, never someone who opted out) and the buyer's tier role follows every change. Discord
// is a fake fetch: nothing leaves the machine.
//
// Run: npx tsx --test tests/anvil-discord.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('anvil-discord');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

const GUILD = '900000000000000001';
const HOOK = 'https://discord.com/api/webhooks/123/abc';
const ROLES = { supporter: 'r-sup', champion: 'r-champ', patron: 'r-pat', subscriber: 'r-sub' };

/** Each fake member's roles, by Discord id; absent = not in the server. */
const members = new Map<string, Set<string>>();
const posts: Array<{ content?: string; allowed_mentions?: { users?: string[] }; embeds: Array<{ title: string; description: string }> }> = [];
const realFetch = globalThis.fetch;

before(async () => {
  await resetDatabase(DB);
  const { pool: p } = await loadDb();
  pool = p;
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
  process.env.GUMROAD_PRODUCT_SUPPORTER = 'prod-supporter';
  process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
  process.env.ANVIL_APEX_DOMAIN = 'anvilosrs.com';
  delete process.env.GUMROAD_ACCESS_TOKEN;
  const { setPlatformSetting } = await import('../src/lib/platformSettings.ts');
  await setPlatformSetting('anvil_discord_guild_id', GUILD);
  await setPlatformSetting('anvil_discord_supporters_webhook', HOOK);
  await setPlatformSetting('anvil_discord_roles_enabled', '1');
  for (const [k, v] of Object.entries(ROLES)) await setPlatformSetting(`anvil_discord_role_${k}`, v);

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? 'GET';
    if (url === HOOK) {
      posts.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    const m = url.match(/\/guilds\/(\d+)\/members\/(\d+)(?:\/roles\/([\w-]+))?$/);
    if (m && m[1] === GUILD) {
      const roles = members.get(m[2]);
      if (!roles) return new Response('{}', { status: 404 });
      if (!m[3]) return Response.json({ user: { id: m[2], username: 'x' }, roles: [...roles] });
      if (method === 'PUT') roles.add(m[3]);
      if (method === 'DELETE') roles.delete(m[3]);
      return new Response(null, { status: 204 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

beforeEach(() => {
  posts.length = 0;
});

async function post(fields: Record<string, string>): Promise<Response> {
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../src/app/api/webhooks/gumroad/route.ts');
  const res = await POST(
    new NextRequest('https://anvilosrs.com/api/webhooks/gumroad?key=test-webhook-secret', {
      method: 'POST',
      body: new URLSearchParams({ seller_id: 'seller-123', product_id: 'prod-supporter', ...fields }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
  const { settleAnvilDiscord } = await import('../src/lib/anvilDiscord.ts');
  await settleAnvilDiscord();
  return res;
}

let n = 0;
async function makeUser(ref: string, opts: { inServer?: boolean; announce?: boolean } = {}) {
  const { db, schema: s } = await loadDb();
  n += 1;
  const discordId = `8000000000000${String(n).padStart(5, "0")}`;
  const [u] = await db
    .insert(s.users)
    .values({ displayName: `Buyer_${n}`, discordId, supporterRef: ref, announceSupporter: opts.announce ?? true })
    .returning();
  if (opts.inServer !== false) members.set(discordId, new Set(['unrelated']));
  return { ...u, discordId };
}

test('a new paid membership is announced once and gets its tier role plus the subscriber role', async () => {
  const u = await makeUser('ref-a');
  await post({ sale_id: 'sale-a1', subscription_id: 'sub-a', 'url_params[ref]': 'ref-a', 'variants[Tier]': 'Champion', recurrence: 'monthly' });
  assert.equal(posts.length, 1);
  assert.match(posts[0].embeds[0].description, /Buyer\\_\d+\*\* just became an Anvil Champion/);
  assert.equal(posts[0].content, `<@${u.discordId}>`, 'in the server: they are tagged');
  assert.deepEqual(posts[0].allowed_mentions?.users, [u.discordId], 'and only they are');
  assert.deepEqual([...members.get(u.discordId)!].sort(), ['r-champ', 'r-sub', 'unrelated']);

  // A renewal at a new tier swaps the tier role and posts nothing.
  await post({ sale_id: 'sale-a2', subscription_id: 'sub-a', is_recurring_charge: 'true', 'variants[Tier]': 'Patron', recurrence: 'monthly' });
  assert.equal(posts.length, 1, 'a renewal is not a new supporter');
  assert.deepEqual([...members.get(u.discordId)!].sort(), ['r-pat', 'r-sub', 'unrelated']);

  // A refund takes every Anvil role off, and nothing else.
  await post({ subscription_id: 'sub-a', sale_id: 'sale-a2', refunded: 'true' });
  assert.deepEqual([...members.get(u.discordId)!], ['unrelated']);
});

test('a free trial waits for its first charge to be announced', async () => {
  const u = await makeUser('ref-t');
  const trialEnd = new Date(Date.now() + 7 * 86400_000).toISOString();
  await post({ sale_id: 'sale-t1', subscription_id: 'sub-t', 'url_params[ref]': 'ref-t', 'variants[Tier]': 'Supporter', free_trial_ends_at: trialEnd });
  assert.equal(posts.length, 0, 'a trial is not announced');
  assert.ok(members.get(u.discordId)!.has('r-sup'), 'but the trial does wear the role');
  await post({ sale_id: 'sale-t2', subscription_id: 'sub-t', is_recurring_charge: 'true', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  assert.equal(posts.length, 1, 'the first real charge is');
});

test('someone who opted out is never announced, and someone not in the server is skipped', async () => {
  await makeUser('ref-o', { announce: false, inServer: false });
  const res = await post({ sale_id: 'sale-o1', subscription_id: 'sub-o', 'url_params[ref]': 'ref-o', 'variants[Tier]': 'Patron' });
  assert.equal(res.status, 200);
  assert.equal(posts.length, 0);
});

test('beta never posts or changes roles', async () => {
  process.env.ANVIL_APEX_DOMAIN = 'beta.anvilosrs.com';
  try {
    const u = await makeUser('ref-b');
    await post({ sale_id: 'sale-b1', subscription_id: 'sub-b', 'url_params[ref]': 'ref-b', 'variants[Tier]': 'Patron' });
    assert.equal(posts.length, 0);
    assert.deepEqual([...members.get(u.discordId)!], ['unrelated']);
  } finally {
    process.env.ANVIL_APEX_DOMAIN = 'anvilosrs.com';
  }
});

test('the sweep takes the role off a membership whose term ran out', async () => {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  const u = await makeUser('ref-s');
  await post({ sale_id: 'sale-s1', subscription_id: 'sub-s', 'url_params[ref]': 'ref-s', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  assert.ok(members.get(u.discordId)!.has('r-sup'));
  // Cancelled, and the term is over: nothing notifies us, the sweep notices.
  await db
    .update(s.supporterSubscriptions)
    .set({ status: 'cancelling', currentPeriodEnd: '2020-01-01T00:00:00Z' })
    .where(eq(s.supporterSubscriptions.gumroadSubscriptionId, 'sub-s'));
  const { sweepAnvilSupporterRoles, requestAnvilRoleSweep } = await import('../src/lib/anvilDiscord.ts');
  await requestAnvilRoleSweep();
  assert.ok((await sweepAnvilSupporterRoles()) >= 1);
  assert.deepEqual([...members.get(u.discordId)!], ['unrelated']);
  assert.equal(await sweepAnvilSupporterRoles(), 0, 'not again within the hour');
});

test('everyone already paying is posted once, tagged when in the server; gifts and opt-outs are not', async () => {
  const { db, schema: s } = await loadDb();
  const A = await import('../src/lib/anvilDiscord.ts');
  const old = new Date(Date.now() - 90 * 86400_000).toISOString();
  const ahead = new Date(Date.now() + 30 * 86400_000).toISOString();
  const inServer = await makeUser('ref-h1');
  const outside = await makeUser('ref-h2', { inServer: false });
  const quiet = await makeUser('ref-h3', { announce: false });
  const gifted = await makeUser('ref-h4');
  for (const [u, sale] of [[inServer, 'h1'], [outside, 'h2'], [quiet, 'h3']] as const) {
    await db.insert(s.supporterSubscriptions).values({ userId: u.id, tier: 'patron', status: 'active', recurrence: 'monthly', gumroadSaleId: `sale-${sale}`, currentPeriodEnd: ahead, startedAt: old });
  }
  await db.insert(s.supporterSubscriptions).values({ userId: gifted.id, tier: 'patron', status: 'granted', recurrence: 'gift', currentPeriodEnd: ahead, startedAt: old });
  posts.length = 0;

  const r = await A.announceCurrentSupporters({ pauseMs: 0 });
  // Earlier tests' members are still paying too; these four are the ones this test is about.
  const mine = posts.filter((p) => /has been supporting Anvil since/.test(p.embeds[0].description));
  const about = (u: { displayName: string }) => mine.find((p) => p.embeds[0].description.includes(u.displayName.replace('_', '\\_')));
  assert.ok(about(inServer), 'posted');
  assert.equal(about(inServer)!.content, `<@${inServer.discordId}>`);
  assert.ok(about(outside) && !about(outside)!.content, 'not in the server: posted, not tagged');
  assert.ok(!about(quiet), 'opted out');
  assert.ok(!about(gifted), 'a staff gift is not a purchase');
  assert.ok(r.skipped >= 1);

  // Marked: a renewal of any of them never reads as new.
  const left = await db.select().from(s.supporterSubscriptions);
  assert.ok(left.filter((x) => x.gumroadSaleId?.startsWith('sale-h')).every((x) => x.announcedAt));
});
