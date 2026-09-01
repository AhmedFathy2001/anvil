// Spoons and dry streaks (lib/clogLuck, lib/clogProfile) — the maths a clan will argue about, and
// the two thresholds that decide whether a board entry is a story or noise.
//
// Run: npx tsx --test tests/clog-luck.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateLuck,
  assessLuck,
  assessLuckAt,
  bundleSize,
  dropsFromQuantity,
  formatNet,
  chanceOfNothing,
  chancePerKill,
  expectedDrops,
  formatCount,
  formatMultiple,
  formatOdds,
  formatRate,
  poissonAtLeast,
  poissonAtMost,
  TAIL_THRESHOLD,
} from '../src/lib/clogLuck.ts';
import {
  buildClogProfile,
  buildLuckBoards,
  buildPageItems,
  expectationFor,
  formatSources,
  matchBestsToPages,
  titleCaseActivity,
  type LuckRateSource,
  type LuckSource,
} from '../src/lib/clogProfile.ts';
import { clogPageItems, clogPageNames } from '../src/lib/clogDataset.ts';
import { raidSourcesByItem, raidUniqueChances } from '../src/lib/raidLuck.ts';

test('chancePerKill: rolls combine as independent chances, never as a sum', () => {
  assert.equal(chancePerKill(100), 0.01, 'a single roll is exact, not 0.010000000000000009');
  // Three rolls at 1-in-3 is 70%, not 100% — the naive rolls × chance would say certainty.
  const three = chancePerKill(3, 3);
  assert.ok(three > 0.7 && three < 0.71, `expected ~0.704, got ${three}`);
  assert.ok(chancePerKill(2, 2) < 1, 'two rolls at 1-in-2 is not a guarantee');
  assert.equal(chancePerKill(0), 0);
  assert.equal(chancePerKill(-5), 0);
});

test('chanceOfNothing: the odds of still having none', () => {
  const p = chancePerKill(512);
  const at1x = chanceOfNothing(p, 512);
  assert.ok(at1x > 0.36 && at1x < 0.38, `expected ~0.37, got ${at1x}`);
  assert.ok(chanceOfNothing(p, 512 * 3) < 0.05);
  assert.equal(chanceOfNothing(p, 0), 1, 'nobody is dry at zero kills');
});

test('the Poisson tails match their textbook values', () => {
  // Poisson(1): P(X≤0) = e^-1 = 0.3679, P(X≤1) = 2e^-1 = 0.7358.
  assert.ok(Math.abs(poissonAtMost(0, 1) - 0.36788) < 1e-4);
  assert.ok(Math.abs(poissonAtMost(1, 1) - 0.73576) < 1e-4);
  assert.ok(Math.abs(poissonAtLeast(1, 1) - 0.63212) < 1e-4);
  assert.equal(poissonAtMost(5, 0), 1, 'with nothing expected, having none is certain');
  assert.equal(poissonAtLeast(0, 4), 1, 'at least none is always true');
});

test('assessLuck: owning one is still dry when the rate owed fifteen', () => {
  // The case that broke the presence model: an enhanced weapon seed at 30,000 Gauntlet. Having it
  // is not luck — it's about fourteen short.
  const seed = assessLuck(chancePerKill(2000), 30_000, 1);
  assert.equal(seed.expected, 15);
  assert.equal(seed.verdict, 'dry');
  assert.ok(seed.ratio < 0.1);
  assert.ok(seed.tail < 1e-4, 'this is a story, and the tail should say so');
  assert.equal(seed.notable, true);
});

test('assessLuck: near the rate is neither, in either direction', () => {
  const p = chancePerKill(500);
  assert.equal(assessLuck(p, 5_000, 10).verdict, 'on-rate', 'exactly on rate');
  assert.equal(assessLuck(p, 5_000, 14).verdict, 'on-rate', 'a bit ahead is not a spoon');
  assert.equal(assessLuck(p, 5_000, 6).verdict, 'on-rate', 'a bit behind is not a drought');
  // Far enough out either way and it counts.
  assert.equal(assessLuck(p, 5_000, 20).verdict, 'spooned');
  assert.equal(assessLuck(p, 5_000, 2).verdict, 'dry');
});

