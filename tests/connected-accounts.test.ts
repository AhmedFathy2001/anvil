// Connected accounts — the pure half: Medal profile parsing and its verification code, the URLs a
// profile chip may link to, who sees which links, the live badges (batched + cached, against a mocked
// Helix and Kick), the Medal API client, and YouTube's settings ('link') OAuth state.
//
// Run: npm run test:connected-accounts

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanHandle,
  creditsName,
  kickSlugFor,
  kickUrl,
  medalCode,
  medalUrl,
  parseMedalProfile,
  resolveShowOnProfile,
  titleHasCode,
  twitchUrl,
  visibleLinks,
  youtubeUrl,
  type ConnectedLink,
} from '../src/lib/connectedAccountsRules.ts';
import { LIVE_TTL_MS, kickLive, liveCache, setLiveFetchForTests, twitchLive } from '../src/lib/connectedLive.ts';
import { latestClips, medalApiKey } from '../src/lib/medal.ts';
import { signState, verifyState } from '../src/lib/gates/youtube.ts';

test('Medal profile input: links and bare ids/names on medal.tv only; everything else refused', () => {
  assert.deepEqual(parseMedalProfile('https://medal.tv/users/12345'), { userId: '12345', username: null });
  assert.deepEqual(parseMedalProfile('medal.tv/users/12345/clips'), { userId: '12345', username: null });
  assert.deepEqual(parseMedalProfile('https://www.medal.tv/en/users/987'), { userId: '987', username: null });
  assert.deepEqual(parseMedalProfile('https://medal.tv/u/Some_Clipper'), { userId: null, username: 'Some_Clipper' });
  assert.deepEqual(parseMedalProfile('4242'), { userId: '4242', username: null });
  assert.deepEqual(parseMedalProfile('@clipper.one'), { userId: null, username: 'clipper.one' });
  for (const bad of [
    'https://evil.com/users/1',
    'https://medal.tv.evil.com/u/x',
    'https://user:pw@medal.tv/u/x',
    'https://medal.tv:8443/u/x',
    'javascript:alert(1)',
    'https://medal.tv/u/<script>',
    'https://medal.tv/games/osrs',
    'medal.tv/u/a b',
    'x'.repeat(201),
    '',
    null,
    42,
  ]) {
    assert.equal(parseMedalProfile(bad), null, String(bad));
  }
});

test('profile URLs are built on the platform host from sanitized ids, never from raw input', () => {
  assert.equal(twitchUrl('viewerone'), 'https://www.twitch.tv/viewerone');
  assert.equal(twitchUrl('Bad/Login'), null);
  assert.equal(youtubeUrl('UC1234567890123456789012'), 'https://www.youtube.com/channel/UC1234567890123456789012');
  assert.equal(youtubeUrl('../evil'), null);
  assert.equal(kickSlugFor('Big_Streamer'), 'big-streamer');
  assert.equal(kickSlugFor('has space'), null);
  assert.equal(kickUrl('big-streamer'), 'https://kick.com/big-streamer');
  assert.equal(kickUrl(null), null);
  assert.equal(medalUrl({ medalUserId: '55', medalUsername: null }), 'https://medal.tv/users/55');
  assert.equal(medalUrl({ medalUserId: '55', medalUsername: 'clipper' }), 'https://medal.tv/u/clipper');
  assert.equal(medalUrl({ medalUserId: 'x', medalUsername: '"><img' }), null);
  // Display names: control, zero-width and bidi characters stripped, capped.
  assert.equal(cleanHandle('ab‮cd​\u0007e'), 'abcde');
  assert.equal(cleanHandle('x'.repeat(100), 10).length, 10);
});

const link = (platform: ConnectedLink['platform'], verified: boolean, stored?: boolean): ConnectedLink => ({
  platform,
  handle: platform,
  url: null,
  verified,
  showOnProfile: resolveShowOnProfile(stored, verified),
  platformId: '1',
});

test('who sees which link: default on for verified, off for unverified; the owner sees everything', () => {
  const links = [link('twitch', true), link('youtube', true, false), link('kick', true), link('medal', false)];
  assert.deepEqual(
    visibleLinks(links, false).map((l) => l.platform),
    ['twitch', 'kick'],
  );
  assert.equal(visibleLinks(links, true).length, 4);
  // An unverified Medal link the person chose to show is shown (the chip labels it "not verified").
  assert.deepEqual(
    visibleLinks([link('medal', false, true)], false).map((l) => l.platform),
    ['medal'],
  );
});

