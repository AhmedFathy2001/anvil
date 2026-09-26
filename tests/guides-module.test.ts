// The guides module's pure core: how a guide becomes Discord messages, how the site renders it, the
// line diff behind "what changed", and slugs. No database.
//
// Run: npx tsx --test tests/guides-module.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactElement, ReactNode } from 'react';

import {
  CONTENT_MAX,
  chunkContent,
  renderGuideForDiscord,
  splitBlocks,
  absoluteImageUrl,
} from '../src/lib/guideDiscord.ts';
import { diffLines, diffStats, withContext } from '../src/lib/guideDiff.ts';
import { slugify, readingMinutes } from '../src/lib/guideCategories.ts';
import { renderGuide, guideHeadings } from '../src/lib/guideMarkdown.tsx';

const G = (body: string, extra: Record<string, unknown> = {}) => ({ title: 'Vorkath', summary: 'A dragon', body, ...extra });

// ── Discord shape ──────────────────────────────────────────────────────────────────────────

test('a short guide is one message: title, summary, body, footer', () => {
  const m = renderGuideForDiscord(G('Hello **world**', { siteUrl: 'https://x.test/guides/v' }));
  assert.equal(m.length, 1);
  assert.match(m[0].content, /^# Vorkath\n-# A dragon\n\nHello \*\*world\*\*/);
  assert.match(m[0].content, /\[Read on the site\]\(<https:\/\/x\.test\/guides\/v>\)/);
  assert.match(m[0].content, /Powered by Anvil$/);
});

test('--- starts a new message; --- inside a code fence does not', () => {
  const m = renderGuideForDiscord(G('one\n---\ntwo\n```\n---\n```\n---\nthree'));
  const texts = m.map((x) => x.content);
  assert.equal(m.length, 3);
  assert.match(texts[1], /two\n```\n---\n```/);
  assert.match(texts[2], /^three/);
});

test('an image attaches under the text before it; text after it starts a new message', () => {
  const blocks = splitBlocks('intro\n![a](https://img.test/a.png)\nafter');
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { text: 'intro', images: ['https://img.test/a.png'] });
  assert.equal(blocks[1].text, 'after');
});

test('consecutive images share a gallery url, four to a grid', () => {
  const body = ['text', ...Array.from({ length: 6 }, (_, i) => `![](https://img.test/${i}.png)`)].join('\n');
  const [first] = renderGuideForDiscord(G(body));
  assert.equal(first.embeds.length, 6);
  const urls = first.embeds.map((e) => e.url);
  assert.equal(new Set(urls.slice(0, 4)).size, 1);
  assert.notEqual(urls[3], urls[4]);
});

test('a message ending in images gets its footer on a line of its own (never above the pictures)', () => {
  const m = renderGuideForDiscord(G('text\n![](https://img.test/a.png)'));
  assert.equal(m.length, 2);
  assert.match(m[1].content, /^-# .*Powered by Anvil/);
});

test('the cover becomes its own opening message with the title', () => {
  const m = renderGuideForDiscord(G('body', { coverUrl: '/uploads/c.png' }), { origin: 'https://anvil.test' });
  assert.equal(m[0].content, '# Vorkath\n-# A dragon');
  assert.equal(m[0].embeds[0].image.url, 'https://anvil.test/uploads/c.png');
});

test('relative images need an origin; javascript: and data: are dropped', () => {
  assert.equal(absoluteImageUrl('/x.png', null), null);
  assert.equal(absoluteImageUrl('javascript:alert(1)', 'https://a.test'), null);
  assert.equal(absoluteImageUrl('data:image/png;base64,xx', 'https://a.test'), null);
  assert.equal(absoluteImageUrl('https://i.test/y.png', null), 'https://i.test/y.png');
});

test('long text splits under the Discord limit, at paragraph boundaries', () => {
  const para = 'word '.repeat(150).trim();
  const body = Array.from({ length: 12 }, () => para).join('\n\n');
  const m = renderGuideForDiscord(G(body));
  assert.ok(m.length > 1);
  for (const x of m) assert.ok(x.content.length <= 2000, `message of ${x.content.length}`);
  // Nothing lost: every paragraph made it across.
  assert.equal(m.map((x) => x.content).join('\n').split(para).length - 1, 12);
});

test('a code block cut across messages is closed and reopened with its language', () => {
  const code = Array.from({ length: 200 }, (_, i) => `line ${i} ${'x'.repeat(10)}`).join('\n');
  const chunks = chunkContent('```js\n' + code + '\n```');
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(c.length <= CONTENT_MAX + 4);
    const fences = c.split('\n').filter((l) => l.trim().startsWith('```')).length;
    assert.equal(fences % 2, 0, 'every chunk balances its fences');
  }
  assert.ok(chunks[1].startsWith('```js\n'));
});

test('an empty body still posts a titled message', () => {
  const m = renderGuideForDiscord(G(''));
  assert.equal(m.length, 1);
  assert.match(m[0].content, /^# Vorkath/);
});

// ── Site renderer ──────────────────────────────────────────────────────────────────────────

function collect(node: ReactNode, out: { type: string; props: Record<string, unknown> }[] = []) {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
    return out;
  }
  const el = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (typeof el.type === 'string') out.push({ type: el.type, props: el.props });
  collect(el.props?.children, out);
  return out;
}

test('site renderer: headings, subtext, lists, spoilers, images', () => {
  const tree = collect(
    renderGuide('## Gear\n-# small\n- one\n  - nested\n1. first\n||secret||\n![alt](https://img.test/a.png)'),
  );
  const types = tree.map((t) => t.type);
  for (const t of ['h3', 'ul', 'ol', 'li', 'img']) assert.ok(types.includes(t), `renders ${t}`);
  assert.ok(tree.some((t) => t.type === 'span' && t.props.className === 'guide-spoiler'));
  assert.ok(tree.some((t) => t.type === 'h3' && t.props.id === 'gear'));
});

test('site renderer never links a javascript: url and never emits raw HTML', () => {
  const tree = collect(renderGuide('[x](javascript:alert(1)) <script>alert(1)</script> <img src=x onerror=alert(1)>'));
  assert.ok(!tree.some((t) => t.type === 'a'));
  assert.ok(!tree.some((t) => t.type === 'script' || 'dangerouslySetInnerHTML' in t.props));
  assert.ok(!tree.some((t) => t.type === 'img'));
});

test('headings for the table of contents get unique ids, and skip code blocks', () => {
  const hs = guideHeadings('## Gear\n```\n## not a heading\n```\n## Gear\n### Tips');
  assert.deepEqual(
    hs.map((h) => h.id),
    ['gear', 'gear-1', 'tips'],
  );
});

// ── Diff + slugs ───────────────────────────────────────────────────────────────────────────

test('line diff finds the edit and keeps context', () => {
  const a = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n');
  const b = ['a', 'b', 'c', 'D', 'e', 'f', 'g', 'h', 'i'].join('\n');
  const ops = diffLines(a, b);
  assert.deepEqual(diffStats(ops), { added: 2, removed: 1 });
  const rows = withContext(ops, 1);
  assert.ok(rows.some((r) => r.kind === 'skip'));
  assert.deepEqual(diffLines('same', 'same'), [{ kind: 'same', text: 'same' }]);
});

test('slugify and reading time', () => {
  assert.equal(slugify('Chambers of Xeric — Learner!'), 'chambers-of-xeric-learner');
  assert.equal(slugify('Ahrim & Karil'), 'ahrim-and-karil');
  assert.equal(slugify('!!!'), 'guide');
  assert.equal(readingMinutes('word '.repeat(440)), 2);
});
