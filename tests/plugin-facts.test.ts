// Pure tests for the plugin-facts pipeline: tile matching (match.ts), the rule table (rules.ts),
// submission planning (plan.ts) and fact parsing (parse.ts). No database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coalesce,
  crossesProofMilestone,
  matchFacts,
  matchLoot,
  planPings,
  type Credit,
  type DropTile,
  type FactBoard,
  type KillTile,
  type LootFact,
  type Tracked,
  type ValueTile,
} from '@/lib/pluginFacts/match';
import { buildRuleTable, statStep } from '@/lib/pluginFacts/rules';
import { planSubmissions, tileText } from '@/lib/pluginFacts/plan';
import { appendBoardTiles } from '@/lib/pluginBoardTiles';
import { parseFacts } from '@/lib/pluginFacts/parse';
import { pluginTileCounts, withTileCounts } from '@/lib/pluginTileCounts';

const board: FactBoard = { eventId: 1, teamId: 2, playerId: 3 };

function drop(over: Partial<DropTile> & { tileId: number }): DropTile {
  return { label: `Tile ${over.tileId}`, requiredAmount: 3, currentAmount: 0, board, ...over } as DropTile;
}

function kill(over: Partial<KillTile> & { tileId: number }): KillTile {
  return { label: `Kill ${over.tileId}`, requiredAmount: 10, currentAmount: 0, board, ...over } as KillTile;
}

function loot(items: [number, number][], over: Partial<LootFact> = {}): LootFact {
  return { k: 'loot', src: 'Tekton', kind: 'npc', items, ...over };
}

function run(tracked: Tracked, facts: Parameters<typeof matchFacts>[0]) {
  return matchFacts(facts, tracked);
}

// ---------------------------------------------------------------------------------------------
// match.matchLoot

test('matchLoot: a simple drop tile is credited and its count moves', () => {
  const tile = drop({ tileId: 1, itemIds: [100], requiredAmount: 3, currentAmount: 0 });
  const t: Tracked = { trackedDrops: [tile] };
  const out = { credits: [], notes: [] } as { credits: Credit[]; notes: string[] };
  matchLoot(loot([[100, 1]]), t, out);
  assert.equal(out.credits.length, 1);
  assert.equal(out.credits[0].amount, 1);
  assert.equal(out.credits[0].have, 1);
  assert.equal(out.credits[0].of, 3);
  assert.equal(tile.currentAmount, 1);
});

test('matchLoot: the credit is clamped to what the tile still needs', () => {
  const tile = drop({ tileId: 1, itemIds: [100], requiredAmount: 3, currentAmount: 2 });
  const out = { credits: [], notes: [] } as { credits: Credit[]; notes: string[] };
  matchLoot(loot([[100, 5]]), { trackedDrops: [tile] }, out);
  assert.equal(out.credits.length, 1);
  assert.equal(out.credits[0].amount, 1);
});

test('matchLoot: a PvP loot is rejected unless the tile accepts pvp', () => {
  const pvpFact = loot([[100, 1]], { kind: 'pvp', src: 'SomePlayer' });
  const none = run({ trackedDrops: [drop({ tileId: 1, itemIds: [100] })] }, [pvpFact]);
  assert.equal(none.credits.length, 0);

  const accepted = run({ trackedDrops: [drop({ tileId: 1, itemIds: [100], acceptedSources: ['pvp'] })] }, [pvpFact]);
  assert.equal(accepted.credits.length, 1);
});

test('matchLoot: sourceNpcs match the reported source, with wiki qualifiers stripped', () => {
  const exact = run({ trackedDrops: [drop({ tileId: 1, itemIds: [100], sourceNpcs: ['Tekton'] })] }, [loot([[100, 1]], { src: 'Tekton' })]);
  assert.equal(exact.credits.length, 1);

  const qualified = run(
    { trackedDrops: [drop({ tileId: 1, itemIds: [100], sourceNpcs: ["Armoured zombie (Zemouregal's Fort)"] })] },
    [loot([[100, 1]], { src: 'Armoured zombie' })],
  );
  assert.equal(qualified.credits.length, 1);

  const other = run({ trackedDrops: [drop({ tileId: 1, itemIds: [100], sourceNpcs: ['Tekton'] })] }, [loot([[100, 1]], { src: 'Vasa' })]);
  assert.equal(other.credits.length, 0);
});

