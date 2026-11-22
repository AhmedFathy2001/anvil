import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('notify-seen');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  pool = (await loadDb()).pool;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a log slot posts once, even when the second sighting reaches a fresh server', async () => {
  const { clogSlotPostedRecently } = await import('../src/lib/notifySeen.ts');
  assert.equal(await clogSlotPostedRecently(7, "Elidinis' ward"), false, 'the first sighting posts');
  // Same slot, different spelling of the same name: still the same unlock.
  assert.equal(await clogSlotPostedRecently(7, "<col=ff0000>Elidinis'  Ward</col>"), true, 'the echo is declined');
  assert.equal(await clogSlotPostedRecently(8, "Elidinis' ward"), false, 'someone else getting it posts');
  // Two minutes on, the same slot (a second account on the login, a re-roll) posts again.
  await pool.query("update notify_seen set seen_at = now() - interval '3 minutes'");
  assert.equal(await clogSlotPostedRecently(7, "Elidinis' ward"), false);
});
