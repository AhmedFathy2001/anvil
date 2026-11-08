// Builds Anvil's own rate tables from the OSRS Wiki, and nothing else:
//
//   src/data/hourRates.json      XP per hour per skill by level band, and kills per hour per boss,
//                                for main and ironman accounts. Feeds efficient hours played /
//                                bossed (lib/efficiency), clog hours (lib/clogRarity) and tile
//                                balance (lib/balanceEffort).
//   src/data/activityRates.json  Kill-time triplets [fast, average, slow] in seconds for the balance
//                                engine, derived from the same boss kill rates.
//
// Sources (every rate records the wiki page it came from in `source`):
//   - Kills per hour: the wiki's money-making guides, read through the Bucket API
//     (bucket `money_making_guide`, json.prices.default_kph where kph_text is "Kills per hour").
//     Which guide stands for which hiscores boss is our own map, BOSS_SOURCES below.
//   - XP per hour: the wiki's skill training guides ("Pay-to-play <Skill> training", "<Skill>
//     training", "Ironman Guide/<Skill>"), read as wikitext via the MediaWiki parse API. Any table
//     with a level column and an XP/h column is read; the best rate stated at each level becomes a
//     band, and bands never go down as level goes up.
//
// Gaps: where the wiki has no number we can read, the rate comes from FALLBACK_* below — round,
// deliberately conservative figures — and is marked `estimated: true` with `source: null`. Ironman
// rates the wiki doesn't state are the main rate scaled down by IRONMAN_FACTOR, also estimated.
//
// Etiquette: descriptive User-Agent, one request at a time with a pause between, and every response
// cached under .cache/wiki-rates/ (gitignored). Delete that folder to force a fresh pull.
//
// Run:  node scripts/build-rates-dataset.mjs      (or: npm run data:rates)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CACHE_DIR = resolve(ROOT, '.cache/wiki-rates');
const HOUR_RATES_PATH = resolve(ROOT, 'src/data/hourRates.json');
const ACTIVITY_RATES_PATH = resolve(ROOT, 'src/data/activityRates.json');
const API = 'https://oldschool.runescape.wiki/api.php';
const USER_AGENT = 'AnvilBot/1.0 (+https://anvilosrs.com)';
const PAUSE_MS = 1200;

/** Bump when the JSON shape changes. */
const SCHEMA_VERSION = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiGet(params) {
  const qs = new URLSearchParams({ format: 'json', ...params }).toString();
  const key = createHash('sha1').update(qs).digest('hex');
  const file = resolve(CACHE_DIR, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  await sleep(PAUSE_MS);
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`wiki ${res.status} for ${qs}`);
  const body = await res.json();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(body));
  return body;
}

// ── Kills per hour ─────────────────────────────────────────────────────────────────────────────

async function moneyMakingRows() {
  const rows = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const q = `bucket('money_making_guide').select('page_name','json').limit(500).offset(${offset}).run()`;
    const body = await wikiGet({ action: 'bucket', query: q });
    const page = body.bucket ?? [];
    rows.push(...page);
    if (page.length < 500) break;
  }
  const kph = new Map();
  for (const r of rows) {
    let j = r.json;
    if (typeof j === 'string') {
      try { j = JSON.parse(j); } catch { continue; }
    }
    const p = j?.prices;
    if (!p || p.kph_text !== 'Kills per hour') continue;
    const n = Number(p.default_kph);
    if (Number.isFinite(n) && n > 0) kph.set(r.page_name, n);
  }
  return kph;
}

const G = (s) => `Money making guide/${s}`;

/**
 * Hiscores boss key → money-making guides that measure it, best match first. `ironman` lists guides
 * written for ironmen where they exist. `perKill` scales a guide's rate into hiscores kills (e.g. one
 * Dagannoth Kings trip kills all three kings; one Nex kill is one KC regardless of team).
 */
