// Boss Rush (lib/bossRushRules, lib/itemHunt rule 'rush'): the rules as stored, its targets, the
// standings (kills + each listed drop's points + Clan Synergy + staff adjustments - deaths) and
// where a death counts.
//
// Run: TESTS_OK=1 npx tsx --test tests/boss-rush.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RUSH,
  SYNERGY_WINDOW_MS,
  isGroupTarget,
  raidOfTarget,
  rushFromInput,
  rushRuleLines,
  rushRulesWords,
  rushSynergy,
  rushTotal,
  targetsFromInput,
} from '@/lib/bossRushRules';
import { type HuntDrop, defaultHuntTitle, huntFromInput, huntPanelLine, isRush, matchHuntReport, rankHunt, rushBossKeys, rushTargets, serializeHunt, parseHunt } from '@/lib/itemHunt';

const T0 = Date.parse('2026-11-01T00:00:00Z');
const window = { startMs: T0, endMs: T0 + 7 * 86_400_000 };

function rush(extra: Record<string, unknown> = {}, rules: Record<string, unknown> = {}) {
  const r = huntFromInput({
    v: 2,
    rule: 'rush',
    rush: { targets: ['Vorkath', 'Zulrah', 'Tormented Demon', 'Theatre of Blood: Entry Mode'], ...rules },
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

test('a rush is stored with its targets, its scoring and the points the host gave each drop', () => {
  const c = rush({ ends: { kind: 'drops', n: 3, by: 'all' }, repeat: 'first' }, { kcPoints: 2, deathPoints: 3, kcSource: 'any', deaths: false, floorZero: false });
  assert.ok(isRush(c));
  assert.deepEqual(rushTargets(c), ['Vorkath', 'Zulrah', 'Tormented Demon', 'Theatre of Blood: Entry Mode']);
  // Only the targets the hiscores keep are kept as keys.
  assert.deepEqual(rushBossKeys(c), ['vorkath', 'zulrah']);
  assert.deepEqual(c.rush, {
    kcPoints: 2, kcSource: 'any', deaths: false, deathPoints: 3, floorZero: false,
    synergy: { on: true, mode: 'flat', points: 1, max: 3 },
    targets: ['Vorkath', 'Zulrah', 'Tormented Demon', 'Theatre of Blood: Entry Mode'],
  });
  // It always runs to its date; a duplicate drop scores once when asked.
  assert.deepEqual(c.ends, { kind: 'date' });
  assert.equal(c.repeat, 'first');
  assert.equal(c.items.find((i) => i.id === 21992)?.points, 0);
  assert.equal(c.items.find((i) => i.id === 21992)?.pet, true);
  assert.deepEqual(parseHunt(serializeHunt(c)), c);
  assert.equal(defaultHuntTitle(c), 'Boss Rush: Vorkath + Zulrah + Tormented Demon + 1 more');
});

test('a rush needs a target; one stored with boss keys reads back as their names', () => {
  assert.equal(huntFromInput({ v: 2, rule: 'rush', rush: { targets: [] } }).ok, false);
  const old = huntFromInput({ v: 2, rule: 'rush', bosses: ['vorkath', 'tombsOfAmascut'], rush: { synergy: { on: true, perMate: 1, max: 3 } } }, { lenient: true });
  assert.ok(old.ok);
  assert.deepEqual(old.ok && old.config.rush?.targets, ['Vorkath', 'Tombs of Amascut']);
  // The synergy it was stored with: per clanmate.
  assert.deepEqual(old.ok && old.config.rush?.synergy, { on: true, mode: 'perMate', points: 1, max: 3 });
  assert.deepEqual(targetsFromInput([' Vorkath ', 'vorkath', '', 7, 'Tormented  Demon']), ['Vorkath', 'Tormented Demon']);
  assert.deepEqual(rushFromInput({}), DEFAULT_RUSH);
});

test('the rules read out plainly', () => {
  assert.equal(rushRulesWords(DEFAULT_RUSH), '1 kill = 1 pt · each death -1 · plugin kills only · Clan Synergy +1 pt a kill done together');
  const rows = rushRuleLines({ ...DEFAULT_RUSH, targets: ['Tombs of Amascut', 'Nex'] });
  assert.deepEqual(rows.map((r) => `${r.k} ${r.v}`), ['Kill +1 pt', 'Death -1 pt', 'Together +1 pt', 'Drops listed below', 'Kills plugin only', 'Score never below 0']);
  assert.equal(rows[1].note, 'Puzzles and mechanics count too.');
  const loose = rushRuleLines({ ...DEFAULT_RUSH, deaths: false, floorZero: false, kcSource: 'any', synergy: { on: true, mode: 'perMate', points: 1, max: 3 } });
  assert.deepEqual(loose.map((r) => `${r.k} ${r.v}`), ['Kill +1 pt', 'Death free', 'Together +1 pt a mate', 'Drops listed below', 'Kills all count']);
});

test('raid modes and group targets', () => {
  assert.equal(raidOfTarget('Theatre of Blood: Entry Mode'), 'tob-entry');
  assert.equal(raidOfTarget('tombs of amascut: entry mode'), 'toa-entry');
  assert.equal(raidOfTarget('Tombs of Amascut: Expert Mode'), 'toa');
  assert.equal(raidOfTarget('Vorkath'), null);
  // A rush made before targets were named carries the hiscores' short labels.
  assert.equal(raidOfTarget('ToA: Expert'), 'toa');
  assert.equal(raidOfTarget('CoX: CM'), 'cox');
  assert.equal(raidOfTarget('ToB: HM'), 'tob');
  assert.equal(raidOfTarget('Chambers of Xeric: Challenge Mode'), 'cox');
  assert.ok(isGroupTarget('Theatre of Blood: Entry Mode', null));
  assert.ok(isGroupTarget('Nex', 'nex'));
  assert.ok(!isGroupTarget("Phosani's Nightmare", 'phosanisNightmare'));
  assert.ok(!isGroupTarget('Tormented Demon', null));
});

test('a listed drop counts from its source; anything else does not', () => {
  const c = rush();
  assert.ok(matchHuntReport(c, { kind: 'drop', itemId: 22006, itemName: 'Skeletal visage', source: 'Vorkath', occurredAt: '', dedupKey: 'k' }));
  assert.equal(matchHuntReport(c, { kind: 'drop', itemId: 22006, itemName: 'Skeletal visage', source: 'Zulrah', occurredAt: '', dedupKey: 'k' }), null);
  assert.equal(matchHuntReport(c, { kind: 'drop', itemId: 536, itemName: 'Dragon bones', source: 'Vorkath', occurredAt: '', dedupKey: 'k' }), null);
  assert.equal(matchHuntReport(c, { kind: 'death', source: 'Vorkath', occurredAt: '', dedupKey: 'k' }), null);
});

test('standings: kills + drop points + synergy + staff - deaths, never below 0 unless the host lets it', () => {
  const c = rush();
  const entrants = [
    { rsn: 'Alice', statGain: 999, rush: { kc: 100, deaths: 4, synergy: 2 } },
    { rsn: 'Bob', statGain: 999, rush: { kc: 90, deaths: 0, adjust: 10 } },
    { rsn: 'Cara', statGain: 0, rush: { kc: 1, deaths: 9 } },
  ];
  const drops = [drop('Bob', 22006, T0 + 1000), drop('Alice', 12922, T0 + 2000), drop('Alice', 21992, T0 + 3000), drop('Bob', 12922, T0 + 4000, 'review')];
  const rows = rankHunt(c, entrants, drops, window);
  assert.deepEqual(rows.map((r) => [r.rsn, r.count]), [['Bob', 110], ['Alice', 103], ['Cara', 0]]);
  assert.deepEqual(rows[1].rush, { kc: 100, deaths: 4, bonus: 5, synergy: 2, adjust: 0, total: 103 });
  assert.equal(huntPanelLine(c, rows[0], null).figure, '110 pts');
  assert.equal(huntPanelLine(c, rows[0], null).sub, '90 kc · +10 drops · +10 by staff');
  assert.equal(huntPanelLine(c, rows[1], null).sub, '100 kc · +5 drops · +2 synergy · 4 deaths');

  const below = rush({}, { floorZero: false });
  assert.equal(rankHunt(below, entrants, [], window).find((r) => r.rsn === 'Cara')?.count, -8);
  const deathless = rush({}, { deaths: false });
  assert.equal(rankHunt(deathless, entrants, [], window).find((r) => r.rsn === 'Alice')?.count, 102);
});

test('duplicates: every drop scores, or only each player\'s first of an item', () => {
  const drops = [drop('Bob', 22006, T0 + 1000), drop('Bob', 22006, T0 + 2000)];
  const e = [{ rsn: 'Bob', statGain: 0, rush: { kc: 0, deaths: 0 } }];
  assert.equal(rankHunt(rush(), e, drops, window)[0].count, 20);
  assert.equal(rankHunt(rush({ repeat: 'first' }), e, drops, window)[0].count, 10);
});

test('a tie on points goes to the one with more kills', () => {
  const rows = rankHunt(rush(), [{ rsn: 'A', statGain: 0, rush: { kc: 10, deaths: 0 } }, { rsn: 'B', statGain: 0, rush: { kc: 0, deaths: 0 } }], [drop('B', 22006, T0 + 1)], window);
  assert.deepEqual(rows.map((r) => r.rsn), ['A', 'B']);
});

test('rushTotal', () => {
  assert.deepEqual(rushTotal({ ...DEFAULT_RUSH, kcPoints: 2, deathPoints: 5 }, 10, 3, 7), { kc: 10, deaths: 3, bonus: 7, synergy: 0, adjust: 0, total: 12 });
  assert.equal(rushTotal(DEFAULT_RUSH, 10, 0, 0, 6).total, 16);
  assert.equal(rushTotal({ ...DEFAULT_RUSH, synergy: { ...DEFAULT_RUSH.synergy, on: false } }, 10, 0, 0, 6).total, 10);
  assert.equal(rushTotal(DEFAULT_RUSH, 0, 1, 0, 0, 10).total, 9);
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
  // Also outside raids (Kebos, Sophanem): never guessed.
  assert.equal(raidOfNpc('Lizardman shaman'), null);
  assert.equal(raidOfNpc('Scarab swarm'), null);
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
  // Entry Mode Tombs is its own tag: only a rush over Entry Mode counts it.
  const entry: Record<string, unknown> = { kind: 'death', source: 'Akkha', sourceKind: 'npc', raid: 'toa-entry' };
  settleDeathSource(entry);
  assert.equal(entry.raid, 'toa-entry');
  const tobEntry: Record<string, unknown> = { kind: 'death', source: null, sourceKind: null, raid: 'tob-entry' };
  settleDeathSource(tobEntry);
  assert.equal(tobEntry.raid, 'tob-entry');
  // Anything else it sends there is dropped.
  // A client that sent where it stood checked the raid state: no tag means no raid, whatever killed it.
  const outside: Record<string, unknown> = { kind: 'death', source: 'Deathly mage', sourceKind: 'npc', regionId: 6192 };
  settleDeathSource(outside);
  assert.equal(outside.raid, undefined);
  const older: Record<string, unknown> = { kind: 'death', source: 'Deathly mage', sourceKind: 'npc' };
  settleDeathSource(older);
  assert.equal(older.raid, 'cox');
  const junk: Record<string, unknown> = { kind: 'death', source: 'Jad', sourceKind: 'npc', raid: 'inferno' };
  settleDeathSource(junk);
  assert.equal(junk.raid, undefined);
  // A player kill is a player kill.
  const pk: Record<string, unknown> = { kind: 'death', source: 'Kephri', sourceKind: 'player' };
  settleDeathSource(pk);
  assert.equal(pk.raid, undefined);
});

test('Clan Synergy: kills of one group target landing together', () => {
  const t = T0;
  const seats = new Map<string, [string, number][]>([
    // A five-man ToA: everyone's kill fact within a few seconds.
    ['a', [['Tombs of Amascut', t], ['General Graardor', t + 600_000]]],
    ['b', [['Tombs of Amascut', t + 3_000], ['general graardor', t + 600_000 + 4_000]]],
    ['c', [['Tombs of Amascut', t + 6_000]]],
    ['d', [['Tombs of Amascut', t + 9_000]]],
    ['e', [['Tombs of Amascut', t + 12_000], ['Tombs of Amascut', t + 3_600_000]]],
    // A ToA finished well after: alone.
    ['f', [['Tombs of Amascut', t + SYNERGY_WINDOW_MS + 1]]],
  ]);
  // Flat (the default): +1 a kill done together, however many joined.
  const flat = rushSynergy(DEFAULT_RUSH, seats);
  assert.equal(flat.get('a'), 2);
  assert.equal(flat.get('c'), 1);
  assert.equal(flat.get('e'), 1);
  assert.equal(flat.get('f'), undefined);
  // Per clanmate, capped: ToA 5 together -> 4 each, capped at 3; Bandos duo -> 1.
  const per = rushSynergy({ synergy: { on: true, mode: 'perMate', points: 1, max: 3 } }, seats);
  assert.equal(per.get('a'), 4);
  assert.equal(per.get('c'), 3);
  assert.equal(rushSynergy({ synergy: { on: false, mode: 'flat', points: 1, max: 3 } }, seats).size, 0);
});
