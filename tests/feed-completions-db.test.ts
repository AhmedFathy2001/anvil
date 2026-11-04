// A board's finished tiles for the Feed (lib/pluginUi/feedView boardCompletions): who finished each —
// the recorded finisher, else the last submission's player — and never a tile members can't see.
// Run: npx tsx --test tests/feed-completions-db.test.ts (needs the test Postgres, see helpers/testDb).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('feed-completions');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  ({ pool } = await loadDb());
});
after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the finisher is the recorded one, else the last submission; hidden tiles stay out', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'fc', name: 'FC' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'B', startDate: '2020-01-01 00:00:00', endDate: '2099-01-01 00:00:00', boardSize: 3, tilesRevealed: 1 }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Lab', color: '#00ff00' }).returning();
  const [p1] = await db.insert(s.eventParticipants).values({ eventId: ev.id, name: 'Drenvox', teamId: team.id }).returning();
  const [p2] = await db.insert(s.eventParticipants).values({ eventId: ev.id, name: 'Mossy', teamId: team.id }).returning();
  const tile = (label: string, extra: Record<string, unknown> = {}) =>
    db.insert(s.tiles).values({ eventId: ev.id, position: Math.floor(Math.random() * 1e6), label, ...extra } as never).returning();
  const [team1] = await tile('Lap of seers');
  const [solo] = await tile('Solo KC');
  const [mission] = await tile('Secret mission', { mission: 1 });
  await db.insert(s.submissions).values({ tileId: team1.id, teamId: team.id, playerId: p2.id, amount: 1 } as never);
  await db.insert(s.submissions).values({ tileId: team1.id, teamId: team.id, playerId: p2.id, creditPlayerId: p1.id, amount: 1 } as never);
  await db.insert(s.completions).values({ tileId: team1.id, teamId: team.id });
  await db.insert(s.completions).values({ tileId: solo.id, teamId: team.id, creditPlayerId: p2.id });
  await db.insert(s.completions).values({ tileId: mission.id, teamId: team.id });

  const { boardCompletions } = await import('../src/lib/pluginUi/feedView.ts');
  const rows = await boardCompletions(ev.id);
  const by = new Map(rows.map((r) => [r.label, r.who]));
  assert.equal(by.get('Lap of seers'), 'Drenvox', 'the last submission, its credited player');
  assert.equal(by.get('Solo KC'), 'Mossy', 'the recorded finisher');
  assert.ok(!by.has('Secret mission'), 'an unannounced mission is not named');
});
