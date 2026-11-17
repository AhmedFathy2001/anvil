// Item hunts against a real database (lib/itemHuntDb, lib/weeklyFinish, lib/weeklyPrizeSettle):
// what a plugin report may do, what waits for staff, every way a hunt ends, and that it ends once.
//
// Also runs the whole migration chain, 0269 included, through the app's own migrator.
//
// Run: TESTS_OK=1 npx tsx --test tests/item-hunt-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import type { HuntConfig } from '../src/lib/itemHunt.ts';

const DB = useTestDatabase('item-hunt');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let H: typeof import('../src/lib/itemHuntDb.ts');
let F: typeof import('../src/lib/weeklyFinish.ts');
let C: typeof import('../src/lib/coffer.ts');
let settleWeeklyPrizes: typeof import('../src/lib/weeklyPrizeSettle.ts')['settleWeeklyPrizes'];

let clanId: number;
let staffUserId: number;
const seats: Record<string, number> = {};

const FANG = 12922;
const M = 1_000_000;
const HOUR = 3_600_000;
const START = Date.now() - 48 * HOUR;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

const config = (over: Partial<HuntConfig> = {}): HuntConfig => ({
  v: 1,
  target: 'items',
  items: [{ id: FANG, name: 'Tanzanite fang', sources: ['Zulrah'], count: 'drops' }],
  petGroup: null,
  rule: 'most',
  ends: { kind: 'date' },
  confirm: 'staff',
  killsOf: 'zulrah',
  xpSkill: null,
  ...over,
});

/** A running hunt with everyone entered: baseline 400 kills, 100 gained since. */
async function hunt(over: Partial<HuntConfig> = {}, opts: { places?: number[]; enter?: string[] } = {}) {
  const places = (opts.places ?? []).map((gp) => ({ gp }));
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'hunt',
      metric: 'Tanzanite fang from Zulrah',
      title: 'Item hunt: Tanzanite fang',
      startDate: new Date(START).toISOString(),
      endDate: new Date(Date.now() + 120 * HOUR).toISOString(),
      status: 'active',
      includeGuests: 0,
      prizes: places.length ? JSON.stringify({ places, payZeroGain: false, splitTies: false }) : null,
      hunt: JSON.stringify(config(over)),
    })
    .returning();
  for (const rsn of opts.enter ?? ['Alpha', 'Bravo', 'Carol', 'Guest']) {
    await db.insert(s.weeklyParticipants).values({ competitionId: comp.id, clanMemberId: seats[rsn], rsn, rsnNormalized: rsn.toLowerCase(), baselineValue: 400, currentValue: 500 });
  }
  return comp;
}

