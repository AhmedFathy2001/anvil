// Reaching people: notices from Anvil (lib/noticeRules), the welcome DM (lib/welcomeDmText) and the
// plugin panel's "From Anvil" card (lib/pluginUi/homeUi noticeCard).
//
// The rules worth pinning: who a notice reaches, that links can only go to Anvil or Discord and never
// to a file, that the plugin card carries NO link of the notice's own (Plugin Hub review), and that
// the welcome says replies to the bot go nowhere and asks once about DMs.
//
// Run: npx tsx --test tests/reach-out.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  audienceKey,
  noticeBriefLine,
  noticeDmContent,
  noticeIsFor,
  noticeLive,
  parseAudience,
  parseFoundVia,
  safeNoticeLink,
  type ReaderFacts,
} from '../src/lib/noticeRules.ts';
import { DMS_NO, DMS_STOP, DMS_YES, choiceFor, choiceRow, welcomeMessage, welcomeText } from '../src/lib/welcomeDmText.ts';
import { noticeCard } from '../src/lib/pluginUi/homeUi.ts';

const HOSTS = ['anvilosrs.com'];
const reader = (over: Partial<ReaderFacts> = {}): ReaderFacts => ({ userId: 7, staffClanIds: [], tier: null, ...over });

test('audiences parse and round-trip', () => {
  for (const k of ['everyone', 'admins', 'supporters', 'tier:champion', 'tier:patron', 'clan:12', 'user:7']) {
    const a = parseAudience(k);
    assert.ok(a, k);
    assert.equal(audienceKey(a!), k);
  }
  assert.equal(audienceKey(parseAudience('tier:supporter')!), 'supporters');
  for (const bad of ['', 'clan:', 'clan:0', 'clan:-1', 'clan:1.5', 'user:abc', 'tier:gold', 'admin', 'clan:007']) {
    assert.equal(parseAudience(bad), null, bad);
  }
});

test('who a notice reaches', () => {
  const admin = reader({ staffClanIds: [12] });
  assert.equal(noticeIsFor(parseAudience('everyone')!, reader()), true);
  assert.equal(noticeIsFor(parseAudience('admins')!, reader()), false);
  assert.equal(noticeIsFor(parseAudience('admins')!, admin), true);
  assert.equal(noticeIsFor(parseAudience('clan:12')!, admin), true);
  assert.equal(noticeIsFor(parseAudience('clan:13')!, admin), false);
  assert.equal(noticeIsFor(parseAudience('user:7')!, reader()), true);
  assert.equal(noticeIsFor(parseAudience('user:8')!, reader()), false);
  // Tiers are "this or better".
  assert.equal(noticeIsFor(parseAudience('supporters')!, reader({ tier: 'supporter' })), true);
  assert.equal(noticeIsFor(parseAudience('tier:champion')!, reader({ tier: 'supporter' })), false);
  assert.equal(noticeIsFor(parseAudience('tier:champion')!, reader({ tier: 'patron' })), true);
  assert.equal(noticeIsFor(parseAudience('supporters')!, reader()), false);
});

test('live: not withdrawn, not expired', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  assert.equal(noticeLive({ withdrawnAt: null, expiresAt: null }, now), true);
  assert.equal(noticeLive({ withdrawnAt: '2026-11-06T00:00:00Z', expiresAt: null }, now), false);
  assert.equal(noticeLive({ withdrawnAt: null, expiresAt: '2026-11-07T11:59:00Z' }, now), false);
  assert.equal(noticeLive({ withdrawnAt: null, expiresAt: '2026-11-08T00:00:00Z' }, now), true);
});