test('matchLoot: a party-size tile needs exactly that party', () => {
  const tile = () => ({ trackedDrops: [drop({ tileId: 1, itemIds: [100], partySize: 3 })] });

  const short = run(tile(), [loot([[100, 1]], { party: 2 })]);
  assert.equal(short.credits.length, 0);
  assert.ok(short.notes.some((n) => n.includes('party of 2')), `notes: ${JSON.stringify(short.notes)}`);

  const right = run(tile(), [loot([[100, 1]], { party: 3 })]);
  assert.equal(right.credits.length, 1);

  const solo = run(tile(), [loot([[100, 1]], { party: null })]);
  assert.equal(solo.credits.length, 0);
});

test('matchLoot: perKillCap limits the total credited from one kill', () => {
  const tile = drop({ tileId: 1, itemIds: [1, 2], requiredAmount: 5, perKillCap: 1 });
  const out = { credits: [], notes: [] } as { credits: Credit[]; notes: string[] };
  matchLoot(loot([[1, 1], [2, 1]]), { trackedDrops: [tile] }, out);
  const total = out.credits.reduce((sum, c) => sum + c.amount, 0);
  assert.equal(total, 1);
});

test('matchLoot: countMode distinct credits each item once', () => {
  const tile = drop({ tileId: 1, itemIds: [1, 2], requiredAmount: 5, countMode: 'distinct', countedItemIds: [1] });
  const out = { credits: [], notes: [] } as { credits: Credit[]; notes: string[] };
  matchLoot(loot([[1, 1], [2, 3]]), { trackedDrops: [tile] }, out);
  assert.equal(out.credits.length, 1);
  assert.equal(out.credits[0].itemId, 2);
  assert.equal(out.credits[0].amount, 1);
});

test('matchLoot: a per-item collection tile credits the item and is gated on completedTiles', () => {
  const tile = drop({
    tileId: 1,
    requiredAmount: 2,
    itemRequirements: [
      { itemId: 10, requiredAmount: 1, currentAmount: 0 },
      { itemId: 11, requiredAmount: 1, currentAmount: 0 },
    ],
  });
  const out = { credits: [], notes: [] } as { credits: Credit[]; notes: string[] };
  matchLoot(loot([[10, 1]]), { trackedDrops: [tile] }, out);
  assert.equal(out.credits.length, 1);
  assert.equal(out.credits[0].itemId, 10);
  assert.equal(out.credits[0].have, 1);
  assert.equal(out.credits[0].of, 2);

  const completed = run(
    {
      trackedDrops: [
        drop({
          tileId: 1,
          requiredAmount: 2,
          itemRequirements: [{ itemId: 10, requiredAmount: 1, currentAmount: 0 }, { itemId: 11, requiredAmount: 1, currentAmount: 0 }],
        }),
      ],
      completedTiles: [{ tileId: 1 }],
    },
    [loot([[10, 1]])],
  );
  assert.equal(completed.credits.length, 0);
});

test('matchLoot: one item tracked by two tiles credits both', () => {
  const t: Tracked = {
    trackedDrops: [drop({ tileId: 1, itemIds: [100] }), drop({ tileId: 2, itemIds: [100] })],
  };
  const result = run(t, [loot([[100, 1]])]);
  assert.equal(result.credits.length, 2);
  assert.deepEqual(result.credits.map((c) => c.tileId).sort(), [1, 2]);
});

// ---------------------------------------------------------------------------------------------
// match.matchValue

test('matchValue: single mode completes once at the threshold', () => {
  const tile = (): ValueTile => ({ tileId: 7, label: 'Haul', thresholdGp: 1_000_000, mode: 'single', board });
  const t: Tracked = { trackedValues: [tile()] };

  const below = run(t, [{ k: 'value', src: 'Tekton', kind: 'npc', gp: 999_999 }]);
  assert.equal(below.credits.length, 0);

  const big = run(t, [{ k: 'value', src: 'Tekton', kind: 'npc', gp: 2_000_000 }]);
  assert.equal(big.credits.length, 1);
  assert.equal(big.credits[0].completes, true);

  const again = run(t, [{ k: 'value', src: 'Tekton', kind: 'npc', gp: 2_000_000 }]);
  assert.equal(again.credits.length, 0, 'a completed tile is not credited again');
});

