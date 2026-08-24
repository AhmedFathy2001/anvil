// Clan-versus-clan: each invited clan is one team, and your seat decides which.
//
// `event_invites` has always taken a clan OR a person, unique per (event, clan), with NO limit of
// two — so an event addressed to five clans was already expressible and canSeeEvent already honoured
// it. What was missing was what happens once they accept: every team was a drafted team, because a
// draft was the only way a team had ever formed.
//
// The rule here is small and the ways it can be quietly wrong are not:
//
//   - which clan is "yours" is the one your ACCOUNT holds a member seat in, never the event's host
//   - a clan must be one team, not two, however many of its members arrive
//   - somebody with no clan at all cannot be parked on the host's team, because playing for the host
//     would distort the very thing a clan-versus-clan board measures
//
// Run: npx tsx --test tests/per-clan-teams.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { isTeamFormation, teamFormationOf } from '../src/lib/teamFormation.ts';

const DB = useTestDatabase('per-clan-teams');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let T: typeof import('../src/lib/perClanTeams.ts');

let host: number;
let rival: number;
let eventId: number;
/** Two members of the host clan, one of the rival, one belonging to nobody. */
let hostAcctA: number;
let hostAcctB: number;
let rivalAcct: number;
let clanlessAcct: number;

async function enter(accountId: number, name: string): Promise<number> {
  const { db, schema: s } = await loadDb();
  const [p] = await db.insert(s.eventParticipants).values({ eventId, name }).returning();
  const seated = await T.seatOnClanTeam({ eventId, accountId, participantId: p.id });
  return seated.ok ? seated.teamId : -1;
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: pl, schema: s } = await loadDb();
  pool = pl;
  T = await import('../src/lib/perClanTeams.ts');

  const cs = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host Clan' },
      { slug: 'rival', name: 'Rival Clan' },
    ])
    .returning();
  host = cs[0].id;
  rival = cs[1].id;

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: host, name: 'Clan Clash', boardSize: 25, teamFormation: 'per_clan', visibility: 'invited' })
    .returning();
  eventId = ev.id;
  assert.equal(ev.teamFormation, 'per_clan');

  // THREE CLANS COULD BE INVITED, not two — the constraint is per (event, clan), not a pair.
  await db.insert(s.eventInvites).values({ eventId, clanId: rival });

  const people = await db
    .insert(s.players)
    .values([{ displayName: 'A' }, { displayName: 'B' }, { displayName: 'R' }, { displayName: 'Nomad' }])
    .returning();

  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: people[0].id, rsn: 'Host A', rsnNormalized: 'host a' },
      { playerId: people[1].id, rsn: 'Host B', rsnNormalized: 'host b' },
      { playerId: people[2].id, rsn: 'Rival One', rsnNormalized: 'rival one' },
      { playerId: people[3].id, rsn: 'No Clan', rsnNormalized: 'no clan' },
    ])
    .returning();
  [hostAcctA, hostAcctB, rivalAcct, clanlessAcct] = accts.map((a) => a.id);

  await db.insert(s.clanMemberships).values([
    { clanId: host, accountId: hostAcctA, kind: 'member', source: 'roster' },
    { clanId: host, accountId: hostAcctB, kind: 'member', source: 'roster' },
    { clanId: rival, accountId: rivalAcct, kind: 'member', source: 'roster' },
    // The rival's player also GUESTS in the host clan, which is how they got a seat to play at all.
    // Their team must still be their own clan's — the guest seat is how they entered, not who they
    // are playing for, and confusing the two would put a rival on the host's team.
    { clanId: host, accountId: rivalAcct, kind: 'guest', source: 'application' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The vocabulary ────────────────────────────────────────────────────────────────────────────

test('an unrecognised formation falls back to draft, the shape that always worked', () => {
  assert.equal(isTeamFormation('per_clan'), true);
  assert.equal(isTeamFormation('draft'), true);
  assert.equal(isTeamFormation('clans'), false);

  // The OPEN answer, unlike the visibility vocabularies — there a typo that exposes a clan is the
  // danger, here it is a board nobody can be placed on.
  assert.equal(teamFormationOf('nonsense'), 'draft');
  assert.equal(teamFormationOf(null), 'draft');
});

// ── The rule ──────────────────────────────────────────────────────────────────────────────────

test('a member plays for their own clan', async () => {
  const teamId = await enter(hostAcctA, 'Host A');
  const { db, schema: s } = await loadDb();
  const team = await db.query.teams.findFirst({ where: eq(s.teams.id, teamId) });
  assert.equal(team!.clanId, host);
  assert.equal(team!.name, 'Host Clan');
});

test('a second member of the same clan joins the SAME team, not a new one', async () => {
  const first = await enter(hostAcctB, 'Host B');
  const { db, schema: s } = await loadDb();
  const all = await db.select().from(s.teams).where(eq(s.teams.eventId, eventId));
  assert.equal(all.length, 1, 'one clan is one team however many of them turn up');
  assert.equal(first, all[0].id);
});

test('a rival plays for their OWN clan, not the host whose board it is', async () => {
  const teamId = await enter(rivalAcct, 'Rival One');
  const { db, schema: s } = await loadDb();
  const team = await db.query.teams.findFirst({ where: eq(s.teams.id, teamId) });
  assert.equal(
    team!.clanId,
    rival,
    'they hold a GUEST seat in the host clan — that is how they entered, not who they play for',
  );

  const all = await db.select().from(s.teams).where(eq(s.teams.eventId, eventId));
  assert.equal(all.length, 2);
  assert.notEqual(all[0].color, all[1].color, 'and the two are distinguishable on a board');
});

test('somebody with no clan is refused rather than parked on the host', async () => {
  const { db, schema: s } = await loadDb();
  const [p] = await db.insert(s.eventParticipants).values({ eventId, name: 'No Clan' }).returning();
  const seated = await T.seatOnClanTeam({ eventId, accountId: clanlessAcct, participantId: p.id });

  assert.deepEqual(seated, { ok: false, reason: 'no-clan' });
  const row = await db.query.eventParticipants.findFirst({ where: eq(s.eventParticipants.id, p.id) });
  assert.equal(row!.teamId, null, 'silently playing for the host would distort what the board measures');
});

test('the board can name the clans on it', async () => {
  const on = await T.clansOnBoard(eventId);
  assert.deepEqual(
    on.map((c) => c.name).sort(),
    ['Host Clan', 'Rival Clan'],
    'which is the fact that makes a multi-clan board legible at a glance',
  );
});

test('and counts who could not be placed', async () => {
  assert.equal(await T.unplaceable(eventId), 1, 'the clanless entrant, so a host can chase it');
});

// ── The constraint ────────────────────────────────────────────────────────────────────────────

test('a clan cannot be two teams on one board', async () => {
  const { db, schema: s } = await loadDb();

  // Checked by SQLSTATE, not by message. Drizzle wraps the driver error in one of its own — the
  // outer message is "Failed query: insert into…", so a regex for /unique/ matches nothing and the
  // assertion passes for the wrong reason on a rejection that never happened.
  let code: string | undefined;
  try {
    await db.insert(s.teams).values({ eventId, clanId: host, name: 'Host Clan Again', color: '#fff' });
  } catch (e) {
    code = ((e as { cause?: { code?: string } }).cause ?? (e as { code?: string })).code;
  }
  assert.equal(
    code,
    '23505', // unique_violation
    'the index is the model: a double-accept must not quietly split a clan in two',
  );
});

test('drafted teams are exempt — many may have no clan at all', async () => {
  const { db, schema: s } = await loadDb();
  const [drafted] = await db
    .insert(s.events)
    .values({ clanId: host, name: 'Ordinary Bingo', boardSize: 25 })
    .returning();
  assert.equal(drafted.teamFormation, 'draft', 'which is what every existing event is');

  // Two clanless teams on one event: the partial index must not treat NULL as a value.
  await db.insert(s.teams).values([
    { eventId: drafted.id, name: 'Team Molten', color: '#d4a017' },
    { eventId: drafted.id, name: 'Team Quench', color: '#3ecf62' },
  ]);
  const all = await db.select().from(s.teams).where(eq(s.teams.eventId, drafted.id));
  assert.equal(all.length, 2);
});
