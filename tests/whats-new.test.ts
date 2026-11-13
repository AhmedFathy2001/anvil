// lib/whatsNew: who an entry is for, and how its links are filled in for one viewer. Pure: no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECENT_LIMIT,
  SIGNED_OUT,
  forYouCards,
  groupByMonth,
  splitRecent,
  bellGroups,
  entriesSince,
  isRelevantTo,
  needsViewer,
  WHATS_NEW,
  audienceMatches,
  bucketEntries,
  entryTabs,
  groupByDate,
  pickTab,
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
    { label: 'Your boosts', href: '/settings/profile#boosts', account: true },
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
      ['Your boosts', '/settings/profile#boosts'],
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
      ['Your boosts', signInHref('/settings/profile#boosts'), true],
      ['Pricing', '/pricing', false],
      ['Guide', '/guide', false],
    ],
  );
  assert.equal(signInHref('/settings/profile#boosts'), '/login?return=%2Fsettings%2Fprofile%23boosts');
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

const e = (id: string, audience?: WhatsNewEntry['audience'], date = '2026-11-07'): WhatsNewEntry => ({ id, date, title: id, body: 'b', audience });

test('tabs: each audience lands in its scope, several audiences in several tabs', () => {
  assert.deepEqual(entryTabs(e('a')), ['everyone']);
  assert.deepEqual(entryTabs(e('a', ['everyone'])), ['everyone']);
  assert.deepEqual(entryTabs(e('a', ['pluginUser'])), ['players']);
  assert.deepEqual(entryTabs(e('a', ['clanStaff'])), ['staff']);
  assert.deepEqual(entryTabs(e('a', ['clanAdmin'])), ['staff']);
  assert.deepEqual(entryTabs(e('a', [{ clan: { role: 'staff', kind: 'clan' } }])), ['staff']);
  for (const a of ['supporter', 'champion+', 'patron', 'boostedClan', 'boostedClan2'] as const) {
    assert.deepEqual(entryTabs(e('a', [a])), ['supporters'], a);
  }
  assert.deepEqual(entryTabs(e('a', ['creatorOwner'])), ['creators']);
  assert.deepEqual(entryTabs(e('a', ['pluginUser', 'clanStaff'])), ['players', 'staff']);
  assert.deepEqual(entryTabs(e('a', [{ clan: { role: 'admin', boost: 1 } }, 'boostedClan'])), ['staff', 'supporters']);
});

test('bucketing: empty tabs are hidden, counts follow, "For you" only when signed in and targeted', () => {
  const list = [e('p', ['pluginUser']), e('s', ['clanStaff']), e('all'), e('both', ['pluginUser', 'clanStaff'])];
  const out = bucketEntries(list, SIGNED_OUT);
  assert.deepEqual(out.map((b) => [b.id, b.entries.map((x) => x.id)]), [
    ['everyone', ['all']],
    ['players', ['p', 'both']],
    ['staff', ['s', 'both']],
  ]);
  const staff = bucketEntries(list, viewer({ clans: [afk] }));
  assert.deepEqual(staff.find((b) => b.id === 'you')?.entries.map((x) => x.id), ['s', 'both']);
  assert.equal(bucketEntries([e('all')], viewer()).some((b) => b.id === 'you'), false);
  // Every tab of the real list has entries, and nothing is lost.
  const real = bucketEntries(WHATS_NEW, SIGNED_OUT);
  assert.ok(real.every((b) => b.entries.length > 0));
  assert.ok(WHATS_NEW.every((x) => real.some((b) => b.entries.includes(x))));
});

test('pickTab: asked tab if shown, else For you, else Everyone', () => {
  const list = [e('s', ['clanStaff']), e('all')];
  const signed = bucketEntries(list, viewer({ clans: [afk] }));
  assert.equal(pickTab(signed, null), 'you');
  assert.equal(pickTab(signed, 'staff'), 'staff');
  assert.equal(pickTab(signed, 'creators'), 'you', 'a tab with no entries is not opened');
  assert.equal(pickTab(bucketEntries(list, SIGNED_OUT), 'bogus'), 'everyone');
});

test('groupByDate keeps order and groups equal dates', () => {
  const g = groupByDate([e('a', undefined, '2026-11-09'), e('b', undefined, '2026-11-09'), e('c', undefined, '2026-11-07')]);
  assert.deepEqual(g.map((x) => [x.date, x.entries.length]), [['2026-11-09', 2], ['2026-11-07', 1]]);
});

const byId = (id: string) => WHATS_NEW.find((x) => x.id === id)!;

test('1.20.0 announcements: one integrations button per clan the viewer admins', () => {
  const two = viewer({ clans: [afk, { ...other, slug: 'b-clan', name: 'B Clan', role: 'owner' }, { ...other, role: 'moderator' }] });
  assert.deepEqual(
    resolveLinks(byId('2026-11-09-announcements'), two).map((l) => l.href),
    ['/c/theafkspot/admin/integrations', '/c/b-clan/admin/integrations'],
  );
  assert.deepEqual(resolveLinks(byId('2026-11-09-announcements'), viewer({ clans: [other] })), []);
  assert.deepEqual(resolveLinks(byId('2026-11-09-announcements'), SIGNED_OUT), []);
});

