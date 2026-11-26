// Boss Rush: an item hunt (lib/itemHunt, rule 'rush') scored as
//
//     kills x kcPoints  +  the points of each listed drop  -  deaths x deathPoints
//
// at the bosses the host picked. Picking the bosses fills the drop list with their collection-log
// items (raid uniques included, the commons and cosmetics left out: api/admin/weekly/rush-drops);
// the host gives each one its points, and removes or adds what they like. Nothing scores by itself.
//
//   KILLS, by default, only the ones the Anvil plugin saw: its live kill-count pushes (POST
//   /api/plugin/stats), measured push to push (rushKcStep). A jump the plugin did not watch (it
//   was off, or the kills were done on another client) counts as one kill at most, so switching the
//   plugin off to hide deaths also hides the kills. A host can open it to everyone instead
//   (kcSource 'any'): kills gained on the hiscores count too, the way Boss of the Week reads them.
//   DROPS are the plugin's loot reports, or a manual proof staff approve, as in every item hunt.
//   DEATHS are the plugin's death reports naming a rush boss as the killer. A host can switch them off.
//
// PURE and standalone (no imports): lib/itemHunt ranks with it, the form edits it, the tests read it.

export interface RushRules {
  /** What each kill is worth. */
  kcPoints: number;
  /** 'plugin': only kills the plugin saw. 'any': every kill gained, hiscores included. */
  kcSource: 'plugin' | 'any';
  /** Deaths at a rush boss take points off. */
  deaths: boolean;
  /** What each death takes off. */
  deathPoints: number;
  /** A score never goes below 0. */
  floorZero: boolean;
  /**
   * Clan Synergy: a raid finished with other entrants earns each of them `perMate` per clanmate in
   * it, `max` at most per raid (rushSynergy).
   */
  synergy: { on: boolean; perMate: number; max: number };
}

export const MAX_RUSH_POINTS = 1000;
export const MAX_SYNERGY = 100;

export const DEFAULT_RUSH: RushRules = { kcPoints: 1, kcSource: 'plugin', deaths: true, deathPoints: 1, floorZero: true, synergy: { on: true, perMate: 1, max: 3 } };

const int = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

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
  };
}

function synergyFromInput(raw: unknown): RushRules['synergy'] {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_RUSH.synergy;
  return { on: s.on !== false, perMate: int(s.perMate, 0, MAX_SYNERGY, d.perMate), max: int(s.max, 0, MAX_SYNERGY, d.max) };
}

export interface RushTally {
  kc: number;
  deaths: number;
  /** Points from drops. */
  bonus: number;
  /** Clan Synergy points: raids finished with clanmates. */
  synergy: number;
  total: number;
}

export function rushTotal(rules: RushRules, kc: number, deaths: number, bonus: number, synergy = 0): RushTally {
  const counted = rules.deaths ? deaths : 0;
  const team = rules.synergy.on ? synergy : 0;
  const raw = kc * rules.kcPoints + bonus + team - counted * rules.deathPoints;
  return { kc, deaths: counted, bonus, synergy: team, total: rules.floorZero ? Math.max(0, raw) : raw };
}

// ── Clan Synergy ──────────────────────────────────────────────────────────────────────────────

/**
 * Two entrants' plugins pushing the same boss's new kill count this close together killed it
 * together: the kill-count line reaches the whole party on one tick, and pushes go out ~15s later.
 */
export const SYNERGY_WINDOW_MS = 30_000;

/**
 * Where Clan Synergy counts: the raids and the bosses people fight in a group. Never a boss that
 * can only be fought alone (Phosani's Nightmare, Vorkath, Zulrah, the Inferno…): two clanmates
 * finishing one at the same moment were not together.
 */
export const SYNERGY_BOSSES: ReadonlySet<string> = new Set([
  'chambersOfXeric', 'chambersOfXericChallengeMode', 'theatreOfBlood', 'theatreOfBloodHardMode', 'tombsOfAmascut', 'tombsOfAmascutExpertMode',
  'generalGraardor', 'commanderZilyana', 'kreeArra', 'krilTsutsaroth', 'nex',
  'nightmare', 'corporealBeast', 'dagannothPrime', 'dagannothRex', 'dagannothSupreme', 'kalphiteQueen',
  'hueycoatl', 'royalTitans', 'yama', 'callisto', 'venenatis', 'vetion', 'scurrius',
]);
/** Raids kept per entrant: far past a week of raiding. */
export const MAX_RUSH_RAIDS = 600;

/** A seat's kills at a group boss with this push, appended: what rushSynergy groups. */
export function withGroupKills(list: [string, number][] | null | undefined, credited: string[], nowMs: number): [string, number][] | null {
  const add = credited.filter((k) => SYNERGY_BOSSES.has(k));
  if (add.length === 0) return null;
  return [...(list ?? []), ...add.map((k) => [k, nowMs] as [string, number])].slice(-MAX_RUSH_RAIDS);
}

/**
 * Clan Synergy points per entrant (by the key given), from each entrant's kills at the
 * SYNERGY_BOSSES (the caller records only those).
 *
 * One boss's kills are grouped: each group starts at its earliest kill and takes the others within
 * SYNERGY_WINDOW_MS of it, one per entrant. A group of n gives each of its n entrants
 * min(max, (n - 1) x perMate).
 */
