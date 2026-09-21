// Taking yourself off a clan's roster.
//
// Seats arrive without being asked for — an admin adds a name by hand, a plugin session seats you as
// a guest of a clan you were visiting — and until now every way one ended belonged to somebody else.
// This is the person's half.
//
// The interesting case is the one it REFUSES. Membership of a clan that syncs its in-game roster is
// the roster's word; ending such a seat here would last until the next push and then come back on
// its own, so it says so instead of pretending.
//
// Run: npm run test:leaveclan

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('leave-clan');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let leaveClanAsPerson: typeof import('../src/lib/leaveClan.ts')['leaveClanAsPerson'];
let A: typeof import('../src/lib/auth.ts');

let clanId: number;
let visitor: number;
let member: number;

const TOKEN = 'test-token-leave-clan';

async function seatedCharacter(
  playerId: number,
  rsn: string,
  seat: { kind: 'member' | 'guest'; source: string },
) {
  const [acct] = await db
    .insert(s.accounts)
    .values({
      playerId,
      rsn,
      rsnNormalized: rsn.toLowerCase(),
      claimedAt: new Date('2024-01-01').toISOString(),
      verifiedAt: new Date('2024-01-01').toISOString(),
    })
    .returning();
  await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: seat.kind, source: seat.source });
  return acct.id;
}

const liveSeats = async (playerId: number) =>
  db
    .select({ id: s.clanMemberships.id, source: s.clanMemberships.source })
    .from(s.clanMemberships)
    .innerJoin(s.accounts, eq(s.accounts.id, s.clanMemberships.accountId))
    .where(
      and(
        eq(s.clanMemberships.clanId, clanId),
        eq(s.accounts.playerId, playerId),
        isNull(s.clanMemberships.leftAt),
      ),
    );

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ leaveClanAsPerson } = await import('../src/lib/leaveClan.ts'));
  A = await import('../src/lib/auth.ts');

  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'afk', name: 'The AFK Spot', inGameName: 'AFK Spot' })
    .returning();
  clanId = clan.id;

  // Somebody added by hand, on two characters, who never joined the clan chat.
  const [v] = await db.insert(s.players).values({ displayName: 'Visitor' }).returning();
  visitor = v.id;
  await db
    .insert(s.users)
    .values({ displayName: 'Visitor', discordId: 'disc-visitor', pluginToken: TOKEN, playerId: visitor })
    .returning();
  await seatedCharacter(visitor, 'Drop In', { kind: 'guest', source: 'admin' });
  await seatedCharacter(visitor, 'Drop In Alt', { kind: 'guest', source: 'application' });

  // A real member, held by the in-game roster.
  const [m] = await db.insert(s.players).values({ displayName: 'Real Member' }).returning();
  member = m.id;
  await seatedCharacter(member, 'Actually In', { kind: 'member', source: 'roster' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('somebody who was added by hand can take themselves back off', async () => {
  assert.equal((await liveSeats(visitor)).length, 2, 'both characters are seated to begin with');

  const r = await leaveClanAsPerson({ clanId, playerId: visitor, clanName: 'The AFK Spot' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.seats, 2, 'every character of theirs, not just the one they were looking at');
  assert.equal((await liveSeats(visitor)).length, 0);
});

test('the seat records that a person ended it, not the roster', async () => {
  const [seat] = await db
    .select({ source: s.clanMemberships.source, leftAt: s.clanMemberships.leftAt })
    .from(s.clanMemberships)
    .innerJoin(s.accounts, eq(s.accounts.id, s.clanMemberships.accountId))
    .where(and(eq(s.clanMemberships.clanId, clanId), eq(s.accounts.playerId, visitor)));
  assert.equal(seat.source, 'manual');
  assert.ok(seat.leftAt);
});

test('and playing again does not quietly put them back', async () => {
  // The seat-keeping added for people the roster dropped must not undo a person's own decision.
  await A.resolvePluginMember(
    new Request('https://example.test/api/plugin/config', {
      headers: { Authorization: `Bearer ${TOKEN}`, 'X-RSN': 'Drop In', 'x-anvil-clan-slug': 'afk' },
    }),
  );
  assert.equal((await liveSeats(visitor)).length, 0, 'still gone, because they meant it');
});

test('leaving twice is refused rather than pretending', async () => {
  const r = await leaveClanAsPerson({ clanId, playerId: visitor });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'no_seat');
});

test('a real member is told the truth: the in-game roster decides', async () => {
  const r = await leaveClanAsPerson({ clanId, playerId: member, clanName: 'The AFK Spot' });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'in_game_member');
  assert.match(!r.ok ? r.error : '', /clan chat in game/);
  assert.equal((await liveSeats(member)).length, 1, 'and nothing was written');
});

// ── The other door ───────────────────────────────────────────────────────────
// There are two ways to leave: the whole person (above) and one character at a time
// (guestAdmission.leaveClan, behind /api/me/seats/[id]/leave). They have to agree, or which one you
// happened to use would decide whether leaving stuck.

test('the per-seat door refuses the in-game member too', async () => {
  const { leaveClan } = await import('../src/lib/guestAdmission.ts');
  const [seat] = await liveSeats(member);
  assert.equal(await leaveClan(seat.id, member), false, 'the roster still decides');
  assert.equal((await liveSeats(member)).length, 1);
});

test('and it marks what it does end, so it sticks', async () => {
  const { leaveClan } = await import('../src/lib/guestAdmission.ts');
  const [p] = await db.insert(s.players).values({ displayName: 'One Character' }).returning();
  await seatedCharacter(p.id, 'Just Visiting', { kind: 'guest', source: 'application' });

  const [seat] = await liveSeats(p.id);
  assert.equal(await leaveClan(seat.id, p.id), true);

  const [after] = await db
    .select({ source: s.clanMemberships.source, leftAt: s.clanMemberships.leftAt })
    .from(s.clanMemberships)
    .where(eq(s.clanMemberships.id, seat.id));
  assert.equal(after.source, 'manual', 'the same mark the person-level door leaves');
  assert.ok(after.leftAt);
});
