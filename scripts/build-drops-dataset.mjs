// Regenerates the drop datasets from the OSRS Wiki:
//
//   src/data/npcDrops.json       — monster → [{ i: itemId, d: 1-in-d rate, q: quantity }]
//                                  the drop-rate table the board-balance effort model reads.
//   src/data/droppableItems.json — every item id that appears in ANY wiki drop table, split
//                                  into combat kills vs other loot (chests, caskets, thieving,
//                                  hunter). Powers the "drops only" filter on the item picker.
//
// Source: the wiki's Bucket structured-data API (action=bucket, a Lua-ish query language) —
// the same tables that render every {{DropsLine}} on the site, so a regen picks up new bosses
// and rate changes automatically. Two buckets are read:
//   dropsline  — one row per drop-table line: page_name (the source), item_name, drop_json
//                (rarity, quantity, drop type).
//   item_id    — page_name → item id(s), used to turn item page names into numeric ids.
// Shared tables (Rare/Gem/Herb drop table) are ordinary dropsline pages, so their contents land
// in droppableItems.json on their own; we don't expand them per-monster.
//
// Run:  node scripts/build-drops-dataset.mjs        (or: npm run data:drops)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NPC_DROPS_PATH = resolve(HERE, '../src/data/npcDrops.json');
const DROPPABLE_PATH = resolve(HERE, '../src/data/droppableItems.json');
const RAID_REWARDS_PATH = resolve(HERE, '../src/data/raidRewards.json');

// Raid uniques are not a kill table, which is why they are absent from npcDrops.json: the chest
// rolls ONE unique with a chance that depends on how the raid went (points at Chambers of Xeric,
// invocation level at Tombs of Amascut), and only then picks which unique. The wiki files those
// tables under the CHEST rather than the raid, and marks them "reward" instead of "combat" — so
// they are collected separately here, as each item's SHARE of the unique table.
//
// The per-raid chance of any unique at all is the half the hiscores cannot tell us (no points, no
// invocation), so it stays a configurable assumption on the site rather than a number baked in here.
const RAID_CHESTS = {
  'Ancient chest': { key: 'chambersOfXeric', label: 'Chambers of Xeric' },
  'Monumental chest': { key: 'theatreOfBlood', label: 'Theatre of Blood' },
  'Chest (Tombs of Amascut)': { key: 'tombsOfAmascut', label: 'Tombs of Amascut' },
};
// A "#Hard Mode"-style anchor on the wiki's own row maps the row to the harder hiscores counter.
const RAID_MODES = {
  // The plain-mode anchor is still an anchor: without this the Theatre's purples, which the wiki
  // files under "#Normal Mode", are dropped for not matching a harder counter.
  'normal mode': { chambersOfXeric: 'chambersOfXeric', theatreOfBlood: 'theatreOfBlood', tombsOfAmascut: 'tombsOfAmascut' },
  'entry mode': { theatreOfBlood: null, tombsOfAmascut: null },
  'story mode': { tombsOfAmascut: null },
  'hard mode': { theatreOfBlood: 'theatreOfBloodHardMode' },
  'challenge mode': { chambersOfXeric: 'chambersOfXericChallengeMode' },
  'expert mode': { tombsOfAmascut: 'tombsOfAmascutExpertMode' },
};
const CLOG_PATH = resolve(HERE, '../src/data/clog.json');

const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const USER_AGENT = 'anvil-bingo drops dataset builder (contact: clan admin)';
const PAGE_SIZE = 5000; // the Bucket API caps a single query at 5000 rows.
const SOURCE_NOTE = 'https://oldschool.runescape.wiki/w/Special:Bucket/dropsline';

// The same two name→id sources the item picker itself is built from (see src/lib/osrsItems.ts).
// Resolving drop rows through them keeps the emitted ids identical to the ones the picker
// shows — an id the picker never surfaces would filter a legitimate item out of the list.
const WIKI_MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const RUNELITE_NAMES_URL = 'https://static.runelite.net/cache/item/names.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run one Bucket query. The query language is Lua-shaped: bucket("x").select(…).limit(n).run().
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

// Page through a bucket in PAGE_SIZE chunks until a short page comes back.
async function fetchAll(bucket, fields, label) {
  const selects = fields.map((f) => `"${f}"`).join(',');
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await bucketQuery(
      `bucket("${bucket}").select(${selects}).limit(${PAGE_SIZE}).offset(${offset}).run()`,
    );
    rows.push(...page);
    process.stdout.write(`  ${label}: ${rows.length} rows\r`);
    if (page.length < PAGE_SIZE) break;
    await sleep(150); // be a polite API citizen
  }
  process.stdout.write('\n');
  return rows;
}

