// The tile creator's matcher (lib/taskMatch) and its pure config helpers (lib/tileCreatorConfig),
// run against a real clan's pasted bingo list. Pure — no database.
//
// Run: npm run test:taskmatch

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAmount,
  browseCatalog,
  classifyMatches,
  matchTasks,
  parseBulkLine,
  parseTaskQuery,
  screenshotCandidate,
  type MatchContext,
} from '../src/lib/taskMatch.ts';
import {
  defaultRaidSelection,
  draftPayload,
  draftToCsvRow,
  itemTileConfig,
  raidModeKey,
  raidTileConfig,
  trialTileConfig,
} from '../src/lib/tileCreatorConfig.ts';
import { COUNTER_TARGETS } from '../src/lib/constants.ts';

const items = [
  { id: 24711, name: 'Hallowed mark' },
  { id: 12012, name: 'Golden nugget' },
  { id: 90001, name: 'Bucket of bloodwood sap' },
  { id: 26813, name: 'Abyssal needle' },
  { id: 26901, name: 'Abyssal protector' },
  { id: 19529, name: 'Zenyte shard' },
];
const ctx: MatchContext = {
  items,
  clogPages: [{ name: 'Guardians of the Rift', items: [{ id: 26813, name: 'Abyssal needle' }, { id: 26901, name: 'Abyssal protector' }] }],
  // Zenyte shards come off a monster's drop table; the rest are rewards / gathered.
  itemIsMonsterDrop: (id) => id === 19529,
};

function best(line: string, c: MatchContext = ctx) {
  const { text } = parseBulkLine(line);
  const cands = matchTasks(text, c);
  return { cands, top: cands[0], verdict: classifyMatches(cands) };
}

test('an amount is read before or after the task, with k/m and thousands', () => {
  assert.equal(parseTaskQuery('150 herbi').amount, 150);
  assert.equal(parseTaskQuery('150 herbi').text, 'herbi');
  assert.equal(parseTaskQuery('zulrah x100').amount, 100);
  assert.equal(parseTaskQuery('5m fishing').amount, 5_000_000);
  assert.equal(parseTaskQuery('1,000 zulrah').amount, 1000);
  // A number that is part of the name is not the amount.
  assert.equal(parseTaskQuery('sepulchre floor 5').amount, null);
  assert.equal(parseTaskQuery('3rd age').amount, null);
});

test('a bulk line carries its points at the end', () => {
  assert.deepEqual(parseBulkLine('150 herbiboars harvested – 20 pts'), { text: '150 herbiboars harvested', points: 20 });
  assert.deepEqual(parseBulkLine('Zenyte shard (15 points)'), { text: 'Zenyte shard', points: 15 });
  assert.deepEqual(parseBulkLine('250 Tithe Farm points'), { text: '250 Tithe Farm points', points: null });
});

test('25 Hunter rumours completed → the Hunter Rumours counter', () => {
  const { top, verdict } = best('25 Hunter rumours completed');
  assert.equal(verdict.status, 'ready');
  assert.equal(top.source, 'counter');
  assert.deepEqual(top.config.targetNpcs, ['Hunter Rumours']);
  assert.equal(top.config.requiredAmount, 25);
  assert.equal(top.engine, 'plugin');
});

test('150 herbiboars harvested (and "150 herbi") → the Herbiboar counter, amount prefilled', () => {
  for (const line of ['150 herbiboars harvested', '150 herbi']) {
    const { top, verdict } = best(line);
    assert.equal(verdict.status, 'ready', line);
    assert.equal(top.config.tileType, 'kill');
    assert.deepEqual(top.config.targetNpcs, ['Herbiboar']);
    assert.equal(top.amount, 150);
  }
});

test('150 Hallowed marks earned in Sepulchre → an item gain tile, not Sepulchre floors', () => {
  const { top, verdict, cands } = best('150 Hallowed marks earned in Sepulchre');
  assert.equal(verdict.status, 'ready');
  assert.equal(top.config.tileType, 'gain');
  assert.deepEqual(top.config.trackedItemIds, [24711]);
  assert.equal(top.config.requiredAmount, 150);
  // The drop reading is still on offer.
  assert.ok(cands.some((c) => c.config.tileType === 'drop' && c.config.trackedItemIds?.[0] === 24711));
});

test('100 golden nuggets at Motherlode Mine → gained golden nuggets', () => {
  const { top, verdict } = best('100 golden nuggets earned at Motherlode Mine');
  assert.equal(verdict.status, 'ready');
  assert.equal(top.config.tileType, 'gain');
  assert.deepEqual(top.config.trackedItemIds, [12012]);
  assert.equal(top.config.requiredAmount, 100);
});

test('200 buckets of bloodwood sap → gained buckets', () => {
  const { top } = best('200 buckets of bloodwood sap');
  assert.equal(top.config.tileType, 'gain');
  assert.equal(top.config.requiredAmount, 200);
});

test('a monster-dropped item reads as a drop first', () => {
  const { top } = best('zenyte shard');
  assert.equal(top.config.tileType, 'drop');
  assert.equal(top.config.requiredAmount, 1);
  assert.equal(top.title, 'Zenyte shard');
});

