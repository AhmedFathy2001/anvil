// "Before you start" (lib/tileRequirements): what each kind of tile asks of a player and what it
// can't do — and the pure per-player verdicts behind its checks (lib/tileRequirementChecks).
//
// Run: npx tsx --test tests/tile-requirements.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLOG_TILE_MIN_PLUGIN,
  GUIDE_NEED_ENTRIES,
  NEED_GROUPS,
  needChecks,
  needCount,
  tileNeedHref,
  tileNeeds,
  type TileNeeds,
} from '../src/lib/tileRequirements.ts';
import {
  clogOwnedPagesVerdict,
  clogOwnedSlotsVerdict,
  clogSyncedVerdict,
  compareVersions,
  hiscoresRankedVerdict,
  pluginSeenVerdict,
  pluginVersionVerdict,
} from '../src/lib/tileRequirementChecks.ts';

const ids = (n: TileNeeds) => ({ req: n.requirements.map((x) => x.id), lim: n.limitations.map((x) => x.id) });

// ─── The registry ──────────────────────────────────────────────────────────────────────────────

test('every entry files under a guide group and has a stable anchor', () => {
  const groups = new Set(NEED_GROUPS.map((g) => g.key));
  const seen = new Set<string>();
  for (const e of GUIDE_NEED_ENTRIES) {
    assert.ok(groups.has(e.group), `${e.id} has unknown group ${e.group}`);
    assert.match(e.id, /^[a-z0-9-]+$/, `${e.id} is not a clean anchor`);
    assert.ok(!seen.has(e.id));
    seen.add(e.id);
    assert.ok(e.text.length > 10 && e.title.length > 3);
  }
  assert.equal(tileNeedHref('clog-chat-setting'), '/guide/tiles#clog-chat-setting');
});

test('a standard tile and a hand-completed tile need nothing', () => {
  assert.equal(needCount(tileNeeds({ tileType: 'standard' })), 0);
  assert.equal(needCount(tileNeeds({ tileType: 'kill', targetNpcs: '["Chicken"]', autoTrackDisabled: 1 })), 0);
});

test('clog new-slot tiles: chat setting, plugin version, screenshot, first-time only', () => {
  const n = tileNeeds({ tileType: 'clog', countMode: 'slots', requiredAmount: 3 } as never);
  assert.deepEqual(ids(n), {
    req: ['clog-chat-setting', 'clog-plugin-version', 'clog-screenshot'],
    lim: ['clog-first-time'],
  });
  assert.ok(n.requirements[1].text.includes(CLOG_TILE_MIN_PLUGIN));
  assert.deepEqual(needChecks(n).sort(), ['clog-owned', 'plugin-version']);
});

test('clog whole-page tiles: sync before the start, screenshot the page, one log, sync-only flagged', () => {
  const n = tileNeeds({ tileType: 'clog', countMode: 'complete', targetNpcs: '["Barrows Chests"]' });
  assert.deepEqual(ids(n), {
    req: ['clog-chat-setting', 'clog-plugin-version', 'clog-sync-before', 'clog-page-screenshot'],
    lim: ['clog-page-own-log', 'clog-sync-only'],
  });
  assert.deepEqual(needChecks(n).sort(), ['clog-owned', 'clog-synced', 'plugin-version']);
});

test('hiscores tiles: ranked for the named stat, lag, and the start baseline (gain basis only)', () => {
  const kc = tileNeeds({ statType: 'boss', trackedStat: 'zulrah', statBasis: 'gain' });
  assert.deepEqual(ids(kc), { req: ['hiscores-ranked'], lim: ['hiscores-lag', 'hiscores-baseline'] });
  assert.match(kc.requirements[0].text, /Zulrah/);
  assert.equal(kc.requirements[0].check, 'hiscores-ranked');
  const milestone = tileNeeds({ statType: 'skill', trackedStat: 'fishing', statBasis: 'milestone' });
  assert.deepEqual(ids(milestone).lim, ['hiscores-lag']);
});

test('plugin kill tiles: the plugin, and the image-less count ceiling', () => {
  const n = tileNeeds({ tileType: 'kill', targetNpcs: ['Chicken'] });
  assert.deepEqual(ids(n), { req: ['plugin-running'], lim: ['count-only-cap'] });
  assert.match(n.limitations[0].text, /at most 10 at once/);
});

test('a big-step counter says its own one-game ceiling', () => {
  const n = tileNeeds({ tileType: 'kill', targetNpcs: ["Giants' Foundry reputation"] });
  const cap = n.limitations.find((x) => x.id === 'count-only-cap');
  assert.ok(cap && /up to 200 at once/.test(cap.text), cap?.text);
});

