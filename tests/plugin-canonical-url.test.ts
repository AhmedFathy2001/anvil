// What address the site tells a plugin to use.
//
// The plugin gates its "you can simplify your URL" nudge on this, so a wrong answer here moves
// people off an address that works. Two ways that goes wrong and both are silent: advertising an
// address the deployment does not answer on, and a SELF-HOSTED site advertising somebody else's.
//
// Run: npx tsx --test tests/plugin-canonical-url.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Fresh import per case: canonicalUrl reads the environment at call time via apexDomain(). */
async function load(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const mod = await import(`../src/lib/serverInfo.ts?${Math.random()}`);
  return mod as typeof import('../src/lib/serverInfo.ts');
}

test('the apex is the canonical address', async () => {
  const { canonicalUrl } = await load({ ANVIL_APEX_DOMAIN: 'anvilosrs.com', APP_URL: undefined });
  assert.equal(canonicalUrl(), 'https://anvilosrs.com');
});

test('a preview apex advertises itself, not production', async () => {
  // The failure this guards: preview telling its users to point at the real site.
  const { canonicalUrl } = await load({ ANVIL_APEX_DOMAIN: 'preview.anvilosrs.com', APP_URL: undefined });
  assert.equal(canonicalUrl(), 'https://preview.anvilosrs.com');
});

test('a self-hosted site advertises its OWN address', async () => {
  // The one that matters most. A hard-coded domain here would tell every self-hoster to send their
  // clan's plugin traffic to somebody else's server.
  const { canonicalUrl } = await load({ ANVIL_APEX_DOMAIN: 'bingo.someclan.org', APP_URL: undefined });
  assert.equal(canonicalUrl(), 'https://bingo.someclan.org');
});

test('APP_URL wins when the public address is not simply the apex', async () => {
  const { canonicalUrl } = await load({
    ANVIL_APEX_DOMAIN: 'internal.example',
    APP_URL: 'https://anvil.myclan.gg',
  });
  assert.equal(canonicalUrl(), 'https://anvil.myclan.gg');
});

test('a path or trailing slash is reduced to the origin', async () => {
  const { canonicalUrl } = await load({ ANVIL_APEX_DOMAIN: 'x', APP_URL: 'https://anvilosrs.com/c/theafkspot/' });
  assert.equal(canonicalUrl(), 'https://anvilosrs.com', 'the plugin appends its own paths');
});

test('a scheme-less value is still usable', async () => {
  const { canonicalUrl } = await load({ ANVIL_APEX_DOMAIN: 'x', APP_URL: 'anvilosrs.com' });
  assert.equal(canonicalUrl(), 'https://anvilosrs.com');
});

test('a deployment that names no address advertises none', async () => {
  // The quiet default, and the reason canonicalUrl does NOT fall back to anvilosrs.com the way
  // apexDomain() does: a self-hoster who has configured neither must not be told to point their
  // clan at a server that is not theirs. Saying nothing is always safe; guessing is not.
  const { canonicalUrl, serverInfo } = await load({ ANVIL_APEX_DOMAIN: undefined, APP_URL: undefined });
  assert.equal(canonicalUrl(), null);
  assert.equal(serverInfo().canonicalUrl, null, 'and the plugin therefore says nothing');
});

test('serverInfo carries it, alongside the capability the plugin gates on', async () => {
  const { serverInfo } = await load({ ANVIL_APEX_DOMAIN: 'anvilosrs.com', APP_URL: undefined });
  const info = serverInfo();
  assert.equal(info.canonicalUrl, 'https://anvilosrs.com');
  assert.ok(
    info.capabilities.includes('apex-routing'),
    'without this the plugin must stay quiet — a site that cannot resolve a clan from a token ' +
      'still needs its per-clan address',
  );
});