test('assessLuck: nothing to say about someone who just started', () => {
  const p = chancePerKill(500);
  const fresh = assessLuck(p, 100, 0); // a fifth of one drop expected
  assert.equal(fresh.notable, false, 'zero of 0.2 expected is every new player');
  assert.equal(assessLuck(p, 100, 2).notable, false, 'and two of 0.2 is a coin landing twice');
});

test('assessLuck: a tail sits under the threshold exactly when the verdict is a tail', () => {
  const p = chancePerKill(1000);
  const dry = assessLuck(p, 10_000, 2);
  const spoon = assessLuck(p, 10_000, 19);
  assert.equal(dry.verdict, 'dry');
  assert.equal(spoon.verdict, 'spooned');
  assert.ok(dry.tail < TAIL_THRESHOLD);
  assert.ok(spoon.tail < TAIL_THRESHOLD);
});

test('expectedDrops never goes negative on a nonsense kill count', () => {
  assert.equal(expectedDrops(chancePerKill(100), -50), 0);
});

test('the phrasings a clan actually reads', () => {
  assert.equal(formatRate(512), '1 in 512');
  assert.equal(formatRate(5.5), '1 in 5.5');
  assert.equal(formatRate(0), 'unknown');
  assert.equal(formatMultiple(3.24), '3.2×');
  assert.equal(formatMultiple(11.6), '12×');
  assert.equal(formatMultiple(0), null);
  assert.equal(formatCount(1, 15), '1 of 15 expected');
  assert.equal(formatCount(0, 2.4), '0 of 2.4 expected');
  assert.equal(formatOdds(0.012), '1 in 83');
  assert.equal(formatOdds(0.9), null, 'an unremarkable tail gets no line');
  assert.equal(formatOdds(0), null);
});

// ── boards ───────────────────────────────────────────────────────────────────────────────────────

const RATE: LuckRateSource = { source: 'Zulrah', bossKey: 'zulrah', denominator: 500, rolls: 1, bundle: 1 };
// Expectation is summed by the caller now (an item can come off several bosses), so the fixture does
// what the real path does: one source at 1-in-500.
const member = (id: number, rsn: string, kills: number, obtained: number): LuckSource =>
  ({ clanMemberId: id, rsn, kills, expected: kills / 500, obtained });

test('buildLuckBoards: both tails from one pass, and owners can be dry', () => {
  const { dry, spooned } = buildLuckBoards([
    {
      itemId: 1, itemName: 'Pet', source: 'Zulrah', sources: [RATE],
      members: [
        member(1, 'Grinder', 5_000, 1),   // 1 of 10 — dry, and they OWN one
        member(2, 'Fair', 5_000, 10),     // on rate
        member(3, 'Spooned', 1_000, 8),   // 8 of 2
        member(4, 'Newbie', 50, 0),       // nothing expected yet
      ],
    },
  ]);
  assert.deepEqual(dry.map((e) => e.rsn), ['Grinder']);
  assert.deepEqual(spooned.map((e) => e.rsn), ['Spooned']);
  assert.equal(dry[0].assessment.obtained, 1, 'having one is not the same as being lucky');
});

test('buildLuckBoards: sorted by how unlikely, not by the raw multiple', () => {
  const { spooned } = buildLuckBoards([
    // 3 of 1 expected is a coin flip's worth of luck; 25 of 10 is a story, despite the smaller ratio.
    { itemId: 1, itemName: 'Small sample', source: 'A', sources: [RATE], members: [member(1, 'Ratio-high', 500, 3)] },
    { itemId: 2, itemName: 'Real run', source: 'B', sources: [RATE], members: [member(2, 'Truly-lucky', 5_000, 25)] },
  ]);
  assert.equal(spooned[0].rsn, 'Truly-lucky');
});

test('boards respect their limit', () => {
  const many = Array.from({ length: 40 }, (_, i) => member(i + 1, `M${i}`, 5_000, 0));
  assert.equal(buildLuckBoards([{ itemId: 1, itemName: 'Pet', source: 'Z', sources: [RATE], members: many }], 5).dry.length, 5);
});

