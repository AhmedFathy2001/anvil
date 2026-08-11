// Regenerates src/data/efficiencyRates.json — the rate tables behind EHP (efficient hours played)
// and EHB (efficient hours bossed).
//
// This file is DATA ONLY. The algorithm that consumes it is ours (src/lib/efficiency.ts): we compute
// every number locally from the hiscores snapshots we already take every 15 minutes, so nothing here
// becomes a runtime dependency on somebody else's uptime, and self-hosted instances work offline.
// What we borrow is the part that genuinely needs a community behind it — the rates themselves.
//
// Source: Wise Old Man's efficiency configs (MIT licensed —
// Copyright (c) Wise Old Man contributors, https://github.com/wise-old-man/wise-old-man).
// They track game updates continuously, which is exactly the maintenance we don't want to duplicate.
//
// All nine EHP variants and four EHB variants are captured, not just `main`. We only *select* main
// today (we read main-mode hiscores and don't detect account type yet), but pulling the rest now
// means ironman support later is a lookup change rather than a re-port.
//
// The output carries a `version`, and the app layers rate sources rather than hardcoding one: the
// bundled dataset is the base, a control-plane feed can override it without a redeploy, and a clan's
// own settings win over both.
//
// Run:  node scripts/build-efficiency-dataset.mjs      (or: npm run data:efficiency)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, '../src/data/efficiencyRates.json');
const USER_AGENT = 'anvil-bingo efficiency dataset builder (contact: clan admin)';

const RAW_BASE =
  'https://raw.githubusercontent.com/wise-old-man/wise-old-man/master/server/src/api/modules/efficiency/configs';

// Algorithm variants, by the account shape they describe. EHB has fewer because the skilling-only
// builds (lvl3, f2p) have no bossing table of their own.
const EHP_VARIANTS = [
  'main', 'ironman', 'ultimate', 'def1', 'lvl3', 'f2p', 'f2p_lvl3', 'f2p_ironman', 'f2p_lvl3_ironman',
];
const EHB_VARIANTS = ['main', 'ironman', 'ultimate', 'def1'];

// WOM's skill name → the key our hiscores snapshots use (osrs-json-hiscores). Only one disagrees.
const SKILL_KEY = { runecrafting: 'runecraft' };

// WOM's boss name → our boss key, for the cases normalisation can't reach. Everything else matches
// once both sides are reduced to lowercase letters and digits (`kreearra` ← `kree_arra`/`kreeArra`),
// with a leading "the" dropped (`the_leviathan` → `leviathan`).
const BOSS_ALIAS = {
  barrowschests: 'barrows',
  chambersofxericcm: 'chambersOfXericChallengeMode',
  tombsofamascutexpert: 'tombsOfAmascutExpertMode',
  corruptedgauntlet: 'corruptedGauntlet',
};

const flatten = (s) => s.toLowerCase().replace(/^the[_\s]/, '').replace(/[^a-z0-9]/g, '');

/**
 * Turn one of WOM's TypeScript config modules into plain data.
 *
 * They're machine-shaped literals — no comments, no expressions — so a narrow transform is safer
 * than evaluating remote code: quote the enum references and the bare keys, drop numeric separators
 * and trailing commas, then JSON.parse. Anything unexpected fails loudly at the parse rather than
 * silently producing a half-table.
 */
function parseConfigModule(source, what) {
  const start = source.indexOf('export default');
  if (start === -1) throw new Error(`${what}: no default export — layout changed?`);
  let body = source.slice(source.indexOf('[', start));
  body = body
    .replace(/\/\/[^\n]*/g, '')                       // defensive: tolerate a comment appearing later
    // Drop the human-readable `description: 'Bonus XP from Slayer'` fields. They're single-quoted and
    // contain apostrophes ("Kruk's Dungeon"), which is a quoting minefield for no gain — the engine
    // computes from startExp/rate alone.
    .replace(/description:\s*'(?:[^'\\]|\\.)*'\s*,?/g, '')
    .replace(/(?:Skill|Boss|Metric)\.([A-Z0-9_]+)/g, (_, name) => `"${name.toLowerCase()}"`)
    .replace(/(\d)_(?=\d)/g, '$1')                    // 1_000_000 → 1000000
    .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/;\s*$/, '')
    .trim();
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error(`${what}: could not parse config (${err.message})`);
  }
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

/** Map a WOM skill name onto our snapshot key, or null if we don't track that skill. */
function skillKey(name) {
  return SKILL_KEY[name] ?? name;
}

