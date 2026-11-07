// Supporter name colours per person: parse, gate by tier, resolve to ink. Pure, no database.
//
// Run: node --experimental-strip-types --test tests/supporter-style.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTER_INK,
  SUPPORTER_PRESETS,
  contrastOnCard,
  distinctStaticColours,
  effectiveSupporterStyle,
  parseSupporterStyle,
  presetsFor,
  supporterGradientCss,
  supporterInk,
  supporterInkOn,
  inkForSurface,
  contrastRatio,
  weakestContrast,
  FLAIR_BACKGROUND,
  OPAQUE_CHAT_BACKGROUND,
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
  assert.deepEqual(parseSupporterStyle('{"stops":["#ff0000"]}'), { stops: ['#ff0000'] });
  assert.deepEqual(parseSupporterStyle('{"stops":["#ff0000","#101010"]}'), { stops: ['#ff0000', '#101010'] });
});

test('too dark is judged against the card', () => {
  assert.ok(tooDark('#000000'));
  assert.ok(tooDark('#202020'));
  assert.ok(!tooDark('#ffffff'));
  assert.ok(!tooDark('#ff5a4d'));
});

test('Champion custom-colour allowance counts distinct static colours only', () => {
  assert.deepEqual([...distinctStaticColours([
    { stops: ['#ff0000'] },
    { stops: ['#ff0000'] },
    { stops: ['#00ff00'] },
    { preset: 'ocean' },
  ])], ['#ff0000', '#00ff00']);
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
  assert.deepEqual(supporterInk('champion', { stops: ['#123456'] }), { color: '#123456' });
  assert.deepEqual(supporterInk('patron', { stops: ['#123456'] }), { color: '#123456' });
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
  assert.deepEqual(validateSupporterStyle({ stops: ['#ff0000'] }, 'champion'), { ok: true, style: { stops: ['#ff0000'] } });
  assert.equal(validateSupporterStyle({ stops: ['#ff0000', '#00ffcc'] }, 'champion').ok, false);
  assert.deepEqual(validateSupporterStyle({ stops: ['#FF0000', '#00ffcc'] }, 'patron'), { ok: true, style: { stops: ['#ff0000', '#00ffcc'] } });
  assert.deepEqual(validateSupporterStyle({ stops: ['#ff0000'] }, 'patron'), { ok: true, style: { stops: ['#ff0000'] } });
  assert.equal(validateSupporterStyle({ stops: ['#ff0000', '#00ffcc', '#ffffff', '#ffffff', '#ffffff'] }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ stops: ['red', '#00ffcc'] }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ stops: ['#ff0000', '#0a0a0a'] }, 'patron').ok, true);
  assert.equal(validateSupporterStyle([], 'patron').ok, false);
});

test('surface conversion preserves source ink and derives readable opaque-chat colours once', () => {
  const source = supporterInk('patron', { stops: ['#111111', '#ff00ff'] });
  const derived = supporterInkOn(source, OPAQUE_CHAT_BACKGROUND, '#000000');
  assert.deepEqual(source.grad, ['#111111', '#ff00ff']);
  assert.equal(derived.move, true);
  assert.ok(derived.grad && derived.grad.length === 2);
  assert.notEqual(derived.grad![1], '#ff00ff');
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
  assert.equal(supporterStarUrl('champion', { stops: ['#ff0000'] }, 'https://a'), 'https://a/api/og/supporter-star/ff0000');
  const e = withSupporterAuthor({ author: { name: 'Zezima' } }, 'patron', 'https://a', { stops: ['#ff0000', '#00ffcc'] });
  assert.equal((e.author as unknown as { icon_url: string }).icon_url, 'https://a/api/og/supporter-star/ff0000-00ffcc');
});

// Per-surface looks: an optional dark / light look, worn as-is there; else the main look is adapted.

