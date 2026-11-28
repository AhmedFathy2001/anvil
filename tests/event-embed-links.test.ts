// Discord posts about an event link to it: the pure address rules (lib/eventLinks).
//
// An event is linked on the apex (`<base>/events/<id>`), which the event page redirects to the
// event's own clan address for whoever opens it (lib/eventScope redirectToEventAddress); a
// competition, which has no such redirect, under the channel's clan (`/c/<slug>/weekly/<id>`).
//
// Run: npx tsx --test tests/event-embed-links.test.ts

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { clanPageUrl, eventAuthor, eventLink, eventPageUrl, eventTileUrl, siteBaseUrl } from '../src/lib/eventLinks.ts';

const realUri = process.env.DISCORD_REDIRECT_URI;
beforeEach(() => {
  process.env.DISCORD_REDIRECT_URI = 'https://anvilosrs.com/api/auth/callback';
});
after(() => {
  if (realUri === undefined) delete process.env.DISCORD_REDIRECT_URI;
  else process.env.DISCORD_REDIRECT_URI = realUri;
});

test('the base is the apex origin the login redirect names', () => {
  assert.equal(siteBaseUrl(), 'https://anvilosrs.com');
  process.env.DISCORD_REDIRECT_URI = 'not a url';
  assert.equal(siteBaseUrl(), null);
});

test('an event links to its page on the apex, and a tile to that tile opened on the board', () => {
  assert.equal(eventPageUrl(42), 'https://anvilosrs.com/events/42');
  assert.equal(eventTileUrl(42, 7), 'https://anvilosrs.com/events/42?tile=7');
  assert.equal(eventTileUrl(42, null), 'https://anvilosrs.com/events/42');
  assert.deepEqual(eventLink(42), { url: 'https://anvilosrs.com/events/42' });
});

test('every event post: the title AND the author line open the event', () => {
  const e = eventAuthor(42, 'Winter Bingo', 'Red');
  assert.equal(e.url, 'https://anvilosrs.com/events/42');
  assert.equal(e.author?.url, 'https://anvilosrs.com/events/42');
  assert.equal(e.author?.name, 'Winter Bingo · Red');
  // A post that means somewhere more exact spreads this first and sets its own after.
  const tilePost = { ...eventAuthor(42, 'Winter Bingo'), url: eventTileUrl(42, 7)! };
  assert.equal(tilePost.url, 'https://anvilosrs.com/events/42?tile=7');
});

test('no site URL, or no event: no link at all rather than a broken one', () => {
  delete process.env.DISCORD_REDIRECT_URI;
  assert.equal(eventPageUrl(42), null);
  assert.deepEqual(eventLink(42), {});
  const e = eventAuthor(42, 'Winter Bingo');
  assert.equal('url' in e, false);
  assert.equal(e.author?.url, undefined);
  process.env.DISCORD_REDIRECT_URI = 'https://anvilosrs.com/api/auth/callback';
  assert.equal('url' in eventAuthor(null, 'Winter Bingo'), false);
  assert.equal(eventPageUrl(Number.NaN), null);
});

test('a clan page goes under that clan, a space under /s/, never a hand-built path', () => {
  assert.equal(clanPageUrl({ slug: 'theafkspot', kind: 'clan' }, '/weekly/9'), 'https://anvilosrs.com/c/theafkspot/weekly/9');
  assert.equal(clanPageUrl({ slug: 'theafkspot' }, '/weekly/9'), 'https://anvilosrs.com/c/theafkspot/weekly/9');
  assert.equal(clanPageUrl({ slug: 'drenvox', kind: 'creator' }, '/events/5'), 'https://anvilosrs.com/s/drenvox/events/5');
  assert.equal(clanPageUrl(null, '/weekly/9'), null);
  assert.equal(clanPageUrl({ slug: null }, '/weekly/9'), null);
});
