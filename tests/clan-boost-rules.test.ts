// Clan boosts, the pure half: slots, seats, the move cooldown, counting, levels and their grace
// week, the boosters wall and its badges, and the clan-written text.
//
// Run: npx tsx --test tests/clan-boost-rules.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_MS,
  GRACE_DAYS,
  activeBoostIds,
  boostNameClass,
  clanBoostInk,
  clanBoostNameStyle,
  validateClanBoostNameStyle,
  boostPerks,
  boostersWall,
  byBoostLevel,
  cleanRecruitPost,
  cleanRecruitingLine,
  countedBoosts,
  effectiveBoostLevel,
  giftTargetLevel,
  levelFor,
  platformBoostsFor,
  levelProgress,
  levelUpFrom,
  movableAt,
  nextMonthStart,
  onePerClan,
  rowGivesSlots,
  slotTier,
  pickSlot,
  reconcileLevel,
  recruitPostAllowed,
  seatHeldSince,
  seatVerdict,
  seatVerdictText,
  slotsFor,
  stampMs,
  tenureBadge,
  wallForViewer,
  withBoosterAuthor,
  type BoostRow,
  type WallRow,
} from '../src/lib/clanBoostRules.ts';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const days = (n: number) => n * DAY_MS;

test('clan name ink is absent at zero, still at level one, and moving from level two', () => {
  assert.equal(clanBoostInk(0), null);
  assert.deepEqual(clanBoostInk(1), { color: '#ff9a5a', grad: ['#ff9a5a', '#e05ad0', '#7a8cff'] });
  assert.deepEqual(clanBoostInk(2), { color: '#ffd27a', grad: ['#ffd27a', '#ff7ab8', '#7ae0ff'], move: true });
});

test('a clan boost name accepts one to four safe custom colours', () => {
  const style = clanBoostNameStyle({ stops: ['#000000', '#ABCDEF'] });
  assert.deepEqual(style, { stops: ['#000000'.toLowerCase(), '#abcdef'] });
  assert.deepEqual(clanBoostInk(2, style), { color: '#000000', grad: ['#000000', '#abcdef'], move: true });
  assert.deepEqual(clanBoostInk(1, { stops: ['#123456'] }), { color: '#123456' });
  assert.equal(clanBoostNameStyle({ stops: ['red'] }), null);
  assert.equal(clanBoostNameStyle({ stops: [] }), null);
});

test('platform gifts dynamically fill only the missing boosts to their target level', () => {
  assert.equal(platformBoostsFor(3, 2), 5);
  assert.equal(platformBoostsFor(2, 2), 6);
  assert.equal(platformBoostsFor(4, 2), 4);
  assert.equal(platformBoostsFor(9, 2), 0);
  assert.equal(platformBoostsFor(3, 3), 12);
  assert.equal(platformBoostsFor(3, 0), 0);
});

// ---------------------------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------------------------

test('slots per paid tier: Supporter 0, Champion 1, Patron 2, none without one', () => {
  assert.equal(slotsFor('supporter'), 0);
  assert.equal(slotsFor('champion'), 1);
  assert.equal(slotsFor('patron'), 2);
  assert.equal(slotsFor(null), 0);
});

const sub = (o: Partial<{ tier: string; status: string; currentPeriodEnd: string | null; recurrence: string | null }>) => ({
  tier: 'supporter',
  status: 'active',
  currentPeriodEnd: null,
  startedAt: '2026-10-01 00:00:00',
  recurrence: 'yearly',
  ...o,
});