// "1/1,024" → 1024 · "5/150" → 30 · "Always" → 1 · "24/128" → 5.33. Word rarities ("Common",
// "Varies") carry no number, so they get no rate — the item still counts as droppable, it just
// can't feed the effort model. Returns null when there's nothing numeric to work with.
function parseRarity(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (text === 'always' || text === 'once' || text === 'guaranteed') return 1;
  const frac = text.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*[/x]\s*(\d+(?:\.\d+)?)/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (!(num > 0) || !(den > 0)) return null;
    return Math.round((den / num) * 100) / 100;
  }
  // A bare "~1 in 512" style fallback.
  const inForm = text.replace(/,/g, '').match(/^~?\s*(\d+(?:\.\d+)?)\s*in\s*(\d+(?:\.\d+)?)/);
  if (inForm) {
    const num = parseFloat(inForm[1]);
    const den = parseFloat(inForm[2]);
    if (!(num > 0) || !(den > 0)) return null;
    return Math.round((den / num) * 100) / 100;
  }
  return null;
}

// Builds name → item id exactly the way the picker's item list does: the wiki GE mapping is
// canonical for tradeables (it carries dose/variant names like "Prayer potion(4)" that the
// wiki's own page-based item_id table folds into one base page), RuneLite's cache fills in
// untradeables, and a collection-log id beats a bank-placeholder duplicate of the same name.
async function fetchNameIndex() {
  const [mappingRes, namesRes] = await Promise.all([
    fetch(WIKI_MAPPING_URL, { headers: { 'User-Agent': USER_AGENT } }),
    fetch(RUNELITE_NAMES_URL, { headers: { 'User-Agent': USER_AGENT } }),
  ]);
  if (!mappingRes.ok) throw new Error(`GE mapping HTTP ${mappingRes.status}`);
  if (!namesRes.ok) throw new Error(`RuneLite names HTTP ${namesRes.status}`);
  const mapping = await mappingRes.json();
  const names = await namesRes.json();

  const clogIds = new Set();
  const clog = JSON.parse(readFileSync(CLOG_PATH, 'utf8'));
  for (const items of Object.values(clog.activities ?? {})) {
    for (const it of items) if (typeof it.id === 'number') clogIds.add(it.id);
  }

  const index = new Map(); // lowercased name → id
  for (const [idStr, name] of Object.entries(names)) {
    const id = parseInt(idStr, 10);
    if (!Number.isInteger(id) || typeof name !== 'string') continue;
    const key = name.trim().toLowerCase();
    if (!key || key === 'null') continue;
    const cur = index.get(key);
    if (cur == null) {
      index.set(key, id);
      continue;
    }
    const curClog = clogIds.has(cur);
    const idClog = clogIds.has(id);
    if (idClog !== curClog) {
      if (idClog) index.set(key, id);
    } else if (id < cur) {
      index.set(key, id);
    }
  }
  // GE mapping last so it overrides RuneLite for anything tradeable.
  for (const it of mapping) {
    if (typeof it.id === 'number' && typeof it.name === 'string') index.set(it.name.trim().toLowerCase(), it.id);
  }
  return { index, clogIds };
}

// Quantity, in the shape the dataset has always used: a fixed drop is { q: 5 }, a ranged one is
// { m: 330, n: 370 } (min/max). The wiki gives us numeric Quantity Low/High fields; the display
// string ("30 (noted)", "120–300", "Varies") is only a fallback for rows that lack them.
function parseQuantity(meta) {
  const low = Number(meta['Quantity Low']);
  const high = Number(meta['Quantity High']);
  if (Number.isFinite(low) && Number.isFinite(high) && low > 0) {
    return high > low ? { m: low, n: high } : { q: low };
  }
  const text = String(meta['Drop Quantity'] ?? '').replace(/,/g, '');
  const nums = text.match(/\d+/g);
  if (!nums?.length) return { q: 1 };
  const parsed = nums.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (!parsed.length) return { q: 1 };
  const min = Math.min(...parsed);
  const max = Math.max(...parsed);
  return max > min ? { m: min, n: max } : { q: min };
}

