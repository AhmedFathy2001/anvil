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

async function facts(facts: object[]) {
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
      body: JSON.stringify({ facts }),
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
      .set({ label: `${name} Zulrah`, tileType: 'kill', targetNpcs: '["Zulrah"]', requiredAmount: 5 })
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
