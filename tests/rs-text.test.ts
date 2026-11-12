import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rsText } from '../src/lib/pluginUi/rsText.ts';

test('panel text keeps to the RuneScape fonts: typographic swaps, symbols and the rest untouched', () => {
  const view = { t: 'col', c: [{ t: 'text', text: 'You’re in – “Next ›” → go • now' }, { t: 'text', text: 'Signed up ✓ — 5 · 2× …', n: 3 }] };
  assert.deepEqual(rsText(view), { t: 'col', c: [{ t: 'text', text: 'You\'re in - "Next >" -> go · now' }, { t: 'text', text: 'Signed up ✓ — 5 · 2× …', n: 3 }] });
  assert.equal(rsText(null), null);
});
