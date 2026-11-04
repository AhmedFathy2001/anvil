// Creator page promotions (lib/spacePage/rules), the pure half: the link policy (https only, the
// blocklist with subdomains, shorteners, trade-spelling host names), the wording check, linkify,
// clip links, text cleaning, the schedule's time maths across DST, and the seed list matching the
// migration that installs it.
//
// Run: npm run test:creator-panels

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as R from '../src/lib/spacePage/rules.ts';
import { BLOCKLIST_SEED } from '../src/lib/spacePage/blocklistSeed.ts';

const SEED = BLOCKLIST_SEED.map((s) => s.domain);

test('links: blocked domains and their subdomains are refused', () => {
  for (const url of [
    'https://stake.com',
    'https://www.stake.com/casino',
    'https://promo.stake.us/x',
    'https://www.playerauctions.com/osrs-gold/',
    'https://dreambot.org/',
    'https://forums.rune-server.ee/',
    'https://STAKE.COM.',
  ]) {
    const r = R.checkLink(url, SEED);
    assert.equal(r.ok, false, url);
    if (!r.ok) assert.match(r.error, /Jagex's rules/);
  }
});

test('links: a lookalike that only ends with a blocked name is not blocked by it', () => {
  // "mistake.com" ends with "stake.com" but is not it, nor a subdomain of it.
  assert.equal(R.checkLink('https://mistake.com/', SEED).ok, true);
  assert.equal(R.blockedBy('notstake.com', SEED), null);
  assert.equal(R.blockedBy('a.b.stake.com', SEED), 'stake.com');
});

test('links: shorteners and link hubs are refused, so the list cannot be routed around', () => {
  for (const url of ['https://bit.ly/abc', 'https://tinyurl.com/x', 'https://t.co/x', 'https://cutt.ly/x']) {
    assert.equal(R.checkLink(url, SEED).ok, false, url);
  }
});

test('links: non-https, IPs, ports, credentials and bare hosts are refused', () => {
  for (const url of [
    'http://twitch.tv/me',
    'javascript:alert(1)',
    'data:text/html,hi',
    'ftp://example.com',
    'https://1.2.3.4/x',
    'https://[::1]/x',
    'https://example.com:8443/x',
    'https://user:pw@example.com/',
    'https://localhost/',
    'https://intranet/',
    'not a url',
  ]) {
    assert.equal(R.checkLink(url, SEED).ok, false, url);
  }
});

test('links: host names that spell out the trade are refused without being listed', () => {
  for (const host of ['osrs-gold-shop.net', 'buyrsgold.com', 'best-rsps.org', 'rs3gold.com', 'osrsdice.gg', 'cheap-osrs-accounts.com', 'osrsbots.io']) {
    assert.equal(R.suspiciousDomain(host), true, host);
    assert.equal(R.checkLink(`https://${host}/`, []).ok, false, host);
  }
  for (const host of ['hoursgold.com', 'twitch.tv', 'runelite.net', 'oldschool.runescape.wiki', 'secure.runescape.com', 'discord.gg']) {
    assert.equal(R.suspiciousDomain(host), false, host);
  }
});

test('links: ordinary creator links pass', () => {
  for (const url of [
    'https://twitch.tv/someone',
    'https://www.youtube.com/@someone',
    'https://kick.com/someone',
    'https://discord.gg/abcdef',
    'https://runelite.net/',
    'https://oldschool.runescape.wiki/w/Bingo',
    'https://x.com/someone',
  ]) {
    const r = R.checkLink(url, SEED);
    assert.equal(r.ok, true, url);
  }
});

test('wording: obvious RWT, services, bots, private servers, gambling and fake giveaways are refused', () => {
  const bad = [
    'Buy OSRS gold here',
    'cheap gp, fast delivery',
    'g0ld for sale',
    'Accounts for sale — DM me',
    'Selling maxed account',
    'Infernal cape service',
    'Fire cape service, any stats',
    'boosting service available',
    'PKing for hire',
    'account sharing welcome',
    'Best b0tting scripts',
    'osrs bot client',
    'macro all day',
    'Join our R.S.P.S',
    'my private server',
    'stake with me',
    'Dicing tonight',
    'flower poker hosts',
    'casino night',
    'gambling streams',
    'Free bonds! log in to claim',
    'free membership giveaway',
    'real world trading',
    'rwt',
  ];
  for (const s of bad) {
    const e = R.wordingError(s);
    assert.ok(e, s);
    assert.match(e!, /^Promotions must follow Jagex's rules/);
  }
});

test('wording: ordinary creator text passes', () => {
  for (const s of [
    'Bingo every Friday with chat!',
    'Our Discord bot posts the board — the Anvil bot too.',
    'High stakes raids with viewers',
    'Ironman account progress, 2000 total',
    'I use RuneLite and the Anvil plugin',
    'Giveaways for subs (in-game items from my own bank)',
    'Clan events, PvM and skilling',
  ]) {
    assert.equal(R.wordingError(s), null, s);
  }
});

test('text links: a blocked site named in plain text is refused, an allowed one is fine', () => {
  assert.ok(R.contentError('come play at stake.com', SEED));
  assert.ok(R.contentError('see https://bit.ly/x', SEED));
  assert.ok(R.contentError('see http://sub.playerauctions.com', SEED));
  assert.equal(R.contentError('join us at discord.gg/abc and twitch.tv/me', SEED), null);
});

test('linkify: only https links that pass become links; everything else stays text', () => {
  const seg = R.linkify('Watch https://twitch.tv/me. Not https://stake.com/x or http://example.com <b>hi</b>', SEED);
  const links = seg.filter((s) => s.href);
  assert.deepEqual(
    links.map((s) => s.href),
    ['https://twitch.tv/me'],
  );
  // Everything is preserved as text, markup included (rendered as text nodes, never HTML).
  assert.equal(seg.map((s) => s.text).join(''), 'Watch https://twitch.tv/me. Not https://stake.com/x or http://example.com <b>hi</b>');
});

test('text cleaning: limits refused not cut, control and invisible characters gone, line breaks kept', () => {
  assert.equal(R.cleanText('x'.repeat(41), R.PANEL_TITLE_MAX).ok, false);
  const t = R.cleanText('  Hello​‮ world\u0007  ', R.PANEL_TITLE_MAX);
  assert.deepEqual(t, { ok: true, value: 'Hello world' });
  const b = R.cleanText('line one\r\nline two\n\n\n\nline three', R.PANEL_BODY_MAX, { multiline: true });
  assert.deepEqual(b, { ok: true, value: 'line one\nline two\n\nline three' });
  // Single-line fields lose their line breaks.
  assert.deepEqual(R.cleanText('a\nb', 40), { ok: true, value: 'a b' });
  // Zero-width characters cannot hide a phrase from the check.
  assert.ok(R.wordingError('r​s​p​s'));
});

test('clip links: exact clip/video shapes only, rebuilt canonically from their ids', () => {
  for (const [url, canonical, platform] of [
    ['https://clips.twitch.tv/SomeClip-abc?tt_medium=x&url=https://stake.com', 'https://clips.twitch.tv/SomeClip-abc', 'twitch'],
    ['https://m.twitch.tv/me/clip/Abc-123?redirect=https://stake.com#t', 'https://www.twitch.tv/me/clip/Abc-123', 'twitch'],
    ['https://www.twitch.tv/videos/123456789?t=1h2m', 'https://www.twitch.tv/videos/123456789', 'twitch'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x&q=https://stake.com', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ?feature=share', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://kick.com/me/clips/clip_01ABC?ref=x', 'https://kick.com/me/clips/clip_01ABC', 'kick'],
    ['https://kick.com/me/videos/123e4567-e89b-12d3-a456-426614174000', 'https://kick.com/me/videos/123e4567-e89b-12d3-a456-426614174000', 'kick'],
    ['https://medal.tv/games/old-school-runescape/clips/abcDEF123/some-title?invite=x', 'https://medal.tv/games/old-school-runescape/clips/abcDEF123', 'medal'],
    ['https://medal.tv/clips/abcDEF123', 'https://medal.tv/clips/abcDEF123', 'medal'],
  ] as const) {
    const r = R.checkClipUrl(url, SEED);
    assert.equal(r.ok, true, url);
    if (r.ok) assert.deepEqual(r.value, { url: canonical, platform }, url);
  }
});

test('clip links: open redirects, other paths, other hosts and non-https are refused', () => {
  for (const url of [
    // The platforms' own redirectors, and pages that are not a clip or video.
    'https://www.youtube.com/redirect?q=https://stake.com',
    'https://www.youtube.com/attribution_link?u=/watch%3Fv%3DdQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=bad',
    'https://www.youtube.com/@channel',
    'https://www.twitch.tv/me',
    'https://www.twitch.tv/me?url=https://stake.com',
    'https://twitch.tv/me/clip/x/../../redirect',
    'https://clips.twitch.tv/a/b',
    'https://kick.com/me',
    'https://kick.com/me/videos/not-a-uuid',
    'https://medal.tv/redirect?url=https://stake.com',
    'https://medal.tv/games/x',
    // Wrong scheme, port, host.
    'http://clips.twitch.tv/x',
    'https://medal.tv:444/clips/abc',
    'https://stake.com/clip',
    'https://bit.ly/x',
    'https://twitch.tv.evil.com/me/clip/x',
    'https://youtube.com',
  ]) {
    assert.equal(R.checkClipUrl(url, SEED).ok, false, url);
  }
  // The canonical URL still goes through the blocklist: block a platform and its clips go too.
  assert.equal(R.checkClipUrl('https://medal.tv/clips/abc', ['medal.tv']).ok, false);
});

test('schedule: the next start, across the London DST change', () => {
  const tz = 'Europe/London';
  const sun19 = { weekday: 0, minuteOfDay: 19 * 60 };
  // Winter: 19:00 GMT = 19:00 UTC.
  assert.equal(new Date(R.nextSlotStart(sun19, tz, Date.UTC(2026, 2, 21, 12))).toISOString(), '2026-03-22T19:00:00.000Z');
  // Sunday 29 March 2026 is the change day itself: 19:00 BST = 18:00 UTC.
  assert.equal(new Date(R.nextSlotStart(sun19, tz, Date.UTC(2026, 2, 26, 12))).toISOString(), '2026-03-29T18:00:00.000Z');
  // And back in autumn (25 October 2026): 19:00 GMT again.
  assert.equal(new Date(R.nextSlotStart(sun19, tz, Date.UTC(2026, 9, 24, 12))).toISOString(), '2026-10-25T19:00:00.000Z');
});

test('schedule: a slot in a time that does not exist on the spring-forward day still lands once', () => {
  // 02:30 on 8 March 2026 does not exist in New York (02:00 → 03:00). It must still produce one start
  // on that day, an hour either side, not vanish or slide a day.
  const at = R.nextSlotStart({ weekday: 0, minuteOfDay: 150 }, 'America/New_York', Date.UTC(2026, 2, 7, 12));
  const d = new Date(at);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 2);
  assert.ok(d.getUTCDate() === 8, d.toISOString());
  assert.ok(at >= Date.UTC(2026, 2, 8, 6, 30) && at <= Date.UTC(2026, 2, 8, 7, 30), d.toISOString());
});

test('schedule: shown in the viewer’s zone — the day moves when the clock does', () => {
  const tz = 'Europe/London';
  // Tuesday 23:00 in London (winter) is Wednesday 08:00 in Tokyo and Tuesday 18:00 in New York.
  const at = R.nextSlotStart({ weekday: 2, minuteOfDay: 23 * 60 }, tz, Date.UTC(2026, 0, 5, 12));
  assert.equal(new Date(at).toISOString(), '2026-01-06T23:00:00.000Z');
  assert.equal(R.formatSlotTime(at, 'Asia/Tokyo'), 'Wed 8:00 AM');
  assert.equal(R.formatSlotTime(at, 'America/New_York'), 'Tue 6:00 PM');
  assert.equal(R.formatSlotTime(at, 'Europe/London'), 'Tue 11:00 PM');
});

test('schedule: a stream that started within the grace window stays "this one"', () => {
  const tz = 'UTC';
  const now = Date.UTC(2026, 0, 6, 20, 0); // Tuesday 20:00
  assert.equal(R.nextSlotStart({ weekday: 2, minuteOfDay: 19 * 60 }, tz, now), Date.UTC(2026, 0, 6, 19, 0));
  // Started more than two hours ago: next week's.
  assert.equal(R.nextSlotStart({ weekday: 2, minuteOfDay: 17 * 60 }, tz, now), Date.UTC(2026, 0, 13, 17, 0));
});

test('schedule: slots and zones are validated', () => {
  assert.equal(R.checkSlot({ weekday: 7, minuteOfDay: 0 }).ok, false);
  assert.equal(R.checkSlot({ weekday: 1, minuteOfDay: 1440 }).ok, false);
  assert.equal(R.checkSlot({ weekday: 1, minuteOfDay: 60, label: 'x'.repeat(41) }).ok, false);
  assert.deepEqual(R.checkSlot({ weekday: 1, minuteOfDay: 60, label: '  Bingo ' }), { ok: true, value: { weekday: 1, minuteOfDay: 60, label: 'Bingo' } });
  assert.equal(R.checkTimeZone('Mars/Olympus').ok, false);
  assert.equal(R.checkTimeZone('Europe/London').ok, true);
});

test('images: only this space’s own uploads on our media host', () => {
  const base = 'https://media.anvilosrs.com';
  const ok = `${base}/c/streamer/space/123e4567-e89b-12d3-a456-426614174000.webp`;
  assert.equal(R.isSpaceMediaUrl(ok, 'streamer', base), true);
  assert.equal(R.isSpaceMediaUrl(ok, 'other', base), false);
  assert.equal(R.isSpaceMediaUrl(`https://evil.com/c/streamer/space/123e4567-e89b-12d3-a456-426614174000.webp`, 'streamer', base), false);
  assert.equal(R.isSpaceMediaUrl(`${ok}?x=1`, 'streamer', base), false);
  assert.equal(R.isSpaceMediaUrl(`${base}/c/streamer/submissions/123e4567-e89b-12d3-a456-426614174000.webp`, 'streamer', base), false);
  // Any Vercel Blob store is somebody's — only OUR configured host counts.
  const blob = 'https://anyone.public.blob.vercel-storage.com/c/streamer/space/123e4567-e89b-12d3-a456-426614174000.webp';
  assert.equal(R.isSpaceMediaUrl(blob, 'streamer', base), false);
  // No media host configured: nothing is ours.
  assert.equal(R.isSpaceMediaUrl(ok, 'streamer', ''), false);
  // A lookalike host, or our host outside its base path.
  assert.equal(R.isSpaceMediaUrl(ok.replace('media.anvilosrs.com', 'media.anvilosrs.com.evil.net'), 'streamer', base), false);
  assert.equal(R.isSpaceMediaUrl(ok, 'streamer', `${base}/bucket`), false);
  // Only the exact key shape the upload route mints.
  assert.equal(R.isSpaceMediaUrl(`${base}/c/streamer/space/123e4567-e89b-12d3-a456-426614174000-x.webp`, 'streamer', base), false);
});

test('creator link hubs are allowed (owner, 2026-11-04): Linktree and beacons.ai', () => {
  assert.equal(R.checkLink('https://linktr.ee/someone', SEED).ok, true);
  assert.equal(R.checkLink('https://beacons.ai/someone', SEED).ok, true);
});

test('the seed list is exactly what migrations 0211 + 0212 leave installed', () => {
  // 0212 takes linktr.ee and beacons.ai back out of 0211's seed.
  const sql = readFileSync(new URL('../drizzle/0211_creator_panels.sql', import.meta.url), 'utf8')
    .replace("  ('linktr.ee', 'shortener'),\n", '')
    .replace("  ('beacons.ai', 'shortener'),\n", '');
  const inSql = [...sql.matchAll(/\('([a-z0-9.-]+)', '([a-z]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
  assert.deepEqual(inSql, BLOCKLIST_SEED.map((s) => `${s.domain}:${s.reason}`).sort());
  // Every seed entry is a normalised domain, once.
  assert.equal(new Set(SEED).size, SEED.length);
  for (const d of SEED) assert.equal(R.normalizeDomain(d), d, d);
});
