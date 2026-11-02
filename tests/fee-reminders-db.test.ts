// "Remind unpaid" against a real database: the 12h cooldown must hold under concurrency.
//
// Two treasurers (or one double-click) pressing the button at the same moment both pass a plain
// check-then-insert; the advisory lock in lib/feeReminders makes exactly one of them send.
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/fee-reminders-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('fee-reminders');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let remindUnpaidFees: typeof import('../src/lib/feeReminders.ts')['remindUnpaidFees'];

let clan: { id: number; name: string; slug: string };
let event: { id: number; name: string };

async function signer(name: string, discordId: string, feeStatus: string) {
  const [person] = await db.insert(s.players).values({ displayName: name }).returning();
  const [user] = await db.insert(s.users).values({ displayName: name, discordId, playerId: person.id }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: name, rsnNormalized: name.toLowerCase(), claimedAt: new Date().toISOString() })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member' }).returning();
  const [signup] = await db
    .insert(s.eventSignups)
    .values({ eventId: event.id, userId: user.id, clanMemberId: seat.id, status: 'approved' })
    .returning();
  await db.insert(s.signupFees).values({ signupId: signup.id, amount: 1_000_000, status: feeStatus });
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ remindUnpaidFees } = await import('../src/lib/feeReminders.ts'));
  const [c] = await db.insert(s.clans).values({ slug: 'home', name: 'Home' }).returning();
  clan = { id: c.id, name: c.name, slug: c.slug };
  const [ev] = await db.insert(s.events).values({ clanId: c.id, name: 'Bingo', boardSize: 25, signupFee: 1_000_000 }).returning();
  event = { id: ev.id, name: ev.name };
  await signer('Owes A', '1001', 'pending');
  await signer('Owes B', '1002', 'pending');
  // Already said who they paid: must not be told they haven't.
  await signer('Reported', '1003', 'reported');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('two concurrent reminders: exactly one sends, the other hits the cooldown', async () => {
  const dms: string[] = [];
  // A barrier: neither caller proceeds past its early cooldown check until both have made it, so
  // both enter the check-and-stamp step together — the race the lock exists for.
  let arrived = 0;
  let release!: () => void;
  const bothHere = new Promise<void>((r) => (release = r));
  const deps = {
    botToken: async () => {
      if (++arrived === 2) release();
      await bothHere;
      return 'token';
    },
    send: async (_t: string, discordId: string) => {
      // Slow enough that the second caller is certainly waiting on the lock, not finished first.
      await new Promise((r) => setTimeout(r, 50));
      dms.push(discordId);
      return true;
    },
  };
  const run = () => remindUnpaidFees({ clan, event, actorUserId: 0, deps });
  const results = await Promise.all([run(), run()]);

  const ok = results.filter((r) => r.ok);
  const refused = results.filter((r) => !r.ok);
  assert.equal(ok.length, 1, JSON.stringify(results));
  assert.equal(refused.length, 1);
  assert.equal(!refused[0].ok && refused[0].status, 429);
  assert.deepEqual(dms.sort(), ['1001', '1002']);

  const stamps = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'fee_reminders_sent'));
  assert.equal(stamps.length, 1);
  assert.deepEqual(JSON.parse(stamps[0].newValue ?? '{}'), { eventId: event.id, sent: 2, failed: 0, unreachable: 0 });
});

test('a later press inside 12h is refused; after 12h it sends again', async () => {
  const deps = { botToken: async () => 'token', send: async () => true };
  const again = await remindUnpaidFees({ clan, event, actorUserId: 0, deps });
  assert.equal(!again.ok && again.status, 429);
  const later = await remindUnpaidFees({ clan, event, actorUserId: 0, deps, now: Date.now() + 13 * 3_600_000 });
  assert.ok(later.ok);
});
