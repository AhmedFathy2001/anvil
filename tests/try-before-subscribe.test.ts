// Try before you subscribe: anyone may pick and save every Supporter look on Settings → Profile &
// look, and every PUBLIC read still gates by the tier in force. A free person's saved choices must
// never reach another viewer or the plugin. Pure, no database.
//
// Run: npx tsx --test tests/try-before-subscribe.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanPrefs, DEFAULT_PREFS } from '../src/lib/chatFeedRules.ts';
import { ANVIL_COLORS, effectiveBrief, effectiveLook } from '../src/lib/chatLook.ts';
import {
  DISPLAY_CASE_MAX,
  displayCaseSlots,
  shownCharacterMedia,
  shownProfileMedia,
  tierForDisplaySlot,
  visiblePins,
} from '../src/lib/profileMediaRules.ts';
import {
  SUPPORTER_INK,
  effectiveSupporterStyle,
  supporterInk,
  tierCovers,
  tierForStyle,
  tryTier,
  validateSupporterStyle,
  wornCharacterStyles,
} from '../src/lib/supporterStyle.ts';
import { supporterState } from '../src/lib/supporterTiers.ts';

const BASE = 'https://media.example.test/anvil';
const url = (n: number) => `${BASE}/profiles/7/00000000-0000-4000-8000-00000000000${n}.webp`;

test('tierForStyle names the tier a look needs', () => {
  assert.equal(tierForStyle(null), 'supporter');
  assert.equal(tierForStyle({}), 'supporter');
  assert.equal(tierForStyle({ preset: 'ember' }), 'champion');
  assert.equal(tierForStyle({ preset: 'classic' }), 'champion');
  assert.equal(tierForStyle({ preset: 'prism' }), 'patron');
  assert.equal(tierForStyle({ stops: ['#ff9a5a'] }), 'champion');
  assert.equal(tierForStyle({ stops: ['#ff9a5a', '#7a8cff'] }), 'patron');
  assert.equal(tierForStyle({ preset: 'ember', light: { stops: ['#112233', '#445566'] } }), 'patron', 'a surface look counts too');
});

test('tryTier: the tier asked to try, never below the one held', () => {
  assert.equal(tryTier(null, null), null);
  assert.equal(tryTier(null, 'patron'), 'patron');
  assert.equal(tryTier('champion', 'supporter'), 'champion');
  assert.equal(tryTier('champion', 'patron'), 'patron');
  assert.equal(tryTier('patron', null), 'patron');
  assert.ok(tierCovers('patron', 'champion'));
  assert.ok(!tierCovers('supporter', 'champion'));
  assert.ok(!tierCovers(null, 'supporter'));
});

test('a free person may save a Patron look, kept by name, and nobody wears it', () => {
  // What the route stores when someone without a tier tries Patron (keepDefault while trying).
  const tried = validateSupporterStyle({ preset: 'prism' }, tryTier(null, 'patron'), { keepDefault: true });
  assert.deepEqual(tried, { ok: true, style: { preset: 'prism' } }, 'the default preset survives as a choice');
  const gradient = validateSupporterStyle({ stops: ['#ff0000', '#00ff00', '#0000ff'] }, 'patron', { keepDefault: true });
  assert.ok(gradient.ok);
  // Without trying, the held tier still decides (unchanged behaviour).
  assert.equal(validateSupporterStyle({ preset: 'ember' }, null).ok, false);
  assert.equal(validateSupporterStyle({ stops: ['#ff0000', '#00ff00'] }, 'champion').ok, false);

  // Every read gates by the tier in force: no tier wears nothing.
  const stored = gradient.ok ? gradient.style : null;
  assert.equal(effectiveSupporterStyle(null, stored), null);
  assert.equal(effectiveSupporterStyle(undefined, stored), null);
  // A Supporter wears gold, a Champion their tier's default, whatever was tried.
  assert.equal(effectiveSupporterStyle('supporter', stored), null);
  assert.deepEqual(supporterInk('supporter', stored), { color: SUPPORTER_INK.supporter.color });
  assert.equal(effectiveSupporterStyle('champion', stored), null);
  assert.deepEqual(supporterInk('champion', stored).grad, SUPPORTER_INK.champion.grad);
  // Subscribing at the tier wears it at once.
  assert.deepEqual(effectiveSupporterStyle('patron', stored), { stops: ['#ff0000', '#00ff00', '#0000ff'] });
});

test('a lapsed subscription is no state at all, so no stored look is served', () => {
  const ended = { userId: 1, tier: 'patron', status: 'ended', currentPeriodEnd: '2026-01-01T00:00:00Z', startedAt: '2025-01-01T00:00:00Z', style: '{"preset":"prism"}' };
  assert.equal(supporterState([ended], Date.parse('2026-11-12T00:00:00Z')), null);
});