test('slots come from paid time, not invite time; staff gifts only when granted with slots', () => {
  assert.equal(slotTier([sub({ tier: 'champion' })], NOW), 'champion');
  // Invite reward only: no slots.
  assert.equal(slotTier([sub({ tier: 'champion', status: 'granted', recurrence: 'referral', currentPeriodEnd: '2026-12-01 00:00:00' })], NOW), null);
  // Paying Supporter lifted to Champion by an invite: still one slot's worth.
  assert.equal(
    slotTier([sub({ tier: 'supporter' }), sub({ tier: 'champion', status: 'granted', recurrence: 'referral', currentPeriodEnd: '2026-12-01 00:00:00' })], NOW),
    'supporter',
  );
  // A staff gift: without slots by default, with them when staff ticked it.
  const gift = { tier: 'patron', status: 'granted', recurrence: 'gift', currentPeriodEnd: '2027-01-01 00:00:00' };
  assert.equal(slotTier([sub(gift)], NOW), null);
  assert.equal(slotTier([{ ...sub(gift), grantsBoostSlots: false }], NOW), null);
  assert.equal(slotTier([{ ...sub(gift), grantsBoostSlots: true }], NOW), 'patron');
  // The flag means nothing on invite time.
  assert.equal(slotTier([{ ...sub({ tier: 'patron', status: 'granted', recurrence: 'referral', currentPeriodEnd: '2027-01-01 00:00:00' }), grantsBoostSlots: true }], NOW), null);
  // A slot gift above what they pay: the better tier counts.
  assert.equal(slotTier([sub({ tier: 'supporter' }), { ...sub(gift), grantsBoostSlots: true }], NOW), 'patron');
  // Lab grants (active rows) keep counting.
  assert.equal(slotTier([sub({ tier: 'champion', recurrence: 'lab' })], NOW), 'champion');
  assert.equal(rowGivesSlots(sub({})), true);
  // Cancelled but paid to the end of term still counts; past it, not.
  assert.equal(slotTier([sub({ status: 'cancelling', currentPeriodEnd: '2026-11-20 00:00:00' })], NOW), 'supporter');
  assert.equal(slotTier([sub({ status: 'cancelling', currentPeriodEnd: '2026-11-01 00:00:00' })], NOW), null);
  assert.equal(slotTier([sub({ status: 'ended' })], NOW), null);
  assert.equal(slotTier([sub({ status: 'refunded' })], NOW), null);
});

// ---------------------------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------------------------

test('stampMs reads all three stored shapes as UTC', () => {
  assert.equal(stampMs('2026-11-01 00:00:00'), Date.parse('2026-11-01T00:00:00Z'));
  assert.equal(stampMs('2026-11-01'), Date.parse('2026-11-01T00:00:00Z'));
  assert.equal(stampMs('2026-11-01T06:00:00.000Z'), Date.parse('2026-11-01T06:00:00Z'));
  assert.ok(Number.isNaN(stampMs(null)));
});

test('a seat is held since the earlier of Anvil seeing it and the in-game join', () => {
  assert.equal(seatHeldSince('2026-11-01 00:00:00', '2025-03-04'), Date.parse('2025-03-04T00:00:00Z'));
  assert.equal(seatHeldSince('2026-11-01 00:00:00', null), Date.parse('2026-11-01T00:00:00Z'));
  assert.ok(Number.isNaN(seatHeldSince(null, null)));
});

test('only a live member seat at least 14 days old may carry a boost', () => {
  const old = NOW - days(20);
  assert.deepEqual(seatVerdict({ kind: 'member', leftAt: null, heldSince: old }, NOW), { ok: true });
  assert.deepEqual(seatVerdict({ kind: 'member', leftAt: null, heldSince: NOW - days(14) }, NOW), { ok: true });
  assert.deepEqual(seatVerdict({ kind: 'guest', leftAt: null, heldSince: old }, NOW), { ok: false, reason: 'not-member' });
  assert.deepEqual(seatVerdict({ kind: 'event', leftAt: null, heldSince: old }, NOW), { ok: false, reason: 'not-member' });
  assert.deepEqual(seatVerdict({ kind: 'member', leftAt: '2026-11-01 00:00:00', heldSince: old }, NOW), { ok: false, reason: 'left' });
  const young = seatVerdict({ kind: 'member', leftAt: null, heldSince: NOW - days(9) }, NOW);
  assert.equal(young.ok, false);
  if (!young.ok && young.reason === 'too-new') {
    assert.equal(young.daysHeld, 9);
    assert.equal(young.daysLeft, 5);
    assert.equal(young.boostableAt, NOW + days(5));
  } else assert.fail('expected too-new');
  // Unknown age is never boostable yet.
  assert.equal(seatVerdict({ kind: 'member', leftAt: null, heldSince: NaN }, NOW).ok, false);
});

