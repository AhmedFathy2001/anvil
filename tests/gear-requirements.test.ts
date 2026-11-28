// Equipment requirements: the wiki level-up-table parser, the bundled data it produced, and
// canEquip. No database, no network.
//
// Run: npx tsx --test tests/gear-requirements.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { GearItem } from '../src/lib/dps/engine.ts';
import { canEquip, missingLine, parseLevelUpTable, requirementsByItem } from '../src/lib/dps/requirements.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };

const ITEMS = (itemsJson as { items: GearItem[] }).items;
const item = (name: string) => {
  const it = ITEMS.find((i) => i.n.toLowerCase() === name.toLowerCase());
  assert.ok(it, `dataset has ${name}`);
  return it!;
};

const DEFENCE_TABLE = `{{Level up table
|members40 =
* Wear {{plink|rune armour|pic=Rune platebody}} (with {{SCP|Quest}} [[Dragon Slayer I]] completed for [[Rune platebody|platebody]])
|members70 =
* Wear {{plink|Barrows equipment|pic=Dharok's platebody}} (with {{SCP|Ranged|70}} for {{plink|Karil the Tainted's equipment|pic=Karil's leathertop}}, or {{SCP|Magic|70}} for {{plink|Ahrim the Blighted's equipment|pic=Ahrim's robetop}})
|members78 =
* Wear {{plink|oathplate armour|pic=Oathplate chest}}
* Wear {{plink|Ancient Warriors' equipment|pic=Vesta's chainbody (bh)}} (only usable in [[Bounty Hunter]])
|members80 =
* Wear {{plink|Torva armour|pic=Torva platebody}}
* Wear {{plink|ferocious gloves}} (with {{SCP|Attack|80}} and {{SCP|Quest}} [[Dragon Slayer II]] completed)
* Wear {{plink|Masori armour|pic=Masori body (f)|txt=Fortified Masori armour}} (with {{SCP|Ranged|80}})
}}`;
const RANGED_TABLE = `|members70 =
* Wear {{plink|black dragonhide armour|pic=black d'hide body}} (with {{SCP|Defence|40}} for the body)`;

const fake = (n: string, s = 'body'): Pick<GearItem, 'id' | 'n' | 's' | 'c'> => ({ id: n.length * 1000 + n.charCodeAt(0) + n.charCodeAt(n.length - 1), n, s });

test('the parser reads each line: its pages, its level, its extra levels and quests', () => {
  const e = parseLevelUpTable('defence', DEFENCE_TABLE);
  assert.equal(e.length, 6, 'the Bounty Hunter-only line is left out');
  const fero = e.find((x) => x.targets[0] === 'ferocious gloves')!;
  assert.deepEqual(fero.reqs, { defence: 80, attack: 80 });
  assert.deepEqual(fero.quests, ['Dragon Slayer II']);
  const barrows = e.find((x) => x.targets[0] === 'barrows equipment')!;
  assert.deepEqual(barrows.reqs, { defence: 70 });
  assert.equal(barrows.scoped.length, 2, 'Ranged for Karil’s, Magic for Ahrim’s');
});

test('sets reach their pieces; "for" parts only the pieces they name; longest stem wins', () => {
  const items = [
    fake('Torva platebody'), fake('Torva full helm', 'head'), fake('Oathplate chest'), fake('Masori body'), fake('Masori body (f)'),
    fake("Dharok's helm", 'head'), fake("Karil's leathertop"), fake("Ahrim's robetop"), fake('Ferocious gloves', 'hands'),
    fake("Black d'hide body"), fake("Black d'hide chaps", 'legs'), fake('Rune platebody'), fake('Rune platelegs', 'legs'),
  ];
  const got = requirementsByItem(items, [...parseLevelUpTable('defence', DEFENCE_TABLE), ...parseLevelUpTable('ranged', RANGED_TABLE)]);
  const rq = (n: string) => got.get(items.find((i) => i.n === n)!.id);
  assert.deepEqual(rq('Torva platebody')!.rq, { defence: 80 });
  assert.deepEqual(rq('Torva full helm')!.rq, { defence: 80 });
  assert.deepEqual(rq('Oathplate chest')!.rq, { defence: 78 });
  assert.equal(rq('Masori body'), undefined, 'only the fortified pieces need Defence');
  assert.deepEqual(rq('Masori body (f)')!.rq, { defence: 80, ranged: 80 });
  assert.deepEqual(rq("Dharok's helm")!.rq, { defence: 70 });
  assert.deepEqual(rq("Karil's leathertop")!.rq, { defence: 70, ranged: 70 });
  assert.deepEqual(rq("Ahrim's robetop")!.rq, { defence: 70, magic: 70 });
  assert.deepEqual(rq('Ferocious gloves')!.rqq, ['Dragon Slayer II']);
  assert.deepEqual(rq("Black d'hide body")!.rq, { ranged: 70, defence: 40 });
  assert.deepEqual(rq("Black d'hide chaps")!.rq, { ranged: 70 }, '"for the body" is the body only');
  assert.deepEqual(rq('Rune platebody')!.rqq, ['Dragon Slayer I']);
  assert.deepEqual(rq('Rune platelegs')!.rqq, [], 'the platebody’s quest stays with the platebody');
});

test('the bundled data carries the wiki’s requirements', () => {
  assert.deepEqual(item('Torva platebody').rq, { defence: 80 });
  assert.deepEqual(item('Scythe of Vitur').rq, { attack: 80, strength: 90 });
  assert.deepEqual(item('Twisted bow').rq, { ranged: 85 });
  assert.deepEqual(item("Tumeken's shadow").rq, { magic: 85 });
  assert.deepEqual(item('Abyssal whip').rq, { attack: 70 });
  assert.deepEqual(item('Masori body (f)').rq, { defence: 80, ranged: 80 });
  assert.deepEqual(item('Dragon scimitar').rqq, ['Monkey Madness I']);
  assert.equal(item('Dragon warhammer').rq?.attack, undefined, 'warhammers are Strength only');
});

test('canEquip blocks Torva at 1 Defence, allows it at 80, and says what is missing', () => {
  const torva = item('Torva platebody');
  const pure = canEquip(torva, { attack: 99, strength: 99, defence: 1 });
  assert.equal(pure.ok, false);
  assert.deepEqual(pure.missing, [{ skill: 'defence', need: 80, have: 1 }]);
  assert.equal(missingLine(pure), 'needs 80 Defence');
  assert.equal(canEquip(torva, { defence: 80 }).ok, true);
  assert.equal(canEquip(torva, {}).ok, true, 'a level not known is not checked');
  const scythe = canEquip(item('Scythe of Vitur'), { attack: 75, strength: 75 });
  assert.equal(missingLine(scythe), 'needs 80 Attack and 90 Strength');
  // Quests only when the caller knows them.
  const fero = item('Ferocious gloves');
  assert.equal(canEquip(fero, { attack: 99, defence: 99 }).ok, true);
  assert.equal(canEquip(fero, { attack: 99, defence: 99 }, []).ok, false);
  assert.equal(canEquip(fero, { attack: 99, defence: 99 }, ['Dragon Slayer II']).ok, true);
  assert.equal(canEquip(null, { defence: 1 }).ok, true);
});
