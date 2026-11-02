// Extra screenshots and links on one proof.
//
// Run: npm run test:proofattachments

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isWebLink, linkHost, MAX_ATTACHMENTS, orderAttachments, parseAttachments } from '../src/lib/proofAttachments.ts';

const ours = (u: string) => u.startsWith('https://media.example/');

test('nothing sent is an empty list, not an error', () => {
  assert.deepEqual(parseAttachments(undefined, ours), { ok: true, items: [] });
  assert.deepEqual(parseAttachments(null, ours), { ok: true, items: [] });
});

test('screenshots must be ones we stored; links may go anywhere http(s)', () => {
  const ok = parseAttachments([
    { kind: 'image', url: 'https://media.example/a.png', label: 'start' },
    { kind: 'link', url: ' https://youtu.be/xyz ' },
  ], ours);
  assert.deepEqual(ok, { ok: true, items: [
    { kind: 'image', url: 'https://media.example/a.png', label: 'start' },
    { kind: 'link', url: 'https://youtu.be/xyz', label: null },
  ] });
  assert.equal(parseAttachments([{ kind: 'image', url: 'https://evil.example/a.png' }], ours).ok, false);
  assert.equal(parseAttachments([{ kind: 'link', url: 'javascript:alert(1)' }], ours).ok, false);
  assert.equal(parseAttachments([{ kind: 'video', url: 'https://media.example/a.mp4' }], ours).ok, false);
});

test('labels are start, end or nothing', () => {
  assert.equal(parseAttachments([{ kind: 'link', url: 'https://a.b', label: 'middle' }], ours).ok, false);
  assert.equal(parseAttachments([{ kind: 'link', url: 'https://a.b', label: 'end' }], ours).ok, true);
});

test('one proof holds at most the cap', () => {
  const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, () => ({ kind: 'link', url: 'https://a.b' }));
  assert.equal(parseAttachments(many, ours).ok, false);
});

test('start shots first, end shots last', () => {
  const rows = [
    { id: 1, label: 'end' as const },
    { id: 2, label: null },
    { id: 3, label: 'start' as const },
  ];
  assert.deepEqual(orderAttachments(rows).map((r) => r.id), [3, 2, 1]);
});

test('link helpers', () => {
  assert.equal(isWebLink('http://imgur.com/a/x'), true);
  assert.equal(isWebLink('ftp://x'), false);
  assert.equal(linkHost('https://www.youtube.com/watch?v=1'), 'youtube.com');
});