test('the not-yet sentence says how old the seat is and when it can boost', () => {
  const v = seatVerdict({ kind: 'member', leftAt: null, heldSince: NOW - days(9) }, NOW);
  assert.equal(seatVerdictText(v, 'The AFK Spot'), "Your seat in The AFK Spot is 9 days old; boostable in 5 days.");
  assert.match(seatVerdictText(seatVerdict({ kind: 'guest', leftAt: null, heldSince: 0 }, NOW), 'X')!, /guest seat/);
  assert.equal(seatVerdictText({ ok: true }, 'X'), null);
  const oneDay = seatVerdict({ kind: 'member', leftAt: null, heldSince: NOW - days(13) - 3600_000 }, NOW);
  assert.match(seatVerdictText(oneDay, 'X')!, /boostable in 1 day\./);
});

// ---------------------------------------------------------------------------------------------
// Moving and picking a slot
// ---------------------------------------------------------------------------------------------

test('a boost moves a week after placing, or at once when its seat is gone', () => {
  assert.equal(movableAt(NOW, false), NOW + days(7));
  assert.equal(movableAt(NOW, true), 0);
});

test('pickSlot takes the lowest free slot, and never more live rows than slots', () => {
  assert.deepEqual(pickSlot(0, [], NOW), { ok: false, reason: 'no-slots' });
  assert.deepEqual(pickSlot(1, [], NOW), { ok: true, slot: 1 });
  assert.deepEqual(pickSlot(2, [{ slot: 1, ended: false, reusableAt: NaN }], NOW), { ok: true, slot: 2 });
  assert.deepEqual(pickSlot(1, [{ slot: 1, ended: false, reusableAt: NaN }], NOW), { ok: false, reason: 'full' });
  // Downgraded Patron → Supporter with three live (two paused): no room until two go.
  const three = [1, 2, 3].map((slot) => ({ slot, ended: false, reusableAt: NaN }));
  assert.deepEqual(pickSlot(1, three, NOW), { ok: false, reason: 'full' });
  // Live rows in high slot numbers still leave the low ones free.
  assert.deepEqual(pickSlot(2, [{ slot: 3, ended: false, reusableAt: NaN }], NOW), { ok: true, slot: 1 });
});

test('a removed boost leaves its slot cooling for the rest of its week', () => {
  const removed = { slot: 1, ended: true, reusableAt: NOW + days(3) };
  assert.deepEqual(pickSlot(1, [removed], NOW), { ok: false, reason: 'cooling', until: NOW + days(3) });
  // Past the cooldown, free again.
  assert.deepEqual(pickSlot(1, [removed], NOW + days(4)), { ok: true, slot: 1 });
  // Another slot that isn't cooling is taken instead.
  assert.deepEqual(pickSlot(2, [removed], NOW), { ok: true, slot: 2 });
  // Removed with its seat already gone: no cooldown.
  assert.deepEqual(pickSlot(1, [{ slot: 1, ended: true, reusableAt: 0 }], NOW), { ok: true, slot: 1 });
});

// ---------------------------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------------------------

let nextId = 1;
const boost = (userId: number, clanId: number, placedAt: number, o: Partial<BoostRow> = {}): BoostRow => ({
  id: nextId++,
  userId,
  clanId,
  seatId: userId * 100 + clanId,
  placedAt,
  seatLive: true,
  ...o,
});

test('oldest boosts stay active up to the slots; the rest pause', () => {
  const a = boost(1, 10, NOW - days(30));
  const b = boost(1, 11, NOW - days(20));
  const c = boost(1, 12, NOW - days(10));
  const active = activeBoostIds([c, a, b], new Map([[1, 1]]));
  assert.deepEqual([...active], [a.id]);
  // Upgrade back: all three return.
  assert.equal(activeBoostIds([a, b, c], new Map([[1, 3]])).size, 3);
  // Lapsed: none.
  assert.equal(activeBoostIds([a, b, c], new Map()).size, 0);
});

test('a boost whose seat is gone stops counting and frees its place in the active set', () => {
  const gone = boost(1, 10, NOW - days(30), { seatLive: false });
  const next = boost(1, 11, NOW - days(5));
  assert.deepEqual([...activeBoostIds([gone, next], new Map([[1, 1]]))], [next.id]);
});