export function rushSynergy(rules: Pick<RushRules, 'synergy'>, raids: Map<string, [string, number][]>): Map<string, number> {
  const out = new Map<string, number>();
  if (!rules.synergy.on || rules.synergy.perMate <= 0 || rules.synergy.max <= 0) return out;
  const byKey = new Map<string, { who: string; at: number }[]>();
  for (const [who, list] of raids) {
    for (const [key, at] of list) {
      if (typeof key !== 'string' || !Number.isFinite(at)) continue;
      const arr = byKey.get(key) ?? [];
      arr.push({ who, at });
      byKey.set(key, arr);
    }
  }
  for (const finishes of byKey.values()) {
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
        const each = Math.min(rules.synergy.max, (group.size - 1) * rules.synergy.perMate);
        for (const who of group) out.set(who, (out.get(who) ?? 0) + each);
      }
      i = j;
    }
  }
  return out;
}

/** "1 kill = 1 pt · each death -1 · plugin kills only": the rules on one line. */
export function rushRulesWords(rules: RushRules): string {
  const parts = [`1 kill = ${rules.kcPoints} ${rules.kcPoints === 1 ? 'pt' : 'pts'}`];
  parts.push(rules.deaths && rules.deathPoints > 0 ? `each death -${rules.deathPoints}` : 'deaths cost nothing');
  parts.push(rules.kcSource === 'plugin' ? 'plugin kills only' : 'every kill counts');
  if (rules.synergy.on && rules.synergy.perMate > 0 && rules.synergy.max > 0) parts.push(`Clan Synergy +${rules.synergy.perMate} per clanmate with you, up to +${rules.synergy.max} a kill`);
  return parts.join(' · ');
}

// ── Kills, push to push ──────────────────────────────────────────────────────────────────────

/** Pushes this close together are one sitting the plugin watched throughout. */
export const RUSH_SITTING_MS = 10 * 60_000;
/** The fastest a boss kill comes round; a push claiming more kills than this allows is capped to it. */
export const RUSH_FASTEST_KILL_MS = 8_000;

/** Last count the plugin pushed per boss key, and when: weekly_participants.rush_seen. */
export type RushSeen = Record<string, [number, number]>;

/**
 * Kills to credit for one push, and what the plugin has now seen.
 *
 * Each pushed boss key is measured from the last count the plugin pushed for it, else from the
 * participant's starting count (`start`, read off the hiscores when the rush began, timed at the
 * start), else from nothing (a boss they had too few kills at to be on the hiscores).
 *
 *   - Within one sitting (the last push under RUSH_SITTING_MS ago) the whole rise counts, capped at
 *     one kill per RUSH_FASTEST_KILL_MS since that push: a push batches a few kills, never a day's.
 *   - After a gap, or with nothing to measure from, the rise counts as ONE kill: the push is the
 *     plugin seeing a kill, and the rest happened where it could not see.
 *   - A count that went down (a stale reading) credits nothing, and is not taken as the new line.
 */
export function rushKcStep(input: {
  pushed: Record<string, number>;
  bossKeys: string[];
  seen: RushSeen | null;
  start: Record<string, number> | null;
  startMs: number;
  nowMs: number;
}): { credit: number; seen: RushSeen; credited: string[] } {
  const seen: RushSeen = { ...(input.seen ?? {}) };
  let credit = 0;
  const credited: string[] = [];
  for (const key of input.bossKeys) {
    const v = input.pushed[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue;
    const last = seen[key] ?? (input.start?.[key] != null ? ([input.start[key], input.startMs] as [number, number]) : null);
    if (!last) {
      credit += 1;
      credited.push(key);
      seen[key] = [v, input.nowMs];
      continue;
    }
    const [was, at] = last;
    if (v <= was) {
      if (v === was) seen[key] = [v, input.nowMs];
      continue;
    }
    const gap = Math.max(0, input.nowMs - at);
    const rise = v - was;
    credit += gap <= RUSH_SITTING_MS && seen[key] ? Math.min(rise, Math.max(1, Math.ceil(gap / RUSH_FASTEST_KILL_MS))) : 1;
    credited.push(key);
    seen[key] = [v, input.nowMs];
  }
  return { credit, seen, credited };
}

/** Two death reports this close together are the same death sent twice. */
export const RUSH_SAME_DEATH_MS = 20_000;

/**
 * The rules as the side panel spells them out, one short sentence a line, so nobody has to open the
 * site to know what scores: kills, deaths, whose kills, Clan Synergy, drops, the floor.
 */
export function rushRuleLines(rules: RushRules, bosses: string[]): string[] {
  const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;
  const where = bosses.length === 0 ? 'the bosses' : bosses.length <= 3 ? bosses.join(', ') : `${bosses.slice(0, 3).join(', ')} and ${bosses.length - 3} more`;
  const lines = [`Each kill at ${where}: +${pts(rules.kcPoints)}.`];
  lines.push(rules.deaths && rules.deathPoints > 0 ? `Each death there: -${pts(rules.deathPoints)}, mechanics included.` : 'Deaths cost nothing.');
  lines.push(rules.kcSource === 'plugin' ? 'Only kills with the Anvil plugin on count. Off, or another client, they do not.' : 'Every kill counts, hiscores included.');
  if (rules.synergy.on && rules.synergy.perMate > 0 && rules.synergy.max > 0) {
    lines.push(
      `Clan Synergy: +${pts(rules.synergy.perMate)} for each entrant with you, up to +${rules.synergy.max} a kill. Raids and group bosses only (God Wars, Nex, the Nightmare…), never solo-only ones like Phosani's. All of you need the plugin on.`,
    );
  }
  lines.push('Drops score the points shown beside them below.');
  if (rules.floorZero) lines.push('A score never goes below 0.');
  return lines;
}

/** "1/50", "1/25,000" */
export function rarityWords(n: number): string {
  return `1/${Math.round(n).toLocaleString('en-US')}`;
}
