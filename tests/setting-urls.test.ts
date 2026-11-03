import assert from 'node:assert/strict';
import test from 'node:test';

import { csvOf } from '../src/lib/eventArchive.ts';
import { checkSettingUrl } from '../src/lib/settingUrls.ts';

test('a link setting takes only a web address', () => {
  assert.deepEqual(checkSettingUrl('board_rules_url', ' https://docs.google.com/doc/1 '), { ok: true, value: 'https://docs.google.com/doc/1' });
  assert.deepEqual(checkSettingUrl('board_rules_url', ''), { ok: true, value: null });
  assert.equal(checkSettingUrl('board_rules_url', 'javascript:alert(1)').ok, false);
  assert.equal(checkSettingUrl('board_rules_url', 'data:text/html,<b>x</b>').ok, false);
  assert.equal(checkSettingUrl('board_rules_url', 'not a link').ok, false);
});

test('the Discord invite must be on Discord', () => {
  assert.equal(checkSettingUrl('discord_invite_url', 'https://discord.gg/abc').ok, true);
  assert.equal(checkSettingUrl('discord_invite_url', 'https://discord.com/invite/abc').ok, true);
  assert.equal(checkSettingUrl('discord_invite_url', 'https://evil.example/discord.gg').ok, false);
});

test('a CSV text cell can never run as a spreadsheet formula', () => {
  const out = csvOf(['name', 'n'], [['=HYPERLINK("http://x","click")', -5], ['+1', 3], ['@SUM(A1)', 0], ['Rikkert', 1]]);
  const lines = out.trim().split('\r\n');
  assert.equal(lines[1], `"'=HYPERLINK(""http://x"",""click"")",-5`, 'quoted text, number left alone');
  assert.equal(lines[2], "'+1,3");
  assert.equal(lines[3], "'@SUM(A1),0");
  assert.equal(lines[4], 'Rikkert,1');
});
