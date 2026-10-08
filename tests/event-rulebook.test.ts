// The board's rules (lib/rulesMechanics) and the Discord mark URL (lib/clanMarkUrl) — pure halves.
//
// Run: npx tsx --test tests/event-rulebook.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickRulebook, buildRulesEmbeds, mechanicsLines, type RulesFacts } from '../src/lib/rulesMechanics.ts';
import { clanMarkUrl } from '../src/lib/clanMarkUrl.ts';
import { DEFAULT_EVENT_RULES, parseEventRules, validateEventRules } from '../src/lib/eventRules.ts';
import { en } from '../src/lib/discordI18n/index.ts';

test('pickRulebook: the event text wins over the host clan', () => {
  const r = pickRulebook('Board rules', 'Clan rules', 'https://x/rules', 'Host');
  assert.equal(r.text, 'Board rules');
  assert.equal(r.source, 'event');
  assert.equal(r.url, 'https://x/rules');
});

test('pickRulebook: blank event text falls back to the host clan', () => {
  const r = pickRulebook('   ', 'Clan rules', null, 'Host');
  assert.equal(r.text, 'Clan rules');
  assert.equal(r.source, 'clan');
  assert.equal(r.hostClanName, 'Host');
});

test('pickRulebook: a link alone is still a rulebook; nothing at all is none', () => {
  assert.equal(pickRulebook(null, null, 'https://x', 'H').source, 'clan');
  const none = pickRulebook(null, '', '  ', 'H');
  assert.equal(none.source, 'none');
  assert.equal(none.text, null);
});

const facts = (over: Partial<RulesFacts> = {}): RulesFacts => ({
  event: { id: 1, name: 'Autumn Bingo', scoringMode: 'tiles', format: 'bingo', tilesRevealed: true, playerCount: 10 },
  rules: DEFAULT_EVENT_RULES,
  pool: 0,
  fee: null,
  missionCounts: { total: 0, announced: 0 },
  boardTiles: [{ trackedStat: null }],
  rulesMessage: null,
  rulebook: pickRulebook('Keep a screenshot.', null, null, 'The AFK Spot'),
  ...over,
});

test('buildRulesEmbeds: mechanics embed + rulebook embed titled with the HOST', () => {
  const embeds = buildRulesEmbeds(en, facts(), { origin: 'https://anvilosrs.com/c/guest', footer: '-# Guest · Autumn Bingo' });
  assert.equal(embeds.length, 2);
  assert.match(embeds[0].title ?? '', /Autumn Bingo/);
  assert.match(embeds[0].description ?? '', /Guest · Autumn Bingo/);
  assert.match(embeds[1].title ?? '', /The AFK Spot/);
  assert.equal(embeds[1].description, 'Keep a screenshot.');
});

test('buildRulesEmbeds: no rulebook → mechanics only', () => {
  const embeds = buildRulesEmbeds(en, facts({ rulebook: pickRulebook(null, null, null, 'H') }), { origin: null });
  assert.equal(embeds.length, 1);
});

test('buildRulesEmbeds: an event-specific Discord message replaces the generated mechanics body', () => {
  const embeds = buildRulesEmbeds(en, facts({ rulesMessage: 'Custom rules for this bingo.' }), {
    origin: 'https://anvilosrs.com',
    footer: '-# context',
  });
  assert.match(embeds[0].description ?? '', /^Custom rules for this bingo\./);
  assert.match(embeds[0].description ?? '', /context$/);
  assert.doesNotMatch(embeds[0].description ?? '', /Scoring/);
});

test('buildRulesEmbeds: a long rulebook is trimmed and points at the full link', () => {
  const long = 'x'.repeat(6000);
  const embeds = buildRulesEmbeds(en, facts({ rulebook: pickRulebook(long, null, 'https://x/full', 'H') }), { origin: null });
  assert.ok((embeds[1].description ?? '').length <= 4096);
  assert.match(embeds[1].description ?? '', /https:\/\/x\/full/);
});

test('mechanicsLines: lockout and first bonus show only when on', () => {
  const off = mechanicsLines(en, facts().event, DEFAULT_EVENT_RULES, 0, null, { total: 0, announced: 0 });
  const on = mechanicsLines(en, facts().event, { ...DEFAULT_EVENT_RULES, lockout: true, firstBonus: 3 }, 0, null, { total: 0, announced: 0 });
  assert.ok(on.length >= off.length + 2);
  assert.ok(on.some((l) => l.includes('+3')));
});

test('rulesAtStart: on by default, only an explicit false turns it off, and off survives validation', () => {
  assert.equal(parseEventRules(null).rulesAtStart, true);
  assert.equal(parseEventRules('{}').rulesAtStart, true);
  assert.equal(parseEventRules('{"rulesAtStart":false}').rulesAtStart, false);
  assert.deepEqual(validateEventRules({ rulesAtStart: true }), { rules: null });
  const off = validateEventRules({ rulesAtStart: false });
  assert.ok('rules' in off && off.rules && JSON.parse(off.rules).rulesAtStart === false);
  assert.ok('error' in validateEventRules({ rulesAtStart: 'no' }));
});

test('clanMarkUrl: versioned by the logo, stable otherwise', () => {
  const a = clanMarkUrl('https://anvilosrs.com/c/afk', 'theafkspot', null);
  const b = clanMarkUrl('https://anvilosrs.com', 'theafkspot', 'https://r2/logo.webp');
  const c = clanMarkUrl('https://anvilosrs.com', 'theafkspot', 'https://r2/logo.webp');
  const d = clanMarkUrl('https://anvilosrs.com', 'theafkspot', 'https://r2/logo2.webp');
  assert.match(a, /^https:\/\/anvilosrs\.com\/api\/og\/crest\/theafkspot\?v=[0-9a-z]+$/);
  assert.notEqual(a, b);
  assert.equal(b, c);
  assert.notEqual(b, d);
});
