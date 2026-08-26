// Stripping the OSRS '@component@' chat marker out of forwarded notifications.
//
// The game began wrapping the clickable name in combat-achievement completion messages in an
// `@ach_comp@` marker. It is not an angle-bracket tag, so the plugin's `<...>` stripper leaves it,
// and it rode into the forwarded Discord embed — a clan saw `⚔️ @ach_comp@This Is Madness`. Fixed
// server-side so every installed client is repaired without a plugin release; this pins the strip.
//
// Run: npx tsx --test tests/game-text.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripGameMarkup, stripGameMarkupDeep } from '../src/lib/gameText.ts';

test('the exact cases reported', () => {
  assert.equal(stripGameMarkup('@ach_comp@This Is Madness'), 'This Is Madness');
  assert.equal(stripGameMarkup('@ach_comp@Amoxliatl Speed-Chaser'), 'Amoxliatl Speed-Chaser');
});

test('an embed title keeps its emoji and loses only the marker', () => {
  assert.equal(stripGameMarkup('⚔️ @ach_comp@This Is Madness'), '⚔️ This Is Madness');
});

test('the wiki URL is repaired too', () => {
  assert.equal(
    stripGameMarkup('https://oldschool.runescape.wiki/w/@ach_comp@This_Is_Madness'),
    'https://oldschool.runescape.wiki/w/This_Is_Madness',
  );
});

test('a marker mid-sentence, and its leftover spacing, is cleaned', () => {
  assert.equal(
    stripGameMarkup('Grim completed a master combat task: @ach_comp@Nylocas, On the Rocks.'),
    'Grim completed a master combat task: Nylocas, On the Rocks.',
  );
});

test('sibling markers the game might add are covered', () => {
  assert.equal(stripGameMarkup('@ach_diary@Ardougne Elite'), 'Ardougne Elite');
});

test('a clean name is returned untouched — same reference, no reflow', () => {
  const clean = 'This Is Madness';
  assert.equal(stripGameMarkup(clean), clean);
  // A name with a comma and no marker must not have its spacing disturbed.
  assert.equal(stripGameMarkup('Nylocas, On the Rocks'), 'Nylocas, On the Rocks');
});

test('null and undefined pass through, so optional fields need no guard', () => {
  assert.equal(stripGameMarkup(null), null);
  assert.equal(stripGameMarkup(undefined), undefined);
});

test('an @ that is not a component marker is left alone', () => {
  // An email-ish or a lone @ is not the `@word@` shape and must survive.
  assert.equal(stripGameMarkup('ping @someone about it'), 'ping @someone about it');
  assert.equal(stripGameMarkup('cost @ 5 gp'), 'cost @ 5 gp');
});

test('the whole embed is cleaned recursively, input not mutated', () => {
  const embed = {
    title: '⚔️ @ach_comp@This Is Madness',
    url: 'https://oldschool.runescape.wiki/w/@ach_comp@This_Is_Madness',
    description: 'Grim completed a master combat task.',
    author: { name: 'Grim' },
    fields: [
      { name: 'Points earned', value: '+6' },
      { name: 'Task', value: '@ach_comp@This Is Madness' },
    ],
    color: 0xff9900,
  };
  const out = stripGameMarkupDeep(embed);

  assert.equal(out.title, '⚔️ This Is Madness');
  assert.equal(out.url, 'https://oldschool.runescape.wiki/w/This_Is_Madness');
  assert.equal(out.fields[1].value, 'This Is Madness');
  assert.equal(out.author.name, 'Grim'); // an RSN is left alone
  assert.equal(out.color, 0xff9900); // non-strings pass through
  // input untouched
  assert.equal(embed.title, '⚔️ @ach_comp@This Is Madness');
});
