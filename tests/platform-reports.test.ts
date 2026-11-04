// Platform reports, the pure half (lib/platformReportRules) and the wiring around it: the reasons,
// the note limit, snapshot sanitizing, which staff action applies to which kind, and the guards on
// the routes (signed-in reporting, support read-only in the staff inbox, no reporter in the log).
//
// Run: npm run test:reports

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import {
  actionLabel,
  buildSnapshot,
  cleanReportNote,
  isReportCategory,
  isReportTarget,
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABEL,
  REPORT_NOTE_MAX,
  REPORT_TARGETS,
  SNAPSHOT_MAX,
  snapshotUrl,
  showReportButton,
  TARGET_ACTIONS,
} from '../src/lib/platformReportRules.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');

test('the reasons are the plain, short list', () => {
  assert.deepEqual(
    REPORT_CATEGORIES.map((c) => REPORT_CATEGORY_LABEL[c]),
    [
      'Breaks Jagex rules (RWT, gambling, bots, private servers)',
      'Scam or phishing',
      'Harassment or hate',
      'Impersonation',
      'Inappropriate content',
      'Cheating in an event',
      'Something else',
    ],
  );
  assert.equal(isReportCategory('scam'), true);
  assert.equal(isReportCategory('spam'), false);
  assert.equal(isReportCategory(undefined), false);
});

test('every kind of thing is a report target, and nothing else is', () => {
  for (const t of ['space', 'creator_panel', 'clan', 'event', 'character', 'person', 'highlight']) assert.equal(isReportTarget(t), true, t);
  for (const t of ['chat', 'user', '', null, 3]) assert.equal(isReportTarget(t), false, String(t));
  assert.equal(REPORT_TARGETS.length, 7);
});

test('the note: optional, at most 500 characters, invisible characters out', () => {
  assert.deepEqual(cleanReportNote(undefined), { ok: true, value: '' });
  assert.equal(cleanReportNote('x'.repeat(REPORT_NOTE_MAX)).ok, true);
  assert.equal(cleanReportNote('x'.repeat(REPORT_NOTE_MAX + 1)).ok, false);
  assert.deepEqual(cleanReportNote('  gold​ seller‮ \u0007 '), { ok: true, value: 'gold seller' });
  assert.equal(cleanReportNote({ a: 1 }).ok, false);
});

test('snapshots are sanitized text and http(s) URLs only', () => {
  const s = buildSnapshot(
    [
      ['Name', 'Evil <script>alert(1)</script> clan​'],
      ['Tagline', 'line one\u0000\u0007\nline two'],
      ['Empty', ''],
      ['Missing', null],
    ],
    [
      ['Logo', 'https://media.test/a.webp'],
      ['Bad', 'javascript:alert(1)'],
      ['Data', 'data:text/html,<b>x</b>'],
      ['Creds', 'https://user:pass@evil.test/'],
      ['Plain', 'not a url'],
    ],
  );
  assert.ok(!/[<>]/.test(s), 'no markup survives');
  assert.ok(!s.includes('​') && !s.includes('\u0000') && !s.includes('\u0007'));
  assert.match(s, /^Name: Evil scriptalert\(1\)\/script clan$/m);
  assert.match(s, /^Tagline: line one\nline two$/m);
  assert.match(s, /^Logo: https:\/\/media\.test\/a\.webp$/m);
  assert.ok(!/Bad|Data|Creds|Plain|Empty|Missing/.test(s));
  assert.equal(snapshotUrl('http://example.test/x'), 'http://example.test/x');
  assert.equal(snapshotUrl(`https://e.test/${'a'.repeat(600)}`), null);
  assert.ok(buildSnapshot([['A', 'x'.repeat(900)], ['B', 'y'.repeat(900)], ['C', 'z'.repeat(900)], ['D', 'w'.repeat(900)], ['E', 'v'.repeat(900)]]).length <= SNAPSHOT_MAX);
});

test('staff actions per kind: only powers the platform already has', () => {
  assert.deepEqual(TARGET_ACTIONS.creator_panel, ['hide']);
  assert.deepEqual(TARGET_ACTIONS.space, ['hide', 'unlist']);
  assert.deepEqual(TARGET_ACTIONS.clan, ['unlist']);
  assert.deepEqual(TARGET_ACTIONS.event, ['unlist']);
  assert.deepEqual(TARGET_ACTIONS.highlight, ['hide']);
  assert.deepEqual(TARGET_ACTIONS.character, []);
  assert.deepEqual(TARGET_ACTIONS.person, []);
  assert.equal(actionLabel('event', 'unlist'), 'Hide host from directories');
  assert.equal(actionLabel('highlight', 'hide'), 'Hide this clip');
});

test('routes: reporting needs a session and the rate limit; the staff inbox reads for support, acts for staff', () => {
  for (const p of ['src/app/api/report/route.ts', 'src/app/api/space-report/route.ts']) {
    const src = read(p);
    assert.match(src, /verifyUser\(\)/, p);
    assert.match(src, /status: 401/, p);
    assert.match(src, /reportRateCheck\(session\.userId, getClientIp\(request\)\)/, p);
  }
  const staff = read('src/app/api/staff/promotions/route.ts');
  const get = staff.slice(staff.indexOf('export async function GET'), staff.indexOf('export async function POST'));
  const post = staff.slice(staff.indexOf('export async function POST'));
  assert.match(get, /requirePlatformApi\('support'\)/);
  assert.match(post, /requirePlatformApi\(CAN_WRITE\)/);
  // The operator log carries the report and its target, never the reporter.
  assert.ok(!/reporter/i.test(post.replace(/\/\*[\s\S]*?\*\//g, '')), 'no reporter in staff actions or their log');
});

test('the reporter is never exposed: only the platform queue reads the reports table', () => {
  const hits = execFileSync('git', ['grep', '-lE', String.raw`\(promoReports\)|\bpromoReports\.[a-zA-Z]`, '--', 'src'], { cwd: new URL('..', import.meta.url), encoding: 'utf-8' })
    .trim()
    .split('\n')
    .sort();
  assert.deepEqual(hits, ['src/lib/platformReports.ts', 'src/lib/spacePage/store.ts']);
  // The public button never names anyone and uses the in-page dialog, not the browser's.
  const btn = read('src/components/ReportButton.tsx');
  assert.ok(!/window\.(confirm|alert|prompt)|\balert\(|\bconfirm\(/.test(btn));
  assert.match(btn, /useModalA11y/);
});

test("the Report flag: everyone signed in, except the target's own staff and on your own content", () => {
  assert.equal(showReportButton({ signedIn: true }), true);
  assert.equal(showReportButton({ signedIn: false }), false, 'signed out never sees it');
  assert.equal(showReportButton({ signedIn: true, staffOfTarget: true }), false, "the clan's / space's own staff don't");
  assert.equal(showReportButton({ signedIn: true, ownContent: true }), false, 'nobody reports themselves');
  // Every page that draws the flag routes it through the helper, so staff never see it.
  for (const p of ['src/app/page.tsx', 'src/app/events/[eventId]/page.tsx']) {
    assert.match(read(p), /showReportButton\(\{[\s\S]*?staffOfTarget/, p);
  }
  assert.match(read('src/components/PublicClanHome.tsx'), /\{canReport && \(/);
});
