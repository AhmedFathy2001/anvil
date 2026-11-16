// Backdrop art for skill and boss cards (lib/scenes): the game's own art, from our image cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS } from '../src/lib/constants';
import { sceneFor, sceneForMetric, skillScene } from '../src/lib/scenes';

test('every skill has an emblem from our own image cache', () => {
  for (const skill of SKILLS) {
    const scene = skillScene(skill);
    assert.equal(scene?.kind, 'emblem', skill);
    assert.ok(scene!.url.startsWith('/img/wiki/'), skill);
  }
});

test('a skill is found by its key, display name or alias; a boss by name or hiscores key', () => {
  assert.deepEqual(skillScene('runecraft'), skillScene('Runecrafting'));
  assert.equal(skillScene('not a skill'), null);
  assert.equal(sceneFor('boss', 'Zulrah')?.kind, 'figure');
  assert.equal(sceneForMetric('boss', 'zulrah')?.kind, 'figure');
  assert.equal(sceneFor('efficiency', 'EHP'), null);
});
