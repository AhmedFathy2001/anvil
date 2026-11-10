// Same-named collection-log slots against a real database: an unlock line can only guess which
// "Decorative armour" it was, and the next whole-log sync settles it — the tile credit moves to the
// slot the log really holds (or is removed when none fits), the profile row is replaced with the true
// id and keeps the unlock's date, and a manual credit is never touched.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/clog-same-name-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('clog-same-name');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
const ids = {} as Record<string, number>;

const RED_BODY = 4069; // the first "Decorative armour" — what the unlock line guesses
const GOLD_BODY = 4509; // the one they actually got
const RED_SHIELD = 4072; // guessed for "Decorative shield"; the log holds no shield at all
const RED_HELM = 4071; // a staff member's manual credit, which the log doesn't hold either

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

function req(body: object) {
  return new Request('https://example.test/api/plugin/clog', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer tok-cw',
      'X-RSN': 'Cwguy',
      'X-Account-Hash': 'hash-cw',
      'x-anvil-clan-slug': 'alpha',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const tileSubs = () => db.select().from(s.submissions).where(eq(s.submissions.tileId, ids.tile));
const logRows = () => db.select().from(s.memberClogItems).where(eq(s.memberClogItems.accountId, ids.account));

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const [person] = await db.insert(s.players).values({ displayName: 'Cwguy' }).returning();
  await db.insert(s.users).values({ displayName: 'Cwguy', discordId: 'd-cw', pluginTokenHash: tokenHash('tok-cw'), playerId: person.id });
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Cwguy', rsnNormalized: 'cwguy', accountHash: 'hash-cw', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  ids.account = acct.id;
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster' }).returning();

  // A synced log from before the event: one old Zulrah item.
  await db.insert(s.memberClog).values({ accountId: acct.id, pagesSynced: 1, pagesTotal: 1, obtained: 1, total: 10, syncedAt: day(-10) });
  await db.insert(s.memberClogItems).values({ accountId: acct.id, itemId: 12922, pageName: 'Zulrah', quantity: 1, firstSeenAt: null });

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Castle Wars week', boardSize: 3, startDate: day(-1), endDate: day(5), tilesRevealed: 1, startNotified: 1 })
    .returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Saradomin', color: '#fff' }).returning();
  const [p] = await db
    .insert(s.eventParticipants)
    .values({ eventId: ev.id, clanMemberId: seat.id, accountId: acct.id, name: 'Cwguy', teamId: team.id })
    .returning();
  const [tile] = await db
    .insert(s.tiles)
    .values({ eventId: ev.id, position: 0, label: '5 Castle Wars slots', tileType: 'clog', targetNpcs: '["Castle Wars"]', requiredAmount: 5, points: 10 })
    .returning();
  Object.assign(ids, { event: ev.id, team: team.id, player: p.id, tile: tile.id });

  // Staff credited a helm by hand. It is no guess, so the sync must leave it alone.
  await db.insert(s.submissions).values({
    tileId: tile.id, teamId: team.id, playerId: p.id, amount: 1, itemId: RED_HELM, note: 'Checked their bank', source: 'web',
  });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the unlock lines credit (and log) the first fitting same-named slot', async () => {
  const { POST } = await import('../src/app/api/plugin/clog/route.ts');
  const res = await POST(req({ unlocks: [{ name: 'Decorative armour' }, { name: 'Decorative shield' }] }));
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.tileSlots, 2);
  assert.equal(body.recorded, 2);
  const credited = (await tileSubs()).map((r) => r.itemId).sort((a, b) => a! - b!);
  assert.deepEqual(credited, [RED_BODY, RED_HELM, RED_SHIELD]);
  const logged = (await logRows()).map((r) => r.itemId);
  assert.ok(logged.includes(RED_BODY) && logged.includes(RED_SHIELD));
});

test('a whole-log sync moves the guess to the true slot, removes the one with no fit, and leaves manual credits', async () => {
  const guessedRow = (await logRows()).find((r) => r.itemId === RED_BODY)!;
  const { POST } = await import('../src/app/api/plugin/clog/route.ts');
  const res = await POST(req({ items: [{ id: 12922, q: 1 }, { id: GOLD_BODY, q: 1 }] }));
  assert.equal(res.status, 200, await res.clone().text());

  const subs = await tileSubs();
  assert.deepEqual(subs.map((r) => r.itemId).sort((a, b) => a! - b!), [RED_HELM, GOLD_BODY].sort((a, b) => a - b));
  const moved = subs.find((r) => r.itemId === GOLD_BODY)!;
  assert.match(moved.note ?? '', /Decorative armour/);
  assert.equal(subs.find((r) => r.itemId === RED_HELM)!.source, 'web');

  // The profile row is the true id now, dated when the unlock line fired rather than at the sync.
  const rows = await logRows();
  assert.deepEqual(rows.map((r) => r.itemId).sort((a, b) => a - b), [GOLD_BODY, 12922].sort((a, b) => a - b));
  assert.equal(rows.find((r) => r.itemId === GOLD_BODY)!.firstSeenAt, guessedRow.firstSeenAt);
});
