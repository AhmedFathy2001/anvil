// Clan event modules against a real database: sign-ups with the host's questions, the cap and
// approval, the entry fee's separation of duties, payouts, the survey after, the plugin's one-tap
// sign-up — and that another clan can touch none of it.
//
// Run: npx tsx --test tests/clan-event-modules-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-event-modules');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let CE: typeof import('../src/lib/clanEvents.ts');
let SU: typeof import('../src/lib/clanEventSignups.ts');
let Q: typeof import('../src/lib/clanEventQuestions.ts');
let PO: typeof import('../src/lib/clanEventPayouts.ts');
let SV: typeof import('../src/lib/clanEventSurvey.ts');
let V: typeof import('../src/lib/pluginUi/views.ts');

let clanId = 0;
let otherClan = 0;
const people: { userId: number; playerId: number; displayName: string }[] = [];
const TOKEN = 'cem-token-0';

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  CE = await import('../src/lib/clanEvents.ts');
  SU = await import('../src/lib/clanEventSignups.ts');
  Q = await import('../src/lib/clanEventQuestions.ts');
  PO = await import('../src/lib/clanEventPayouts.ts');
  SV = await import('../src/lib/clanEventSurvey.ts');
  V = await import('../src/lib/pluginUi/views.ts');
  clanId = (await db.insert(s.clans).values({ slug: 'mods', name: 'Mods' }).returning())[0].id;
  otherClan = (await db.insert(s.clans).values({ slug: 'others', name: 'Others' }).returning())[0].id;
  for (let i = 0; i < 4; i++) {
    const [p] = await db.insert(s.players).values({ displayName: `P${i}` }).returning();
    const [u] = await db.insert(s.users).values({ displayName: `User ${i}`, discordId: `cem-${i}`, pluginToken: `cem-token-${i}`, playerId: p.id }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: `Massgoer ${i}`, rsnNormalized: `massgoer ${i}`, shared: false, claimedAt: new Date().toISOString() }).returning();
    await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' });
    people.push({ userId: u.id, playerId: p.id, displayName: `User ${i}` });
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const HOUR = 3_600_000;
async function event(modules: unknown, over: Record<string, unknown> = {}) {
  const p = CE.parseClanEventInput({ title: 'Nex mass', startsAt: new Date(Date.now() + 2 * HOUR).toISOString(), durationMin: 60, repeat: 'none', timezone: 'UTC', ...over });
  assert.ok(p.ok);
  const row = await CE.createClanEvent(clanId, p.input, people[0].userId);
  await CE.setClanEventModules(clanId, row.id, modules);
  return row.id;
}

test('sign-up answers are checked, the cap holds, and approval keeps them waiting', async () => {
  const id = await event({ signups: { on: true, cap: 2, approval: true } });
  const q = await Q.saveQuestions(clanId, id, 'signup', [{ type: 'single', prompt: 'Role?', options: ['Tank', 'DPS'], required: true }]);
  assert.ok(q.ok);
  const qid = String(q.questions[0].id);

  const missing = await SU.signUp(clanId, id, people[1], { answers: {} });
  assert.ok(!missing.ok && /required/.test(missing.error));
  const bad = await SU.signUp(clanId, id, people[1], { answers: { [qid]: 'Healer' } });
  assert.ok(!bad.ok, 'not one of the options');

  const one = await SU.signUp(clanId, id, people[1], { answers: { [qid]: 'Tank' } });
  assert.ok(one.ok && one.value.status === 'pending' && one.value.rsn === 'Massgoer 1');
  assert.ok((await SU.signUp(clanId, id, people[2], { answers: { [qid]: 'DPS' } })).ok);
  const full = await SU.signUp(clanId, id, people[3], { answers: { [qid]: 'DPS' } });
  assert.ok(!full.ok && full.error === 'It’s full.');
  const again = await SU.signUp(clanId, id, people[1], { answers: { [qid]: 'DPS' } });
  assert.ok(again.ok && again.value.answers?.[qid] === 'DPS', 'changing your answers is not a second place');

  const view = await CE.getClanEvent(clanId, id, people[1].userId);
  assert.equal(view?.going, 2);
  assert.equal(view?.signup?.myStatus, 'pending');
  assert.deepEqual(view?.goingNames, ['Massgoer 1', 'Massgoer 2']);

  assert.ok((await SU.withdraw(clanId, id, people[2].userId)).ok);
  assert.ok((await SU.signUp(clanId, id, people[3], { answers: { [qid]: 'DPS' } })).ok, 'a place freed up');
  const rows = await SU.listSignups(clanId, id, view!.occurrence.start);
  const rej = await SU.setSignupStatus(clanId, id, rows.find((r) => r.rsn === 'Massgoer 1')!.id, 'rejected');
  assert.ok(rej.ok);
  const back = await SU.signUp(clanId, id, people[1], { answers: { [qid]: 'Tank' } });
  assert.ok(!back.ok && back.status === 403, 'turned down stays turned down');
  assert.ok((await SU.withdraw(clanId, id, people[1].userId)).ok);
  const retry = await SU.signUp(clanId, id, people[1], { answers: { [qid]: 'Tank' } });
  assert.ok(!retry.ok && retry.status === 403, 'withdrawing can’t wipe a rejection');
});

