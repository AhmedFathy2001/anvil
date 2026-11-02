// Game-mode event lines (lib/modeLines): which chat line is a relic, an area, a task, or nothing.
// Pure — no database.
//
// Run: npx tsx --test tests/mode-lines.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkPattern,
  classifyLine,
  cleanLine,
  lineTemplate,
  patternFromSample,
  type ModeLinePattern,
} from '../src/lib/modeLines.ts';

const leagues = { key: 'leagues' };
const verdict = (line: string, custom: ModeLinePattern[] = [], mode = leagues) => classifyLine(cleanLine(line)!, mode, custom);

test('lines arrive with the game tags off, and junk is refused', () => {
  assert.equal(cleanLine('<col=ef1020>Congratulations, you have unlocked a new Relic: <col=ffffff>Endless Harvest</col>.'),
    'Congratulations, you have unlocked a new Relic: Endless Harvest.');
  assert.equal(cleanLine('a b\u0007'), 'a b');
  assert.equal(cleanLine('   '), null);
  assert.equal(cleanLine('x'.repeat(201)), null);
  assert.equal(cleanLine(7), null);
});

test('past leagues\' unlocks land on their kinds', () => {
  assert.deepEqual(verdict("Congratulations, you've unlocked a new Relic: Endless Harvest."),
    { kind: 'modeRelic', title: 'Relic unlocked: Endless Harvest', patternId: 'builtin:relic' });
  assert.deepEqual(verdict("Congratulations, you've unlocked a new area: Kandarin."),
    { kind: 'modeArea', title: 'Area unlocked: Kandarin', patternId: 'builtin:area' });
  assert.equal(verdict('You have unlocked the region: Morytania').kind, 'modeArea');
  assert.equal(verdict('You have formed a demonic pact with Nex.').kind, 'modePact');
  assert.equal(verdict('You have unlocked a new combat mastery: Ranged II.').kind, 'modeMastery');
});

test('a task\'s tier picks its switch', () => {
  assert.deepEqual(verdict("Congratulations, you've completed a hard task: Defeat Vorkath."),
    { kind: 'modeTask', title: 'Hard task: Defeat Vorkath', patternId: 'builtin:task' });
  assert.equal(verdict("Congratulations, you've completed an easy task: Open the Leagues Menu.").kind, 'modeTaskMinor');
  assert.equal(verdict("Congratulations, you've completed a medium task: Chop a yew.").kind, 'modeTaskMinor');
  assert.equal(verdict("Congratulations, you've completed a master task: Complete the Inferno!").kind, 'modeTask');
});

test('a new unlock posts as it stands; anything else waits for a pattern', () => {
  assert.deepEqual(verdict('Congratulations! You have earned the Echo of Varlamore.'),
    { kind: 'generic', title: 'Congratulations! You have earned the Echo of Varlamore.' });
  assert.equal(verdict("You've unlocked the Echo boss Amoxliatl.").kind, 'generic');
  assert.equal(verdict('You catch a shrimp.').kind, 'unknown');
  assert.equal(verdict('Your Vorkath kill count is: 12.').kind, 'unknown');
});

test('staff patterns win, can be per mode, and can silence a line', () => {
  const echo: ModeLinePattern = {
    id: 'custom:1', modeKey: 'leagues', kind: 'modeMilestone', regex: String.raw`earned the (?<name>Echo of \w+)`, title: '${name} earned',
  };
  assert.deepEqual(verdict('Congratulations! You have earned the Echo of Varlamore.', [echo]),
    { kind: 'modeMilestone', title: 'Echo of Varlamore earned', patternId: 'custom:1' });
  assert.equal(verdict('Congratulations! You have earned the Echo of Varlamore.', [echo], { key: 'deadman' }).kind, 'generic',
    'a Leagues pattern stays out of Deadman');
  const quiet: ModeLinePattern = { id: 'custom:2', modeKey: null, kind: 'ignore', regex: '^Congratulations! You have earned', title: '' };
  assert.equal(verdict('Congratulations! You have earned the Echo of Varlamore.', [quiet]).kind, 'ignore');
  const relicFix: ModeLinePattern = { id: 'custom:3', modeKey: null, kind: 'modeRelic', regex: String.raw`relic:\s*(?<name>[^.]+)`, title: 'New relic: ${name}' };
  assert.equal((verdict('You have unlocked a new Relic: Fairy Mushroom.', [relicFix]) as { title: string }).title, 'New relic: Fairy Mushroom');
  const broken: ModeLinePattern = { id: 'custom:4', modeKey: null, kind: 'modeRelic', regex: '(', title: 'x' };
  assert.equal(verdict('You catch a shrimp.', [broken]).kind, 'unknown', 'a bad stored regex is skipped, not thrown');
});

test('the queue groups lines by their wording, not their numbers', () => {
  assert.equal(lineTemplate('You have 1,250 league points (12 of 40 tasks).'), 'You have # league points (# of # tasks).');
});

test('pattern checks and the sample-to-pattern starter', () => {
  assert.deepEqual(checkPattern({ kind: 'modeRelic', regex: 'relic', title: 'Relic', modeKey: null }), []);
  assert.ok(checkPattern({ kind: 'nope', regex: 'x', title: 't', modeKey: null }).length);
  assert.ok(checkPattern({ kind: 'modeRelic', regex: '(a+)+', title: 't', modeKey: null }).length);
  assert.ok(checkPattern({ kind: 'modeRelic', regex: '(', title: 't', modeKey: null }).length);
  assert.ok(checkPattern({ kind: 'modeRelic', regex: 'x', title: '', modeKey: null }).length);
  assert.deepEqual(checkPattern({ kind: 'ignore', regex: 'x', title: '', modeKey: null }), []);
  const re = new RegExp(patternFromSample('You have 1,250 points (rank 3).'), 'i');
  assert.ok(re.test('You have 980 points (rank 12).'));
});
