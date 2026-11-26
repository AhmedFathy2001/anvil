// Boss Rush (lib/bossRushRules, lib/itemHunt rule 'rush'): the rules as stored, the kills the plugin
// saw push to push, and the standings: kills + each listed drop's points - deaths.
//
// Run: TESTS_OK=1 npx tsx --test tests/boss-rush.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_RUSH, RUSH_FASTEST_KILL_MS, RUSH_SITTING_MS, SYNERGY_WINDOW_MS, rushFromInput, rushKcStep, rushRulesWords, rushSynergy, rushTotal, withGroupKills } from '@/lib/bossRushRules';
import { type HuntDrop, defaultHuntTitle, huntFromInput, huntPanelLine, isRush, matchHuntReport, rankHunt, rushBossKeys, serializeHunt, parseHunt } from '@/lib/itemHunt';

const T0 = Date.parse('2026-11-01T00:00:00Z');
const window = { startMs: T0, endMs: T0 + 7 * 86_400_000 };

function rush(extra: Record<string, unknown> = {}) {
  const r = huntFromInput({
    v: 2,
    rule: 'rush',
    bosses: ['vorkath', 'zulrah'],
    items: [
      { id: 22006, name: 'Skeletal visage', sources: ['Vorkath'], points: 10 },
      { id: 12922, name: 'Tanzanite fang', sources: ['Zulrah'], points: 5 },
      { id: 21992, name: 'Vorki', points: 0 },
    ],
    ...extra,
  });
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.config;
}

function drop(rsn: string, itemId: number, at: number, status = 'counted'): HuntDrop {
  return {
    id: at,
    rsnKey: rsn.toLowerCase(),
    itemId,
    itemName: String(itemId),
    quantity: 1,
    source: null,
    kc: null,
    xp: null,
    statSkill: null,
    statBasis: null,
    occurredAt: new Date(at).toISOString(),
    origin: 'plugin',
    status,
    confirmed: false,
    flagReason: null,
    approvedBy: null,
    screenshotUrl: null,
    note: null,
  };
}

test('a rush is stored with its bosses, its scoring and the points the host gave each drop', () => {
  const c = rush({ rush: { kcPoints: 2, deathPoints: 3, kcSource: 'any', deaths: false, floorZero: false }, ends: { kind: 'drops', n: 3, by: 'all' } });
  assert.ok(isRush(c));
  assert.deepEqual(rushBossKeys(c), ['vorkath', 'zulrah']);
  assert.equal(c.killsOf, 'vorkath,zulrah');
  assert.deepEqual(c.rush, { kcPoints: 2, kcSource: 'any', deaths: false, deathPoints: 3, floorZero: false, synergy: { on: true, perMate: 1, max: 3 } });
  // It always runs to its date.
  assert.deepEqual(c.ends, { kind: 'date' });
  // A drop left at 0 stays listed.
  assert.equal(c.items.find((i) => i.id === 21992)?.points, 0);
  assert.equal(c.items.find((i) => i.id === 21992)?.pet, true);
  // Round trip.
  assert.deepEqual(parseHunt(serializeHunt(c)), c);
  assert.equal(defaultHuntTitle(c), 'Boss Rush: Vorkath + Zulrah');
});

test('a rush needs a boss, and defaults what it was not told', () => {
  const none = huntFromInput({ v: 2, rule: 'rush', bosses: ['notABoss'] });
  assert.equal(none.ok, false);
  assert.deepEqual(rushFromInput({}), DEFAULT_RUSH);
  assert.equal(rushRulesWords(DEFAULT_RUSH), '1 kill = 1 pt · each death -1 · plugin kills only · Clan Synergy +1 per clanmate with you, up to +3 a kill');
});

test('a listed drop counts from its source; anything else does not', () => {
  const c = rush();
  assert.ok(matchHuntReport(c, { kind: 'drop', itemId: 22006, itemName: 'Skeletal visage', source: 'Vorkath', occurredAt: '', dedupKey: 'k' }));
  assert.equal(matchHuntReport(c, { kind: 'drop', itemId: 22006, itemName: 'Skeletal visage', source: 'Zulrah', occurredAt: '', dedupKey: 'k' }), null);
  assert.equal(matchHuntReport(c, { kind: 'drop', itemId: 536, itemName: 'Dragon bones', source: 'Vorkath', occurredAt: '', dedupKey: 'k' }), null);
  assert.equal(matchHuntReport(c, { kind: 'death', source: 'Vorkath', occurredAt: '', dedupKey: 'k' }), null);
});

