// Regenerates src/data/activityRates.json — the kill-rate half of the board-balance effort model,
// sourced from two community datasets instead of from memory.
//
// Why this exists: src/data/balanceRates.json was hand-written in one sitting and never checked
// against anything ("Rough by design" — its own header). That matters more than it sounds, because
// a drop tile costs `1/dropRate × killTime`: the wiki-sourced drop rates get multiplied by an
// invented kill time, so one bad rate misprices every tile that shares that source. Bryophyta was
// out by ~9x (the fight is quick; getting the key is not).
//
// Sources, and what each one actually measures:
//
//   Wise Old Man's EHB table  — kills/hour at efficient play, 68 bosses. MIT licensed
//     (Copyright (c) Wise Old Man contributors, https://github.com/wise-old-man/wise-old-man).
//     This is the FAST band: best gear, best method, no banking waste.
//
//   The OSRS Wiki's money-making guides — kills/hour for a documented profitable method, ~149
//     combat entries including ordinary NPCs (which EHB doesn't rate at all). This is the SLOW
//     band: someone banking loot with a realistic setup.
//
// The two agree on a spread rather than a number: across the bosses both cover, WOM is faster in
// 27 of 28 cases, median 2.0x — which is close to the 2.33x fast:slow spread the curated file used.
// So they bracket the triplet naturally, and the AVERAGE band is their geometric mean.
//
// What this does NOT source: accessibility floors (community data has no notion of "can an average
// clan member do this"), Gauntlet-style success rates, raid party-size scaling, and the superior
// slayer encounter cost. Those stay curated in balanceRates.json — a dozen numbers you can reason
// about, rather than 83 you can't.
//
// Run:  node scripts/build-rates-dataset.mjs        (or: npm run data:rates)
// The output is committed; nothing fetches at runtime. Re-run when the game changes.

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, '../src/data/activityRates.json');
const CURATED_PATH = resolve(HERE, '../src/data/balanceRates.json');

const USER_AGENT = 'anvil-bingo rates dataset builder (contact: clan admin)';

const WOM_EHB_URL =
  'https://raw.githubusercontent.com/wise-old-man/wise-old-man/master/server/src/api/modules/efficiency/configs/ehb/main.ehb.ts';
const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const WIKI_QUERY = 'bucket("money_making_guide").select("value","json").limit(2000).run()';

// Median WOM/wiki ratio measured across the bosses both cover — used to synthesise the missing end
// when only one source has an opinion.
const SPREAD = 2.0;
// A wider gap than this isn't a capability spread, it's two different activities wearing one name
// (Corporeal Beast solo vs mass reads 6x; Callisto with a specific setup reads 5.7x). Clamp toward
// the FAST anchor, which is the better-defined number, and record that we did.
const MAX_SPREAD = 3.0;

/**
 * Key normalisation, deliberately more aggressive than the app's `normName` so that punctuation
 * differences between three independent naming schemes collapse on their own: apostrophes
 * (`k'ril` / `kril`), hyphens (`tzkal-zuk` / `tzkal zuk`), colons and a leading "the".
 */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/\[\[([^\]|]*\|)?/g, '')
    .replace(/\]\]/g, '')
    .replace(/^killing (the )?/, '')
    .replace(/^the\s+/, '')
    .replace(/[':\-–]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// What normalisation can't fix: genuinely different names for the same content. Left → the source's
// name, right → the key the app already uses (also normalised on both sides).
const ALIASES = new Map(
  Object.entries({
    'barrows chests': 'barrows',
    'chambers of xeric cm': 'chambers of xeric challenge mode',
    'theatre of blood hard mode': 'theatre of blood hard mode',
    'tombs of amascut expert': 'tombs of amascut expert mode',
    'lunar chests': 'lunar chest',
    'tzkal zuk': 'inferno',
    'tztok jad': 'fight caves',
    'the gauntlet': 'gauntlet',
    'crystalline hunllef': 'gauntlet',
    'corrupted hunllef': 'corrupted gauntlet',
  }).map(([k, v]) => [norm(k), norm(v)]),
);

const alias = (k) => ALIASES.get(k) ?? k;

async function fetchWomRates() {
  const res = await fetch(WOM_EHB_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`WOM EHB fetch failed: HTTP ${res.status} ${res.statusText}`);
  const src = await res.text();
  const rates = new Map();
  for (const [, name, rate] of src.matchAll(/boss: Boss\.(\w+), rate: ([\d.]+)/g)) {
    const kph = Number(rate);
    if (!Number.isFinite(kph) || kph <= 0) continue;
    rates.set(alias(norm(name.replace(/_/g, ' '))), kph);
  }
  if (rates.size < 40) throw new Error(`WOM EHB parse returned only ${rates.size} bosses — format changed?`);
  return rates;
}

async function fetchWikiRates() {
  const url = `${WIKI_API}?action=bucket&format=json&query=${encodeURIComponent(WIKI_QUERY)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Wiki fetch failed: HTTP ${res.status} ${res.statusText}`);
  const payload = await res.json();
  const rows = payload?.bucket;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Unexpected payload: expected a non-empty "bucket" array of money-making guides.');
  }

  const rates = new Map();
  for (const row of rows) {
    let guide;
    try {
      guide = JSON.parse(row.json);
    } catch {
      continue; // a malformed guide shouldn't sink the dataset
    }
    const prices = guide?.prices ?? {};
    // Only rows whose rate is literally kills per hour. The same field carries "Trips per hour"
    // and "Leather made per hour" elsewhere, and those are not kill times.
    if (prices.kph_text !== 'Kills per hour') continue;
    const kph = Number(prices.default_kph);
    if (!Number.isFinite(kph) || kph <= 0) continue;

    const key = alias(norm(String(guide.activity ?? '')));
    if (!key) continue;
    // Several guides cover one monster at different levels of investment. Keep the best documented
    // rate: the slow band should be "a realistic method", not "the worst method anyone wrote up".
    rates.set(key, Math.max(rates.get(key) ?? 0, kph));
  }
  if (rates.size < 50) throw new Error(`Wiki parse returned only ${rates.size} kill rates — format changed?`);
  return rates;
}