async function fetchEhp(variant) {
  const raw = await fetchText(`${RAW_BASE}/ehp/${variant}.ehp.ts`);
  const parsed = parseConfigModule(raw, `${variant}.ehp`);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(`${variant}.ehp: empty config`);

  return parsed.map((entry) => ({
    skill: skillKey(entry.skill),
    // `realRate` marks the honest rate of a method whose headline rate assumes bonus XP flowing in
    // from elsewhere; the bonus-scaling maths needs both. Keep it only where present.
    methods: (entry.methods ?? []).map((m) => ({
      startExp: m.startExp,
      rate: m.rate,
      ...(m.realRate ? { realRate: m.realRate } : {}),
    })),
    bonuses: (entry.bonuses ?? []).map((b) => ({
      originSkill: skillKey(b.originSkill),
      bonusSkill: skillKey(b.bonusSkill),
      startExp: b.startExp,
      endExp: b.endExp,
      end: Boolean(b.end),
      ratio: b.ratio,
      ...(b.maxBonus ? { maxBonus: b.maxBonus } : {}),
    })),
  }));
}

async function fetchEhb(variant, ourBossKeys, unmatched) {
  const raw = await fetchText(`${RAW_BASE}/ehb/${variant}.ehb.ts`);
  const parsed = parseConfigModule(raw, `${variant}.ehb`);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(`${variant}.ehb: empty config`);

  const rates = {};
  for (const entry of parsed) {
    if (typeof entry?.rate !== 'number' || entry.rate <= 0) continue; // rate 0 = "no EHB for this"
    const flat = flatten(entry.boss);
    const key = BOSS_ALIAS[flat] ?? ourBossKeys.get(flat);
    if (!key) {
      unmatched.add(entry.boss);
      continue;
    }
    rates[key] = entry.rate;
  }
  return rates;
}

async function main() {
  // Read our own boss keys out of the app's constants, so the mapping can't drift from what the
  // hiscores parser actually produces. Read as text rather than imported: constants.ts is TypeScript
  // and this script runs under plain node.
  const { readFileSync } = await import('node:fs');
  const constantsSrc = readFileSync(resolve(HERE, '../src/lib/constants.ts'), 'utf8');
  const bossKeys = [...constantsSrc.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (bossKeys.length < 40) throw new Error('could not read BOSSES keys from src/lib/constants.ts');
  const ourBossKeys = new Map(bossKeys.map((k) => [flatten(k), k]));

  const unmatched = new Set();
  const algorithms = {};

  for (const variant of EHP_VARIANTS) {
    process.stdout.write(`  ehp/${variant}… `);
    const skills = await fetchEhp(variant);
    algorithms[variant] = { skills, bosses: {} };
    console.log(`${skills.length} skills`);
  }
  for (const variant of EHB_VARIANTS) {
    process.stdout.write(`  ehb/${variant}… `);
    const bosses = await fetchEhb(variant, ourBossKeys, unmatched);
    algorithms[variant].bosses = bosses;
    console.log(`${Object.keys(bosses).length} bosses`);
  }

  const mainSkills = algorithms.main.skills;
  const brackets = mainSkills.reduce((n, s) => n + s.methods.length, 0);
  const bonuses = mainSkills.reduce((n, s) => n + s.bonuses.length, 0);
  if (brackets < 100 || Object.keys(algorithms.main.bosses).length < 40) {
    throw new Error(`main tables look too small (${brackets} brackets, ${Object.keys(algorithms.main.bosses).length} bosses) — format changed?`);
  }

  const out = {
    source: 'Wise Old Man efficiency configs (MIT) — https://github.com/wise-old-man/wise-old-man',
    generatedAt: new Date().toISOString(),
    // Bumped by hand when the SHAPE changes. A control-plane feed can compare this to decide whether
    // a pushed table is compatible with the engine an instance is running.
    version: 1,
    note:
      'Rate tables only. The EHP/EHB algorithm lives in src/lib/efficiency.ts and runs locally against ' +
      'our own hiscores snapshots. Variants beyond `main` are captured for future account-type support; ' +
      'we read main-mode hiscores today and select `main`.',
    algorithms,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);

  console.log(`\nWrote ${EHP_VARIANTS.length} EHP + ${EHB_VARIANTS.length} EHB variants → ${OUT_PATH}`);
  console.log(`  main: ${mainSkills.length} skills, ${brackets} rate brackets, ${bonuses} bonus rules, ` +
    `${Object.keys(algorithms.main.bosses).length} bosses`);
  if (unmatched.size) {
    // Not fatal: WOM rates bosses we may not track yet. Loud, because the reverse (a boss we track
    // silently scoring 0 EHB) is the failure mode that would quietly under-rank someone.
    console.log(`\n  ${unmatched.size} WOM bosses have no key on our side: ${[...unmatched].join(', ')}`);
  }
  const ourMissing = [...ourBossKeys.values()].filter((k) => !(k in algorithms.main.bosses));
  if (ourMissing.length) {
    console.log(`  ${ourMissing.length} of our bosses have no EHB rate (they score 0): ${ourMissing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
