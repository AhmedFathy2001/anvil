// Regenerates src/data/clog.json — the per-activity collection-log item dataset that powers the
// admin "generate tiles from a collection log page" bulk-authoring flow.
//
// Source: the OSRS Wiki's own machine-readable module, Module:Collection log/data.json — a flat
// list of every clog item as { id, name, tabs }, where `tabs` names the activities the item
// appears under (e.g. "Vorkath", "Barbarian Assault", "Hunter Guild", "Moons of Peril", "All
// Pets"). Because the wiki maintains this module, re-running this script picks up new bosses,
// minigames, and items automatically as they're added to the game.
//
// It also classifies each item as drop-trackable or "manual-only" by reading its wiki page (see
// computeManualOnlyIds) — this is data-driven, not a hand-maintained list, so it stays correct as
// the game changes. Emits manualOnlyIds into clog.json + the small clogManualIds.json.
//
// Run:  node scripts/build-clog-dataset.mjs        (or: npm run data:clog)
//       node scripts/build-clog-dataset.mjs --tabs-only   (just the page → in-game tab map)
//       node scripts/build-clog-dataset.mjs --labels-only (just the same-name slot labels)
// Wire it into CI / a cron to keep the bundle fresh without manual edits.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://oldschool.runescape.wiki/w/Module:Collection_log/data.json?action=raw';
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/clog.json',
);
// Small companion file (just the manual-only item IDs) that CLIENT components can import cheaply
// without pulling the whole 140 KB clog.json into the browser bundle.
const MANUAL_IDS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/clogManualIds.json',
);

const USER_AGENT = 'anvil-bingo clog dataset builder (contact: clan admin)';

