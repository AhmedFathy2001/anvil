import test from 'node:test';
import assert from 'node:assert/strict';
import { eventChannelSlug, freeChannelName } from '../src/lib/eventChannelName.ts';

test('slugs an event name the way Discord names text channels', () => {
  assert.equal(eventChannelSlug('Summer Bingo'), 'summer-bingo');
  assert.equal(eventChannelSlug('  Summer   Bingo 2026! '), 'summer-bingo-2026');
  assert.equal(eventChannelSlug("Ahmed's  -- Big__Event"), 'ahmed-s-big-event');
  assert.equal(eventChannelSlug('🔥 Fire & Ice 🔥'), 'fire-ice');
});

test('keeps letters from any script', () => {
  assert.equal(eventChannelSlug('Été Bingo'), 'été-bingo');
  assert.equal(eventChannelSlug('ビンゴ 2'), 'ビンゴ-2');
});

test('falls back when nothing usable is left', () => {
  assert.equal(eventChannelSlug(''), 'event');
  assert.equal(eventChannelSlug('!!! ???'), 'event');
});

test('stays under the length limit with room for a suffix, without a trailing dash', () => {
  const slug = eventChannelSlug(`${'a'.repeat(95)} bcd`);
  assert.ok(slug.length <= 96);
  assert.ok(!slug.endsWith('-'));
  assert.ok(freeChannelName(slug, [slug]).length <= 100);
});

test('picks the first free suffix when the name is taken', () => {
  assert.equal(freeChannelName('summer-bingo', ['general']), 'summer-bingo');
  assert.equal(freeChannelName('summer-bingo', ['Summer-Bingo']), 'summer-bingo-2');
  assert.equal(freeChannelName('summer-bingo', ['summer-bingo', 'summer-bingo-2']), 'summer-bingo-3');
});
