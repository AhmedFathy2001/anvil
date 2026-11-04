// Head-to-head challenges against a real database (lib/h2h): create → accept → progress → win for a
// kill race, a drop race called on the first landing (and nothing before the start), ties, expiry,
// the per-tier caps on both sides, no self / alt challenges, blocks, and cancelling.
//
// Run: npm run test:h2h   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('h2h');
delete process.env.DISCORD_BOT_TOKEN;
delete process.env.ANVIL_SHARED_BOT_TOKEN;

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let H: typeof import('../src/lib/h2h.ts');
let R: typeof import('../src/lib/h2hRules.ts');

const HOUR = 3_600_000;
// "Now", so calls that read the real clock (an answer with no `now`) agree with the explicit ones.
const T0 = new Date();
const at = (ms: number) => new Date(T0.getTime() + ms);

function snap(zulrah: number, slayerXp: number): string {
  return JSON.stringify({
    skills: { overall: { rank: 1, level: 1000, xp: 5_000_000 + slayerXp }, slayer: { rank: 1, level: 80, xp: slayerXp } },
    bosses: { zulrah: { rank: 1, score: zulrah } },
  });
}

interface Person {
  playerId: number;
  userId: number;
  accountId: number;
  rsn: string;
}

async function person(rsn: string, opts: { verified?: boolean; snapshot?: string | null; tier?: string } = {}): Promise<Person> {
  const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [u] = await db.insert(s.users).values({ playerId: p.id, displayName: rsn, discordId: `d-${rsn}` }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({
      playerId: p.id,
      rsn,
      rsnNormalized: rsn.toLowerCase(),
      verifiedAt: opts.verified === false ? null : '2026-01-01 00:00:00',
      verificationMethod: 'plugin',
    })
    .returning();
  if (opts.snapshot !== null) await db.insert(s.accountStatSnapshots).values({ accountId: a.id, snapshot: opts.snapshot ?? snap(100, 1_000_000) });
  if (opts.tier) {
    await db.insert(s.supporterSubscriptions).values({ userId: u.id, tier: opts.tier, status: 'active', startedAt: '2026-01-01 00:00:00' });
  }
  return { playerId: p.id, userId: u.id, accountId: a.id, rsn };
}

async function alt(of: Person, rsn: string): Promise<number> {
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: of.playerId, rsn, rsnNormalized: rsn.toLowerCase(), verifiedAt: '2026-01-01 00:00:00' })
    .returning();
  return a.id;
}

function target(kind: 'kc' | 'xp' | 'drop', durationMin = 60) {
  if (kind === 'kc') return { kind, statKey: 'zulrah', itemIds: [], label: 'Zulrah', durationMin } as const;
  if (kind === 'xp') return { kind, statKey: 'slayer', itemIds: [], label: 'Slayer', durationMin } as const;
  return { kind, statKey: null, itemIds: [11920], label: 'Dragon pickaxe', durationMin } as const;
}

async function create(from: Person, to: Person, kind: 'kc' | 'xp' | 'drop', now = T0) {
  return H.createChallenge({
    playerId: from.playerId,
    userId: from.userId,
    accountId: from.accountId,
    opponentRsn: to.rsn,
    target: target(kind) as unknown as Parameters<typeof H.createChallenge>[0]['target'],
    itemNames: new Map([[11920, 'Dragon pickaxe']]),
    now,
  });
}

async function setLive(p: Person, live: Record<string, number>) {
  await db.update(s.accounts).set({ liveStats: JSON.stringify(live) }).where(eq(s.accounts.id, p.accountId));
}