test('1.20.0 account links go through sign-in when signed out, direct when signed in', () => {
  const my = byId('2026-11-09-my-announcements');
  assert.deepEqual(resolveLinks(my, SIGNED_OUT).map((l) => [l.href, l.signIn]), [[signInHref('/settings/posts#discord-posts'), true]]);
  assert.deepEqual(resolveLinks(my, viewer()).map((l) => [l.href, l.signIn]), [['/settings/posts#discord-posts', false]]);
});

test('every link in the list resolves to a site path for a multi-clan viewer, signed out and off-apex', () => {
  const many = viewer({ clans: [afk, { ...afk, slug: 'b', name: 'B' }, { ...space }] });
  for (const v of [many, SIGNED_OUT, { ...SIGNED_OUT, onApex: false }, { ...many, onApex: false }]) {
    for (const x of WHATS_NEW) {
      for (const l of resolveLinks(x, v)) {
        assert.ok(l.href.startsWith('/'), `${x.id}: ${l.href}`);
        assert.ok(!l.href.includes('{') && !l.label.includes('{'), `${x.id}: unfilled token in ${l.label}`);
      }
    }
  }
  assert.ok(!resolveLinks(byId('2026-11-07-name-looks'), { ...many, onApex: false }).some((l) => l.href === '/supporter'));
});

const mk = (id: string, date: string, audience?: WhatsNewEntry['audience']): WhatsNewEntry => ({ id, date, title: id, body: `${id} body`, audience });

test('entriesSince lists what was added above the marker, falling back to the date of a removed id', () => {
  const list = [mk('c', '2026-11-09'), mk('b', '2026-11-09'), mk('a', '2026-11-07'), mk('2026-10-01-x', '2026-10-01')];
  assert.deepEqual(entriesSince(list, 'a').map((x) => x.id), ['c', 'b']);
  assert.deepEqual(entriesSince(list, 'c'), []);
  // Added later the same day, above the one already seen.
  assert.deepEqual(entriesSince(list, 'b').map((x) => x.id), ['c']);
  assert.deepEqual(entriesSince(list, '2026-11-07-gone').map((x) => x.id), ['c', 'b']);
  assert.deepEqual(entriesSince(list, 'not-a-date'), []);
  // The real list: the newest id is never "new" again.
  assert.deepEqual(entriesSince(WHATS_NEW, WHATS_NEW[0].id), []);
});

test('isRelevantTo: everyone entries reach anyone signed in, targeted ones only their audience', () => {
  const anyone: Viewer = { ...SIGNED_OUT, signedIn: true };
  const staff: Viewer = { ...anyone, clans: [afk] };
  assert.ok(isRelevantTo(mk('x', '2026-11-09'), anyone));
  assert.ok(isRelevantTo(mk('x', '2026-11-09', ['everyone']), anyone));
  assert.ok(!isRelevantTo(mk('x', '2026-11-09', ['clanStaff']), anyone));
  assert.ok(isRelevantTo(mk('x', '2026-11-09', ['clanStaff']), staff));
  assert.ok(!isRelevantTo(mk('x', '2026-11-09', ['patron', 'pluginUser']), staff));
  assert.ok(!needsViewer([mk('x', '2026-11-09'), mk('y', '2026-11-09', ['everyone'])]));
  assert.ok(needsViewer([mk('x', '2026-11-09'), mk('y', '2026-11-09', ['supporter'])]));
});

test('bellGroups: one notice per date, a lone entry reads as itself', () => {
  const groups = bellGroups([mk('d', '2026-11-09'), mk('c', '2026-11-09'), mk('b', '2026-11-09'), mk('a', '2026-11-09'), mk('z', '2026-11-07')]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].title, 'What\u2019s new: 4 changes');
  assert.equal(groups[0].body, 'd, c, b and 1 more.');
  assert.deepEqual(groups[0].ids, ['d', 'c', 'b', 'a']);
  assert.equal(groups[1].title, 'What\u2019s new: z');
  assert.equal(groups[1].body, 'z body');
  assert.equal(bellGroups([mk('b', '2026-11-09'), mk('a', '2026-11-09')])[0].body, 'b and a.');
});

test('forYouCards merges an entry aimed at several of the viewer roles into one chipped card', () => {
  const v: Viewer = {
    signedIn: true,
    tier: 'champion',
    clans: [{ slug: 'a', name: 'A', kind: 'clan', role: 'admin', boostLevel: 0 }],
    pluginUser: true,
    onApex: true,
  } as Viewer;
  const e: WhatsNewEntry = {
    id: 'x',
    date: '2026-11-01',
    title: 't',
    body: 'b',
    audience: ['supporter', 'clanAdmin', 'clanStaff', 'creatorOwner'],
  };
  const cards = forYouCards([e, e], v);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].chips, ['Supporter', 'Clan admin', 'Clan staff']);
});

test('splitRecent keeps the newest five and groupByMonth buckets the rest', () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ date: i < 6 ? '2026-11-0' + (9 - i) : '2026-10-0' + (9 - i) }));
  const { recent, older } = splitRecent(items);
  assert.equal(recent.length, RECENT_LIMIT);
  assert.equal(older.length, 3);
  const months = groupByMonth(older);
  assert.deepEqual(months.map((m) => [m.label, m.items.length]), [['November 2026', 1], ['October 2026', 2]]);
});
