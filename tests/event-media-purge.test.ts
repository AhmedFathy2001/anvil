// The retention job against a real schema (lib/eventMediaRetention): which events are due, what a
// dry run reports, and that a real run swaps every proof URL for the placeholder and stamps the
// event — while every row (who submitted what, fees, payouts) stays.
//
// Run: npx tsx --test tests/event-media-purge.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-media-purge');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let lib: typeof import('../src/lib/eventMediaRetention.ts');
let oldEvent = 0;
let recentEvent = 0;
let subId = 0;
let payoutId = 0;
let feeId = 0;
let startId = 0;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const IMG = 'https://external.example/shot.webp'; // not managed media, so nothing is sent to storage

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  lib = await import('../src/lib/eventMediaRetention.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'r', name: 'R' }).returning();
  const mk = async (name: string, endedDaysAgo: number) => {
    const [ev] = await db
      .insert(s.events)
      .values({ clanId: clan.id, name, boardSize: 25, startDate: daysAgo(endedDaysAgo + 14), endDate: daysAgo(endedDaysAgo) })
      .returning();
    return ev.id;
  };
  oldEvent = await mk('Summer bingo', 100);
  recentEvent = await mk('Autumn bingo', 10);

  const [team] = await db.insert(s.teams).values({ eventId: oldEvent, name: 'Red', color: '#f00' }).returning();
  const [tile] = await db.insert(s.tiles).values({ eventId: oldEvent, position: 0, label: 'Zulrah' }).returning();
  const [p] = await db.insert(s.players).values({ displayName: 'P' }).returning();
  const [acc] = await db.insert(s.accounts).values({ playerId: p.id, rsn: 'P', rsnNormalized: 'p' }).returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acc.id, kind: 'member' }).returning();
  const [part] = await db.insert(s.eventParticipants).values({ eventId: oldEvent, clanMemberId: m.id, name: 'P', teamId: team.id }).returning();
  [{ id: subId }] = await db.insert(s.submissions).values({ tileId: tile.id, teamId: team.id, playerId: part.id, imageUrl: IMG }).returning();
  [{ id: payoutId }] = await db.insert(s.payouts).values({ eventId: oldEvent, rsn: 'P', amount: 1000, proofBlobUrl: IMG }).returning();
  const [signup] = await db.insert(s.eventSignups).values({ eventId: oldEvent, clanMemberId: m.id }).returning();
  [{ id: feeId }] = await db.insert(s.signupFees).values({ signupId: signup.id, amount: 500, proofBlobUrl: IMG }).returning();
  [{ id: startId }] = await db
    .insert(s.eventStartProofs)
    .values({ eventId: oldEvent, playerId: part.id, teamId: team.id, imageUrl: IMG, source: 'web' })
    .returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('only events past their 90 days are due', async () => {
  const due = await lib.eventsDueForPurge(new Date());
  assert.deepEqual(due.map((d) => d.id), [oldEvent]);
  assert.ok(!due.some((d) => d.id === recentEvent), 'ended ten days ago: not yet');
});

test('a dry run counts every kind of proof and changes nothing', async () => {
  const r = await lib.purgeEventMedia(oldEvent, { dryRun: true });
  assert.deepEqual(r?.bySource, { submissions: 1, fees: 1, payouts: 1, startProofs: 1 });
  const [sub] = await db.select().from(s.submissions).where(eq(s.submissions.id, subId));
  assert.equal(sub.imageUrl, IMG);
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, oldEvent));
  assert.equal(ev.mediaPurgedAt, null);
});

test('a real run points every proof at the placeholder, keeps the rows, and stamps the event', async () => {
  const r = await lib.purgeEventMedia(oldEvent);
  assert.equal(r?.files, 4);
  const [sub] = await db.select().from(s.submissions).where(eq(s.submissions.id, subId));
  const [pay] = await db.select().from(s.payouts).where(eq(s.payouts.id, payoutId));
  const [fee] = await db.select().from(s.signupFees).where(eq(s.signupFees.id, feeId));
  const [start] = await db.select().from(s.eventStartProofs).where(eq(s.eventStartProofs.id, startId));
  for (const url of [sub.imageUrl, pay.proofBlobUrl, fee.proofBlobUrl, start.imageUrl]) assert.equal(url, lib.EXPIRED_PROOF_URL);
  assert.equal(sub.playerId != null && pay.amount === 1000 && fee.amount === 500, true, 'the records themselves are untouched');
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, oldEvent));
  assert.ok(ev.mediaPurgedAt);
  assert.deepEqual(await lib.eventsDueForPurge(new Date()), [], 'and it is not due again');
  const again = await lib.purgeEventMedia(oldEvent);
  assert.equal(again?.files, 0, 'a second run finds nothing left to delete');
});
