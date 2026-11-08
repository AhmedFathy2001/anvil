// Webhook pools (lib/webhookPool): round-robin over several webhooks for one channel, resting a
// webhook Discord asked to wait, failing over on a 429, and queueing (within a bound) when every
// webhook is resting. Plus the "how many webhooks should this event have" formula.
//
// Run: npx tsx --test tests/webhook-pool.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEAD_WEBHOOK_REST_MS,
  MAX_QUEUE_WAIT_MS,
  MAX_RECOMMENDED_WEBHOOKS,
  WebhookPoolState,
  ActivityMeter,
  maskedWebhookId,
  recommendedWebhookCount,
  redactWebhookUrl,
  sendThroughPool,
  webhookAdvice,
  type WebhookDestination,
} from '../src/lib/webhookPool.ts';

const A = 'https://discord.com/api/webhooks/1001/tokA';
const B = 'https://discord.com/api/webhooks/1002/tokB';
const C = 'https://discord.com/api/webhooks/1003/tokC';
const pool = (urls = [A, B, C], cursorKey = 'k'): WebhookDestination => ({ urls, cursorKey });

const picked = (s: WebhookPoolState, d: WebhookDestination, now: number) => {
  const r = s.pick(d, now);
  assert.ok(r && 'url' in r, `expected a url, got ${JSON.stringify(r)}`);
  return r.url;
};

test('round-robin walks the pool in order from the cursor', () => {
  const s = new WebhookPoolState(() => 0);
  const d = pool();
  assert.deepEqual([picked(s, d, 0), picked(s, d, 0), picked(s, d, 0), picked(s, d, 0)], [A, B, C, A]);
});

test('separate destinations keep separate cursors', () => {
  const s = new WebhookPoolState(() => 0);
  assert.equal(picked(s, pool([A, B], 'x'), 0), A);
  assert.equal(picked(s, pool([A, B], 'y'), 0), A);
  assert.equal(picked(s, pool([A, B], 'x'), 0), B);
});

test('a resting webhook is skipped until its rest is over', () => {
  const s = new WebhookPoolState(() => 0);
  const d = pool();
  s.rest(A, 2000, 0);
  assert.equal(picked(s, d, 0), B);
  assert.equal(picked(s, d, 0), C);
  assert.equal(picked(s, d, 0), B, 'A still resting, so the turn passes to B');
  assert.equal(s.isResting(A, 2500), false);
});

test('all resting: answers how long until the soonest is free', () => {
  const s = new WebhookPoolState(() => 0);
  s.rest(A, 3000, 0);
  s.rest(B, 1200, 0);
  s.rest(C, 5000, 0);
  assert.deepEqual(s.pick(pool(), 200), { waitMs: 1000 });
});

test('a rest is never shortened by a later, shorter one', () => {
  const s = new WebhookPoolState();
  s.rest(A, 5000, 0);
  s.rest(A, 100, 0);
  assert.equal(s.restLeft(A, 0), 5000);
});

test('a drained bucket (X-RateLimit-Remaining: 0) rests the webhook before Discord has to say 429', () => {
  const s = new WebhookPoolState();
  s.noteHeaders(A, new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '1.5' }), 0);
  assert.equal(s.restLeft(A, 0), 1500);
  s.noteHeaders(B, new Headers({ 'x-ratelimit-remaining': '3', 'x-ratelimit-reset-after': '1.5' }), 0);
  assert.equal(s.restLeft(B, 0), 0);
});

test('preferFirst always tries the chosen webhook first; siblings are only failover', () => {
  const s = new WebhookPoolState(() => 0.9);
  const d: WebhookDestination = { urls: [B, A, C], cursorKey: 'chosen', preferFirst: true };
  assert.equal(picked(s, d, 0), B);
  assert.equal(picked(s, d, 0), B);
  s.rest(B, 1000, 0);
  assert.equal(picked(s, d, 0), A);
});

test('a lone URL remembers the pool it came from', () => {
  const s = new WebhookPoolState();
  s.remember([A, B]);
  assert.deepEqual(s.siblingsOf(A), [A, B]);
  assert.deepEqual(s.siblingsOf(C), [C]);
});