// Whether an item is auto-drop-trackable is decided PER ITEM from the wiki, not guessed by activity.
// An item's wiki page carries a {{Drop sources}} table iff it's obtained from something the plugin
// sees as loot — an NPC kill, a raid/clue/barrows chest, or a reward pool (Wintertodt / Tempoross /
// GOTR / BA high gamble). Shop purchases, skilling-pet rolls, and reward-interface handouts have no
// such table. So: no {{Drop sources}} → the plugin can't drop-track it → "manual-only".
const DROP_SOURCES_RE = /\{\{\s*drop sources/i;
// Guaranteed completion awards the plugin credits off the Jagex kill-count chat line (see
// GUARANTEED_AWARDS in the Anvil plugin). Their wiki pages have no {{Drop sources}} table — the
// item is handed straight to the inventory — but they ARE auto-tracked, so never flag them manual.
const KC_AWARD_TRACKED_NAMES = new Set(['Infernal cape', 'Fire cape']);
// Some clog items share a name with the monster that drops them (e.g. "Crawling hand"), so the item
// name redirects to the MONSTER page — which has drop tables but no {{Drop sources}} table of its
// own. Landing on a monster page means we're not on the item page and can't judge it, so we skip
// flagging (default tracked) rather than mislabel a genuine drop as manual.
const MONSTER_PAGE_RE = /\{\{\s*infobox monster/i;
// Release-day pages ({{New Content}}) often go out before anyone adds the Drop sources table — the
// Fractured Archive's uniques all did — so a new page that says it's a "reward from [[…]]" is a
// chest drop, not a handout. Once the wiki fills the table in, the ordinary rule above decides.
const NEW_CONTENT_RE = /\{\{\s*new content/i;
const REWARD_FROM_RE = /reward from \[\[/i;
const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const TITLE_BATCH = 50; // MediaWiki caps non-bot title queries at 50 per request.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch the wikitext of up to 50 titles in one API call, resolving normalisation + redirects, and
// return a Map from the REQUESTED title to its page content (missing pages are simply absent).
async function fetchWikitextBatch(titles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    redirects: '1',
    titles: titles.join('|'),
  });
  const res = await fetch(WIKI_API, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`wiki query HTTP ${res.status}`);
  const q = (await res.json()).query ?? {};
  const hop = new Map(); // from -> to, across normalisation and redirects
  for (const n of q.normalized ?? []) hop.set(n.from, n.to);
  for (const r of q.redirects ?? []) hop.set(r.from, r.to);
  const byTitle = new Map();
  for (const p of q.pages ?? []) {
    if (p.missing) continue;
    const content = p.revisions?.[0]?.slots?.main?.content;
    if (typeof content === 'string') byTitle.set(p.title, content);
  }
  const out = new Map();
  for (const req of titles) {
    let t = req;
    for (let i = 0; i < 4 && hop.has(t); i++) t = hop.get(t); // follow the redirect chain
    const content = byTitle.get(t) ?? byTitle.get(req);
    if (content != null) out.set(req, content);
  }
  return out;
}

// Classify every distinct clog item name as drop-tracked or manual-only via its wiki page. Returns
// a Set of manual-only item IDs. Failures / missing pages default to TRACKED (never flag a real
// drop as manual). One page per name is checked, shared across all ids/tabs carrying that name.
async function computeManualOnlyIds(items) {
  const idsByName = new Map();
  for (const it of items) {
    if (typeof it.id !== 'number' || typeof it.name !== 'string' || !it.name) continue;
    (idsByName.get(it.name) ?? idsByName.set(it.name, []).get(it.name)).push(it.id);
  }
  const names = [...idsByName.keys()];
  const manual = [];
  let done = 0;
  for (let i = 0; i < names.length; i += TITLE_BATCH) {
    const batch = names.slice(i, i + TITLE_BATCH);
    let content;
    try {
      content = await fetchWikitextBatch(batch);
    } catch (e) {
      console.warn(`\n  batch ${i}-${i + batch.length} failed (${e.message}) — treating as tracked`);
      content = new Map();
    }
    for (const name of batch) {
      if (KC_AWARD_TRACKED_NAMES.has(name)) continue;
      const c = content.get(name);
      // Unknown page or a monster page (name collision) → assume tracked. Known item page without a
      // Drop sources table → manual-only.
      if (c != null && !DROP_SOURCES_RE.test(c) && !MONSTER_PAGE_RE.test(c)
          && !(NEW_CONTENT_RE.test(c) && REWARD_FROM_RE.test(c))) {
        manual.push(...idsByName.get(name));
      }
    }
    done += batch.length;
    process.stdout.write(`  classifying ${done}/${names.length}\r`);
    await sleep(120);
  }
  process.stdout.write('\n');
  manual.sort((a, b) => a - b);
  return manual;
}

// SAME-NAME SLOTS. Some log slots share one in-game name: Castlewars has fifteen "Decorative armour"
// slots (red/white/gold platebody, platelegs, plateskirt, the magic and ranged pieces), the Chompy
// hats, the Ancient pages. Shown by name alone they read as one entry, so each gets the wiki's own
// item page name as its `label` ("Decorative armour (gold platebody)"), read from the wiki's Bucket
// `infobox_item` table. A page that versions several ids under one title ("Ancient page", versions
// 1–26) gives "Ancient page (1)". `name` stays the in-game name: unlock lines and drop matching use it.
const BUCKET_BATCH = 40;

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

const normName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Pure: the label for each id in one same-name group, from its infobox_item row (or none). */
export function labelGroup(name, ids, rowOf) {
  const out = new Map();
  // A version anchor only tells ids apart when they share one page ("Ancient page#1"…"#26"). On a
  // page of its own the anchor is just the infobox's inventory/equipped toggle, so the name stays.
  const pageOf = (id) => (typeof rowOf.get(id)?.page_name === 'string' ? normName(rowOf.get(id).page_name) : '');
  const sharedPage = (id) => ids.some((other) => other !== id && pageOf(other) === pageOf(id));
  for (const id of ids) {
    const row = rowOf.get(id);
    const page = typeof row?.page_name === 'string' ? row.page_name.trim() : '';
    const anchor = typeof row?.version_anchor === 'string' ? row.version_anchor.trim() : '';
    let label = null;
    if (page && normName(page) !== normName(name) && normName(page).startsWith(normName(name))) label = page;
    else if (page && normName(page) !== normName(name)) label = `${name} (${page})`;
    else if (anchor && sharedPage(id)) label = `${name} (${anchor.charAt(0).toLowerCase()}${anchor.slice(1)})`;
    out.set(id, label);
  }
  // Two ids that still read the same (or several with no wiki row) fall back to the id itself, so
  // every slot in the group is told apart; one plain name among labelled siblings stays plain.
  const seen = new Map();
  for (const id of ids) {
    const key = normName(out.get(id) ?? name);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const id of ids) {
    const label = out.get(id) ?? name;
    if (seen.get(normName(label)) > 1) out.set(id, `${label} (#${id})`);
  }
  return out;
}

/** id → label for every clog id whose name another clog id also carries. */
async function computeLabels(activities) {
  const nameOf = new Map();
  for (const list of Object.values(activities)) for (const { id, name } of list) if (!nameOf.has(id)) nameOf.set(id, name);
  const idsByName = new Map();
  for (const [id, name] of nameOf) {
    const key = normName(name);
    (idsByName.get(key) ?? idsByName.set(key, []).get(key)).push(id);
  }
  const groups = [...idsByName.values()].filter((ids) => ids.length > 1).map((ids) => ids.sort((a, b) => a - b));
  const wanted = groups.flat();
  const rowOf = new Map();
  for (let i = 0; i < wanted.length; i += BUCKET_BATCH) {
    const batch = wanted.slice(i, i + BUCKET_BATCH);
    const where = batch.map((id) => `{"item_id","${id}"}`).join(',');
    const rows = await bucketQuery(
      `bucket("infobox_item").select("item_id","page_name","version_anchor").where(bucket.Or(${where})).limit(500).run()`,
    );
    for (const row of rows) {
      for (const raw of [].concat(row.item_id ?? [])) {
        const id = Number(raw);
        if (batch.includes(id) && !rowOf.has(id)) rowOf.set(id, row);
      }
    }
    await sleep(150);
  }
  const labels = new Map();
  for (const ids of groups) {
    for (const [id, label] of labelGroup(nameOf.get(ids[0]), ids, rowOf)) if (label) labels.set(id, label);
  }
  console.log(`Labelled ${labels.size} same-name slots across ${groups.length} names (${rowOf.size} wiki rows).`);
  return labels;
}

function applyLabels(activities, labels) {
  for (const list of Object.values(activities)) {
    for (const item of list) {
      const label = labels.get(item.id);
      if (label) item.label = label;
      else delete item.label;
    }
  }
}

// THE GAME'S OWN TABS. The data module above names each item's page but not which tab of the
// collection log the page sits in, so the profile used to guess from page names — and guessed
// wrong wherever a name looks like something else: Barrows Chests, The Fight Caves, Fortis
// Colosseum, Tempoross and Wintertodt are all on the game's Bosses tab. The wiki's Collection log
// article lists every page under its tab (`==Bosses==` then `===Barrows Chests===`), so that is
// read instead. Written to src/data/clogTabs.json; lib/clogRarity groupOf reads it.
const TABS_URL = 'https://oldschool.runescape.wiki/w/Collection_log?action=raw';
const TABS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/clogTabs.json');
const GAME_TABS = new Set(['Bosses', 'Raids', 'Clues', 'Minigames', 'Other']);

async function buildTabs(activityNames) {
  console.log(`Fetching ${TABS_URL} …`);
  const res = await fetch(TABS_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Wiki fetch failed: HTTP ${res.status} ${res.statusText}`);
  const byLower = new Map();
  let tab = null;
  for (const line of (await res.text()).split('\n')) {
    const h2 = /^==([^=].*?)==\s*$/.exec(line);
    const h3 = /^===([^=].*?)===\s*$/.exec(line);
    if (h2) tab = GAME_TABS.has(h2[1].trim()) ? h2[1].trim() : null;
    else if (h3 && tab) byLower.set(h3[1].trim().toLowerCase(), tab);
  }
  const tabs = {};
  const unplaced = [];
  for (const name of activityNames) {
    // "Elite Treasure Trails (Rare)" is the data module's split of one in-game page.
    const found = byLower.get(name.toLowerCase()) ?? byLower.get(name.replace(/\s*\(rare\)$/i, '').toLowerCase());
    if (found) tabs[name] = found;
    else unplaced.push(name);
  }
  writeFileSync(TABS_PATH, JSON.stringify(tabs, null, 2) + '\n');
  console.log(`Wrote ${TABS_PATH}: ${Object.keys(tabs).length} pages placed.`, unplaced.length ? { unplaced } : '');
}

async function main() {
  // `--tabs-only`: refresh the page → tab map against the activities already in clog.json.
  if (process.argv.includes('--tabs-only')) {
    await buildTabs(Object.keys(JSON.parse(readFileSync(OUT_PATH, 'utf8')).activities));
    return;
  }
  // `--labels-only`: refresh the same-name slot labels in the clog.json already on disk.
  if (process.argv.includes('--labels-only')) {
    const shipped = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
    applyLabels(shipped.activities, await computeLabels(shipped.activities));
    writeFileSync(OUT_PATH, JSON.stringify(shipped, null, 2) + '\n');
    return;
  }
  console.log(`Fetching ${SOURCE_URL} …`);
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'anvil-bingo clog dataset builder (contact: clan admin)' },
  });
  if (!res.ok) {
    throw new Error(`Wiki fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Unexpected payload: expected a non-empty array of clog items.');
  }

  // The wiki module re-cased ~170 names in Oct 2026 ("Jar of Dirt", "Pet Kraken") away from the
  // in-game spelling. Keep the name we already ship when the new one differs only by case.
  const shippedNames = new Map();
  try {
    for (const list of Object.values(JSON.parse(readFileSync(OUT_PATH, 'utf8')).activities ?? {})) {
      for (const { id, name } of list) shippedNames.set(id, name);
    }
  } catch {
    // First build — nothing shipped yet.
  }
  const displayName = (id, name) => {
    const prev = shippedNames.get(id);
    return prev && prev.toLowerCase() === name.toLowerCase() ? prev : name;
  };

  // Group items by activity tab. One item can appear under several activities (e.g. shared
  // treasure-trail rewards, "All Pets") — it's listed under each so any of those boards can use it.
  const byActivity = {};
  for (const it of items) {
    if (typeof it.id !== 'number' || typeof it.name !== 'string' || !Array.isArray(it.tabs)) {
      continue;
    }
    for (const tab of it.tabs) {
      if (typeof tab !== 'string' || !tab) continue;
      (byActivity[tab] ??= []).push({ id: it.id, name: displayName(it.id, it.name) });
    }
  }

  // Stable ordering: activities alphabetical, items by id within each (mirrors clog draw order
  // closely enough and keeps the diff minimal between regenerations).
  const activities = {};
  for (const name of Object.keys(byActivity).sort((a, b) => a.localeCompare(b))) {
    activities[name] = byActivity[name].sort((a, b) => a.id - b.id);
  }

  applyLabels(activities, await computeLabels(activities));

  // Per-item drop-trackability, decided from each item's wiki page ({{Drop sources}} present or not).
  console.log('Classifying drop-trackability against the wiki…');
  const manualOnlyIds = await computeManualOnlyIds(items);
  const manualSet = new Set(manualOnlyIds);

  const totalItems = items.length;
  const activityCount = Object.keys(activities).length;
  const payload = {
    source: 'https://oldschool.runescape.wiki/w/Module:Collection_log/data.json',
    generatedAt: new Date().toISOString(),
    activityCount,
    itemCount: totalItems,
    manualOnlyIds,
    activities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  writeFileSync(MANUAL_IDS_PATH, JSON.stringify(manualOnlyIds) + '\n');
  await buildTabs(Object.keys(activities));

  // Small activity-name → representative-item map (first clog item, lowest id) for tile
  // icons — bundleable client-side without dragging the whole clog dataset along. Keys are
  // lowercased with a leading "The " stripped so boss labels and NPC names both match.
  const bossIcons = {};
  for (const [name, list] of Object.entries(activities)) {
    if (!list.length) continue;
    let key = name.toLowerCase().trim();
    if (key.startsWith('the ')) key = key.slice(4);
    bossIcons[key] = list[0].id;
  }
  writeFileSync(new URL('../src/data/bossIcons.json', import.meta.url), JSON.stringify(bossIcons, null, 0) + '\n');

  // Per-activity count of manual-only items, for a quick sanity read on the curation.
  const perActivity = {};
  for (const [name, list] of Object.entries(activities)) {
    const n = list.filter((i) => manualSet.has(i.id)).length;
    if (n > 0) perActivity[name] = `${n}/${list.length}`;
  }
  console.log(
    `Wrote ${OUT_PATH}: ${activityCount} activities, ${totalItems} clog items, ${manualOnlyIds.length} manual-only.`,
  );
  console.log('Manual-only by activity:', perActivity);
}

// Importable (tests read labelGroup) without running the build.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
