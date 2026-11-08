import { test } from 'node:test';
import assert from 'node:assert/strict';

import { announcementBriefLine, announcementText, bundleReleases, compareVersions, parseReleaseNote, releaseEmbed, splitMarker } from '../src/lib/releaseNotes.ts';

const FILE = `---
version: 1.15.0
title: Chat feed
plugin: 1.15.0
---
## Highlights
- Big drops show in your chat.
## New
- [Plugin] The chat feed.
- A clan page for visitors.
## Fixed
- Countdowns read 4d 4h.
## Internal
- this section is ignored
`;

test('a release file parses into its sections', () => {
  const r = parseReleaseNote(FILE);
  assert.equal(r.version, '1.15.0');
  assert.equal(r.pluginVersion, '1.15.0');
  assert.deepEqual(r.highlights, ['Big drops show in your chat.']);
  assert.equal(r.added.length, 2);
  assert.deepEqual(r.fixed, ['Countdowns read 4d 4h.']);
  assert.deepEqual(r.improved, []);
});

test('a malformed file says why', () => {
  assert.throws(() => parseReleaseNote('no front matter'), /front matter/);
  assert.throws(() => parseReleaseNote('---\nversion: 1.15\ntitle: x\n---\n## New\n- a'), /version/);
  assert.throws(() => parseReleaseNote('---\nversion: 1.15.0\ntitle: x\n---\n## Notes\n- a'), /nothing under/);
});

