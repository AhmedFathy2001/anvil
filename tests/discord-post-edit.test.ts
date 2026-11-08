import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removalNote, removedEmbed, removedMessage, strike } from '../src/lib/discordPostEdit.ts';

test('the title is struck once, within the limit', () => {
  assert.equal(strike('Drop — Twisted bow'), '~~Drop — Twisted bow~~');
  assert.equal(strike('~~Already~~'), '~~Already~~');
  assert.ok(strike('x'.repeat(300)).length <= 256);
});

test('a removed post leads with the note, keeps its image, dims its colour', () => {
  const e = removedEmbed({ title: 'Drop — Twisted bow', description: '**Alice** got it.', color: 0xff0000, image: { url: 'https://x/proof.png' }, footer: { text: 'Anvil' } }, removalNote('removed', 'wrong account'));
  assert.equal(e.title, '~~Drop — Twisted bow~~');
  assert.equal(e.description, '**Removed by an admin: wrong account**\n\n**Alice** got it.');
  assert.deepEqual(e.image, { url: 'https://x/proof.png' });
  assert.deepEqual(e.footer, { text: 'Anvil' });
  assert.notEqual(e.color, 0xff0000);
  // Idempotent.
  assert.deepEqual(removedEmbed(e, removalNote('removed', 'wrong account')), e);
});

test('a merged post with other submissions keeps its title (partial)', () => {
  const e = removedEmbed({ title: 'Kills', description: '+5', color: 1 }, 'Part of this post — removed', true);
  assert.equal(e.title, 'Kills');
  assert.equal(e.color, 1);
  assert.match(e.description!, /^\*\*Part of this post/);
});

test('the PATCH body drops the ping and never re-mentions', () => {
  const m = removedMessage({ content: '<@&123>', embeds: [{ title: 'Tile complete' }] }, removalNote('rolledBack'));
  assert.equal(m.content, '');
  assert.deepEqual(m.allowed_mentions, { parse: [] });
  assert.equal(m.embeds[0].title, '~~Tile complete~~');
  assert.equal(m.embeds[0].description, '**Rolled back by an admin**');
  // A message with no embeds still says so.
  assert.equal(removedMessage({ content: 'hi' }, 'Removed by an admin').embeds.length, 1);
});

import { redactWebhooks, safeError, webhookIdOf } from '../src/lib/webhookRedact.ts';

test('webhook tokens are cut from anything logged; the public id stays', () => {
  const url = 'https://discord.com/api/webhooks/123456789/AbC-def_123?wait=true';
  assert.equal(redactWebhooks(`fetch failed: ${url}`), 'fetch failed: https://discord.com/api/webhooks/123456789/[redacted]?wait=true');
  assert.equal(redactWebhooks('https://discordapp.com/api/v10/webhooks/1/tok/messages/5'), 'https://discordapp.com/api/v10/webhooks/1/[redacted]/messages/5');
  assert.equal(redactWebhooks('nothing to see'), 'nothing to see');
  const e = Object.assign(new Error(`insert failed for ${url}`), { code: '23505' });
  const safe = safeError(e);
  assert.deepEqual(Object.keys(safe).sort(), ['code', 'message', 'name']);
  assert.ok(!safe.message.includes('AbC-def_123'));
  assert.equal(safe.code, '23505');
  assert.ok(!safeError(`raw ${url}`).message.includes('AbC-def_123'));
  assert.equal(webhookIdOf(url), '123456789');
  assert.equal(webhookIdOf('https://example.com/x'), null);
});
