// Spoons and dry streaks (lib/clogLuck, lib/clogProfile) — the maths a clan will argue about, and
// the two thresholds that decide whether a board entry is a story or noise.
//
// Run: npx tsx --test tests/clog-luck.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assessDry,
  assessSpoon,
  chanceOfNothing,
  chancePerKill,
  expectedDrops,
  formatMultiple,
  formatOdds,
  formatRate,
} from '../src/lib/clogLuck.ts';
import {
  buildClogProfile,
  buildDryBoard,
  buildPageItems,
  buildSpoonBoard,
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

test('chanceOfNothing: the odds of still waiting', () => {
  // At exactly the drop rate, ~37% of people still have nothing. The classic.
  const p = chancePerKill(512);
  const at1x = chanceOfNothing(p, 512);
  assert.ok(at1x > 0.36 && at1x < 0.38, `expected ~0.37, got ${at1x}`);
  // At 3× the rate, under 5% are still waiting.
  assert.ok(chanceOfNothing(p, 512 * 3) < 0.05);
  assert.equal(chanceOfNothing(p, 0), 1, 'nobody is dry at zero kills');
});

test('assessDry: notable starts at twice the rate, not before', () => {
  const p = chancePerKill(500);
  assert.equal(assessDry(p, 40).notable, false, 'forty kills is new, not unlucky');
  assert.equal(assessDry(p, 999).notable, false);
  assert.equal(assessDry(p, 1000).notable, true);
  const bad = assessDry(p, 2500);
  assert.equal(bad.expected, 5);
  assert.ok(bad.luckPercentile < 0.01, 'five times the rate is under 1% of people');
});

test('assessSpoon: notable only well inside the rate', () => {
  const p = chancePerKill(500);
  assert.equal(assessSpoon(p, 300).notable, false, 'a bit early is not a spoon');
  assert.equal(assessSpoon(p, 50).notable, true);
  const legendary = assessSpoon(p, 5);
  assert.ok(legendary.luckPercentile < 0.02);
  assert.equal(assessSpoon(p, 0).notable, false, 'zero KC is missing data, not luck');
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
  assert.equal(formatOdds(0.012), '1 in 83');
  assert.equal(formatOdds(0.9), null, 'an unremarkable percentile gets no line');
  assert.equal(formatOdds(0), null);
});

// ── boards ───────────────────────────────────────────────────────────────────────────────────────

const RATE = { denominator: 500, rolls: 1 };
const member = (id: number, rsn: string, kills: number, owned: boolean, kcAtUnlock: number | null = null): LuckSource =>
  ({ clanMemberId: id, rsn, kills, owned, kcAtUnlock });

test('buildDryBoard: only people who put the kills in, sorted by how remarkable it is', () => {
  const board = buildDryBoard([
    {
      itemId: 1, itemName: 'Pet', source: 'Zulrah', rate: RATE,
      members: [
        member(1, 'Grinder', 3000, false),   // 6× dry — the story
        member(2, 'Dabbler', 1200, false),   // 2.4× dry — notable
        member(3, 'Newbie', 50, false),      // not dry, just new
        member(4, 'Lucky', 5000, true),      // has it; not a dry entry whatever their KC
      ],
    },
  ]);
  assert.deepEqual(board.map((e) => e.rsn), ['Grinder', 'Dabbler']);
  assert.ok(board[0].verdict.luckPercentile < board[1].verdict.luckPercentile);
  assert.equal(board[0].verdict.expected, 6);
});

test('buildDryBoard: a rare item at low KC ranks below a common one at high KC', () => {
  // The reason the sort is on percentile, not kills: 900 kills for a 1-in-100 is the worse beat.
  const board = buildDryBoard([
    { itemId: 1, itemName: 'Common', source: 'A', rate: { denominator: 100, rolls: 1 }, members: [member(1, 'Common-dry', 900, false)] },
    { itemId: 2, itemName: 'Rare', source: 'B', rate: { denominator: 5000, rolls: 1 }, members: [member(2, 'Rare-dry', 11000, false)] },
  ]);
  assert.equal(board[0].rsn, 'Common-dry');
});

test('buildSpoonBoard: only unlocks we watched land', () => {
  const board = buildSpoonBoard([
    {
      itemId: 1, itemName: 'Pet', source: 'Zulrah', rate: RATE,
      members: [
        member(1, 'Spooned', 4000, true, 12),   // twelve KC — the legend
        member(2, 'Normal', 700, true, 480),    // about on rate
        member(3, 'Unknown', 4000, true, null), // owned before we watched: unknowable, not lucky
        member(4, 'Missing', 4000, false, null),
      ],
    },
  ]);
  assert.deepEqual(board.map((e) => e.rsn), ['Spooned']);
  assert.equal(board[0].verdict.kills, 12);
});

test('boards respect their limit', () => {
  const many = Array.from({ length: 40 }, (_, i) => member(i + 1, `M${i}`, 5000, false));
  assert.equal(buildDryBoard([{ itemId: 1, itemName: 'Pet', source: 'Z', rate: RATE, members: many }], 5).length, 5);
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

