// Event media retention (lib/eventMediaRetentionRules) and the archive's pure helpers
// (lib/eventArchive). The date rule is what both the job and the admin page's promise read.
//
// Run: npx tsx --test tests/event-media-retention.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXPIRED_PROOF_URL, eventMediaPurgeAt, isExpiredProof, MEDIA_RETENTION_DAYS } from '../src/lib/eventMediaRetentionRules.ts';
import { archiveIndexHtml, csvOf, safeName } from '../src/lib/eventArchive.ts';

const DAY = 86_400_000;

test('media is due 90 days after the end — either stored timestamp format', () => {
  assert.equal(MEDIA_RETENTION_DAYS, 90);
  const iso = eventMediaPurgeAt({ endDate: '2026-07-01T18:00:00.000Z', forceEndedAt: null })!;
  assert.equal(iso.toISOString(), new Date(Date.parse('2026-07-01T18:00:00Z') + 90 * DAY).toISOString());
  const spaced = eventMediaPurgeAt({ endDate: '2026-07-01 18:00:00', forceEndedAt: null })!;
  assert.equal(spaced.getTime(), iso.getTime(), 'the SQLite-era space format is UTC too');
});

test('a force-end earlier than the scheduled end starts the clock', () => {
  const at = eventMediaPurgeAt({ endDate: '2026-08-01T00:00:00Z', forceEndedAt: '2026-07-10T00:00:00Z' })!;
  assert.equal(at.toISOString(), new Date(Date.parse('2026-07-10T00:00:00Z') + 90 * DAY).toISOString());
});

test('an event with no end is never due', () => {
  assert.equal(eventMediaPurgeAt({ endDate: null, forceEndedAt: null }), null);
  assert.equal(eventMediaPurgeAt({ endDate: 'not a date', forceEndedAt: null }), null);
});

test('the expired placeholder is recognised, real URLs are not', () => {
  assert.ok(isExpiredProof(EXPIRED_PROOF_URL));
  assert.ok(!isExpiredProof('https://pub-x.r2.dev/a/submissions/1.webp'));
  assert.ok(!isExpiredProof(null));
});

test('archive names are safe path segments on every OS', () => {
  assert.equal(safeName('01 Kill: Zuk / "Inferno"?'), '01 Kill Zuk Inferno');
  assert.equal(safeName('   '), 'untitled');
  assert.equal(safeName('trailing dots...'), 'trailing dots');
  assert.equal(safeName('x'.repeat(200)).length, 80);
});

test('CSV quotes what needs quoting', () => {
  assert.equal(csvOf(['a', 'b'], [['x,y', 'say "hi"'], [null, 3]]), 'a,b\r\n"x,y","say ""hi"""\r\n,3\r\n');
});

test('the offline index escapes names and says when a proof was deleted', () => {
  const html = archiveIndexHtml({
    eventName: '<Bingo>',
    startDate: '2026-07-01T00:00:00Z',
    endDate: '2026-07-14T00:00:00Z',
    tiles: [{ id: 1, name: '01 Zulrah' }],
    teams: [{ id: 5, name: 'Team & Co', color: '#ff0000' }],
    completions: [{ teamId: 5, tileId: 1 }],
    proofs: [
      { kind: 'submission', url: 'u1', path: 'p', tileId: 1, teamId: 5, caption: 'A', status: 'ok', file: 'proofs/a.webp' },
      { kind: 'submission', url: EXPIRED_PROOF_URL, path: 'q', tileId: 1, teamId: 5, caption: 'B', status: 'deleted' },
    ],
  });
  assert.ok(html.includes('&lt;Bingo&gt;') && !html.includes('<Bingo>'));
  assert.ok(html.includes('Team &amp; Co'));
  assert.ok(html.includes('src="proofs/a.webp"'));
  assert.ok(html.includes('Deleted after 90 days'));
  assert.ok(html.includes('✓ completed'));
});
