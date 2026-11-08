// Releases (lib/releases): a production build announces each bundled release once, beta never does,
// and each login gets the plugin's "what's new" line once. Needs the test Postgres (helpers/testDb).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { eq } from 'drizzle-orm';

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
  assert.deepEqual(await R.publishShippedReleases(dir), [], 'waits for the announcements channel');
  await R.setPlatformSetting(R.ANNOUNCEMENTS_WEBHOOK_KEY, 'https://discord.com/api/webhooks/1/x');
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  assert.deepEqual(await R.publishShippedReleases(dir), ['1.15.0']);
  globalThis.fetch = realFetch;
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

test('a backlog posts as one bundled post, and the login line is the newest by version', async () => {
  const R = await import('../src/lib/releases.ts');
  const { db, schema: s } = await loadDb();
  await writeFile(path.join(dir, '1.15.1.md'), '---\nversion: 1.15.1\ntitle: Fix\n---\n## Fixed\n- A fix.\n');
  await writeFile(path.join(dir, '1.16.0.md'), '---\nversion: 1.16.0\ntitle: Minor\n---\n## New\n- A thing.\n');
  const posted: string[] = [];
  const descriptions: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    const e = JSON.parse(String(init?.body)).embeds[0];
    posted.push(e.title);
    assert.equal(e.footer?.text, 'Powered by Anvil', 'the same footer as every Anvil post');
    descriptions.push(e.description);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  assert.deepEqual(await R.publishShippedReleases(dir), ['1.15.1', '1.16.0'], 'oldest first');
  globalThis.fetch = realFetch;
  assert.deepEqual(posted, ['Anvil 1.16.0: Minor'], 'one post for the batch, headed by the newest version');
  assert.match(descriptions[0], /-# Live on anvilosrs\.com now\.\nFull changelog: https:\/\/anvilosrs\.com\/changelog#v1\.16\.0$/);
  assert.doesNotMatch(descriptions[0], /A fix/, 'the Fixed list never goes out');

  // A user who last saw 1.15.0 is told about 1.16.0, once.
  const [u] = await db.insert(s.users).values({ displayName: 'Q', discordId: 'd-rel-2' }).returning();
  const [old] = await db.select().from(s.releases).where(eq(s.releases.version, '1.15.0'));
  await db.update(s.users).set({ seenReleaseId: old.id }).where(eq(s.users.id, u.id));
  assert.match((await R.unseenReleaseLine(u.id)) ?? '', /^New in Anvil 1\.16\.0/);
  assert.equal(await R.unseenReleaseLine(u.id), null);
});

test('rows out of version order (an old newest-first backlog) still name the newest release', async () => {
  const R = await import('../src/lib/releases.ts');
  const { db, schema: s } = await loadDb();
  // 1.9.0 lands with a higher id than everything above, as the old order did to 1.15.0.
  await db.insert(s.releases).values({ version: '1.9.0', title: 'Old', note: { version: '1.9.0', title: 'Old', sections: [] } });
  const [u] = await db.insert(s.users).values({ displayName: 'R', discordId: 'd-rel-3' }).returning();
  assert.match((await R.unseenReleaseLine(u.id)) ?? '', /^New in Anvil 1\.16\.0/);
});
