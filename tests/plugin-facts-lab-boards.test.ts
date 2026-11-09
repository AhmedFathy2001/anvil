// One kill fact from a character entered on two live lab boards credits BOTH boards. The facts route
// files each board's credit at that board's own submissions route; a board folded in from another
// clan (the lab clan here) must still authenticate the same plugin token, not answer "Unauthorized".
// Platform staff see the hidden lab clan, so its other boards get folded in tagged with it.
// And a banned login's token stays refused.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/plugin-facts-lab-boards.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('facts-lab-boards');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const RSN = 'Labby';
const TOKEN = 'tok-labby';
let userId = 0;
const kills: number[] = [];
const events: number[] = [];

async function facts(facts: object[], extra: object = {}) {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const res = await POST(
    new Request('https://example.test/api/plugin/facts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'X-RSN': RSN,
        'X-Account-Hash': 'hash-labby',
        'x-anvil-clan-slug': 'alpha',
        'X-Anvil-Boards': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ facts, ...extra }),
    }),
  );
  return res;
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const { and, eq } = await import('drizzle-orm');
  const L = await import('../src/lib/lab.ts');

  const [alpha] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  [{ id: userId }] = await db
    .insert(s.users)
    .values({ displayName: RSN, discordId: 'd-labby', pluginTokenHash: tokenHash(TOKEN), playerId: person.id, platformRole: 'staff' })
    .returning();
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase(), accountHash: 'hash-labby', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  await db.insert(s.clanMemberships).values({ clanId: alpha.id, accountId: acct.id, kind: 'member', source: 'roster' });

  // Two live lab sessions, the second one fresher (the live pick); each has a 5-kill Zulrah tile.
  for (const name of ['Chat Test', 'Lab session']) {
    const eventId = await L.createLabSession(userId, { name, hours: 2, boardSize: 2, accounts: [{ accountId: acct.id, name: RSN }] });
    const [tile] = await db
      .update(s.tiles)
      // The same tile name on both boards (the "Tile complete" pair Ahmed saw); 2 kills finish it.
      .set({ label: 'Wintertodt crate', tileType: 'kill', targetNpcs: '["Zulrah"]', requiredAmount: 2 })
      .where(and(eq(s.tiles.eventId, eventId), eq(s.tiles.position, 0)))
      .returning();
    // Starts a second apart so the pick is deterministic.
    await db.update(s.events).set({ startDate: new Date(Date.now() - (events.length ? 30_000 : 90_000)).toISOString() }).where(eq(s.events.id, eventId));
    events.push(eventId);
    kills.push(tile.id);
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('one kill fact credits the kill tile on both live lab boards', async () => {
  const res = await facts([{ k: 'kill', n: { Zulrah: 1 } }]);
  assert.equal(res.status, 200, await res.clone().text());
  const body = (await res.json()) as { credits: { t: number; ok?: boolean; error?: string }[] };
  for (const t of kills) {
    const c = body.credits.find((x) => x.t === t);
    assert.ok(c, `credit for tile ${t}: ${JSON.stringify(body)}`);
    assert.notEqual(c.ok, false, `tile ${t} refused: ${JSON.stringify(c)}`);
  }
  const { db, schema: s } = await loadDb();
  const { inArray } = await import('drizzle-orm');
  const subs = await db.select().from(s.submissions).where(inArray(s.submissions.tileId, kills));
  assert.deepEqual([...new Set(subs.map((r) => r.tileId))].sort(), [...kills].sort());
});

test('a banned login’s token is still refused', async () => {
  const { db, schema: s } = await loadDb();
  const { eq, inArray } = await import('drizzle-orm');
  const before = (await db.select().from(s.submissions).where(inArray(s.submissions.tileId, kills))).length;
  await db.update(s.users).set({ banned: true }).where(eq(s.users.id, userId));
  try {
    const res = await facts([{ k: 'kill', n: { Zulrah: 1 } }]);
    assert.notEqual(res.status, 200);
    assert.equal((await db.select().from(s.submissions).where(inArray(s.submissions.tileId, kills))).length, before);
  } finally {
    await db.update(s.users).set({ banned: false }).where(eq(s.users.id, userId));
  }
});

test('a folded-in lab board is tagged with the addressed clan, which resolves the seat (pins, board reads)', async () => {
  const { GET } = await import('../src/app/api/plugin/config/route.ts');
  const h = { Authorization: `Bearer ${TOKEN}`, 'X-RSN': RSN, 'X-Account-Hash': 'hash-labby', 'x-anvil-clan-slug': 'alpha' };
  const res = await GET(new Request('https://example.test/api/plugin/config', { headers: { ...h, 'X-Anvil-Boards': '1' } }));
  const cfg = (await res.json()) as { boards: { eventId: number; clan: string; teamId: number }[] };
  const lab = cfg.boards.find((b) => b.eventId === events[0]);
  assert.equal(lab?.clan, 'alpha', JSON.stringify(cfg.boards));
  const A = await import('../src/lib/auth.ts');
  const seat = await A.verifyPluginTokenForEvent(new Request('https://example.test/x', { headers: h }), events[0]);
  assert.equal(seat?.teamId, lab?.teamId);
});

test('the live board is a race: one more kill finishes its start tile on both boards, each "Tile complete" named, and the race page moves to step 2', async () => {
  const { db, schema: s } = await loadDb();
  const { and, eq, asc } = await import('drizzle-orm');
  // "Lab session" (the live pick) becomes a tile race: start -> (A | B) -> finish.
  const race = events[1];
  await db.update(s.events).set({ format: 'tilerace' }).where(eq(s.events.id, race));
  const board = await db.select().from(s.tiles).where(eq(s.tiles.eventId, race)).orderBy(asc(s.tiles.position));
  const [start, a, b, end] = board;
  await db.update(s.tiles).set({ raceStep: 0, raceNext: [a.id, b.id] }).where(eq(s.tiles.id, start.id));
  await db.update(s.tiles).set({ raceStep: 1, raceNext: [end.id], label: '2 Araxxor kills' }).where(eq(s.tiles.id, a.id));
  await db.update(s.tiles).set({ raceStep: 1, raceNext: [end.id], label: 'Tanzanite fang' }).where(eq(s.tiles.id, b.id));
  await db.update(s.tiles).set({ raceStep: 2, raceNext: [], label: 'Chambers of Xeric' }).where(eq(s.tiles.id, end.id));
  assert.equal(start.id, kills[1]);

  // Credit first, proof after: the screenshot follows, the tile completes now.
  const res = await facts([{ k: 'kill', n: { Zulrah: 1 } }], { proofPending: true, proof: { kind: 'kill' } });
  assert.equal(res.status, 200, await res.clone().text());
  const body = (await res.json()) as { credits: { t: number; label: string; completed?: boolean }[] };
  // One line per board, never two for the same tile; the other board's carries its name.
  for (const t of kills) assert.equal(body.credits.filter((c) => c.t === t).length, 1, JSON.stringify(body.credits));
  const own = body.credits.find((c) => c.t === kills[1])!;
  const other = body.credits.find((c) => c.t === kills[0])!;
  assert.equal(own.completed, true, JSON.stringify(own));
  assert.equal(other.completed, true, JSON.stringify(other));
  assert.equal(own.label, 'Wintertodt crate');
  assert.equal(other.label, 'Wintertodt crate · Chat Test');

  // The completion counted for the seat's team on the race...
  const [seat] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, race));
  const done = await db.select().from(s.completions).where(and(eq(s.completions.tileId, start.id), eq(s.completions.teamId, seat.teamId!)));
  assert.equal(done.length, 1);
  const R = await import('../src/lib/raceRoutes.ts');
  const route = R.teamRoute(R.raceGraph(await db.select().from(s.tiles).where(eq(s.tiles.eventId, race))), [start.id]);
  assert.deepEqual([...route.open].sort(), [a.id, b.id].sort());

  // ...and the panel's race page, asked again (what the plugin does on "Tile complete"), shows step 2.
  const { GET } = await import('../src/app/api/plugin/ui/route.ts');
  const ui = await GET(new Request('https://example.test/api/plugin/ui?v=home&open=board', {
    headers: { Authorization: `Bearer ${TOKEN}`, 'X-RSN': RSN, 'X-Account-Hash': 'hash-labby', 'x-anvil-clan-slug': 'alpha', 'X-Anvil-Boards': '1' },
  }));
  const page = JSON.stringify(await ui.json());
  assert.ok(page.includes('Step 2 of 3'), page.slice(0, 2000));
  assert.ok(page.includes('Step 2 · open now'));
  assert.ok(page.includes('B: Tanzanite fang'));
});