const BOSS_SOURCES = {
  abyssalSire: { main: [G('Killing the Abyssal Sire')] },
  alchemicalHydra: { main: [G('Killing the Alchemical Hydra')] },
  amoxliatl: { main: [G('Killing Amoxliatl')] },
  araxxor: { main: [G('Killing Araxxor')] },
  artio: { main: [G('Killing Artio')] },
  barrows: { main: [G('Barrows')] },
  bryophyta: { main: [G('Killing Bryophyta (free-to-play)')] },
  callisto: { main: [G('Killing Callisto')] },
  calvarion: { main: [G("Killing Calvar'ion")] },
  cerberus: { main: [G('Killing Cerberus')] },
  chambersOfXeric: { main: [G('Chambers of Xeric (Normal Mode)')] },
  chambersOfXericChallengeMode: { main: [G('Chambers of Xeric (Challenge Mode)')] },
  chaosElemental: { main: [G('Killing Chaos Elemental')] },
  chaosFanatic: { main: [G('Killing the Chaos Fanatic')] },
  commanderZilyana: { main: [G('Killing Commander Zilyana')] },
  corporealBeast: { main: [G('Killing the Corporeal Beast')] },
  corruptedGauntlet: { main: [G('Completing The Corrupted Gauntlet')] },
  crazyArchaeologist: { main: [G('Killing the Crazy archaeologist')] },
  dagannothRex: { main: [G('Killing Dagannoth Kings (Rex only)'), G('Killing Dagannoth Kings (Solo tribrid)')] },
  dagannothPrime: { main: [G('Killing Dagannoth Kings (Solo tribrid)')] },
  dagannothSupreme: { main: [G('Killing Dagannoth Kings (Solo tribrid)')] },
  doomOfMokhaiotl: { main: [G('Killing the Doom of Mokhaiotl (Delve 1-8)')] },
  dukeSucellus: { main: [G('Killing Duke Sucellus')] },
  fracturedArchive: { main: [G('The Fractured Archive (Trio)'), G('The Fractured Archive(Duo)')] },
  gauntlet: { main: [G('Completing The Gauntlet')] },
  generalGraardor: { main: [G('Killing General Graardor')] },
  giantMole: { main: [G('Killing the Giant Mole (Twisted bow)'), G("Killing the Giant Mole (Dharok's)")] },
  grotesqueGuardians: { main: [G('Killing the Grotesque Guardians')] },
  hueycoatl: { main: [G('Killing Hueycoatl (Solo)')] },
  kalphiteQueen: { main: [G('Killing the Kalphite Queen')] },
  kingBlackDragon: { main: [G('Killing the King Black Dragon')] },
  kraken: { main: [G('Killing the Kraken')] },
  kreeArra: { main: [G("Killing Kree'arra")] },
  krilTsutsaroth: { main: [G("Killing K'ril Tsutsaroth")] },
  leviathan: { main: [G('Killing The Leviathan')] },
  lunarChests: { main: [G('Moons of Peril')] },
  madAngel: { main: [G('Killing the Mad Angel')] },
  maggotKing: { main: [G('Killing the Maggot King'), G('Killing the Maggot King (Ranged)')] },
  nex: { main: [G('Killing Nex (Team)'), G('Killing Nex (Duo)')] },
  nightmare: { main: [G('Killing The Nightmare')] },
  phantomMuspah: { main: [G('Killing Phantom Muspah (Twisted bow)')] },
  phosanisNightmare: { main: [G("Killing Phosani's Nightmare")] },
  sarachnis: { main: [G('Killing Sarachnis')] },
  scorpia: { main: [G('Killing Scorpia')] },
  scurrius: { main: [G('Killing Scurrius'), G('Killing Scurrius (solo)')] },
  solHeredit: { main: [G('Completing the Fortis Colosseum (Wave 12)')] },
  spindel: { main: [G('Killing Spindel')] },
  theatreOfBlood: { main: [G('Theatre of Blood')] },
  thermonuclearSmokeDevil: { main: [G('Killing the Thermonuclear smoke devil')] },
  tombsOfAmascutExpertMode: { main: [G('Tombs of Amascut (Expert)'), G('Tombs of Amascut (solo 450 raid level)')] },
  vardorvis: { main: [G('Killing Vardorvis')] },
  venenatis: { main: [G('Killing Venenatis')] },
  vetion: { main: [G("Killing Vet'ion")] },
  vorkath: { main: [G('Killing Vorkath (Dragon hunter lance)'), G('Killing Vorkath (Dragon hunter crossbow)'), G('Killing Vorkath (Toxic blowpipe)')], ironman: [G('Killing Vorkath (Toxic blowpipe)')] },
  whisperer: { main: [G('Killing The Whisperer')] },
  yama: { main: [G('Killing Yama (solo)')] },
  zulrah: { main: [G('Killing Zulrah')] },
};

