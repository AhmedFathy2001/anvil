// The pre-trip check's next-trip target (lib/tripTarget): which source wins, what clears it, which
// guides and kills map to a trip, and the panel's "Checking for: …" line with its change and clear links. No database.
//
// Run: npx tsx --test tests/trip-target.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bossOfKey, canonicalKey, carriedTrip, contentForBoss, ownAlias, guideTarget, isTargetKey, lastKill, resolveTarget, TARGET_IDLE_MS, targetWhy, type TargetInputs } from '../src/lib/tripTarget.ts';
import { MOKHAIOTL_WAYSTONE } from '../src/lib/tripContent.ts';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const DOOM = 'm:Doom of Mokhaiotl';
const VARD = 'm:Vardorvis';
const inp = (x: Partial<TargetInputs>): TargetInputs => ({ state: null, guide: null, kcTimes: {}, ownKeys: [], now: NOW, ...x });

test('kills and guides map to trips, or to the player’s own saved setup, never to content with no definition', () => {
  assert.equal(contentForBoss('tombsOfAmascutExpertMode', []), 'toa');
  assert.equal(contentForBoss('theatreOfBloodHardMode', []), 'tob');
  assert.equal(contentForBoss('vorkath', []), 'vorkath');
  assert.equal(bossOfKey(DOOM), 'doomOfMokhaiotl');
  assert.equal(contentForBoss('doomOfMokhaiotl', []), 'doom', 'a deep-delve count is a Doom trip');
  assert.equal(contentForBoss('doomOfMokhaiotl', [DOOM]), 'doom', 'one key per trip: the hand-picked setup is only its source');
  assert.equal(canonicalKey(`${DOOM}#Delve 1`), 'doom');
  assert.equal(canonicalKey(VARD), VARD);
  assert.equal(ownAlias('doom', [DOOM, VARD]), DOOM, 'the setup saved by hand stands in for the trip');
  assert.equal(ownAlias('doom', [VARD]), null);
  assert.equal(contentForBoss('vardorvis', []), null, 'Vardorvis has no trip definition');
  assert.equal(contentForBoss('vardorvis', [VARD]), VARD, 'its own saved setup makes it one');
  assert.equal(guideTarget('tombs-of-amascut-entry', null, null, []), 'toa', 'the trip naming the guide');
  assert.equal(guideTarget('some-tob-guide', 'theatreOfBlood', 'Verzik Vitur#Phase 3', []), 'tob', 'the boss its block counts kc on');
  assert.equal(guideTarget('doom-guide', 'doomOfMokhaiotl', 'Doom of Mokhaiotl', []), 'doom');
  assert.equal(guideTarget('vard-guide', 'vardorvis', 'Vardorvis', []), null);
  assert.equal(guideTarget('doom-guide', null, 'Doom of Mokhaiotl#Normal', [DOOM]), DOOM, 'the block monster against a saved setup');
  assert.equal(guideTarget('fishing', null, null, ['toa']), null);
  assert.ok(isTargetKey('nex', []));
  assert.ok(!isTargetKey(DOOM, []));
  assert.ok(isTargetKey(DOOM, [DOOM]));
  assert.deepEqual(lastKill({ fishing: ago(1), vorkath: ago(30), zulrah: ago(10), notABoss: ago(0) })?.boss, 'zulrah', 'skills and activities are not kills');
});

test('pick beats the guide beats the last trip', () => {
  const guide = { key: 'cox', at: ago(5) };
  const kcTimes = { vorkath: ago(20) };
  assert.deepEqual(resolveTarget(inp({ state: { pick: { key: 'toa', at: ago(10) } }, guide, kcTimes })), { key: 'toa', source: 'pick' });
  assert.deepEqual(resolveTarget(inp({ guide, kcTimes })), { key: 'cox', source: 'guide' });
  assert.deepEqual(resolveTarget(inp({ kcTimes })), { key: 'vorkath', source: 'last' });
  assert.deepEqual(resolveTarget(inp({ guide: { key: null, at: ago(1) }, kcTimes })), { key: 'vorkath', source: 'last' }, 'a guide for no trip leaves the last trip');
  assert.equal(resolveTarget(inp({})), null);
});

test('a kc after a pick ends it: the last trip takes over', () => {
  const state = { pick: { key: 'toa', at: ago(30) } };
  assert.deepEqual(resolveTarget(inp({ state, kcTimes: { zulrah: ago(5) } })), { key: 'zulrah', source: 'last' });
  assert.deepEqual(resolveTarget(inp({ state, kcTimes: { zulrah: ago(40) } })), { key: 'toa', source: 'pick' }, 'a kill before the pick does not');
  // The kill's push landing a few seconds after the pick is the kill before it.
  assert.deepEqual(resolveTarget(inp({ state, kcTimes: { zulrah: new Date(Date.parse(state.pick.at) + 10_000).toISOString() } })), { key: 'toa', source: 'pick' });
  // Vardorvis without a saved setup: its kill ends the pick and nothing takes over.
  assert.equal(resolveTarget(inp({ state, kcTimes: { vardorvis: ago(5) } })), null);
  assert.deepEqual(resolveTarget(inp({ kcTimes: { vardorvis: ago(5) }, ownKeys: [VARD] })), { key: VARD, source: 'last' });
  assert.deepEqual(resolveTarget(inp({ kcTimes: { doomOfMokhaiotl: ago(5) } })), { key: 'doom', source: 'last' }, 'a deep delve: last trip Doom');
});