test('matchValue: total mode sums every qualifying haul', () => {
  const t: Tracked = {
    trackedValues: [{ tileId: 7, label: 'Haul', thresholdGp: 1_000_000, mode: 'total', board }],
  };
  const result = run(t, [
    { k: 'value', src: 'Tekton', kind: 'npc', gp: 300_000 },
    { k: 'value', src: 'Tekton', kind: 'npc', gp: 400_000 },
  ]);
  assert.equal(result.credits.length, 2);
  assert.equal(result.credits[1].have, 700_000);
});

test('matchValue: sources PvP matches only pvp kills', () => {
  const mk = (): Tracked => ({
    trackedValues: [{ tileId: 7, label: 'Haul', thresholdGp: 1000, mode: 'single', sources: ['PvP'], board }],
  });
  const pvp = run(mk(), [{ k: 'value', src: 'SomePlayer', kind: 'pvp', gp: 5000 }]);
  assert.equal(pvp.credits.length, 1);

  const npc = run(mk(), [{ k: 'value', src: 'Vorkath', kind: 'npc', gp: 5000 }]);
  assert.equal(npc.credits.length, 0);
});

// ---------------------------------------------------------------------------------------------
// match.matchKill (via matchFacts)

test('matchKill: a wiki-mode target only answers to its own name', () => {
  const t = (): Tracked => ({
    trackedKills: [
      kill({ tileId: 1, targetNpcs: ['Vardorvis (awakened)'] }),
      kill({ tileId: 2, targetNpcs: ['Vardorvis'] }),
    ],
  });

  const plain = run(t(), [{ k: 'kill', n: { vardorvis: 1 } }]);
  assert.deepEqual(plain.credits.map((c) => c.tileId), [2]);

  const awakened = run(t(), [{ k: 'kill', n: { 'vardorvis (awakened)': 1 } }]);
  assert.deepEqual(awakened.credits.map((c) => c.tileId), [1]);
});

test('matchKill: one tile with several targets takes the largest moved amount, once', () => {
  const result = run({ trackedKills: [kill({ tileId: 1, targetNpcs: ['A', 'B'] })] }, [{ k: 'kill', n: { a: 2, b: 3 } }]);
  assert.equal(result.credits.length, 1);
  assert.equal(result.credits[0].amount, 3);
});

test('matchKill: an unverified counter is flagged unverified_counter', () => {
  const result = run({ trackedKills: [kill({ tileId: 1, targetNpcs: ['A'] })] }, [{ k: 'kill', n: { a: 1 }, unv: ['a'] }]);
  assert.equal(result.credits.length, 1);
  assert.equal(result.credits[0].inferred, 'unverified_counter');
});

test('matchKill: a cap counter is not credited once its cap tile is complete', () => {
  const result = run(
    { trackedKills: [kill({ tileId: 1, targetNpcs: ['X'], capOf: 50 })], completedTiles: [{ tileId: 50 }] },
    [{ k: 'kill', n: { x: 1 } }],
  );
  assert.equal(result.credits.length, 0);
});

test('matchKill: a tile already at its requirement is not credited', () => {
  const result = run(
    { trackedKills: [kill({ tileId: 1, targetNpcs: ['X'], requiredAmount: 5, currentAmount: 5 })] },
    [{ k: 'kill', n: { x: 1 } }],
  );
  assert.equal(result.credits.length, 0);
});

// ---------------------------------------------------------------------------------------------
// plan / match helpers

test('crossesProofMilestone: 25% steps on large tiles, every credit on small ones', () => {
  assert.equal(crossesProofMilestone(1, 25, 100), true);
  assert.equal(crossesProofMilestone(1, 26, 100), false);
  assert.equal(crossesProofMilestone(1, 3, 10), true);
});

test('planPings: splits into pings only under a pingMax, else null when too big', () => {
  assert.equal(planPings([3, 4, 5], 12, 0), null);
  assert.deepEqual(planPings([5], 5, 0), [5]);
  assert.deepEqual(planPings([4, 4, 4], 12, 8), [8, 4]);
});

test('coalesce: same-tile kill credits fold into one with summed amount and joined parts', () => {
  const credits: Credit[] = [
    { kind: 'kill', tileId: 1, label: 'Kill', amount: 1, have: 1, of: 100, parts: [1] },
    { kind: 'kill', tileId: 1, label: 'Kill', amount: 2, have: 3, of: 100, parts: [2] },
  ];
  const out = coalesce(credits);
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 3);
  assert.deepEqual(out[0].parts, [1, 2]);
});