/**
 * Bosses the money-making guides don't rate. Kills per hour, round and on the slow side of what a
 * prepared player manages. These are OUR estimates and are flagged as such.
 */
const FALLBACK_KPH = {
  brutus: 20,
  derangedArchaeologist: 40,
  hespori: 25,
  mimic: 4,
  obor: 20,
  royalTitans: 15,
  shellbaneGryphon: 20,
  skotizo: 15,
  tempoross: 4,
  theatreOfBloodHardMode: 1.5,
  tombsOfAmascut: 2.5,
  tzKalZuk: 0.5,
  tzTokJad: 1,
  wintertodt: 5,
  zalcano: 12,
};

/** Ironman kill rates the wiki doesn't state: main × this, estimated. Worse gear, slower trips. */
const IRONMAN_FACTOR = 0.8;

// ── XP per hour ────────────────────────────────────────────────────────────────────────────────

const SKILL_PAGES = {
  attack: { main: ['Pay-to-play Melee training'], ironman: ['Ironman Guide/Melee'] },
  strength: { main: ['Pay-to-play Melee training'], ironman: ['Ironman Guide/Melee'] },
  defence: { main: ['Pay-to-play Melee training'], ironman: ['Ironman Guide/Defence', 'Ironman Guide/Melee'] },
  ranged: { main: ['Pay-to-play Ranged training'], ironman: ['Ironman Guide/Ranged'] },
  prayer: { main: ['Pay-to-play Prayer training'], ironman: ['Ironman Guide/Prayer'] },
  magic: { main: ['Pay-to-play Magic training'], ironman: ['Ironman Guide/Magic'] },
  cooking: { main: ['Pay-to-play Cooking training'], ironman: ['Ironman Guide/Cooking'] },
  woodcutting: { main: ['Pay-to-play Woodcutting training'], ironman: ['Ironman Guide/Woodcutting'] },
  fletching: { main: ['Fletching training'], ironman: ['Ironman Guide/Fletching'] },
  fishing: { main: ['Pay-to-play Fishing training'], ironman: ['Ironman Guide/Fishing'] },
  firemaking: { main: ['Pay-to-play Firemaking training'], ironman: ['Ironman Guide/Firemaking'] },
  crafting: { main: ['Pay-to-play Crafting training'], ironman: ['Ironman Guide/Crafting'] },
  smithing: { main: ['Pay-to-play Smithing training'], ironman: ['Ironman Guide/Smithing'] },
  mining: { main: ['Pay-to-play Mining training'], ironman: ['Ironman Guide/Mining'] },
  herblore: { main: ['Herblore training'], ironman: ['Ironman Guide/Herblore'] },
  agility: { main: ['Pay-to-play Agility training'], ironman: ['Ironman Guide/Agility'] },
  thieving: { main: ['Thieving training'], ironman: ['Ironman Guide/Thieving'] },
  slayer: { main: ['Slayer training'], ironman: ['Ironman Guide/Slayer'] },
  farming: { main: ['Farming training'], ironman: ['Ironman Guide/Farming'] },
  runecraft: { main: ['Pay-to-play Runecraft training'], ironman: ['Ironman Guide/Runecraft'] },
  hunter: { main: ['Hunter training'], ironman: ['Ironman Guide/Hunter'] },
  construction: { main: ['Construction training'], ironman: ['Ironman Guide/Construction'] },
  sailing: { main: ['Sailing training'], ironman: ['Ironman Guide/Sailing'] },
};

/**
 * Conservative XP/h bands for when no guide table can be read: [fromLevel, xpPerHour]. Round
 * numbers at the slow end of ordinary methods. OUR estimates, flagged as such.
 */
