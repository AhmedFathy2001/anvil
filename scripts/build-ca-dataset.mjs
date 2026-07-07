// Regenerates src/data/combatAchievements.json — the Combat Achievement task dataset that powers
// the admin CA-tile task picker.
//
// Source: the OSRS Wiki's Bucket store (the machine-readable backing of Combat_Achievements/All
// tasks). One query returns every task as { id, name, monster, task, tier, type }, so re-running
// this script picks up new tasks automatically as Jagex adds them.
//
// Run:  node scripts/build-ca-dataset.mjs        (or: npm run data:ca)
// Wire it into CI / a cron to keep the bundle fresh without manual edits.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUCKET_QUERY =
  'bucket("combat_achievement").select("id","name","monster","task","tier","type").limit(5000).run()';
const SOURCE_URL = `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${encodeURIComponent(BUCKET_QUERY)}`;
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/combatAchievements.json',
);

const USER_AGENT = 'anvil-bingo ca dataset builder (contact: clan admin)';

// Ordered lowest → highest; also acts as an allowlist so a malformed row can't smuggle a bogus
// tier into the bundle (the tile selectors and plugin matching key off these exact names).
const TIERS = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

async function main() {
  console.log('Querying the wiki Bucket store for Combat Achievement tasks…');
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Wiki fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const payload = await res.json();
  const rows = payload?.bucket;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Unexpected payload: expected a non-empty "bucket" array of CA tasks.');
  }

  const tierRank = new Map(TIERS.map((t, i) => [t.toLowerCase(), i]));
  const tasks = [];
  const seenNames = new Set();
  for (const r of rows) {
    if (typeof r?.name !== 'string' || !r.name || typeof r?.tier !== 'string') continue;
    const tierIdx = tierRank.get(r.tier.toLowerCase());
    if (tierIdx === undefined) {
      console.warn(`  skipping "${r.name}": unknown tier "${r.tier}"`);
      continue;
    }
    // Task names are unique in-game (they're what the completion chat line carries); a duplicate
    // here would make selector matching ambiguous, so keep the first and warn.
    const nameKey = r.name.toLowerCase();
    if (seenNames.has(nameKey)) {
      console.warn(`  skipping duplicate task name "${r.name}"`);
      continue;
    }
    seenNames.add(nameKey);
    tasks.push({
      id: typeof r.id === 'number' ? r.id : null,
      name: r.name.trim(),
      monster: typeof r.monster === 'string' && r.monster !== 'None' ? r.monster : null,
      tier: TIERS[tierIdx],
      type: typeof r.type === 'string' ? r.type : null,
      description: typeof r.task === 'string' ? r.task : null,
    });
  }

  // Stable ordering: tier ascending, then monster, then name — keeps regeneration diffs minimal.
  tasks.sort(
    (a, b) =>
      tierRank.get(a.tier.toLowerCase()) - tierRank.get(b.tier.toLowerCase()) ||
      (a.monster ?? '').localeCompare(b.monster ?? '') ||
      a.name.localeCompare(b.name),
  );

  const perTier = {};
  for (const t of tasks) perTier[t.tier] = (perTier[t.tier] ?? 0) + 1;

  const out = {
    source: 'https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks (Bucket: combat_achievement)',
    generatedAt: new Date().toISOString(),
    taskCount: tasks.length,
    tiers: TIERS,
    tasks,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${OUT_PATH}: ${tasks.length} tasks.`, perTier);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
