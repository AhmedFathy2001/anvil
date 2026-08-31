// House-rules Markdown: what it renders, and what it refuses to become.
//
// The security claim this file exists to hold is structural rather than behavioural: the renderer
// produces REACT ELEMENTS, never an HTML string, so there is no input that becomes markup. These
// tests assert that by walking the returned tree — if anybody ever "optimises" this into
// dangerouslySetInnerHTML, the shape checks below stop being satisfiable.
//
// Run: npx tsx --test tests/markdown.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactElement, ReactNode } from 'react';

import { renderMarkdown } from '../src/lib/markdown.tsx';

/** Every element type in the tree, flattened — what the renderer chose to emit. */
function types(node: ReactNode, out: string[] = []): string[] {
  if (node == null || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const n of node) types(n, out);
    return out;
  }
  if (typeof node === 'object' && 'type' in (node as ReactElement)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (typeof el.type === 'string') out.push(el.type);
    types(el.props?.children, out);
  }
  return out;
}

/** Every text node, concatenated — what a reader actually sees. */
function text(node: ReactNode, out: string[] = []): string[] {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const n of node) text(n, out);
    return out;
  }
  if (typeof node === 'object' && 'type' in (node as ReactElement)) {
    text((node as ReactElement<{ children?: ReactNode }>).props?.children, out);
  }
  return out;
}

function props(node: ReactNode, tag: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node == null || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const n of node) props(n, tag, out);
    return out;
  }
  if (typeof node === 'object' && 'type' in (node as ReactElement)) {
    const el = node as ReactElement<Record<string, unknown>>;
    if (el.type === tag) out.push(el.props);
    props((el.props as { children?: ReactNode })?.children, tag, out);
  }
  return out;
}

// ── What it will not become ───────────────────────────────────────────────────────────────────

test('a script tag is text, not a script', () => {
  const tree = renderMarkdown('<script>alert(1)</script>');
  // Not "escaped" — never parsed as markup in the first place. It comes back as a STRING inside a
  // paragraph, and React escapes strings on render.
  assert.deepEqual(types(tree), ['p']);
  assert.equal(text(tree).join(''), '<script>alert(1)</script>');
});

test('an img with an onerror handler is text too', () => {
  const tree = renderMarkdown('<img src=x onerror="alert(1)">');
  assert.deepEqual(types(tree), ['p']);
  assert.ok(text(tree).join('').includes('onerror'));
  assert.equal(props(tree, 'img').length, 0);
});

test('a javascript: URL is never made into a link', () => {
  // The scheme check is an ALLOWLIST — only http(s) becomes an anchor, so a new dangerous scheme
  // cannot arrive by being forgotten.
  const tree = renderMarkdown('javascript:alert(1) and data:text/html,<b>x</b>');
  assert.equal(props(tree, 'a').length, 0);
  assert.ok(text(tree).join('').includes('javascript:alert(1)'));
});

test('a real link opens safely', () => {
  const anchors = props(renderMarkdown('See https://example.com/rules'), 'a');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].href, 'https://example.com/rules');
  // Without noopener the opened page gets a handle on this one via window.opener.
  assert.match(String(anchors[0].rel), /noopener/);
  assert.match(String(anchors[0].rel), /noreferrer/);
});

test('no node in the tree is ever handed raw HTML', () => {
  const tree = renderMarkdown('**bold** <b>not bold</b>\n- item https://x.com\n> quote');
  const walk = (n: ReactNode): void => {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const el = n as ReactElement<Record<string, unknown>>;
    assert.equal(el.props?.dangerouslySetInnerHTML, undefined);
    walk((el.props as { children?: ReactNode })?.children);
  };
  walk(tree);
});

// ── What it renders ───────────────────────────────────────────────────────────────────────────

test('the Discord dialect an author already knows', () => {
  assert.ok(types(renderMarkdown('**b**')).includes('strong'));
  assert.ok(types(renderMarkdown('*i*')).includes('em'));
  assert.ok(types(renderMarkdown('__u__')).includes('u'));
  assert.ok(types(renderMarkdown('~~s~~')).includes('s'));
  assert.ok(types(renderMarkdown('`c`')).includes('code'));
});

test('bullets and numbers become the list they look like', () => {
  assert.ok(types(renderMarkdown('- one\n- two')).includes('ul'));
  assert.ok(types(renderMarkdown('1. one\n2. two')).includes('ol'));
  // Switching kind mid-way is two lists, not one confused one.
  const mixed = types(renderMarkdown('- a\n1. b'));
  assert.ok(mixed.includes('ul') && mixed.includes('ol'));
});

test('code spans are literal, so an asterisk can be shown', () => {
  const tree = renderMarkdown('`**not bold**`');
  assert.ok(types(tree).includes('code'));
  assert.equal(types(tree).includes('strong'), false);
  assert.equal(text(tree).join(''), '**not bold**');
});

test('unmatched punctuation stays visible rather than eating the line', () => {
  // The right failure for a rules document: a stray asterisk is cosmetic, a swallowed rule is not.
  const tree = renderMarkdown('Bring 3 * 5 sharks, and **do not** die');
  assert.ok(text(tree).join('').includes('3 * 5 sharks'));
  assert.ok(types(tree).includes('strong'));
});

test('blank input renders nothing at all', () => {
  assert.equal(renderMarkdown(''), null);
  assert.equal(renderMarkdown('   \n  '), null);
  assert.equal(renderMarkdown(null), null);
});

test('windows line endings split the same as unix ones', () => {
  assert.ok(types(renderMarkdown('- a\r\n- b')).filter((t) => t === 'li').length === 2);
});