const FALLBACK_BANDS = {
  attack: [[1, 15000], [40, 45000], [70, 80000], [90, 100000]],
  strength: [[1, 15000], [40, 45000], [70, 80000], [90, 100000]],
  defence: [[1, 15000], [40, 45000], [70, 80000], [90, 100000]],
  ranged: [[1, 20000], [40, 60000], [70, 100000], [90, 130000]],
  prayer: [[1, 50000], [43, 200000], [70, 400000]],
  magic: [[1, 20000], [55, 70000], [75, 100000], [94, 150000]],
  cooking: [[1, 30000], [35, 120000], [68, 200000]],
  woodcutting: [[1, 15000], [35, 50000], [60, 75000], [90, 90000]],
  fletching: [[1, 20000], [40, 100000], [70, 200000]],
  fishing: [[1, 10000], [40, 30000], [70, 45000], [90, 55000]],
  firemaking: [[1, 30000], [45, 150000], [75, 250000]],
  crafting: [[1, 30000], [54, 150000], [77, 250000]],
  smithing: [[1, 20000], [40, 70000], [70, 150000], [88, 200000]],
  mining: [[1, 10000], [40, 35000], [70, 55000], [90, 70000]],
  herblore: [[1, 30000], [38, 150000], [72, 250000]],
  agility: [[1, 8000], [40, 30000], [70, 50000], [90, 60000]],
  thieving: [[1, 15000], [45, 60000], [80, 120000], [91, 150000]],
  slayer: [[1, 5000], [50, 20000], [80, 40000], [90, 50000]],
  farming: [[1, 15000], [35, 60000], [70, 150000], [85, 200000]],
  runecraft: [[1, 8000], [44, 30000], [77, 45000], [90, 55000]],
  hunter: [[1, 10000], [40, 40000], [63, 80000], [80, 110000]],
  construction: [[1, 20000], [33, 150000], [52, 350000], [74, 450000]],
  sailing: [[1, 10000], [40, 30000], [70, 50000], [90, 60000]],
};

const XP_MIN = 1000;
const XP_MAX = 2_000_000;

async function pageWikitext(title) {
  const body = await wikiGet({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  if (body.error) return null;
  return { title: body.parse?.title ?? title, text: body.parse?.wikitext?.['*'] ?? '' };
}

/** Strip links, files, refs and templates down to plain text, keeping template arguments. */
function plain(cell) {
  let s = cell;
  s = s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
  s = s.replace(/\[\[File:[^\]]*\]\]/gi, '');
  s = s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
  // Repeatedly unwrap innermost templates into their arguments.
  for (let i = 0; i < 5 && s.includes('{{'); i++) s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => ` ${inner.split('|').slice(1).join(' ')} `);
  s = s.replace(/<[^>]+>/g, ' ');
  return s;
}

/** Drop a leading `style="..." |` attribute block from a cell. */
function cellContent(raw) {
  const m = raw.match(/^\s*[a-z-]+\s*=\s*"[^"]*"(\s+[a-z-]+\s*=\s*"[^"]*")*\s*\|(?!\|)(.*)$/is);
  return m ? m[2] : raw;
}

function firstNumber(text) {
  const m = plain(text).match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k\b|K\b)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (m[2]) n *= 1000;
  return Number.isFinite(n) ? n : null;
}

/** All (level, xp/h) points from tables that have a level column and an XP/h column. */
function tablePoints(wikitext) {
  const points = [];
  const tables = wikitext.split(/\n\{\|/).slice(1).map((t) => t.split(/\n\|\}/)[0]);
  for (const table of tables) {
    const rows = table.split(/\n\|-[^\n]*/);
    let header = null;
    for (const row of rows) {
      const lines = row.split('\n').map((l) => l.trim()).filter(Boolean);
      const headLines = lines.filter((l) => l.startsWith('!'));
      if (!header && headLines.length) {
        header = headLines.flatMap((l) => l.slice(1).split('!!')).map((c) => plain(cellContent(c)).trim().toLowerCase());
        continue;
      }
      if (!header) continue;
      const levelCol = header.findIndex((h) => /\blevel|\blvl/.test(h));
      const xpCol = header.findIndex((h) => /xp\s*\/\s*h|xp\s*per\s*hour|experience\s*(per|\/)\s*h|xp\/hr|exp\/h/.test(h));
      if (levelCol < 0 || xpCol < 0) break;
      const cells = lines
        .filter((l) => l.startsWith('|') || l.startsWith('!'))
        .flatMap((l) => l.slice(1).split(/\|\||!!/))
        .map(cellContent);
      if (cells.length <= Math.max(levelCol, xpCol)) continue;
      const level = firstNumber(cells[levelCol]);
      const xp = firstNumber(cells[xpCol]);
      if (level == null || xp == null) continue;
      if (level < 1 || level > 99 || xp < XP_MIN || xp > XP_MAX) continue;
      points.push([Math.round(level), Math.round(xp)]);
    }
  }
  return points;
}

