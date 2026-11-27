import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletableHuntFiles, effectivePurgeAt, isPurgeDue, purgeNoticeDue } from '@/lib/eventMediaRetentionRules';
import { purgeNoticeText } from '@/lib/eventMediaNoticeText';

const DAY = 86_400_000;
const hunt = (endDate: string, notice: string | null = null, final: string | null = null) => ({
  endDate,
  forceEndedAt: null,
  mediaPurgeNoticeAt: notice,
  mediaPurgeFinalNoticeAt: final,
});

test('a hunt keeps its screenshots 90 days after it ends, reminders 14 and 3 days ahead', () => {
  const end = '2026-12-07T00:00:00.000Z';
  const base = Date.parse(end) + 90 * DAY;
  assert.equal(purgeNoticeDue(hunt(end), new Date(base - 20 * DAY)), null);
  assert.equal(purgeNoticeDue(hunt(end), new Date(base - 14 * DAY)), 'first');
  const noticed = new Date(base - 14 * DAY).toISOString();
  assert.equal(effectivePurgeAt(hunt(end, noticed), new Date(base - 14 * DAY))?.getTime(), base);
  assert.equal(purgeNoticeDue(hunt(end, noticed), new Date(base - 3 * DAY)), 'final');
  assert.equal(isPurgeDue(hunt(end, noticed), new Date(base - DAY)), false);
  assert.equal(isPurgeDue(hunt(end, noticed), new Date(base)), true);
});

test('never deleted without a reminder, nor sooner than a week after it', () => {
  const end = '2026-01-01T00:00:00.000Z';
  const now = new Date('2026-12-01T00:00:00.000Z');
  assert.equal(isPurgeDue(hunt(end), now), false);
  const noticed = now.toISOString();
  assert.equal(effectivePurgeAt(hunt(end, noticed), now)?.getTime(), now.getTime() + 7 * DAY);
});

test('only server-stored files in the clan folder and named nowhere else are deleted', () => {
  const ours = (u: string) => u.includes('/c/anvil/');
  const rows = [
    { url: 'https://m/c/anvil/a.jpg', stored: true },
    { url: 'https://m/c/anvil/b.jpg', stored: true },
    { url: 'https://m/c/other/c.jpg', stored: true },
    { url: 'https://m/c/anvil/a.jpg', stored: true },
  ];
  assert.deepEqual(deletableHuntFiles(rows, ours, new Set(['https://m/c/anvil/b.jpg'])), ['https://m/c/anvil/a.jpg']);
});

test('a URL not uploaded for this competition is never deleted', () => {
  const ours = () => true;
  // A manual proof naming some other file in the clan's storage (the clan banner, say).
  assert.deepEqual(deletableHuntFiles([{ url: 'https://m/c/anvil/banner.png', stored: false }], ours, new Set()), []);
  // Even when a plugin upload of this hunt names the same file, a typed copy of it keeps it.
  assert.deepEqual(
    deletableHuntFiles([{ url: 'https://m/c/anvil/x.jpg', stored: true }, { url: 'https://m/c/anvil/x.jpg', stored: false }], ours, new Set()),
    [],
  );
});

test('the hunt reminder points at the competition, not an archive', () => {
  const t = purgeNoticeText({ stage: 'first', eventName: 'Boss Rush', clanName: 'Anvil', purgeAt: new Date('2027-03-07'), files: 12, archiveUrl: 'x', now: new Date('2027-02-21'), hunt: true });
  assert.match(t.subject, /drop screenshots/);
  assert.ok(!t.lines.join(' ').includes('archive'));
});