test('a clan counts at most two boosts from any one person', () => {
  const rows = [boost(1, 10, 1), boost(1, 10, 2), boost(1, 10, 3), boost(2, 10, 4), boost(3, 11, 5)];
  const counted = countedBoosts(rows);
  assert.equal(counted.get(10), 3); // 2 from person 1, 1 from person 2
  assert.equal(counted.get(11), 1);
});

test('levels at 3, 8 and 15 counted boosts, with progress to the next', () => {
  assert.deepEqual([0, 2, 3, 7, 8, 14, 15, 40].map(levelFor), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual(levelProgress(5), { next: 2, need: 8, have: 5 });
  assert.deepEqual(levelProgress(0), { next: 1, need: 3, have: 0 });
  assert.equal(levelProgress(15), null);
  assert.equal(levelUpFrom(2, 3), 1);
  assert.equal(levelUpFrom(3, 4), null);
  assert.equal(levelUpFrom(7, 8), 2);
});

// ---------------------------------------------------------------------------------------------
// Grace
// ---------------------------------------------------------------------------------------------

test('a clan rising takes its level at once; holding changes nothing', () => {
  assert.deepEqual(reconcileLevel(null, 3, NOW), { level: 1, countedLevel: 1, droppedAt: null, graceEndsAt: null, changed: true });
  assert.equal(reconcileLevel({ level: 1, droppedAt: null }, 4, NOW).changed, false);
  assert.equal(reconcileLevel(null, 0, NOW).changed, false);
});

test('dropping below a level keeps its perks for seven days, then settles', () => {
  const first = reconcileLevel({ level: 2, droppedAt: null }, 5, NOW);
  assert.deepEqual(first, { level: 2, countedLevel: 1, droppedAt: NOW, graceEndsAt: NOW + days(GRACE_DAYS), changed: true });
  // Later reads in the same week: still level 2, nothing to write.
  const mid = reconcileLevel({ level: 2, droppedAt: NOW }, 5, NOW + days(3));
  assert.equal(mid.level, 2);
  assert.equal(mid.changed, false);
  // After the week: level 1.
  const after = reconcileLevel({ level: 2, droppedAt: NOW }, 5, NOW + days(7));
  assert.deepEqual(after, { level: 1, countedLevel: 1, droppedAt: null, graceEndsAt: null, changed: true });
  // Climbing back inside the week clears the grace.
  const back = reconcileLevel({ level: 2, droppedAt: NOW }, 8, NOW + days(2));
  assert.deepEqual(back, { level: 2, countedLevel: 2, droppedAt: null, graceEndsAt: null, changed: true });
});

// ---------------------------------------------------------------------------------------------
// Platform gifts on top of the members' own boosts (effectiveBoostLevel)
// ---------------------------------------------------------------------------------------------

const gift = (level: number, expiresAt: string | number | null = null) => ({ level, expiresAt });
const iso = (ms: number) => new Date(ms).toISOString();

test('a gift to Level 2 tops up the gap and shrinks as real boosts arrive', () => {
  const g = gift(2, iso(NOW + days(30)));
  let e = effectiveBoostLevel(null, 0, g, NOW);
  assert.deepEqual([e.level, e.counted, e.organicCounted, e.platformCount, e.giftTargetLevel], [2, 8, 0, 8, 2]);
  e = effectiveBoostLevel(null, 3, g, NOW);
  assert.deepEqual([e.level, e.counted, e.platformCount], [2, 8, 5]);
  e = effectiveBoostLevel(null, 7, g, NOW);
  assert.deepEqual([e.level, e.counted, e.platformCount], [2, 8, 1]);
  assert.equal(e.organic.level, 1, 'what is stored is the members’ own level, never the gift');
});

test('real boosts falling under a gift are refilled by it, with no grace week shown', () => {
  const g = gift(2, null);
  // Organic was Level 2 (8 boosts) and falls to 4: the gift holds Level 2, so no grace is showing...
  const e = effectiveBoostLevel({ level: 2, droppedAt: null }, 4, g, NOW);
  assert.deepEqual([e.level, e.counted, e.platformCount, e.graceEndsAt], [2, 8, 4, null]);
  // ...but the organic grace week still starts underneath (written to the stored row).
  assert.deepEqual([e.organic.level, e.organic.droppedAt, e.organic.changed], [2, NOW, true]);
});

test('members boosting past the target win: the gift adds nothing and the higher level shows', () => {
  const g = gift(1, null);
  const at = effectiveBoostLevel(null, 3, g, NOW);
  assert.deepEqual([at.level, at.platformCount], [1, 0]);
  const over = effectiveBoostLevel({ level: 1, droppedAt: null }, 9, g, NOW);
  assert.deepEqual([over.level, over.counted, over.organicCounted, over.platformCount], [2, 9, 9, 0]);
  const top = effectiveBoostLevel(null, 20, gift(3, null), NOW);
  assert.deepEqual([top.level, top.counted, top.platformCount], [3, 20, 0]);
});

test('an organic grace level above the gift target outranks the gift until the week ends', () => {
  const stored = { level: 3, droppedAt: NOW };
  const mid = effectiveBoostLevel(stored, 9, gift(1, null), NOW + days(3));
  assert.deepEqual([mid.level, mid.countedLevel, mid.platformCount], [3, 2, 0]);
  assert.equal(mid.graceEndsAt, NOW + days(GRACE_DAYS));
  const after = effectiveBoostLevel(stored, 9, gift(1, null), NOW + days(GRACE_DAYS));
  assert.deepEqual([after.level, after.graceEndsAt], [2, null]);
});

test('a gift that has lapsed contributes nothing: the clan is back on its organic level', () => {
  const ends = NOW + days(10);
  const before = effectiveBoostLevel({ level: 0, droppedAt: null }, 4, gift(2, iso(ends)), ends - 1);
  assert.deepEqual([before.level, before.platformCount], [2, 4]);
  const at = effectiveBoostLevel({ level: 1, droppedAt: null }, 4, gift(2, iso(ends)), ends);
  assert.deepEqual([at.level, at.counted, at.platformCount, at.giftTargetLevel, at.graceEndsAt], [1, 4, 0, 0, null]);
  // A lapsed gift on a clan with no boosts at all leaves nothing (the reader then drops the clan).
  const none = effectiveBoostLevel(null, 0, gift(3, iso(ends)), ends + 1);
  assert.deepEqual([none.level, none.counted], [0, 0]);
});

test('a lapsed gift falls back into a running organic grace week, not past it', () => {
  // Organic dropped from 2 to 1 two days ago while the gift held Level 3; the gift ends today.
  const dropped = NOW - days(2);
  const e = effectiveBoostLevel({ level: 2, droppedAt: dropped }, 4, gift(3, iso(NOW)), NOW);
  assert.deepEqual([e.level, e.countedLevel, e.giftTargetLevel], [2, 1, 0]);
  assert.equal(e.graceEndsAt, dropped + days(GRACE_DAYS));
  // Once that week is over too, Level 1.
  const later = effectiveBoostLevel({ level: 2, droppedAt: dropped }, 4, gift(3, iso(NOW)), dropped + days(GRACE_DAYS));
  assert.deepEqual([later.level, later.graceEndsAt], [1, null]);
});

test('indefinite gifts never lapse; a cleared or zero gift is no gift', () => {
  const far = NOW + days(3650 * 3);
  assert.equal(giftTargetLevel(gift(2, null), far), 2);
  assert.equal(giftTargetLevel({ level: 2, expiresAt: undefined }, far), 2);
  assert.equal(giftTargetLevel({ level: 2, expiresAt: '' }, far), 2);
  assert.equal(effectiveBoostLevel(null, 0, gift(2, null), far).level, 2);
  assert.equal(giftTargetLevel(null, NOW), 0);
  assert.equal(giftTargetLevel({ level: null, expiresAt: null }, NOW), 0);
  assert.equal(giftTargetLevel(gift(0, null), NOW), 0);
});

test('gift expiry reads every stored stamp shape, clamps the level, and fails closed on junk', () => {
  assert.equal(giftTargetLevel(gift(2, '2026-11-05 12:00:01'), NOW), 2);
  assert.equal(giftTargetLevel(gift(2, '2026-11-05 12:00:00'), NOW), 0, 'ends exactly now = ended');
  assert.equal(giftTargetLevel(gift(2, '2026-11-06'), NOW), 2);
  assert.equal(giftTargetLevel(gift(2, NOW + 1), NOW), 2);
  assert.equal(giftTargetLevel(gift(2, 'not a date'), NOW), 0);
  assert.equal(giftTargetLevel(gift(7, null), NOW), 3);
});

// ---------------------------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------------------------

test('each level is a superset of the one below, and none touches rank or seats', () => {
  const p0 = boostPerks(0);
  assert.ok(Object.values(p0).every((v) => v === false));
  const p1 = boostPerks(1);
  assert.ok(p1.badge && p1.priority && p1.gradientName && !p1.featured && !p1.animatedBanner);
  const p2 = boostPerks(2);
  assert.ok(p2.featured && p2.animatedBanner && p2.recruitingLine && p2.animatedName && !p2.spotlight && !p2.discordPost);
  const p3 = boostPerks(3);
  assert.ok(Object.values(p3).every((v) => v === true));
  assert.deepEqual(Object.keys(p3).sort(), ['animatedBanner', 'animatedName', 'badge', 'discordPost', 'featured', 'gradientName', 'priority', 'recruitingLine', 'spotlight']);
  assert.equal(boostNameClass(0), '');
  assert.equal(boostNameClass(1), 'boost-name');
  assert.equal(boostNameClass(3), 'boost-name-animated');
});

test('boosted clans sort ahead, higher level first, otherwise the order is kept', () => {
  const list = [{ n: 'a', boostLevel: 0 }, { n: 'b', boostLevel: 2 }, { n: 'c' }, { n: 'd', boostLevel: 1 }, { n: 'e', boostLevel: 2 }];
  assert.deepEqual([...list].sort(byBoostLevel).map((x) => x.n), ['b', 'e', 'd', 'a', 'c']);
});

// ---------------------------------------------------------------------------------------------
// The wall and badges
// ---------------------------------------------------------------------------------------------

const wall = (userId: number, seatId: number, placedAt: number, o: Partial<WallRow> = {}): WallRow => ({
  id: nextId++,
  userId,
  clanId: 10,
  seatId,
  placedAt,
  seatLive: true,
  rsn: `Char${seatId}`,
  levelUp: null,
  ...o,
});

test('the wall lists seats, most boosts then longest, capped like the count', () => {
  const rows = [
    wall(1, 101, NOW - days(40)),
    wall(1, 101, NOW - days(30)),
    wall(1, 101, NOW - days(1)), // a third from person 1: not counted, not shown
    wall(2, 201, NOW - days(100)),
    wall(3, 301, NOW - days(10)),
  ];
  const w = boostersWall(rows, 2, NOW);
  assert.deepEqual(w.map((e) => [e.rsn, e.boosts]), [['Char101', 2], ['Char201', 1], ['Char301', 1]]);
  assert.equal(w[0].since, NOW - days(40));
});

test('one person on two characters shows as two seats, never joined up', () => {
  const rows = [wall(1, 101, NOW - days(5)), wall(1, 102, NOW - days(4))];
  const w = boostersWall(rows, null, NOW);
  assert.equal(w.length, 2);
  assert.deepEqual(w.map((e) => e.rsn).sort(), ['Char101', 'Char102']);
});

test('badges: first booster on their earliest seat, tenure steps, level-up', () => {
  const rows = [
    wall(7, 701, NOW - days(200), { levelUp: 1 }),
    wall(7, 702, NOW - days(10)),
    wall(8, 801, NOW - days(40), { levelUp: 2 }),
  ];
  const w = boostersWall(rows, 7, NOW);
  const by = new Map(w.map((e) => [e.rsn, e.badges]));
  assert.deepEqual(by.get('Char701'), [{ kind: 'first' }, { kind: 'tenure', months: 6 }, { kind: 'levelup', level: 1 }]);
  assert.deepEqual(by.get('Char702'), []);
  assert.deepEqual(by.get('Char801'), [{ kind: 'tenure', months: 1 }, { kind: 'levelup', level: 2 }]);
});

test('tenure steps at 1, 3, 6 and 12 whole months', () => {
  const start = Date.parse('2026-01-15T00:00:00Z');
  assert.equal(tenureBadge(start, Date.parse('2026-02-14T00:00:00Z')), null);
  assert.equal(tenureBadge(start, Date.parse('2026-02-15T00:00:00Z')), 1);
  assert.equal(tenureBadge(start, Date.parse('2026-05-01T00:00:00Z')), 3);
  assert.equal(tenureBadge(start, Date.parse('2026-08-01T00:00:00Z')), 6);
  assert.equal(tenureBadge(start, Date.parse('2027-03-01T00:00:00Z')), 12);
});

// ---------------------------------------------------------------------------------------------
// Clan-written text
// ---------------------------------------------------------------------------------------------

test('the recruiting line is one short line with mentions defused', () => {
  assert.equal(cleanRecruitingLine('  PvM clan,\n all welcome  '), 'PvM clan, all welcome');
  assert.equal(cleanRecruitingLine('@everyone join us'), '@​everyone join us');
  assert.equal(cleanRecruitingLine('hi <@123456789012345678> and <@&42>'), 'hi and');
  assert.equal(cleanRecruitingLine('   '), null);
  assert.equal(cleanRecruitingLine(42), null);
  assert.equal(cleanRecruitingLine('x'.repeat(500))!.length, 140);
});

test('the recruitment post is checked for length and can never ping', () => {
  const ok = cleanRecruitPost('We are recruiting! @here PvM every weekend.\n\n\n\nJoin via the link <@&1234>.');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.ok(!/@here/.test(ok.text.replace('​', '_')) || ok.text.includes('@​here'));
    assert.ok(!ok.text.includes('@here'));
    assert.ok(!ok.text.includes('<@&'));
    assert.ok(!ok.text.includes('\n\n\n'));
  }
  assert.equal(cleanRecruitPost('short').ok, false);
  assert.equal(cleanRecruitPost('x'.repeat(501)).ok, false);
  assert.equal(cleanRecruitPost(null).ok, false);
  assert.equal(cleanRecruitPost('@EVERYONE come and play with us now').ok, true);
  const shout = cleanRecruitPost('@EVERYONE come and play with us now');
  if (shout.ok) assert.ok(!/@everyone/i.test(shout.text));
});

