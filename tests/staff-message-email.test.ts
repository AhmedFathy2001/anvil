// Staff email to a clan owner: the body is the operator's own text, escaped, never markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail } from '../src/lib/emailTemplates.ts';
import { escapeHtml } from '../src/lib/mailer.ts';

test('a staff note renders as escaped paragraphs, with line breaks kept', () => {
  const body = 'Hi <b>there</b>.\nSecond line.\n\nNew paragraph & more.';
  const { html, text } = renderEmail({
    preheader: 'x',
    heading: 'x',
    lines: body.split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, '<br>')),
  });
  assert.ok(html.includes('Hi &lt;b&gt;there&lt;/b&gt;.<br>Second line.'));
  assert.ok(!html.includes('<b>there</b>'));
  assert.ok(html.includes('New paragraph &amp; more.'));
  assert.ok(text.includes('New paragraph'));
});
