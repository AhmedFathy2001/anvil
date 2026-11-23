// Regenerates src/data/clogMinor.json: the collection-log slots on boss and raid pages that are NOT
// what a bingo means by "a unique": bolt racks on Barrows, ToA's jewels and shrouds, a raid's kits.
//
// The tile editor leaves these unticked when a page is added ("Uniques only"), and the tile creator's
// "toa unique" / "4 different barrows pieces" lines skip them. Ticking one back always works.
//
// The rule is fixed, so the list can be read and argued with rather than guessed:
//   1. Only pages on the Bosses and Raids tabs. Clue, minigame and other pages have no "unique" to
//      pick out — everything there is a reward of the same kind.
//   2. A COMMON DROP: the page's own boss drops it more often than 1 in 50 (npcDrops.json), e.g.
//      Zulrah's scales, the Mole's claws, a boss's teleport scroll.
//   3. A REWARD, NOT A DROP: cosmetics, kits, dusts, shrouds, a raid's point capes and invocation
//      unlocks, and the DT2 bosses' tablets and orbs, listed by name below.
// KEEP overrides rule 2 where the wiki's rate is wrong for this purpose (Yama's oathplate reads as
// 1/1 because the pieces are guaranteed from a shard trade) or the "common" item IS the boss's unique.
//
// Run:  node scripts/build-clog-minor.mjs        (or: npm run data:clogminor) — after data:clog and data:drops.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../src/data');
const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf8'));

const COMMON_BELOW = 50; // "more often than 1 in 50"
const TABS = new Set(['Bosses', 'Raids']);

const REWARD_NAMES = [
  /ornament kit$/i,
  /colou?r kit$/i,
  /crafting kit$/i,
  /^(metamorphic|sanguine|granite) dust$/i,
  /shroud/i, // ToA's Icthlarin's shrouds, ToB's Sinhaza shrouds
  /^xeric's (guard|warrior|sentinel|general|champion)$/i,
  /^bolt rack$/i,
  /^(thread of elidinis|breach of the scarab|eye of the corruptor|jewel of the sun|jewel of amascut|cache of runes)$/i,
  /^(remnant of .+|ancient remnant)$/i,
  /^(frozen|scarred|sirenic|strangled) tablet$/i,
  /^awakener's orb$/i,
  /teleport( scroll)?$/i,
];

const KEEP = new Set([
  'oathplate helm', 'oathplate chest', 'oathplate legs', 'soulflame horn', // Yama: rate data reads 1/1
  "scurrius' spine", // Scurrius's one unique
  'mooleta', // Brutus's weapon
]);

const clog = read('clog.json').activities;
const tabs = read('clogTabs.json');
const drops = read('npcDrops.json');

// Rate of an item from the page's own boss: a drop source whose name the page names, or that names the page.
function ownRate(page, id) {
  const p = page.toLowerCase();
  const first = p.split(' ')[0];
  let best = null;
  for (const [src, rows] of Object.entries(drops)) {
    const s = src.toLowerCase();
    if (!(p.includes(s) || s.includes(first))) continue;
    for (const r of rows) if (r.i === id && r.d > 0 && (best == null || r.d < best)) best = r.d;
  }
  return best;
}

const pages = {};
for (const [page, items] of Object.entries(clog)) {
  if (!TABS.has(tabs[page])) continue;
  const minor = [];
  for (const it of items) {
    const name = it.name.trim();
    const reward = REWARD_NAMES.some((re) => re.test(name));
    const rate = KEEP.has(name.toLowerCase()) ? null : ownRate(page, it.id);
    if (reward || (rate != null && rate < COMMON_BELOW)) minor.push(it.id);
  }
  // A page that would be all minor has nothing to single out.
  if (minor.length > 0 && minor.length < items.length) pages[page] = [...new Set(minor)];
}

const out = {
  rule: 'Bosses and Raids pages: drops more often than 1 in 50 from the page\'s boss, plus cosmetics, kits, dusts, shrouds, point capes, invocation unlocks, DT2 tablets/orbs and teleports. See scripts/build-clog-minor.mjs.',
  pages,
};
writeFileSync(resolve(DATA, 'clogMinor.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`wrote minor slots for ${Object.keys(pages).length} pages`);