test('one recruitment post per calendar month', () => {
  assert.deepEqual(recruitPostAllowed(null, NOW), { ok: true });
  const early = Date.parse('2026-11-01T00:30:00Z');
  assert.deepEqual(recruitPostAllowed(early, NOW), { ok: false, nextAt: Date.parse('2026-12-01T00:00:00Z') });
  assert.deepEqual(recruitPostAllowed(Date.parse('2026-10-31T23:59:00Z'), NOW), { ok: true });
  assert.equal(nextMonthStart(Date.parse('2026-12-15T00:00:00Z')), Date.parse('2027-01-01T00:00:00Z'));
});

test('a stranger the clan keeps names from gets counts only: no names, no seat ids', () => {
  const rows = [wall(1, 101, NOW - days(40), { rsn: 'SecretMain' }), wall(2, 201, NOW - days(5), { rsn: 'OtherName' })];
  const full = boostersWall(rows, 1, NOW);
  const shown = wallForViewer(full, false);
  assert.equal(shown.length, 2);
  assert.ok(shown.every((e) => e.rsn === null));
  assert.deepEqual(shown.map((e) => e.seatId), [1, 2]);
  const text = JSON.stringify(shown);
  assert.ok(!text.includes('SecretMain') && !text.includes('OtherName') && !text.includes('101') && !text.includes('201'));
  // Counts, dates and badges survive.
  assert.deepEqual(shown.map((e) => e.boosts), full.map((e) => e.boosts));
  assert.deepEqual(shown[0].badges, full[0].badges);
  // Allowed: unchanged.
  assert.equal(wallForViewer(full, true), full);
});

