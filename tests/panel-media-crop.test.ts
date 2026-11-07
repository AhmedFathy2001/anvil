import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop } from '../src/lib/pluginPanelMedia.ts';

test('a 16:9 banner is cropped at its focal point, not with an unsupported smart crop', () => {
  // 960x540 into 220x73: scaled by width to 220x124, so 51px of height to choose from.
  assert.deepEqual(coverCrop(960, 540, 220, 73, 0), { rw: 220, rh: 124, left: 0, top: 0 });
  assert.deepEqual(coverCrop(960, 540, 220, 73, 100), { rw: 220, rh: 124, left: 0, top: 51 });
  assert.equal(coverCrop(960, 540, 220, 73, null).top, 26);
  assert.equal(coverCrop(960, 540, 220, 73, 250).top, 26, 'an out-of-range position centres');
});

test('a tall source is cropped horizontally from the centre, and a square logo needs no crop', () => {
  const tall = coverCrop(500, 1500, 220, 73, 50);
  assert.equal(tall.rw, 220);
  assert.equal(tall.left, 0);
  assert.deepEqual(coverCrop(128, 128, 36, 36, null), { rw: 36, rh: 36, left: 0, top: 0 });
  const wide = coverCrop(3000, 500, 220, 73, 50);
  assert.equal(wide.rh, 73);
  assert.ok(wide.left > 0);
});