test('logged and shown forms never carry the token', () => {
  assert.equal(redactWebhookUrl(A), 'https://discord.com/api/webhooks/1001/[redacted]');
  assert.equal(redactWebhookUrl(`fetch failed for ${B}?wait=true`), 'fetch failed for https://discord.com/api/webhooks/1002/[redacted]?wait=true');
  assert.equal(maskedWebhookId(A), '…1001');
  assert.ok(!maskedWebhookId(A).includes('tokA'));
});

// ── sendThroughPool, fetch stubbed ───────────────────────────────────────────────────────────────

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function harness(responses: Record<string, Response[]>) {
  let clock = 0;
  const calls: string[] = [];
  const sleeps: number[] = [];
  const warnings: { event: string; meta: Record<string, unknown> }[] = [];
  const limited: string[] = [];
  const state = new WebhookPoolState(() => 0);
  const deps = {
    state,
    now: () => clock,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
    },
    fetch: async (url: string) => {
      calls.push(url);
      const queue = responses[url.split('?')[0]];
      const next = queue?.shift();
      if (!next) throw new Error(`no stubbed response for ${redactWebhookUrl(url)}`);
      return next;
    },
    warn: (event: string, meta: Record<string, unknown>) => warnings.push({ event, meta }),
    onRateLimited: (key: string) => limited.push(key),
  };
  return { deps, state, calls, sleeps, warnings, limited };
}

const init = () => ({ method: 'POST', body: '{}' });

test('429 on one webhook fails over to the next at once, and the first rests for retry_after', async () => {
  const h = harness({
    [A]: [json(429, { retry_after: 2.5, global: false })],
    [B]: [json(204, {})],
  });
  const r = await sendThroughPool(pool(), init, h.deps);
  assert.equal(r.ok, true);
  assert.equal(r.webhookUrl, B, 'the result names the webhook that owns the message');
  assert.deepEqual(h.calls, [A, B]);
  assert.deepEqual(h.sleeps, [], 'no waiting while another webhook is free');
  assert.equal(h.state.restLeft(A, 0), 2500);
  assert.equal(h.state.counters.rateLimited, 1);
  assert.equal(h.state.counters.failovers, 1);
  assert.deepEqual(h.limited, ['k']);
  // Nothing logged carries a token.
  assert.ok(!JSON.stringify(h.warnings).includes('tok'));
});

test('the next post skips the resting webhook', async () => {
  const h = harness({
    [A]: [json(429, { retry_after: 5 })],
    [B]: [json(204, {}), json(204, {})],
    [C]: [json(204, {})],
  });
  await sendThroughPool(pool(), init, h.deps); // A 429 → B
  await sendThroughPool(pool(), init, h.deps); // cursor at C
  await sendThroughPool(pool(), init, h.deps); // A resting → B
  assert.deepEqual(h.calls, [A, B, C, B]);
});

test('a channel-wide (shared) 429 rests the whole pool, and the post waits instead of dropping', async () => {
  const h = harness({
    [A]: [json(429, { retry_after: 1 }, { 'x-ratelimit-scope': 'shared' })],
    [B]: [json(204, {})],
  });
  const r = await sendThroughPool(pool(), init, h.deps);
  assert.equal(r.ok, true);
  assert.deepEqual(h.sleeps, [1000]);
  assert.equal(h.state.counters.queued, 1);
  // B and C rested too (same channel), so nothing was sent until the wait was over.
  assert.deepEqual(h.calls, [A, B]);
});

test('a single webhook keeps the old behaviour: wait out the 429 and retry', async () => {
  const h = harness({ [A]: [json(429, {}, { 'retry-after': '2' }), json(200, { id: '99' })] });
  const r = await sendThroughPool(pool([A]), init, h.deps);
  assert.equal(r.ok, true);
  assert.deepEqual(h.sleeps, [2000]);
  assert.equal(r.status, 200);
});

