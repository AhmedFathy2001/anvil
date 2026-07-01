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
// Wire it into CI / a cron to keep the bundle fresh without manual edits.

import { writeFileSync, mkdirSync } from 'node:fs';
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
// Some clog items share a name with the monster that drops them (e.g. "Crawling hand"), so the item
// name redirects to the MONSTER page — which has drop tables but no {{Drop sources}} table of its
// own. Landing on a monster page means we're not on the item page and can't judge it, so we skip
// flagging (default tracked) rather than mislabel a genuine drop as manual.
const MONSTER_PAGE_RE = /\{\{\s*infobox monster/i;
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
      const c = content.get(name);
      // Unknown page or a monster page (name collision) → assume tracked. Known item page without a
      // Drop sources table → manual-only.
      if (c != null && !DROP_SOURCES_RE.test(c) && !MONSTER_PAGE_RE.test(c)) {
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

async function main() {
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

  // Group items by activity tab. One item can appear under several activities (e.g. shared
  // treasure-trail rewards, "All Pets") — it's listed under each so any of those boards can use it.
  const byActivity = {};
  for (const it of items) {
    if (typeof it.id !== 'number' || typeof it.name !== 'string' || !Array.isArray(it.tabs)) {
      continue;
    }
    for (const tab of it.tabs) {
      if (typeof tab !== 'string' || !tab) continue;
      (byActivity[tab] ??= []).push({ id: it.id, name: it.name });
    }
  }

  // Stable ordering: activities alphabetical, items by id within each (mirrors clog draw order
  // closely enough and keeps the diff minimal between regenerations).
  const activities = {};
  for (const name of Object.keys(byActivity).sort((a, b) => a.localeCompare(b))) {
    activities[name] = byActivity[name].sort((a, b) => a.id - b.id);
  }

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