async function row(id: number) {
  return (await db.query.h2hChallenges.findFirst({ where: eq(s.h2hChallenges.id, id) }))!;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  H = await import('../src/lib/h2h.ts');
  R = await import('../src/lib/h2hRules.ts');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('kill race: create → accept → live progress → win, only gains after the start count', async () => {
  const a = await person('Zezima', { snapshot: snap(100, 1_000_000) });
  const b = await person('Lynx', { snapshot: snap(50, 2_000_000) });
  // Kills before acceptance are part of the start line, never the race.
  await setLive(a, { zulrah: 105 });

  const made = await create(a, b, 'kc');
  assert.ok(made.ok);
  const id = made.ok ? made.id : 0;
  assert.equal((await row(id)).status, 'pending');

  // Only the opponent may accept.
  assert.equal((await H.respondToChallenge({ id, playerId: a.playerId, accept: true, now: at(60_000) })).ok, false);
  const ok = await H.respondToChallenge({ id, playerId: b.playerId, accept: true, now: at(60_000) });
  assert.ok(ok.ok);
  const started = await row(id);
  assert.equal(started.status, 'active');
  assert.equal(started.endsAt?.toISOString(), at(60_000 + HOUR).toISOString());

  await setLive(a, { zulrah: 117 }); // +12 since the start (105)
  await setLive(b, { zulrah: 59 }); // +9
  const mid = await H.challengesForPlayer(a.playerId, { now: at(30 * 60_000) });
  const v = mid.find((c) => c.id === id)!;
  assert.equal(v.me.score, 12);
  assert.equal(v.them.score, 9);
  assert.equal(v.status, 'active');

  // A lagging hiscores read can't take kills back.
  await setLive(a, {});
  await H.challengesForPlayer(a.playerId, { now: at(40 * 60_000) });
  assert.equal((await row(id)).challengerScore, 12);

  assert.equal(await H.settleDueH2h(at(60_000 + HOUR + 30_000)), 1);
  const done = await row(id);
  assert.equal(done.status, 'finished');
  assert.equal(done.result, 'challenger');
  const recA = await H.recordForPlayer(a.playerId, false);
  assert.deepEqual([recA.wins, recA.losses, recA.ties], [1, 0, 0]);
  assert.equal(recA.lastWin?.rsn, 'Lynx');
  const recB = await H.recordForPlayer(b.playerId, false);
  assert.deepEqual([recB.wins, recB.losses], [0, 1]);
  // Private by default: nothing public until both agree.
  assert.equal((await H.recordForPlayer(a.playerId, true)).wins, 0);
  await H.setChallengePublic({ id, playerId: a.playerId, on: true });
  assert.equal((await H.recordForPlayer(a.playerId, true)).wins, 0, 'one side is not enough');
  await H.setChallengePublic({ id, playerId: b.playerId, on: true });
  assert.equal((await H.recordForPlayer(a.playerId, true)).wins, 1);
});

test('XP race with no gains on either side is a tie', async () => {
  const a = await person('TieA');
  const b = await person('TieB');
  const made = await create(a, b, 'xp');
  assert.ok(made.ok);
  const id = made.ok ? made.id : 0;
  assert.ok((await H.respondToChallenge({ id, playerId: b.playerId, accept: true, now: at(0) })).ok);
  await H.settleDueH2h(at(2 * HOUR));
  const done = await row(id);
  assert.equal(done.status, 'finished');
  assert.equal(done.result, 'tie');
  assert.equal((await H.recordForPlayer(a.playerId, false)).ties, 1);
});

test('a start line that could not be read counts from the first snapshot, never from zero', async () => {
  const a = await person('NoSnapA', { snapshot: null });
  const b = await person('NoSnapB');
  const made = await create(a, b, 'xp');
  const id = made.ok ? made.id : 0;
  assert.ok((await H.respondToChallenge({ id, playerId: b.playerId, accept: true, now: at(0) })).ok);
  assert.equal((await row(id)).challengerBaseline, null);
  await db.insert(s.accountStatSnapshots).values({ accountId: a.accountId, snapshot: snap(0, 50_000_000) });
  await H.challengesForPlayer(a.playerId, { now: at(10 * 60_000) });
  const r = await row(id);
  assert.ok(r.challengerBaseline, 'captured late');
  assert.equal(r.challengerScore, 0, 'a whole account is not a gain');
});

test('drop race: nothing before the start; the first landing after it wins at once', async () => {
  const a = await person('DropA');
  const b = await person('DropB');
  const made = await create(a, b, 'drop', at(0));
  const id = made.ok ? made.id : 0;
  assert.deepEqual(await H.h2hDropItemIdsForAccount(b.accountId), [], 'not reported before it runs');
  assert.ok((await H.respondToChallenge({ id, playerId: b.playerId, accept: true, now: at(10 * 60_000) })).ok);
  assert.deepEqual(await H.h2hDropItemIdsForAccount(b.accountId), [11920]);
  assert.deepEqual(await H.h2hDropItemIdsForAccount(a.accountId), [11920]);

  // A drop from before acceptance, and an unrelated item, do nothing.
  assert.equal(await H.recordH2hDrops(b.accountId, [{ itemId: 11920, itemName: null, occurredAt: at(5 * 60_000).toISOString() }], at(11 * 60_000)), 0);
  assert.equal(await H.recordH2hDrops(b.accountId, [{ itemId: 4151, itemName: null, occurredAt: at(12 * 60_000).toISOString() }], at(12 * 60_000)), 0);
  assert.equal((await row(id)).status, 'active');

  // A live log unlock by name counts too.
  assert.equal(await H.recordH2hDrops(b.accountId, [{ itemId: null, itemName: 'Dragon pickaxe', occurredAt: at(20 * 60_000).toISOString() }], at(20 * 60_000)), 1);
  const done = await row(id);
  assert.equal(done.status, 'finished');
  assert.equal(done.result, 'opponent');
  assert.deepEqual(await H.h2hDropItemIdsForAccount(b.accountId), [], 'finished races leave the watch list');
  const list = await H.challengesForPlayer(b.playerId, { now: at(21 * 60_000) });
  assert.equal(list.find((c) => c.id === id)?.outcome, 'won');
  assert.equal(list.find((c) => c.id === id)?.resultLine, 'DropB beat DropA to a Dragon pickaxe');
});

test('drop race nobody wins by the end is a draw', async () => {
  const a = await person('DryA');
  const b = await person('DryB');
  const made = await create(a, b, 'drop');
  const id = made.ok ? made.id : 0;
  assert.ok((await H.respondToChallenge({ id, playerId: b.playerId, accept: true, now: at(0) })).ok);
  await H.settleDueH2h(at(HOUR + 1000));
  assert.equal((await row(id)).result, 'tie');
});

test('an unanswered invitation expires after 24 hours', async () => {
  const a = await person('ExpA');
  const b = await person('ExpB');
  const made = await create(a, b, 'kc', at(0));
  const id = made.ok ? made.id : 0;
  await H.settleDueH2h(at(23 * HOUR));
  assert.equal((await row(id)).status, 'pending');
  await H.settleDueH2h(at(24 * HOUR + 1000));
  assert.equal((await row(id)).status, 'expired');
  const late = await H.respondToChallenge({ id, playerId: b.playerId, accept: true, now: at(25 * HOUR) });
  assert.equal(late.ok, false);
});

test('caps: Free holds 1 open, Supporter 5, Champion unlimited — on both sides', async () => {
  const free = await person('FreeOne');
  const sup = await person('SupFive', { tier: 'supporter' });
  const champ = await person('ChampX', { tier: 'champion' });
  const others = await Promise.all(Array.from({ length: 7 }, (_, i) => person(`Rival${i}`)));

  assert.ok((await create(free, others[0], 'kc')).ok);
  const second = await create(free, others[1], 'kc');
  assert.equal(second.ok, false);
  assert.equal(second.ok ? 0 : second.status, 403);

  for (let i = 0; i < 5; i++) assert.ok((await create(sup, others[i + 1], 'xp')).ok, `supporter #${i + 1}`);
  assert.equal((await create(sup, others[6], 'xp')).ok, false, 'supporter #6');

  for (let i = 0; i < 6; i++) {
    const p = await person(`ChampRival${i}`);
    assert.ok((await create(champ, p, 'xp')).ok, `champion #${i + 1}`);
  }
  assert.equal(await H.capForPlayer(champ.playerId), null);
  assert.equal(await H.capForPlayer(sup.playerId), 5);
  assert.equal(await H.capForPlayer(free.playerId), 1);

  // The opponent's cap bites at acceptance: others[1] (Free) already holds the Supporter's invite,
  // so it is at its one slot once it accepts that; a second acceptance is refused.
  const c1 = (await H.challengesForPlayer(others[1].playerId)).find((c) => c.status === 'pending')!;
  assert.ok((await H.respondToChallenge({ id: c1.id, playerId: others[1].playerId, accept: true })).ok);
  const c2 = await create(champ, others[1], 'kc');
  assert.ok(c2.ok, 'an invitation can wait');
  const refused = await H.respondToChallenge({ id: c2.ok ? c2.id : 0, playerId: others[1].playerId, accept: true });
  assert.equal(refused.ok, false);
  assert.equal(refused.ok ? 0 : refused.status, 403);
});

test('no self, no own alts, no unverified characters', async () => {
  const me = await person('SelfMain');
  const altId = await alt(me, 'SelfAlt');
  const self = await H.createChallenge({ playerId: me.playerId, userId: me.userId, accountId: me.accountId, opponentRsn: 'SelfAlt', target: target('kc') as never });
  assert.equal(self.ok, false);
  const same = await H.createChallenge({ playerId: me.playerId, userId: me.userId, accountId: altId, opponentRsn: 'SelfMain', target: target('kc') as never });
  assert.equal(same.ok, false);
  const ghost = await person('NotProven', { verified: false });
  assert.equal((await create(me, ghost, 'kc')).ok, false);
  // Playing as somebody else's character is refused too.
  const other = await person('OtherGuy');
  const asOther = await H.createChallenge({ playerId: me.playerId, userId: me.userId, accountId: other.accountId, opponentRsn: 'NotProven', target: target('kc') as never });
  assert.equal(asOther.ok, false);
});

test('blocks, decline-all, one open invitation per pair', async () => {
  const a = await person('BlockA', { tier: 'patron' });
  const b = await person('BlockB', { tier: 'patron' });
  const first = await create(a, b, 'kc');
  assert.ok(first.ok);
  assert.equal((await create(a, b, 'xp')).ok, false, 'already one pending between them');
  assert.equal((await create(b, a, 'xp')).ok, false, 'either direction');

  await H.blockPlayer(b.playerId, a.playerId);
  assert.equal((await row(first.ok ? first.id : 0)).status, 'declined', 'blocking declines what is waiting');
  const blocked = await create(a, b, 'kc');
  assert.equal(blocked.ok, false);
  assert.match(blocked.ok ? '' : blocked.error, /isn’t taking challenges/);

  const c = await person('ClosedC');
  await H.setH2hPrefs(c.playerId, { closed: true });
  assert.equal((await create(a, c, 'kc')).ok, false);
  await H.setH2hPrefs(c.playerId, { closed: false });
  assert.ok((await create(a, c, 'kc')).ok);
});

test('cancel: the challenger withdraws a pending one; a running one takes both', async () => {
  const a = await person('CanA', { tier: 'patron' });
  const b = await person('CanB', { tier: 'patron' });
  const p = await create(a, b, 'kc');
  assert.equal((await H.cancelChallenge({ id: p.ok ? p.id : 0, playerId: b.playerId })).ok, false, 'the opponent declines instead');
  assert.ok((await H.cancelChallenge({ id: p.ok ? p.id : 0, playerId: a.playerId })).ok);
  assert.equal((await row(p.ok ? p.id : 0)).status, 'cancelled');

  const r = await create(a, b, 'kc');
  const id = r.ok ? r.id : 0;
  assert.ok((await H.respondToChallenge({ id, playerId: b.playerId, accept: true })).ok);
  const ask = await H.cancelChallenge({ id, playerId: a.playerId });
  assert.ok(ask.ok && ask.waiting);
  assert.equal((await row(id)).status, 'active', 'one side asking is not enough');
  assert.ok((await H.cancelChallenge({ id, playerId: b.playerId })).ok);
  assert.equal((await row(id)).status, 'cancelled');
  const stranger = await person('Stranger');
  assert.equal((await H.cancelChallenge({ id, playerId: stranger.playerId })).ok, false);
});

test('the daily creation cap holds however the slots free up', async () => {
  const a = await person('Spammer', { tier: 'patron' });
  for (let i = 0; i < R.MAX_CREATED_PER_DAY; i++) {
    const p = await person(`Target${i}`);
    const made = await create(a, p, 'kc');
    assert.ok(made.ok, `#${i + 1}`);
    await H.cancelChallenge({ id: made.ok ? made.id : 0, playerId: a.playerId });
  }
  const p = await person('TargetLast');
  const over = await create(a, p, 'kc');
  assert.equal(over.ok, false);
  assert.equal(over.ok ? 0 : over.status, 429);
});
