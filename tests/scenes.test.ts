// Backdrop art for skill and boss cards (lib/scenes): served from our own image cache, by key or by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import skillScenes from '../src/data/skillScenes.json';
import { normalizeWikiFile } from '../src/lib/assetUrls';
import { sceneFor, sceneForMetric, skillScene } from '../src/lib/scenes';

test('every skill scene is a file the image cache will serve at the scene width', () => {
  for (const [skill, file] of Object.entries(skillScenes as Record<string, string>)) {
    assert.ok(normalizeWikiFile(`thumb/${file}/320px-${file}`), `${skill}: ${file}`);
    assert.ok(skillScene(skill)?.url.startsWith('/img/wiki/thumb/'), skill);
  }
});

test('a skill is found by its key or its display name; a boss by name or hiscores key', () => {
  assert.equal(skillScene('Runecrafting')?.fit, 'cover');
  assert.deepEqual(skillScene('runecraft'), skillScene('Runecrafting'));
  assert.equal(skillScene('not a skill'), null);
  assert.equal(sceneFor('boss', 'Zulrah')?.fit, 'contain');
  assert.equal(sceneForMetric('boss', 'zulrah')?.fit, 'contain');
  assert.equal(sceneFor('efficiency', 'EHP'), null);
});
