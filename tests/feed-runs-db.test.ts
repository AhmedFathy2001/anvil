// Back-to-back repeats on the plugin's Feed, against a real database: the opened list collapses a run
// of deaths to its newest row (pluginUi/feedLists), and a live death that extends the run at the top
// of a list deletes the old top row and pushes the new one with the count (lib/panelRows).
// Run: npx tsx --test tests/feed-runs-db.test.ts (needs the test Postgres, see helpers/testDb).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('feed-runs');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  ({ pool } = await loadDb());
});
after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const T0 = Date.now() - 60 * 60_000;
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();

type Notice = { m: { t: string; feeds: string[]; rows?: { id: string; title: string }[]; ids?: string[] } };

async function listen(fn: () => Promise<void>): Promise<Notice[]> {
  const listener = new (await import('pg')).default.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  const got: Notice[] = [];
  listener.on('notification', (n) => {
    const p = JSON.parse(n.payload!);
    if (p.k === 'rows') got.push(p);
  });
  await listener.query('LISTEN anvil_push');
  await fn();
  await new Promise((r) => setTimeout(r, 150));
  await listener.end();
  return got;
}

test('a run of deaths: one row in the opened lists, live rows replace the top of each list', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'runs', name: 'Runs' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'B', startDate: '2020-01-01 00:00:00', endDate: '2099-01-01 00:00:00', boardSize: 3 }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Ruby', color: '#cf4a3e' }).returning();
  const [pl] = await db.insert(s.players).values({ displayName: 'Dren' }).returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'Drenvox', rsnNormalized: 'drenvox' }).returning();
  const [pl2] = await db.insert(s.players).values({ displayName: 'Moss' }).returning();
  const [acct2] = await db.insert(s.accounts).values({ playerId: pl2.id, rsn: 'Mossy', rsnNormalized: 'mossy' }).returning();
  // A login for each, so the clan's live rows have somebody to go to.
  await db.insert(s.users).values([
    { playerId: pl.id, displayName: 'Dren', discordId: '99310000000000001' },
    { playerId: pl2.id, displayName: 'Moss', discordId: '99310000000000002' },
  ]);
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member' }).returning();
  const [seat2] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct2.id, kind: 'member' }).returning();
  await db.insert(s.eventParticipants).values([
    { eventId: ev.id, name: 'Drenvox', accountId: acct.id, teamId: team.id },
    { eventId: ev.id, name: 'Mossy', accountId: acct2.id, teamId: team.id },
  ]);
  let key = 0;
  const store = async (min: number, over: Record<string, unknown> = {}) => {
    const v = { clanMemberId: seat.id, rsn: 'Drenvox', kind: 'death', eventId: ev.id, teamId: team.id, source: 'Vorkath', occurredAt: at(min), dedupKey: `k${key++}`, ...over };
    const [row] = await db.insert(s.moments).values(v as never).returning();
    return row;
  };
  const asNew = (r: Awaited<ReturnType<typeof store>>) => ({
    id: r.id, rsn: r.rsn, kind: r.kind, itemId: r.itemId, itemName: r.itemName, quantity: r.quantity, valueGp: r.valueGp,
    source: r.source, teamId: r.teamId, occurredAt: r.occurredAt, eventId: r.eventId, tier: r.tier, kc: r.kc, sourceKind: r.sourceKind,
  });

  const d1 = await store(0);
  const d2 = await store(2, { source: 'Zulrah' });
  const d3 = await store(4);

  const { clanFeedList, eventFeedList } = await import('../src/lib/pluginUi/feedLists.ts');
  const clanAll = (await clanFeedList(clan.id, 'all')).list;
  assert.equal(clanAll.length, 1, 'three deaths, one row');
  assert.equal(clanAll[0].id, d3.id, 'the newest death heads it');
  assert.deepEqual(clanAll[0].run?.ids, [d3.id, d2.id, d1.id]);
  assert.equal(clanAll[0].run?.mixed, true);
  const board = (await eventFeedList(ev.id, 'all', null)).items;
  assert.equal(board.length, 1);
  assert.equal(board[0].m?.run?.n, 3);

  // Live: a fourth death extends the run in every list it goes to.
  const { emitMomentRows } = await import('../src/lib/panelRows.ts');
  const d4 = await store(6);
  const live = await listen(() => emitMomentRows(clan.id, 'member', [asNew(d4)]));
  const clanDel = live.find((n) => n.m.t === 'rowsdel' && n.m.feeds.includes(`moments:clan:${clan.id}`));
  assert.deepEqual(clanDel?.m.ids, [`m${d3.id}`], 'the old top row goes');
  const clanRow = live.find((n) => n.m.t === 'rows' && n.m.feeds.includes(`moments:clan:${clan.id}`));
  assert.equal(clanRow?.m.rows?.[0].id, `m${d4.id}`);
  assert.equal(clanRow?.m.rows?.[0].title, 'Died ×4 · last to Vorkath');
  assert.deepEqual(clanRow?.m.feeds, [`moments:clan:${clan.id}`, `moments:clan:${clan.id}:deaths`]);
  const boardRow = live.find((n) => n.m.t === 'rows' && n.m.feeds.includes(`moments:event:${ev.id}`));
  assert.deepEqual(boardRow?.m.feeds, [`moments:event:${ev.id}`, `moments:event:${ev.id}:deaths`, `moments:event:${ev.id}:team:${team.id}`]);
  assert.equal(boardRow?.m.rows?.[0].title, 'Died ×4 · last to Vorkath');
  assert.ok(live.some((n) => n.m.t === 'rowsdel' && n.m.feeds.includes(`moments:event:${ev.id}`) && n.m.ids?.[0] === `m${d3.id}`));

  // Someone else's death in between breaks the run in every list; the next death starts fresh.
  const other = await store(7, { clanMemberId: seat2.id, rsn: 'Mossy' });
  const liveOther = await listen(() => emitMomentRows(clan.id, 'member', [asNew(other)]));
  assert.ok(!liveOther.some((n) => n.m.t === 'rowsdel'), 'nothing deleted');
  const d5 = await store(8);
  const live5 = await listen(() => emitMomentRows(clan.id, 'member', [asNew(d5)]));
  assert.ok(!live5.some((n) => n.m.t === 'rowsdel'));
  assert.equal(live5.find((n) => n.m.t === 'rows')?.m.rows?.[0].title, 'Died to Vorkath');

  // A batch of two more: walked up oldest first, each replacing the one before.
  const d6 = await store(9);
  const d7 = await store(10);
  const batch = await listen(() => emitMomentRows(clan.id, 'member', [asNew(d7), asNew(d6)]));
  const clanSeq = batch.filter((n) => n.m.feeds[0] === `moments:clan:${clan.id}`).map((n) => (n.m.t === 'rowsdel' ? `del ${n.m.ids![0]}` : `add ${n.m.rows![0].id} ${n.m.rows![0].title}`));
  assert.deepEqual(clanSeq, [`del m${d5.id}`, `add m${d6.id} Died to Vorkath ×2`, `del m${d6.id}`, `add m${d7.id} Died to Vorkath ×3`]);

  // A drop between deaths breaks the run in All but not in Deaths: each list gets its own answer.
  await store(11, { kind: 'unique', itemId: 22006, itemName: 'Skeletal visage', valueGp: 30_000_000 });
  const d8 = await store(12);
  const split = await listen(() => emitMomentRows(clan.id, 'member', [asNew(d8)]));
  const clanMsgs = split.filter((n) => n.m.feeds.some((f) => f.startsWith(`moments:clan:${clan.id}`)));
  assert.deepEqual(
    clanMsgs.map((n) => [n.m.t, n.m.feeds.join(','), n.m.t === 'rowsdel' ? n.m.ids![0] : n.m.rows![0].title]),
    [
      ['rows', `moments:clan:${clan.id}`, 'Died to Vorkath'],
      ['rowsdel', `moments:clan:${clan.id}:deaths`, `m${d7.id}`],
      ['rows', `moments:clan:${clan.id}:deaths`, 'Died to Vorkath ×4'],
    ],
  );
});