// ── profile assembly ─────────────────────────────────────────────────────────────────────────────

test('buildClogProfile: never synced is a different state from owns nothing', () => {
  const never = buildClogProfile({ header: null, items: [] });
  assert.equal(never.synced, null, 'no header means no claim about what they own');
  assert.ok(never.pages.length > 100, 'the catalogue still describes what exists');
  assert.ok(never.pages.every((p) => p.obtained === 0));

  const empty = buildClogProfile({
    header: { obtained: 0, total: 0, pagesSynced: 125, pagesTotal: 125, syncedAt: '2026-08-17T00:00:00Z', pluginVersion: '1.3.0' },
    items: [],
  });
  assert.ok(empty.synced, 'a header means they synced, even owning nothing');
  assert.equal(empty.synced!.obtained, 0);
});

test('buildClogProfile: page counts come from the catalogue, and recent unlocks are dated ones only', () => {
  const page = clogPageNames()[0];
  const [a, b] = clogPageItems(page).slice(0, 2);
  const view = buildClogProfile({
    header: { obtained: 2, total: 2, pagesSynced: 1, pagesTotal: 125, syncedAt: null, pluginVersion: null },
    items: [
      { itemId: a.id, pageName: page, quantity: 1, firstSeenAt: '2026-08-16T10:00:00Z', kcAtUnlock: 40 },
      { itemId: b.id, pageName: page, quantity: 3, firstSeenAt: null, kcAtUnlock: null },
    ],
  });
  const first = view.pages.find((p) => p.name === page)!;
  assert.equal(first.obtained, 2);
  assert.equal(first.total, clogPageItems(page).length);
  assert.equal(first.complete, first.total === 2);
  // The undated one is from a first sync — we don't know when they got it, so it isn't "recent".
  assert.equal(view.recent.length, 1);
  assert.equal(view.recent[0].itemId, a.id);
  assert.equal(view.recent[0].kcAtUnlock, 40);
});

test('buildPageItems: the whole page, flagged by what they own', () => {
  const page = clogPageNames()[0];
  const [a] = clogPageItems(page);
  const grid = buildPageItems(page, [{ itemId: a.id, pageName: page, quantity: 5, firstSeenAt: null, kcAtUnlock: null }]);
  assert.equal(grid.length, clogPageItems(page).length);
  assert.equal(grid[0].owned, true);
  assert.equal(grid[0].quantity, 5);
  assert.ok(grid.slice(1).every((i) => !i.owned && i.quantity === 0));
  assert.ok(grid.every((i) => i.name && !i.name.startsWith('Item ')), 'every slot names itself');
});

// ── personal bests ───────────────────────────────────────────────────────────────────────────────

test('matchBestsToPages: a raid has one page and many times', () => {
  // There is no separate CM page in the collection log — challenge mode, party sizes and the plain
  // raid are all Chambers of Xeric, distinguished by the run rather than by the page.
  const matched = matchBestsToPages(
    [
      { activity: 'chambers of xeric', teamSize: 0, time: '33:38.00' },
      { activity: 'chambers of xeric solo', teamSize: 0, time: '41:20.00' },
      { activity: 'chambers of xeric 3 players', teamSize: 3, time: '22:15.00' },
      { activity: 'chambers of xeric 11-15 players', teamSize: 0, time: '18:40.00' },
    ],
    ['Chambers of Xeric', 'Vorkath'],
  );
  const cox = matched.get('Chambers of Xeric')!;
  assert.equal(cox.length, 4, 'every scale lands on the one page');
  assert.equal(matched.has('Vorkath'), false);
  // The bare key is RuneLite's best across every scale — it leads, and it is NOT the solo time.
  assert.equal(cox[0].label, 'Best overall');
  assert.equal(cox[0].time, '33:38.00');
  assert.equal(cox[1].label, 'Solo', 'a solo raid is stored as the word, not "1 players"');
  assert.equal(cox[1].time, '41:20.00');
  // Ordered by scale, not by clock, and a bucket sits at its lower bound.
  assert.deepEqual(cox.map((b) => b.partySize), [0, 1, 3, 11]);
});

