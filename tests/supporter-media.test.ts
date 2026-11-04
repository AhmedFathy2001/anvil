// Anvil Supporter profile perks, the pure half: the upload's validation and re-encode
// (lib/profileMediaProcess), the tier gates on read (lib/profileMediaRules) and the display-case slot
// rules. No database. The DB half is tests/supporter-media-db.test.ts.
//
// Run: npx tsx --test tests/supporter-media.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import {
  canUseProfileMedia,
  checkMediaHeader,
  displayCaseSlots,
  isProfileMediaUrl,
  MEDIA_LIMITS,
  shownProfileMedia,
  sniffImageType,
  visiblePins,
} from '../src/lib/profileMediaRules.ts';
import { processProfileMedia } from '../src/lib/profileMediaProcess.ts';

const BASE = 'https://media.example.com';
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const UUID2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const ours = (u: string, user = 7) => `${BASE}/profiles/${user}/${u}.webp`;

// ── A tiny GIF encoder, so tests can make real animations of any size ─────────────────────────────
// Every pixel is preceded by a CLEAR code, so the LZW code size never grows past 3 bits and no
// dictionary logic is needed. Wasteful, valid, and exactly what a decoder has to accept.

function gif(width: number, height: number, frames: number, opts: { pixels?: boolean } = {}): Buffer {
  const out: number[] = [];
  const u16 = (n: number) => out.push(n & 0xff, (n >> 8) & 0xff);
  out.push(...Buffer.from('GIF89a'));
  u16(width);
  u16(height);
  out.push(0x81, 0, 0); // global colour table of 4
  out.push(255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255);
  out.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0x00, 0x00, 0x00); // loop forever
  for (let f = 0; f < frames; f++) {
    out.push(0x21, 0xf9, 0x04, 0x00, 10, 0, 0, 0); // 100 ms
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(width);
    u16(height);
    out.push(0x00, 0x02); // no local table; LZW minimum code size 2
    const codes: number[] = [];
    // A header-only bomb carries one pixel; decoders pad the rest, the header still claims the size.
    const n = opts.pixels === false ? 1 : width * height;
    for (let i = 0; i < n; i++) codes.push(4, f % 4);
    codes.push(5);
    const bytes: number[] = [];
    let acc = 0;
    let bits = 0;
    for (const c of codes) {
      acc |= c << bits;
      bits += 3;
      while (bits >= 8) {
        bytes.push(acc & 0xff);
        acc >>= 8;
        bits -= 8;
      }
    }
    if (bits > 0) bytes.push(acc & 0xff);
    for (let i = 0; i < bytes.length; i += 255) {
      const chunk = bytes.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0x00);
  }
  out.push(0x3b);
  return Buffer.from(out);
}

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 20 } } }).png().toBuffer();

// ── Sniffing ───────────────────────────────────────────────────────────────────────────────────────

test('the type comes from the bytes, and SVG / HTML / junk are refused', async () => {
  assert.equal(sniffImageType(await png(80, 80)), 'png');
  assert.equal(sniffImageType(await sharp(await png(80, 80)).jpeg().toBuffer()), 'jpeg');
  assert.equal(sniffImageType(await sharp(await png(80, 80)).webp().toBuffer()), 'webp');
  assert.equal(sniffImageType(gif(80, 80, 1)), 'gif');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImageType(Buffer.from('<!doctype html><html><body>hi</body></html>')), null);
  assert.equal(sniffImageType(Buffer.from('GIF8')), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
});

