// Build src/data/bossHiscoreIcons.json — hiscores boss KEY (lib/constants BOSSES) → the OSRS wiki file
// of that boss's HISCORES icon ("Nex icon.png", 25×25).
//
//   npm run data:bosshiscoreicons
//
// These are the same game-cache sprites RuneLite's hiscore panel draws for each boss
// (net.runelite.client.hiscore.HiscoreSkill carries the sprite id; the wiki uploads the sprite as
// "<Boss> icon.png"), so a boss on the site looks like the boss a member picked in RuneLite — not its
// signature drop (Nex was a Nihil horn). Every candidate is checked against the wiki API; a boss whose
// file is missing is simply left out and lib/tileIcons falls back to the older picture.

import { readFileSync, writeFileSync } from 'node:fs';

const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
const UA = 'AnvilOSRS/1.0 (https://anvilosrs.com; boss hiscore icon dataset build)';

// Pull the keys + labels straight out of constants.ts so the dataset can't drift from BOSSES.
const src = readFileSync(new URL('../src/lib/constants.ts', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('export const BOSSES'), src.indexOf('];', src.indexOf('export const BOSSES')));
const bosses = [...block.matchAll(/key:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map((m) => ({ key: m[1], label: m[2] }));
if (bosses.length < 50) throw new Error(`parsed only ${bosses.length} bosses from constants.ts`);

// Labels that are shorthand, or whose hiscores icon is filed under another name. First hit wins.
const CANDIDATES = {
  // RuneLite reuses one sprite for these pairs (same HiscoreSkill sprite id), so do we.
  artio: ['Callisto icon.png'],
  spindel: ['Venenatis icon.png'],
  calvarion: ["Vet'ion icon.png"],
  phosanisNightmare: ['The Nightmare icon.png'],
  theatreOfBloodHardMode: ['Verzik Vitur icon.png'],
  // The wiki files raid and minigame sprites under the boss at the end of it.
  chambersOfXeric: ['Great Olm icon.png'],
  // Not "Chambers of Xeric Challenge Mode icon.png": that one is a 16px raid-interface glyph.
  chambersOfXericChallengeMode: ['Great Olm icon (Challenge mode).png'],
  theatreOfBlood: ['Verzik Vitur icon.png'],
  tombsOfAmascut: ['Tombs of Amascut - Normal Mode icon.png'],
  tombsOfAmascutExpertMode: ['Tombs of Amascut - Expert Mode icon.png'],
  gauntlet: ['Crystalline Hunllef icon.png'],
  corruptedGauntlet: ['Corrupted Hunllef icon.png'],
  barrows: ['Barrows Brothers icon.png'],
  kreeArra: ["Kree'arra icon.png"],
  brutus: ['Brutus Boss icon.png'],
  // No "Lunar Chests" sprite on the wiki; the Blood Moon (one of the three Moons of Peril) stands in.
  lunarChests: ['Blood Moon icon.png'],
  thermonuclearSmokeDevil: ['Thermonuclear smoke devil icon.png'],
  nightmare: ['The Nightmare icon.png'],
  mimic: ['The Mimic icon.png'],
};

const candidatesFor = (b) => {
  const own = CANDIDATES[b.key] ?? [];
  const label = b.label;
  const stripped = label.replace(/^The /, '');
  return [...new Set([...own, `${label} icon.png`, `${stripped} icon.png`, `The ${stripped} icon.png`])];
};

/** Which of these files exist, title → url. Batched 50 per request (the API's limit). */
async function existing(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const titles = files.slice(i, i + 50).map((f) => `File:${f}`).join('|');
    const url = `${WIKI_API}?action=query&format=json&redirects=1&prop=imageinfo&iiprop=url|size&titles=${encodeURIComponent(titles)}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`wiki API ${res.status}`);
    const data = await res.json();
    // Map the requested spelling to the normalised title the response uses.
    const norm = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    const redir = new Map((data.query?.redirects ?? []).map((r) => [r.to, r.from]));
    for (const p of Object.values(data.query?.pages ?? {})) {
      if (p.missing !== undefined || !p.imageinfo?.[0]) continue;
      const info = p.imageinfo[0];
      let asked = redir.get(p.title) ?? p.title;
      asked = norm.get(asked) ?? asked;
      const file = new URL(info.url).pathname.replace(/^\/images\//, '');
      out.set(asked.replace(/^File:/, '').replace(/_/g, ' '), { file: decodeURIComponent(file), w: info.width, h: info.height });
    }
  }
  return out;
}

const all = [...new Set(bosses.flatMap(candidatesFor))];
const found = await existing(all);
const out = {};
for (const b of bosses) {
  const hit = candidatesFor(b).find((c) => found.has(c));
  if (!hit) { console.warn(`  no hiscores icon: ${b.key} (${b.label})`); continue; }
  const f = found.get(hit);
  // The hiscores sprites are small (≈25px); anything big is a different picture with a lookalike name.
  if (f.w > 64 || f.h > 64) { console.warn(`  ${b.key}: ${hit} is ${f.w}×${f.h}, not a hiscores sprite — skipped`); continue; }
  out[b.key] = f.file;
}

writeFileSync(new URL('../src/data/bossHiscoreIcons.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(`bossHiscoreIcons.json: ${Object.keys(out).length}/${bosses.length} bosses`);
