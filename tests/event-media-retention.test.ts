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

// ── Reminders before deletion ──────────────────────────────────────────────────────────────────────

import { effectivePurgeAt, isPurgeDue, purgeNoticeDue } from '../src/lib/eventMediaRetentionRules.ts';
import { cleanName, daysUntil, purgeNoticeText } from '../src/lib/eventMediaNoticeText.ts';

const ended = (endIso: string, notice: string | null = null, final: string | null = null) => ({
  endDate: endIso,
  forceEndedAt: null,
  mediaPurgeNoticeAt: notice,
  mediaPurgeFinalNoticeAt: final,
});
const at = (iso: string) => new Date(iso);

test('no reminder until 14 days before; then the first one', () => {
  const e = ended('2026-07-01T00:00:00Z'); // base purge 2026-09-29
  assert.equal(purgeNoticeDue(e, at('2026-09-14T00:00:00Z')), null);
  assert.equal(purgeNoticeDue(e, at('2026-09-15T00:00:00Z')), 'first');
});

test('nothing is deleted without a reminder, however overdue', () => {
  const e = ended('2026-01-01T00:00:00Z');
  const now = at('2026-10-12T00:00:00Z');
  assert.equal(isPurgeDue(e, now), false);
  assert.equal(purgeNoticeDue(e, now), 'first');
  // Before any reminder the promised date is a week out from now.
  assert.equal(effectivePurgeAt(e, now)!.toISOString(), '2026-10-19T00:00:00.000Z');
});

test('an overdue event gets a full week after its first reminder, and a last one before', () => {
  const e = ended('2026-01-01T00:00:00Z', '2026-10-12T05:05:00Z');
  assert.equal(effectivePurgeAt(e, at('2026-10-13T00:00:00Z'))!.toISOString(), '2026-10-19T05:05:00.000Z');
  assert.equal(purgeNoticeDue(e, at('2026-10-13T05:05:00Z')), null, 'not the next day');
  assert.equal(purgeNoticeDue(e, at('2026-10-16T05:05:00Z')), 'final', '3 days before');
  assert.equal(isPurgeDue(e, at('2026-10-19T05:04:00Z')), false);
  assert.equal(isPurgeDue(e, at('2026-10-19T05:05:00Z')), true);
});

test('on time: reminded at 14 days, last at 3, deleted on the 90th day', () => {
  const e = ended('2026-07-01T00:00:00Z', '2026-09-15T05:05:00Z');
  assert.equal(effectivePurgeAt(e, at('2026-09-20T00:00:00Z'))!.toISOString(), '2026-09-29T00:00:00.000Z');
  assert.equal(purgeNoticeDue(e, at('2026-09-25T23:00:00Z')), null);
  assert.equal(purgeNoticeDue(e, at('2026-09-26T05:05:00Z')), 'final');
  const done = { ...e, mediaPurgeFinalNoticeAt: '2026-09-26T05:05:00Z' };
  assert.equal(purgeNoticeDue(done, at('2026-09-28T00:00:00Z')), null, 'one last reminder only');
  assert.equal(isPurgeDue(done, at('2026-09-29T00:00:00Z')), true);
});

test('the reminder names the date, the count, and keeps admin text clean', () => {
  const { subject, lines } = purgeNoticeText({
    stage: 'final',
    eventName: 'Summer **Bingo** @everyone https://evil.example/x',
    clanName: 'The AFK Spot',
    purgeAt: at('2026-10-19T05:05:00Z'),
    files: 173,
    archiveUrl: 'https://anvilosrs.com/c/theafkspot/admin/events/1',
    now: at('2026-10-16T05:05:00Z'),
  });
  assert.equal(subject, 'Last reminder: Summer Bingo everyone proof images are deleted in 3 days');
  assert.match(lines[0], /^The 173 proof images from Summer Bingo everyone \(The AFK Spot\) will be deleted on Monday, 19 October 2026 \(3 days\)\.$/);
  assert.equal(cleanName('   '), 'your event');
  assert.equal(daysUntil(at('2026-10-16T05:00:00Z'), at('2026-10-16T05:05:00Z')), 1);
});