test('planSubmissions: a small kill without a milestone goes as an image-less ping', () => {
  const credit: Credit = { kind: 'kill', tileId: 1, label: 'Kill', amount: 1, have: 5, of: 100, parts: [1] };
  const bodies = planSubmissions([credit], () => board, 'u', null, null);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].body.imageUrl, null);
});

test('planSubmissions: a kill crossing a milestone carries the image and the BINGO KILL banner', () => {
  const credit: Credit = { kind: 'kill', tileId: 1, label: 'Kill', amount: 1, have: 25, of: 100, parts: [1] };
  const bodies = planSubmissions([credit], () => board, 'u', { tz: 'UTC' }, null);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].body.imageUrl, 'u');
  assert.equal((bodies[0].body.proof as { title: string }).title, 'BINGO KILL');
});

test('planSubmissions: a drop credit always carries the image', () => {
  const credit: Credit = { kind: 'drop', tileId: 1, label: 'Drop', amount: 1, have: 1, of: 3 };
  const bodies = planSubmissions([credit], () => board, 'u', null, null);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].body.imageUrl, 'u');
});

test('planSubmissions: an oversized kill with no image splits into pings of at most 10', () => {
  const credit: Credit = { kind: 'kill', tileId: 1, label: 'Kill', amount: 23, have: 30, of: 1000, parts: [23] };
  const bodies = planSubmissions([credit], () => board, null, null, null);
  assert.deepEqual(bodies.map((b) => b.body.amount), [10, 10, 3]);
});

// ---------------------------------------------------------------------------------------------
// rules.buildRuleTable

test('statStep: about a tenth of the goal, rounded to a clean number, 0 for small goals', () => {
  assert.equal(statStep(1_000_000, 'xp'), 100_000);
  assert.equal(statStep(5_000, 'xp'), 0);
  assert.equal(statStep(50, 'kc'), 5);
  assert.equal(statStep(8, 'kc'), 0);
  assert.equal(statStep(130_000_000, 'xp'), 10_000_000);
});

test('buildRuleTable drops index: simple tiles appear under each item id, others are flagged', () => {
  const table = buildRuleTable({
    trackedDrops: [
      drop({ tileId: 1, itemIds: [100, 101] }),
      drop({ tileId: 2, itemIds: [200], countMode: 'distinct' }),
      drop({ tileId: 3, itemIds: [300], requiredAmount: 3, currentAmount: 3 }),
    ],
  });
  assert.equal(table.drops['100'][0].simple, true);
  assert.equal(table.drops['101'][0].simple, true);
  assert.equal(table.drops['200'][0].simple, false);
  assert.equal(table.drops['300'], undefined, 'a completed tile is excluded');
});

test('buildRuleTable kills: keyed by killTargetKey (lowercase, wiki qualifier stripped)', () => {
  const table = buildRuleTable({
    trackedKills: [
      kill({ tileId: 1, targetNpcs: ["Armoured zombie (Zemouregal's Fort)", 'Vardorvis (awakened)'] }),
    ],
  });
  assert.ok(table.kills['armoured zombie'], `keys: ${Object.keys(table.kills).join(', ')}`);
  assert.ok(table.kills['vardorvis (awakened)']);
  assert.equal(table.kills['armoured zombie'][0].t, 1);
});

test('buildRuleTable stats: a skill rides xp with active gating, a boss rides kc under its names', () => {
  const table = buildRuleTable({
    trackedStats: [
      { tileId: 1, label: 'Agility', statName: 'agility', statType: 'skill', currentAmount: 0, goalAmount: 1_000_000 },
      { tileId: 2, label: 'Vorkath', statName: 'vorkath', statType: 'boss', currentAmount: 0, goalAmount: 100 },
    ],
  });
  const skill = table.stats.find((s) => s.t === 1);
  assert.ok(skill);
  assert.equal(skill.on, 'xp');
  assert.deepEqual(skill.names, ['agility']);
  assert.equal(skill.step, 100_000);
  assert.deepEqual(skill.active, [5, 10]);

  const boss = table.stats.find((s) => s.t === 2);
  assert.ok(boss);
  assert.equal(boss.on, 'kc');
  assert.ok(boss.names.includes('vorkath'), `names: ${boss.names.join(', ')}`);
});

