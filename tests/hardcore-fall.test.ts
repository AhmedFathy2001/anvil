import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FALLEN_COLOR, FALLEN_MODE, fallenEmbed, fallenMoments, fallenSentence, isFallenDeath } from '../src/lib/hardcoreFall';
import { momentTitle } from '../src/lib/pluginUi/feedUi';

test('only deaths survive a Hardcore Worlds push, each marked fallen', () => {
  const out = fallenMoments([
    { kind: 'drop', key: 'a', itemName: 'Abyssal whip' },
    { kind: 'death', key: 'b', source: 'Vorkath' },
    null,
    'junk',
    { kind: 'level', key: 'c' },
  ]);
  assert.deepEqual(out, [{ kind: 'death', key: 'b', source: 'Vorkath', tier: FALLEN_MODE }]);
});

test('a fallen death reads apart from an ordinary one', () => {
  assert.equal(isFallenDeath({ kind: 'death', tier: FALLEN_MODE }), true);
  assert.equal(isFallenDeath({ kind: 'death', tier: null }), false);
  assert.equal(isFallenDeath({ kind: 'ca', tier: FALLEN_MODE }), false);
  assert.equal(fallenSentence('Vorkath'), 'fell on Hardcore Worlds to Vorkath');
  assert.equal(fallenSentence(null), 'fell on Hardcore Worlds');
});

test('the panel feed titles it as fallen', () => {
  const base = { itemName: null, itemId: null, quantity: 1, valueGp: null, sourceKind: null } as const;
  assert.equal(momentTitle({ ...base, kind: 'death', source: 'Vorkath', tier: FALLEN_MODE } as never), 'Fell on Hardcore Worlds to Vorkath');
  assert.equal(momentTitle({ ...base, kind: 'death', source: 'Vorkath', tier: null } as never), 'Died to Vorkath');
});

test('the Discord post keeps the death line and says the character is gone', () => {
  const e = fallenEmbed({ title: '💀 Death', description: 'Drenvox has died to Vorkath.', color: 1, image: { url: 'attachment://x.png' } })!;
  assert.equal(e.title, '🪦 Fallen');
  assert.equal(e.color, FALLEN_COLOR);
  assert.match(String(e.description), /^Drenvox has died to Vorkath\.\n\nTheir Hardcore Worlds character is gone/);
  assert.deepEqual(e.image, { url: 'attachment://x.png' });
  assert.equal(fallenEmbed(null), null);
});