test('standings: kills + drop points - deaths, never below 0 unless the host lets it', () => {
  const c = rush();
  const entrants = [
    { rsn: 'Alice', statGain: 999, rush: { kc: 100, deaths: 4 } },
    { rsn: 'Bob', statGain: 999, rush: { kc: 90, deaths: 0 } },
    { rsn: 'Cara', statGain: 0, rush: { kc: 1, deaths: 9 } },
  ];
  const drops = [drop('Bob', 22006, T0 + 1000), drop('Alice', 12922, T0 + 2000), drop('Alice', 21992, T0 + 3000), drop('Bob', 12922, T0 + 4000, 'review')];
  const rows = rankHunt(c, entrants, drops, window);
  assert.deepEqual(rows.map((r) => [r.rsn, r.count]), [['Alice', 101], ['Bob', 100], ['Cara', 0]]);
  assert.deepEqual(rows[0].rush, { kc: 100, deaths: 4, bonus: 5, synergy: 0, total: 101 });
  assert.equal(huntPanelLine(c, rows[0], null).figure, '101 pts');
  assert.equal(huntPanelLine(c, rows[0], null).sub, '100 kc · +5 drops · 4 deaths');

  const below = rush({ rush: { floorZero: false } });
  assert.equal(rankHunt(below, entrants, [], window).find((r) => r.rsn === 'Cara')?.count, -8);
  const deathless = rush({ rush: { deaths: false } });
  assert.equal(rankHunt(deathless, entrants, [], window).find((r) => r.rsn === 'Alice')?.count, 100);
});

test('a tie on points goes to the one with more kills', () => {
  const rows = rankHunt(rush(), [{ rsn: 'A', statGain: 0, rush: { kc: 10, deaths: 0 } }, { rsn: 'B', statGain: 0, rush: { kc: 0, deaths: 0 } }], [drop('B', 22006, T0 + 1)], window);
  assert.deepEqual(rows.map((r) => r.rsn), ['A', 'B']);
});

test('rushTotal', () => {
  assert.deepEqual(rushTotal({ ...DEFAULT_RUSH, kcPoints: 2, deathPoints: 5 }, 10, 3, 7), { kc: 10, deaths: 3, bonus: 7, synergy: 0, total: 12 });
  assert.equal(rushTotal(DEFAULT_RUSH, 10, 0, 0, 6).total, 16);
  assert.equal(rushTotal({ ...DEFAULT_RUSH, synergy: { on: false, perMate: 1, max: 3 } }, 10, 0, 0, 6).total, 10);
});

test('kills the plugin watched count push to push', () => {
  const keys = ['vorkath'];
  // First push of the rush, measured from the start: one kill, however far the count moved.
  let s = rushKcStep({ pushed: { vorkath: 105 }, bossKeys: keys, seen: null, start: { vorkath: 100 }, startMs: T0, nowMs: T0 + 3_600_000 });
  assert.equal(s.credit, 1);
  // Within the sitting: the whole rise, batched kills included.
  s = rushKcStep({ pushed: { vorkath: 107 }, bossKeys: keys, seen: s.seen, start: null, startMs: T0, nowMs: T0 + 3_600_000 + 60_000 });
  assert.equal(s.credit, 2);
  // A rise faster than a kill can come round is capped.
  s = rushKcStep({ pushed: { vorkath: 150 }, bossKeys: keys, seen: s.seen, start: null, startMs: T0, nowMs: T0 + 3_600_000 + 60_000 + RUSH_FASTEST_KILL_MS * 2 });
  assert.equal(s.credit, 2);
  // After a gap (plugin off, another client): one kill, not the jump.
  const later = T0 + 3_600_000 + 60_000 + RUSH_FASTEST_KILL_MS * 2 + RUSH_SITTING_MS + 1;
  s = rushKcStep({ pushed: { vorkath: 400 }, bossKeys: keys, seen: s.seen, start: null, startMs: T0, nowMs: later });
  assert.equal(s.credit, 1);
  assert.deepEqual(s.seen.vorkath, [400, later]);
  // A stale, lower reading credits nothing and is not the new line.
  const stale = rushKcStep({ pushed: { vorkath: 390 }, bossKeys: keys, seen: s.seen, start: null, startMs: T0, nowMs: later + 1000 });
  assert.equal(stale.credit, 0);
  assert.deepEqual(stale.seen.vorkath, [400, later]);
});

test('a boss with no starting count, and keys that are not the rush’s', () => {
  const s = rushKcStep({ pushed: { vorkath: 3, zulrah: 50 }, bossKeys: ['vorkath'], seen: null, start: null, startMs: T0, nowMs: T0 + 1 });
  assert.equal(s.credit, 1);
  assert.deepEqual(Object.keys(s.seen), ['vorkath']);
});

