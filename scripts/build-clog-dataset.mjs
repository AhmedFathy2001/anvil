// Regenerates src/data/clog.json — the per-activity collection-log item dataset that powers the
// admin "generate tiles from a collection log page" bulk-authoring flow.
//
// Source: the OSRS Wiki's own machine-readable module, Module:Collection log/data.json — a flat
// list of every clog item as { id, name, tabs }, where `tabs` names the activities the item
// appears under (e.g. "Vorkath", "Barbarian Assault", "Hunter Guild", "Moons of Peril", "All
// Pets"). Because the wiki maintains this module, re-running this script picks up new bosses,
// minigames, and items automatically as they're added to the game.
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

  const totalItems = items.length;
  const activityCount = Object.keys(activities).length;
  const payload = {
    source: 'https://oldschool.runescape.wiki/w/Module:Collection_log/data.json',
    generatedAt: new Date().toISOString(),
    activityCount,
    itemCount: totalItems,
    activities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(
    `Wrote ${OUT_PATH}: ${activityCount} activities, ${totalItems} clog items.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
