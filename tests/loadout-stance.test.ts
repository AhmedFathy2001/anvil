// Golden stance and requirement tests for the loadout engine: the attack style each phase uses is
// worked out from the assembled gear, "Avoid Defence XP" keeps a pure off every style that trains
// Defence, and gear the levels can't wear is never picked. Real items and monsters. No database.
//
// Run: npx tsx --test tests/loadout-stance.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canEquip } from '../src/lib/dps/requirements.ts';
import { givesDefenceXp, stylesFor } from '../src/lib/dps/tables.ts';
import { buildLoadout } from '../src/lib/loadout/engine.ts';
import { COX, TOB } from '../src/lib/loadout/profiles/index.ts';
import type { BossProfile, Loadout, PlayerInput } from '../src/lib/loadout/types.ts';
import { idOf, idx, maxPlayer, SUPPLIES } from './fixtures/loadoutBanks.ts';

const MAXED = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };
const PURE = { ...MAXED, defence: 1 };
const run = (profile: BossProfile, player: PlayerInput) => buildLoadout({ profile, preset: 'max', player, idx });
const MELEE = ['Scythe of vitur', 'Twisted bow', 'Dragon arrow', 'Amulet of rancour', 'Ferocious gloves', 'Primordial boots', 'Infernal cape', 'Ultor ring'];
const tekton = (l: Loadout) => l.phases.find((p) => p.key === 'tekton')!;

/** The weapon a phase is fought with: the stance names it (a job's switch, not just the style's first weapon). */
const weaponFor = (p: Loadout['phases'][number]) => (p.stance ? (idx.items.find((it) => it.n === p.stance!.weapon) ?? null) : null);

test('Tekton: Scythe of Vitur with full Oathplate is used on slash', () => {
  const l = run(COX, { levels: MAXED, owned: [...MELEE, 'Oathplate helm', 'Oathplate chest', 'Oathplate legs'].map(idOf), supplies: SUPPLIES });
  const t = tekton(l);
  assert.equal(t.kit, 'melee');
  assert.equal(t.stance?.type, 'slash');
});

test('Tekton: Scythe of Vitur with Torva stays on slash (Torva has no crush bonus to tip it)', () => {
  // The wiki's "crush with Inquisitor's" reading needs a crush bonus the Scythe doesn't have: its
  // +30 crush against +125 slash loses even into Tekton's +105 crush defence. The engine follows the numbers.
  const l = run(COX, { levels: MAXED, owned: [...MELEE, 'Torva full helm', 'Torva platebody', 'Torva platelegs'].map(idOf), supplies: SUPPLIES });
  assert.equal(tekton(l).stance?.type, 'slash');
  const scythe = stylesFor('Scythe');
  assert.ok(scythe.some((s) => s.type === 'crush'), 'crush (Jab) was on offer');
});

test('a Defence-1 player with Avoid Defence XP never gets a stance that trains Defence', () => {
  for (const profile of [COX, TOB]) {
    const l = run(profile, maxPlayer({ levels: PURE, avoidDefenceXp: true }));
    for (const p of l.phases) {
      if (!p.kit || !p.stance) continue;
      const w = weaponFor(p);
      assert.ok(w, `${profile.key} ${p.key}: a weapon for ${p.kit}`);
      const style = stylesFor(w!.c).find((s) => s.name === p.stance!.name && s.type === p.stance!.type);
      assert.ok(style, `${p.key}: ${p.stance.name} is one of ${w!.n}'s styles`);
      assert.ok(!givesDefenceXp(style!), `${profile.key} ${p.key}: ${w!.n} on ${style!.name} (${style!.stance}) trains Defence`);
    }
  }
});

test('without the toggle a Defence-trained style is still allowed (the toggle is what bans it)', () => {
  // A spear's styles are all controlled: with the toggle the lance can't be used at all.
  const owned = ['Dragon hunter lance', 'Twisted bow', 'Dragon arrow'].map(idOf);
  const free = run(COX, { levels: MAXED, owned, supplies: SUPPLIES });
  assert.equal(tekton(free).kit, 'melee');
  const pure = run(COX, { levels: PURE, owned, supplies: SUPPLIES, avoidDefenceXp: true });
  assert.notEqual(tekton(pure).kit, 'melee', 'the lance only has Defence-training styles');
});

test('gear the levels cannot wear is never picked: Torva, Masori (f) and Void at 1 Defence', () => {
  const l = run(COX, maxPlayer({ levels: PURE, avoidDefenceXp: true }));
  const carried = [...Object.values(l.worn), ...l.switches.map((s) => s.id), ...l.specs.map((s) => s.id)].filter((x): x is number => x != null);
  for (const id of carried) assert.ok(canEquip(idx.item(id), PURE).ok, `${idx.item(id)!.n} needs more than 1 Defence`);
  const names = carried.map((id) => idx.item(id)!.n);
  assert.ok(!names.some((n) => /^(torva|masori .*\(f\)|elite void|void )/i.test(n)), names.join(', '));
  assert.ok(canEquip(idx.item(idOf('Torva platebody')), PURE).ok === false);
});
