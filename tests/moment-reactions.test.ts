// The clan's Recent drops in the plugin panel, and GZ / gold reactions on them.
//
// Run: npx tsx --test tests/moment-reactions.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import type { Node } from '../src/lib/pluginUi/nodes.ts';

const DB = useTestDatabase('moment-reactions');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let V: typeof import('../src/lib/pluginUi/views.ts');

let petId = 0;
let deathId = 0;
let otherClanMoment = 0;
let fanUserId = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  V = await import('../src/lib/pluginUi/views.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'gz-clan', name: 'GZ Clan' }).returning();
  const [elsewhere] = await db.insert(s.clans).values({ slug: 'other-clan', name: 'Other' }).returning();

  // The lucky one, and a fan in the same clan.
  const [lucky] = await db.insert(s.players).values({ displayName: 'Lucky' }).returning();
  const [luckyAcc] = await db.insert(s.accounts).values({ playerId: lucky.id, rsn: 'Lucky One', rsnNormalized: 'lucky one' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: luckyAcc.id, kind: 'member' }).returning();
  const [fan] = await db.insert(s.players).values({ displayName: 'Fan' }).returning();
  const [fanUser] = await db.insert(s.users).values({ displayName: 'fan', discordId: 'disc-fan', pluginToken: 'fan-token', playerId: fan.id }).returning();
  fanUserId = fanUser.id;
  const [fanAcc] = await db.insert(s.accounts).values({ playerId: fan.id, rsn: 'Big Fan', rsnNormalized: 'big fan' }).returning();
  await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: fanAcc.id, kind: 'member' });
  const [stranger] = await db.insert(s.players).values({ displayName: 'Stranger' }).returning();
  const [strangerAcc] = await db.insert(s.accounts).values({ playerId: stranger.id, rsn: 'Stranger', rsnNormalized: 'stranger' }).returning();
  const [otherSeat] = await db.insert(s.clanMemberships).values({ clanId: elsewhere.id, accountId: strangerAcc.id, kind: 'member' }).returning();

  const at = '2026-11-01 12:00:00';
  [{ id: petId }] = await db.insert(s.moments).values({ clanMemberId: seat.id, rsn: 'Lucky One', kind: 'pet', itemName: 'Pet snakeling', occurredAt: at, dedupKey: 'p1' }).returning();
  [{ id: deathId }] = await db.insert(s.moments).values({ clanMemberId: seat.id, rsn: 'Lucky One', kind: 'death', source: 'Zulrah', occurredAt: '2026-11-01 13:00:00', dedupKey: 'd1' }).returning();
  [{ id: otherClanMoment }] = await db.insert(s.moments).values({ clanMemberId: otherSeat.id, rsn: 'Stranger', kind: 'pet', itemName: 'Baby mole', occurredAt: at, dedupKey: 'p2' }).returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const asFan = () => new Request('http://site/api/plugin/ui', { headers: { Authorization: 'Bearer fan-token', 'X-RSN': 'Big Fan' } });

function texts(n: Node): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if (o.t === 'text' && typeof o.s === 'string') out.push(o.s);
    Object.values(o).forEach(walk);
  };
  walk(n);
  return out;
}

test('the feed is the clan’s drops, never its deaths', async () => {
  const v = await V.pluginView(asFan(), 'moments', { slug: 'gz-clan' });
  const t = texts(v!.ui);
  assert.ok(t.includes('Pet snakeling · pet'));
  assert.ok(!t.includes('Zulrah'), 'a death is a moment, not a drop');
  assert.ok(t.includes('GZ'));
  void deathId;
});

test('GZ toggles on and off, and counts', async () => {
  const on = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'gz' }, {});
  assert.ok(texts(on!.ui).includes('GZ 1'));
  const off = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'gz' }, {});
  assert.ok(!texts(off!.ui).includes('GZ 1'));
  assert.ok(texts(off!.ui).includes('GZ'));
});

test('gold is a supporter’s; anyone else is told so and nothing is stored', async () => {
  const refused = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'gold' }, {});
  assert.ok(texts(refused!.ui).includes('Gold GZs are an Anvil Supporter reaction.'));
  assert.equal((await db.select().from(s.momentReactions)).length, 0);

  await db.insert(s.supporterSubscriptions).values({ userId: fanUserId, tier: 'supporter', status: 'active', startedAt: '2026-10-01T00:00:00Z' });
  const given = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'gold' }, {});
  assert.ok(texts(given!.ui).includes('1'), 'one gold');
  assert.equal((await db.select().from(s.momentReactions)).length, 1);
});

test('a reaction can only land on this clan’s own drops', async () => {
  const v = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(otherClanMoment), kind: 'gz' }, {});
  assert.ok(texts(v!.ui).includes('That drop isn’t in this clan’s feed.'));
  const unknown = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'heart' }, {});
  assert.ok(texts(unknown!.ui).includes('Couldn’t react to that.'));
});

test('without a plugin login a public clan’s feed shows, but nothing can be pressed', async () => {
  const v = await V.pluginView(new Request('http://site/api/plugin/ui'), 'moments', { slug: 'gz-clan' });
  assert.ok(texts(v!.ui).includes('Pet snakeling · pet'));
  assert.ok(!JSON.stringify(v!.ui).includes('"act":"react"'), 'no reaction without knowing who gives it');
});
