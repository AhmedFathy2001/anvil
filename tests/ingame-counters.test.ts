// Everything Anvil tracks off an in-game COUNTER rather than the hiscores: agility laps, Hallowed
// Sepulchre floors, and the odds and ends with a count but no hiscores column (Herbiboar, Ket-Rak
// challenges, awakened DT2, Brimhaven tickets, rumours, egg offerings, chest opens).
//
// They share one failure mode, and it is silent: these names are matched VERBATIM against a chat
// line or a loot event, nothing validates them at author time, so a name one word off produces a
// tile that looks configured and counts zero for a whole event. Everything here exists to catch
// that before an event does.
//
// Run: npx tsx --test tests/ingame-counters.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AGILITY_COURSES, SEPULCHRE_TARGETS, COUNTER_TARGETS, BOSSES, canonicalAgilityCourse, lapUnitNoun } from '../src/lib/constants.ts';
import { parseTileGrid } from '../src/lib/csvTiles.ts';
import { analyzeEffort } from '../src/lib/balanceEffort.ts';
import type { Tile } from '../src/lib/types.ts';

// The plugin's parser, transcribed from AnvilPlugin.KILL_COUNT_PATTERN. If this and the Java side
// ever diverge, a lap tile stops crediting — so assert the two agree on every shipped course.
const KILL_COUNT_PATTERN =
  /Your (?:completed |subdued )?(.+?) (?:kill |completion |success |chest |harvest |lap |Total Ticket )?count is: ([\d,]+)/;

test('every shipped course name round-trips through the plugin\'s counter-line parser', () => {
  for (const course of AGILITY_COURSES) {
    const line = `Your ${course.name} lap count is: 1,234.`;
    const m = KILL_COUNT_PATTERN.exec(line);
    assert.ok(m, `no match for ${course.name}`);
    assert.equal(m![1], course.name, `${course.name} parsed as "${m![1]}"`);
    assert.equal(m![2], '1,234');
  }
});

