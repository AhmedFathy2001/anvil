// No tile may complete before the event starts — the guarantee the completion GATE enforces for every
// path that inserts a completion (the hiscores sweep, the live plugin push, a submission auto-credit,
// the manual admin/captain toggle all run it first). Distinct from the baseline fix: that keeps a
// stat tile's GAIN from counting pre-event; this stops the COMPLETION itself — including non-stat
// tiles that have no baseline to lean on, and a manual toggle.
//
// Run: npx tsx --test tests/completion-gate-start.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('completion-gate-start');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let evaluateCompletionGate: typeof import('../src/lib/completionGate.ts')['evaluateCompletionGate'];
let eventHasStarted: typeof import('../src/lib/completionGate.ts')['eventHasStarted'];

let eventId: number;
let tileId: number;
let teamId: number;

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

async function gateWithStart(startDate: string | null) {
  await db.update(s.events).set({ startDate }).where(eq(s.events.id, eventId));
  const event = await db.query.events.findFirst({ where: eq(s.events.id, eventId) });
  const tile = await db.query.tiles.findFirst({ where: eq(s.tiles.id, tileId) });
  return evaluateCompletionGate({ event: event!, tile: tile!, teamId });
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ evaluateCompletionGate, eventHasStarted } = await import('../src/lib/completionGate.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'gate', name: 'Gate Test' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Bingo', boardSize: 25 }).returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  teamId = team.id;
  const [tile] = await db
    .insert(s.tiles)
    .values({ eventId, position: 0, label: 'Kill Zulrah', points: 10 })
    .returning();
  tileId = tile.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a tile cannot complete while the start is still in the future', async () => {
  const gate = await gateWithStart(daysFromNow(1));
  assert.equal(gate.allowed, false);
  assert.equal(gate.beforeStart, true, 'marked non-overridable so even an admin toggle is refused');
});

test('a tile cannot complete for an event that has no start at all', async () => {
  const gate = await gateWithStart(null);
  assert.equal(gate.allowed, false);
  assert.equal(gate.beforeStart, true);
});

test('once the event has started the gate stops blocking on time', async () => {
  const gate = await gateWithStart(daysFromNow(-1));
  assert.equal(gate.allowed, true);
  assert.ok(!gate.beforeStart);
  // A plain classic tile has no rule modifier, so the award is null = "score the tile's live weight".
  assert.equal(gate.awardedPoints, null);
});

test('eventHasStarted is the temporal truth, in either stored time format', () => {
  const now = Date.parse('2026-08-29T12:00:00Z');
  assert.equal(eventHasStarted({ startDate: '2026-08-29T11:00:00Z' }, now), true, 'past ISO');
  assert.equal(eventHasStarted({ startDate: '2026-08-29 11:00:00' }, now), true, 'past space-format');
  assert.equal(eventHasStarted({ startDate: '2026-08-29T13:00:00Z' }, now), false, 'future');
  assert.equal(eventHasStarted({ startDate: null }, now), false, 'no start = not started');
});
