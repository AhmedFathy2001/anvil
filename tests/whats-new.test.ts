// lib/whatsNew: who an entry is for, and how its links are filled in for one viewer. Pure: no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIGNED_OUT,
  WHATS_NEW,
  audienceMatches,
  clanMeets,
  isForViewer,
  resolveLinks,
  signInHref,
  type Viewer,
  type ViewerClan,
  type WhatsNewEntry,
} from '../src/lib/whatsNew.ts';

const afk: ViewerClan = { slug: 'theafkspot', name: 'The AFK Spot', kind: 'clan', role: 'admin', boostLevel: 1 };
const other: ViewerClan = { slug: 'other', name: 'Other Clan', kind: 'clan', role: null, boostLevel: 0 };
const space: ViewerClan = { slug: 'streamer', name: 'Streamer', kind: 'creator', role: 'owner', boostLevel: 0 };

const viewer = (over: Partial<Viewer> = {}): Viewer => ({ signedIn: true, tier: null, clans: [], pluginUser: false, onApex: true, ...over });

test('tiers: supporter is any tier, champion+ excludes Supporter, patron only Patron', () => {
  assert.equal(audienceMatches('supporter', viewer({ tier: 'supporter' })), true);
  assert.equal(audienceMatches('supporter', viewer()), false);
  assert.equal(audienceMatches('champion+', viewer({ tier: 'supporter' })), false);
  assert.equal(audienceMatches('champion+', viewer({ tier: 'champion' })), true);
  assert.equal(audienceMatches('champion+', viewer({ tier: 'patron' })), true);
  assert.equal(audienceMatches('patron', viewer({ tier: 'champion' })), false);
  assert.equal(audienceMatches('patron', viewer({ tier: 'patron' })), true);
});

test('clan roles: staff is moderator and up, admin is owner/admin, editor is neither', () => {
  for (const role of ['owner', 'admin', 'treasurer', 'moderator']) {
    assert.equal(audienceMatches('clanStaff', viewer({ clans: [{ ...other, role }] })), true, role);
  }
  assert.equal(audienceMatches('clanStaff', viewer({ clans: [{ ...other, role: 'editor' }] })), false);
  assert.equal(audienceMatches('clanStaff', viewer({ clans: [other] })), false);
  assert.equal(audienceMatches('clanAdmin', viewer({ clans: [{ ...other, role: 'moderator' }] })), false);
  assert.equal(audienceMatches('clanAdmin', viewer({ clans: [afk] })), true);
});

test('boosts, creator owners and plugin users', () => {
  assert.equal(audienceMatches('boostedClan', viewer({ clans: [afk] })), true);
  assert.equal(audienceMatches('boostedClan2', viewer({ clans: [afk] })), false);
  assert.equal(audienceMatches('boostedClan2', viewer({ clans: [{ ...afk, boostLevel: 2 }] })), true);
  assert.equal(audienceMatches('creatorOwner', viewer({ clans: [space] })), true);
  assert.equal(audienceMatches('creatorOwner', viewer({ clans: [{ ...afk, role: 'owner' }] })), false, 'a clan owner is not a creator');
  assert.equal(audienceMatches('pluginUser', viewer({ pluginUser: true })), true);
  assert.equal(audienceMatches('pluginUser', viewer()), false);
});

test('a clan condition holds for ONE clan, not across two', () => {
  // Admin of an unboosted clan, plain member of a boosted one: not "admin of a boosted clan".
  const v = viewer({ clans: [{ ...other, role: 'admin' }, { ...afk, role: null }] });
  assert.equal(audienceMatches({ clan: { role: 'admin', boost: 1 } }, v), false);
  assert.equal(audienceMatches({ clan: { role: 'admin', boost: 1 } }, viewer({ clans: [afk] })), true);
  assert.equal(clanMeets(space, { kind: 'clan' }), false);
  assert.equal(clanMeets(afk, { kind: 'clan' }), true);
});

