// Supporter name colours per person: parse, gate by tier, resolve to ink. Pure, no database.
//
// Run: node --experimental-strip-types --test tests/supporter-style.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTER_INK,
  SUPPORTER_PRESETS,
  contrastOnCard,
  effectiveSupporterStyle,
  parseSupporterStyle,
  presetsFor,
  supporterGradientCss,
  supporterInk,
  tooDark,
  validateSupporterStyle,
} from '../src/lib/supporterStyle.ts';
import { supporterStarUrl, supporterState, withSupporterAuthor } from '../src/lib/supporterTiers.ts';

test('every preset reads well on the dark card', () => {
  for (const p of SUPPORTER_PRESETS) {
    assert.ok(p.stops.length >= 2 && p.stops.length <= 4, p.id);
    for (const s of p.stops) assert.ok(contrastOnCard(s) >= 4.5, `${p.id} ${s} ${contrastOnCard(s).toFixed(2)}`);
  }
});

test('presets by tier: none for Supporter, Patron-only prism', () => {
  assert.deepEqual(presetsFor('supporter'), []);
  assert.ok(!presetsFor('champion').some((p) => p.id === 'prism'));
  assert.ok(presetsFor('patron').some((p) => p.id === 'prism'));
  assert.ok(presetsFor('champion').length >= 6);
});

test('parse is lenient: junk is dropped, never thrown', () => {
  assert.equal(parseSupporterStyle(null), null);
  assert.equal(parseSupporterStyle('not json'), null);
  assert.equal(parseSupporterStyle('[1]'), null);
  assert.equal(parseSupporterStyle('{"preset":"nope"}'), null);
  assert.deepEqual(parseSupporterStyle('{"preset":"ember"}'), { preset: 'ember' });
  assert.deepEqual(parseSupporterStyle('{"stops":["#FF0000","00ffcc"]}'), { stops: ['#ff0000', '#00ffcc'] });
  assert.equal(parseSupporterStyle('{"stops":["#ff0000"]}'), null, 'one stop is not a gradient');
  assert.equal(parseSupporterStyle('{"stops":["#ff0000","#101010"]}'), null, 'a near-black stop vanishes');
});

test('too dark is judged against the card', () => {
  assert.ok(tooDark('#000000'));
  assert.ok(tooDark('#202020'));
  assert.ok(!tooDark('#ffffff'));
  assert.ok(!tooDark('#ff5a4d'));
});

test('effective style: tier gates and falls back', () => {
  const custom = { stops: ['#ff0000', '#00ffcc'] as `#${string}`[] };
  assert.deepEqual(effectiveSupporterStyle('patron', custom), custom);
  assert.equal(effectiveSupporterStyle('champion', custom), null, 'a lapsed Patron custom falls back');
  assert.deepEqual(effectiveSupporterStyle('champion', { ...custom, preset: 'ocean' }), { preset: 'ocean' }, 'their preset still applies');
  assert.equal(effectiveSupporterStyle('champion', { preset: 'prism' }), null, 'Patron preset not for Champion');
  assert.equal(effectiveSupporterStyle('supporter', { preset: 'ocean' }), null);
  assert.equal(effectiveSupporterStyle(null, { preset: 'ocean' }), null);
  assert.equal(effectiveSupporterStyle('champion', { preset: 'classic' }), null, 'the default is no style');
});

test('ink: default per tier, preset, custom; Patron keeps its motion', () => {
  assert.deepEqual(supporterInk('supporter', { preset: 'ocean' }), SUPPORTER_INK.supporter);
  assert.deepEqual(supporterInk('champion', null), SUPPORTER_INK.champion);
  assert.deepEqual(supporterInk('champion', { preset: 'ember' }), { color: '#ff8a3d', grad: ['#ffd27a', '#ff8a3d', '#ff5a4d'] });
  assert.deepEqual(supporterInk('patron', { stops: ['#ff0000', '#00ffcc'] }), { color: '#ff0000', grad: ['#ff0000', '#00ffcc'], move: true });
  assert.deepEqual(supporterInk('champion', { stops: ['#ff0000', '#00ffcc'] }), SUPPORTER_INK.champion);
  // A copy, never the shared table.
  supporterInk('champion').grad!.push('#ffffff');
  assert.equal(SUPPORTER_INK.champion.grad!.length, 3);
});

