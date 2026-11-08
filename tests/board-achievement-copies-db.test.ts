// Log slots, diaries and quests: one copy in the clan feed AND one on every live board the player is on
// (lib/momentsStore recordSeatMoments). Ended boards get none; a resend adds nothing.
//
// Run: npx tsx --test tests/board-achievement-copies-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('board-achievement-copies');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let M: typeof import('../src/lib/momentsStore.ts');

let clanId: number;
let live1: number;
let live2: number;
let ended: number;
let forceEnded: number;
let member: { clanMemberId: number; rsn: string };

const now = () => new Date().toISOString();
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

async function board(name: string, v: { startDate: string; endDate?: string; forceEndedAt?: string }) {
  const [ev] = await db.insert(s.events).values({ clanId, name, boardSize: 5, ...v }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#f00' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ev.id, teamId: team.id, name: 'Rikkert', clanMemberId: member.clanMemberId });
  return ev.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  M = await import('../src/lib/momentsStore.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'copies', name: 'Copies' }).returning();
  clanId = clan.id;
  const [pl] = await db.insert(s.players).values({ displayName: 'Rikkert' }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'Rikkert', rsnNormalized: 'rikkert' }).returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member', source: 'test' }).returning();
  member = { clanMemberId: m.id, rsn: 'Rikkert' };
  live1 = await board('Live one', { startDate: ago(48), endDate: ago(-48) });
  live2 = await board('Live two', { startDate: ago(24), endDate: ago(-24) });
  ended = await board('Ended', { startDate: ago(96), endDate: ago(48) });
  forceEnded = await board('Force ended', { startDate: ago(96), forceEndedAt: ago(1) });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const obs = () => [
  { kind: 'clog' as const, itemName: 'Dragon warhammer', occurredAt: now(), dedupKey: 'clog|dragon warhammer' },
  { kind: 'diary' as const, itemName: 'Varrock', tier: 'Hard', occurredAt: now(), dedupKey: 'diary|varrock|hard' },
  { kind: 'quest' as const, itemName: 'Dragon Slayer II', occurredAt: now(), dedupKey: 'quest|dragon slayer ii' },
];

async function push() {
  const scopes = await M.activeScopesFor(member.clanMemberId, clanId);
  return M.recordSeatMoments(member, obs(), scopes);
}

test('each achievement lands on both live boards and once in the clan feed; ended boards get none', async () => {
  const r = await push();
  assert.equal(r.stored, 9);
  const rows = await db.select().from(s.moments).where(eq(s.moments.clanMemberId, member.clanMemberId));
  for (const kind of ['clog', 'diary', 'quest']) {
    const of = rows.filter((m) => m.kind === kind);
    assert.deepEqual(of.map((m) => m.eventId).sort((a, b) => (a ?? 0) - (b ?? 0)), [null, live1, live2].sort((a, b) => (a ?? 0) - (b ?? 0)), kind);
    assert.ok(of.filter((m) => m.eventId != null).every((m) => m.teamId != null));
  }
  assert.ok(!rows.some((m) => m.eventId === ended || m.eventId === forceEnded));

  const clanFeed = await M.momentsForClan(clanId, 80);
  assert.deepEqual(clanFeed.map((m) => m.kind).sort(), ['clog', 'diary', 'quest']);
  for (const id of [live1, live2]) {
    assert.deepEqual((await M.momentsForEvent(id, 80)).map((m) => m.kind).sort(), ['clog', 'diary', 'quest']);
  }
  assert.equal((await M.momentsForEvent(ended, 80)).length, 0);
});

test('a resend adds nothing', async () => {
  const r = await push();
  assert.equal(r.stored, 0);
  const rows = await db.select().from(s.moments).where(eq(s.moments.clanMemberId, member.clanMemberId));
  assert.equal(rows.length, 9);
});
