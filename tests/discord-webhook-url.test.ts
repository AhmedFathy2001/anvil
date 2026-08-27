// A personal webhook URL is user-supplied and the SERVER posts to it, so it must be a real Discord
// webhook and nothing else — otherwise "forward my drops to http://169.254.169.254/…" is an SSRF
// that has the server fetch an internal address. This pins the allowlist.
//
// Run: npx tsx --test tests/discord-webhook-url.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isDiscordWebhookUrl } from '../src/lib/discordWebhookUrl.ts';

test('accepts real Discord webhook URLs on every Discord host', () => {
  assert.equal(isDiscordWebhookUrl('https://discord.com/api/webhooks/123456789/abc-DEF_ghi'), true);
  assert.equal(isDiscordWebhookUrl('https://discordapp.com/api/webhooks/123/tok'), true);
  assert.equal(isDiscordWebhookUrl('https://ptb.discord.com/api/webhooks/123/tok'), true);
  assert.equal(isDiscordWebhookUrl('https://canary.discord.com/api/webhooks/123/tok'), true);
  // A versioned path.
  assert.equal(isDiscordWebhookUrl('https://discord.com/api/v10/webhooks/123/tok'), true);
  assert.equal(isDiscordWebhookUrl('  https://discord.com/api/webhooks/123/tok  '), true, 'trimmed');
});

test('rejects everything that is not a Discord webhook — the SSRF surface', () => {
  // Internal / metadata endpoints — the whole reason this exists.
  assert.equal(isDiscordWebhookUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isDiscordWebhookUrl('http://localhost:5432/'), false);
  assert.equal(isDiscordWebhookUrl('https://127.0.0.1/api/webhooks/1/t'), false);
  // A look-alike host.
  assert.equal(isDiscordWebhookUrl('https://discord.com.evil.example/api/webhooks/1/t'), false);
  assert.equal(isDiscordWebhookUrl('https://notdiscord.com/api/webhooks/1/t'), false);
  assert.equal(isDiscordWebhookUrl('https://evil.example/discord.com/api/webhooks/1/t'), false);
  // Right host, wrong path.
  assert.equal(isDiscordWebhookUrl('https://discord.com/api/users/@me'), false);
  assert.equal(isDiscordWebhookUrl('https://discord.com/'), false);
  // Wrong scheme.
  assert.equal(isDiscordWebhookUrl('http://discord.com/api/webhooks/1/t'), false);
  assert.equal(isDiscordWebhookUrl('ftp://discord.com/api/webhooks/1/t'), false);
  // Junk.
  assert.equal(isDiscordWebhookUrl('not a url'), false);
  assert.equal(isDiscordWebhookUrl(''), false);
});