test('buildRuleTable blackout: only when there are drop tiles and every one is done', () => {
  const drop = (tileId: number, currentAmount: number) => ({ tileId, label: 'D', itemIds: [1], currentAmount, requiredAmount: 2 });
  assert.equal(buildRuleTable({}).blackout, false);
  assert.equal(buildRuleTable({ trackedDrops: [] }).blackout, false);
  assert.equal(buildRuleTable({ trackedDrops: [drop(1, 2), drop(2, 1)] }).blackout, false);
  assert.equal(buildRuleTable({ trackedDrops: [drop(1, 2), drop(2, 3)] }).blackout, true);
});

test('buildRuleTable stats: names come folded to letters and digits, a composite tile carries every mode', () => {
  const table = buildRuleTable({
    trackedStats: [
      { tileId: 3, label: "Kree'Arra", statName: 'kreeArra', statType: 'boss', currentAmount: 0, goalAmount: 50 },
      { tileId: 4, label: 'CoX + CoX: CM', statName: 'chambersOfXeric,chambersOfXericChallengeMode', statType: 'boss', currentAmount: 0, goalAmount: 50 },
    ],
  });
  const kree = table.stats.find((s) => s.t === 3)!;
  assert.ok(kree.names.includes('kreearra'), `names: ${kree.names.join(', ')}`);
  assert.ok(kree.names.every((n) => /^[a-z0-9]+$/.test(n)));
  const cox = table.stats.find((s) => s.t === 4)!;
  assert.ok(cox.names.includes('chambersofxeric') && cox.names.includes('chambersofxericchallengemode'), `names: ${cox.names.join(', ')}`);
  assert.equal(new Set(cox.names).size, cox.names.length);
});

// ---------------------------------------------------------------------------------------------
// parse.parseFacts

test('parseFacts: drops malformed, unknown-kind and negative-id facts, keeps valid loot, value and kill', () => {
  const out = parseFacts([
    { k: 'loot', kind: 'npc', src: 'Vorkath', items: [[100, 1], [-5, 1], [1, -1]] },
    { k: 'loot', kind: 'bogus', src: 'x', items: [[1, 1]] },
    { k: 'loot', kind: 'npc', src: 'x', items: [[-1, 1]] },
    { k: 'value', kind: 'npc', src: 'Vorkath', gp: 500_000 },
    { k: 'value', kind: 'nope', src: 'x', gp: 5 },
    { k: 'value', kind: 'npc', src: 'x', gp: -3 },
    { k: 'kill', n: { vorkath: 1 } },
    { k: 'kill', n: {} },
    { k: 'bogus' },
    null,
    'not a fact',
    42,
  ]);
  assert.deepEqual(
    out.map((f) => f.k),
    ['loot', 'value', 'kill'],
  );
  const lootFact = out[0];
  assert.ok(lootFact.k === 'loot');
  assert.deepEqual(lootFact.items, [[100, 1]], 'negative ids and quantities are dropped from the items');
  const valueFact = out[1];
  assert.ok(valueFact.k === 'value');
  assert.equal(valueFact.gp, 500_000);
  const killFact = out[2];
  assert.ok(killFact.k === 'kill');
  assert.deepEqual(killFact.n, { vorkath: 1 });
});

// ---------------------------------------------------------------------------------------------
// pluginTileCounts (the config's `tiles`)

test('pluginTileCounts: one row per tile, highest count, first goal, sets marked, plain timed and values left out', () => {
  const rows = pluginTileCounts({
    trackedDrops: [
      { tileId: 1, currentAmount: 2, requiredAmount: 5 },
      { tileId: 2, currentAmount: 3, requiredAmount: 4, itemRequirements: [{ itemId: 1 }] },
    ],
    trackedKills: [{ tileId: 1, currentAmount: 4, requiredAmount: 9 }, { tileId: 3, requiredAmount: 10 }],
    trackedStats: [{ tileId: 4, currentAmount: 500, goalAmount: 1000 }],
    trackedTimed: [{ tileId: 5, thresholdSeconds: 60 }, { tileId: 6, currentAmount: 1, requiredAmount: 3 }],
    trackedValues: [{ tileId: 7, currentGp: 10, thresholdGp: 100 }],
    trackedCombos: [{ tileId: 8, done: 1, needed: 2 }],
  });
  const by = new Map(rows.map((r) => [r.t, r]));
  assert.deepEqual(by.get(1), { t: 1, have: 4, of: 5 });
  assert.deepEqual(by.get(2), { t: 2, have: 3, of: 4, set: true });
  assert.deepEqual(by.get(3), { t: 3, have: 0, of: 10 });
  assert.deepEqual(by.get(4), { t: 4, have: 500, of: 1000 });
  assert.equal(by.has(5), false);
  assert.deepEqual(by.get(6), { t: 6, have: 1, of: 3 });
  assert.equal(by.has(7), false);
  assert.equal(by.has(8), false);
  const body: Record<string, unknown> = { trackedGains: [{ tileId: 9, currentAmount: 1, requiredAmount: 2 }] };
  assert.equal(withTileCounts(body), body);
  assert.deepEqual(body.tiles, [{ t: 9, have: 1, of: 2 }]);
});

