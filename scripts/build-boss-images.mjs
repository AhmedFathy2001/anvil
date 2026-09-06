// Build src/data/bossImages.json — a boss/activity name → OSRS wiki image URL map, so an embed can
// show the actual MONSTER (Zulrah, Vorkath, General Graardor) rather than only its signature drop.
//
//   npm run data:bossimages
//
// Keyed identically to src/data/bossIcons.json (lowercased collection-log activity names), so the
// two resolve through the same name normalisation in lib/tileIcons. bossIcons maps a boss to its
// signature DROP's item id (always available from the RuneLite cache); this maps a boss to its own
// picture, which only the wiki has — and not for everything (a skilling activity like "aerial
// fishing" has no monster), which is exactly why the item-sprite map stays the fallback.
//
// Source: the OSRS wiki's pageimages API (the same wiki the drop tables come from). One request per
// boss, redirects followed, throttled to stay a polite guest. Re-run when bossIcons.json grows.

import { readFileSync, writeFileSync } from 'node:fs';

const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const UA = 'AnvilOSRS/1.0 (https://anvilosrs.com; boss image dataset build)';
// Big enough to look crisp as a Discord thumbnail on a retina display; Discord downscales the rest.
const THUMB_PX = 320;
const DELAY_MS = 150;

const bossIcons = JSON.parse(readFileSync(new URL('../src/data/bossIcons.json', import.meta.url), 'utf8'));
const names = Object.keys(bossIcons);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The wiki's own lead image for a page, or null when the page has none (or isn't a monster). */
async function imageFor(name) {
  const url =
    `${WIKI_API}?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail` +
    `&pithumbsize=${THUMB_PX}&titles=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) }).catch(
    () => null,
  );
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  return page?.thumbnail?.source ?? null;
}

const out = {};
let hit = 0;
let miss = 0;
for (const name of names) {
  const src = await imageFor(name);
  if (src) {
    out[name] = src;
    hit++;
  } else {
    miss++;
    console.warn(`  no image: ${name}`);
  }
  await sleep(DELAY_MS);
}

// Sorted keys so a re-run's diff is just the entries that actually changed.
const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(
  new URL('../src/data/bossImages.json', import.meta.url),
  JSON.stringify(sorted, null, 0) + '\n',
);
console.log(`bossImages.json: ${hit} images written, ${miss} without a wiki image (fall back to the drop sprite).`);