test('header checks: polyglots, size bounds, frame count and the pixel budget', () => {
  const ok = { format: 'gif', width: 256, frameHeight: 256, frames: 10 };
  assert.equal(checkMediaHeader('avatar', 'gif', ok), null);
  assert.match(checkMediaHeader('avatar', 'png', ok)!, /not the image/);
  assert.match(checkMediaHeader('avatar', 'gif', { ...ok, width: 4000 })!, /too large/);
  assert.match(checkMediaHeader('avatar', 'gif', { ...ok, width: 20, frameHeight: 20 })!, /too small/);
  assert.match(checkMediaHeader('avatar', 'gif', { ...ok, frames: 301 })!, /too many frames/);
  // 200 frames of 1000×1000 is under the frame cap but 200M pixels of decode.
  assert.match(checkMediaHeader('avatar', 'gif', { ...ok, width: 1000, frameHeight: 1000, frames: 200 })!, /too big to process/);
  assert.match(checkMediaHeader('banner', 'webp', { format: 'webp', width: 400, frameHeight: 100, frames: 1 })!, /too small/);
  assert.match(checkMediaHeader('banner', 'webp', { format: 'webp', width: undefined, frameHeight: 100, frames: 1 })!, /no size/);
});

// ── Re-encoding ────────────────────────────────────────────────────────────────────────────────────

test('an animated GIF avatar becomes an animated WebP plus a first-frame still, both 256 square', async () => {
  const r = await processProfileMedia(gif(96, 96, 4), 'avatar', true);
  assert.ok(r.ok, !r.ok ? r.error : '');
  if (!r.ok) return;
  assert.equal(r.frames, 4);
  assert.ok(r.animated);
  const anim = await sharp(r.animated!).metadata();
  assert.equal(anim.format, 'webp');
  assert.equal(anim.pages, 4);
  assert.equal(anim.width, 256);
  assert.equal(anim.pageHeight ?? anim.height, 256);
  const still = await sharp(r.still).metadata();
  assert.equal(still.format, 'webp');
  assert.equal(still.pages ?? 1, 1);
  assert.equal(still.width, 256);
  assert.equal(still.height, 256);
});

test('without motion allowed, only the still is produced', async () => {
  const r = await processProfileMedia(gif(96, 96, 3), 'avatar', false);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.animated, null);
});

test('a still image has no animated copy; a banner keeps its shape and is never enlarged', async () => {
  const r = await processProfileMedia(await png(900, 300), 'banner', true);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.animated, null);
  assert.equal(r.width, 900);
  assert.equal(r.height, 300);
  const big = await processProfileMedia(await png(3000, 1000), 'banner', true);
  assert.ok(big.ok);
  if (big.ok) assert.deepEqual([big.width, big.height], [1500, 500]);
});

test('metadata is stripped: EXIF on a JPEG does not survive', async () => {
  const withExif = await sharp(await png(200, 200))
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'secret-home-address' } } })
    .toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif, 'fixture should carry EXIF');
  const r = await processProfileMedia(withExif, 'avatar', true);
  assert.ok(r.ok);
  if (!r.ok) return;
  const m = await sharp(r.still).metadata();
  assert.equal(m.exif, undefined);
  assert.equal(r.still.includes(Buffer.from('secret-home-address')), false);
});

test('refused: SVG, oversize bytes, a lying header, a decompression bomb, a frame bomb', async () => {
  const svg = await processProfileMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'), 'avatar', true);
  assert.equal(svg.ok, false);

  const tooBig = Buffer.concat([gif(64, 64, 1), Buffer.alloc(MEDIA_LIMITS.avatar.maxBytes)]);
  const r1 = await processProfileMedia(tooBig, 'avatar', true);
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.match(r1.error, /too large/);

  // PNG magic, then garbage: the decoder cannot read it.
  const liar = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('this is not a png at all, honest')]);
  assert.equal((await processProfileMedia(liar, 'avatar', true)).ok, false);

  // A few hundred bytes claiming 20000×20000: refused from the header, never decoded.
  const bomb = gif(20000, 20000, 1, { pixels: false });
  assert.ok(bomb.length < 1000);
  const r2 = await processProfileMedia(bomb, 'banner', true);
  assert.equal(r2.ok, false);

  // 250 frames of 1000×1000 is a small file and 250M pixels of decode.
  const frames = gif(1000, 1000, 250, { pixels: false });
  const r3 = await processProfileMedia(frames, 'avatar', true);
  assert.equal(r3.ok, false);
  if (!r3.ok) assert.match(r3.error, /too big to process/);
});