test('matchBestsToPages: a qualifier in front still finds its page', () => {
  // "corrupted gauntlet" doesn't start with "the gauntlet", and its items are on that page anyway.
  const matched = matchBestsToPages(
    [
      { activity: 'gauntlet', teamSize: 0, time: '8:30.00' },
      { activity: 'corrupted gauntlet', teamSize: 0, time: '12:45.00' },
    ],
    ['The Gauntlet'],
  );
  const list = matched.get('The Gauntlet')!;
  assert.equal(list.length, 2);
  assert.ok(list.some((b) => b.label === 'Corrupted'));
  assert.ok(list.some((b) => b.label === 'Best overall'));
});

test('matchBestsToPages: punctuation on either side never blocks a match', () => {
  const matched = matchBestsToPages(
    [{ activity: 'tombs of amascut expert mode', teamSize: 0, time: '30:00.00' }],
    ['Tombs of Amascut'],
  );
  assert.equal(matched.get('Tombs of Amascut')?.[0].label, 'Expert mode');
});

test('matchBestsToPages: an activity with no page is dropped, not guessed at', () => {
  const matched = matchBestsToPages(
    [{ activity: 'ape atoll agility', teamSize: 0, time: '1:16.00' }],
    ['Vorkath', 'Zulrah'],
  );
  assert.equal(matched.size, 0);
});

test("titleCaseActivity: an apostrophe doesn't start a word, and connectors stay small", () => {
  // The bug this exists for: a word boundary sits between the apostrophe and the s.
  assert.equal(titleCaseActivity("phosani's nightmare"), "Phosani's Nightmare");
  assert.equal(titleCaseActivity("shades of mort'ton"), "Shades of Mort'ton");
  // ...and the other half: "Chambers Of Xeric" is not how the game writes it.
  assert.equal(titleCaseActivity('chambers of xeric'), 'Chambers of Xeric');
  assert.equal(titleCaseActivity('temple of the eye'), 'Temple of the Eye');
  // A colon starts a new clause, so the mode after it is named.
  assert.equal(titleCaseActivity('chambers of xeric: challenge mode'), 'Chambers of Xeric: Challenge Mode');
  assert.equal(titleCaseActivity('tombs of amascut: expert mode'), 'Tombs of Amascut: Expert Mode');
  // A leading connector is the name's first word, not a connector.
  assert.equal(titleCaseActivity('the gauntlet'), 'The Gauntlet');
  assert.equal(titleCaseActivity('the corrupted gauntlet'), 'The Corrupted Gauntlet');
  // Hyphens do start words.
  assert.equal(titleCaseActivity("tzhaar-ket-rak's challenges"), "Tzhaar-Ket-Rak's Challenges");
  // Anything already cased is left alone rather than re-cased.
  assert.equal(titleCaseActivity('TzHaar-Ket-Rak'), 'TzHaar-Ket-Rak');
});

// ── bulk drops, several sources, and one person's whole log ──────────────────────────────────────

test('bundleSize: a stack that drops 500-1000 at a time counts as one roll, not 750', () => {
  assert.equal(bundleSize({ q: 1 }), 1, 'the ordinary single drop');
  assert.equal(bundleSize({ m: 500, n: 1000 }), 750, 'a range averages');
  assert.equal(bundleSize({ q: 5 }), 5);
  assert.equal(bundleSize(undefined), 1, 'no quantity information means one');
  assert.equal(bundleSize({ m: 0, n: 0 }), 1, 'a nonsense range falls back rather than dividing by zero');
});

test('dropsFromQuantity: owning any at all proves the table hit at least once', () => {
  assert.equal(dropsFromQuantity(750, 750), 1, 'one dragon thrownaxe drop');
  assert.equal(dropsFromQuantity(1500, 750), 2);
  // The under-average stack is the case that matters: 500 of a 500-1000 drop is still one drop, and
  // rounding it to zero would tell someone who owns the item that they have never had it.
  assert.equal(dropsFromQuantity(500, 750), 1);
  assert.equal(dropsFromQuantity(0, 750), 0, 'owning none is still none');
  assert.equal(dropsFromQuantity(3, 1), 3, 'unstacked drops are unchanged');
});