test('surface overrides validate like the main look, tier-gated, and keep the default preset', () => {
  assert.deepEqual(validateSupporterStyle({ dark: { preset: 'classic' } }, 'champion'), { ok: true, style: { dark: { preset: 'classic' } } });
  assert.deepEqual(validateSupporterStyle({ preset: 'ocean', light: { stops: ['#3A2000'] } }, 'champion'), {
    ok: true,
    style: { preset: 'ocean', light: { stops: ['#3a2000'] } },
  });
  assert.deepEqual(validateSupporterStyle({ dark: { stops: ['#ff0000', '#00ffcc', '#ffffff'] } }, 'patron'), {
    ok: true,
    style: { dark: { stops: ['#ff0000', '#00ffcc', '#ffffff'] } },
  });
  // Cleared overrides vanish; an all-empty style is the default.
  assert.deepEqual(validateSupporterStyle({ dark: {}, light: null }, 'patron'), { ok: true, style: null });
  // The same gates as the main look, with the surface named in the error.
  const champGrad = validateSupporterStyle({ light: { stops: ['#ff0000', '#00ffcc'] } }, 'champion');
  assert.equal(champGrad.ok, false);
  assert.match(!champGrad.ok ? champGrad.error : '', /^Light backgrounds: /);
  assert.equal(validateSupporterStyle({ dark: { preset: 'prism' } }, 'champion').ok, false);
  assert.equal(validateSupporterStyle({ dark: { preset: 'ocean' } }, 'supporter').ok, false);
  assert.equal(validateSupporterStyle({ dark: { preset: 'ocean' } }, null).ok, false);
  assert.equal(validateSupporterStyle({ dark: { stops: ['nope'] } }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ dark: { stops: [] } }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ light: { stops: ['#000000', '#111111', '#222222', '#333333', '#444444'] } }, 'patron').ok, false);
  assert.equal(validateSupporterStyle({ dark: 'red' }, 'patron').ok, false);
});

test('stored overrides parse leniently and are gated on read (a downgrade keeps the wish)', () => {
  const raw = JSON.stringify({ stops: ['#ff0000', '#00ffcc'], dark: { stops: ['#ffffff', '#ffe0a0'] }, light: { stops: ['bad'] } });
  const parsed = parseSupporterStyle(raw);
  assert.deepEqual(parsed, { stops: ['#ff0000', '#00ffcc'], dark: { stops: ['#ffffff', '#ffe0a0'] } });
  assert.deepEqual(effectiveSupporterStyle('patron', parsed), parsed);
  // A Champion may not wear 2-stop customs: both fall away, nothing is left.
  assert.equal(effectiveSupporterStyle('champion', parsed), null);
  assert.equal(effectiveSupporterStyle('supporter', { dark: { preset: 'ocean' } }), null);
  // Override-only style with the default preset survives gating (it means "as-is").
  assert.deepEqual(effectiveSupporterStyle('champion', { light: { preset: 'classic' } }), { light: { preset: 'classic' } });
  assert.deepEqual(parseSupporterStyle(JSON.stringify({ dark: { preset: 'ember' } })), { dark: { preset: 'ember' } });
});

test('supporterInk carries each override raw; inkForSurface wears it as-is, else adapts the main look', () => {
  const ink = supporterInk('patron', { stops: ['#202020', '#303030'], light: { stops: ['#3a2000', '#102040', '#401020'] } });
  assert.deepEqual(ink.light, { color: '#102040', grad: ['#3a2000', '#102040', '#401020'] });
  assert.equal(ink.dark, undefined);

  // Light: the override, untouched (even though it is dark), keeps the main look's motion.
  const light = inkForSurface(ink, 'light');
  assert.deepEqual(light, { color: '#102040', grad: ['#3a2000', '#102040', '#401020'], move: true });
  assert.ok(!('dark' in light) && !('light' in light));

  // Dark: no override, so the main look is lifted to read on the card — exactly as before.
  const dark = inkForSurface(ink, 'dark');
  const main = { ...ink };
  delete main.light;
  assert.deepEqual(dark, supporterInkOn(main, FLAIR_BACKGROUND, '#ffffff', 4.5));
  assert.ok(weakestContrast(dark, FLAIR_BACKGROUND) >= 4.5);

  // null background: no adaption, override still applies.
  assert.deepEqual(inkForSurface(ink, 'dark', null), { color: '#202020', grad: ['#202020', '#303030'], move: true });

  // A one-stop override is solid: no gradient, no motion.
  const solid = inkForSurface(supporterInk('champion', { preset: 'ocean', dark: { stops: ['#777777'] } }), 'dark');
  assert.deepEqual(solid, { color: '#777777' });

  // A default name with no overrides is unchanged by the helper's split.
  assert.deepEqual(inkForSurface(supporterInk('champion', null), 'light'), supporterInkOn(supporterInk('champion', null), OPAQUE_CHAT_BACKGROUND, '#000000', 4.5));
});

test('contrast helpers', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.ok(weakestContrast({ color: '#ffffff', grad: ['#ffffff', '#1c1714'] }, FLAIR_BACKGROUND) < 1.01);
  assert.ok(weakestContrast({ color: '#ffffff' }, FLAIR_BACKGROUND) > 15);
});

test('Discord star wears the dark override when set', () => {
  const url = supporterStarUrl('patron', { preset: 'ocean', dark: { stops: ['#ffffff', '#ffd27a'] } }, 'https://x');
  assert.equal(url, 'https://x/api/og/supporter-star/ffffff-ffd27a');
});