// ── Tier gates on read ─────────────────────────────────────────────────────────────────────────────

test('own pictures and motion are Champion and Patron', () => {
  assert.equal(canUseProfileMedia(null), false);
  assert.equal(canUseProfileMedia('supporter'), false);
  assert.equal(canUseProfileMedia('champion'), true);
  assert.equal(canUseProfileMedia('patron'), true);
});

test('only our own profile objects are ever rendered', () => {
  assert.equal(isProfileMediaUrl(ours(UUID), BASE), true);
  assert.equal(isProfileMediaUrl(`https://abc.public.blob.vercel-storage.com/profiles/3/${UUID}-Xy12.webp`, BASE), false, 'not our store');
  assert.equal(isProfileMediaUrl(`https://evil.example.net/profiles/7/${UUID}.webp`, BASE), false);
  assert.equal(isProfileMediaUrl(`${ours(UUID)}?track=1`, BASE), false);
  assert.equal(isProfileMediaUrl(`${BASE}/submissions/${UUID}.webp`, BASE), false);
  assert.equal(isProfileMediaUrl(`${BASE}/profiles/7/${UUID}.svg`, BASE), false);
  assert.equal(isProfileMediaUrl(`javascript:alert(1)//${ours(UUID)}`, BASE), false);
  assert.equal(isProfileMediaUrl(`http://media.example.com/profiles/7/${UUID}.webp`, BASE), false);
  assert.equal(isProfileMediaUrl(null, BASE), false);
});

test('a Champion shows the animation; a lapsed one, a list, and anything foreign fall back', () => {
  const row = { avatarUrl: ours(UUID), avatarStillUrl: ours(UUID2), bannerUrl: ours(UUID), bannerStillUrl: ours(UUID2), bannerPosition: 30 };
  const champ = shownProfileMedia(row, 'champion', { publicBase: BASE });
  assert.deepEqual(champ.avatar, { src: ours(UUID), still: ours(UUID2), animated: true });
  assert.equal(champ.banner?.position, 30);

  // Lapsed to Supporter, or no tier at all: the still frame, nothing deleted.
  for (const tier of ['supporter', null] as const) {
    const s = shownProfileMedia(row, tier, { publicBase: BASE });
    assert.deepEqual(s.avatar, { src: ours(UUID2), still: ours(UUID2), animated: false });
    assert.equal(s.banner?.animated, false);
  }

  // A list asks for the still even for a Patron.
  assert.equal(shownProfileMedia(row, 'patron', { still: true, publicBase: BASE }).avatar?.animated, false);

  // A hand-edited row pointing elsewhere renders nothing; a bad focus re-centres.
  const foreign = shownProfileMedia({ ...row, avatarStillUrl: 'https://tracker.example/p.gif', bannerPosition: 900 }, 'patron', { publicBase: BASE });
  assert.equal(foreign.avatar, null);
  assert.equal(foreign.banner?.position, 50);
  // A foreign animated URL with a good still shows the still.
  const half = shownProfileMedia({ ...row, avatarUrl: 'https://tracker.example/p.gif' }, 'patron', { publicBase: BASE });
  assert.deepEqual(half.avatar, { src: ours(UUID2), still: ours(UUID2), animated: false });
  assert.deepEqual(shownProfileMedia(null, 'patron'), { avatar: null, banner: null });
});

test('display case: 4 / 8 / 12 slots, a lapse keeps the first N and hides the rest', () => {
  assert.equal(displayCaseSlots(null), 0);
  assert.equal(displayCaseSlots('supporter'), 4);
  assert.equal(displayCaseSlots('champion'), 8);
  assert.equal(displayCaseSlots('patron'), 12);
  const pins = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, position: 11 - i }));
  assert.deepEqual(visiblePins(pins, 'supporter').map((p) => p.position), [0, 1, 2, 3]);
  assert.equal(visiblePins(pins, 'champion').length, 8);
  assert.equal(visiblePins(pins, 'patron').length, 12);
  assert.deepEqual(visiblePins(pins, null), []);
});
