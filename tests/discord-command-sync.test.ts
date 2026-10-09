// The deploy gate is useful only if a successful global PUT also removes old guild-scoped copies:
// Discord allows both scopes at once, and the guild copy shadows the global command in that server.
// Exercise the exact REST sequence without a Discord token or a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://unused:unused@127.0.0.1:1/unused';

type Call = { url: string; method: string; body: string | null };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('global reconcile overwrites the tree and clears only non-empty legacy guild copies', async () => {
  const { reconcileDiscordCommands } = await import('../src/lib/discordCommandSync.ts');
  const calls: Call[] = [];
  const first = '1324522160315961365';
  const second = '1198288863207112785';
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
    if (url.endsWith('/applications/@me')) return response({ id: 'app-1' });
    if (url.endsWith('/applications/app-1/commands') && method === 'PUT') {
      return response(Array.from({ length: 7 }, (_, i) => ({ id: i })));
    }
    if (url.endsWith(`/guilds/${first}/commands`) && method === 'GET') return response([{ name: 'bingo' }]);
    if (url.endsWith(`/guilds/${second}/commands`) && method === 'GET') return response([]);
    if (url.endsWith(`/guilds/${first}/commands`) && method === 'PUT') return response([]);
    throw new Error(`unexpected request: ${method} ${url}`);
  }) as typeof fetch;

  const result = await reconcileDiscordCommands(
    'token',
    { clearGuildIds: [first, second, first, 'not-a-guild'] },
    fetcher,
  );

  assert.deepEqual(result, { ok: true, scope: 'global', count: 7, clearedGuilds: 1 });
  const globalWrite = calls.find((call) => call.url.endsWith('/applications/app-1/commands') && call.method === 'PUT');
  assert.ok(globalWrite?.body?.includes('"name":"stats"'), 'writes the current command definitions');
  assert.deepEqual(
    calls.filter((call) => call.method === 'PUT' && call.url.includes('/guilds/')).map((call) => [call.url, call.body]),
    [[`https://discord.com/api/v10/applications/app-1/guilds/${first}/commands`, '[]']],
  );
});

test('a stale guild that cannot be cleared makes reconciliation fail', async () => {
  const { reconcileDiscordCommands } = await import('../src/lib/discordCommandSync.ts');
  const guild = '1324522160315961365';
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/applications/@me')) return response({ id: 'app-1' });
    if (url.endsWith('/applications/app-1/commands') && method === 'PUT') return response([{ name: 'bingo' }]);
    if (url.endsWith(`/guilds/${guild}/commands`) && method === 'GET') return response([{ name: 'bingo' }]);
    if (url.endsWith(`/guilds/${guild}/commands`) && method === 'PUT') return response({ message: 'nope' }, 403);
    throw new Error(`unexpected request: ${method} ${url}`);
  }) as typeof fetch;

  const result = await reconcileDiscordCommands('token', { clearGuildIds: [guild] }, fetcher);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? '', new RegExp(`guild-cleanup-${guild}-403`));
});

test('a clan-owned bot registers in its guild and never clears that same scope', async () => {
  const { reconcileDiscordCommands } = await import('../src/lib/discordCommandSync.ts');
  const guild = '1324522160315961365';
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
    if (url.endsWith('/applications/@me')) return response({ id: 'byo-app' });
    if (url.endsWith(`/applications/byo-app/guilds/${guild}/commands`) && method === 'PUT') {
      return response([{ name: 'bingo' }]);
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  }) as typeof fetch;

  const result = await reconcileDiscordCommands('token', { guildId: guild, clearGuildIds: [guild] }, fetcher);
  assert.deepEqual(result, { ok: true, scope: 'guild', count: 1, clearedGuilds: 0 });
  assert.equal(calls.length, 2);
});
