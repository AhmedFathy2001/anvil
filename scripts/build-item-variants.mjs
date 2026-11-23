// Regenerates src/data/itemVariants.json: ids the game gives one item under.
//
// A tile stores the id its creator picked, but the game hands out the same item under several ids:
// Pyramid Plunder's sceptre lands as 26950 (charged, first issue), recharges to 26948, empties to
// 26945 "(uncharged)", while 9044–9051 and 13074–13078 are the old sceptre that still carries the
// name. A tile tracking any one of them must count the others.
//
// Grouped by RuneLite's item-name cache: identical names, plus "(uncharged)" / "(charged)" /
// "(inactive)" / "(empty)" folded onto the plain name. Only names with more than one id are kept.
// Collection-log slots that share a name ("Decorative armour" ×15) are kept apart at read time
// (lib/itemVariants), not here.
//
// Run:  node scripts/build-item-variants.mjs        (or: npm run data:variants)

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, '../src/data/itemVariants.json');
const NAMES_URL = 'https://static.runelite.net/cache/item/names.json';

export function baseName(name) {
  return name.trim().replace(/\s*\((uncharged|charged|inactive|empty)\)$/i, '').toLowerCase();
}

const res = await fetch(NAMES_URL, { headers: { 'User-Agent': 'anvil item variants builder' } });
if (!res.ok) throw new Error(`names.json HTTP ${res.status}`);
const names = await res.json();

const groups = new Map();
const spellings = new Map();
for (const [id, name] of Object.entries(names)) {
  if (typeof name !== 'string' || !name.trim() || name.trim().toLowerCase() === 'null') continue;
  const key = baseName(name);
  const list = groups.get(key) ?? [];
  list.push(Number(id));
  groups.set(key, list);
  spellings.set(key, (spellings.get(key) ?? new Set()).add(name.trim().toLowerCase()));
}
const keys = [...groups.keys()].filter((k) => groups.get(k).length > 1).sort((a, b) => Math.min(...groups.get(a)) - Math.min(...groups.get(b)));
const out = keys.map((k) => groups.get(k).sort((a, b) => a - b));
// Groups that join differently named forms (charged and uncharged), not just an item's noted and
// placeholder copies: the editor says "any version counts" only for these.
const forms = keys.flatMap((k, i) => (spellings.get(k).size > 1 ? [i] : []));
if (out.length < 1000) throw new Error(`only ${out.length} groups — refusing to overwrite`);

writeFileSync(OUT_PATH, JSON.stringify({ source: NAMES_URL, generatedAt: new Date().toISOString(), forms, groups: out }) + '\n');
console.log(`wrote ${out.length} variant groups to ${OUT_PATH}`);