// ---------------------------------------------------------------------------------------------
// `tile` facts: the kinds the plugin judges itself

const proofMeta = { tz: 'UTC', capturedAt: 1, tick: 2, chat: [] };

test('parseFacts tile: keeps a well-formed tile fact with its extras, drops a bad id, amount or seconds', () => {
  const out = parseFacts([
    { k: 'tile', t: 7, n: 1, sec: 95, lvl: 500, tr: true, what: 'x'.repeat(10) },
    { k: 'tile', t: -41, n: 2, note: 'old', item: 4151, inf: 'inferred_duplicate_pet' },
    { k: 'tile', t: 0, n: 1 },
    { k: 'tile', t: 7, n: 0 },
    { k: 'tile', t: 7, n: 10_001 },
    { k: 'tile', t: 1.5, n: 1 },
    { k: 'tile', t: 7, n: 1, sec: 99_999, pg: 'yes' },
    { k: 'tile', t: 8, n: 5_000_000, note: '[Auto] loot worth 5.0M gp' },
  ]);
  assert.equal(out.length, 4);
  assert.ok(out[3].k === 'tile' && out[3].n === 5_000_000, 'a replayed older value proof keeps its gp');
  assert.deepEqual(out[0], { k: 'tile', t: 7, n: 1, sec: 95, what: 'xxxxxxxxxx', tier: undefined, pg: undefined, tr: true, lvl: 500, party: undefined, place: undefined, kills: undefined, item: undefined, inf: undefined, note: undefined });
  assert.ok(out[1].k === 'tile' && out[1].t === -41 && out[1].note === 'old' && out[1].item === 4151);
  assert.ok(out[2].k === 'tile' && out[2].sec === undefined && out[2].pg === undefined, 'an out-of-range sec and a non-boolean pg are dropped');
});

test('matchTile: credits only the caller\'s tiles of a plugin-judged kind; timed needs its seconds', () => {
  const tracked: Tracked = {
    trackedDrops: [drop({ tileId: 1, itemIds: [5] })],
    trackedTimed: [{ tileId: 2, label: 'Inferno', activity: 'Inferno', thresholdSeconds: 3600, currentAmount: 0, requiredAmount: 1, board }],
    trackedDiaries: [{ tileId: 3, label: 'Diaries', currentAmount: 1, requiredAmount: 3, board }],
  };
  const r = run(tracked, [
    { k: 'tile', t: 1, n: 1 },
    { k: 'tile', t: 99, n: 1 },
    { k: 'tile', t: 2, n: 1 },
    { k: 'tile', t: 2, n: 1, sec: 3000 },
    { k: 'tile', t: 3, n: 1, what: 'Ardougne Elite' },
  ]);
  assert.deepEqual(r.credits.map((c) => [c.tileId, c.tileKind, c.have, c.of]), [[2, 'timed', 1, 1], [3, 'diary', 2, 3]]);
  assert.equal(r.credits[1].board, board);
});

test('matchTile: a replayed older proof may name a drop tile; a combo part speaks with its combo name for gains and clog', () => {
  const tracked: Tracked = {
    trackedDrops: [drop({ tileId: 1, itemIds: [5] })],
    trackedGains: [{ tileId: 4, label: 'Sharks', partOf: 9, currentAmount: 10, requiredAmount: 12 }],
    trackedPvp: [{ tileId: 5, label: 'PKs', partOf: 9, currentAmount: 0, requiredAmount: 2 }],
    trackedCombos: [{ tileId: 9, label: 'Sea' }],
  };
  const r = run(tracked, [
    { k: 'tile', t: 1, n: 1, note: '[Auto] Tile 1 detected by RuneLite plugin', item: 5 },
    { k: 'tile', t: 4, n: 5 },
    { k: 'tile', t: 5, n: 1, what: 'Zezima' },
  ]);
  assert.deepEqual(r.credits.map((c) => [c.tileId, c.tileKind, c.label, c.have]), [
    [1, 'drop', 'Tile 1', 1],
    [4, 'gain', 'Sea — Sharks', 12],
    [5, 'pvp', 'PKs', 1],
  ]);
});