async function main() {
  console.log('Fetching wiki drop tables via the Bucket API…');
  const dropRows = await fetchAll('dropsline', ['page_name', 'item_name', 'drop_json'], 'dropsline');
  const idRows = await fetchAll('item_id', ['page_name', 'id'], 'item_id');
  const { index: nameIndex } = await fetchNameIndex();

  // Item page name → numeric id, from the wiki's own {{Item ID}} table. `id` is a repeated
  // field (one page can cover several variants); the lowest is the base item. This is the
  // fallback for pages the GE mapping and RuneLite cache don't name identically.
  const idByPage = new Map();
  for (const row of idRows) {
    const name = row.page_name;
    if (typeof name !== 'string' || !name) continue;
    const ids = (Array.isArray(row.id) ? row.id : [row.id])
      .map((v) => parseInt(v, 10))
      .filter((n) => Number.isInteger(n) && n >= 0);
    if (!ids.length) continue;
    const lowest = Math.min(...ids);
    const cur = idByPage.get(name);
    if (cur == null || lowest < cur) idByPage.set(name, lowest);
  }
  console.log(`  ${nameIndex.size} known item names, ${idByPage.size} wiki item pages with an id`);

  // Item page name → id. Page names occasionally carry a section anchor ("Zombie bone#Unpolished"),
  // so a failed lookup is retried against the base page.
  function resolveItemId(name) {
    const direct = nameIndex.get(name.toLowerCase()) ?? idByPage.get(name);
    if (direct != null) return direct;
    const base = name.split('#')[0].trim();
    if (base === name) return null;
    return nameIndex.get(base.toLowerCase()) ?? idByPage.get(base) ?? null;
  }

  const combatIds = new Set();
  const otherIds = new Set();
  const droppableNames = new Set(); // lowercased, for the runtime filter's name fallback
  const bySource = new Map(); // monster page → drop entries, one per wiki drop-table line
  const unresolved = new Map(); // item page name → times seen, for the report
  const dropTypeCounts = {};
  const raidRewards = {};
  let rateless = 0;

  for (const row of dropRows) {
    let meta;
    try {
      meta = JSON.parse(row.drop_json ?? '{}');
    } catch {
      continue;
    }
    const itemName = typeof row.item_name === 'string' ? row.item_name : meta['Dropped item'];
    if (typeof itemName !== 'string' || !itemName) continue;
    const itemId = resolveItemId(itemName);
    if (itemId == null) {
      unresolved.set(itemName, (unresolved.get(itemName) ?? 0) + 1);
      continue;
    }

    const dropType = typeof meta['Drop type'] === 'string' ? meta['Drop type'] : 'unknown';
    dropTypeCounts[dropType] = (dropTypeCounts[dropType] ?? 0) + 1;

    // Raid chests: keep the unique table's SHARES, before the combat-only filter drops them.
    const chestPage = typeof row.page_name === 'string' ? row.page_name.split('#')[0].trim() : '';
    const chest = RAID_CHESTS[chestPage];
    if (chest && dropType === 'reward') {
      const share = parseRarity(meta.Rarity);
      // A share of "always" is not a share of anything: those rows are the chest's guaranteed
      // supplies, not one of the many uniques it picks between.
      if (share != null && share > 1) {
        // "Monumental chest#Hard Mode" — the mode lives on the anchor of the row's own source.
        const from = typeof meta['Dropped from'] === 'string' ? meta['Dropped from'] : '';
        const anchor = (from.split('#')[1] ?? '').trim().toLowerCase();
        const key = RAID_MODES[anchor]?.[chest.key] ?? (anchor ? null : chest.key);
        if (key) {
          const list = raidRewards[key] ?? { label: chest.label + (anchor ? ` (${anchor})` : ''), chest: chestPage, items: [] };
          // `d` is the item's 1-in-N share of the unique table, NOT a per-raid rate.
          list.items.push({ i: itemId, d: share });
          raidRewards[key] = list;
        }
      }
    }
    if (dropType === 'combat') combatIds.add(itemId);
    else otherIds.add(itemId);
    droppableNames.add(itemName.split('#')[0].trim().toLowerCase());

    // npcDrops.json is the *kill* table — the effort model prices tiles as "kill this many of
    // X", so chest rewards, pickpockets and skilling loot have no place in it.
    if (dropType !== 'combat') continue;
    const page = typeof row.page_name === 'string' && row.page_name ? row.page_name : meta['Dropped from'];
    if (typeof page !== 'string' || !page) continue;
    // A row can name a VARIANT of the fight it is filed under — "Yama#Contract", "Abyssal
    // demon#Catacombs of Kourend" — while page_name stays the bare page. Nearly all of those are
    // the same monster somewhere else, and merging them into the base is right: the client reports
    // "Abyssal demon" and expects that table.
    //
    // The exception is a variant that HANDS SOMETHING OVER. The Yama Contract gives the Oathplate
    // set outright while an ordinary kill rolls it at 1/600, so merging listed the same item twice
    // under "Yama", at 1-in-1 and 1-in-600 — which reads as guaranteed to anything taking the best
    // rate, and as a 100% chance to anything summing them (the plugin's rarity service sums). So a
    // variant's always-drops are kept OUT of the base and filed under the anchored key instead.
    // Everything else merges as it always did, because a base key that vanished would silently
    // break every by-name lookup in the app — rarity, luck, and the effort model all ask for a
    // plain boss name.
    const from = typeof meta['Dropped from'] === 'string' ? meta['Dropped from'] : '';
    const anchor = from.split('#')[1]?.trim();
    const isVariant = !!anchor && from.split('#')[0].trim() === page;
    const d = parseRarity(meta.Rarity);
    if (d == null) {
      rateless++;
      continue;
    }
    // A variant's guaranteed line goes to the anchored key alone; everything else to the base.
    const source = isVariant && d === 1 ? `${page}#${anchor}` : page;
    // One entry per drop line, not per item: a monster often lists the same item twice (a common
    // small stack and a rare big one), and the rates differ. `r` (rolls) is only written when the
    // table is rolled more than once per kill, matching the dataset's existing shape.
    const rolls = Number(meta.Rolls);
    const entry = { i: itemId, d, ...parseQuantity(meta) };
    if (Number.isFinite(rolls) && rolls > 1) entry.r = rolls;
    let items = bySource.get(source);
    if (!items) bySource.set(source, (items = []));
    if (!items.some((e) => e.i === entry.i && e.d === entry.d && e.q === entry.q && e.m === entry.m)) {
      items.push(entry);
    }
  }

  // Stable output: sources alphabetical, drops by item id then rate.
  const npcDrops = {};
  for (const source of [...bySource.keys()].sort((a, b) => a.localeCompare(b))) {
    npcDrops[source] = bySource.get(source).sort((a, b) => a.i - b.i || a.d - b.d);
  }

  const combat = [...combatIds].sort((a, b) => a - b);
  // Don't repeat an id in both lists — combat wins.
  const other = [...otherIds].filter((id) => !combatIds.has(id)).sort((a, b) => a - b);

  const droppable = {
    source: SOURCE_NOTE,
    generatedAt: new Date().toISOString(),
    combatCount: combat.length,
    otherCount: other.length,
    combat,
    other,
    // Name fallback: a handful of items are known to the picker under an id the wiki doesn't
    // list (bank placeholders, renamed variants). Matching on name too means those still pass
    // the filter instead of silently vanishing from the dropdown.
    names: [...droppableNames].sort(),
  };

  writeFileSync(NPC_DROPS_PATH, JSON.stringify(npcDrops) + '\n');
  writeFileSync(DROPPABLE_PATH, JSON.stringify(droppable) + '\n');
  // Deduplicate: the wiki lists an item once per mode table, and a mode we did not map would
  // otherwise stack duplicates onto the base raid.
  for (const entry of Object.values(raidRewards)) {
    const seen = new Map();
    for (const item of entry.items) if (!seen.has(item.i)) seen.set(item.i, item);
    entry.items = [...seen.values()].sort((a, b) => a.d - b.d);
  }
  writeFileSync(RAID_REWARDS_PATH, JSON.stringify(raidRewards, null, 2) + '\n');
  console.log(`raid rewards: ${Object.entries(raidRewards).map(([k, v]) => `${k} ${v.items.length}`).join(', ')}`);

  const entryCount = Object.values(npcDrops).reduce((n, list) => n + list.length, 0);
  const topUnresolved = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\nRead ${dropRows.length} drop-table rows. Types:`, dropTypeCounts);
  console.log(`Wrote ${NPC_DROPS_PATH}: ${Object.keys(npcDrops).length} sources, ${entryCount} drops.`);
  console.log(`Wrote ${DROPPABLE_PATH}: ${combat.length} combat ids + ${other.length} other-loot ids.`);
  console.log(`Skipped ${rateless} combat rows with a non-numeric rarity (Common/Varies/…).`);
  if (topUnresolved.length) {
    console.log(`${unresolved.size} item names had no id on the wiki; most frequent:`);
    for (const [name, n] of topUnresolved) console.log(`  ${name} ×${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
