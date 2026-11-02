// The tile creator's matcher (lib/taskMatch) and its pure config helpers (lib/tileCreatorConfig),
// run against a real clan's pasted bingo list. Pure — no database.
//
// Run: npm run test:taskmatch

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAmount,
  killCandidate,
  browseCatalog,
  classifyMatches,
  matchTasks,
  parseBulkLine,
  parseTaskQuery,
  screenshotCandidate,
  type MatchContext,
} from '../src/lib/taskMatch.ts';
import {
  BOSS_FAMILIES,
  RAID_OPTIONS,
  defaultRaidSelection,
  familyFor,
  killPicksConfig,
  draftPayload,
  draftToCsvRow,
  itemTileConfig,
  raidModeKey,
  raidTileConfig,
  trialTileConfig,
} from '../src/lib/tileCreatorConfig.ts';
import { chooseKillSource } from '../src/lib/killSource.ts';

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

test('"any raid" covers every raid (CoX, ToB, ToA, TFA); a named mode narrows it', () => {
  assert.equal(best('any raid').top.config.trackedStat!.split(',').length, 7);
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

test('75 Doom delves lands on the every-delve counter', () => {
  const { top, verdict } = best('75 Doom delves');
  assert.equal(verdict.status, 'ready');
  assert.deepEqual(top.config.targetNpcs, ['Doom of Mokhaiotl delves']);
  assert.equal(top.config.requiredAmount, 75);
});

test('GOTR rare reward → ask which items (collection-log page offered)', () => {
  const { verdict } = best('GOTR rare reward');
  assert.equal(verdict.status, 'pick');
  assert.ok(verdict.choices.some((c) => c.source === 'clog' && c.config.trackedItemIds?.includes(26901)));
});

test('Mortimer slayer tasks and Tithe Farm points land on their in-game counters', () => {
  const slayer = best('25 Slayer tasks from Mortimer');
  assert.equal(slayer.verdict.status, 'ready');
  assert.deepEqual(slayer.top.config.targetNpcs, ['Slayer tasks: Mortimer']);
  assert.equal(slayer.top.config.requiredAmount, 25);
  const tithe = best('250 Tithe Farm points');
  assert.equal(tithe.verdict.status, 'ready');
  assert.deepEqual(tithe.top.config.targetNpcs, ['Tithe Farm points']);
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

// ─── The Fractured Archive in the raid picker ────────────────────────────────────────────────

test('TFA resolves to its hiscores key and sums with the other raids', () => {
  assert.equal(chooseKillSource(['Fractured Archive']).ok && (chooseKillSource(['Fractured Archive']) as { trackedStat: string }).trackedStat, 'fracturedArchive');
  const res = raidTileConfig({ ...defaultRaidSelection(['cox', 'tob']), [raidModeKey('tfa', 'normal')]: true }, 5);
  assert.equal(res.source, 'hiscores');
  assert.deepEqual(res.config.trackedStat!.split(',').sort(), [
    'chambersOfXeric', 'chambersOfXericChallengeMode', 'fracturedArchive', 'theatreOfBlood', 'theatreOfBloodHardMode',
  ].sort());
  assert.ok(RAID_OPTIONS.some((r) => r.id === 'tfa' && r.modes[0].name === 'Fractured Archive'));
});

test('"5 tfa", "5 cox tob or tfa" and "any raid" all go through the raid picker, TFA included', () => {
  const tfa = best('5 tfa').top;
  assert.equal(tfa.source, 'raid');
  assert.equal(tfa.config.trackedStat, 'fracturedArchive');
  assert.equal(tfa.config.statGoal, 5);
  const three = best('5 cox tob or tfa').top;
  assert.equal(three.source, 'raid');
  assert.equal(three.config.trackedStat!.split(',').length, 5);
  assert.ok(best('any raid').top.config.trackedStat!.split(',').includes('fracturedArchive'));
  // TFA is no longer offered as a stray single-boss row next to the raid tile.
  assert.ok(!best('5 tfa').cands.some((c) => c.key === 'boss-fracturedArchive'));
  assert.equal(best('deathless tfa').top.config.timedActivity, 'Fractured Archive');
});

// ─── Several bosses on one tile ──────────────────────────────────────────────────────────────

test('several bosses named in one task become ONE summed hiscores tile', () => {
  const n = best('50 phosani and normal nightmare');
  assert.equal(n.verdict.status, 'ready');
  assert.deepEqual(n.top.config.trackedStat!.split(',').sort(), ['nightmare', 'phosanisNightmare']);
  assert.equal(n.top.config.statGoal, 50);
  assert.match(n.top.title, /Nightmare \(any\)/);
  assert.equal(n.top.engine, 'hiscores');
  // One boss named once stays one boss.
  assert.equal(best('phosanis nightmare').top.config.trackedStat, 'phosanisNightmare');
  assert.equal(best('nightmare').top.config.trackedStat, 'nightmare');
});

test('families: any mode, "or", group names', () => {
  assert.equal(best('nightmare any mode').top.key, 'family-nightmare');
  assert.deepEqual(best('gauntlet or cg').top.config.trackedStat!.split(',').sort(), ['corruptedGauntlet', 'gauntlet']);
  assert.equal(best('dt2 bosses').top.config.trackedStat!.split(',').length, 4);
  assert.equal(best('wildy bosses').top.config.trackedStat!.split(',').length, 10);
  assert.equal(best('25 callisto or artio').top.config.trackedStat, 'callisto,artio');
  assert.equal(best('gwd').top.key, 'family-gwd');
});

test('an awakened DT2 boss forces the plugin, listing every name', () => {
  const duke = best('duke sucellus any').top;
  assert.equal(duke.config.tileType, 'kill');
  assert.deepEqual(duke.config.targetNpcs, ['Duke Sucellus', 'Duke Sucellus (awakened)']);
  assert.equal(duke.engine, 'plugin');
  const res = killPicksConfig(['nightmare', 'Duke Sucellus (awakened)'], 10);
  assert.equal(res.source, 'plugin');
  assert.equal(res.config.requiredAmount, 10);
});

test('adding a boss on the confirm step: summed keys, then plugin targets once one is off the hiscores', () => {
  const two = killCandidate(['callisto', 'artio'], 30)!;
  assert.equal(two.config.trackedStat, 'callisto,artio');
  assert.equal(two.amountField, 'statGoal');
  assert.equal(two.title, '30 Callisto or Artio kills');
  const mixed = killCandidate(['vorkath', 'Chicken'], 30)!;
  assert.equal(mixed.config.tileType, 'kill');
  assert.deepEqual(mixed.config.targetNpcs, ['Vorkath', 'Chicken']);
  assert.equal(mixed.amountField, 'requiredAmount');
  assert.equal(mixed.engine, 'plugin');
  assert.equal(familyFor(['phosanisNightmare', 'nightmare'])?.key, 'nightmare');
});

test('bulk lines with several bosses resolve the same way', () => {
  const { text, points } = parseBulkLine('100 Callisto + Artio kills – 25 pts');
  assert.equal(points, 25);
  const c = classifyMatches(matchTasks(text, ctx));
  assert.equal(c.status, 'ready');
  assert.equal(c.choices[0].config.trackedStat, 'callisto,artio');
  assert.equal(c.choices[0].config.statGoal, 100);
});

test('families are browseable under Bosses & raids', () => {
  const list = browseCatalog('bosses');
  assert.ok(list.some((c) => c.key === 'family-nightmare'));
  assert.ok(list.some((c) => c.key === 'family-dt2'));
  assert.ok(BOSS_FAMILIES.length >= 8);
});