test('the booster gem replaces nothing the post already has, and only on an author line', () => {
  const e = { author: { name: 'Zezima' }, title: 'Drop' };
  assert.deepEqual(withBoosterAuthor(e, 'https://anvilosrs.com'), { author: { name: 'Zezima', icon_url: 'https://anvilosrs.com/icons/booster.png' }, title: 'Drop' });
  const bare = { title: 'x' };
  assert.equal(withBoosterAuthor(bare, 'o'), bare);
  const own = { author: { name: 'Z', icon_url: 'mine.png' } };
  assert.equal(withBoosterAuthor(own, 'o'), own);
});

test('clan-name surface overrides: lenient read, strict check, raw on the ink', () => {
  const style = clanBoostNameStyle(JSON.stringify({ stops: ['#ff9a5a'], dark: { stops: ['#FFFFFF', '#ffe0a0'] }, light: { stops: ['bad'] } }));
  assert.deepEqual(style, { stops: ['#ff9a5a'], dark: { stops: ['#ffffff', '#ffe0a0'] } });
  // Overrides ride along raw; animation still follows the level and the main look.
  assert.deepEqual(clanBoostInk(2, { stops: ['#000000', '#111111'], light: { stops: ['#202020'] } }), {
    color: '#000000',
    grad: ['#000000', '#111111'],
    move: true,
    light: { color: '#202020' },
  });
  assert.equal(clanBoostInk(0, style), null);

  assert.deepEqual(validateClanBoostNameStyle(null), { ok: true, style: null });
  assert.deepEqual(validateClanBoostNameStyle({ stops: [] }), { ok: true, style: null });
  assert.deepEqual(validateClanBoostNameStyle({ stops: ['#ABCDEF'], dark: { stops: ['#000000', '#111111', '#222222', '#333333'] }, light: { stops: [] } }), {
    ok: true,
    style: { stops: ['#abcdef'], dark: { stops: ['#000000', '#111111', '#222222', '#333333'] } },
  });
  assert.equal(validateClanBoostNameStyle({ stops: ['#abcdef'], light: { stops: ['#000000', '#111111', '#222222', '#333333', '#444444'] } }).ok, false);
  assert.equal(validateClanBoostNameStyle({ stops: ['#abcdef'], dark: { stops: ['red'] } }).ok, false);
  assert.equal(validateClanBoostNameStyle({ stops: ['#abcdef'], dark: 'red' }).ok, false);
  assert.equal(validateClanBoostNameStyle({ stops: ['red'] }).ok, false);
});

