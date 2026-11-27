// Boss Rush: an item hunt (lib/itemHunt, rule 'rush') scored as
//
//     kills x kcPoints  +  the points of each listed drop  +  Clan Synergy  -  deaths x deathPoints
//
// at the targets the host picked: any boss, raid mode (Entry Mode included) or monster, hiscores or
// not (Tormented Demons, Demonic gorillas). Picking one fills the drop list with its notable drops
// (api/admin/weekly/rush-drops); the host gives each its points. Nothing scores by itself.
//
//   KILLS, by default, only the ones the Anvil plugin reports: its kill facts (POST
//   /api/plugin/facts), the same per-kill reports a bingo kill tile counts by, from the kill-count
//   line or the loot each kill drops. A kill with the plugin off was never reported, so switching it
//   off to hide deaths also hides the kills. A host can open it to everyone instead (kcSource
//   'any'): kills gained on the hiscores count too at the targets the hiscores keep.
//   DROPS are the plugin's loot reports, or a manual proof staff approve, as in every item hunt.
//   DEATHS are the plugin's death reports at a target, or inside a target raid. Can be switched off.
//   CLAN SYNERGY: a kill at a group target landing together with other entrants' (rushSynergy).
//
// PURE and standalone (no imports): lib/itemHunt ranks with it, the form edits it, the tests read it.

export interface RushSynergy {
  on: boolean;
  /** 'flat': `points` for a kill done together, however many joined. 'perMate': `points` per other entrant in it, `max` at most. */
  mode: 'flat' | 'perMate';
  points: number;
  max: number;
}

export interface RushRules {
  /** What each kill is worth. */
  kcPoints: number;
  /** 'plugin': only kills the plugin reported. 'any': hiscores gains count too, where the hiscores keep them. */
  kcSource: 'plugin' | 'any';
  /** Deaths at a target take points off. */
  deaths: boolean;
  /** What each death takes off. */
  deathPoints: number;
  /** A score never goes below 0. */
  floorZero: boolean;
  synergy: RushSynergy;
  /** What counts: the names the game reports kills by ("Tormented Demon", "Theatre of Blood: Entry Mode"). */
  targets: string[];
}

export const MAX_RUSH_POINTS = 1000;
export const MAX_SYNERGY = 100;
export const MAX_RUSH_TARGETS = 20;
/** The most staff can add or take off an entrant at once. */
export const MAX_RUSH_ADJUST = 100_000;

export const DEFAULT_SYNERGY: RushSynergy = { on: true, mode: 'flat', points: 1, max: 3 };
export const DEFAULT_RUSH: RushRules = { kcPoints: 1, kcSource: 'plugin', deaths: true, deathPoints: 1, floorZero: true, synergy: DEFAULT_SYNERGY, targets: [] };

const int = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

/** The targets as posted: names, trimmed, each once (by its lower case), at most MAX_RUSH_TARGETS. */
export function targetsFromInput(raw: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    if (typeof t !== 'string') continue;
    const name = t.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length >= MAX_RUSH_TARGETS) break;
  }
  return out;
}

/** The rules as posted or stored; anything missing is the default. */
export function rushFromInput(raw: unknown): RushRules {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    kcPoints: int(body.kcPoints, 0, MAX_RUSH_POINTS, DEFAULT_RUSH.kcPoints),
    kcSource: body.kcSource === 'any' ? 'any' : 'plugin',
    deaths: body.deaths !== false,
    deathPoints: int(body.deathPoints, 0, MAX_RUSH_POINTS, DEFAULT_RUSH.deathPoints),
    floorZero: body.floorZero !== false,
    synergy: synergyFromInput(body.synergy),
    targets: targetsFromInput(body.targets),
  };
}

function synergyFromInput(raw: unknown): RushSynergy {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SYNERGY;
  // Stored before the flat mode existed: { perMate, max }.
  const legacy = s.mode === undefined && s.perMate !== undefined;
  return {
    on: s.on !== false,
    mode: s.mode === 'perMate' || legacy ? 'perMate' : 'flat',
    points: int(s.points ?? s.perMate, 0, MAX_SYNERGY, d.points),
    max: int(s.max, 0, MAX_SYNERGY, d.max),
  };
}