test('5 CoX/ToB clears, no Entry Mode → one hiscores tile over every non-Entry mode', () => {
  const { top, verdict } = best('5 CoX/ToB clears, no Entry Mode');
  assert.equal(verdict.status, 'ready');
  assert.equal(top.source, 'raid');
  assert.equal(top.config.statType, 'boss');
  assert.deepEqual(
    top.config.trackedStat!.split(',').sort(),
    ['chambersOfXeric', 'chambersOfXericChallengeMode', 'theatreOfBlood', 'theatreOfBloodHardMode'].sort(),
  );
  assert.equal(top.config.statGoal, 5);
  assert.equal(top.engine, 'hiscores');
});

test('"any raid" covers all three raids; a named mode narrows it', () => {
  assert.equal(best('any raid').top.config.trackedStat!.split(',').length, 6);
  assert.equal(best('10 tob hm').top.config.trackedStat, 'theatreOfBloodHardMode');
  assert.equal(best('cox cm').top.config.trackedStat, 'chambersOfXericChallengeMode');
});

test('ticking an Entry mode moves the raid tile to the plugin, with the exact game strings', () => {
  const sel = { ...defaultRaidSelection(['tob']), [raidModeKey('tob', 'entry')]: true };
  const res = raidTileConfig(sel, 3);
  assert.equal(res.source, 'plugin');
  assert.equal(res.entryTicked, true);
  assert.equal(res.config.tileType, 'kill');
  assert.deepEqual(res.config.targetNpcs, ['Theatre of Blood: Entry Mode', 'Theatre of Blood', 'Theatre of Blood: Hard Mode']);
  assert.equal(res.config.requiredAmount, 3);
  // CoX CM has NO colon.
  const cox = raidTileConfig({ [raidModeKey('cox', 'cm')]: true, [raidModeKey('toa', 'entry')]: true }, 1);
  assert.ok(cox.config.targetNpcs!.includes('Chambers of Xeric Challenge Mode'));
});

test('10 Gwenith Glide on Marlin → a timed rank tile needing 10 runs', () => {
  const { top, verdict } = best('10 Gwenith Glide on Marlin');
  assert.equal(verdict.status, 'ready');
  assert.equal(top.source, 'trial');
  assert.equal(top.config.tileType, 'timed');
  assert.equal(top.config.timedActivity, 'Gwenith Glide — Marlin');
  assert.equal(top.config.requiredAmount, 10);
});

test('a course without a rank still needs the trials screen', () => {
  const { top, verdict } = best('gwenith glide');
  assert.equal(top.flow, 'trials');
  assert.equal(verdict.status, 'pick');
});

test('75 Doom delves lights up the delve counter once it exists', () => {
  const withCounter: MatchContext = {
    ...ctx,
    counters: [...COUNTER_TARGETS, { name: 'Doom of Mokhaiotl delves', group: 'Combat', note: '' }],
  };
  const { top, verdict } = best('75 Doom delves', withCounter);
  assert.equal(verdict.status, 'ready');
  assert.deepEqual(top.config.targetNpcs, ['Doom of Mokhaiotl delves']);
  assert.equal(top.config.requiredAmount, 75);
});

test('GOTR rare reward → ask which items (collection-log page offered)', () => {
  const { verdict } = best('GOTR rare reward');
  assert.equal(verdict.status, 'pick');
  assert.ok(verdict.choices.some((c) => c.source === 'clog' && c.config.trackedItemIds?.includes(26901)));
});

test('Slayer tasks from Mortimer and Tithe Farm points fall to a screenshot until counters exist…', () => {
  assert.equal(best('25 Slayer tasks from Mortimer').verdict.status, 'screenshot');
  assert.equal(best('250 Tithe Farm points').verdict.status, 'screenshot');
});

test('…and light up as soon as a matching in-game counter is added', () => {
  const later: MatchContext = {
    ...ctx,
    counters: [
      ...COUNTER_TARGETS,
      { name: 'Slayer tasks (Mortimer)', group: 'Skilling', note: '' },
      { name: 'Tithe Farm points', group: 'Skilling', note: '' },
    ],
  };
  const slayer = best('25 Slayer tasks from Mortimer', later);
  assert.equal(slayer.verdict.status, 'ready');
  assert.deepEqual(slayer.top.config.targetNpcs, ['Slayer tasks (Mortimer)']);
  const tithe = best('250 Tithe Farm points', later);
  assert.equal(tithe.verdict.status, 'ready');
  assert.equal(tithe.top.config.requiredAmount, 250);
});

