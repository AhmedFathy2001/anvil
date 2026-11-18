import { test } from 'node:test';
import assert from 'node:assert/strict';

test('versions sort newest first by number, not by text', async () => {
  process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:1/unused';
  const { byVersionDesc } = await import('../src/lib/pluginUsersRead.ts');
  assert.deepEqual(['1.9.0', '1.17.0', '1.16.0', '1.17.1', 'dev'].sort(byVersionDesc), ['1.17.1', '1.17.0', '1.16.0', '1.9.0', 'dev']);
});
