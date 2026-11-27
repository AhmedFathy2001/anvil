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

test('only files in the clan folder and named nowhere else are deleted', () => {
  const ours = (u: string) => u.includes('/c/anvil/');
  const urls = ['https://m/c/anvil/a.jpg', 'https://m/c/anvil/b.jpg', 'https://m/c/other/c.jpg', 'https://m/c/anvil/a.jpg'];
  assert.deepEqual(deletableHuntFiles(urls, ours, new Set(['https://m/c/anvil/b.jpg'])), ['https://m/c/anvil/a.jpg']);
});

test('the hunt reminder points at the competition, not an archive', () => {
  const t = purgeNoticeText({ stage: 'first', eventName: 'Boss Rush', clanName: 'Anvil', purgeAt: new Date('2027-03-07'), files: 12, archiveUrl: 'x', now: new Date('2027-02-21'), hunt: true });
  assert.match(t.subject, /drop screenshots/);
  assert.ok(!t.lines.join(' ').includes('archive'));
});
