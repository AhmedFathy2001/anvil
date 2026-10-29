// Which event posts reach which server, and who they ping (lib/discordPostPolicy).
//
// Run: node --experimental-strip-types --test tests/discord-post-policy.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DISCORD_POST_TYPES,
  decideHostPost,
  decidePartnerPost,
  detectPreset,
  isPaused,
  parseClanPostDefaults,
  parseEventDiscordPrefs,
  parsePartnerDiscordPrefs,
  presetPosts,
} from '../src/lib/discordPostPolicy.ts';

const noClan = parseClanPostDefaults(null);
const now = new Date('2026-11-01T12:00:00Z');

test('with nothing stored every post is on and pings exactly as before', () => {
  for (const t of DISCORD_POST_TYPES) {
    const d = decideHostPost(t.key, noClan, {}, now);
    assert.equal(d.send, true, t.key);
    assert.equal(d.ping, t.ping ? 'members' : 'none', t.key);
  }
});

test('the event overrides the clan, and Default follows the clan', () => {
  const clan = parseClanPostDefaults('{"posts":{"digest":false},"pings":{"eventStart":"players"}}');
  assert.equal(decideHostPost('digest', clan, {}, now).send, false);
  assert.equal(decideHostPost('digest', clan, { posts: { digest: 'on' } }, now).send, true);
  assert.equal(decideHostPost('eventStart', clan, {}, now).ping, 'players');
  assert.equal(decideHostPost('eventStart', clan, { pings: { eventStart: 'none' } }, now).ping, 'none');
  assert.equal(decideHostPost('tileComplete', clan, { posts: { tileComplete: 'off' } }, now).send, false);
});

test('a muted post never pings', () => {
  assert.deepEqual(decideHostPost('eventStart', noClan, { posts: { eventStart: 'off' } }, now), { send: false, ping: 'none' });
});

test('pause silences everything until it lapses', () => {
  const until = { pausedUntil: '2026-11-02T00:00:00Z' };
  assert.equal(isPaused(until, now), true);
  assert.equal(decideHostPost('eventStart', noClan, until, now).send, false);
  assert.equal(isPaused(until, new Date('2026-11-03T00:00:00Z')), false);
  assert.equal(isPaused({ pausedUntil: 'indefinite' }, now), true);
});

test('partners: an event-level off is off everywhere, and they never see more than the host shares', () => {
  const host = decideHostPost('tileComplete', noClan, {}, now);
  assert.equal(decidePartnerPost('tileComplete', host, {}, {}).send, true);
  assert.equal(decidePartnerPost('tileComplete', host, { partnerShare: 'big' }, {}).send, false);
  assert.equal(decidePartnerPost('teamWin', decideHostPost('teamWin', noClan, {}, now), { partnerShare: 'big' }, {}).send, true);
  assert.equal(decidePartnerPost('tileComplete', host, { cohosts: false }, {}).send, false);
  assert.equal(decidePartnerPost('tileComplete', host, { partnerShare: 'none' }, {}).send, false);
  const off = decideHostPost('tileComplete', noClan, { posts: { tileComplete: 'off' } }, now);
  assert.equal(decidePartnerPost('tileComplete', off, {}, {}).send, false);
});

test('partners pick less: preset, groups off, and their own ping', () => {
  const start = decideHostPost('eventStart', noClan, {}, now);
  assert.equal(decidePartnerPost('eventStart', start, {}, { preset: 'off' }).send, false);
  assert.equal(decidePartnerPost('eventStart', start, {}, { preset: 'big' }).send, true);
  assert.equal(decidePartnerPost('digest', decideHostPost('digest', noClan, {}, now), {}, { preset: 'big' }).send, false);
  assert.equal(decidePartnerPost('eventStart', start, {}, { groupsOff: ['life'] }).send, false);
  assert.equal(decidePartnerPost('eventStart', start, {}, { ping: 'players' }).ping, 'players');
  assert.equal(decidePartnerPost('digest', decideHostPost('digest', noClan, {}, now), {}, { ping: 'players' }).ping, 'none');
});

test('host-only posts never reach partners', () => {
  const d = decideHostPost('payouts', noClan, {}, now);
  assert.equal(decidePartnerPost('payouts', d, {}, {}).send, false);
});

test('presets round-trip', () => {
  assert.equal(detectPreset(presetPosts('clan')), 'clan');
  assert.equal(detectPreset(presetPosts('quiet')), 'quiet');
  assert.equal(detectPreset(presetPosts('silent')), 'silent');
  assert.equal(detectPreset({ digest: 'off' }), 'custom');
});

test('parsers drop junk', () => {
  assert.deepEqual(parseEventDiscordPrefs({ posts: { digest: 'off', nope: 'off', start: 'maybe' }, webhookUrl: 'http://x', cleanup: { mode: 'after', days: 500 } }), {
    posts: { digest: 'off' },
    cleanup: { mode: 'after', days: 90 },
  });
  assert.deepEqual(parsePartnerDiscordPrefs({ preset: 'big', groupsOff: ['life', 'life', 'x'], ping: 'all' }), { preset: 'big', groupsOff: ['life'] });
  assert.deepEqual(parseClanPostDefaults('nope'), { posts: {}, pings: {} });
});

test('roles: event beats clan beats the old behaviour', async () => {
  const { resolveEventRoles, parseClanEventRoleDefaults, cleanupDueAt } = await import('../src/lib/discordPostPolicy.ts');
  const none = parseClanEventRoleDefaults(null);
  assert.deepEqual(resolveEventRoles(none, {}, true), { teamChannels: true, playerRole: 'draft', cleanup: { mode: 'never', days: 7 }, removePlayerRoleAtEnd: false });
  assert.equal(resolveEventRoles(none, { teamChannels: 'off' }, true).teamChannels, false);
  assert.equal(resolveEventRoles(none, { teamChannels: 'on' }, false).teamChannels, true);
  const clan = parseClanEventRoleDefaults('{"playerRole":"approve","cleanup":{"mode":"after","days":3}}');
  const r = resolveEventRoles(clan, {}, true);
  assert.equal(r.playerRole, 'approve');
  assert.equal(cleanupDueAt(r, '2026-11-01T00:00:00Z'), Date.parse('2026-11-04T00:00:00Z'));
  assert.equal(resolveEventRoles(clan, { cleanup: { mode: 'end' } }, true).cleanup.mode, 'end');
  assert.equal(cleanupDueAt(resolveEventRoles(none, {}, true), '2026-11-01T00:00:00Z'), null);
});
