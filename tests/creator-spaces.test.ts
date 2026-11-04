// Creator spaces — the pure rules (lib/creatorSpaces): who may make one, when an outsider is let
// straight in, how the "Advertise on Anvil" switch reads, that stream links come only from connected
// channels, and how a person's clans and creator spaces are grouped apart.
//
// Run: npm run test:creators   (this file needs no database)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CREATOR_HIDDEN_ADMIN_PATHS,
  MAX_CREATOR_SPACES,
  YOUR_CLANS_HEADING,
  YOUR_SPACES_HEADING,
  clanKindOf,
  groupClansAndSpaces,
  verifiedStreamLinks,
  creatorHidesAdminPath,
  creatorSetupSteps,
  declinedRequestText,
  isCreatorSpace,
  mayCreateCreatorSpace,
  outsiderNeedsApproval,
  outsiderWord,
  showcaseOn,
  showcaseValueFor,
  suggestSlug,
} from '../src/lib/creatorSpaces.ts';

test('anyone signed in may make one, and only one', () => {
  assert.equal(MAX_CREATOR_SPACES, 1);
  assert.deepEqual(mayCreateCreatorSpace({ signedIn: true, ownedCreatorSpaces: 0 }), { ok: true });
  const atCap = mayCreateCreatorSpace({ signedIn: true, ownedCreatorSpaces: 1 });
  assert.equal(atCap.ok, false);
  assert.equal(!atCap.ok && atCap.reason, 'at-cap');
  const out = mayCreateCreatorSpace({ signedIn: false, ownedCreatorSpaces: 0 });
  assert.equal(!out.ok && out.reason, 'signed-out');
});

test('open entry is open in a creator space; approval still asks', () => {
  assert.equal(outsiderNeedsApproval({ clanKind: 'creator', entry: 'open', vouched: false }), false);
  assert.equal(outsiderNeedsApproval({ clanKind: 'creator', entry: 'open', vouched: true }), false);
  assert.equal(outsiderNeedsApproval({ clanKind: 'creator', entry: 'approval', vouched: false }), true);
  assert.equal(outsiderNeedsApproval({ clanKind: 'creator', entry: 'approval', vouched: true }), true);
});

test('an ordinary clan is unchanged: open lets in only the vouched', () => {
  assert.equal(outsiderNeedsApproval({ clanKind: 'clan', entry: 'open', vouched: false }), true);
  assert.equal(outsiderNeedsApproval({ clanKind: 'clan', entry: 'open', vouched: true }), false);
  assert.equal(outsiderNeedsApproval({ clanKind: 'clan', entry: 'approval', vouched: true }), true);
});

test('unknown kinds read as a clan — the stricter door', () => {
  assert.equal(clanKindOf('creator'), 'creator');
  assert.equal(clanKindOf('clan'), 'clan');
  assert.equal(clanKindOf('Creator'), 'clan');
  assert.equal(clanKindOf(null), 'clan');
  assert.equal(isCreatorSpace({ kind: 'creator' }), true);
  assert.equal(isCreatorSpace({ kind: 'clan' }), false);
  assert.equal(isCreatorSpace(null), false);
});

test('listing: a creator space is unlisted unless it said on; a clan is listed unless it said off', () => {
  assert.equal(showcaseValueFor(true), 'on');
  assert.equal(showcaseValueFor(false), 'off');
  assert.equal(showcaseOn('creator', null), false, 'absent row = unlisted for a creator');
  assert.equal(showcaseOn('creator', 'off'), false);
  assert.equal(showcaseOn('creator', 'on'), true);
  assert.equal(showcaseOn('clan', null), true, 'absent row = listed for a clan, as before');
  assert.equal(showcaseOn('clan', 'off'), false);
  assert.equal(showcaseOn('clan', 'on'), true);
});

test('stream links come only from connected channels, built from the stored name', () => {
  assert.deepEqual(verifiedStreamLinks({}), [], 'nothing connected = no links');
  assert.deepEqual(verifiedStreamLinks({ twitchLogin: null, kickSlug: null, youtube: null }), []);

  const links = verifiedStreamLinks({
    twitchLogin: 'Some_Streamer',
    kickSlug: 'kickname',
    youtube: { channelId: 'UCabcdefghijklmnopqrstuv', handle: '@MyChannel', title: 'My Channel' },
  });
  assert.deepEqual(
    links.map((l) => [l.platform, l.url, l.handle]),
    [
      ['twitch', 'https://www.twitch.tv/some_streamer', 'Some_Streamer'],
      ['youtube', 'https://www.youtube.com/@MyChannel', '@MyChannel'],
      ['kick', 'https://kick.com/kickname', 'kickname'],
    ],
  );

  // No handle: the channel id page, named by its title.
  assert.deepEqual(
    verifiedStreamLinks({ youtube: { channelId: 'UCabcdefghijklmnopqrstuv', handle: null, title: 'Fallback' } }).map((l) => [l.url, l.handle]),
    [['https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', 'Fallback']],
  );
});

test('stream links: a stored value that is not a channel name never becomes an href', () => {
  for (const bad of ['', '  ', 'evil.com/x', 'a b', '../../x', 'javascript:alert(1)', 'x'.repeat(26), 'name?x=1']) {
    assert.deepEqual(verifiedStreamLinks({ twitchLogin: bad }), [], `twitch ${bad}`);
  }
  for (const bad of ['', 'kick.com/x', 'a b', '<script>', 'x'.repeat(41)]) {
    assert.deepEqual(verifiedStreamLinks({ kickSlug: bad }), [], `kick ${bad}`);
  }
  assert.deepEqual(verifiedStreamLinks({ youtube: { channelId: 'not-a-channel', handle: 'no-at-sign' } }), []);
  assert.deepEqual(verifiedStreamLinks({ youtube: { channelId: 'UC/../../evil', handle: '@ok"><x' } }), []);
});

