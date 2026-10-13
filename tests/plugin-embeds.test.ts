import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPluginEmbed,
  clogRank,
  luckLabel,
  SPOON_LINES,
  type PluginEmbedKind,
} from '../src/lib/pluginEmbeds.ts';

// Parity with the plugin. Until site-embeds the plugin built every clan-notification embed itself;
// tests/fixtures/legacy-plugin-embeds.json is what those Java builders (plugin d876ce6 + the quest
// tiers of df9e9b6) produced for the inputs below — dumped by running the old builders verbatim, not
// written by hand. Each case here sends the same inputs as facts and must get the same embed back.
//
// Intentional differences (none show up here): the brand footer/timestamp stampBrand adds at send
// time to every embed, and numbers always use "," grouping where the plugin used the player's JVM
// locale.

const legacy = JSON.parse(readFileSync(new URL('./fixtures/legacy-plugin-embeds.json', import.meta.url), 'utf8')) as Record<
  string,
  unknown
>;

/** Pick SPOON_LINES[i] deterministically. */
const pick = (i: number) => () => (i + 0.5) / SPOON_LINES.length;

type Case = { kind: PluginEmbedKind; facts: unknown; image?: string | null; spoon?: number };

const cases: Record<string, Case> = {
  'drop.rare': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      rsn: 'Zezima', source: 'Vorkath', sourceKind: 'npc', kc: 54, dropRate: 1 / 1000,
      items: [{ id: 22111, name: 'Dragonbone necklace', qty: 1, value: 12_345_678 }],
    },
  },
  'drop.rare-spoon-note': {
    kind: 'drop',
    image: 'anvil-drop.png',
    spoon: 0,
    facts: {
      rsn: 'Zezima', source: 'Vorkath', sourceKind: 'npc', kc: 1, dropRate: 1 / 50, spoon: true,
      note: 'Roll 2 of 3 toward a Venator vestige.',
      items: [{ id: 21907, name: "Vorkath's head", qty: 1, value: 75_000 }],
    },
  },
  'drop.troll-casket': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      rsn: 'Lynx Titan', source: 'Clue Scroll (Master)', sourceKind: 'event', kc: 1_204, dropRate: 1 / 128,
      troll: true, items: [{ id: 1249, name: 'Dragon spear', qty: 3, value: 99_000 }],
    },
  },
  'drop.guaranteed-lootkey': {
    kind: 'drop',
    image: 'anvil-drop.png',
    spoon: 1,
    facts: {
      rsn: 'Zezima', source: 'Loot Chest', sourceKind: 'pvp', kc: 7, dropRate: 1, guaranteed: true,
      // The plugin never sets spoon on a guaranteed drop; the site would drop it anyway.
      spoon: true, items: [{ id: 4151, name: 'Abyssal whip', qty: 1, value: 1_500_000 }],
    },
  },
  'drop.pickpocket-nokc': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      source: 'Elves', sourceKind: 'pickpocket', dropRate: 1 / 1024,
      items: [{ id: 23959, name: 'Enhanced crystal teleport seed', qty: 1, value: 0 }],
    },
  },
  'drop.pvp-named': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      rsn: 'Bob', source: 'Zezima', sourceKind: 'pvp',
      items: [{ id: 11802, name: 'Armadyl godsword', qty: 1, value: 9_000_000 }],
    },
  },
  'drop.notable-earned': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      rsn: 'Zezima', source: 'TzKal-Zuk', sourceKind: 'npc', kc: 3, notable: 'loot', earned: true,
      items: [{ id: 21295, name: 'Infernal cape', qty: 1, value: 0 }],
    },
  },
  'drop.notable-loot-spoon': {
    kind: 'drop',
    image: 'anvil-drop.png',
    spoon: 3,
    facts: {
      rsn: 'Zezima', source: 'Theatre of Blood', sourceKind: 'event', kc: 412, notable: 'loot', spoon: true,
      items: [{ id: 25746, name: 'Sanguine dust', qty: 1, value: 0 }],
    },
  },
  'drop.notable-unlock-anon': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: { notable: 'unlock', earned: true, items: [{ id: -1, name: 'Fire cape', qty: 1, value: 0 }] },
  },
  'drop.notable-unlock-guaranteed': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      rsn: 'Zezima', notable: 'unlock', guaranteed: true,
      items: [{ id: -1, name: 'Holy ornament kit', qty: 1, value: 0 }],
    },
  },
  'drop.combined-spoon': {
    kind: 'drop',
    image: 'anvil-drop.png',
    spoon: 2,
    facts: {
      rsn: 'Zezima', source: 'Vorkath', sourceKind: 'npc', kc: 120, spoon: true,
      items: [
        { id: 22006, name: 'Skeletal visage', qty: 1, value: 5_000_000 },
        { id: 21907, name: "Vorkath's head", qty: 2, value: 60_000_000 },
        { id: 11286, name: 'Draconic visage', qty: 1, value: 60_000_000 },
      ],
    },
  },
  'drop.combined-anon': {
    kind: 'drop',
    image: 'anvil-drop.png',
    facts: {
      items: [
        { id: 1, name: 'Item A', qty: 1, value: 1_000_000 },
        { id: 2, name: 'Item B', qty: 4, value: 2_000_000 },
      ],
    },
  },
  'drop.no-screenshot': {
    kind: 'drop',
    image: null,
    facts: {
      rsn: 'Zezima', source: 'Vorkath', sourceKind: 'npc', kc: 54, dropRate: 1 / 1000,
      items: [{ id: 22111, name: 'Dragonbone necklace', qty: 1, value: 12_345_678 }],
    },
  },

  'pet.named': {
    kind: 'pet',
    image: 'anvil-pet.png',
    facts: { rsn: 'Zezima', name: 'Vorki', itemId: 21992, source: 'Vorkath', kc: 1_500, dropRate: 1 / 3000 },
  },
  'pet.duplicate-skill': {
    kind: 'pet',
    image: 'anvil-pet.png',
    facts: { rsn: 'Zezima', name: 'Beaver', itemId: 13322, duplicate: true, skill: 'woodcutting', dropRate: 1 / 317_647 },
  },
  'pet.unnamed': {
    kind: 'pet',
    image: 'anvil-pet.png',
    facts: { source: 'General Graardor', kc: 50, dropRate: 1 / 5000 },
  },
  'pet.spooned': {
    kind: 'pet',
    image: 'anvil-pet.png',
    facts: { rsn: 'Lucky', name: 'Pet snakeling', itemId: 12921, source: 'Zulrah', kc: 100, dropRate: 1 / 4000 },
  },

  'clogSlot.full': {
    kind: 'clogSlot',
    image: 'anvil-clog.png',
    facts: { rsn: 'Zezima', item: 'Abyssal whip', itemId: 4151, slots: 548, slotsMax: 1712, source: 'Abyssal demon', kc: 2500 },
  },
  'clogSlot.unsynced': {
    kind: 'clogSlot',
    image: 'anvil-clog.png',
    facts: { item: 'Pet rock', slots: 0, slotsMax: 0 },
  },
  'clogSlot.gilded': {
    kind: 'clogSlot',
    image: 'anvil-clog.png',
    facts: { rsn: 'Zezima', item: 'Twisted bow', itemId: 20997, slots: 1600, slotsMax: 1712, source: 'Chambers of Xeric' },
  },

  'caTask.hard': {
    kind: 'caTask',
    image: 'anvil-ca.png',
    facts: { rsn: 'Zezima', tier: 'Hard', task: 'Into the Den of Giants', totalPoints: 216, nextThreshold: 726 },
  },
  'caTask.all-unlocked': {
    kind: 'caTask',
    image: 'anvil-ca.png',
    facts: { rsn: 'Zezima', tier: 'Grandmaster', task: 'Perfect Zulrah', totalPoints: 2500, nextThreshold: 0 },
  },
  'caTask.no-total': {
    kind: 'caTask',
    image: 'anvil-ca.png',
    facts: { tier: 'Easy', task: 'Noxious Foe', totalPoints: 0 },
  },

  'caTier.elite': { kind: 'caTier', facts: { rsn: 'Zezima', tier: 'Elite' } },
  'caTier.anon': { kind: 'caTier', facts: { tier: 'Master' } },
  'diary.elite': {
    kind: 'diary',
    image: 'anvil-diary.png',
    facts: { rsn: 'Zezima', area: 'Lumbridge & Draynor', tier: 'Elite' },
  },
  'quest.Dragon Slayer II': { kind: 'quest', facts: { rsn: 'Zezima', quest: 'Dragon Slayer II', difficulty: 'Grandmaster' } },
  "quest.Cook's Assistant": { kind: 'quest', facts: { rsn: 'Zezima', quest: "Cook's Assistant", difficulty: null } },
  'quest.The Grand Tree': { kind: 'quest', facts: { rsn: 'Zezima', quest: 'The Grand Tree', difficulty: 'Experienced' } },
  'level99.slayer': {
    kind: 'level99',
    image: 'anvil-achievement.png',
    facts: { rsn: 'Zezima', skill: 'Slayer', at99: 12, skills: 23 },
  },
  'totalLevel.milestone': {
    kind: 'totalLevel',
    image: 'anvil-achievement.png',
    facts: { rsn: 'Zezima', total: 1800, current: 1803, max: 2277 },
  },
  'totalLevel.maxed': {
    kind: 'totalLevel',
    image: 'anvil-achievement.png',
    facts: { rsn: 'Zezima', total: 2277, maxed: true, current: 2277, max: 2277 },
  },
  'totalLevel.not-chasing': {
    kind: 'totalLevel',
    image: 'anvil-achievement.png',
    facts: { total: 1500 },
  },
};

