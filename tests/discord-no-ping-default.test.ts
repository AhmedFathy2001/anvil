// Run: npx tsx --test tests/discord-no-ping-default.test.ts (pure — never connects to the DB).
//
// A coffer donation's member-typed note went straight into the post's content, and with no
// allowed_mentions Discord parses every mention — a note of `@everyone` pinged the whole channel.
// The single JSON exit (lib/discord jsonInit) now defaults to no pings.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:1/not-used';

const body = async (payload: object) => {
  const { jsonInit } = await import('../src/lib/discord.ts');
  return JSON.parse(String(jsonInit(payload as never)().body));
};

test('a post with no allowed_mentions goes out pinging nobody', async () => {
  const sent = await body({ content: '💰 Someone donated 1m — @everyone test' });
  assert.deepEqual(sent.allowed_mentions, { parse: [] });
  assert.equal(sent.content, '💰 Someone donated 1m — @everyone test', 'the text still shows');
});

test('a post that names whom to ping keeps exactly that', async () => {
  const sent = await body({ content: '<@&1> go', allowed_mentions: { parse: [], roles: ['1'] } });
  assert.deepEqual(sent.allowed_mentions, { parse: [], roles: ['1'] });
});
