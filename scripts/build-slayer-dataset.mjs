// Regenerates src/data/slayerMonsters.json from the OSRS Wiki.
//
// The Slayer tab of the KC-tile generator needs what the hiscores can never supply: which monsters
// exist, what they're called in game, and which task group they belong to — so a host can ask for
// "every abyssal demon tier" without typing names. The wiki already carries all three on every
// monster infobox, so a regen picks up new content the same way the drops dataset does.
//
// Source: the Bucket structured-data API (action=bucket), bucket `infobox_monster`:
//   page_name        — the wiki page, which is the in-game name once disambiguation is stripped
//   slayer_category  — the task group ("Abyssal Demons"); absent for anything never assigned
//   slayer_level     — the Slayer requirement, when it has one
//   combat_level     — for ordering within a group
//
// Run:  node scripts/build-slayer-dataset.mjs        (or: npm run data:slayer)

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, '../src/data/slayerMonsters.json');

const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const USER_AGENT = 'anvil-bingo slayer dataset builder (contact: clan admin)';
const PAGE_SIZE = 5000;

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

/**
 * The in-game name.
 *
 * Wiki pages disambiguate with a parenthetical — "Abyssal demon (Catacombs)", "Rock (Quarry)" —
 * but the client reports the plain name, and a kill tile matches on exactly that. So the suffix is
 * stripped and the variants collapse into one entry, which is also how a host thinks about them.
 */
function inGameName(pageName) {
  return pageName.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function main() {
  const rows = await bucketQuery(
    `bucket("infobox_monster").select("page_name","slayer_category","slayer_level","combat_level").limit(${PAGE_SIZE}).run()`,
  );
  console.log(`fetched ${rows.length} monster rows`);

  // name → best-known record, per category. The lowest Slayer level across variants is the one that
  // decides whether a player can be assigned it at all, so that is the one worth showing.
  const byCategory = new Map();
  for (const row of rows) {
    const cats = row.slayer_category;
    if (!cats) continue;
    const name = inGameName(String(row.page_name ?? ''));
    if (!name) continue;
    for (const rawCat of Array.isArray(cats) ? cats : [cats]) {
      const cat = String(rawCat).trim();
      if (!cat) continue;
      if (!byCategory.has(cat)) byCategory.set(cat, new Map());
      const monsters = byCategory.get(cat);
      const prior = monsters.get(name);
      const slayerLevel = num(row.slayer_level);
      const combatLevel = num(row.combat_level);
      if (!prior) {
        monsters.set(name, { name, slayerLevel, combatLevel });
      } else {
        if (slayerLevel != null && (prior.slayerLevel == null || slayerLevel < prior.slayerLevel)) {
          prior.slayerLevel = slayerLevel;
        }
        if (combatLevel != null && (prior.combatLevel == null || combatLevel > prior.combatLevel)) {
          prior.combatLevel = combatLevel;
        }
      }
    }
  }

  const categories = [...byCategory.entries()]
    .map(([label, monsters]) => ({
      label,
      // Ordinary monsters first, weakest to strongest. Anything with no combat level is a fight
      // mechanic rather than a target — Abyssal Sire's "Respiratory system", reanimated remains —
      // and sorting those to the top (a null reading as 0) buried the monster people came for.
      monsters: [...monsters.values()].sort((a, b) => {
        const aOdd = a.combatLevel == null ? 1 : 0;
        const bOdd = b.combatLevel == null ? 1 : 0;
        if (aOdd !== bOdd) return aOdd - bOdd;
        return (a.combatLevel ?? 0) - (b.combatLevel ?? 0) || a.name.localeCompare(b.name);
      }),
    }))
    .filter((c) => c.monsters.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  const out = {
    source: 'https://oldschool.runescape.wiki/w/Special:Bucket/infobox_monster',
    generatedAt: new Date().toISOString().slice(0, 10),
    note: 'Slayer task groups and their monsters. Names are in-game names (wiki disambiguation stripped), which is what a kill tile matches against. Rebuild with `npm run data:slayer`.',
    categoryCount: categories.length,
    monsterCount: categories.reduce((n, c) => n + c.monsters.length, 0),
    categories,
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote ${out.categoryCount} categories / ${out.monsterCount} monsters → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
