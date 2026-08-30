// Checks our EHP/EHB engine against the reference implementation's, on real accounts.
// (The reference and its API are attributed in THIRD_PARTY_NOTICES.md.)
//
// We compute efficiency locally (src/lib/efficiency.ts) so nothing depends on their uptime at
// runtime — but agreeing with the number the rest of the community quotes is the entire value of the
// metric. So their API is used here as a TEST ORACLE: same stats in, same hours out.
//
// It feeds OUR engine the snapshot from THEIR API rather than from the hiscores, deliberately. Two
// systems reading the live hiscores seconds apart will disagree about the stats themselves, and this
// is a test of the algorithm, not of fetch timing.
//
// Usage:  npx tsx scripts/verify-efficiency.mts [username…]
//         npx tsx scripts/verify-efficiency.mts --tolerance 0.01
//
// A mismatch means one of: the rate tables have drifted (re-run `npm run data:efficiency`), the
// reference changed its algorithm, or the port is wrong. The first two are expected occasionally;
// treat the third as a bug.

import { computeEfficiency } from '../src/lib/efficiency';
import type { HiscoresSnapshot } from '../src/lib/hiscores';
import rateData from '../src/data/efficiencyRates.json';

const API = 'https://api.wiseoldman.net/v2/players';
const USER_AGENT = 'anvil-bingo efficiency verification (contact: clan admin)';

// A spread of account shapes: a maxed main, high-EHB bossers, and mid-level accounts where the
// bonus-XP maths matters most. All `main` type — the only variant we select today.
const DEFAULT_PLAYERS = ['lynx titan', 'zezima', 'b0aty', 'sick nerd', 'faux', 'settled'];

interface WomPlayer {
  username: string;
  type: string;
  build: string;
  ehp: number;
  ehb: number;
  latestSnapshot?: {
    data?: {
      skills?: Record<string, { experience?: number }>;
      bosses?: Record<string, { kills?: number }>;
    };
  };
}

async function fetchPlayer(username: string): Promise<WomPlayer | null> {
  const res = await fetch(`${API}/${encodeURIComponent(username)}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    console.log(`  ${username}: HTTP ${res.status} — skipped`);
    return null;
  }
  return (await res.json()) as WomPlayer;
}

/** Their snapshot shape → ours. Unranked reads as 0 on both sides. */
function toSnapshot(player: WomPlayer): HiscoresSnapshot {
  const data = player.latestSnapshot?.data ?? {};
  const skills: HiscoresSnapshot['skills'] = {};
  for (const [name, entry] of Object.entries(data.skills ?? {})) {
    // The reference says "runecrafting"; our hiscores parser says "runecraft".
    const key = name === 'runecrafting' ? 'runecraft' : name;
    skills[key] = { rank: 0, level: 0, xp: Math.max(0, entry?.experience ?? 0) };
  }
  const bosses: HiscoresSnapshot['bosses'] = {};
  for (const [name, entry] of Object.entries(data.bosses ?? {})) {
    const key = bossKey(name);
    if (!key) continue; // a boss we don't rate — contributes 0 EHB on both sides
    bosses[key] = { rank: 0, score: Math.max(0, entry?.kills ?? 0) };
  }
  return { skills, bosses } as HiscoresSnapshot;
}

// The reference's metric names and our boss keys differ in punctuation and case (`kreearra` vs `kreeArra`,
// `tzkal_zuk` vs `tzKalZuk`), so match on letters and digits alone — the same reduction the dataset
// builder uses — with the handful of genuine renames spelled out.
const flatten = (s: string) => s.toLowerCase().replace(/^the[_\s]/, '').replace(/[^a-z0-9]/g, '');
const ALIAS: Record<string, string> = {
  barrowschests: 'barrows',
  chambersofxericcm: 'chambersOfXericChallengeMode',
  tombsofamascutexpert: 'tombsOfAmascutExpertMode',
};
const OUR_BOSS_KEYS = new Map(
  Object.keys((rateData as { algorithms: { main: { bosses: Record<string, number> } } }).algorithms.main.bosses)
    .map((k) => [flatten(k), k]),
);
function bossKey(womName: string): string | null {
  const flat = flatten(womName);
  return ALIAS[flat] ?? OUR_BOSS_KEYS.get(flat) ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const tolIdx = args.indexOf('--tolerance');
  const tolerance = tolIdx === -1 ? 0.02 : Number(args[tolIdx + 1]);
  const players = args.filter((a, i) => !a.startsWith('--') && i !== tolIdx + 1);
  const usernames = players.length > 0 ? players : DEFAULT_PLAYERS;

  console.log(`Comparing our engine against the reference for ${usernames.length} accounts (tolerance ${tolerance}h)\n`);
  console.log(`${'account'.padEnd(14)} ${'our EHP'.padStart(10)} ${'ref EHP'.padStart(10)}  ${'our EHB'.padStart(9)} ${'ref EHB'.padStart(9)}   verdict`);

  let failures = 0;
  let checked = 0;

  for (const username of usernames) {
    const player = await fetchPlayer(username);
    if (!player) continue;
    if (player.type !== 'regular' || player.build !== 'main') {
      // We only select the `main` tables today, so anything else would be compared against a
      // different algorithm and fail for a reason that isn't a bug.
      console.log(`  ${username}: ${player.type}/${player.build} — skipped (we select main)`);
      continue;
    }

    const ours = computeEfficiency(toSnapshot(player));
    const ehpDiff = Math.abs(ours.ehp - player.ehp);
    const ehbDiff = Math.abs(ours.ehb - player.ehb);
    const ok = ehpDiff <= tolerance && ehbDiff <= tolerance;
    if (!ok) failures++;
    checked++;

    console.log(
      `${player.username.padEnd(14)} ${ours.ehp.toFixed(2).padStart(10)} ${player.ehp.toFixed(2).padStart(10)}  ` +
        `${ours.ehb.toFixed(2).padStart(9)} ${player.ehb.toFixed(2).padStart(9)}   ` +
        (ok ? 'match' : `MISMATCH (ehp ${ehpDiff.toFixed(3)}h, ehb ${ehbDiff.toFixed(3)}h)`),
    );
  }

  console.log(`\n${checked - failures}/${checked} matched within ${tolerance}h.`);
  if (failures > 0) {
    console.log('Re-run `npm run data:efficiency` first — a rate-table drift explains most mismatches.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
