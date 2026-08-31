// Where an absolute redirect points when nothing names a clan.
//
// The bug this guards: behind Caddy the standalone server sees its own BIND address in
// `request.url`, so a redirect built from it goes to https://0.0.0.0:3000/ — a real URL that exists
// nowhere off the machine. Signing out from any apex page did exactly that, because the fallback
// read the request's own host instead of asking here.
//
// Pure — no database, no imports from lib/clanContext, which is what lets it run standalone.
//
// Run: npx tsx --test tests/request-origin.test.ts

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const ENV_KEYS = ['APP_URL', 'DISCORD_REDIRECT_URI', 'ANVIL_APEX_DOMAIN'] as const;

/** Fresh module per case: the resolution reads process.env at call time, but be explicit about it. */
async function origin(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  const { configuredOrigin } = await import('../src/lib/request-origin.ts');
  return configuredOrigin();
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

test('APP_URL wins, and only its origin survives', async () => {
  assert.equal(await origin({ APP_URL: 'https://anvilosrs.com/some/path?x=1' }), 'https://anvilosrs.com');
});

test('the OAuth callback names the origin when APP_URL does not', async () => {
  // Every deployment doing Discord login has this, which is why it is the second source.
  assert.equal(
    await origin({ DISCORD_REDIRECT_URI: 'https://preview.anvilosrs.com/api/auth/discord/callback' }),
    'https://preview.anvilosrs.com',
  );
});

test('the apex domain answers when neither URL is configured', async () => {
  // The case that matters for a deployment without OAuth: ANVIL_APEX_DOMAIN is the one env that
  // means exactly "the apex", and before this it was never consulted.
  assert.equal(await origin({ ANVIL_APEX_DOMAIN: 'anvilosrs.com' }), 'https://anvilosrs.com');
});

test('a dev apex is http, because that is what it speaks', async () => {
  assert.equal(await origin({ ANVIL_APEX_DOMAIN: 'localhost:3000' }), 'http://localhost:3000');
});

test('nothing configured is null, not a guess', async () => {
  // A self-hoster with no config has no public URL we can know, and inventing one is worse than
  // letting the caller decide what to do without it.
  assert.equal(await origin({}), null);
});

test('the order is APP_URL, then the callback, then the apex', async () => {
  assert.equal(
    await origin({
      APP_URL: 'https://one.example',
      DISCORD_REDIRECT_URI: 'https://two.example/cb',
      ANVIL_APEX_DOMAIN: 'three.example',
    }),
    'https://one.example',
  );
  assert.equal(
    await origin({ DISCORD_REDIRECT_URI: 'https://two.example/cb', ANVIL_APEX_DOMAIN: 'three.example' }),
    'https://two.example',
  );
});

test('a malformed value is skipped rather than thrown on', async () => {
  // A half-edited env var should not take the site down; the next source answers.
  assert.equal(await origin({ APP_URL: 'not a url', ANVIL_APEX_DOMAIN: 'anvilosrs.com' }), 'https://anvilosrs.com');
});
