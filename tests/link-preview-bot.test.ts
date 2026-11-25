// Chat-app unfurlers get the page's own card on sign-in-gated pages; search crawlers do not.
//
// Run: node --test tests/link-preview-bot.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isLinkPreviewAgent } from '../src/lib/linkPreviewBot.ts';

test('chat unfurlers are link-preview agents', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Twitterbot/1.0',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'TelegramBot (like TwitterBot)',
    'WhatsApp/2.23.20.0',
  ]) assert.equal(isLinkPreviewAgent(ua), true, ua);
});

test('people and search crawlers are not', () => {
  for (const ua of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    '',
    null,
  ]) assert.equal(isLinkPreviewAgent(ua), false, String(ua));
});