export interface RushTally {
  kc: number;
  deaths: number;
  /** Points from drops. */
  bonus: number;
  /** Clan Synergy points. */
  synergy: number;
  /** Points staff added or took off by hand. */
  adjust: number;
  total: number;
}

export function rushTotal(rules: RushRules, kc: number, deaths: number, bonus: number, synergy = 0, adjust = 0): RushTally {
  const counted = rules.deaths ? deaths : 0;
  const team = rules.synergy.on ? synergy : 0;
  const raw = kc * rules.kcPoints + bonus + team + adjust - counted * rules.deathPoints;
  return { kc, deaths: counted, bonus, synergy: team, adjust, total: rules.floorZero ? Math.max(0, raw) : raw };
}

const synergyLive = (s: RushSynergy) => s.on && s.points > 0 && (s.mode === 'flat' || s.max > 0);

// ── Clan Synergy ──────────────────────────────────────────────────────────────────────────────

/**
 * Two entrants' plugins reporting a kill of the same group target this close together killed it
 * together: the kill lands for the whole party on one tick, and the reports go out within seconds.
 */
export const SYNERGY_WINDOW_MS = 20_000;
/** Group kills kept per entrant. */
export const MAX_GROUP_KILLS = 3000;

/**
 * Clan Synergy points per entrant (by the key given), from each entrant's kills at the group
 * targets ([target, atMs], the caller records only those).
 *
 * One target's kills are grouped: each group starts at its earliest kill and takes the others within
 * SYNERGY_WINDOW_MS of it, one per entrant. A group of n >= 2 gives each of them `points` ('flat'),
 * or min(max, (n - 1) x points) ('perMate').
 */
export function rushSynergy(rules: Pick<RushRules, 'synergy'>, kills: Map<string, [string, number][]>): Map<string, number> {
  const out = new Map<string, number>();
  const s = rules.synergy;
  if (!synergyLive(s)) return out;
  const byTarget = new Map<string, { who: string; at: number }[]>();
  for (const [who, list] of kills) {
    for (const [target, at] of list) {
      if (typeof target !== 'string' || !Number.isFinite(at)) continue;
      const key = target.toLowerCase();
      const arr = byTarget.get(key) ?? [];
      arr.push({ who, at });
      byTarget.set(key, arr);
    }
  }
  for (const finishes of byTarget.values()) {
    finishes.sort((a, b) => a.at - b.at);
    let i = 0;
    while (i < finishes.length) {
      const start = finishes[i].at;
      const group = new Set<string>();
      let j = i;
      while (j < finishes.length && finishes[j].at - start <= SYNERGY_WINDOW_MS) {
        group.add(finishes[j].who);
        j++;
      }
      if (group.size >= 2) {
        const each = s.mode === 'flat' ? s.points : Math.min(s.max, (group.size - 1) * s.points);
        for (const who of group) out.set(who, (out.get(who) ?? 0) + each);
      }
      i = j;
    }
  }
  return out;
}

const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;

function synergyWords(s: RushSynergy): string {
  return s.mode === 'flat' ? `+${pts(s.points)} a kill done together` : `+${pts(s.points)} per clanmate with you, up to +${s.max} a kill`;
}

/** "1 kill = 1 pt · each death -1 · plugin kills only": the rules on one line. */
export function rushRulesWords(rules: RushRules): string {
  const parts = [`1 kill = ${pts(rules.kcPoints)}`];
  parts.push(rules.deaths && rules.deathPoints > 0 ? `each death -${rules.deathPoints}` : 'deaths cost nothing');
  parts.push(rules.kcSource === 'plugin' ? 'plugin kills only' : 'every kill counts');
  if (synergyLive(rules.synergy)) parts.push(`Clan Synergy ${synergyWords(rules.synergy)}`);
  return parts.join(' · ');
}

// ── Raids, mode by mode ──────────────────────────────────────────────────────────────────────

/**
 * Every raid mode as the game names it in its completion line (the name a kill fact carries), with
 * the raid it is in (the plugin's death raid tag). Entry Mode is its own target: the hiscores do not
 * keep it, so only the plugin can count it.
 */
