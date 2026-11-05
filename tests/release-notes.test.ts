import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareVersions, parseReleaseNote, releaseBriefLine, releaseEmbed } from '../src/lib/releaseNotes.ts';

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
  assert.deepEqual(e.fields.map((f) => f.name), ['New', 'Fixed']);
  assert.equal(releaseBriefLine(r), 'New in Anvil 1.15.0: Big drops show in your chat. · anvilosrs.com/changelog');
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
