import test from 'node:test';
import assert from 'node:assert/strict';

import bossHiscoreIcons from '../src/data/bossHiscoreIcons.json';
import { BOSSES } from '../src/lib/constants.ts';
import { normalizeWikiFile } from '../src/lib/assetUrls.ts';
import {
  bossIconForStatKey,
  bossIconUrl,
  bossStatKeyFor,
  competitionIconUrl,
  competitionImageUrl,
  deriveTileIcon,
} from '../src/lib/tileIcons.ts';

const ICONS = bossHiscoreIcons as Record<string, string>;

// Boss icons are RuneLite's hiscores sprites (as the wiki files them), so a boss on the site matches
// the one a member picked in RuneLite. Nex was a Nihil horn before this.

test('every BOSSES key has a hiscores icon, and every icon is a servable wiki file', () => {
  const missing = BOSSES.filter((b) => !ICONS[b.key]).map((b) => b.key);
  assert.deepEqual(missing, []);
  for (const [key, file] of Object.entries(ICONS)) {
    assert.ok(BOSSES.some((b) => b.key === key), `${key} is not a BOSSES key`);
    assert.ok(normalizeWikiFile(file), `${key}: ${file} is not a servable wiki file`);
    assert.match(file, /icon/i, `${key}: ${file} is not a hiscores icon`);
  }
});

test('Nex is the Nex icon, not its drop', () => {
  assert.equal(bossIconForStatKey('nex'), '/img/wiki/Nex_icon.png');
  assert.equal(bossIconUrl('Nex'), '/img/wiki/Nex_icon.png');
  assert.equal(competitionIconUrl('boss', 'nex'), '/img/wiki/Nex_icon.png');
  assert.equal(deriveTileIcon({ tileType: 'standard', trackedStat: 'nex', statType: 'boss' }), '/img/wiki/Nex_icon.png');
  assert.equal(deriveTileIcon({ tileType: 'kill', targetNpcs: '["Nex"]' }), '/img/wiki/Nex_icon.png');
});

test('names resolve to their hiscores key: labels, keys, NPC names, clog pages, long mode names', () => {
  for (const b of BOSSES) {
    assert.equal(bossStatKeyFor(b.label), b.key, b.label);
    assert.equal(bossStatKeyFor(b.key), b.key, b.key);
  }
  assert.equal(bossStatKeyFor('The Nightmare'), 'nightmare');
  assert.equal(bossStatKeyFor('Chambers of Xeric: Challenge Mode'), 'chambersOfXericChallengeMode');
  assert.equal(bossStatKeyFor('Crystalline Hunllef'), 'gauntlet');
  assert.equal(bossStatKeyFor('Callisto and Artio'), 'callisto');
  assert.equal(bossStatKeyFor('Thermonuclear smoke devil'), 'thermonuclearSmokeDevil');
  assert.equal(bossStatKeyFor('Not a boss'), null);
});

test('no hiscores icon falls back to the old picture/drop; big hero art keeps the monster render', () => {
  // A clog activity that is not a hiscores boss still gets art.
  assert.ok(bossIconUrl('Barbarian Assault'));
  assert.notEqual(bossIconUrl('Barbarian Assault'), null);
  // The Boss of the Week link card draws hundreds of px wide: the monster render, not the sprite.
  assert.match(competitionImageUrl('boss', 'nex') ?? '', /Nex\.png/);
  assert.equal(competitionIconUrl('skill', 'mining'), '/img/wiki/Mining_icon.png');
});

test('Discord asks for the 4× sprite; a fallback picture is never scaled', () => {
  assert.equal(competitionIconUrl('boss', 'nex', 4), '/img/wiki/Nex_icon.png?x=4');
  assert.equal(bossIconUrl('Nex', 4), '/img/wiki/Nex_icon.png?x=4');
  assert.equal(competitionIconUrl('skill', 'mining', 4), '/img/wiki/Mining_icon.png?x=4');
  assert.doesNotMatch(bossIconUrl('Barbarian Assault', 4) ?? '', /\?x=/);
});