export const RUSH_RAID_TARGETS: readonly { name: string; raid: 'cox' | 'tob' | 'tob-entry' | 'toa' | 'toa-entry'; group: true }[] = [
  { name: 'Chambers of Xeric', raid: 'cox', group: true },
  { name: 'Chambers of Xeric Challenge Mode', raid: 'cox', group: true },
  { name: 'Theatre of Blood: Entry Mode', raid: 'tob-entry', group: true },
  { name: 'Theatre of Blood', raid: 'tob', group: true },
  { name: 'Theatre of Blood: Hard Mode', raid: 'tob', group: true },
  { name: 'Tombs of Amascut: Entry Mode', raid: 'toa-entry', group: true },
  { name: 'Tombs of Amascut', raid: 'toa', group: true },
  { name: 'Tombs of Amascut: Expert Mode', raid: 'toa', group: true },
];

/**
 * Where Clan Synergy counts besides the raids: the bosses people fight in a group, by hiscores key.
 * Never one that can only be fought alone (Phosani's Nightmare, Vorkath, Zulrah, the Inferno…): two
 * clanmates finishing one at the same moment were not together.
 */
export const GROUP_BOSS_KEYS: ReadonlySet<string> = new Set([
  'chambersOfXeric', 'chambersOfXericChallengeMode', 'theatreOfBlood', 'theatreOfBloodHardMode', 'tombsOfAmascut', 'tombsOfAmascutExpertMode',
  'generalGraardor', 'commanderZilyana', 'kreeArra', 'krilTsutsaroth', 'nex',
  'nightmare', 'corporealBeast', 'dagannothPrime', 'dagannothRex', 'dagannothSupreme', 'kalphiteQueen',
  'hueycoatl', 'royalTitans', 'yama', 'callisto', 'venenatis', 'vetion', 'scurrius',
]);

/** Does Clan Synergy count at this target? Every raid mode, and the group bosses (`bossKey`: its hiscores key, if any). */
export function isGroupTarget(target: string, bossKey: string | null): boolean {
  return raidOfTarget(target) != null || (bossKey != null && GROUP_BOSS_KEYS.has(bossKey));
}

/** The hiscores' short labels for the raid modes (lib/constants BOSSES): a rush made before targets were named carries these. */
const RAID_LABELS: Record<string, string> = { 'cox cm': 'cox', 'tob hm': 'tob', 'toa expert': 'toa' };
const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The raid a target is a mode of, or null. */
export function raidOfTarget(target: string): string | null {
  const t = plain(target);
  return RUSH_RAID_TARGETS.find((r) => plain(r.name) === t)?.raid ?? RAID_LABELS[t] ?? null;
}

/** Two death reports this close together are the same death sent twice. */
export const RUSH_SAME_DEATH_MS = 20_000;

/** One rule as the side panel shows it: what, what it is worth, and a few words more when they help. */
export interface RushRuleRow {
  k: string;
  v: string;
  note?: string;
}

/**
 * The rules as the side panel spells them out: one short row each, so nobody has to open the site to
 * know what scores. Kills, deaths, Clan Synergy, drops, whose kills, the floor.
 */
export function rushRuleLines(rules: RushRules): RushRuleRow[] {
  const s = rules.synergy;
  const rows: RushRuleRow[] = [{ k: 'Kill', v: `+${pts(rules.kcPoints)}` }];
  rows.push(rules.deaths && rules.deathPoints > 0 ? { k: 'Death', v: `-${pts(rules.deathPoints)}`, note: 'Puzzles and mechanics count too.' } : { k: 'Death', v: 'free' });
  if (synergyLive(s)) {
    rows.push({
      k: 'Together',
      v: s.mode === 'flat' ? `+${pts(s.points)}` : `+${pts(s.points)} a mate`,
      note: `Killing with other entrants${s.mode === 'perMate' ? `, up to +${s.max}` : ''}. Raids and group bosses, everyone on the plugin.`,
    });
  }
  rows.push({ k: 'Drops', v: 'listed below' });
  rows.push(rules.kcSource === 'plugin' ? { k: 'Kills', v: 'plugin only', note: 'Plugin off, or another client: they do not count.' } : { k: 'Kills', v: 'all count', note: 'Hiscores too.' });
  if (rules.floorZero) rows.push({ k: 'Score', v: 'never below 0' });
  return rows;
}

/** "1/50", "1/25,000" */
export function rarityWords(n: number): string {
  return `1/${Math.round(n).toLocaleString('en-US')}`;
}
