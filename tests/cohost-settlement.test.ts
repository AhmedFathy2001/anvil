// Cash-policy made concrete (lib/coHostSettlement): per-clan fees in (the REAL fee rows), winnings
// out, and what each policy makes of them — `transfer` between clan and host, and what each `keeps`.
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
let n = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ settlementForEvent } = await import('../src/lib/coHostSettlement.ts'));

  hostClan = (await db.insert(s.clans).values({ slug: 'host', name: 'Host Clan' }).returning())[0].id;
  guestClan = (await db.insert(s.clans).values({ slug: 'guest', name: 'Guest Clan' }).returning())[0].id;
  eventId = (
    await db.insert(s.events).values({ clanId: hostClan, name: 'Rumble', boardSize: 25, signupFee: FEE, cashPolicy: 'each-settles' }).returning()
  )[0].id;

  const [hostTeam] = await db.insert(s.teams).values({ eventId, name: 'Home', color: '#b07d18' }).returning();
  const [guestTeam] = await db.insert(s.teams).values({ eventId, name: 'Visitors', color: '#2f7d70', clanId: guestClan }).returning();
  await db.insert(s.eventCohosts).values({ eventId, clanId: guestClan, status: 'accepted', teamId: guestTeam.id });

  /** An approved entry on a seat in `clanId`, its fee row, and (optionally) a place on a team. */
  const entry = async (clanId: number, teamId: number | null, fee: number | null, extra: { exclude?: boolean } = {}) => {
    n++;
    const person = (await db.insert(s.players).values({ displayName: `p${n}` }).returning())[0].id;
    const login = (await db.insert(s.users).values({ displayName: `p${n}`, playerId: person }).returning())[0].id;
    const [acct] = await db.insert(s.accounts).values({ playerId: person, rsn: `P${n}`, rsnNormalized: `p${n}` }).returning();
    const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member' }).returning();
    const now = new Date().toISOString();
    const [su] = await db
      .insert(s.eventSignups)
      .values({ eventId, userId: login, clanMemberId: seat.id, status: 'approved', profileData: '{}', signedUpAt: now, updatedAt: now, excludeFromPrizePool: !!extra.exclude })
      .returning();
    if (fee != null) await db.insert(s.signupFees).values({ signupId: su.id, amount: fee, status: 'collected' });
    if (teamId != null) await db.insert(s.eventParticipants).values({ eventId, name: `P${n}`, teamId, accountId: acct.id, clanMemberId: seat.id });
  };

  // Host: 2 paying entries on its team.
  await entry(hostClan, hostTeam.id, FEE);
  await entry(hostClan, hostTeam.id, FEE);
  // Guest: 3 paying entries — two on its team, one still in the draft pool (attributed by seat).
  await entry(guestClan, guestTeam.id, FEE);
  await entry(guestClan, guestTeam.id, FEE);
  await entry(guestClan, null, FEE);
  // A per-person second character: an approved entry with NO fee row — not a second fee.
  await entry(guestClan, guestTeam.id, null);
  // A comped sub-in: excluded from the pot, so not counted at all.
  await entry(hostClan, hostTeam.id, FEE, { exclude: true });

  await db.insert(s.payouts).values([
    { eventId, rsn: 'P1', amount: 3_000_000, teamId: hostTeam.id },
    { eventId, rsn: 'P3', amount: 1_000_000, teamId: guestTeam.id },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const byClan = async () => {
  const set = (await settlementForEvent(eventId))!;
  return { set, host: set.clans.find((c) => c.isHost)!, guest: set.clans.find((c) => !c.isHost)! };
};

test('fees are the real fee rows: one per paying entry, the pool counted, comps left out', async () => {
  const { set, host, guest } = await byClan();
  assert.equal(host.entrants, 2, 'the comped sub-in is not an entrant of the pot');
  assert.equal(host.fees, 2_000_000);
  assert.equal(guest.entrants, 4, 'two on the team, one in the pool, one fee-less second character');
  assert.equal(guest.fees, 3_000_000, 'the second character pays no second fee');
  assert.equal(host.winnings, 3_000_000);
  assert.equal(guest.winnings, 1_000_000);
  assert.deepEqual(set.totals, { fees: 5_000_000, winnings: 4_000_000 });
});

test('each-settles: a clan keeps its fees and pays its winners — no transfer', async () => {
  const { host, guest } = await byClan();
  assert.equal(guest.keeps, 2_000_000, 'holding 3M, paid out 1M — not −2M');
  assert.equal(host.keeps, -1_000_000, 'took 2M, owes its winner 3M');
  assert.equal(guest.transfer, 0);
});

test('host-holds: nothing crosses clans; the host keeps what is left of the pot', async () => {
  await db.update(s.events).set({ cashPolicy: 'host-holds' }).where(eq(s.events.id, eventId));
  const { host, guest } = await byClan();
  assert.equal(guest.transfer, 0);
  assert.equal(guest.keeps, 0);
  assert.equal(host.keeps, 1_000_000, '5M in, 4M out');
});

test('clans-collect-host-pays: the co-host sends its fees to the host, who pays everyone', async () => {
  await db.update(s.events).set({ cashPolicy: 'clans-collect-host-pays' }).where(eq(s.events.id, eventId));
  const { host, guest } = await byClan();
  assert.equal(guest.transfer, -3_000_000, 'owes the host the 3M it collected');
  assert.equal(guest.keeps, 0);
  assert.equal(host.keeps, 1_000_000);
});

test('no co-host, or no fee → not relevant', async () => {
  await db.update(s.events).set({ signupFee: 0 }).where(eq(s.events.id, eventId));
  const { set } = await byClan();
  assert.equal(set.relevant, false);
});