test('Medal code: stable per (login, Medal id), different otherwise; found in a title only as a whole token', () => {
  const c = medalCode(7, '123', 'k'.repeat(40));
  assert.match(c, /^ANVIL-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  assert.equal(medalCode(7, '123', 'k'.repeat(40)), c);
  assert.notEqual(medalCode(8, '123', 'k'.repeat(40)), c);
  assert.notEqual(medalCode(7, '124', 'k'.repeat(40)), c);
  assert.equal(titleHasCode(`insane drop ${c.toLowerCase()} gg`, c), true);
  assert.equal(titleHasCode(`${c}X`, c), false);
  assert.equal(titleHasCode('nothing here', c), false);
  assert.equal(creditsName('Credits to Clipper (https://medal.tv/users/123)', '123'), 'Clipper');
  assert.equal(creditsName('Credits to Clipper (https://medal.tv/users/999)', '123'), null);
});

test('Medal API: fixed host, key in Authorization, bad ids never sent', async () => {
  assert.equal(medalApiKey({ MEDAL_API_KEY: 'pub_abcdefgh' }), 'pub_abcdefgh');
  assert.equal(medalApiKey({ MEDAL_API_KEY: 'has space in it' }), null);
  assert.equal(medalApiKey({}), null);
  const seen: string[] = [];
  const f = async (url: string, init?: RequestInit) => {
    seen.push(url);
    assert.equal(new Headers(init?.headers).get('authorization'), 'pub_key123');
    return new Response(JSON.stringify({ contentObjects: [{ contentTitle: 'hi', credits: 'Credits to A (https://medal.tv/users/5)' }] }), { status: 200 });
  };
  const r = await latestClips('pub_key123', '5', 10, f);
  assert.deepEqual(r, { ok: true, value: [{ title: 'hi', credits: 'Credits to A (https://medal.tv/users/5)' }] });
  assert.equal(new URL(seen[0]).origin, 'https://developers.medal.tv');
  assert.deepEqual(await latestClips('pub_key123', '5&x=1', 10, f), { ok: false, reason: 'not-found' });
  assert.equal(seen.length, 1);
  const r401 = await latestClips('pub_key123', '5', 10, async () => new Response('{}', { status: 401 }));
  assert.deepEqual(r401, { ok: false, reason: 'unauthorized' });
});

// ── Live badges ──────────────────────────────────────────────────────────────────────────────────

const ENV = { TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec', KICK_CLIENT_ID: 'kid', KICK_CLIENT_SECRET: 'ksec' };
const calls = { token: 0, helix: [] as string[], kick: [] as string[], helixStatus: 200 };

beforeEach(() => {
  calls.token = 0;
  calls.helix = [];
  calls.kick = [];
  calls.helixStatus = 200;
  setLiveFetchForTests(async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    if (u.pathname === '/oauth2/token' || u.pathname === '/oauth/token') {
      calls.token++;
      assert.equal(new URLSearchParams(String(init?.body)).get('grant_type'), 'client_credentials');
      return new Response(JSON.stringify({ access_token: `app-${calls.token}`, expires_in: 3600 }), { status: 200 });
    }
    if (u.hostname === 'api.twitch.tv') {
      calls.helix.push(u.searchParams.getAll('user_id').join(','));
      assert.equal(new Headers(init?.headers).get('client-id'), 'cid');
      if (calls.helixStatus !== 200) return new Response('{}', { status: calls.helixStatus });
      return new Response(JSON.stringify({ data: [{ user_id: '2', type: 'live' }] }), { status: 200 });
    }
    if (u.hostname === 'api.kick.com') {
      calls.kick.push(u.searchParams.getAll('broadcaster_user_id').join(','));
      return new Response(
        JSON.stringify({ data: [{ broadcaster_user_id: 77, slug: 'Real-Slug', stream: { is_live: true } }, { broadcaster_user_id: 78, slug: 'other', stream: { is_live: false } }] }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});

test('Twitch live: one batched Helix call for every id on the page, then cached for a minute', async () => {
  const a = await twitchLive(['1', '2', '3', 'not-an-id'], ENV);
  assert.deepEqual([...a.entries()].sort(), [['1', false], ['2', true], ['3', false]]);
  assert.deepEqual(calls.helix, ['1,2,3']);
  assert.equal(calls.token, 1);
  // Again within the TTL: nothing asked. A new id: only that one.
  await twitchLive(['1', '2', '3'], ENV);
  assert.deepEqual(calls.helix, ['1,2,3']);
  const b = await twitchLive(['2', '4'], ENV);
  assert.equal(b.get('2'), true);
  assert.deepEqual(calls.helix, ['1,2,3', '4']);
  assert.equal(calls.token, 1, 'the app token is reused');
  // After the TTL the cache answers nothing.
  assert.equal(liveCache.get('twitch:2', Date.now() + LIVE_TTL_MS + 1), undefined);
});

test('Twitch live: a 401 refreshes the app token once; an outage is "not live" and cached, never a throw', async () => {
  calls.helixStatus = 401;
  const r = await twitchLive(['9'], ENV);
  assert.equal(r.get('9'), false);
  assert.equal(calls.token, 2, 'one refresh after the 401');
  assert.equal(calls.helix.length, 2);
  calls.helixStatus = 500;
  await twitchLive(['9'], ENV);
  assert.equal(calls.helix.length, 2, 'the failure was cached');
  // Not configured: no network at all.
  const off = await twitchLive(['10'], {});
  assert.equal(off.get('10'), false);
  assert.equal(calls.helix.length, 2);
});

test('Kick live: batched, carries the real slug, cached', async () => {
  const r = await kickLive(['77', '78', '79'], ENV);
  assert.deepEqual(r.get('77'), { live: true, slug: 'real-slug' });
  assert.deepEqual(r.get('78'), { live: false, slug: 'other' });
  assert.deepEqual(r.get('79'), { live: false, slug: null });
  await kickLive(['77'], ENV);
  assert.deepEqual(calls.kick, ['77,78,79']);
});

test('YouTube OAuth state: the settings "link" mode carries no event; viewer/host still need one', () => {
  const key = 'y'.repeat(40);
  const base = { u: 5, r: '/settings/connections', h: null, n: 'n'.repeat(20), e: Date.now() + 60_000 };
  assert.equal(verifyState(signState({ ...base, m: 'link', c: 0 }, key), key)?.m, 'link');
  assert.equal(verifyState(signState({ ...base, m: 'link', c: 12 }, key), key), null);
  assert.equal(verifyState(signState({ ...base, m: 'viewer', c: 0 }, key), key), null);
  assert.equal(verifyState(signState({ ...base, m: 'viewer', c: 12 }, key), key)?.c, 12);
});
