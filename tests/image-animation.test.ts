// APNG sniffing for the upload route: an animated PNG must keep its bytes, because libvips reads only
// its default frame and a re-encode would flatten it. Animated GIF/WebP are re-encoded with every
// frame kept (sharp `animated: true`) and need no sniffing.
//
// Pure: lib/imageAnimation imports nothing.
//
// Run: npm run test:imageanimation

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAnimatedPng } from '../src/lib/imageAnimation';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4) /* CRC, unchecked */]);
}

test('an acTL chunk before the image data is an APNG', () => {
  const png = Buffer.concat([SIG, chunk('IHDR', Buffer.alloc(13)), chunk('acTL', Buffer.alloc(8)), chunk('IDAT', Buffer.alloc(4))]);
  assert.equal(isAnimatedPng(png), true);
});

test('a plain PNG is not', () => {
  const png = Buffer.concat([SIG, chunk('IHDR', Buffer.alloc(13)), chunk('IDAT', Buffer.alloc(4)), chunk('IEND')]);
  assert.equal(isAnimatedPng(png), false);
});

test('an acTL after the first IDAT does not count (the spec puts it before)', () => {
  const png = Buffer.concat([SIG, chunk('IHDR', Buffer.alloc(13)), chunk('IDAT', Buffer.alloc(4)), chunk('acTL', Buffer.alloc(8))]);
  assert.equal(isAnimatedPng(png), false);
});

test('not a PNG, or truncated, is not an APNG', () => {
  assert.equal(isAnimatedPng(Buffer.from('GIF89a')), false);
  assert.equal(isAnimatedPng(Buffer.alloc(0)), false);
  assert.equal(isAnimatedPng(Buffer.concat([SIG, Buffer.from([0, 0, 0, 13, 0x49])])), false);
});
