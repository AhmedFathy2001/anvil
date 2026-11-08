// Every lab tile (lib/labPlan LAB_TILE_SET) is finished by a bundled lab scenario: each scenario's
// game lines are read with the site's own chat patterns (src/data/chatPatterns.json, the same file
// the plugin parses with), turned into the fact the plugin posts to /api/plugin/facts, and run
// through the site's matcher (lib/pluginFacts/match) against the lab tile, which must be credited.
//
// The scenario lines are the bundled ones from PR #422 (src/data/labScenarioTemplates.json on
// feat/lab-scenarios), with their default params unless the table in labPlan says otherwise.
//
// The tracked lists are built from the lab tiles the way the config builder does
// (lib/pluginConfigEnrolled): kill + lap tiles → trackedKills, drop → trackedDrops, value →
// trackedValues, and the tiles the plugin judges itself (timed, PvP, diary, CA, clog) → their lists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LAB_TILE_SET } from '../src/lib/labPlan.ts';
import { matchFacts, type Fact, type Tracked } from '../src/lib/pluginFacts/match.ts';

const patterns = (() => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/chatPatterns.json', import.meta.url), 'utf8'));
  const list: { key: string; regex: string }[] = Array.isArray(raw) ? raw : raw.patterns;
  return new Map(list.map((p) => [p.key, new RegExp(p.regex)]));
})();

function read(key: string, line: string): Record<string, string> {
  const re = patterns.get(key);
  assert.ok(re, `pattern ${key}`);
  const m = re.exec(line);
  assert.ok(m?.groups, `${key} reads "${line}"`);
  return m.groups;
}

const arr = (s: string | null) => (s ? (JSON.parse(s) as (string | number)[]) : []);

function tracked(): { t: Tracked; idOf: (label: string) => number } {
  const t: Tracked = { trackedKills: [], trackedDrops: [], trackedValues: [], trackedTimed: [], trackedPvp: [], trackedDiaries: [], trackedCombatTasks: [], trackedClog: [] };
  const ids = new Map<string, number>();
  LAB_TILE_SET.forEach((s, i) => {
    const tileId = 1000 + i;
    ids.set(s.label, tileId);
    const base = { tileId, label: s.label };
    if (s.tileType === 'kill' || s.tileType === 'lap') t.trackedKills!.push({ ...base, requiredAmount: s.requiredAmount, currentAmount: 0, targetNpcs: arr(s.targetNpcs) as string[], coopCredit: s.coopCredit });
    else if (s.tileType === 'drop') t.trackedDrops!.push({ ...base, requiredAmount: s.requiredAmount, currentAmount: 0, itemIds: arr(s.trackedItemIds) as number[], sourceNpcs: arr(s.sourceNpcs) as string[] });
    else if (s.tileType === 'value') t.trackedValues!.push({ ...base, thresholdGp: s.requiredAmount, sources: arr(s.targetNpcs) as string[] });
    else if (s.tileType === 'timed') t.trackedTimed!.push({ ...base, activity: s.timedActivity, thresholdSeconds: s.timeThresholdSeconds, requiredAmount: 1 });
    else if (s.tileType === 'pvp') t.trackedPvp!.push({ ...base, requiredAmount: s.requiredAmount });
    else if (s.tileType === 'diary') t.trackedDiaries!.push({ ...base, requiredAmount: s.requiredAmount });
    else if (s.tileType === 'ca') t.trackedCombatTasks!.push({ ...base, requiredAmount: s.requiredAmount });
    else if (s.tileType === 'clog') t.trackedClog!.push({ ...base, requiredAmount: s.requiredAmount });
    else assert.fail(`no tracked list for ${s.tileType}`);
  });
  return { t, idOf: (label) => ids.get(label)! };
}

const spec = (label: string) => LAB_TILE_SET.find((s) => s.label === label)!;

/** A "Your <X> count is" line, read by kc.count, as the kill fact the plugin posts. */
function kcFact(line: string): Fact {
  const g = read('kc.count', line);
  return { k: 'kill', n: { [g.name]: 1 } };
}

function credits(label: string, facts: Fact[], times = 1): number {
  const { t, idOf } = tracked();
  let total = 0;
  for (let i = 0; i < times; i++) total += matchFacts(facts, t).credits.filter((c) => c.tileId === idOf(label)).reduce((n, c) => n + c.amount, 0);
  return total;
}

