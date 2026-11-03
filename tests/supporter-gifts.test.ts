// Staff gifts of Supporter time (lib/supporterGifts): a gift counts like a membership, is labelled
// as a gift rather than invite time, ends when told to, and is audited. Needs the test Postgres.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-gifts');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  ({ pool } = await loadDb());
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a gift makes someone a supporter until it ends, and staff can end it early', async () => {
  const { db, schema: s } = await loadDb();
  const G = await import('../src/lib/supporterGifts.ts');
  const S = await import('../src/lib/supporter.ts');
  const [staff] = await db.insert(s.users).values({ displayName: 'Root', discordId: 'd-root' }).returning();
  const [u] = await db.insert(s.users).values({ displayName: 'Lucky', discordId: 'd-lucky' }).returning();

  assert.equal(await S.supporterForUser(u.id), null);
  const gift = await G.giveGift({ userId: u.id, tier: 'patron', days: 30, actorUserId: staff.id, note: 'event prize' });
  const state = await S.supporterForUser(u.id);
  assert.equal(state?.tier.id, 'patron');
  assert.equal(state?.gift, true);
  assert.equal(state?.earned, false, 'a gift is not invite time');
  assert.ok(state?.endsAt && Date.parse(state.endsAt) > Date.now() + 29 * 86_400_000);

  await assert.rejects(G.giveGift({ userId: u.id, tier: 'supporter', days: 0, actorUserId: staff.id }));
  assert.equal(await G.endGift(u.id, gift.id + 999, staff.id), false, 'someone else’s or no gift');
  assert.equal(await G.endGift(u.id, gift.id, staff.id), true);
  assert.equal(await S.supporterForUser(u.id), null, 'ended now');
  assert.equal((await G.listGifts(u.id))[0].live, false);

  const audit = await db.select().from(s.clanAuditLog);
  assert.deepEqual(audit.map((a) => a.eventType).sort(), ['supporter_gift_ended', 'supporter_gift_granted']);
});
