// Game-mode worlds (lib/worldModes): which mode a world is, where its posts go, how they're marked.
// Pure — no database.
//
// Run: npx tsx --test tests/world-modes.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  markMode,
  modeFeedId,
  modeKeyFromFeedId,
  modeKeyFromWebhookKey,
  modeWebhookKey,
  parseSeenModes,
  resolveWorldMode,
  routeModePost,
  withSeenMode,
  MAX_SEEN_MODES,
} from '../src/lib/worldModes.ts';

const key = (types: string, activity?: string) => resolveWorldMode(types, activity)?.key ?? null;

test('main-game worlds are no mode, whatever the activity says', () => {
  assert.equal(key('MEMBERS'), null);
  assert.equal(key('MEMBERS,SKILL_TOTAL', 'Skill total 2000'), null);
  assert.equal(key('MEMBERS,PVP,HIGH_RISK', 'High Risk World'), null);
  assert.equal(key('MEMBERS', 'Deadman practice?'), null, 'only a flag makes a separate save');
  assert.equal(key('MEMBERS,LAST_MAN_STANDING,PVP_ARENA,NOSAVE_MODE'), null, 'minigame worlds stay main');
  assert.equal(key(''), null);
  assert.equal(key(undefined as unknown as string), null, 'an older plugin sends nothing');
});

test('catalogued modes from flags alone', () => {
  assert.equal(key('MEMBERS,SEASONAL'), 'leagues');
  assert.equal(key('DEADMAN,MEMBERS'), 'deadman');
  assert.equal(key('DEADMAN,MEMBERS,SEASONAL'), 'seasonal-deadman');
  assert.equal(key('HARDCORE_MAIN,MEMBERS'), 'hardcore');
  assert.equal(key('FRESH_START_WORLD,MEMBERS'), 'fresh-start');
  assert.equal(key('TOURNAMENT_WORLD'), 'tournament');
  assert.equal(key('BETA_WORLD,MEMBERS'), 'beta');
});

test('the activity line names the mode more precisely than the flags', () => {
  assert.equal(key('MEMBERS,SEASONAL', 'Leagues VI - Raging Echoes'), 'leagues');
  assert.equal(key('MEMBERS,SEASONAL', 'Grid Master'), 'grid-master', 'Grid Master on a SEASONAL world is not Leagues');
  assert.equal(key('DEADMAN,MEMBERS,SEASONAL', 'Deadman: Annihilation'), 'seasonal-deadman');
  assert.equal(key('DEADMAN,MEMBERS', 'Deadman'), 'deadman');
});

test('a mode nobody has catalogued runs itself', () => {
  // New mode on a SEASONAL world with an activity we don't know: named from the activity.
  const m = resolveWorldMode('MEMBERS,SEASONAL', 'Echo Rush II');
  assert.deepEqual(m, { key: 'echo-rush', label: 'Echo Rush', icon: null, known: false });
  // A flag RuneLite added after this file was written.
  const f = resolveWorldMode('MEMBERS,SKYBLOCK_WORLD', null);
  assert.equal(f?.key, 'skyblock-world');
  assert.equal(f?.known, false);
  // …named from its activity when there is one.
  assert.equal(key('MEMBERS,SKYBLOCK_WORLD', 'Skyblock'), 'skyblock');
  // …and a catalogued name wins over a new flag.
  assert.equal(key('MEMBERS,GRIDMASTER', 'Grid Master'), 'grid-master');
});

test('junk in the headers is ignored, not trusted', () => {
  assert.equal(key('members,seasonal'), 'leagues', 'case is normalised');
  assert.equal(key('<script>,MEMBERS'), null, 'a non-flag token is dropped');
  assert.equal(key('MEMBERS,SEASONAL', '\u0000\u0007'), 'leagues', 'control characters are stripped');
});

test('settings keys: Leagues keeps its old ones', () => {
  assert.equal(modeWebhookKey('leagues'), 'webhook_leagues');
  assert.equal(modeWebhookKey('deadman'), 'webhook_mode_deadman');
  assert.equal(modeFeedId('leagues'), 'leagues');
  assert.equal(modeFeedId('grid-master'), 'mode:grid-master');
  assert.equal(modeKeyFromFeedId('mode:grid-master'), 'grid-master');
  assert.equal(modeKeyFromFeedId('mode:../x'), null);
  assert.equal(modeKeyFromFeedId('rareDrops'), null);
  assert.equal(modeKeyFromWebhookKey('webhook_mode_deadman'), 'deadman');
  assert.equal(modeKeyFromWebhookKey('webhook_leagues'), 'leagues');
  assert.equal(modeKeyFromWebhookKey('webhook_rare_drops'), null);
});

