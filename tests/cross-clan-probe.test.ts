// THE THREE-CLAN PROBE — one scripted scenario over the whole cross-clan surface, because every
// scoping bug this project has hit passed types/lint/unit tests and only showed up with real clans
// running together. One host, two co-hosts, and people in different relationships to each.
//
// It exercises the LOGIC layer (the libs that take ids/params) — where the scoping bugs live. The
// session-gated routes (roster POST, the pay route) are proven by their own tests + the team_staff
// DATA asserted here. Run against the preview DB by pointing TEST_DATABASE_URL at it, or fresh:
//
//   npx tsx --test tests/cross-clan-probe.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('cross-clan-probe');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let CO: typeof import('../src/lib/coHost.ts');
let canSeeEvent: typeof import('../src/lib/eventAccess.ts')['canSeeEvent'];
let settlementForEvent: typeof import('../src/lib/coHostSettlement.ts')['settlementForEvent'];
let clanCan: typeof import('../src/lib/entitlements.ts')['clanCan'];
let accountsVisibleToClan: typeof import('../src/lib/accountVisibility.ts')['accountsVisibleToClan'];

// Ids captured across the walk.
const G: Record<string, number> = {};

const FEE = 1_000_000;

async function mkUser(name: string) {
  return (await db.insert(s.users).values({ displayName: name }).returning())[0].id;
}
async function mkMember(clanId: number, name: string, kind: 'member' | 'guest' = 'member') {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind });
  return { playerId: p.id, accountId: a.id };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  CO = await import('../src/lib/coHost.ts');
  ({ canSeeEvent } = await import('../src/lib/eventAccess.ts'));
  ({ settlementForEvent } = await import('../src/lib/coHostSettlement.ts'));
  ({ clanCan } = await import('../src/lib/entitlements.ts'));
  ({ accountsVisibleToClan } = await import('../src/lib/accountVisibility.ts'));

  // Three clans: A hosts, B + C are invited.
  const [A] = await db.insert(s.clans).values({ slug: 'a-host', name: 'Alpha', plan: 'free' }).returning();
  const [B] = await db.insert(s.clans).values({ slug: 'b-guest', name: 'Bravo' }).returning();
  const [C] = await db.insert(s.clans).values({ slug: 'c-guest', name: 'Charlie' }).returning();
  G.A = A.id; G.B = B.id; G.C = C.id;

  // Staff: A owner (host), B admin + mod, C admin.
  G.aOwner = await mkUser('A Owner');
  G.bAdmin = await mkUser('B Admin');
  G.bMod = await mkUser('B Mod');
  G.cAdmin = await mkUser('C Admin');
  await db.insert(s.clanStaff).values([
    { clanId: G.A, userId: G.aOwner, role: 'owner' },
    { clanId: G.B, userId: G.bAdmin, role: 'admin' },
    { clanId: G.B, userId: G.bMod, role: 'moderator' },
    { clanId: G.C, userId: G.cAdmin, role: 'admin' },
  ]);

  // One member in each clan.
  G.pA = (await mkMember(G.A, 'AlphaPlayer')).playerId;
  G.pB = (await mkMember(G.B, 'BravoPlayer')).playerId;
  G.pC = (await mkMember(G.C, 'CharliePlayer')).playerId;

  // A dual person: a main that's a member of A, and a SEPARATE account that's a member of B, unshared.
  const [pd] = await db.insert(s.players).values({ displayName: 'Dual' }).returning();
  G.pD = pd.id;
  await db.insert(s.accounts).values({ playerId: pd.id, rsn: 'DualMain', rsnNormalized: 'dualmain', shared: false }).returning();
  const [dualB] = await db.insert(s.accounts).values({ playerId: pd.id, rsn: 'DualAlt', rsnNormalized: 'dualalt', shared: false }).returning();
  await db.insert(s.clanMemberships).values({ clanId: G.A, accountId: (await db.select({ id: s.accounts.id }).from(s.accounts).where(eq(s.accounts.rsnNormalized, 'dualmain')).then((r) => r[0])).id, kind: 'member' });
  await db.insert(s.clanMemberships).values({ clanId: G.B, accountId: dualB.id, kind: 'member' });

  // A host event: invited-only, with a fee.
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: G.A, name: 'Rumble', boardSize: 25, visibility: 'invited', signupFee: FEE, cashPolicy: 'host-holds', startDate: new Date(Date.now() - 86_400_000).toISOString() })
    .returning();
  G.event = ev.id;

  // A host team of A's own (untagged → maps to the host clan).
  const [teamA] = await db.insert(s.teams).values({ eventId: G.event, name: 'Home', color: '#b07d18' }).returning();
  G.teamA = teamA.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('1 · host invites two clans; the invited-clan admin decides (mod cannot)', async () => {
  const iB = await CO.inviteCoHost(G.event, G.B, G.aOwner);
  const iC = await CO.inviteCoHost(G.event, G.C, G.aOwner);
  G.cohostB = iB.id;
  G.cohostC = iC.id;
  assert.equal((await CO.pendingCoHostInvites(G.B)).length, 1);

  // A moderator can't speak for the clan.
  assert.equal((await CO.acceptCoHostInvite(G.cohostB, G.bMod)).ok, false);
  // The admin can — and it provisions the team + staff.
  const acc = await CO.acceptCoHostInvite(G.cohostB, G.bAdmin);
  assert.equal(acc.ok, true);
  G.teamB = (acc as { ok: true; teamId: number }).teamId;

  // C declines.
  assert.deepEqual(await CO.declineCoHostInvite(G.cohostC, G.cAdmin), { ok: true });
});