test('near-miss spellings snap onto the verbatim counter name', () => {
  const cases: [string, string][] = [
    ['Ardougne Rooftop Course', 'Ardougne Rooftop'],
    ['ardougne rooftop', 'Ardougne Rooftop'],
    ['Gnome Stronghold', 'Gnome Stronghold Agility'],
    ['gnome stronghold agility course', 'Gnome Stronghold Agility'],
    ['Wilderness', 'Wilderness Agility'],
    ["Seers' Village Rooftop", "Seers' Village Rooftop"],
    ['Seers’ Village Rooftop', "Seers' Village Rooftop"], // curly apostrophe
    ['Prifddinas', 'Prifddinas Agility Course'],
    ['Colossal Wyrm (Advanced)', 'Colossal Wyrm Agility Course (Advanced)'],
    ['  Varrock  Rooftop  ', 'Varrock Rooftop'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(canonicalAgilityCourse(input), expected, `"${input}"`);
  }
});

test('unknown course names pass through untouched (future content stays authorable)', () => {
  assert.equal(canonicalAgilityCourse('Some Future Rooftop'), 'Some Future Rooftop');
  assert.equal(canonicalAgilityCourse('  '), '');
});

test('CSV import canonicalises lap course cells but leaves kill targets alone', () => {
  const header = ['label', 'type', 'requiredAmount', 'targetNpcs'];
  const { rows } = parseTileGrid([
    header,
    ['100 laps', 'lap', '100', 'ardougne rooftop|Gnome Stronghold'],
    ['Kill cows', 'kill', '50', 'Cow|cow calf'],
  ]);
  assert.deepEqual(rows[0].targetNpcs, ['Ardougne Rooftop', 'Gnome Stronghold Agility']);
  assert.deepEqual(rows[1].targetNpcs, ['Cow', 'cow calf'], 'kill targets stay verbatim');
});

// ---- Effort model -------------------------------------------------------------------
// The board-balance auditor prices a lap tile off the curated per-course lap times. These pin the
// wiring: curated rate found, multi-course tiles priced off the cheapest, unknown course falling
// back to the generic rate loudly rather than silently reading as unmodelled.

const lapTile = (over: Partial<Tile>) => ({
  id: 1, eventId: 1, position: 0, label: '100 laps', description: null, tileType: 'lap',
  requiredAmount: 100, points: 20, optional: 0, targetNpcs: JSON.stringify(['Ardougne Rooftop']),
  ...over,
} as unknown as Tile);

test('curated lap rate resolves', () => {
  const r = analyzeEffort([lapTile({})], { pointsMode: true });
  assert.ok(r.perTile[0].hours);
  assert.equal(r.perTile[0].note, null);
  assert.equal(r.perTile[0].floor, 'high');
  assert.ok(Math.abs(r.perTile[0].hours![1] - (100 * 52) / 3600) < 1e-9);
});

test('multi-course tile prices the fastest listed course', () => {
  const r = analyzeEffort([lapTile({ targetNpcs: JSON.stringify(['Ardougne Rooftop', "Seers' Village Rooftop"]) })], { pointsMode: true });
  assert.ok(Math.abs(r.perTile[0].hours![1] - (100 * 46) / 3600) < 1e-9, 'should use Seers 46s, got ' + r.perTile[0].hours![1]);
});

test('unknown course falls back to the generic lap time, and says so', () => {
  const r = analyzeEffort([lapTile({ targetNpcs: JSON.stringify(['Some Future Rooftop']) })], { pointsMode: true });
  assert.equal(r.perTile[0].note, 'generic agility lap time used');
  assert.ok(Math.abs(r.perTile[0].hours![1] - (100 * 58) / 3600) < 1e-9);
});

// ---- Hallowed Sepulchre -------------------------------------------------------------
// The Sepulchre rides the same tile kind but its OWN chat lines, parsed plugin-side into these
// synthesized names. These are ours, not game strings, so the only contract that matters is that
// the two sides agree — which is what the plugin's SepulchreLineTest pins from the other end.

test('a Sepulchre tile counts floors, a course tile counts laps', () => {
  assert.equal(lapUnitNoun(['Ardougne Rooftop']), 'lap');
  assert.equal(lapUnitNoun(['Hallowed Sepulchre']), 'floor');
  assert.equal(lapUnitNoun(['Hallowed Sepulchre Floor 5']), 'floor');
  assert.equal(lapUnitNoun(['Hallowed Sepulchre', 'Hallowed Sepulchre Floor 5']), 'floor');
  assert.equal(lapUnitNoun(['Grand Hallowed Coffin']), 'run');
  // Mixed tiles can't honestly say "laps" or "floors", so they fall back to the neutral noun.
  assert.equal(lapUnitNoun(['Ardougne Rooftop', 'Hallowed Sepulchre']), 'run');
  assert.equal(lapUnitNoun([]), 'lap');
});

test('Sepulchre names canonicalise from the obvious shorthands', () => {
  const cases: [string, string][] = [
    ['floor 5', 'Hallowed Sepulchre Floor 5'],
    ['Floor 3', 'Hallowed Sepulchre Floor 3'],
    ['sepulchre floor 1', 'Hallowed Sepulchre Floor 1'],
    ['hallowed sepulchre floor 2', 'Hallowed Sepulchre Floor 2'],
    ['Hallowed Sepulchre Floor 4', 'Hallowed Sepulchre Floor 4'],
    ['sepulchre', 'Hallowed Sepulchre'],
    ['The Hallowed Sepulchre', 'Hallowed Sepulchre'],
    ['grand hallowed coffin', 'Grand Hallowed Coffin'],
    ['hallowed coffin', 'Grand Hallowed Coffin'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(canonicalAgilityCourse(input), expected, `"${input}"`);
  }
});

test('there is no floor 6, and a bare number is not a floor', () => {
  assert.equal(canonicalAgilityCourse('floor 6'), 'floor 6');
  assert.equal(canonicalAgilityCourse('5'), '5');
});

test('every Sepulchre target has a curated effort rate', () => {
  for (const target of SEPULCHRE_TARGETS) {
    const r = analyzeEffort([lapTile({ targetNpcs: JSON.stringify([target.name]) })], { pointsMode: true });
    assert.equal(r.perTile[0].note, null, `${target.name} fell back to the generic rate`);
  }
});

// ---- Non-hiscores counters ----------------------------------------------------------
// Activities with an in-game count but no hiscores column, so they can only ever be kill tiles.
// Each entry is a string the PLUGIN must credit, and nothing in the UI validates them — a typo
// here is a chip that authors a tile which silently counts zero. These pin the two failure modes
// that are actually reachable: a name the counter-line parser mangles, and drift against BOSSES.

test('counter targets parsed from a "count is:" line survive intact', () => {
  // The chat-line group: everything except the ones the plugin credits off its own pattern or
  // off the loot event, which never travel through this parser.
  const ownLine = new Set(['Hunter Rumours', "Bird's egg offerings"]);
  const chests = new Set(COUNTER_TARGETS.filter((t) => t.group === 'Chests').map((t) => t.name));
  for (const t of COUNTER_TARGETS) {
    if (ownLine.has(t.name) || chests.has(t.name)) continue;
    // Brimhaven is the one whose counter word isn't "kill" — assert its real line, not a synthetic one.
    const line = t.name === 'Agility Arena'
      ? 'Your Agility Arena Total Ticket count is: 480.'
      : `Your ${t.name} kill count is: 42.`;
    const m = KILL_COUNT_PATTERN.exec(line);
    assert.ok(m, `no match for ${t.name}`);
    assert.equal(m![1].trim(), t.name, `${t.name} parsed as "${m![1]}"`);
  }
});

test('counter targets never duplicate a hiscores boss', () => {
  // A name in both lists is a trap: the admin gets two ways to author the same thing, one of which
  // (the stat tile) is hiscores-polled and the other plugin-counted, and they disagree.
  const bossNames = new Set(BOSSES.map((b) => b.label.toLowerCase()));
  for (const t of COUNTER_TARGETS) {
    assert.ok(!bossNames.has(t.name.toLowerCase()), `${t.name} is already a hiscores boss`);
  }
});

test('counter target names are unique', () => {
  const seen = new Set<string>();
  for (const t of COUNTER_TARGETS) {
    assert.ok(!seen.has(t.name), `duplicate counter target: ${t.name}`);
    seen.add(t.name);
  }
});

test('Shellbane Gryphon is a hiscores boss, not a plugin counter', () => {
  const gryphon = BOSSES.find((b) => b.key === 'shellbaneGryphon');
  assert.ok(gryphon, 'shellbaneGryphon missing from BOSSES');
  assert.equal(gryphon!.label, 'Shellbane Gryphon');
});