test('coalesce leaves tile credits alone: two runs of one tile stay two submissions', () => {
  const tracked: Tracked = { trackedTimed: [{ tileId: 2, label: 'Trials', activity: 'Gwenith Glide Marlin', currentAmount: 0, requiredAmount: 3, board }] };
  const r = run(tracked, [{ k: 'tile', t: 2, n: 1, sec: 100, tr: true }, { k: 'tile', t: 2, n: 1, sec: 90, tr: true }]);
  const out = coalesce(r.credits);
  assert.equal(out.length, 2);
  const plans = planSubmissions(out, (c) => c.board ?? null, 'https://m/x.jpg', proofMeta, null);
  assert.deepEqual(plans.map((p) => p.body.durationSeconds), [100, 90]);
  assert.deepEqual(plans.map((p) => (p.body.proof as { detail: string }).detail), ['Gwenith Glide Marlin  1:40', 'Gwenith Glide Marlin  1:30']);
});

test('planSubmissions tile: each kind gets the banner and note the plugin used to write', () => {
  const tracked: Tracked = {
    trackedTimed: [{ tileId: 1, label: 'ToA', activity: 'Tombs of Amascut', thresholdSeconds: 1800, board }],
    trackedDeathless: [{ tileId: 2, label: 'ToB', activity: 'Theatre of Blood', partySize: 4, currentAmount: 0, requiredAmount: 2, coopCredit: 'per-kill', board }],
    trackedLms: [{ tileId: 3, label: 'LMS', placementCap: 3, currentAmount: 0, requiredAmount: 5, board }],
    trackedPvp: [{ tileId: 4, label: 'PK', currentAmount: 0, requiredAmount: 3, board }],
    trackedDiaries: [{ tileId: 5, label: 'Diary', currentAmount: 0, requiredAmount: 1, board }],
    trackedCombatTasks: [{ tileId: 6, label: 'CA', currentAmount: 0, requiredAmount: 1, board }],
    trackedClog: [{ tileId: 7, label: 'Clog', currentAmount: 0, requiredAmount: 5, board }],
  };
  const r = run(tracked, [
    { k: 'tile', t: 1, n: 1, sec: 1500, lvl: 400 },
    { k: 'tile', t: 2, n: 1, party: 4 },
    { k: 'tile', t: 3, n: 1, place: 2, kills: 1 },
    { k: 'tile', t: 4, n: 1, what: 'Zezima' },
    { k: 'tile', t: 5, n: 1, what: 'Ardougne Elite' },
    { k: 'tile', t: 6, n: 1, what: 'Whack-a-Mole', tier: 'Master' },
    { k: 'tile', t: 7, n: 1, what: 'Abyssal whip' },
    { k: 'tile', t: 7, n: 1, what: 'Vorkath', pg: true },
  ]);
  const plans = planSubmissions(r.credits, (c) => c.board ?? null, 'https://m/x.jpg', proofMeta, { teammates: ['a', 'b'], partySize: 4 });
  const banner = plans.map((p) => { const pr = p.body.proof as { title: string; detail: string }; return [pr.title, pr.detail, p.body.note]; });
  assert.deepEqual(banner, [
    ['BINGO TIMED', 'Tombs of Amascut  25:00  (cap 30:00)  level 400', '[Auto] Tombs of Amascut cleared in 25:00 by RuneLite plugin'],
    ['BINGO DEATHLESS', 'Theatre of Blood  deathless  party 4  (1/2)', '[Auto] Theatre of Blood deathless run detected by RuneLite plugin'],
    ['BINGO LMS', 'Placed 2nd — 1 kill  (needs top 3)', '[Auto] LMS 2nd place, 1 kill — detected by RuneLite plugin'],
    ['BINGO PVP KILL', 'Killed Zezima  (1/3)', '[Auto] PvP kill on Zezima — detected by RuneLite plugin'],
    ['DIARY COMPLETE', 'Ardougne Elite Diary', '[Auto] Ardougne Elite diary completed — detected by RuneLite plugin'],
    ['COMBAT TASK', 'Master: Whack-a-Mole', '[Auto] Master combat task "Whack-a-Mole" completed — detected by RuneLite plugin'],
    ['COLLECTION LOG', 'Abyssal whip', '[Auto] New collection log slot: Abyssal whip — detected by RuneLite plugin'],
    ['COLLECTION LOG PAGE', 'Vorkath', '[Auto] Finished collection log page: Vorkath'],
  ]);
  assert.equal(plans[0].body.durationSeconds, 1500);
  assert.deepEqual([plans[1].body.coopGroup, plans[1].body.coopPartySize], [['a', 'b'], 4], 'a shared-run deathless tile carries who was there');
  assert.equal(plans[0].body.coopGroup, undefined, 'nothing else does');
  assert.ok(plans.every((p) => p.body.imageUrl === 'https://m/x.jpg' && p.body.teamId === 2 && p.body.creditPlayerId === 3 && p.body.amount === 1));
  assert.equal((plans[0].body.proof as { tz: string }).tz, 'UTC', 'the client\'s proof metadata rides along');
});