// [tile, scenario command, facts the scenario produces, how many runs the tile needs]
const CASES: [string, string, () => Fact[], number][] = [
  ['Wintertodt crate', '::anvil run wintertodt-game', () => [kcFact('Your subdued Wintertodt count is: 200.')], 1],
  ['2 Araxxor kills', '::anvil run boss-kc', () => [kcFact('Your Araxxor kill count is: 10.')], 2],
  ['Tanzanite fang', '::anvil run zulrah-unique', () => [{ k: 'loot', src: 'Zulrah', kind: 'npc', items: [[12922, 1], [12934, 500]] }], 1],
  // The plugin prices the haul itself; a Bandos chestplate (11832) plus 250k is far past 1m. A loot key counts as PvP loot.
  ['1m+ loot haul', '::anvil run loot-key', () => [{ k: 'value', src: 'Loot Chest', kind: 'pvp', gp: 15_000_000 }], 1],
  ["2 Seers' rooftop laps", '::anvil run agility-lap', () => [kcFact("Your Seers' Village Rooftop lap count is: 1234.")], 2],
  ['Tombs of Amascut', '::anvil run toa-raid', () => [kcFact('Your completed Tombs of Amascut: Expert Mode count is: 8.')], 1],
  // The casket's loot, under its folded source name ("Clue Scroll (Hard)", AnvilPlugin.normalizeClueSource).
  ['Robin Hood hat (hard clue)', '::anvil run clue-casket', () => [{ k: 'loot', src: 'Clue Scroll (Hard)', kind: 'event', items: [[2581, 1]] }], 1],
  // SLAYER_TASKS_COMPLETED +1 moves these game counters (lib/gameCounters); they're flagged unverified, and still credit.
  ['Slayer task', '::anvil run slayer-task', () => [{ k: 'kill', n: { 'Slayer tasks: any master': 1, 'Slayer tasks: other masters': 1 }, unv: ['Slayer tasks: any master', 'Slayer tasks: other masters'] }], 1],
  ['2 Vorkath kills', '::anvil run boss-kc boss=Vorkath', () => [kcFact('Your Vorkath kill count is: 10.')], 2],
  ['Theatre of Blood', '::anvil run tob-raid', () => [kcFact('Your completed Theatre of Blood count is: 5.')], 1],
  ['Hallowed Sepulchre run', '::anvil run sepulchre-run', () => {
    assert.ok(patterns.get('sepulchre.coffin')!.test('You have opened the Grand Hallowed Coffin 42 times!'));
    return [{ k: 'kill', n: { 'Grand Hallowed Coffin': 1 } }];
  }, 1],
  ['2 Zulrah kills', '::anvil run zulrah-unique', () => [kcFact('Your Zulrah kill count is: 500.')], 2],
  ['Chambers of Xeric', '::anvil run cox-raid', () => [kcFact('Your completed Chambers of Xeric count is: 125.')], 1],
];

for (const [label, command, facts, runs] of CASES) {
  test(`${label} ← ${command}`, () => {
    assert.ok(spec(label), `lab tile "${label}"`);
    const need = spec(label).tileType === 'value' ? 1 : spec(label).requiredAmount;
    assert.equal(runs, need, `${label} takes ${need} run(s)`);
    assert.ok(credits(label, facts(), runs) >= (spec(label).tileType === 'value' ? 1 : need), `${command} credits ${label}`);
  });
}

// The tiles the plugin judges itself: the scenario's wording must be the tile's selector (that's what
// the plugin compares), and the tile fact it then posts must be credited by the site.
test('Vorkath under 2:00 ← ::anvil run boss-pb', () => {
  const s = spec('Vorkath under 2:00');
  assert.equal(s.timedActivity, 'Vorkath');
  const sec = 1 * 60 + 36; // "Fight duration: 1:36"
  assert.ok(sec <= s.timeThresholdSeconds!);
  const { t, idOf } = tracked();
  assert.equal(matchFacts([{ k: 'tile', t: idOf(s.label), n: 1, sec }], t).credits.length, 1);
});

test('PK Some Pker ← ::anvil run pvp-kill', () => {
  const s = spec('PK Some Pker');
  assert.deepEqual(arr(s.targetNpcs), ['Some Pker']);
  const { t, idOf } = tracked();
  assert.equal(matchFacts([{ k: 'tile', t: idOf(s.label), n: 1, what: 'Some Pker' }], t).credits.length, 1);
});