test('carried: a waystone worn or packed makes Doom the target at any bank; a pick beats it; gone, it falls back', () => {
  const kcTimes = { vorkath: ago(20) };
  const carried = { ids: [6685, MOKHAIOTL_WAYSTONE], at: ago(1) };
  assert.equal(carriedTrip([6685]), null);
  const t = resolveTarget(inp({ carried, kcTimes, guide: { key: 'cox', at: ago(5) } }));
  assert.deepEqual(t, { key: 'doom', source: 'carried' }, 'beats the guide and the last trip');
  assert.equal(targetWhy(t!), 'carrying a waystone');
  assert.deepEqual(resolveTarget(inp({ carried, state: { pick: { key: 'toa', at: ago(3) } } })), { key: 'toa', source: 'pick' });
  // The waystone used or banked: the next reading has none, and the last trip takes over again.
  assert.deepEqual(resolveTarget(inp({ carried: { ids: [6685], at: ago(0) }, kcTimes })), { key: 'vorkath', source: 'last' });
  assert.equal(resolveTarget(inp({ carried, state: { clearedAt: ago(0) } })), null, 'a trip end after the reading clears it');
});

test('clears: a trip end or "clear", two hours idle, a pick that is no longer a target', () => {
  const kcTimes = { vorkath: ago(20) };
  assert.equal(resolveTarget(inp({ state: { clearedAt: ago(10) }, kcTimes, guide: { key: 'cox', at: ago(15) } })), null, 'older sources are gone');
  assert.deepEqual(resolveTarget(inp({ state: { clearedAt: ago(30) }, kcTimes })), { key: 'vorkath', source: 'last' }, 'a kill after the clear counts again');
  const idle = TARGET_IDLE_MS / 60_000 + 1;
  assert.equal(resolveTarget(inp({ state: { pick: { key: 'toa', at: ago(idle) } } })), null);
  assert.equal(resolveTarget(inp({ kcTimes: { vorkath: ago(idle) } })), null);
  assert.deepEqual(resolveTarget(inp({ state: { pick: { key: VARD, at: ago(5) } } })), { key: VARD, source: 'pick' }, 'any monster can be picked');
  assert.deepEqual(resolveTarget(inp({ state: { pick: { key: DOOM, at: ago(5) } } })), { key: 'doom', source: 'pick' }, 'Doom picked by hand is the Doom trip');
  assert.equal(resolveTarget(inp({ state: { pick: { key: 'nope', at: ago(5) } } })), null, 'not a trip or a monster');
});

// ── the panel ──────────────────────────────────────────────────────────────────────────────

const base = { region: '12598', regionName: null, fromRegion: false, source: 'calc' as const, sourceLine: 'Worked out from your bank', guide: null, check: { rows: [], info: [], unknown: [] }, status: 'ready' as const, checkedAt: '18:42', hasOwn: true, canSave: true, options: [{ key: 'toa', short: 'ToA', name: 'Tombs of Amascut' }, { key: DOOM, short: 'Doom of Mokhaiotl', name: 'Doom of Mokhaiotl (your setup)' }], monsters: [{ key: 'Doom of Mokhaiotl', name: 'Doom of Mokhaiotl' }] };

test('panel: "Checking for: Doom (last trip)", chips set the target, clear, again keeps it', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const json = JSON.stringify(tripPanelUi({ ...base, content: { key: DOOM, name: 'Doom of Mokhaiotl', short: 'Doom of Mokhaiotl' }, target: { key: DOOM, short: 'Doom of Mokhaiotl', why: 'last trip' }, fromTarget: true }));
  assert.ok(json.includes('"Checking for: "') && json.includes(' (last trip)"'));
  assert.ok(json.includes(`"target":"${DOOM}"`), 'a chip makes it the target');
  assert.ok(json.includes('"target":"clear"'));
  assert.ok(json.includes(`"content":"${DOOM}"`), 'the monster list only looks');
  // "Check again" asks for the target again, not a hand-picked content.
  const again = JSON.parse(json, (_k, v) => v);
  const loads: Record<string, string>[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const o = n as { a?: string; v?: string; args?: Record<string, string> };
    if (o.a === 'load' && o.v === 'trip' && o.args && !o.args.target && !o.args.content) loads.push(o.args);
    Object.values(n).forEach(walk);
  };
  walk(again);
  assert.ok(loads.length > 0, 'a plain re-check');
});

test('panel: in a trip region the region’s trip shows, the target on its own line', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const json = JSON.stringify(tripPanelUi({ ...base, region: '13454', regionName: 'the ToA lobby', fromRegion: true, content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, target: { key: 'vorkath', short: 'Vorkath', why: 'last trip' }, fromTarget: false }));
  assert.ok(json.includes('picked from the ToA lobby'));
  assert.ok(json.includes('Next trip: Vorkath (last trip)'));
  assert.ok(!json.includes('Checking for: '));
});

test('guide: "Going here next" sets the target', async () => {
  const { guidePanelUi } = await import('../src/lib/pluginUi/guidesUi.ts');
  const d = { id: 1, slug: 'vorkath-guide', title: 'Vorkath', kind: 'Bossing', tier: null, tiers: [], byline: '', rankGlyph: null, keep: {}, setups: [], current: null, dps: '', usingFallbacks: null, slots: [], inventory: [], pouch: [], spellbook: '', spellbookId: 0, spells: [], hasMarkers: 0, missing: null, checkedAt: null, checklist: [], setupSteps: [], body: [], tips: [], mistakes: [], upgrades: [], community: [], phase2: true, alternatives: null, route: null };
  const json = JSON.stringify(guidePanelUi({ ...d, goingNext: { key: 'vorkath', short: 'Vorkath' } } as never));
  assert.ok(json.includes('Going here next') && json.includes('"target":"vorkath"'));
  assert.ok(!JSON.stringify(guidePanelUi(d as never)).includes('Going here next'));
});