test('"For you" is targeted entries only, never for signed-out viewers or everyone-entries', () => {
  const everyone: WhatsNewEntry = { id: 'a', date: '2026-11-07', title: 't', body: 'b' };
  const explicitEveryone: WhatsNewEntry = { ...everyone, audience: ['everyone'] };
  const supporters: WhatsNewEntry = { ...everyone, audience: ['supporter', 'pluginUser'] };
  const champ = viewer({ tier: 'champion' });
  assert.equal(isForViewer(everyone, champ), false);
  assert.equal(isForViewer(explicitEveryone, champ), false);
  assert.equal(isForViewer(supporters, champ), true);
  assert.equal(isForViewer(supporters, viewer({ pluginUser: true })), true, 'any audience matching is enough');
  assert.equal(isForViewer(supporters, viewer()), false);
  assert.equal(isForViewer(supporters, { ...SIGNED_OUT, tier: 'patron' }), false);
});

const entry: WhatsNewEntry = {
  id: 'x',
  date: '2026-11-07',
  title: 'Clan name colour',
  body: 'b',
  links: [
    { label: 'Set {clanName}’s name colour', href: '/c/{clan}/admin/clan/boosts', clan: { role: 'admin', boost: 1 } },
    { label: 'Your boosts', href: '/settings/boosts', account: true },
    { label: 'Pricing', href: '/pricing', apexOnly: true },
    { label: 'Guide', href: '/guide' },
  ],
};

test('clan tokens fill per matching clan, and drop the link (not the entry) when none match', () => {
  const two = viewer({ clans: [afk, { ...other, role: 'owner', boostLevel: 3, slug: 'b-clan', name: 'B Clan' }] });
  assert.deepEqual(
    resolveLinks(entry, two).map((l) => [l.label, l.href]),
    [
      ['Set The AFK Spot’s name colour', '/c/theafkspot/admin/clan/boosts'],
      ['Set B Clan’s name colour', '/c/b-clan/admin/clan/boosts'],
      ['Your boosts', '/settings/boosts'],
      ['Pricing', '/pricing'],
      ['Guide', '/guide'],
    ],
  );
  const memberOnly = resolveLinks(entry, viewer({ clans: [{ ...afk, role: null }] }));
  assert.deepEqual(memberOnly.map((l) => l.label), ['Your boosts', 'Pricing', 'Guide']);
});

test('clan links expand to at most three clans', () => {
  const many = viewer({ clans: Array.from({ length: 5 }, (_, i) => ({ ...afk, slug: `c${i}`, name: `C${i}` })) });
  assert.equal(resolveLinks(entry, many).filter((l) => l.href.startsWith('/c/')).length, 3);
});

test('signed out: account pages go through sign-in, clan links drop, apex-only pages drop off the apex', () => {
  const out = resolveLinks(entry, SIGNED_OUT);
  assert.deepEqual(
    out.map((l) => [l.label, l.href, l.signIn]),
    [
      ['Your boosts', signInHref('/settings/boosts'), true],
      ['Pricing', '/pricing', false],
      ['Guide', '/guide', false],
    ],
  );
  assert.equal(signInHref('/settings/boosts'), '/login?return=%2Fsettings%2Fboosts');
  assert.deepEqual(resolveLinks(entry, { ...SIGNED_OUT, onApex: false }).map((l) => l.label), ['Your boosts', 'Guide']);
});

test('the seed list is well formed', () => {
  const ids = new Set<string>();
  let last = '9999-12-31';
  for (const e of WHATS_NEW) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.date <= last, `${e.id} is out of order (newest first)`);
    last = e.date;
    assert.ok(e.title.length > 0 && e.title.length <= 48, `${e.id} title length`);
    for (const l of e.links ?? []) {
      assert.ok(l.href.startsWith('/'), `${e.id}: ${l.href} is a site path`);
      if (l.label.includes('{clanName}')) assert.ok(l.href.includes('{clan}'), `${e.id}: a clan-named label needs a clan link`);
    }
  }
});