test('2 · the accepted co-host gets its own clan-tagged team, staffed by its own people', async () => {
  const team = await db.select().from(s.teams).where(eq(s.teams.id, G.teamB)).then((r) => r[0]);
  assert.equal(team.clanId, G.B, 'team tagged to Bravo');

  const staff = new Set((await db.select().from(s.teamStaff).where(eq(s.teamStaff.teamId, G.teamB))).map((x) => x.userId));
  assert.ok(staff.has(G.bAdmin) && staff.has(G.bMod), 'Bravo admin + mod run their team');

  // Scoping: Bravo's staff hold NO seat on Alpha's host team.
  const onHost = await db.select().from(s.teamStaff).where(and(eq(s.teamStaff.teamId, G.teamA), eq(s.teamStaff.userId, G.bMod)));
  assert.equal(onHost.length, 0, 'Bravo mod cannot reach the host team');
});

test('3 · access follows the relationship: host + accepted co-host in; declined + stranger out', async () => {
  assert.equal(await canSeeEvent({ eventId: G.event, playerId: G.pA }), true, 'Alpha (host) member');
  assert.equal(await canSeeEvent({ eventId: G.event, playerId: G.pB }), true, 'Bravo (accepted co-host) member');
  assert.equal(await canSeeEvent({ eventId: G.event, playerId: G.pC }), false, 'Charlie declined → out');
  assert.equal(await canSeeEvent({ eventId: G.event, playerId: null }), false, 'signed-out on an invited event');
});

test('4 · the S3 privacy rule holds across clans: a clan sees only its own accounts of a shared person', async () => {
  const seenByA = (await accountsVisibleToClan(G.A, G.pD)).map((a) => a.rsn.toLowerCase());
  assert.ok(seenByA.includes('dualmain'), 'Alpha sees the account that plays in Alpha');
  assert.ok(!seenByA.includes('dualalt'), 'Alpha does NOT learn about the unshared Bravo alt');
});

test('5 · cash policy reconciles per clan', async () => {
  // Two host entrants + two Bravo entrants; a host winner (2M) and a Bravo winner (1M).
  await db.insert(s.eventParticipants).values([
    { eventId: G.event, name: 'H1', teamId: G.teamA },
    { eventId: G.event, name: 'H2', teamId: G.teamA },
    { eventId: G.event, name: 'B1', teamId: G.teamB },
    { eventId: G.event, name: 'B2', teamId: G.teamB },
  ]);
  await db.insert(s.payouts).values([
    { eventId: G.event, rsn: 'H1', amount: 2_000_000, teamId: G.teamA },
    { eventId: G.event, rsn: 'B1', amount: 1_000_000, teamId: G.teamB },
  ]);

  const set = (await settlementForEvent(G.event))!;
  assert.equal(set.relevant, true);
  const host = set.clans.find((c) => c.isHost)!;
  const bravo = set.clans.find((c) => c.clanId === G.B)!;
  assert.equal(host.fees, 2_000_000);
  assert.equal(host.winnings, 2_000_000);
  assert.equal(host.net, 0, 'Alpha in = out');
  assert.equal(bravo.fees, 2_000_000);
  assert.equal(bravo.winnings, 1_000_000);
  assert.equal(bravo.net, -1_000_000, 'Bravo put in 2M, took 1M');
});

test('6 · freemium is generous now, and gates when flipped', async () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.equal(clanCan('free', 'host-multi-clan'), true, 'a free clan can host during the growth phase');
  process.env.FREEMIUM_ENFORCED = 'true';
  try {
    assert.equal(clanCan('free', 'host-multi-clan'), false, 'and is gated once enforcement is on');
    assert.equal(clanCan('silver', 'host-multi-clan'), true);
  } finally {
    delete process.env.FREEMIUM_ENFORCED;
  }
});