test('gradient css loops a moving one', () => {
  assert.equal(supporterGradientCss(SUPPORTER_INK.supporter), null);
  assert.equal(supporterGradientCss({ color: '#ff0000', grad: ['#ff0000', '#00ffcc'] }), 'linear-gradient(90deg, #ff0000, #00ffcc)');
  assert.equal(supporterGradientCss({ color: '#ff0000', grad: ['#ff0000', '#00ffcc'], move: true }), 'linear-gradient(90deg, #ff0000, #00ffcc, #ff0000)');
});

test('validate: strict, against the tier in force', () => {
  assert.deepEqual(validateSupporterStyle(null, 'champion'), { ok: true, style: null });
  assert.deepEqual(validateSupporterStyle({}, 'patron'), { ok: true, style: null });
  assert.equal(validateSupporterStyle({ preset: 'ocean' }, null).ok, false);
  assert.equal(validateSupporterStyle({ preset: 'ocean' }, 'supporter').ok, false);
  assert.deepEqual(validateSupporterStyle({ preset: 'ocean' }, 'champion'), { ok: true, style: { preset: 'ocean' } });
  assert.deepEqual(validateSupporterStyle({ preset: 'classic' }, 'champion'), { ok: true, style: null });
  assert.equal(validateSupporterStyle({ preset: 'prism' }, 'champion').ok, false);
  assert.equal(validateSupporterStyle({ preset: 'nope' }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ stops: ['#ff0000', '#00ffcc'] }, 'champion').ok, false);
  assert.deepEqual(validateSupporterStyle({ stops: ['#FF0000', '#00ffcc'] }, 'patron'), { ok: true, style: { stops: ['#ff0000', '#00ffcc'] } });
  assert.equal(validateSupporterStyle({ stops: ['#ff0000'] }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ stops: ['#ff0000', '#00ffcc', '#ffffff', '#ffffff', '#ffffff'] }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ stops: ['red', '#00ffcc'] }, 'patron').ok, false);
  const dark = validateSupporterStyle({ stops: ['#ff0000', '#0a0a0a'] }, 'patron');
  assert.equal(dark.ok, false);
  assert.match(!dark.ok ? dark.error : '', /too dark/);
  assert.equal(validateSupporterStyle([], 'patron').ok, false);
});

test('state carries the best row’s gated style', () => {
  const row = { tier: 'patron', status: 'active', currentPeriodEnd: null, startedAt: '2026-01-01 00:00:00', style: '{"stops":["#ff0000","#00ffcc"]}' };
  assert.deepEqual(supporterState([row])!.style, { stops: ['#ff0000', '#00ffcc'] });
  assert.equal(supporterState([{ ...row, tier: 'champion' }])!.style, null);
  assert.equal(supporterState([{ ...row, style: undefined }])!.style, null);
});

test('Discord star: static for defaults, drawn in their colours otherwise', () => {
  assert.equal(supporterStarUrl('champion', null, 'https://a'), 'https://a/icons/supporter-champion.png');
  assert.equal(supporterStarUrl('supporter', { preset: 'ocean' }, 'https://a'), 'https://a/icons/supporter-supporter.png');
  assert.equal(supporterStarUrl('champion', { preset: 'ocean' }, 'https://a'), 'https://a/api/og/supporter-star/7ae0ff-4da3ff-9a8cff');
  assert.equal(supporterStarUrl('champion', { stops: ['#ff0000', '#00ffcc'] }, 'https://a'), 'https://a/icons/supporter-champion.png');
  const e = withSupporterAuthor({ author: { name: 'Zezima' } }, 'patron', 'https://a', { stops: ['#ff0000', '#00ffcc'] });
  assert.equal((e.author as { icon_url: string }).icon_url, 'https://a/api/og/supporter-star/ff0000-00ffcc');
});