/** kills/hour → seconds/kill, at a sane precision for a JSON file humans will read. */
const toSeconds = (kph) => Math.round((3600 / kph) * 10) / 10;

function buildTriplet(wom, wiki) {
  let fast = wom ?? (wiki != null ? wiki * SPREAD : null);
  let slow = wiki ?? (wom != null ? wom / SPREAD : null);
  if (fast == null || slow == null) return null;

  let clamped = false;
  if (fast / slow > MAX_SPREAD) {
    slow = fast / MAX_SPREAD;
    clamped = true;
  }
  // Geometric mean, not arithmetic: these are rates, and it lands at 0.71x of fast when the spread
  // is 2x — almost exactly the 1.5x fast:avg relationship the curated file used.
  const avg = Math.sqrt(fast * slow);
  return {
    killSeconds: [toSeconds(fast), toSeconds(avg), toSeconds(slow)],
    source: wom != null && wiki != null ? 'wom+wiki' : wom != null ? 'wom' : 'wiki',
    womKph: wom ?? null,
    wikiKph: wiki ?? null,
    ...(clamped ? { clamped: true } : {}),
  };
}

async function main() {
  console.log('Fetching Wise Old Man EHB rates…');
  const wom = await fetchWomRates();
  console.log(`  ${wom.size} boss rates`);

  console.log('Querying the wiki money-making guides for kill rates…');
  const wiki = await fetchWikiRates();
  console.log(`  ${wiki.size} kills-per-hour entries`);

  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
  // Only rate activities the app already knows about. A rate for content no tile can reference is
  // dead weight, and a floor we'd have to invent for it is exactly the guessing this replaces.
  // Alias BOTH sides: our own file carries "inferno" and "tzkal-zuk" (and "fight caves" /
  // "tztok-jad") as separate keys because tiles are authored either way, so both must resolve to
  // the one rate the sources publish.
  const curatedByNorm = new Map(Object.keys(curated.activities).map((k) => [alias(norm(k)), k]));

  const activities = {};
  const report = [];
  for (const curatedKey of Object.keys(curated.activities)) {
    // Only the flat kill-time shape. Gauntlet-likes and raids are modelled as attempt length over a
    // per-band success rate (and divided by party size), which carries information a single
    // kills/hour figure cannot — replacing it with one would be a downgrade dressed as a sourcing.
    if (!Array.isArray(curated.activities[curatedKey]?.killSeconds)) continue;
    const normKey = alias(norm(curatedKey));
    const built = buildTriplet(wom.get(normKey), wiki.get(normKey));
    if (!built) continue;
    const before = curated.activities[curatedKey]?.killSeconds ?? null;
    const ratio = before ? before[0] / built.killSeconds[0] : 1;
    activities[curatedKey] = {
      ...built,
      // Keep the number this replaced wherever it moved a lot. Some of these corrections are the
      // point (Bryophyta ignored key acquisition); others mean the sources are timing a MASS of the
      // boss where we timed a solo. Both deserve a human glance, and neither can be told apart
      // mechanically — so the old value travels with the new one instead of being overwritten
      // silently.
      ...(before && (ratio > 2 || ratio < 0.5) ? { curatedFastSeconds: before[0], review: true } : {}),
    };
    if (before) {
      report.push({ key: curatedKey, beforeFast: before[0], afterFast: built.killSeconds[0], ratio, source: built.source });
    }
  }

  const uncovered = Object.keys(curated.activities).filter((k) => !(k in activities));

  const out = {
    source:
      'Wise Old Man EHB rates (MIT, https://github.com/wise-old-man/wise-old-man) for the fast band; ' +
      'OSRS Wiki money-making guides (Bucket: money_making_guide) for the slow band.',
    generatedAt: new Date().toISOString(),
    note:
      'Kill-rate triplets [fast, average, slow] in seconds per kill. Layered UNDER the admin ' +
      '`balance_rates` override and OVER the curated defaults in balanceRates.json, which still ' +
      'owns accessibility floors, success rates, party sizes and the superior-slayer cost.',
    spread: { assumed: SPREAD, maxSpread: MAX_SPREAD },
    activityCount: Object.keys(activities).length,
    activities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);

  const bySource = report.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] ?? 0) + 1 }), {});
  console.log(`\nWrote ${Object.keys(activities).length} activities → ${OUT_PATH}`);
  console.log(`  by source: ${JSON.stringify(bySource)}`);
  console.log(`  still curated (no community rate): ${uncovered.length}`);
  if (uncovered.length) console.log(`    ${uncovered.sort().join(', ')}`);

  const drift = report.filter((r) => r.ratio > 2 || r.ratio < 0.5).sort((a, b) => b.ratio - a.ratio);
  console.log(`\n${drift.length} rows where the hand-written rate was off by >2x:`);
  for (const d of drift) {
    const dir = d.ratio > 1 ? 'we were SLOWER' : 'we were FASTER';
    console.log(
      `  ${d.key.padEnd(28)} ${String(d.beforeFast).padStart(6)}s → ${String(d.afterFast).padStart(6)}s  ` +
        `(x${d.ratio.toFixed(2)}, ${dir}, ${d.source})`,
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