test('every webhook resting past the bound: dropped and counted, never hung', async () => {
  const h = harness({});
  for (const u of [A, B, C]) h.state.rest(u, MAX_QUEUE_WAIT_MS + 1000, 0);
  const r = await sendThroughPool(pool(), init, h.deps);
  assert.equal(r.ok, false);
  assert.equal(r.dropped, true);
  assert.equal(h.state.counters.dropped, 1);
  assert.deepEqual(h.calls, []);
  assert.equal(h.warnings.at(-1)?.event, 'discord.pool-dropped');
});

test('a deleted webhook in a pool (404) rests long and the post goes to the next', async () => {
  const h = harness({ [A]: [json(404, { message: 'Unknown Webhook', code: 10015 })], [B]: [json(204, {})] });
  const r = await sendThroughPool(pool(), init, h.deps);
  assert.equal(r.ok, true);
  assert.equal(h.state.restLeft(A, 0), DEAD_WEBHOOK_REST_MS);
});

test('other failures are returned as they are, not retried', async () => {
  const h = harness({ [A]: [json(400, { message: 'Invalid Form Body' })] });
  const r = await sendThroughPool(pool(), init, h.deps);
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.deepEqual(h.calls, [A]);
});

test('buildUrl adds ?wait=true without touching the pool choice', async () => {
  const h = harness({ [A]: [json(200, { id: '123' })] });
  const r = await sendThroughPool(pool([A]), init, h.deps, (u) => `${u}?wait=true`);
  assert.deepEqual(h.calls, [`${A}?wait=true`]);
  assert.equal(((await r.response!.json()) as { id: string }).id, '123');
});

// ── Advice ───────────────────────────────────────────────────────────────────────────────────────

test('recommended count: 1 per ~40 players or ~20 posts a minute, at least 1, at most 10', () => {
  assert.equal(recommendedWebhookCount({ participants: 0 }), 1);
  assert.equal(recommendedWebhookCount({ participants: 40 }), 1);
  assert.equal(recommendedWebhookCount({ participants: 41 }), 2);
  assert.equal(recommendedWebhookCount({ participants: 120 }), 3);
  assert.equal(recommendedWebhookCount({ participants: 10, postsPerMinute: 65 }), 4);
  assert.equal(recommendedWebhookCount({ participants: 5000 }), MAX_RECOMMENDED_WEBHOOKS);
});

test('advice shows for a big, busy or rate-limited event short of the recommendation', () => {
  assert.equal(webhookAdvice({ participants: 30, postsPerMinute: 5, recentRateLimits: 0, webhooks: 1 }), null, 'small and quiet');
  const big = webhookAdvice({ participants: 120, postsPerMinute: 0, recentRateLimits: 0, webhooks: 1 });
  assert.deepEqual(big && { recommended: big.recommended, missing: big.missing }, { recommended: 3, missing: 2 });
  assert.equal(webhookAdvice({ participants: 120, postsPerMinute: 0, recentRateLimits: 0, webhooks: 3 }), null, 'already enough');
  const busy = webhookAdvice({ participants: 10, postsPerMinute: 25, recentRateLimits: 0, webhooks: 1 });
  assert.equal(busy?.recommended, 2);
  // Discord said no to two webhooks already: at least one more than that.
  const limited = webhookAdvice({ participants: 10, postsPerMinute: 2, recentRateLimits: 3, webhooks: 2 });
  assert.equal(limited?.recommended, 3);
  assert.equal(limited?.missing, 1);
  assert.match(limited!.reasons.join(' '), /slow down 3 times/);
});

test('activity meter: posts a minute over 10 minutes, 429s over an hour', () => {
  const m = new ActivityMeter();
  for (let i = 0; i < 200; i++) m.notePost('e', i * 1000);
  assert.equal(m.postsPerMinute('e', 200_000), 20);
  assert.equal(m.postsPerMinute('e', 200_000 + 11 * 60_000), 0);
  m.noteRateLimit('e', 0);
  assert.equal(m.recentRateLimits('e', 30 * 60_000), 1);
  assert.equal(m.recentRateLimits('e', 61 * 60_000), 0);
});