test('bulk drops no longer read as a spoon: 750 axes is one drop against two expected', () => {
  const chance = chancePerKill(2000, 1);
  const expected = expectedDrops(chance, 4_000);
  const raw = assessLuckAt(expected, 4_000, 750);          // what the old model scored
  const fixed = assessLuckAt(expected, 4_000, dropsFromQuantity(750, 750));
  assert.equal(raw.verdict, 'spooned', 'the raw stack really did look like a 375x spoon');
  assert.equal(fixed.verdict, 'on-rate', 'one drop against two expected is nothing to report');
  assert.equal(fixed.notable, false);
});

test('expectationFor: expectations add across every source, and the bundle follows the odds', () => {
  const sources: LuckRateSource[] = [
    { source: 'Chaos Elemental', bossKey: 'chaosElemental', denominator: 300, rolls: 1, bundle: 1 },
    { source: 'Chaos Fanatic', bossKey: 'chaosFanatic', denominator: 1000, rolls: 1, bundle: 1 },
  ];
  const both = expectationFor(sources, { chaosElemental: 1500, chaosFanatic: 1500 });
  assert.ok(Math.abs(both.expected - 6.5) < 1e-9, `1500/300 + 1500/1000 = 6.5, got ${both.expected}`);
  assert.equal(both.kills, 3000, 'kills are summed for display');

  // Kills at a source the item does not come from must not create expectation.
  assert.equal(expectationFor(sources, { zulrah: 10_000 }).expected, 0);

  // Weighted by where the drops were actually likely to come from, not a flat average.
  const mixed: LuckRateSource[] = [
    { source: 'Common', bossKey: 'a', denominator: 100, rolls: 1, bundle: 10 },
    { source: 'Rare', bossKey: 'b', denominator: 10_000, rolls: 1, bundle: 1000 },
  ];
  const w = expectationFor(mixed, { a: 1000, b: 1000 });
  assert.ok(w.bundle > 10 && w.bundle < 200, `dominated by the common source, got ${w.bundle}`);
});

test('expectationFor: with no kills anywhere it reports nothing rather than a false zero-expectation', () => {
  const sources: LuckRateSource[] = [{ source: 'A', bossKey: 'a', denominator: 500, rolls: 1, bundle: 4 }];
  const none = expectationFor(sources, {});
  assert.equal(none.expected, 0);
  assert.equal(none.bundle, 4, 'the flat bundle still describes the drop, so a count can be read');
});

test('aggregateLuck: a whole log is judged as one Poisson, not an average of ratios', () => {
  // Dead on the rate across the board.
  const fair = aggregateLuck([
    { expected: 5, obtained: 5 },
    { expected: 3, obtained: 3 },
  ]);
  assert.equal(fair.expected, 8);
  assert.equal(fair.obtained, 8);
  assert.equal(fair.verdict, 'on-rate');
  assert.ok(Math.abs(fair.percentile - 50) < 12, `on-rate should sit near the middle, got ${fair.percentile}`);

  // Genuinely dry over a large sample.
  const dry = aggregateLuck([{ expected: 20, obtained: 6 }]);
  assert.equal(dry.verdict, 'dry');
  assert.ok(dry.net < 0 && Math.abs(dry.net - -14) < 1e-9);
  assert.ok(dry.percentile < 5, `deep dry should be a low percentile, got ${dry.percentile}`);

  const lucky = aggregateLuck([{ expected: 5, obtained: 15 }]);
  assert.equal(lucky.verdict, 'spooned');
  assert.ok(lucky.percentile > 95);

  // Content they have never touched must not count as bad luck.
  const untouched = aggregateLuck([{ expected: 0, obtained: 0 }, { expected: 4, obtained: 4 }]);
  assert.equal(untouched.items, 1, 'only the item with an expectation counts');
  assert.equal(untouched.expected, 4);
});

