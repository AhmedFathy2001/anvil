// Regenerates the gear-calculator datasets from the OSRS Wiki (Bucket API):
//
//   src/data/gearItems.json    — every equippable item with a combat bonus (offensive, defensive or
//                                prayer), or one the DPS engine knows a special effect for: slot, attack/strength bonuses,
//                                speed, weapon category and icon.
//   src/data/gearMonsters.json — every monster version with hitpoints and a defence level: its
//                                defence levels and bonuses, attributes (undead, dragon, demon…),
//                                size, flat armour and elemental weakness.
//
// Three buckets: infobox_bonuses (the stats), infobox_item (id + icon, joined on page_name_sub —
// infobox_bonuses carries no id), infobox_monster. Facts only: the combat FORMULAS live in
// src/lib/dps and are written from the wiki's published mechanics, not taken from any calculator.
//
// Run:  node scripts/build-gear-dataset.mjs        (or: npm run data:gear)

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ITEMS_PATH = resolve(HERE, '../src/data/gearItems.json');
const MONSTERS_PATH = resolve(HERE, '../src/data/gearMonsters.json');

const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const USER_AGENT = 'anvil-gear dataset builder (contact: clan admin)';
const PAGE_SIZE = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bucketQuery(query) {
  const body = new URLSearchParams({ action: 'bucket', format: 'json', query });
  const res = await fetch(WIKI_API, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`bucket query HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`bucket error: ${json.error}`);
  return json.bucket ?? [];
}

async function fetchAll(bucket, fields, label) {
  const selects = fields.map((f) => `"${f}"`).join(',');
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await bucketQuery(`bucket("${bucket}").select(${selects}).limit(${PAGE_SIZE}).offset(${offset}).run()`);
    rows.push(...page);
    process.stdout.write(`  ${label}: ${rows.length} rows\r`);
    if (page.length < PAGE_SIZE) break;
    await sleep(150);
  }
  process.stdout.write('\n');
  return rows;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : 0);
const first = (v) => (Array.isArray(v) ? v[0] : v);

// Variants that are never the one a player fights with.
const DEAD_VARIANT = /uncharged|inactive|broken|degraded|deadman|last man standing|\blms\b|\(beta\)|partially charged|\bempty\b|#0$|#25$|#50$|#75$|locked|\bplaceholder\b|\bnoted\b/i;
// When several live variants remain, the one to keep.
const PREFERRED_VARIANT = /undamaged|#charged|#active|#normal|#new|#full|#100$|#standard/i;

// Items the engine models an effect for — kept even when their raw bonuses are all zero.
const EFFECT_ITEMS = /salve amulet|slayer helmet|black mask|void|crystal (helm|body|legs)|obsidian|berserker necklace|inquisitor|elite void/i;

async function main() {
  console.log('Fetching equipment and monsters via the Bucket API…');
  const bonusRows = await fetchAll(
    'infobox_bonuses',
    [
      'page_name', 'page_name_sub', 'equipment_slot', 'combat_style', 'weapon_attack_speed', 'weapon_attack_range',
      'stab_attack_bonus', 'slash_attack_bonus', 'crush_attack_bonus', 'magic_attack_bonus', 'range_attack_bonus',
      'strength_bonus', 'ranged_strength_bonus', 'magic_damage_bonus', 'prayer_bonus',
      'stab_defence_bonus', 'slash_defence_bonus', 'crush_defence_bonus', 'magic_defence_bonus', 'range_defence_bonus',
    ],
    'infobox_bonuses',
  );
  const itemRows = await fetchAll('infobox_item', ['page_name', 'page_name_sub', 'item_id', 'image'], 'infobox_item');
  const monsterRows = await fetchAll(
    'infobox_monster',
    [
      'page_name', 'page_name_sub', 'version_anchor', 'hitpoints', 'combat_level', 'defence_level', 'magic_level',
      'magic_attack_bonus', 'stab_defence_bonus', 'slash_defence_bonus', 'crush_defence_bonus', 'magic_defence_bonus',
      'light_range_defence_bonus', 'standard_range_defence_bonus', 'heavy_range_defence_bonus', 'range_defence_bonus',
      'attribute', 'size', 'flat_armour', 'elemental_weakness', 'elemental_weakness_percent', 'slayer_category',
    ],
    'infobox_monster',
  );

  // page_name_sub → { id, image }
  const itemInfo = new Map();
  for (const r of itemRows) {
    const key = r.page_name_sub || r.page_name;
    const ids = (Array.isArray(r.item_id) ? r.item_id : [r.item_id]).map((v) => parseInt(v, 10)).filter(Number.isInteger);
    const image = first(r.image);
    itemInfo.set(key, {
      id: ids.length ? Math.min(...ids) : null,
      img: typeof image === 'string' ? image.replace(/^File:/, '').replace(/\]\]$/, '').replace(/^\[\[/, '') : null,
    });
  }

  // Group bonus rows per page and pick the variant a player actually uses.
  const byPage = new Map();
  for (const r of bonusRows) {
    if (!r.page_name || !r.equipment_slot) continue;
    const list = byPage.get(r.page_name) ?? [];
    list.push(r);
    byPage.set(r.page_name, list);
  }

  const items = [];
  const seenIds = new Set();
  for (const [page, rows] of byPage) {
    const live = rows.filter((r) => !DEAD_VARIANT.test(r.page_name_sub || ''));
    if (!live.length) continue;
    const pick = live.find((r) => PREFERRED_VARIANT.test(r.page_name_sub || '')) ?? live[0];
    const info = itemInfo.get(pick.page_name_sub || page) ?? itemInfo.get(page) ?? { id: null, img: null };
    if (info.id == null || seenIds.has(info.id)) continue;
    const b = [
      num(pick.stab_attack_bonus),
      num(pick.slash_attack_bonus),
      num(pick.crush_attack_bonus),
      num(pick.magic_attack_bonus),
      num(pick.range_attack_bonus),
      num(pick.strength_bonus),
      num(pick.ranged_strength_bonus),
      num(pick.magic_damage_bonus),
      num(pick.prayer_bonus),
    ];
    const offensive = b.slice(0, 8).some((x) => x > 0);
    // Defence total: no DPS, but a guide's setup still lists the shield that stops dragonfire.
    const df = ['stab_defence_bonus', 'slash_defence_bonus', 'crush_defence_bonus', 'magic_defence_bonus', 'range_defence_bonus'].reduce((a, k) => a + num(pick[k]), 0);
    const slot = String(pick.equipment_slot).toLowerCase().replace(/\s+/g, '');
    // Weapons stay even at zero bonus (a speed and styles still matter) — except the "Unarmed" ones,
    // which are novelty items held in the hand (greegrees, trays, crates) and only clutter a picker.
    const isWeapon = slot === 'weapon' || slot === '2h';
    if (!offensive && df <= 0 && b[8] <= 0 && !EFFECT_ITEMS.test(page) && (!isWeapon || pick.combat_style === 'Unarmed')) continue;
    seenIds.add(info.id);
    items.push({
      id: info.id,
      n: page,
      s: slot === '2h' ? 'weapon' : slot,
      ...(slot === '2h' ? { h2: 1 } : {}),
      b,
      ...(df ? { df } : {}),
      ...(pick.weapon_attack_speed ? { sp: num(pick.weapon_attack_speed) } : {}),
      ...(pick.combat_style ? { c: String(pick.combat_style) } : {}),
      ...(info.img ? { img: info.img } : {}),
    });
  }
  items.sort((a, b) => a.n.localeCompare(b.n));

  const monsters = [];
  for (const r of monsterRows) {
    const hp = num(r.hitpoints);
    if (!r.page_name || hp <= 0 || r.defence_level == null) continue;
    const attrs = (Array.isArray(r.attribute) ? r.attribute : r.attribute ? [r.attribute] : []).map((a) => String(a).toLowerCase());
    const rangeDef = num(r.range_defence_bonus);
    monsters.push({
      n: r.page_name,
      ...(r.version_anchor ? { v: String(r.version_anchor) } : {}),
      hp,
      cb: num(r.combat_level),
      // [defence level, magic level]
      lv: [num(r.defence_level), num(r.magic_level)],
      mab: num(r.magic_attack_bonus),
      // [stab, slash, crush, magic, light ranged, standard ranged, heavy ranged]
      d: [
        num(r.stab_defence_bonus),
        num(r.slash_defence_bonus),
        num(r.crush_defence_bonus),
        num(r.magic_defence_bonus),
        r.light_range_defence_bonus != null ? num(r.light_range_defence_bonus) : rangeDef,
        r.standard_range_defence_bonus != null ? num(r.standard_range_defence_bonus) : rangeDef,
        r.heavy_range_defence_bonus != null ? num(r.heavy_range_defence_bonus) : rangeDef,
      ],
      ...(attrs.length ? { a: attrs } : {}),
      sz: num(r.size) || 1,
      ...(num(r.flat_armour) ? { fa: num(r.flat_armour) } : {}),
      ...(r.elemental_weakness ? { ew: String(r.elemental_weakness).toLowerCase(), ewp: num(r.elemental_weakness_percent) } : {}),
    });
  }
  monsters.sort((a, b) => a.n.localeCompare(b.n) || (a.v ?? '').localeCompare(b.v ?? ''));

  writeFileSync(ITEMS_PATH, JSON.stringify({ source: 'https://oldschool.runescape.wiki/w/Special:Bucket/infobox_bonuses', generatedAt: new Date().toISOString(), items }) + '\n');
  writeFileSync(MONSTERS_PATH, JSON.stringify({ source: 'https://oldschool.runescape.wiki/w/Special:Bucket/infobox_monster', generatedAt: new Date().toISOString(), monsters }) + '\n');
  console.log(`Wrote ${items.length} items → ${ITEMS_PATH}`);
  console.log(`Wrote ${monsters.length} monsters → ${MONSTERS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