test('links: Anvil pages and Discord invites only, never a file', () => {
  assert.equal(safeNoticeLink('/settings/notifications', HOSTS), '/settings/notifications');
  assert.equal(safeNoticeLink('https://anvilosrs.com/changelog', HOSTS), 'https://anvilosrs.com/changelog');
  assert.equal(safeNoticeLink('https://beta.anvilosrs.com/inbox', HOSTS), 'https://beta.anvilosrs.com/inbox');
  assert.equal(safeNoticeLink('https://discord.gg/p9NkrTQmxN', HOSTS), 'https://discord.gg/p9NkrTQmxN');
  assert.equal(safeNoticeLink('https://discord.com/invite/abc', HOSTS), 'https://discord.com/invite/abc');
  assert.equal(safeNoticeLink('https://discord.com/users/123', HOSTS), 'https://discord.com/users/123');
  for (const bad of [
    'https://evil.com/x',
    'https://anvilosrs.com.evil.com/',
    'http://anvilosrs.com/',
    'https://anvilosrs.com/plugin.jar',
    'https://anvilosrs.com/setup.EXE',
    '/files/anvil.zip',
    '//evil.com/x',
    'javascript:alert(1)',
    'https://discord.com/api/webhooks/1/x',
    'https://cdn.discordapp.com/attachments/1/2/a.exe',
    'https://user:pw@anvilosrs.com/',
    'https://anvilosrs.com:8443/',
  ]) {
    assert.equal(safeNoticeLink(bad, HOSTS), null, bad);
  }
  assert.equal(safeNoticeLink('', HOSTS), null);
});

test('brief line and DM read cleanly', () => {
  assert.equal(noticeBriefLine({ title: 'Plugin 1.16 is out' }), 'From Anvil: Plugin 1.16 is out');
  assert.ok(noticeBriefLine({ title: 'x'.repeat(300) }).length <= 120);
  const dm = noticeDmContent({ title: 'Heads up', body: 'Re-login once.', linkUrl: '/settings' }, 'https://anvilosrs.com');
  assert.equal(dm, '**Heads up**\n\nRe-login once.\n\nhttps://anvilosrs.com/settings');
});

test('found via: known answers only, note only with an answer', () => {
  assert.deepEqual(parseFoundVia('reddit', '  r/2007scape  '), { foundVia: 'reddit', note: 'r/2007scape' });
  assert.deepEqual(parseFoundVia('myspace', 'hi'), { foundVia: null, note: null });
  assert.deepEqual(parseFoundVia('friend', ''), { foundVia: 'friend', note: null });
  assert.ok((parseFoundVia('other', 'y'.repeat(500)).note ?? '').length <= 120);
});

test('welcome: personal, says replies go nowhere, asks once', () => {
  const o = { name: 'Zezima', for: { kind: 'clan' as const, clanName: 'The **Afk** Spot' }, contactId: '111', supportInvite: 'https://discord.gg/x' };
  const t = welcomeText(o);
  assert.match(t, /^Hey Zezima, I'm Ahmed/);
  assert.match(t, /The Afk Spot/); // markdown stripped from the clan name
  assert.match(t, /Replies to this bot don't reach me/);
  assert.match(t, /<@111>/);
  assert.match(t, /— Ahmed$/);
  const msg = welcomeMessage(o) as { components: { components: { custom_id?: string; url?: string }[] }[]; allowed_mentions: unknown };
  const ids = msg.components[0].components.map((c) => c.custom_id ?? c.url);
  assert.deepEqual(ids, [DMS_YES, DMS_NO, 'https://discord.gg/x']);
  assert.deepEqual(msg.allowed_mentions, { parse: [] });
  const sup = welcomeText({ ...o, name: null, contactId: null, for: { kind: 'supporter', tierName: 'Patron' } });
  assert.match(sup, /^Hey, I'm Ahmed/);
  assert.match(sup, /Anvil Patron/);
  assert.doesNotMatch(sup, /<@/);
});

test('buttons record the right choice', () => {
  assert.equal(choiceFor(DMS_YES), 'yes');
  assert.equal(choiceFor(DMS_NO), 'no');
  assert.equal(choiceFor(DMS_STOP), 'no');
  assert.equal(choiceFor('cx:whatever'), null);
  const row = choiceRow('yes', 'https://discord.gg/x') as { components: { disabled?: boolean }[] };
  assert.equal(row.components[0].disabled, true);
});

test('plugin card: text only, the one link is the inbox', () => {
  const node = noticeCard({ id: 5, title: 'Hello', body: 'See https://evil.com/a.jar', important: true }, 'afk', true);
  const actions: unknown[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.on) actions.push(o.on);
    for (const [k, v] of Object.entries(o)) {
      if (k === 'on') continue;
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(node);
  assert.deepEqual(actions, [
    { a: 'post', act: 'notice-hide', args: { id: '5', clan: 'afk', chosen: '1' } },
    { a: 'site', path: '/inbox' },
  ]);
});