test('the other kinds are reachable by typing them', () => {
  assert.equal(best('ardougne elite diary').top.config.targetNpcs![0], 'Ardougne Elite');
  assert.equal(best('sub 30 inferno').top.config.timeThresholdSeconds, 1800);
  assert.equal(best('win lms').top.config.tileType, 'lms');
  assert.equal(best('5 pvp kills').top.config.tileType, 'pvp');
  assert.equal(best('deathless toa').top.config.tileType, 'deathless');
  assert.equal(best('master combat tasks').top.config.targetNpcs![0], 'Any Master');
  assert.equal(best('50 ardougne rooftop laps').top.config.targetNpcs![0], 'Ardougne Rooftop');
  assert.equal(best('5m slayer xp').top.config.statGoal, 5_000_000);
  assert.equal(best('100 zulrah').top.config.trackedStat, 'zulrah');
});

test('changing the amount re-titles and rewrites the right field', () => {
  const top = best('150 herbi').top;
  const at = applyAmount(top, 200);
  assert.equal(at.config.requiredAmount, 200);
  assert.match(at.title, /^200 /);
});

test('browse lists are built from the constants alone', () => {
  assert.ok(browseCatalog('xp').some((c) => c.config.trackedStat === 'slayer'));
  assert.ok(browseCatalog('skilling').some((c) => c.config.targetNpcs?.[0] === 'Herbiboar'));
  assert.ok(browseCatalog('courses').some((c) => c.config.tileType === 'lap'));
});

test('a screenshot fallback keeps the words and the amount', () => {
  const s = screenshotCandidate('25 Slayer tasks from Mortimer');
  assert.equal(s.config.tileType, 'standard');
  assert.equal(s.title, '25 Slayer tasks from Mortimer');
});

test('items: one of each is a collection; gain stays a flat pool', () => {
  const two = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
  assert.equal(itemTileConfig({ items: two, how: 'drop', need: 'each', amount: null })!.itemRequirements!.length, 2);
  assert.deepEqual(itemTileConfig({ items: two, how: 'gain', need: 'total', amount: 50 }), {
    tileType: 'gain', trackedItemIds: [1, 2], itemRequirements: null, requiredAmount: 50, sourceNpcs: null,
  });
});

test('a draft becomes the same PUT the full editor sends, every other kind field cleared', () => {
  const p = draftPayload(
    { label: '150 Herbiboar', config: { tileType: 'kill', targetNpcs: ['Herbiboar'], requiredAmount: 150 }, points: 15, trackingMode: 'individual' },
    7,
    '2026-11-01T00:00:00.000Z',
  );
  assert.equal(p.tileType, 'kill');
  assert.equal(p.requiredAmount, 150);
  assert.equal(p.trackedStat, null);
  assert.equal(p.trackedItemIds, null);
  assert.equal(p.trackingMode, 'individual');
  assert.equal(p.points, 15);
  // A drop tile has no team/solo choice in the editor, so it saves as team.
  const drop = draftPayload({ label: 'x', config: { tileType: 'drop', trackedItemIds: [1], requiredAmount: 1 }, points: 1, trackingMode: 'individual' }, 1, null);
  assert.equal(drop.trackingMode, 'team');
});

test('a one-run trial sends no runs-needed; more than one does', () => {
  const one = draftPayload({ label: 't', config: trialTileConfig('gwenith glide', 'marlin', 1)!, points: 1, trackingMode: 'team' }, 1, null);
  assert.equal(one.requiredAmount, null);
  const ten = draftPayload({ label: 't', config: trialTileConfig('gwenith glide', 'marlin', 10)!, points: 1, trackingMode: 'team' }, 1, null);
  assert.equal(ten.requiredAmount, 10);
});

test('a draft becomes an import row the bulk importer understands', () => {
  const row = draftToCsvRow({ label: '150 × Hallowed mark', config: { tileType: 'gain', trackedItemIds: [24711], requiredAmount: 150 }, points: 15, trackingMode: 'team' });
  assert.equal(row.tileType, 'gain');
  assert.equal(row.requiredAmount, 150);
  assert.deepEqual(row.items, [{ name: '', id: 24711, count: 1 }]);
  const raid = draftToCsvRow({ label: '5 raids', config: raidTileConfig(defaultRaidSelection(['cox']), 5).config, points: 30, trackingMode: 'team' });
  assert.equal(raid.statType, 'boss');
  assert.equal(raid.statGoal, 5);
});

test('real catalogue noise: an item named like the counter, or a plural twin, does not make it ambiguous', () => {
  const noisy: MatchContext = {
    ...ctx,
    items: [...items, { id: 1, name: 'Herbiboar' }, { id: 2, name: 'Herbi' }, { id: 3, name: 'Hallowed marks' }],
    clogPages: [...(ctx.clogPages ?? []), { name: 'Motherlode Mine', items: [{ id: 12012, name: 'Golden nugget' }] }],
  };
  assert.equal(best('150 herbiboars harvested', noisy).verdict.status, 'ready');
  assert.equal(best('150 herbi', noisy).top.source, 'counter');
  assert.equal(best('150 Hallowed marks earned in Sepulchre', noisy).verdict.status, 'ready');
  // A clog page is only offered when the task talks about rewards.
  const nuggets = best('100 golden nuggets earned at Motherlode Mine', noisy);
  assert.equal(nuggets.top.config.tileType, 'gain');
  assert.ok(!nuggets.cands.some((c) => c.source === 'clog'));
});
