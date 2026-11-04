// A space's own colours (lib/artPalette): picking swatches out of pixels, and the contrast rules that
// make any picked colour safe on Anvil's dark pages. Pure — no database, no image decoder.
//
// Run: npx tsx --test tests/art-palette.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_BG,
  MIN_TEXT_CONTRAST,
  DARK_INK,
  LIGHT_INK,
  accentTokens,
  contrast,
  inkOn,
  isHexColor,
  mergePalettes,
  normalizeHex,
  paletteFromPixels,
  paletteSource,
  readStoredPalette,
  readableOn,
} from '../src/lib/artPalette.ts';

/** An RGBA image: `parts` of [r, g, b, count] (alpha 255), or a: 0 for transparent padding. */
function image(parts: [number, number, number, number, number?][]): Uint8Array {
  const out: number[] = [];
  for (const [r, g, b, n, a = 255] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return Uint8Array.from(out);
}

test('hex colours are normalised, and anything that is not one is refused', () => {
  assert.equal(normalizeHex('#A78BFA'), '#a78bfa');
  assert.equal(normalizeHex('a78bfa'), '#a78bfa');
  assert.equal(normalizeHex('#abc'), '#aabbcc');
  for (const bad of ['', 'red', '#12345', '#1234567', 'url(x)', '#zzzzzz', null, 7, '#a78bfa;}body{']) {
    assert.equal(normalizeHex(bad), null, String(bad));
  }
  assert.equal(isHexColor('#a78bfa'), true);
  assert.equal(isHexColor('#a78bf'), false);
});

test('a vivid mark beats a bigger grey background, and transparency is ignored', () => {
  const px = image([
    [60, 60, 60, 600], // grey background
    [167, 139, 250, 120], // violet logo mark
    [255, 0, 0, 900, 0], // fully transparent padding
  ]);
  const p = paletteFromPixels(px, 4);
  assert.equal(p[0].slice(0, 3), '#a7'.slice(0, 3), `violet first, got ${p.join(',')}`);
  assert.ok(!p.some((h) => h.startsWith('#ff0')), 'transparent red never appears');
});

test('near-identical colours collapse into one swatch; distinct ones are kept', () => {
  const px = image([
    [200, 40, 40, 100],
    [205, 45, 42, 100],
    [40, 90, 220, 100],
    [240, 190, 60, 100],
  ]);
  const p = paletteFromPixels(px, 4);
  assert.equal(p.length, 3, p.join(','));
});

test('black and white only appear after the real colours', () => {
  const px = image([
    [5, 5, 5, 2000],
    [250, 250, 250, 2000],
    [60, 200, 120, 50],
  ]);
  const p = paletteFromPixels(px, 4);
  assert.match(p[0], /^#3[0-9a-f]c/, `green first, got ${p.join(',')}`);
});

test('the logo leads the merged palette and the banner fills in without repeats', () => {
  const merged = mergePalettes(['#a78bfa', '#140f1f'], ['#a98dfb', '#e86a9a', '#f6c35b']);
  assert.deepEqual(merged, ['#a78bfa', '#140f1f', '#e86a9a', '#f6c35b'], 'alternating by rank, the banner violet dropped as a repeat');
  assert.equal(mergePalettes(['#111111', '#222222', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff'], []).length, 6);
});

test('any accent becomes readable text on the page, and buttons get the better ink', () => {
  for (const hex of ['#140f1f', '#2b1d4d', '#5b3fa0', '#a78bfa', '#ffd35c', '#ffffff', '#ff0000']) {
    const t = accentTokens(hex);
    assert.ok(contrast(t.text, PAGE_BG) >= MIN_TEXT_CONTRAST, `${hex} → ${t.text}`);
    assert.ok(contrast(t.accent, t.ink) >= 3, `${hex} button ink ${t.ink}`);
  }
  assert.equal(readableOn('#a78bfa'), '#a78bfa', 'already readable: unchanged');
  assert.equal(accentTokens('#a78bfa').adjusted, false);
  assert.equal(accentTokens('#2b1d4d').adjusted, true);
  assert.equal(inkOn('#ffd35c'), DARK_INK);
  assert.equal(inkOn('#2b1d4d'), LIGHT_INK);
});

test('a junk accent falls back to Anvil gold rather than reaching CSS', () => {
  assert.equal(accentTokens('red;}body{').accent, '#e0aa1e');
});

test('a stored palette is checked on the way out, and its source tracks both images', () => {
  assert.equal(paletteSource('https://m/x.png', null), 'https://m/x.png|');
  assert.deepEqual(readStoredPalette({ from: 'a|b', colors: ['#a78bfa', 'javascript:x', '#FFF', 4] }), { from: 'a|b', colors: ['#a78bfa'] });
  assert.equal(readStoredPalette(null), null);
  assert.equal(readStoredPalette({ colors: [] }), null);
});
