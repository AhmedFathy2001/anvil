// Releases (lib/releases): a production build announces each bundled release once, beta never does,
// and each login gets the plugin's "what's new" line once. Needs the test Postgres (helpers/testDb).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('releases');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let dir: string;

before(async () => {
  await resetDatabase(DB);
  ({ pool } = await loadDb());
  dir = await mkdtemp(path.join(os.tmpdir(), 'releases-'));
  await writeFile(path.join(dir, '1.15.0.md'), '---\nversion: 1.15.0\ntitle: Chat feed\n---\n## Highlights\n- Big drops in chat.\n');
  await writeFile(path.join(dir, 'broken.md'), 'not a release');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('beta never announces; production announces each release once', async () => {
  const R = await import('../src/lib/releases.ts');
  process.env.ANVIL_APEX_DOMAIN = 'beta.anvilosrs.com';
  assert.deepEqual(await R.publishShippedReleases(dir), []);
  process.env.ANVIL_APEX_DOMAIN = 'anvilosrs.com';
  assert.deepEqual(await R.publishShippedReleases(dir), ['1.15.0']);
  assert.deepEqual(await R.publishShippedReleases(dir), [], 'a second slot or tick does nothing');
  const list = await R.listPublishedReleases();
  assert.equal(list[0].note.title, 'Chat feed');
});

test("each login hears about a release once", async () => {
  const R = await import('../src/lib/releases.ts');
  const { db, schema: s } = await loadDb();
  const [u] = await db.insert(s.users).values({ displayName: 'P', discordId: 'd-rel' }).returning();
  assert.match((await R.unseenReleaseLine(u.id)) ?? '', /^New in Anvil 1\.15\.0/);
  assert.equal(await R.unseenReleaseLine(u.id), null);
});
