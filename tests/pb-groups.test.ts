import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupPersonalBests, parsePbActivity } from '../src/lib/pbGroups';

test('names split into boss, mode and team size', () => {
  assert.deepEqual(parsePbActivity('Chambers of Xeric Challenge Mode 5 Players'), { base: 'Chambers of Xeric', mode: 'Challenge Mode', team: '5' });
  assert.deepEqual(parsePbActivity('Chambers of Xeric Solo'), { base: 'Chambers of Xeric', mode: '', team: 'Solo' });
  assert.deepEqual(parsePbActivity('Chambers of Xeric 11-15 Players'), { base: 'Chambers of Xeric', mode: '', team: '11-15' });
  assert.deepEqual(parsePbActivity('Tombs of Amascut Expert Mode 7 Players'), { base: 'Tombs of Amascut', mode: 'Expert Mode', team: '7' });
  assert.deepEqual(parsePbActivity('Theatre of Blood: Hard Mode'), { base: 'Theatre of Blood', mode: 'Hard Mode', team: '' });
  assert.deepEqual(parsePbActivity('Duke Sucellus (awakened)'), { base: 'Duke Sucellus', mode: 'Awakened', team: '' });
  assert.deepEqual(parsePbActivity('Vorkath'), { base: 'Vorkath', mode: '', team: '' });
  assert.deepEqual(parsePbActivity('Hueycoatl (3)'), { base: 'Hueycoatl', mode: '', team: '3' });
  assert.deepEqual(parsePbActivity('Royal Titans (1)'), { base: 'Royal Titans', mode: '', team: 'Solo' });
});

test('a raid folds into one group, normal mode first, team sizes in order', () => {
  const groups = groupPersonalBests([
    { activity: 'Chambers of Xeric Challenge Mode 5 Players', time: '36:32.00' },
    { activity: 'Chambers of Xeric 2 Players', time: '20:02.00' },
    { activity: 'Chambers of Xeric Solo', time: '16:43.00' },
    { activity: 'Chambers of Xeric 11-15 Players', time: '1:03:43.00' },
    { activity: 'Chambers of Xeric Challenge Mode Solo', time: '44:19.00' },
    { activity: 'Vorkath', time: '1:10.00' },
  ]);
  assert.deepEqual(groups.map((g) => g.base), ['Chambers of Xeric', 'Vorkath']);
  const cox = groups[0];
  assert.deepEqual(cox.modes.map((m) => m.mode), ['', 'Challenge Mode']);
  assert.deepEqual(cox.modes[0].variants.map((v) => v.team), ['Solo', '2', '11-15']);
  assert.deepEqual(cox.modes[1].variants.map((v) => v.team), ['Solo', '5']);
});