/** Points → bands: best rate stated at each level, never decreasing with level. */
function pointsToBands(points) {
  const best = new Map();
  for (const [lvl, xp] of points) best.set(lvl, Math.max(best.get(lvl) ?? 0, xp));
  const levels = [...best.keys()].sort((a, b) => a - b);
  const bands = [];
  let running = 0;
  for (const lvl of levels) {
    const xp = best.get(lvl);
    if (xp > running) {
      running = xp;
      bands.push({ fromLevel: lvl, xpPerHour: xp });
    }
  }
  // Below the first stated level the guide says nothing. Fill from our conservative fallback bands,
  // never above the first stated rate, and mark those estimated.
  return { bands, fill: (fallback) => {
    if (!bands.length || bands[0].fromLevel === 1) return bands;
    const first = bands[0];
    const below = fallback
      .filter(([lvl]) => lvl < first.fromLevel)
      .map(([fromLevel, xp]) => ({ fromLevel, xpPerHour: Math.min(xp, first.xpPerHour), estimated: true }));
    if (!below.length || below[0].fromLevel !== 1) below.unshift({ fromLevel: 1, xpPerHour: Math.min(fallback[0][1], first.xpPerHour), estimated: true });
    return [...below, ...bands];
  } };
}

async function skillBands(skill, type) {
  const titles = SKILL_PAGES[skill]?.[type] ?? [];
  for (const title of titles) {
    const page = await pageWikitext(title);
    if (!page) continue;
    const points = tablePoints(page.text);
    // A rate table worth trusting states at least three different levels.
    if (new Set(points.map(([lvl]) => lvl)).size >= 3) {
      const built = pointsToBands(points);
      // One band means the "levels" never climbed with the rate — not a level→XP/h table.
      if (built.bands.length < 2) continue;
      const bands = built.fill(FALLBACK_BANDS[skill]).map((b) => ({ ...b, source: b.estimated ? null : page.title, estimated: b.estimated === true }));
      return { bands, gap: false };
    }
  }
  return { bands: null, gap: true };
}