test('chat line colours: anyone may save their own, only a Supporter has them applied', () => {
  const prefs = cleanPrefs({ palette: 'custom', colors: { done: '#00ff00', drop: '#112233' }, tagColor: '#abcdef' });
  const free = effectiveLook(prefs, null);
  assert.equal(free.palette, 'anvil', 'a free person gets the Anvil colours');
  assert.equal(free.colors!.done, ANVIL_COLORS.done.slice(1));
  assert.equal(free.colors!.drop, ANVIL_COLORS.drop.slice(1));
  assert.equal(free.tag, 'abcdef', 'the [Anvil] tag colour is free for everyone');
  assert.equal(effectiveLook(prefs, 'supporter').colors!.done, '00ff00');
  // The choice is kept as stored, so subscribing applies it with nothing to redo.
  assert.equal(prefs.palette, 'custom');
});

test('the login brief: anyone may pick, only a Champion has it applied', () => {
  const prefs = cleanPrefs({ brief: ['goals'] });
  assert.deepEqual(effectiveBrief(prefs, null), DEFAULT_PREFS.brief);
  assert.deepEqual(effectiveBrief(prefs, 'supporter'), DEFAULT_PREFS.brief);
  assert.deepEqual(effectiveBrief(prefs, 'champion'), ['goals']);
});

test('motion pictures: stored for anyone, shown still to others until Champion', () => {
  const row = { avatarUrl: url(1), avatarStillUrl: url(2), bannerUrl: url(3), bannerStillUrl: url(4), bannerPosition: 30 };
  const free = shownProfileMedia(row, null, { publicBase: BASE });
  assert.equal(free.avatar!.src, url(2), 'a free person’s avatar shows its first frame');
  assert.equal(free.avatar!.animated, false);
  assert.equal(free.banner!.src, url(4));
  assert.equal(shownProfileMedia(row, 'supporter', { publicBase: BASE }).avatar!.animated, false);
  const champ = shownProfileMedia(row, 'champion', { publicBase: BASE });
  assert.equal(champ.avatar!.src, url(1));
  assert.equal(champ.banner!.animated, true);
  // A character's own override is gated the same way.
  assert.equal(shownCharacterMedia(row, null, null, { publicBase: BASE }).avatar!.animated, false);
});

test('display case: anyone may fill it, others see only what the tier shows', () => {
  const pins = Array.from({ length: DISPLAY_CASE_MAX }, (_, i) => ({ id: i + 1, position: i }));
  assert.equal(DISPLAY_CASE_MAX, 12);
  assert.deepEqual(visiblePins(pins, null), [], 'no tier shows nothing');
  assert.equal(visiblePins(pins, 'supporter').length, 4);
  assert.equal(visiblePins(pins, 'champion').length, 8);
  assert.equal(visiblePins(pins, 'patron').length, 12);
  assert.equal(displayCaseSlots(null), 0);
  assert.deepEqual(
    [0, 3, 4, 7, 8, 11].map(tierForDisplaySlot),
    ['supporter', 'supporter', 'champion', 'champion', 'patron', 'patron'],
  );
});

test('read-time clamp: a stored Patron-shaped look is served by the tier held, never above it', () => {
  const patronShaped = { stops: ['#ff0000', '#00ff00', '#0000ff'] as `#${string}`[] };
  // Held Champion: no gradient of their own; the tier's default (classic) is worn.
  assert.equal(effectiveSupporterStyle('champion', patronShaped), null);
  assert.deepEqual(supporterInk('champion', patronShaped).grad, SUPPORTER_INK.champion.grad);
  assert.deepEqual(wornCharacterStyles('champion', null, [patronShaped]), [null]);
  // Held nothing: the free look (no flair at all).
  assert.equal(effectiveSupporterStyle(null, patronShaped), null);
  assert.deepEqual(wornCharacterStyles(null, patronShaped, [patronShaped, null]), [null, null]);
});

test('read-time clamp: a Champion wears at most two distinct static colours across characters', () => {
  const one = (c: string) => ({ stops: [c as `#${string}`] });
  const worn = wornCharacterStyles('champion', null, [one('#aa0000'), one('#00aa00'), one('#0000aa'), one('#aa0000'), { preset: 'ember' }]);
  assert.deepEqual(worn, [one('#aa0000'), one('#00aa00'), null, one('#aa0000'), { preset: 'ember' }], 'the third colour falls back; presets are free');
  // A character with no look of its own wears the Anvil name's, which counts too.
  assert.deepEqual(wornCharacterStyles('champion', one('#123456'), [null, one('#aa0000'), one('#00aa00')]), [one('#123456'), one('#aa0000'), null]);
  // Patron has no such limit.
  assert.equal(wornCharacterStyles('patron', null, [one('#aa0000'), one('#00aa00'), one('#0000aa')]).filter(Boolean).length, 3);
});
