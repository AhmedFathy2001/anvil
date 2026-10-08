// An event's icon and banner: only our own uploads are accepted, and the icon falls back to the
// host clan's logo (then the crest, which is "null" here).
//
// Run: npm run test:eventimage

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanEventImageUrl, eventIconUrl, isOwnMediaUrl } from '../src/lib/eventImage.ts';
import { eventMarkUrl } from '../src/lib/clanMarkUrl.ts';

// Read at call time by lib/storage, so setting it after the imports is enough.
process.env.S3_PUBLIC_BASE_URL = 'https://media.anvilosrs.com';

test('only our own media is accepted', () => {
  assert.ok(isOwnMediaUrl('https://media.anvilosrs.com/c/afk/submissions/a.webp'));
  assert.ok(isOwnMediaUrl('/uploads/a.webp'));
  assert.ok(!isOwnMediaUrl('//evil.example/a.png'), 'protocol-relative is another host');
  assert.ok(!isOwnMediaUrl('https://evil.example/a.png'));
  assert.ok(!isOwnMediaUrl('http://media.anvilosrs.com/a.webp'), 'https only');
  assert.ok(!isOwnMediaUrl('javascript:alert(1)'));
});

test('PATCH values: empty clears, foreign links are refused', () => {
  assert.deepEqual(cleanEventImageUrl(null), { ok: true, value: null });
  assert.deepEqual(cleanEventImageUrl(''), { ok: true, value: null });
  assert.deepEqual(cleanEventImageUrl(' https://media.anvilosrs.com/x.webp '), { ok: true, value: 'https://media.anvilosrs.com/x.webp' });
  assert.equal(cleanEventImageUrl('https://imgur.com/x.png').ok, false);
  assert.equal(cleanEventImageUrl(42).ok, false);
});

test('icon falls back to the host clan’s logo, then to the crest', () => {
  assert.equal(eventIconUrl({ iconUrl: 'https://media.anvilosrs.com/e.webp' }, { logoUrl: 'https://media.anvilosrs.com/c.webp' }), 'https://media.anvilosrs.com/e.webp');
  assert.equal(eventIconUrl({ iconUrl: null }, { logoUrl: 'https://media.anvilosrs.com/c.webp' }), 'https://media.anvilosrs.com/c.webp');
  assert.equal(eventIconUrl({ iconUrl: null }, { logoUrl: null }), null);
  assert.equal(eventIconUrl({}, null), null);
});

test('the Discord mark URL changes exactly when the icon does', () => {
  const a = eventMarkUrl('https://anvilosrs.com/x', 12, 'https://media.anvilosrs.com/1.webp');
  assert.match(a, /^https:\/\/anvilosrs\.com\/api\/og\/event-icon\/12\?v=/);
  assert.equal(a, eventMarkUrl('https://anvilosrs.com', 12, 'https://media.anvilosrs.com/1.webp'));
  assert.notEqual(a, eventMarkUrl('https://anvilosrs.com', 12, 'https://media.anvilosrs.com/2.webp'));
});