test('aggregateLuck: one big dry item is not cancelled by a small spoon', () => {
  // Averaging ratios would call this fine: 0.1x and 3x average to ~1.5x. Counts say otherwise.
  const total = aggregateLuck([
    { expected: 20, obtained: 2 },
    { expected: 1, obtained: 3 },
  ]);
  assert.equal(total.verdict, 'dry');
  assert.ok(total.net < 0, `still owed drops overall, got ${total.net}`);
});

test('formatNet: says how many drops, in the direction people mean it', () => {
  assert.match(formatNet(-3.2), /owed 3\.2 more/);
  assert.match(formatNet(4.6), /4\.6 ahead/);
  assert.equal(formatNet(0), 'exactly on rate');
});

test('formatSources: never names one rate for an item that has several', () => {
  const one: LuckRateSource[] = [{ source: 'A', bossKey: 'a', denominator: 2000, rolls: 1, bundle: 1 }];
  assert.equal(formatSources(one), '1 in 2,000');
  const many: LuckRateSource[] = [
    ...one,
    { source: 'B', bossKey: 'b', denominator: 10_000, rolls: 1, bundle: 1 },
  ];
  assert.equal(formatSources(many), '1 in 2,000–10,000 across 2 sources');
});

// ── raids ────────────────────────────────────────────────────────────────────────────────────────

test('raidSourcesByItem: the two halves multiply, and the assumption is the overridable one', () => {
  const base = raidSourcesByItem();
  const tbow = [...base.entries()].find(([, s]) => s.some((r) => r.bossKey === 'chambersOfXeric'));
  assert.ok(tbow, 'Chambers of Xeric contributes sources at all');

  // A Twisted bow is 1-in-30 of the unique table; at an assumed 1-in-30 unique chance that is
  // 1-in-900 per raid. Multiplying the two is the whole model.
  const cox = (over?: unknown) => {
    const map = raidSourcesByItem(over);
    for (const sources of map.values()) {
      const hit = sources.find((s) => s.bossKey === 'chambersOfXeric' && Math.abs(s.denominator - 900) < 1);
      if (hit) return hit;
    }
    return null;
  };
  assert.ok(cox(), 'a 1-in-30 share at a 1-in-30 unique chance lands on 1-in-900');

  const halved = raidSourcesByItem({ chambersOfXeric: 15 });
  const found = [...halved.values()].flat().find((s) => s.bossKey === 'chambersOfXeric' && Math.abs(s.denominator - 450) < 1);
  assert.ok(found, 'halving the assumed unique chance halves every rate under it');

  // Every raid rate is flagged, because the UI has to be able to say so.
  assert.ok([...base.values()].flat().every((s) => s.assumed === true));
});

test('raidUniqueChances: a bad override is ignored rather than trusted', () => {
  const defaults = raidUniqueChances();
  assert.equal(raidUniqueChances({ chambersOfXeric: 'banana' }).chambersOfXeric, defaults.chambersOfXeric);
  assert.equal(raidUniqueChances({ chambersOfXeric: -5 }).chambersOfXeric, defaults.chambersOfXeric);
  assert.equal(raidUniqueChances({ chambersOfXeric: 0 }).chambersOfXeric, defaults.chambersOfXeric);
  assert.equal(raidUniqueChances(null).chambersOfXeric, defaults.chambersOfXeric);
  assert.equal(raidUniqueChances({ chambersOfXeric: 15 }).chambersOfXeric, 15, 'a real number is taken');
});

test('raid uniques from several modes add up rather than picking one', () => {
  // A Scythe drops in both normal and hard mode, and someone who runs both is owed both.
  const map = raidSourcesByItem();
  const multiMode = [...map.values()].find(
    (s) => s.some((r) => r.bossKey === 'theatreOfBlood') && s.some((r) => r.bossKey === 'theatreOfBloodHardMode'),
  );
  assert.ok(multiMode, 'the Theatre contributes both its modes as separate sources');
  const e = expectationFor(multiMode!, { theatreOfBlood: 500, theatreOfBloodHardMode: 500 });
  const normalOnly = expectationFor(multiMode!, { theatreOfBlood: 500 });
  assert.ok(e.expected > normalOnly.expected, 'hard-mode completions add expectation, not replace it');
});
