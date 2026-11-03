import { test } from 'node:test';
import assert from 'node:assert/strict';

import { composeBrief } from '../src/lib/chatBrief.ts';
import { DEFAULT_PREFS, cleanPrefs, feedMessage } from '../src/lib/chatFeedRules.ts';
import { ANVIL_COLORS, effectiveBrief, effectiveLook } from '../src/lib/chatLook.ts';

test('own colours are a Supporter perk; without it the Anvil palette applies', () => {
  const prefs = cleanPrefs({ palette: 'custom', colors: { done: '#00FF00', drop: 'red' } });
  assert.deepEqual(prefs.colors, { done: '#00ff00' }, 'only #rrggbb is kept');
  assert.equal(effectiveLook(prefs, null).palette, 'anvil');
  assert.equal(effectiveLook(prefs, null).colors!.done, ANVIL_COLORS.done.slice(1));
  const sup = effectiveLook(prefs, 'supporter');
  assert.equal(sup.palette, 'custom');
  assert.equal(sup.colors!.done, '00ff00');
  assert.equal(sup.colors!.drop, ANVIL_COLORS.drop.slice(1), 'unset tones keep the Anvil colour');
  assert.deepEqual(effectiveLook(cleanPrefs({ palette: 'plain' }), 'patron'), { palette: 'plain', colors: null });
});

test('shaping the brief is Champion and up', () => {
  const prefs = cleanPrefs({ brief: ['goals', 'nonsense'] });
  assert.deepEqual(prefs.brief, ['goals']);
  assert.deepEqual(effectiveBrief(prefs, 'supporter'), DEFAULT_PREFS.brief);
  assert.deepEqual(effectiveBrief(prefs, 'champion'), ['goals']);
});

test('feed lines carry a tone and the sender flair', () => {
  const m = feedMessage({ kind: 'drop', who: 'Zezima', text: 'received Twisted bow (1.2b)', valueGp: 1.2e9 }, 'Clan', { color: '#ff7ab8', star: true });
  assert.equal(m.tone, 'drop');
  assert.equal(m.whoColor, '#ff7ab8');
  assert.equal(m.star, true);
  const t = feedMessage({ kind: 'tile', who: 'Team A', text: 'completed Zulrah' }, 'Board');
  assert.equal(t.tone, 'feed');
  assert.equal(t.whoColor, undefined);
});

test('the brief says where you stand in one line', () => {
  const lines = composeBrief(['bingo', 'weekly'], {
    bingo: { name: 'Autumn Bingo', rank: 2, teams: 5, nearly: ['Zulrah', 'Vorkath', 'Jad'] },
    weeklies: [{ label: 'BOTW Phosani', unit: 'KC', rank: 9, gained: 0, ahead: 1 }, { label: 'SOTW Mining', unit: 'XP', rank: 3, gained: 1_000_000, ahead: 2_200_000 }],
    clanEvents: [],
    goal: null,
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].tone, 'near');
  assert.equal(
    lines[0].text,
    'Autumn Bingo is live: your team is 2nd of 5, 3 tiles nearly done · BOTW Phosani: not on the board yet · SOTW Mining: 3rd, 1.2M XP to 2nd',
  );
  assert.deepEqual(composeBrief(['bingo', 'weekly'], { bingo: null, weeklies: [], clanEvents: [], goal: null }), []);
});

test('Champion extras go on a second line', () => {
  const lines = composeBrief(['tiles', 'clanEvents', 'goals'], {
    bingo: { name: 'B', rank: null, teams: 0, nearly: ['Zulrah'] },
    weeklies: [],
    clanEvents: [{ title: 'Barbarian Assault', startsInMin: 95 }],
    goal: { text: '99 Slayer', pct: 87.4 },
  });
  assert.deepEqual(lines, [{ tone: 'info', text: 'Nearly done: Zulrah · Barbarian Assault in 1h 35m · Goal: 99 Slayer (87%)' }]);
});