test('typed stream links are gone: the old setting keys are not read or written from this module', async () => {
  const mod = (await import('../src/lib/creatorSpaces.ts')) as Record<string, unknown>;
  assert.equal(mod.checkStreamLink, undefined, 'no typed-link checker left to accept a typed link');
  assert.equal(mod.STREAM_LINK_KEYS, undefined, 'no setting keys left to read a typed link from');
  // And the builder takes no URL at all: a typed value passed in is ignored.
  const sneaky = { twitchUrl: 'https://twitch.tv/famous', kickUrl: 'https://kick.com/famous' } as unknown as Parameters<typeof verifiedStreamLinks>[0];
  assert.deepEqual(verifiedStreamLinks(sneaky), []);
});

test('your clans and your spaces: grouped apart, clans first, empty groups left out', () => {
  const list = [
    { name: 'Alpha', kind: 'clan' },
    { name: 'Streamer Space', kind: 'creator' },
    { name: 'Bravo', kind: null },
    { name: 'Other Space', kind: 'creator' },
  ];
  const groups = groupClansAndSpaces(list, (c) => c.kind);
  assert.deepEqual(
    groups.map((g) => [g.key, g.label, g.items.map((i) => i.name)]),
    [
      ['clans', 'Your clans', ['Alpha', 'Bravo']],
      ['spaces', 'Your spaces', ['Streamer Space', 'Other Space']],
    ],
  );
  assert.equal(YOUR_CLANS_HEADING, 'Your clans');
  assert.equal(YOUR_SPACES_HEADING, 'Your spaces');

  // Only spaces: no empty "Your clans" heading.
  const onlySpaces = groupClansAndSpaces([{ kind: 'creator' }], (c) => c.kind);
  assert.deepEqual(onlySpaces.map((g) => g.key), ['spaces']);
  // Only clans, and nothing at all.
  assert.deepEqual(groupClansAndSpaces([{ kind: 'clan' }], (c) => c.kind).map((g) => g.key), ['clans']);
  assert.deepEqual(groupClansAndSpaces([], () => 'clan'), []);
});

test('slug suggestion from a display name', () => {
  assert.equal(suggestSlug('Cool Streamer!'), 'cool-streamer');
  assert.equal(suggestSlug('  --Zezima--  '), 'zezima');
  assert.equal(suggestSlug('x'.repeat(50)).length, 32);
});

test('creator checklist: event, share, optional Discord', () => {
  const fresh = creatorSetupSteps({ eventsCount: 0, outsideSignups: 0, discordConnected: false });
  assert.deepEqual(fresh.map((s) => s.key), ['event', 'share', 'discord']);
  assert.equal(fresh.find((s) => s.key === 'discord')?.optional, true);
  assert.ok(fresh.every((s) => !s.done));
  const going = creatorSetupSteps({ eventsCount: 1, outsideSignups: 3, discordConnected: false });
  assert.ok(going.filter((s) => !s.optional).every((s) => s.done), 'Discord is not needed for done');
});

test('the in-game-clan admin pages are turned away; everything on the creator menu is not', () => {
  for (const p of ['/admin/weekly', '/admin/events/weekly/12', '/admin/events/weekly/12/settings', '/admin/clan-events', '/admin/clan-events/3',
    '/admin/coffer', '/admin/setup', '/admin/people/needs-review', '/admin/people/access', '/admin/verifications',
    '/admin/clan/needs-review', '/admin/clan/policy']) {
    assert.equal(creatorHidesAdminPath(p), true, p);
  }
  // The creator menu (app/admin/layout), its wizard, and the pages its dashboard links to.
  for (const p of ['/admin/dashboard', '/admin/events', '/admin/events/first', '/admin/events/new', '/admin/events/12',
    '/admin/events/12/signups', '/admin/proofs', '/admin/people', '/admin/people/staff', '/admin/clan', '/admin/clan/audit',
    '/admin/integrations', '/admin/fees', '/admin/schedule']) {
    assert.equal(creatorHidesAdminPath(p), false, p);
  }
  // Whole segments only: a page that merely starts with the same letters is not caught.
  assert.equal(creatorHidesAdminPath('/admin/weeklyish'), false);
  assert.equal(creatorHidesAdminPath('/admin/coffers'), false);
  for (const p of CREATOR_HIDDEN_ADMIN_PATHS) assert.ok(p.startsWith('/admin/'), p);
});

test('a creator space says player, a clan says guest', () => {
  assert.equal(outsiderWord('creator'), 'player');
  assert.equal(outsiderWord('creator', true), 'players');
  assert.equal(outsiderWord('clan'), 'guest');
  assert.equal(outsiderWord('clan', true), 'guests');
  assert.equal(outsiderWord(null), 'guest');
});

test('the decline DM: no "guest" from a creator space, unchanged from a clan', () => {
  const creator = declinedRequestText({ kind: 'creator', hostName: 'Streamer', rsn: 'Zezima', eventName: 'Big Bingo', clansUrl: 'https://x/clans' });
  assert.equal(creator, '**Streamer** said no to your request to play in **Big Bingo** for **Zezima**. You can ask again later.');
  assert.doesNotMatch(creator, /guest/i);
  assert.doesNotMatch(declinedRequestText({ kind: 'creator', hostName: 'S', clansUrl: 'u' }), /guest|clan/i);
  assert.equal(
    declinedRequestText({ kind: 'clan', hostName: 'Iron Foundry', rsn: 'Zezima', clansUrl: 'https://x/clans' }),
    '**Iron Foundry** declined your request to join as a guest for **Zezima**. You can still ask again later, or find another clan: https://x/clans',
  );
});
