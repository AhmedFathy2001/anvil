// Cash-policy made concrete (lib/coHostSettlement): per-clan fees in, winnings out, and the net the
// treasurers settle. Attribution is by team → clan; fees are entrants × signupFee.
//
// Run: npx tsx --test tests/cohost-settlement.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('cohost-settlement');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let settlementForEvent: typeof import('../src/lib/coHostSettlement.ts')['settlementForEvent'];

let eventId: number;
let hostClan: number;
let guestClan: number;

const FEE = 1_000_000;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ settlementForEvent } = await import('../src/lib/coHostSettlement.ts'));

  const [host] = await db.insert(s.clans).values({ slug: 'host', name: 'Host Clan' }).returning();
  hostClan = host.id;
  const [guest] = await db.insert(s.clans).values({ slug: 'guest', name: 'Guest Clan' }).returning();
  guestClan = guest.id;

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: hostClan, name: 'Rumble', boardSize: 25, signupFee: FEE, cashPolicy: 'host-holds' })
    .returning();
  eventId = ev.id;

  // Host team (untagged → maps to host) + a co-host team tagged to the guest clan.
  const [hostTeam] = await db.insert(s.teams).values({ eventId, name: 'Home', color: '#b07d18' }).returning();
  const [guestTeam] = await db.insert(s.teams).values({ eventId, name: 'Visitors', color: '#2f7d70', clanId: guestClan }).returning();
  await db.insert(s.eventCohosts).values({ eventId, clanId: guestClan, status: 'accepted', teamId: guestTeam.id });

  // 2 host entrants, 3 guest entrants.
  await db.insert(s.eventParticipants).values([
    { eventId, name: 'H1', teamId: hostTeam.id },
    { eventId, name: 'H2', teamId: hostTeam.id },
    { eventId, name: 'G1', teamId: guestTeam.id },
    { eventId, name: 'G2', teamId: guestTeam.id },
    { eventId, name: 'G3', teamId: guestTeam.id },
  ]);

  // Payouts: a host winner (3M) and a guest winner (1M).
  await db.insert(s.payouts).values([
    { eventId, rsn: 'H1', amount: 3_000_000, teamId: hostTeam.id },
    { eventId, rsn: 'G1', amount: 1_000_000, teamId: guestTeam.id },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('per-clan fees, winnings and net reconcile', async () => {
  const set = (await settlementForEvent(eventId))!;
  assert.equal(set.cashPolicy, 'host-holds');
  assert.equal(set.signupFee, FEE);
  assert.equal(set.relevant, true, 'a co-host + a fee makes settlement relevant');

  const host = set.clans.find((c) => c.isHost)!;
  const guest = set.clans.find((c) => !c.isHost)!;

  assert.equal(set.clans[0].isHost, true, 'host listed first');

  // Host: 2 entrants × 1M = 2M in; 3M won; +1M owed to it by the pot.
  assert.equal(host.entrants, 2);
  assert.equal(host.fees, 2_000_000);
  assert.equal(host.winnings, 3_000_000);
  assert.equal(host.net, 1_000_000);

  // Guest: 3 entrants × 1M = 3M in; 1M won; −2M (it put in more than it took out).
  assert.equal(guest.entrants, 3);
  assert.equal(guest.fees, 3_000_000);
  assert.equal(guest.winnings, 1_000_000);
  assert.equal(guest.net, -2_000_000);

  // The whole thing balances: total fees in == total winnings out only if the pot is fully paid; here
  // 5M in, 4M out — the 1M surplus is the pot's, which is the host's under host-holds.
  const totalNet = set.clans.reduce((n, c) => n + c.net, 0);
  assert.equal(totalNet, -1_000_000, 'nets sum to −(unpaid pot): 5M fees − 4M winnings');
});

test('no co-host, or no fee → not relevant', async () => {
  await db.update(s.events).set({ signupFee: 0 }).where(eq(s.events.id, eventId));
  const set = (await settlementForEvent(eventId))!;
  assert.equal(set.relevant, false);
});