test('routing: off is nowhere, the mode channel wins only with the switch on, else the normal one', () => {
  const base = { split: true, modeOff: false, kindsOff: new Set<string>(), modeHook: 'M', normalHook: 'N' };
  assert.equal(routeModePost('rareDrops', base), 'M');
  assert.equal(routeModePost('rareDrops', { ...base, split: false }), 'N', 'master switch off');
  assert.equal(routeModePost('rareDrops', { ...base, modeHook: null }), 'N', 'no mode channel set');
  assert.equal(routeModePost('rareDrops', { ...base, modeOff: true }), null);
  assert.equal(routeModePost('deaths', { ...base, kindsOff: new Set(['deaths']) }), null);
  assert.equal(routeModePost('rareDrops', { ...base, kindsOff: new Set(['deaths']) }), 'M');
  assert.equal(routeModePost('rareDrops', { ...base, modeHook: null, normalHook: null }), null);
});

test('seen modes: unknown ones are remembered once, bounded', () => {
  const echo = resolveWorldMode('MEMBERS,SEASONAL', 'Echo Rush')!;
  assert.deepEqual(withSeenMode([], echo), [{ key: 'echo-rush', label: 'Echo Rush' }]);
  assert.equal(withSeenMode([{ key: 'echo-rush', label: 'Echo Rush' }], echo), null);
  assert.equal(withSeenMode([], resolveWorldMode('DEADMAN', null)!), null, 'catalogued modes are always listed');
  const full = Array.from({ length: MAX_SEEN_MODES }, (_, i) => ({ key: `m${i}`, label: `M${i}` }));
  assert.equal(withSeenMode(full, echo), null);
  assert.deepEqual(parseSeenModes('[{"key":"echo-rush","label":"Echo Rush"},{"key":"../x","label":"bad"},7]'), [
    { key: 'echo-rush', label: 'Echo Rush' },
  ]);
  assert.deepEqual(parseSeenModes('not json'), []);
});

test('marking: label once, the mode art only when the post has none', () => {
  assert.deepEqual(markMode({ title: 'Twisted bow' }, 'Deadman', 'I'), { title: '[Deadman] Twisted bow', thumbnail: { url: 'I' } });
  assert.deepEqual(markMode({ title: '[Deadman] Twisted bow' }, 'Deadman', 'I')?.title, '[Deadman] Twisted bow');
  assert.deepEqual(markMode({ title: '[Seasonal] Twisted bow' }, 'Leagues', null), { title: '[Leagues] Twisted bow' });
  assert.deepEqual(markMode({ title: 'x', thumbnail: { url: 'item' } }, 'Leagues', 'I')?.thumbnail, { url: 'item' });
  assert.equal(markMode(null, 'Deadman', 'I'), null);
});

test('a board counts only the game modes it names', async () => {
  const { parseEventRules, validateEventRules, mergeEventRulesPatch } = await import('../src/lib/eventRules.ts');
  const { worldModeIgnored } = await import('../src/lib/worldModeRequest.ts');
  assert.deepEqual(parseEventRules(null).worldModes, [], 'default: none count');
  const saved = validateEventRules({ worldModes: ['leagues', 'leagues', 'deadman'] });
  assert.ok('rules' in saved && saved.rules);
  assert.deepEqual(parseEventRules(saved.rules).worldModes, ['leagues', 'deadman']);
  assert.ok('error' in validateEventRules({ worldModes: ['../x'] }));
  assert.ok('error' in validateEventRules({ worldModes: 'leagues' }));
  // Clearing it leaves nothing stored; an unrelated edit keeps it.
  const cleared = validateEventRules(mergeEventRulesPatch(saved.rules, { worldModes: null }));
  assert.ok('rules' in cleared && cleared.rules === null);
  const kept = validateEventRules(mergeEventRulesPatch(saved.rules, { firstBonus: 5 }));
  assert.ok('rules' in kept && kept.rules);
  assert.deepEqual(parseEventRules(kept.rules).worldModes, ['leagues', 'deadman']);

  const onLeagues = new Request('http://x', { headers: { 'X-World-Types': 'MEMBERS,SEASONAL' } });
  assert.equal(worldModeIgnored(onLeagues, ['leagues']), null, 'counted');
  assert.equal(worldModeIgnored(onLeagues, ['deadman'])?.status, 202, 'another mode: ignored');
  assert.equal(worldModeIgnored(new Request('http://x'), []), null, 'the main game always counts');
});
