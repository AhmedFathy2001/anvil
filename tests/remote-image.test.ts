// "Paste URL" makes the server fetch a link, so which links it will fetch is the whole safety story:
// public image hosts over HTTPS, nothing else. Pure — no network.
//
// Run: npx tsx --test tests/remote-image.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allowedImageUrl } from '../src/lib/remoteImage.ts';

test('direct links on public image hosts are allowed', () => {
  assert.ok(allowedImageUrl('https://cdn.discordapp.com/attachments/1/2/drop.png?ex=1&is=2&hm=3'));
  assert.ok(allowedImageUrl('https://media.discordapp.net/attachments/1/2/drop.png'));
  assert.ok(allowedImageUrl(' https://i.imgur.com/abc.png '));
});

test('anything that could reach somewhere it should not is refused', () => {
  for (const url of [
    'http://cdn.discordapp.com/a.png', // not https
    'https://localhost/a.png',
    'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.1/a.png',
    'https://cdn.discordapp.com.evil.example/a.png', // lookalike host
    'https://user:pass@cdn.discordapp.com/a.png',
    'https://cdn.discordapp.com:8443/a.png',
    'https://imgur.com/gallery/abc', // a page, not the image host
    'file:///etc/passwd',
    'not a url',
  ]) {
    assert.equal(allowedImageUrl(url), null, url);
  }
});