test('an unverified counter is named; slayer masters are explained', () => {
  const n = tileNeeds({ tileType: 'kill', targetNpcs: ['Slayer tasks: Mortimer'] });
  const lim = ids(n).lim;
  assert.ok(lim.includes('unverified-counter'));
  assert.ok(lim.includes('slayer-masters'));
  assert.match(n.limitations.find((x) => x.id === 'unverified-counter')!.text, /Slayer tasks: Mortimer is a new counter/);
  // A confirmed counter carries no staff-check note.
  assert.ok(!ids(tileNeeds({ tileType: 'kill', targetNpcs: ['Tithe Farm points'] })).lim.includes('unverified-counter'));
});

test('cap_by: GOTR energy gets its own lines; any other cap names its counters', () => {
  const gotr = tileNeeds({
    tileType: 'kill',
    targetNpcs: ['Guardians of the Rift searches'],
    capBy: '["GOTR elemental energy","GOTR catalytic energy"]',
  });
  assert.deepEqual(ids(gotr).req, ['gotr-plugin']);
  assert.ok(ids(gotr).lim.includes('gotr-energy') && ids(gotr).lim.includes('gotr-old-plugin'));
  const other = tileNeeds({ tileType: 'kill', targetNpcs: ['Herbiboar'], capBy: ['Tithe Farm points'] });
  const cap = other.limitations.find((x) => x.id === 'counter-cap');
  assert.ok(cap && cap.text.includes('Tithe Farm points'));
  assert.deepEqual(ids(other).req, ['plugin-running']);
});

test('course laps need the lap counter; the Sepulchre does not', () => {
  assert.ok(ids(tileNeeds({ tileType: 'lap', targetNpcs: ['Ardougne Rooftop'] })).req.includes('lap-counter'));
  assert.ok(!ids(tileNeeds({ tileType: 'lap', targetNpcs: ['Hallowed Sepulchre'] })).req.includes('lap-counter'));
});

test('raid gates: party size, team-only, raid level; Barracuda rank tiles count runs', () => {
  const deathless = tileNeeds({ tileType: 'deathless', timedActivity: 'Tombs of Amascut', timeThresholdSeconds: 4, partyTeamOnly: 1, minRaidLevel: 300 });
  assert.deepEqual(ids(deathless).req, ['plugin-running', 'raid-party-size', 'raid-team-only', 'raid-min-level']);
  assert.match(deathless.requirements[1].text, /exactly 4 players/);
  assert.match(deathless.requirements[3].text, /raid level 300/);
  const timed = tileNeeds({ tileType: 'timed', timedActivity: 'Theatre of Blood', partySize: 1, timeThresholdSeconds: 1200 });
  assert.match(timed.requirements[1].text, /exactly 1 player\./);
  assert.ok(ids(tileNeeds({ tileType: 'timed', timedActivity: 'Gwenith Glide — Marlin' })).lim.includes('trial-runs'));
});

test('drops: manual-only items, pets, champion scrolls, normal DT2 bosses', () => {
  // 11995 = Pet chaos elemental; 6798 = Earth warrior champion scroll.
  assert.ok(ids(tileNeeds({ tileType: 'drop', trackedItemIds: '[11995]' })).lim.includes('pet-duplicate'));
  assert.ok(ids(tileNeeds({ tileType: 'drop', trackedItemIds: '[6798]' })).lim.includes('champion-scroll'));
  assert.ok(ids(tileNeeds({ tileType: 'drop', trackedItemIds: '[28276]', sourceNpcs: '["Vardorvis"]' })).lim.includes('dt2-awakened-loot'));
  assert.ok(ids(tileNeeds({ tileType: 'kill', targetNpcs: ['Duke Sucellus'] })).lim.includes('dt2-awakened-loot'));
  assert.ok(!ids(tileNeeds({ tileType: 'kill', targetNpcs: ['Vardorvis (awakened)'] })).lim.includes('dt2-awakened-loot'));
});

test('combos: the rule\'s own lines, then every part with its own list', () => {
  const n = tileNeeds({
    tileType: 'combo',
    comboRule: '{"mode":"any"}',
    trackingMode: 'individual',
    parts: [
      { id: 11, label: '100 Zulrah KC', statType: 'boss', trackedStat: 'zulrah' },
      { id: 12, label: '3 new log slots', tileType: 'clog', countMode: 'slots' },
    ],
  });
  assert.deepEqual(ids(n), { req: ['combo-part-rules'], lim: ['combo-whole-part', 'combo-solo', 'combo-locked'] });
  assert.equal(n.parts?.length, 2);
  assert.equal(n.parts?.[0].id, 11);
  assert.deepEqual(ids(n.parts![0].needs).req, ['hiscores-ranked']);
  assert.ok(ids(n.parts![1].needs).req.includes('clog-chat-setting'));
  assert.deepEqual(needChecks(n).sort(), ['clog-owned', 'hiscores-ranked', 'plugin-version']);

  const mix = tileNeeds({ tileType: 'combo', comboRule: { mode: 'mix' }, parts: [] });
  assert.deepEqual(ids(mix).lim, ['combo-mix-share', 'combo-locked']);
});

