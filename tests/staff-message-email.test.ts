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

test('the button label and link are escaped by the layout itself', () => {
  const { html, text } = renderEmail({ preheader: 'x', heading: 'x', lines: [], cta: { label: 'Open <img src=x onerror=alert(1)>', url: 'https://anvilosrs.com/c/a?x="b"' } });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('Open &lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('href="https://anvilosrs.com/c/a?x=&quot;b&quot;"'));
  assert.ok(text.includes('Open <img src=x onerror=alert(1)>'), 'the plain-text copy keeps it as typed');
});
