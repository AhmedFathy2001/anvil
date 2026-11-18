import { test } from 'node:test';
import assert from 'node:assert/strict';

test('servers are joined to the clans that saved them; a missing bot is named, a clan on its own bot is not', async () => {
  process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:1/unused';
  const { joinClanServers } = await import('../src/lib/botGuilds.ts');
  const guilds = [
    { id: '1', name: 'Big', members: 400 },
    { id: '2', name: 'Test server', members: 5 },
  ];
  const saved = [
    { id: 10, name: 'Big Clan', guildId: '1', ownBot: false },
    { id: 11, name: 'Embervale', guildId: '9', ownBot: false },
    { id: 12, name: 'Own Bot Clan', guildId: '8', ownBot: true },
  ];
  const r = joinClanServers(guilds, saved);
  assert.equal(r.known, true);
  assert.deepEqual(r.servers.map((s) => `${s.name}:${s.clans.map((c) => c.name).join('+') || 'none'}`), ['Big:Big Clan', 'Test server:none']);
  assert.deepEqual(r.missing.map((m) => m.name), ['Embervale']);
  // Discord could not be asked: nothing is claimed, least of all that a bot is missing.
  assert.deepEqual(joinClanServers(null, saved), { known: false, servers: [], missing: [] });
});

test('a first draft says which clan and why, for staff to rewrite', async () => {
  const { ownerMessageDraft } = await import('../src/lib/staffMessageText.ts');
  assert.equal(ownerMessageDraft('Embervale', 'The Anvil bot is not in the Discord server it saved').includes('about Embervale.\n\nThe Anvil bot is not in the Discord server it saved.'), true);
  assert.equal(ownerMessageDraft('Embervale', null).includes('\n\n\n'), false);
});