// ─── Per-player verdicts ───────────────────────────────────────────────────────────────────────

test('versions compare numerically', () => {
  assert.ok(compareVersions('1.13.3', '1.14.0')! < 0);
  assert.ok(compareVersions('1.14.0', '1.14')! === 0);
  assert.ok(compareVersions('1.14.1-beta', '1.14.0')! > 0);
  assert.ok(compareVersions('1.10.0', '1.9.9')! > 0);
  assert.equal(compareVersions('dev', '1.0.0'), null);
});

test('plugin version: too old is a problem, never-seen is unknown', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  assert.equal(pluginVersionVerdict({ version: '1.13.3', seenAt: '2026-11-01T00:00:00Z' }, '1.14.0').status, 'problem');
  assert.match(pluginVersionVerdict({ version: '1.13.3', seenAt: '2026-11-01T00:00:00Z' }, '1.14.0').text, /too old/);
  assert.equal(pluginVersionVerdict({ version: '1.14.0', seenAt: '2026-11-01T00:00:00Z' }, '1.14.0').status, 'ok');
  assert.equal(pluginVersionVerdict(null, '1.14.0').status, 'unknown');
  assert.equal(pluginSeenVerdict(null, now).status, 'unknown');
  assert.equal(pluginSeenVerdict({ version: '1.14.0', seenAt: '2026-11-02T08:00:00Z' }, now).status, 'ok');
  assert.match(pluginSeenVerdict({ version: '1.14.0', seenAt: '2026-11-02T08:00:00Z' }, now).text, /today/);
  assert.equal(pluginSeenVerdict({ version: '1.14.0', seenAt: '2026-08-01T00:00:00Z' }, now).status, 'unknown');
});

test('collection log: not synced, already owned, already-finished pages', () => {
  assert.equal(clogSyncedVerdict(false).status, 'problem');
  assert.match(clogSyncedVerdict(false).text, /haven’t synced your collection log/);
  assert.equal(clogSyncedVerdict(true).status, 'ok');

  const pool = new Set([1, 2, 3, 4]);
  assert.equal(clogOwnedSlotsVerdict({ synced: true, pool: null, ownedAtStart: new Set() }), null);
  assert.equal(clogOwnedSlotsVerdict({ synced: false, pool, ownedAtStart: new Set() })?.status, 'unknown');
  assert.match(clogOwnedSlotsVerdict({ synced: true, pool, ownedAtStart: new Set([1, 2]) })!.text, /already had 2 of the 4/);
  assert.equal(clogOwnedSlotsVerdict({ synced: true, pool, ownedAtStart: new Set([1, 2, 3, 4, 9]) })?.status, 'problem');

  const groups = [{ name: 'Barrows Chests', items: [1, 2] }, { name: 'Wintertodt', items: [3, 4] }];
  const pages = clogOwnedPagesVerdict({ synced: true, groups, ownedAtStart: new Set([1, 2, 3]) });
  assert.equal(pages?.status, 'problem');
  assert.match(pages!.text, /already finished Barrows Chests before the event, so it can’t count/);
  assert.equal(clogOwnedPagesVerdict({ synced: true, groups, ownedAtStart: new Set([1, 3]) })?.status, 'ok');
});

test('hiscores: unranked account, unranked stat, composite stat, no reading', () => {
  const base = { statType: 'boss', trackedStat: 'zulrah' };
  assert.equal(hiscoresRankedVerdict({ ...base, accountStatus: 'unranked', snapshot: null }).status, 'problem');
  assert.equal(hiscoresRankedVerdict({ ...base, accountStatus: 'active', snapshot: null }).status, 'unknown');
  const unranked = { skills: {}, bosses: { zulrah: { rank: -1, score: -1 } } };
  const v = hiscoresRankedVerdict({ ...base, accountStatus: 'active', snapshot: unranked });
  assert.equal(v.status, 'problem');
  assert.match(v.text, /not ranked on the hiscores for Zulrah/);
  const ranked = { skills: {}, bosses: { zulrah: { rank: 1234, score: 60 } } };
  assert.equal(hiscoresRankedVerdict({ ...base, accountStatus: 'active', snapshot: ranked }).status, 'ok');
  const cox = { skills: {}, bosses: { chambersOfXeric: { rank: -1, score: -1 }, chambersOfXericChallengeMode: { rank: 99, score: 10 } } };
  assert.equal(
    hiscoresRankedVerdict({ statType: 'boss', trackedStat: 'chambersOfXeric,chambersOfXericChallengeMode', accountStatus: 'active', snapshot: cox }).status,
    'ok',
  );
  const skill = { skills: { fishing: { rank: 5000, level: 80, xp: 2_000_000 } }, bosses: {} };
  assert.equal(hiscoresRankedVerdict({ statType: 'skill', trackedStat: 'fishing', accountStatus: 'active', snapshot: skill }).status, 'ok');
});
