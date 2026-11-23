// A tracked item counts under every id the game gives it: the sceptre tile that stored 9044 (the old
// sceptre) still counts the 26950 Pyramid Plunder hands out.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { withItemVariants } from '../src/lib/itemVariants.ts';

test('any Pharaoh\'s sceptre counts on a sceptre tile', () => {
  for (const picked of [[9044], [26945], [9044, 26945], [26948]]) {
    const ids = withItemVariants(picked);
    for (const id of [26945, 26948, 26950, 9044]) assert.ok(ids.includes(id), `${picked} → ${id}`);
  }
});

test('the picked ids stay first and are not repeated', () => {
  const ids = withItemVariants([26945, 9044]);
  assert.deepEqual(ids.slice(0, 2), [26945, 9044]);
  assert.equal(new Set(ids).size, ids.length);
});

test('an item with one id is left alone', () => {
  assert.deepEqual(withItemVariants([]), []);
  assert.deepEqual(withItemVariants([12922]).includes(12922), true);
});

test('collection-log slots sharing a name stay separate slots', () => {
  // Decorative armour: fifteen slots, one in-game name.
  assert.deepEqual(withItemVariants([4069]), [4069]);
  assert.ok(!withItemVariants([4070]).includes(4069));
});

test('same-name items monsters drop apart stay apart', () => {
  // "Key": the Mourner's (423) and a zombie rat's (1543) are different quest keys.
  assert.ok(!withItemVariants([423]).includes(1543));
  // Tribal masks: each colour is its own Broodoo victim's.
  assert.ok(!withItemVariants([6335]).includes(6337));
});

test('a cave kraken trident never counts as the Kraken\'s', () => {
  assert.ok(!withItemVariants([11908]).includes(11905));
  assert.ok(!withItemVariants([11905]).includes(11908));
});

test('the editor\'s note: other versions per item, none for a one-id item', async () => {
  const { otherVersions } = await import('../src/lib/itemVariants.ts');
  const v = otherVersions([9044, 12922]);
  assert.ok(v[9044].includes(26950));
  assert.equal(v[12922], undefined);
});