test('a board hiding its standings collapses only inside the team’s own list', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'hid', name: 'Hid' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'H', startDate: '2020-01-01 00:00:00', endDate: '2099-01-01 00:00:00', boardSize: 3, rules: JSON.stringify({ standings: { visibility: 'at-end' } }) } as never)
    .returning();
  const { boardHidden } = await import('../src/lib/panelRows.ts');
  assert.equal(await boardHidden(ev.id), true, 'the curtain is down');
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Ruby', color: '#cf4a3e' }).returning();
  const [pl] = await db.insert(s.players).values({ displayName: 'H' }).returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: 'Hider', rsnNormalized: 'hider' }).returning();
  await db.insert(s.users).values({ playerId: pl.id, displayName: 'H', discordId: '99310000000000003' });
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ev.id, name: 'Hider', accountId: acct.id, teamId: team.id });
  const mk = async (min: number, k: string) =>
    (await db.insert(s.moments).values({ clanMemberId: seat.id, rsn: 'Hider', kind: 'death', eventId: ev.id, teamId: team.id, source: 'Vorkath', occurredAt: at(min), dedupKey: k }).returning())[0];
  const a = await mk(0, 'a');
  const b = await mk(1, 'b');
  const { emitMomentRows } = await import('../src/lib/panelRows.ts');
  const got = await listen(() =>
    emitMomentRows(clan.id, 'member', [{ ...b, quantity: b.quantity, tier: b.tier, kc: b.kc } as never]),
  );
  const boardMsgs = got.filter((n) => n.m.feeds.some((f) => f.startsWith(`moments:event:${ev.id}`)));
  assert.ok(boardMsgs.every((n) => n.m.feeds.every((f) => f === `moments:event:${ev.id}:team:${team.id}`)), 'only the team list');
  assert.deepEqual(boardMsgs.find((n) => n.m.t === 'rowsdel')?.m.ids, [`m${a.id}`]);
  // And the clan feed never hears a hidden board's moments.
  assert.ok(!got.some((n) => n.m.feeds.some((f) => f.startsWith('moments:clan:'))));
});