test('the entry fee: the collector can’t sign off their own collection, a second admin can', async () => {
  const id = await event({ signups: { on: true }, fee: { on: true, amount: 2_000_000 }, payouts: { on: true, addedGp: 1_000_000 } });
  const r = await SU.signUp(clanId, id, people[1], {});
  assert.ok(r.ok && r.value.feeStatus === 'pending' && r.value.feeAmount === 2_000_000);
  const key = r.value.occurrence;

  const collect = await SU.moveFee(clanId, id, r.value.id, 'collect', people[0].userId);
  assert.ok(collect.ok && collect.value.feeStatus === 'collected');
  const own = await SU.moveFee(clanId, id, r.value.id, 'confirm', people[0].userId);
  assert.ok(!own.ok && own.status === 403);
  const second = await SU.moveFee(clanId, id, r.value.id, 'confirm', people[2].userId);
  assert.ok(second.ok && second.value.feeStatus === 'confirmed');

  // Withdrawing after paying keeps the money on the books.
  assert.ok((await SU.withdraw(clanId, id, people[1].userId)).ok);
  const kept = (await SU.listSignups(clanId, id, key))[0];
  assert.equal(kept.status, 'withdrawn');
  assert.equal(kept.feeStatus, 'confirmed');

  const sheet = await PO.payoutSheet(clanId, id, key);
  assert.equal(sheet?.pot, 3_000_000, 'added gp plus the fee collected');
  const win = await PO.addPayout(clanId, id, key, { rsn: 'Massgoer 2', amount: 3_000_000, note: '1st' });
  assert.ok(win.ok);
  assert.ok(!(await PO.addPayout(clanId, id, 'not-a-date', { rsn: 'X', amount: 1 })).ok, 'only this event’s dates');
  const paid = await PO.movePayout(clanId, id, win.value.id, 'pay', people[0].userId);
  assert.ok(paid.ok && paid.value?.status === 'paid');
});

test('another clan can’t read or move any of it', async () => {
  const id = await event({ signups: { on: true }, fee: { on: true, amount: 100 }, payouts: { on: true } });
  const r = await SU.signUp(clanId, id, people[1], {});
  assert.ok(r.ok);
  assert.deepEqual(await SU.listSignups(otherClan, id, r.value.occurrence), []);
  assert.ok(!(await SU.moveFee(otherClan, id, r.value.id, 'collect', people[0].userId)).ok);
  assert.ok(!(await SU.setSignupStatus(otherClan, id, r.value.id, 'withdrawn')).ok);
  assert.equal(await PO.payoutSheet(otherClan, id, r.value.occurrence), null);
  assert.ok(!(await SU.signUp(otherClan, id, people[2], {})).ok);
  assert.equal(await CE.setClanEventModules(otherClan, id, {}), null);
  assert.deepEqual(await Q.loadQuestions(otherClan, id, 'signup'), []);
});

test('the survey: after it ends, for those who signed up, once each', async () => {
  const start = Date.now() - 3 * HOUR;
  const id = await event({ signups: { on: true, closes: 'end' }, survey: { on: true } }, { startsAt: new Date(start).toISOString() });
  const key = new Date(start).toISOString();
  // Signed up while it was on — written directly, since the window has long shut.
  await db.insert(s.clanEventSignups).values({ clanId, clanEventId: id, occurrence: key, userId: people[1].userId, rsn: 'Massgoer 1', status: 'approved' });
  const q = await Q.saveQuestions(clanId, id, 'post', [{ type: 'rating', prompt: 'Fun?', required: true }]);
  assert.ok(q.ok);
  const qid = String(q.questions[0].id);

  const stranger = await SV.surveyFor(clanId, id, people[2].userId);
  assert.ok(!stranger.ok && stranger.status === 403, 'only those who signed up');
  const mine = await SV.surveyFor(clanId, id, people[1].userId);
  assert.ok(mine.ok && mine.value.key === key && !mine.value.answered);
  assert.ok(!(await SV.answerSurvey(clanId, id, people[1].userId, { [qid]: 9 })).ok, 'a rating is 1–5');
  assert.ok((await SV.answerSurvey(clanId, id, people[1].userId, { [qid]: 4 })).ok);
  const twice = await SV.answerSurvey(clanId, id, people[1].userId, { [qid]: 5 });
  assert.ok(!twice.ok && twice.status === 409);
  const results = await SV.surveyResults(clanId, id, key);
  assert.equal(results.responseCount, 1);
  assert.equal(results.results[0].average, 4);

  // An ended one-off with a module is still reachable, as ended.
  const view = await CE.getClanEvent(clanId, id, people[1].userId);
  assert.equal(view?.phase, 'ended');
  assert.equal(view?.surveyOpen, true);
});

test('the plugin signs up in one tap when there is no form, and points at the site when there is', async () => {
  const id = await event({ signups: { on: true } });
  const post = () =>
    V.pluginAct(
      new Request('http://site/api/plugin/ui', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'X-RSN': 'Massgoer 0' } }),
      'clan-event-going',
      { id: String(id), going: '1', open: `clan-event:${id}`, clan: 'mods' },
      {},
    );
  await post();
  assert.equal((await CE.getClanEvent(clanId, id, people[0].userId))?.signup?.myStatus, 'approved');

  const formed = await event({ signups: { on: true } });
  await Q.saveQuestions(clanId, formed, 'signup', [{ type: 'text', prompt: 'Gear?', required: true }]);
  const r = await CE.setGoing(clanId, formed, people[0], true);
  assert.ok(!r.ok, 'a required question can only be answered on the site');
  assert.equal((await CE.getClanEvent(clanId, formed, people[0].userId))?.signup?.hasForm, true);
});
