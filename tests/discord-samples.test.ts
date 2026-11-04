// Sample Discord posts (lib/discordSamples): every sample builds a real embed within Discord's limits.
// Run: npx tsx --test tests/discord-samples.test.ts (no database).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANVIL_APEX_DOMAIN ??= 'anvilosrs.com';
// lib/anvilDiscord (two of the builders) imports the database; it's never queried here.
process.env.DATABASE_URL ??= 'postgres://x:x@127.0.0.1:1/x';

test('every sample builds an embed Discord would take', async () => {
  const { DISCORD_SAMPLES } = await import('../src/lib/discordSamples.ts');
  assert.ok(DISCORD_SAMPLES.length >= 15);
  assert.equal(new Set(DISCORD_SAMPLES.map((s) => s.id)).size, DISCORD_SAMPLES.length, 'unique ids');
  for (const s of DISCORD_SAMPLES) {
    const e = s.embed() as { title?: string; description?: string };
    assert.ok(e.title && !e.title.startsWith('Sample failed'), `${s.id}: ${e.title}`);
    assert.ok(e.title.length <= 256, `${s.id} title too long`);
    assert.ok((e.description ?? '').length <= 4096, `${s.id} description too long`);
  }
});