const report = (over: Record<string, unknown> = {}) => ({ kind: 'drop', itemId: FANG, itemName: 'Tanzanite fang', quantity: 1, source: 'Zulrah', kc: 512, occurredAt: ago(5), dedupKey: 'client-says-anything', ...over });
const send = (rsn: string, reports: ReturnType<typeof report>[]) => H.recordHuntReports({ clanMemberId: seats[rsn], rsn }, clanId, reports);
const rows = (competitionId: number) => db.select().from(s.huntDrops).where(eq(s.huntDrops.competitionId, competitionId)).orderBy(s.huntDrops.id);
const reload = async (id: number) => (await db.select().from(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.id, id)))[0];
const finish = async (id: number) => { await db.update(s.weeklyCompetitions).set({ status: 'completed' }).where(eq(s.weeklyCompetitions.id, id)); };
const audits = async (type: string) => (await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, type))).length;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  H = await import('../src/lib/itemHuntDb.ts');
  F = await import('../src/lib/weeklyFinish.ts');
  C = await import('../src/lib/coffer.ts');
  ({ settleWeeklyPrizes } = await import('../src/lib/weeklyPrizeSettle.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning();
  clanId = clan.id;
  const [user] = await db.insert(s.users).values({ displayName: 'Olive Owner' }).returning();
  staffUserId = user.id;
  for (const [rsn, kind] of [['Alpha', 'member'], ['Bravo', 'member'], ['Carol', 'member'], ['Guest', 'guest'], ['Outsider', 'member'], ['Flooder', 'member'], ['Burster', 'member']] as const) {
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind }).returning();
    seats[rsn] = m.id;
  }
  await C.recordAdjustment({ clanId, amount: 50 * M, userId: null, note: 'seed' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── What a plugin report may do ──────────────────────────────────────────────────────────────

test('one drop reported three ways is one row, under a key the server built', async () => {
  const comp = await hunt();
  const at = ago(5);
  await send('Alpha', [
    report({ occurredAt: at, source: null, kc: null, dedupKey: 'a' }),
    report({ kind: 'clog', itemId: null, source: null, kc: null, occurredAt: at, dedupKey: 'b' }),
    report({ occurredAt: at, dedupKey: 'c' }),
  ]);
  // "any source" would have taken the sourceless ones; this hunt is Zulrah only, so only the third
  // matched, and a replay under yet another client key lands on the row it already made.
  await send('Alpha', [report({ occurredAt: at, dedupKey: 'replayed-with-a-new-key' })]);
  const all = await rows(comp.id);
  assert.equal(all.length, 1);
  assert.equal(all[0].status, 'counted');
  assert.equal(all[0].origin, 'plugin');
  assert.equal(all[0].kc, 512);
  assert.equal(all[0].statBasis, 'reported');
  assert.ok(all[0].dedupKey.startsWith(`drop|${FANG}|zulrah|`), all[0].dedupKey);
  assert.ok(!all[0].dedupKey.includes('client'));
  await finish(comp.id);
});

test('a first sighting with no source is filled in by the second, on an any-source hunt', async () => {
  const comp = await hunt({ items: [{ id: FANG, name: 'Tanzanite fang', sources: [], count: 'drops' }] });
  const at = Date.now() - 5 * HOUR;
  await send('Alpha', [report({ source: null, kc: null, occurredAt: new Date(at).toISOString() })]);
  await send('Alpha', [report({ occurredAt: new Date(at + 20_000).toISOString() })]);
  const all = await rows(comp.id);
  assert.equal(all.length, 1);
  assert.equal(all[0].source, 'Zulrah');
  assert.equal(all[0].kc, 512);
  await finish(comp.id);
});

test('the wrong source, the wrong item, a character not entered, one who opted out, and a drop outside the window count nothing', async () => {
  const comp = await hunt();
  await send('Alpha', [report({ source: 'Sol Heredit' }), report({ itemId: 4151, itemName: 'Abyssal whip' })]);
  await send('Outsider', [report()]);
  await db.update(s.weeklyParticipants).set({ optedOut: true }).where(eq(s.weeklyParticipants.clanMemberId, seats.Bravo));
  await send('Bravo', [report()]);
  await db.update(s.weeklyParticipants).set({ optedOut: false }).where(eq(s.weeklyParticipants.clanMemberId, seats.Bravo));
  await send('Carol', [report({ occurredAt: new Date(START - HOUR).toISOString() })]);
  assert.equal((await rows(comp.id)).length, 0);
  await finish(comp.id);
});

test('a report that looks wrong is held for staff with the reason, and counts once they confirm it', async () => {
  const comp = await hunt();
  await send('Alpha', [report({ kc: 120 })]);
  let [row] = await rows(comp.id);
  assert.equal(row.status, 'review');
  assert.match(row.flagReason ?? '', /below the site's reading of 500/);
  assert.equal(row.siteKc, 500);
  assert.equal((await H.huntStandings(comp))!.rows.find((r) => r.rsn === 'Alpha')!.count, 0);

  const before = await audits('hunt_drop_confirmed');
  assert.deepEqual(await H.decideHuntDrop(comp, row.id, 'confirm', { userId: staffUserId }), { ok: true });
  [row] = await rows(comp.id);
  assert.equal(row.status, 'counted');
  assert.equal(row.decidedByName, 'Olive Owner');
  assert.equal(await audits('hunt_drop_confirmed'), before + 1);
  assert.equal((await H.huntStandings(comp))!.rows[0].rsn, 'Alpha');
  await finish(comp.id);
});

test('one character cannot flood a hunt: inserts are rate limited, and a burst is held', async () => {
  // Their own seats: the limiter counts per character across the whole process.
  const comp = await hunt({}, { enter: ['Flooder'] });
  const many = Array.from({ length: 40 }, (_, i) => report({ occurredAt: new Date(START + (i + 1) * 20 * 60_000).toISOString(), kc: 501 + i }));
  await send('Flooder', many.slice(0, 20));
  await send('Flooder', many.slice(20));
  const all = await rows(comp.id);
  assert.equal(all.length, 30, 'the limiter stops the 31st insert');
  // Five inside ten minutes: the fifth and after wait for staff.
  await finish(comp.id);
  const comp2 = await hunt({}, { enter: ['Burster'] });
  const burst = Array.from({ length: 6 }, (_, i) => report({ occurredAt: new Date(START + HOUR + i * 60_000).toISOString(), kc: 501 + i }));
  await send('Burster', burst);
  const held = (await rows(comp2.id)).filter((r) => r.status === 'review');
  assert.equal(held.length, 2);
  assert.match(held[0].flagReason ?? '', /within 10 minutes/);
  await finish(comp2.id);
});

// ── Manual proofs ────────────────────────────────────────────────────────────────────────────

test('a manual proof needs a screenshot, the number, and an accepted source; a member\'s waits for staff', async () => {
  const comp = await hunt();
  const [seat] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, comp.id));
  const input = { participantId: seat.id, itemId: FANG, itemName: '', source: 'Zulrah', quantity: 1, occurredAt: ago(3), kc: 640, xp: null, xpSkill: null, screenshotUrl: 'https://example.test/shot.png', note: null };
  const by = { userId: staffUserId, staff: false };
  assert.equal((await H.addManualDrop(comp, { ...input, screenshotUrl: '' }, by)).ok, false);
  assert.equal((await H.addManualDrop(comp, { ...input, kc: null }, by)).ok, false);
  assert.equal((await H.addManualDrop(comp, { ...input, source: 'Sol Heredit' }, by)).ok, false);
  assert.equal((await H.addManualDrop(comp, { ...input, source: null }, by)).ok, false);
  assert.equal((await H.addManualDrop(comp, { ...input, occurredAt: new Date(START - HOUR).toISOString() }, by)).ok, false);
  assert.equal((await rows(comp.id)).length, 0);

  const asked = await H.addManualDrop(comp, input, by);
  assert.ok(asked.ok);
  let [row] = await rows(comp.id);
  assert.equal(row.status, 'pending');
  assert.equal(row.statBasis, 'stated');
  assert.equal(row.siteKc, 500, 'the site\'s own reading is kept beside the stated number');
  assert.equal((await H.huntStandings(comp))!.rows.every((r) => r.count === 0), true);

  await H.decideHuntDrop(comp, row.id, 'confirm', { userId: staffUserId });
  [row] = await rows(comp.id);
  assert.equal(row.status, 'counted');
  const top = (await H.huntStandings(comp))!.rows[0];
  assert.equal(top.count, 1);
  assert.equal(top.drops[0].approvedBy, 'Olive Owner');
  assert.equal(top.drops[0].origin, 'manual');

  // Staff "Add a drop" counts at once and is audit-logged.
  const before = await audits('hunt_drop_added');
  assert.ok((await H.addManualDrop(comp, { ...input, occurredAt: ago(2) }, { userId: staffUserId, staff: true })).ok);
  assert.equal((await rows(comp.id)).filter((r) => r.status === 'counted').length, 2);
  assert.equal(await audits('hunt_drop_added'), before + 1);
  await finish(comp.id);
});

// ── How it ends ──────────────────────────────────────────────────────────────────────────────

test('when the first one lands, staff confirming: the report does not end it, the confirm does', async () => {
  const comp = await hunt({ rule: 'first', ends: { kind: 'drops', n: 1, by: 'all' } });
  const at = ago(6);
  await send('Bravo', [report({ occurredAt: at })]);
  await send('Alpha', [report({ occurredAt: ago(4) })]);
  assert.equal((await reload(comp.id)).status, 'active', 'two reports in and it is still running');
  const standing = (await H.huntStandings(comp))!;
  assert.deepEqual(standing.awaiting.map((d) => d.rsnKey), ['bravo']);
  assert.deepEqual(standing.rows.slice(0, 2).map((r) => r.rsn), ['Bravo', 'Alpha']);

  const first = (await rows(comp.id)).find((r) => r.rsn === 'Bravo')!;
  await H.decideHuntDrop(comp, first.id, 'confirm', { userId: staffUserId });
  const ended = await reload(comp.id);
  assert.equal(ended.status, 'completed');
  assert.equal(Date.parse(ended.endDate), Date.parse(at), 'it ended at the drop, not at the click');
  assert.ok(JSON.parse(ended.hunt!).plannedEnd, 'the planned end is kept for a repeat');
  // The later drop is now outside the window.
  assert.deepEqual((await H.huntStandings(ended))!.rows.filter((r) => r.count > 0).map((r) => r.rsn), ['Bravo']);
});

test('rejecting the first drop takes it out and the hunt carries on to the next', async () => {
  const comp = await hunt({ rule: 'first', ends: { kind: 'drops', n: 1, by: 'all' } });
  await send('Bravo', [report({ occurredAt: ago(6) })]);
  await send('Alpha', [report({ occurredAt: ago(4) })]);
  const first = (await rows(comp.id)).find((r) => r.rsn === 'Bravo')!;
  const before = await audits('hunt_drop_rejected');
  await H.decideHuntDrop(comp, first.id, 'reject', { userId: staffUserId });
  assert.equal(await audits('hunt_drop_rejected'), before + 1);
  assert.equal((await reload(comp.id)).status, 'active');
  const standing = (await H.huntStandings(comp))!;
  assert.deepEqual(standing.rows.filter((r) => r.count > 0).map((r) => r.rsn), ['Alpha']);
  assert.deepEqual(standing.awaiting.map((d) => d.rsnKey), ['alpha']);
  // A second sighting of the rejected drop does not bring it back.
  await send('Bravo', [report({ occurredAt: first.occurredAt })]);
  assert.equal((await rows(comp.id)).find((r) => r.rsn === 'Bravo')!.status, 'rejected');
  await finish(comp.id);
});

test('count plugin drops automatically: the Nth drop ends it by itself, a held one cannot', async () => {
  const comp = await hunt({ ends: { kind: 'drops', n: 2, by: 'all' }, confirm: 'auto' });
  await send('Alpha', [report({ occurredAt: ago(6) })]);
  await send('Bravo', [report({ occurredAt: ago(5), kc: 3 })]);
  assert.equal((await rows(comp.id)).find((r) => r.rsn === 'Bravo')!.status, 'review', 'implausible, so held even in this mode');
  assert.equal((await reload(comp.id)).status, 'active');
  const at = ago(4);
  await send('Carol', [report({ occurredAt: at })]);
  const ended = await reload(comp.id);
  assert.equal(ended.status, 'completed');
  assert.equal(Date.parse(ended.endDate), Date.parse(at));
});

test('first to N by one player', async () => {
  const comp = await hunt({ ends: { kind: 'drops', n: 2, by: 'player' }, confirm: 'auto' });
  await send('Alpha', [report({ occurredAt: ago(9) })]);
  await send('Bravo', [report({ occurredAt: ago(8) })]);
  assert.equal((await reload(comp.id)).status, 'active');
  await send('Bravo', [report({ occurredAt: ago(7), kc: 520 })]);
  assert.equal((await reload(comp.id)).status, 'completed');
});

test('End now and post results: any hunt, once, however many times it is pressed', async () => {
  const comp = await hunt();
  await send('Alpha', [report()]);
  const before = await audits('hunt_ended_by_staff');
  const both = await Promise.all([H.endHuntNow(comp, { userId: staffUserId }), H.endHuntNow(comp, { userId: staffUserId })]);
  assert.equal(both.filter((r) => r.ok && r.ended).length, 1, 'a double click ends it once');
  assert.equal(await audits('hunt_ended_by_staff'), before + 1);
  const ended = await reload(comp.id);
  assert.equal(ended.status, 'completed');
  assert.ok(Date.parse(ended.endDate) <= Date.now());
  // And the lifecycle tick coming along afterwards finds nothing left to finish.
  assert.equal(await F.finishCompetition(comp.id), false);
  assert.deepEqual(await H.endHuntNow(ended, { userId: staffUserId }), { ok: true, ended: false });
});

test('the Nth drop racing the button: one finish, prizes settled once', async () => {
  const comp = await hunt({ ends: { kind: 'drops', n: 1, by: 'all' }, confirm: 'auto', rule: 'first' }, { places: [5 * M] });
  await C.setWeeklyPool({ clanId, competitionId: comp.id, amount: 5 * M, hold: true, userId: null });
  const [byDrop, byButton, byTick] = await Promise.all([
    send('Alpha', [report({ occurredAt: ago(3) })]),
    H.endHuntNow(comp, { userId: staffUserId }),
    F.finishCompetition(comp.id),
  ]);
  void byDrop;
  void byButton;
  void byTick;
  const ended = await reload(comp.id);
  assert.equal(ended.status, 'completed');
  assert.equal(await F.claimFinish(comp.id), null, 'nothing left to claim');
  // Whatever order they landed in, the ledger holds at most one award for the one place.
  await settleWeeklyPrizes(comp.id);
  const awards = (await db.select().from(s.cofferEntries).where(eq(s.cofferEntries.weeklyCompetitionId, comp.id))).filter((e) => e.place != null);
  assert.ok(awards.length <= 1, `expected at most one award, got ${awards.length}`);
});

test('changing how it ends is audit-logged, and going automatic confirms nothing after the fact', async () => {
  const comp = await hunt({ ends: { kind: 'drops', n: 5, by: 'all' } });
  await send('Alpha', [report({ kc: 120 })]);
  await send('Bravo', [report({ occurredAt: ago(4) })]);
  const before = await audits('hunt_settings_changed');
  const r = await H.updateHuntSettings(comp, { confirm: 'auto' }, { userId: staffUserId });
  assert.ok(r.ok);
  assert.equal(r.config.confirm, 'auto');
  assert.deepEqual(r.config.ends, { kind: 'drops', n: 5, by: 'all' });
  assert.equal(await audits('hunt_settings_changed'), before + 1);
  const all = await rows(comp.id);
  assert.equal(all.find((x) => x.rsn === 'Alpha')!.status, 'review', 'the held report is still held');
  assert.equal(all.find((x) => x.rsn === 'Bravo')!.decidedAt, null, 'nothing was confirmed on anyone\'s behalf');
  // Saving the same thing again writes nothing.
  await H.updateHuntSettings(await reload(comp.id), { confirm: 'auto' }, { userId: staffUserId });
  assert.equal(await audits('hunt_settings_changed'), before + 1);
  // Lowering N to what has already landed ends it there and then.
  const lowered = await H.updateHuntSettings(await reload(comp.id), { ends: { kind: 'drops', n: 1, by: 'all' } }, { userId: staffUserId });
  assert.ok(lowered.ok);
  assert.equal((await reload(comp.id)).status, 'completed');
});

// ── Prizes ───────────────────────────────────────────────────────────────────────────────────

test('prizes wait for the drops behind the PAID places, and only those', async () => {
  // A guest (not paid: includeGuests is off) got it first and nobody confirmed theirs. The member
  // who is actually paid has a confirmed drop: the coffer pays.
  const pays = await hunt({ rule: 'first' }, { places: [5 * M] });
  await send('Guest', [report({ occurredAt: ago(9) })]);
  await send('Alpha', [report({ occurredAt: ago(8) })]);
  await H.decideHuntDrop(pays, (await rows(pays.id)).find((r) => r.rsn === 'Alpha')!.id, 'confirm', { userId: staffUserId });
  await finish(pays.id);
  assert.equal((await settleWeeklyPrizes(pays.id)).settled, true);
  const paid = (await db.select().from(s.cofferEntries).where(eq(s.cofferEntries.weeklyCompetitionId, pays.id))).filter((e) => e.place === 1);
  assert.equal(paid.length, 1);
  assert.equal(paid[0].clanMemberId, seats.Alpha);

  // The other way round: the excluded guest above is confirmed, the paying member is not. Held.
  const held = await hunt({ rule: 'first' }, { places: [5 * M] });
  await send('Guest', [report({ occurredAt: ago(9) })]);
  await send('Bravo', [report({ occurredAt: ago(8) })]);
  await H.decideHuntDrop(held, (await rows(held.id)).find((r) => r.rsn === 'Guest')!.id, 'confirm', { userId: staffUserId });
  await finish(held.id);
  assert.deepEqual(await settleWeeklyPrizes(held.id), { settled: false, reserved: 0, unfunded: 0 });
  assert.equal((await reload(held.id)).prizesSettledAt, null, 'not stamped: the pass comes back');
  // Staff confirm the paying drop and the next pass pays.
  await H.decideHuntDrop(await reload(held.id), (await rows(held.id)).find((r) => r.rsn === 'Bravo')!.id, 'confirm', { userId: staffUserId });
  assert.equal((await settleWeeklyPrizes(held.id)).settled, true);
  assert.equal((await settleWeeklyPrizes(held.id)).settled, false, 'and only once');
});

test('"first to get it" pays in the order they got it, not as a tie on one drop each', async () => {
  const comp = await hunt({ rule: 'first', confirm: 'auto' }, { places: [3 * M, 1 * M] });
  await db.update(s.weeklyCompetitions).set({ prizes: JSON.stringify({ places: [{ gp: 3 * M }, { gp: 1 * M }], payZeroGain: false, splitTies: true }) }).where(eq(s.weeklyCompetitions.id, comp.id));
  await send('Carol', [report({ occurredAt: ago(9) })]);
  await send('Alpha', [report({ occurredAt: ago(8) })]);
  await finish(comp.id);
  await settleWeeklyPrizes(comp.id);
  const awards = (await db.select().from(s.cofferEntries).where(eq(s.cofferEntries.weeklyCompetitionId, comp.id))).filter((e) => e.place != null).sort((a, b) => a.place! - b.place!);
  assert.deepEqual(awards.map((a) => [a.clanMemberId, Math.abs(a.amount)]), [[seats.Carol, 3 * M], [seats.Alpha, 1 * M]]);
});

// ── Everything that reads a board ────────────────────────────────────────────────────────────

test('a hunt\'s board is its drops in the rule\'s order, for every surface that reads one', async () => {
  const comp = await hunt();
  await send('Bravo', [report({ occurredAt: ago(9) })]);
  await send('Alpha', [report({ occurredAt: ago(8) })]);
  await send('Alpha', [report({ occurredAt: ago(6), kc: 530 })]);
  const board = await F.finalStandings(comp);
  assert.deepEqual(board.slice(0, 3).map((e) => [e.rsn, e.gained]), [['Alpha', 2], ['Bravo', 1], ['Carol', 0]]);
  assert.deepEqual(await H.huntReportItemIds(clanId), [FANG]);
  await finish(comp.id);
  assert.deepEqual(await H.huntReportItemIds(clanId), [], 'a finished hunt asks the plugin for nothing');
});