test('versions sort newest first; the embed and the chat line read well', () => {
  assert.deepEqual(['1.9.0', '1.15.0', '1.15.2'].sort(compareVersions), ['1.15.2', '1.15.0', '1.9.0']);
  const r = parseReleaseNote(FILE);
  const e = releaseEmbed(r, 'https://anvilosrs.com');
  assert.equal(e.title, 'Anvil 1.15.0: Chat feed');
  assert.equal(e.url, 'https://anvilosrs.com/changelog#v1.15.0');
  assert.doesNotMatch(e.description, /Countdowns/, 'the Fixed list stays on /changelog');
  assert.match(e.description, /Full changelog: https:\/\/anvilosrs\.com\/changelog#v1\.15\.0$/);
  assert.equal(
    announcementBriefLine(bundleReleases([r], null)),
    'New in Anvil 1.15.0: Chat feed. Big drops show in your chat. · Full changelog: anvilosrs.com/changelog#v1.15.0',
  );
});

test('a silent release waits for the next loud one, or Announce now', async () => {
  const { parseReleaseNote, releaseIsDue } = await import('../src/lib/releaseNotes.ts');
  const silent = parseReleaseNote('---\nversion: 1.18.1\ntitle: Quiet fixes\nsilent: true\n---\n## Fixed\n- A thing.\n');
  assert.equal(silent.silent, true);
  assert.equal(parseReleaseNote('---\nversion: 1.18.2\ntitle: Loud\n---\n## Fixed\n- B.\n').silent, false);
  const older = { version: '1.18.0', silent: false };
  assert.equal(releaseIsDue(silent, [older, silent], new Set()), false);
  assert.equal(releaseIsDue(silent, [older, silent], new Set(['1.18.1'])), true);
  assert.equal(releaseIsDue(silent, [older, silent, { version: '1.18.2', silent: false }], new Set()), true);
  assert.equal(releaseIsDue(older, [older, silent], new Set()), true);
});

const O = 'https://anvilosrs.com';
const NEWS_FILE = `---
version: 1.19.9
title: What's new, guides and staff permissions
whats_new: true
---
## News
A new What's new page shows recent changes in plain words,
with the ones that matter to you first.

Fresh guides cover Supporter perks and boosting a clan.
## Highlights
- A What's new page.
## New
- The What's new page.
## Fixed
- Staff can only set roles within their own rank.
`;

test('the announcement is the News, with the changelog link, never the Fixed lines', () => {
  const r = parseReleaseNote(NEWS_FILE);
  assert.deepEqual(r.news, [
    "A new What's new page shows recent changes in plain words, with the ones that matter to you first.",
    'Fresh guides cover Supporter perks and boosting a clan.',
  ]);
  const text = announcementText(bundleReleases([r], '1.19.8'), O);
  assert.match(text, /^Anvil 1\.19\.9: What's new, guides and staff permissions\n\nA new What's new page/);
  assert.match(text, /Fresh guides cover Supporter perks/);
  assert.doesNotMatch(text, /A What's new page\./, 'Highlights are only the fallback');
  assert.doesNotMatch(text, /own rank/, 'Fixed never goes out');
  assert.match(text, /What's new for you: https:\/\/anvilosrs\.com\/whats-new/);
  assert.match(text, /Full changelog: https:\/\/anvilosrs\.com\/changelog#v1\.19\.9$/);
});

test('without News: Highlights, else the first three New lines; never Fixed', () => {
  const hi = parseReleaseNote('---\nversion: 1.2.0\ntitle: T\n---\n## Highlights\n- The big thing.\n## New\n- N1\n## Fixed\n- F1\n');
  const t1 = announcementText(bundleReleases([hi], null), O);
  assert.match(t1, /The big thing\./);
  assert.doesNotMatch(t1, /N1|F1/);
  const nw = parseReleaseNote('---\nversion: 1.2.1\ntitle: T\n---\n## New\n- N1\n- N2\n- N3\n- N4\n## Fixed\n- F1\n');
  const t2 = announcementText(bundleReleases([nw], null), O);
  assert.match(t2, /New\n• N1\n• N2\n• N3\n/);
  assert.doesNotMatch(t2, /N4|F1/);
  assert.match(t2, /Full changelog: https:\/\/anvilosrs\.com\/changelog#v1\.2\.1$/);
});

test('releases since the last announcement go out as one post: in-batch fixes dropped, older fixes kept, repeats once', () => {
  const v1 = parseReleaseNote(`---
version: 1.19.1
title: Clan boosts
---
## News
Clans can now be boosted for extra perks.
### Improved
- The side panel loads faster.
## New
- Clan boosts.
`);
  const v2 = parseReleaseNote(`---
version: 1.19.2
title: Boost fixes
---
## News
### Improved
- The side panel loads faster.
### Fixed
- Boost badges show on every clan page again. (from 1.19.1)
- Countdowns read 4d 4h again. (from 1.18.0)
## Fixed
- Boost badges show on every clan page again. (from 1.19.1)
`);
  const v3 = parseReleaseNote(`---
version: 1.19.3
title: Faster boards
---
## News
Boards open faster on phones.
### Improved
- the side panel loads faster
## Improved
- Boards.
`);
  const b = bundleReleases([v3, v1, v2], '1.19.0');
  assert.equal(b.version, '1.19.3');
  assert.deepEqual(b.versions, ['1.19.1', '1.19.2', '1.19.3']);
  assert.deepEqual(b.prose, ['Clans can now be boosted for extra perks.', 'Boards open faster on phones.']);
  assert.deepEqual(b.improved, ['The side panel loads faster.'], 'an item repeated across versions shows once');
  assert.deepEqual(b.fixed, ['Countdowns read 4d 4h again.'], 'the 1.19.1 bug never reached players; the 1.18.0 one did; markers stripped');
  const text = announcementText(b, O);
  assert.match(text, /^Anvil 1\.19\.3: Faster boards\n/);
  assert.doesNotMatch(text, /1\.19\.1|1\.19\.2|\(from/);
  assert.match(text, /Full changelog: https:\/\/anvilosrs\.com\/changelog#v1\.19\.3$/);
  // Had 1.19.1 already been announced, its follow-up fix would be news.
  assert.deepEqual(bundleReleases([v2, v3], '1.19.1').fixed, ['Boost badges show on every clan page again.', 'Countdowns read 4d 4h again.']);
  assert.deepEqual(splitMarker('A fix. (from 1.19.1)'), { text: 'A fix.', from: '1.19.1' });
});
