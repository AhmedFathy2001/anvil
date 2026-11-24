// Item hunt drop posts and the "first to get it" wording: the pure rules (lib/huntDropPost, lib/itemHunt).
//
// Run: npx tsx --test tests/hunt-drop-post.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HUNT_PROOF_WINDOW_MS, huntDropEmbed, huntDropPostable, huntProofOpen, type HuntDropPost } from '../src/lib/huntDropPost.ts';
import { firstDoneWords, firstRuleWords, huntPanelLine, placeWords, type HuntConfig } from '../src/lib/itemHunt.ts';

const post = (over: Partial<HuntDropPost> = {}): HuntDropPost => ({
  clanId: 1,
  title: 'Zulrah fang hunt',
  kind: 'Item hunt',
  rule: 'most',
  huntIconUrl: null,
  rsn: 'Minyol',
  itemId: 12922,
  itemName: 'Tanzanite fang',
  quantity: 1,
  source: 'Zulrah',
  stat: 'at 512 kc',
  origin: 'plugin',
  count: 2,
  place: 1,
  endDate: '2026-12-01T20:00:00.000Z',
  imageUrl: null,
  ...over,
});

test('only a counted drop posts, and only the first time', () => {
  assert.equal(huntDropPostable({ status: 'counted', postedAt: null }), true);
  assert.equal(huntDropPostable({ status: 'counted', postedAt: '2026-11-24T10:00:00Z' }), false);
  for (const status of ['review', 'pending', 'rejected']) assert.equal(huntDropPostable({ status, postedAt: null }), false, status);
});

test('a screenshot can be added for a while after the drop, never to a turned-down one', () => {
  const at = Date.parse('2026-11-24T10:00:00Z');
  assert.equal(huntProofOpen({ status: 'counted', createdAtMs: at }, at + 60_000), true);
  assert.equal(huntProofOpen({ status: 'review', createdAtMs: at }, at + 60_000), true, 'a held drop takes one, for the staff who look at it');
  assert.equal(huntProofOpen({ status: 'counted', createdAtMs: at }, at + HUNT_PROOF_WINDOW_MS + 1), false);
  assert.equal(huntProofOpen({ status: 'rejected', createdAtMs: at }, at), false);
});

test('the post says who got what, from where, at what kc, and where it leaves them', () => {
  const e = huntDropEmbed(post());
  assert.equal(e.author?.name, 'Item hunt · new drop');
  assert.equal(e.title, '🎁 Zulrah fang hunt');
  assert.equal(e.description, '**Minyol** got **Tanzanite fang** from **Zulrah** at 512 kc.');
  assert.deepEqual(e.fields?.map((f) => [f.name, f.value]), [
    ['Standing', '🥇 1st · 2 drops'],
    ['Counted from', 'plugin'],
    ['Ends', `<t:${Date.parse('2026-12-01T20:00:00.000Z') / 1000}:R>`],
  ]);
  assert.ok(e.thumbnail?.url.includes('12922'), 'the item’s own icon');
  assert.equal(e.image, undefined, 'no picture until the screenshot lands');
});

test('the same post carries the screenshot once it lands, and a points hunt counts points', () => {
  assert.deepEqual(huntDropEmbed(post({ imageUrl: 'https://cdn.example/a.webp' })).image, { url: 'https://cdn.example/a.webp' });
  const e = huntDropEmbed(post({ rule: 'points', count: 1, place: 4, source: null, stat: null, quantity: 3 }));
  assert.equal(e.description, '**Minyol** got **Tanzanite fang ×3**.');
  assert.equal(e.fields?.[0].value, '4th · 1 point');
});

test('"first to get it": a player with a drop is done, in their place', () => {
  assert.equal(placeWords(1), '1st');
  assert.equal(placeWords(2), '2nd');
  assert.equal(placeWords(13), '13th');
  assert.equal(placeWords(22), '22nd');
  assert.equal(firstDoneWords(1), 'Done · 1st');
  assert.match(firstRuleWords(4), /Any one of the 4 targets counts/);
  assert.match(firstRuleWords(4), /the next to get any of them takes the next place/);
  assert.doesNotMatch(firstRuleWords(1), /targets/);

  const config = {
    v: 2, target: 'items', petGroup: null, rule: 'first', ends: { kind: 'date' }, confirm: 'staff', killsOf: null, xpSkill: null,
    items: [1, 2, 3, 4].map((id) => ({ id, name: `Pet ${id}`, sources: [], count: 'drops', pet: true, stat: null })),
  } as HuntConfig;
  const done = huntPanelLine(config, { count: 1, held: 1, due: 0.2, drops: [], rank: 2 }, [{ id: 3, name: 'Pet 3', label: 'The Leviathan', unit: 'kc', gain: 3, due: 0.001, rate: 2500 } as never]);
  assert.deepEqual(done, { figure: 'Done · 2nd', sub: null }, 'no "1 of 4", no progress toward the rest');
  const hunting = huntPanelLine(config, { count: 0, held: 0, due: 0.4, drops: [], rank: 3 }, null);
  assert.equal(hunting.figure, '40% due', 'still hunting: the due figure stays');
});