test('planSubmissions tile: a gain batch without a screenshot is a count-only ping, the completing one a proof', () => {
  const tracked: Tracked = { trackedGains: [{ tileId: 1, label: 'Sharks', currentAmount: 0, requiredAmount: 20, board }] };
  const ping = planSubmissions(run(tracked, [{ k: 'tile', t: 1, n: 12 }]).credits, (c) => c.board ?? null, null, null, null);
  assert.deepEqual(ping[0].body, { tileId: 1, teamId: 2, creditPlayerId: 3, amount: 12, note: '[Auto] Sharks gain(s) counted by RuneLite plugin', imageUrl: null });
  const proof = planSubmissions(run(tracked, [{ k: 'tile', t: 1, n: 8 }]).credits, (c) => c.board ?? null, 'https://m/y.jpg', proofMeta, null);
  assert.equal(proof[0].body.note, '[Auto] Sharks gain(s) detected by RuneLite plugin');
  assert.equal((proof[0].body.proof as { detail: string }).detail, 'Sharks  ×8  (20/20)');
});

test('planSubmissions tile: a replayed older proof keeps its note, banner, item, flag and company', () => {
  const tracked: Tracked = { trackedDrops: [drop({ tileId: 1, itemIds: [5] })] };
  const old = { tz: 'UTC', title: 'BINGO DROP', detail: 'Tile 1' };
  const r = run(tracked, [{ k: 'tile', t: 1, n: 1, note: 'old note', item: 5, inf: 'inferred_duplicate_pet' }]);
  const [p] = planSubmissions(r.credits, (c) => c.board ?? null, 'https://m/z.jpg', old, { teammates: ['a'], partySize: 2 });
  assert.deepEqual(p.body, {
    tileId: 1, teamId: 2, creditPlayerId: 3, amount: 1, note: 'old note', imageUrl: 'https://m/z.jpg',
    itemId: 5, inferred: 'inferred_duplicate_pet', coopGroup: ['a'], coopPartySize: 2, proof: old,
  });
});

test('tileText: a Barracuda Trials rank tile shows no cap', () => {
  const tracked: Tracked = { trackedTimed: [{ tileId: 1, label: 'T', activity: 'Gwenith Glide — Marlin', thresholdSeconds: 0, board }] };
  const [c] = run(tracked, [{ k: 'tile', t: 1, n: 1, sec: 61 }]).credits;
  assert.equal(tileText(c, true).detail, 'Gwenith Glide — Marlin  1:01');
});

test('appendBoardTiles: another board\'s plugin-judged tiles say which board in their label, once; drops do not', () => {
  const body: Record<string, unknown> = {};
  const lb = { eventId: 5, name: 'Spring', clan: 'c', clanId: 1, clanName: 'C', teamId: 6, teamName: 'T', playerId: 7, rsn: 'r' };
  appendBoardTiles(body, { trackedGains: [{ tileId: 1, label: 'Sharks' }, { tileId: 2, label: 'Logs · Spring' }], trackedDrops: [{ tileId: 3, label: 'Whip' }] }, lb);
  assert.deepEqual((body.trackedGains as { label: string }[]).map((g) => g.label), ['Sharks · Spring', 'Logs · Spring']);
  assert.deepEqual((body.trackedDrops as { label: string }[]).map((g) => g.label), ['Whip']);
});