test('boost candidates collapse to one per clan, the seat picked for the person', () => {
  const ok = { ok: true } as const;
  const seat = (clanId: number, clanName: string, rsn: string, isMain: boolean, heldDaysAgo: number, kind = 'member') => {
    const heldSince = NOW - days(heldDaysAgo);
    return { clanId, clanName, rsn, isMain, heldSince, verdict: seatVerdict({ kind, leftAt: null, heldSince }, NOW) };
  };
  const out = onePerClan([
    seat(1, 'The AFK Spot', 'Denoverse', false, 400),
    seat(1, 'The AFK Spot', 'Drenvox', true, 30),
    seat(1, 'The AFK Spot', 'GIM Drenvox', false, 3),
    seat(2, 'LFL', 'Drenvox', true, 100, 'guest'),
    seat(2, 'LFL', 'Denoverse', false, 100, 'guest'),
    seat(3, 'Alpha', 'Denoverse', false, 400),
    seat(3, 'Alpha', 'GIM Drenvox', false, 20),
    seat(4, 'Newbies', 'Denoverse', false, 2, 'guest'),
    seat(4, 'Newbies', 'GIM Drenvox', false, 10),
    seat(4, 'Newbies', 'Drenvox', true, 5),
  ]);
  assert.deepEqual(
    out.map((c) => [c.clanName, c.rsn]),
    [
      ['Alpha', 'Denoverse'], // no main there: the longest-held member seat
      ['The AFK Spot', 'Drenvox'], // the main, though another seat is older
      ['LFL', 'Denoverse'], // guest only: one row, either seat explains it
      ['Newbies', 'GIM Drenvox'], // not yet: the soonest-boostable member seat, over a guest seat
    ],
  );
  assert.deepEqual(out[0].verdict, ok);
  assert.equal(out[2].verdict.ok, false);
  // Never a main's seat that isn't boostable over an older one that is.
  const notYet = onePerClan([seat(1, 'X', 'Main', true, 3), seat(1, 'X', 'Alt', false, 30)]);
  assert.equal(notYet[0].rsn, 'Alt');
});
