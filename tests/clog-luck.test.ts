// Spoons and dry streaks (lib/clogLuck, lib/clogProfile) — the maths a clan will argue about, and
// the two thresholds that decide whether a board entry is a story or noise.
//
// Run: npx tsx --test tests/clog-luck.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assessLuck,
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
  matchBestsToPages,
  type LuckSource,
} from '../src/lib/clogProfile.ts';
import { clogPageItems, clogPageNames } from '../src/lib/clogDataset.ts';

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

const RATE = { denominator: 500, rolls: 1 };
const member = (id: number, rsn: string, kills: number, obtained: number): LuckSource =>
  ({ clanMemberId: id, rsn, kills, obtained });

test('buildLuckBoards: both tails from one pass, and owners can be dry', () => {
  const { dry, spooned } = buildLuckBoards([
    {
      itemId: 1, itemName: 'Pet', source: 'Zulrah', rate: RATE,
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
    { itemId: 1, itemName: 'Small sample', source: 'A', rate: RATE, members: [member(1, 'Ratio-high', 500, 3)] },
    { itemId: 2, itemName: 'Real run', source: 'B', rate: RATE, members: [member(2, 'Truly-lucky', 5_000, 25)] },
  ]);
  assert.equal(spooned[0].rsn, 'Truly-lucky');
});

test('boards respect their limit', () => {
  const many = Array.from({ length: 40 }, (_, i) => member(i + 1, `M${i}`, 5_000, 0));
  assert.equal(buildLuckBoards([{ itemId: 1, itemName: 'Pet', source: 'Z', rate: RATE, members: many }], 5).dry.length, 5);
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