test('every legacy fixture has a case, and every case a fixture', () => {
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(legacy).sort());
});

for (const [name, c] of Object.entries(cases)) {
  test(`matches the plugin's own embed: ${name}`, () => {
    const out = buildPluginEmbed(c.kind, c.facts, {
      imageFilename: c.image ?? null,
      random: pick(c.spoon ?? 0),
    });
    assert.ok(out.ok, out.ok ? '' : out.error);
    // Through JSON so an `undefined` key can't hide behind deepEqual.
    assert.deepEqual(JSON.parse(JSON.stringify(out.embed)), legacy[name]);
  });
}

test('a spoon line is drawn from the pool', () => {
  const out = buildPluginEmbed('drop', { spoon: true, items: [{ name: 'Item', qty: 1, value: 1 }] });
  assert.ok(out.ok);
  const line = out.embed.description!.split('\n')[1];
  assert.ok((SPOON_LINES as readonly string[]).includes(line));
});

test('bad input is refused, never thrown', () => {
  const bad: [unknown, unknown][] = [
    ['nope', {}],
    [undefined, {}],
    ['drop', null],
    ['drop', []],
    ['drop', { items: [] }],
    ['drop', { items: [{ name: 'x', qty: 0, value: 1 }] }],
    ['drop', { items: [{ name: 'x', qty: 1, value: 1 }], dropRate: 2 }],
    ['drop', { items: [{ name: 'x', qty: 1, value: 1 }], notable: 'sometimes' }],
    ['drop', { items: [{ name: 'x', qty: '1', value: 1 }] }],
    ['caTask', { task: 't', tier: 'Legendary' }],
    ['caTier', { tier: 5 }],
    ['quest', { quest: '' }],
    ['level99', { skill: 'Slayer', at99: 1.5, skills: 23 }],
    ['clogSlot', { item: 'x', rsn: 7 }],
    ['pet', { duplicate: 'yes' }],
  ];
  for (const [kind, facts] of bad) {
    const out = buildPluginEmbed(kind, facts);
    assert.equal(out.ok, false, `${String(kind)} ${JSON.stringify(facts)}`);
  }
});

test('luck wording matches the plugin DropLuck thresholds', () => {
  assert.equal(luckLabel(null, 10), null);
  assert.equal(luckLabel(1 / 100, null), null);
  assert.equal(luckLabel(1 / 1000, 54), 'Top 5% — spooned');
  assert.equal(luckLabel(1 / 100, 30), 'Top 26%');
  assert.equal(luckLabel(1 / 100, 69), null); // typical
  assert.equal(luckLabel(1 / 100, 300), 'Dry — 95% had it by now');
  assert.equal(luckLabel(1 / 100_000, 1), 'Top 1% — spooned'); // floors at 1%
});

test('collection-log ranks (ported from the plugin ClogRank)', () => {
  assert.equal(clogRank(99, 1712), null);
  assert.equal(clogRank(100, 1712), 'Bronze');
  assert.equal(clogRank(855, 1712), 'Black');
  assert.equal(clogRank(1524, 1712), 'Dragon');
  assert.equal(clogRank(1525, 1712), 'Gilded');
  assert.equal(clogRank(1800, 2000), 'Gilded');
  assert.equal(clogRank(1600, 0), 'Dragon');
  assert.equal(clogRank(0, 1712), null);
});
