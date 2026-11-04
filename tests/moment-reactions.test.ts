// The clan's Recent drops in the plugin panel, and GZ / gold reactions on them.
//
// Run: npx tsx --test tests/moment-reactions.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
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
  const [fanUser] = await db.insert(s.users).values({ displayName: 'fan', discordId: 'disc-fan', pluginTokenHash: tokenHash('fan-token'), playerId: fan.id }).returning();
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

test('someone outside the clan can read a public feed but never GZ it', async () => {
  const [outsider] = await db.insert(s.players).values({ displayName: 'Outsider' }).returning();
  await db.insert(s.users).values({ displayName: 'out', discordId: 'disc-out', pluginTokenHash: tokenHash('out-token'), playerId: outsider.id });
  await db.insert(s.accounts).values({ playerId: outsider.id, rsn: 'Outsider', rsnNormalized: 'outsider' });
  const asOut = () => new Request('http://site/api/plugin/ui', { headers: { Authorization: 'Bearer out-token', 'X-RSN': 'Outsider' } });
  const v = await V.pluginView(asOut(), 'moments', { slug: 'gz-clan' });
  assert.ok(texts(v!.ui).includes('Pet snakeling · pet'));
  assert.ok(!JSON.stringify(v!.ui).includes('"act":"react"'), 'no buttons for an outsider');
  const before = (await db.select().from(s.momentReactions)).length;
  const refused = await V.pluginAct(asOut(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'gz' }, {});
  assert.ok(texts(refused!.ui).includes('Only clanmates can GZ these drops.'));
  assert.equal((await db.select().from(s.momentReactions)).length, before, 'nothing stored');
});

test('without a plugin login a public clan’s feed shows, but nothing can be pressed', async () => {
  const v = await V.pluginView(new Request('http://site/api/plugin/ui'), 'moments', { slug: 'gz-clan' });
  assert.ok(texts(v!.ui).includes('Pet snakeling · pet'));
  assert.ok(!JSON.stringify(v!.ui).includes('"act":"react"'), 'no reaction without knowing who gives it');
});

// ── Feed rows: a death takes Sad / Sit, everything else a GZ ─────────────────────────────────────

const row = (id: number, kind: string) => V.pluginAct(asFan(), 'react-row', { slug: 'gz-clan', id: String(id), kind }, {});
const stored = async (momentId: number) =>
  (await db.select().from(s.momentReactions)).filter((r) => r.momentId === momentId && r.userId === fanUserId).map((r) => r.kind).sort();
const errorOf = (v: Awaited<ReturnType<typeof row>>) => texts(v!.ui)[0];

test('a clanmate can Sad and Sit a death, each toggling like a GZ', async () => {
  assert.equal(errorOf(await row(deathId, 'sad')), undefined);
  assert.equal(errorOf(await row(deathId, 'sit')), undefined);
  assert.deepEqual(await stored(deathId), ['sad', 'sit']);
  await row(deathId, 'sad');
  assert.deepEqual(await stored(deathId), ['sit'], 'pressed again, taken back');
});

test('no GZ on a death, and no Sad or Sit on a drop', async () => {
  assert.equal(errorOf(await row(deathId, 'gz')), 'Couldn’t react to that.');
  assert.equal(errorOf(await row(deathId, 'gold')), 'Couldn’t react to that.', 'a gold GZ is still a GZ');
  assert.equal(errorOf(await row(petId, 'sit')), 'Couldn’t react to that.');
  assert.equal(errorOf(await row(petId, 'sad')), 'Couldn’t react to that.');
  assert.ok(!(await stored(deathId)).includes('gz'));
  assert.ok(!(await stored(petId)).some((k) => k === 'sad' || k === 'sit'));
  // The old Recent drops list never takes a death's reactions either.
  const old = await V.pluginAct(asFan(), 'react', { slug: 'gz-clan', id: String(petId), kind: 'sit' }, {});
  assert.ok(texts(old!.ui).includes('Couldn’t react to that.'));
});

test('a board’s death takes Sad / Sit from its players; its drops and outsiders get nothing', async () => {
  const [clan] = await db.select().from(s.clans).where(eq(s.clans.slug, 'gz-clan'));
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Death Board', boardSize: 2, startDate: '2026-10-01T00:00:00.000Z' }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Reds', color: '#cc0000' }).returning();
  const [fanAcc] = (await db.select().from(s.accounts)).filter((a) => a.rsn === 'Big Fan');
  await db.insert(s.eventParticipants).values({ eventId: ev.id, teamId: team.id, accountId: fanAcc.id, name: 'Big Fan' });
  const [seat] = (await db.select().from(s.clanMemberships)).filter((m) => m.accountId !== fanAcc.id && m.clanId === clan.id);
  const [{ id: boardDeath }] = await db
    .insert(s.moments)
    .values({ clanMemberId: seat.id, eventId: ev.id, teamId: team.id, rsn: 'Lucky One', kind: 'death', source: 'Vorkath', occurredAt: '2026-11-02 10:00:00', dedupKey: 'bd1' })
    .returning();
  const [{ id: boardPet }] = await db
    .insert(s.moments)
    .values({ clanMemberId: seat.id, eventId: ev.id, teamId: team.id, rsn: 'Lucky One', kind: 'pet', itemName: 'Vorki', occurredAt: '2026-11-02 10:05:00', dedupKey: 'bp1' })
    .returning();

  const onBoard = (id: number, kind: string, req = asFan()) => V.pluginAct(req, 'react-row', { e: String(ev.id), id: String(id), kind }, {});
  assert.equal(errorOf(await onBoard(boardDeath, 'sit')), undefined);
  assert.deepEqual(await stored(boardDeath), ['sit']);
  assert.equal(errorOf(await onBoard(boardDeath, 'gz')), 'Couldn’t react to that.');
  assert.equal(errorOf(await onBoard(boardPet, 'gz')), 'Couldn’t react to that.', 'a board’s drops stay without a GZ');
  assert.equal(errorOf(await onBoard(deathId, 'sad')), 'That isn’t in this event’s feed.', 'a death from off the board');

  const [outsider] = await db.insert(s.players).values({ displayName: 'Nobody' }).returning();
  await db.insert(s.users).values({ displayName: 'nobody', discordId: 'disc-nobody', pluginTokenHash: tokenHash('nobody-token'), playerId: outsider.id });
  const asNobody = new Request('http://site/api/plugin/ui', { headers: { Authorization: 'Bearer nobody-token' } });
  assert.equal(errorOf(await onBoard(boardDeath, 'sad', asNobody)), 'Only this event’s players can react here.');
  assert.deepEqual(await stored(boardDeath), ['sit']);

  // The board's Feed draws the death with its chips, the pet without.
  const v = await V.pluginView(asFan(), 'feed', { s: `event:${ev.id}` });
  const json = JSON.stringify(v!.ui);
  const rows = (JSON.parse(json).c as { t: string; rows?: { id: string; gz?: unknown; reacts?: { kind: string; n: number; mine: boolean }[] }[] }[]).find((n) => n.t === 'feed')?.rows ?? [];
  const d = rows.find((r) => r.id === `m${boardDeath}`);
  const p = rows.find((r) => r.id === `m${boardPet}`);
  assert.ok(d, 'the death is in the board feed');
  assert.deepEqual(d!.reacts!.map((r) => [r.kind, r.n, r.mine]), [['sad', 0, false], ['sit', 1, true]]);
  assert.equal(d!.gz, undefined);
  assert.ok(p && p.gz === undefined && p.reacts === undefined);
});