test('a raid death is the raid’s, whatever monster the plugin named', async () => {
  const { raidOfNpc, raidKeys } = await import('@/lib/raidNpcs');
  const { settleDeathSource } = await import('@/lib/deathSource');
  assert.equal(raidOfNpc('Great Olm'), 'cox');
  assert.equal(raidOfNpc('Great Olm (Left claw)'), 'cox');
  assert.equal(raidOfNpc('Deathly mage'), 'cox');
  assert.equal(raidOfNpc('Verzik Vitur'), 'tob');
  assert.equal(raidOfNpc('Nylocas Hagios'), 'tob');
  assert.equal(raidOfNpc("Tumeken's Warden"), 'toa');
  assert.equal(raidOfNpc('Baboon Brawler'), 'toa');
  assert.equal(raidOfNpc('Vorkath'), null);
  assert.equal(raidOfNpc('Corea'), null);
  assert.deepEqual(raidKeys('toa'), ['tombsOfAmascut', 'tombsOfAmascutExpertMode']);
  assert.deepEqual(raidKeys('nonsense'), []);

  // A lingering scarab: the feed blanks the killer, the raid is still known.
  const scarab: Record<string, unknown> = { kind: 'death', source: 'Agile Scarab', sourceKind: 'npc' };
  settleDeathSource(scarab);
  assert.equal(scarab.source, null);
  assert.equal(scarab.raid, 'toa');
  // A guess from the fight (an acid pool at Olm): not a boss, so the feed drops it; still Chambers.
  const acid: Record<string, unknown> = { kind: 'death', source: 'Great Olm', sourceKind: 'fought' };
  settleDeathSource(acid);
  assert.equal(acid.raid, 'cox');
  // A current plugin says which raid, however the death came (a Warden skull names nobody).
  const skull: Record<string, unknown> = { kind: 'death', source: null, sourceKind: null, raid: 'toa' };
  settleDeathSource(skull);
  assert.equal(skull.raid, 'toa');
  // Entry Mode Tombs: not the raid a rush counts, whatever monster killed them.
  const entry: Record<string, unknown> = { kind: 'death', source: 'Akkha', sourceKind: 'npc', raid: 'toa-entry' };
  settleDeathSource(entry);
  assert.equal(entry.raid, undefined);
  // Anything else it sends there is dropped.
  const junk: Record<string, unknown> = { kind: 'death', source: 'Jad', sourceKind: 'npc', raid: 'inferno' };
  settleDeathSource(junk);
  assert.equal(junk.raid, undefined);
  // A player kill is a player kill.
  const pk: Record<string, unknown> = { kind: 'death', source: 'Kephri', sourceKind: 'player' };
  settleDeathSource(pk);
  assert.equal(pk.raid, undefined);
});

test('Clan Synergy: kills of one group boss landing together, +1 per clanmate, capped', () => {
  const t = T0;
  const seats = new Map<string, [string, number][]>([
    // A five-man ToA: everyone pushed within a few seconds.
    ['a', [['tombsOfAmascut', t], ['generalGraardor', t + 600_000]]],
    ['b', [['tombsOfAmascut', t + 4_000], ['generalGraardor', t + 600_000 + 9_000]]],
    ['c', [['tombsOfAmascut', t + 8_000]]],
    ['d', [['tombsOfAmascut', t + 12_000]]],
    ['e', [['tombsOfAmascut', t + 15_000], ['tombsOfAmascut', t + 3_600_000]]],
    // A ToA finished long after: alone.
    ['f', [['tombsOfAmascut', t + SYNERGY_WINDOW_MS + 1]]],
  ]);
  const got = rushSynergy(DEFAULT_RUSH, seats);
  // ToA: a group of 5 -> 4 clanmates each, capped at 3. Bandos: a duo -> +1 each.
  assert.equal(got.get('a'), 4);
  assert.equal(got.get('b'), 4);
  assert.equal(got.get('c'), 3);
  assert.equal(got.get('e'), 3);
  assert.equal(got.get('f'), undefined);
  assert.equal(rushSynergy({ synergy: { on: false, perMate: 1, max: 3 } }, seats).size, 0);
  assert.equal(rushSynergy({ synergy: { on: true, perMate: 2, max: 10 } }, seats).get('c'), 8);
});

test('only kills at raids and group bosses are kept for Clan Synergy', () => {
  assert.deepEqual(withGroupKills(null, ['phosanisNightmare', 'vorkath'], 5), null);
  assert.deepEqual(withGroupKills([['nex', 1]], ['nex', 'zulrah'], 5), [['nex', 1], ['nex', 5]]);
  assert.deepEqual(withGroupKills(null, ['nightmare', 'theatreOfBlood'], 9), [['nightmare', 9], ['theatreOfBlood', 9]]);
});

test('a push says which bosses it credited', () => {
  const s = rushKcStep({ pushed: { nex: 11, zulrah: 5 }, bossKeys: ['nex', 'zulrah'], seen: { nex: [10, T0], zulrah: [5, T0] }, start: null, startMs: T0, nowMs: T0 + 60_000 });
  assert.deepEqual(s.credited, ['nex']);
});
