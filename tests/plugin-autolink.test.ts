// Playing for one clan must not touch your seat in another.
//
// autoLinkOrSuggestOnPlay runs on every plugin request that carries an RSN — the hottest write path
// in the app — and it took a clanId it then used in only one of its two branches. The other found
// the seat by RSN across EVERY roster and updated that one, so:
//
//   someone whose plugin points at clan A, who has a departed seat in clan B, had B's seat revived
//   (leftAt back to null), stamped as seen, and written into B's audit log — while clan A, the clan
//   they were actually playing for, got no seat at all.
//
// Both halves matter and they fail in opposite directions, which is why this drives the real entry
// point rather than asserting on source: the wrong clan is touched AND the right one is skipped, and
// only running it shows both.
//
// resolvePluginMember takes a plain Request, and middleware passes the clan in a header, so the whole
// path is reachable from a test without a server: set Authorization, X-RSN and x-anvil-clan-slug.
//
// Run: npm run test:autolink

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-autolink');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/auth.ts');

let clanA: number;
let clanB: number;
let userId: number;
const TOKEN = 'test-plugin-token-autolink';
const RSN = 'Wanderer';

/** A plugin request as middleware would hand it on: token, RSN hint, and the clan by slug. */
function pluginRequest(slug: string) {
  return new Request('https://example.test/api/plugin/config', {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-RSN': RSN,
      'x-anvil-clan-slug': slug,
    },
  });
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/auth.ts');

  const clanRows = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' },
      { slug: 'bravo', name: 'Bravo', inGameName: 'Bravo CC' },
    ])
    .returning();
  [clanA, clanB] = clanRows.map((c) => c.id);

  const [person] = await db.insert(s.players).values({ displayName: 'Wanderer' }).returning();
  const [user] = await db
    .insert(s.users)
    .values({ displayName: 'Wanderer', discordId: 'disc-1', pluginToken: TOKEN, playerId: person.id })
    .returning();
  userId = user.id;

  // An UNCLAIMED account with a DEPARTED seat in clan B. Unclaimed is the precondition for
  // auto-link to consider it at all; departed is what makes a revival visible.
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase() })
    .returning();
  await db.insert(s.clanMemberships).values({
    clanId: clanB,
    accountId: acct.id,
    kind: 'guest',
    source: 'application',
    leftAt: new Date('2020-01-01').toISOString(),
  });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('playing for Alpha does not revive a departed seat in Bravo', async () => {
  const { db, schema: s } = await loadDb();
  await A.resolvePluginMember(pluginRequest('alpha'));

  const bravoSeat = await db
    .select({ leftAt: s.clanMemberships.leftAt })
    .from(s.clanMemberships)
    .where(eq(s.clanMemberships.clanId, clanB));

  assert.equal(bravoSeat.length, 1, 'still exactly one seat in Bravo');
  assert.notEqual(bravoSeat[0].leftAt, null, 'and it is still departed');
});

test('and Alpha — the clan actually being played for — gets the seat', async () => {
  // The other half. Reviving Bravo's row also meant returning Bravo's seat id as the answer, so the
  // clan the request was FOR ended up with nothing.
  const { db, schema: s } = await loadDb();
  const alphaSeats = await db
    .select({ id: s.clanMemberships.id, kind: s.clanMemberships.kind })
    .from(s.clanMemberships)
    .where(and(eq(s.clanMemberships.clanId, clanA), isNull(s.clanMemberships.leftAt)));

  assert.equal(alphaSeats.length, 1, 'a seat exists in Alpha');
  assert.equal(alphaSeats[0].kind, 'guest', 'a guest seat — only a roster sync makes a member');
});

test('the resolved member is the one in the clan that asked', async () => {
  const { db, schema: s } = await loadDb();
  const resolved = await A.resolvePluginMember(pluginRequest('alpha'));
  assert.ok(resolved, 'resolves');

  const [seat] = await db
    .select({ clanId: s.clanMemberships.clanId })
    .from(s.clanMemberships)
    .where(eq(s.clanMemberships.id, resolved!.clanMemberId));
  assert.equal(seat.clanId, clanA, 'never the other clan’s seat');
});

test('an account already claimed by someone else is left alone', async () => {
  // The ownership guard, which is about the ACCOUNT and so must stay global — a clan-scoped version
  // would miss an owner who plays elsewhere, and the create branch would then take their account.
  const { db, schema: s } = await loadDb();
  const [stranger] = await db.insert(s.players).values({ displayName: 'Stranger' }).returning();
  const [claimed] = await db
    .insert(s.accounts)
    .values({
      playerId: stranger.id,
      rsn: 'Taken Name',
      rsnNormalized: 'taken name',
      claimedAt: new Date().toISOString(),
    })
    .returning();

  const req = new Request('https://example.test/api/plugin/config', {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-RSN': 'Taken Name',
      'x-anvil-clan-slug': 'alpha',
    },
  });
  await A.resolvePluginMember(req);

  const [after] = await db
    .select({ playerId: s.accounts.playerId })
    .from(s.accounts)
    .where(eq(s.accounts.id, claimed.id));
  assert.equal(after.playerId, stranger.id, 'still theirs');
});