test('Hard Ardougne diary ← ::anvil run diary-tier', () => {
  const g = read('diary.complete', 'Congratulations! You have completed all of the hard tasks in the Ardougne area. Speak to the diary NPC to claim your reward.');
  const selector = `${g.area} ${g.tier.charAt(0).toUpperCase()}${g.tier.slice(1)}`;
  assert.deepEqual(arr(spec('Hard Ardougne diary').targetNpcs), [selector]);
  const { t, idOf } = tracked();
  assert.equal(matchFacts([{ k: 'tile', t: idOf('Hard Ardougne diary'), n: 1, what: selector }], t).credits.length, 1);
});

test('Whack-a-Mole (Elite CA) ← ::anvil run ca-task', () => {
  const g = read('ca.task', "Congratulations, you've completed an Elite combat task: Whack-a-Mole.");
  assert.deepEqual(arr(spec('Whack-a-Mole (Elite CA)').targetNpcs), [g.task]);
  const { t, idOf } = tracked();
  assert.equal(matchFacts([{ k: 'tile', t: idOf('Whack-a-Mole (Elite CA)'), n: 1, what: g.task, tier: g.tier }], t).credits.length, 1);
});

test('Fighter torso slot ← ::anvil run clog-unlock', () => {
  const g = read('clog.unlock', 'New item added to your collection log: Fighter torso');
  assert.equal(g.item, 'Fighter torso');
  assert.deepEqual(arr(spec('Fighter torso slot').trackedItemIds), [10551]); // Fighter torso's item id
  const { t, idOf } = tracked();
  assert.equal(matchFacts([{ k: 'tile', t: idOf('Fighter torso slot'), n: 1, what: g.item, item: 10551 }], t).credits.length, 1);
});

// A casket open is counted under "Clue Scroll (<Tier>)" (AnvilPlugin.normalizeClueSource). The kill
// index keeps a clue target's tier, so a tier-named kill tile (the starter library's "Clue Scroll
// (beginner)", a "Clue Scroll (Hard)" tile) is credited by that tier's open, and only by it.
const clueTile = (target: string): Tracked => ({ trackedKills: [{ tileId: 1, label: 'Clue casket', requiredAmount: 3, currentAmount: 0, targetNpcs: [target] }] });

test('a tier-named clue kill tile is credited by the casket open', () => {
  assert.equal(matchFacts([{ k: 'kill', n: { 'Clue Scroll (Hard)': 1 } }], clueTile('Clue Scroll (Hard)')).credits.length, 1);
});

for (const tier of ['Beginner', 'Easy', 'Medium', 'Hard', 'Elite', 'Master']) {
  test(`a ${tier.toLowerCase()} clue kill tile is credited by a ${tier.toLowerCase()} casket open, whatever the target's spelling`, () => {
    for (const target of [`Clue Scroll (${tier})`, `Clue scroll (${tier.toLowerCase()})`, `Reward casket (${tier.toLowerCase()})`]) {
      const credits = matchFacts([{ k: 'kill', n: { [`Clue Scroll (${tier})`]: 1 } }], clueTile(target)).credits;
      assert.equal(credits.length, 1, target);
      assert.equal(credits[0].amount, 1);
    }
  });
}

test('a clue kill tile is not credited by a different tier', () => {
  for (const other of ['Beginner', 'Easy', 'Medium', 'Elite', 'Master']) {
    assert.equal(matchFacts([{ k: 'kill', n: { [`Clue Scroll (${other})`]: 1 } }], clueTile('Clue Scroll (Hard)')).credits.length, 0, other);
  }
  // Nor by a tierless name the bare target would have reached.
  assert.equal(matchFacts([{ k: 'kill', n: { 'Clue Scroll': 1 } }], clueTile('Clue Scroll (Hard)')).credits.length, 0);
});

test("the starter library's beginner clue kill tile is credited by a beginner casket open", () => {
  const seed = JSON.parse(readFileSync(new URL('../src/data/tileLibrarySeed.json', import.meta.url), 'utf8'));
  const found = JSON.stringify(seed).match(/"targetNpcs":\["(Clue Scroll \(beginner\))"\]/);
  assert.ok(found, 'starter tile troll-clue-beginner targets "Clue Scroll (beginner)"');
  assert.equal(matchFacts([{ k: 'kill', n: { 'Clue Scroll (Beginner)': 1 } }], clueTile(found[1])).credits.length, 1);
});

test('every lab tile has a scenario', () => {
  const covered = new Set([...CASES.map((c) => c[0]), 'Vorkath under 2:00', 'PK Some Pker', 'Hard Ardougne diary', 'Whack-a-Mole (Elite CA)', 'Fighter torso slot']);
  assert.deepEqual(LAB_TILE_SET.map((s) => s.label).filter((l) => !covered.has(l)), []);
});