// ── Build ──────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const kph = await moneyMakingRows();
  console.log(`money-making guides with kills/hour: ${kph.size}`);

  const bosses = { main: {}, ironman: {} };
  const missingGuides = [];
  for (const [boss, src] of Object.entries(BOSS_SOURCES)) {
    const pick = (titles) => titles.map((t) => [t, kph.get(t)]).find(([, v]) => v);
    const main = pick(src.main);
    if (!main) {
      missingGuides.push(boss);
      continue;
    }
    bosses.main[boss] = { killsPerHour: main[1], source: main[0], estimated: false };
    const iron = src.ironman ? pick(src.ironman) : null;
    bosses.ironman[boss] = iron
      ? { killsPerHour: iron[1], source: iron[0], estimated: false }
      : { killsPerHour: round2(main[1] * IRONMAN_FACTOR), source: main[0], estimated: true };
  }
  for (const boss of missingGuides) {
    if (!FALLBACK_KPH[boss]) console.warn(`no guide and no fallback for ${boss}`);
  }
  for (const [boss, v] of Object.entries(FALLBACK_KPH)) {
    if (bosses.main[boss]) continue;
    bosses.main[boss] = { killsPerHour: v, source: null, estimated: true };
    bosses.ironman[boss] = { killsPerHour: round2(v * IRONMAN_FACTOR), source: null, estimated: true };
  }

  const skills = { main: {}, ironman: {} };
  const gaps = { main: [], ironman: [] };
  for (const skill of Object.keys(SKILL_PAGES)) {
    const main = await skillBands(skill, 'main');
    skills.main[skill] = main.bands ?? FALLBACK_BANDS[skill].map(([fromLevel, xpPerHour]) => ({ fromLevel, xpPerHour, source: null, estimated: true }));
    if (main.gap) gaps.main.push(skill);
    const iron = await skillBands(skill, 'ironman');
    if (iron.bands) skills.ironman[skill] = iron.bands;
    else {
      gaps.ironman.push(skill);
      skills.ironman[skill] = skills.main[skill].map((b) => ({
        fromLevel: b.fromLevel,
        xpPerHour: Math.round((b.xpPerHour * IRONMAN_FACTOR) / 1000) * 1000,
        source: b.source,
        estimated: true,
      }));
    }
  }

  const count = (obj) => Object.values(obj).filter((v) => !v.estimated).length;
  const countSkills = (obj) => Object.values(obj).filter((bands) => bands.some((b) => !b.estimated)).length;
  const coverage = {
    skills: {
      main: { wiki: countSkills(skills.main), total: Object.keys(skills.main).length },
      ironman: { wiki: countSkills(skills.ironman), total: Object.keys(skills.ironman).length },
    },
    bosses: {
      main: { wiki: count(bosses.main), total: Object.keys(bosses.main).length },
      ironman: { wiki: count(bosses.ironman), total: Object.keys(bosses.ironman).length },
    },
  };

  const out = {
    version: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'OSRS Wiki (oldschool.runescape.wiki): money-making guides via the Bucket API for kills per hour; skill training guides via the parse API for XP per hour. Each rate names its page in `source`; `estimated: true` marks our own conservative fill for gaps.',
    coverage,
    gaps,
    skills,
    bosses,
  };
  writeFileSync(HOUR_RATES_PATH, JSON.stringify(out, null, 2) + '\n');

  // Balance-engine kill-time triplets. The guide rate is a realistic method, so it is the AVERAGE
  // band; fast and slow sit SPREAD either side of it.
  // Keyed the way the curated balanceRates.json keys its activities (lower-case display names,
  // sometimes with "the"), so the engine can lay these over the curated entries.
  const SPREAD = 1.5;
  const curatedKeys = new Set(Object.keys(JSON.parse(readFileSync(resolve(ROOT, 'src/data/balanceRates.json'), 'utf8')).activities ?? {}));
  const labels = bossLabels();
  const activities = {};
  for (const [boss, v] of Object.entries(bosses.main)) {
    const label = (labels[boss] ?? boss).toLowerCase();
    const key = [label, `the ${label}`, label.replace(/^the /, '')].find((k) => curatedKeys.has(k));
    if (!key) continue;
    const avg = 3600 / v.killsPerHour;
    activities[key] = {
      killSeconds: [round1(avg / SPREAD), round1(avg), round1(avg * SPREAD)],
      source: v.source,
      estimated: v.estimated,
    };
  }
  writeFileSync(
    ACTIVITY_RATES_PATH,
    JSON.stringify(
      {
        source: 'Derived from src/data/hourRates.json (OSRS Wiki money-making guides). Average = the guide rate; fast/slow = ×/÷ spread.',
        generatedAt: out.generatedAt,
        spread: SPREAD,
        activityCount: Object.keys(activities).length,
        activities,
      },
      null,
      2,
    ) + '\n',
  );

  console.log(JSON.stringify(coverage));
  console.log('skill gaps (main):', gaps.main.join(', ') || 'none');
  console.log('skill gaps (ironman):', gaps.ironman.join(', ') || 'none');
  console.log('bosses on estimates:', Object.entries(bosses.main).filter(([, v]) => v.estimated).map(([k]) => k).join(', '));
}

/** Hiscores boss key → display label, read from lib/constants so the two never drift. */
function bossLabels() {
  const src = readFileSync(resolve(ROOT, 'src/lib/constants.ts'), 'utf8');
  const block = src.match(/export const BOSSES[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/key:\s*"(\w+)",\s*label:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
}

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
