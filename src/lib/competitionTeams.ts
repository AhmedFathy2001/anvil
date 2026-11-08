/**
 * Team competitions — the pure half (no database; tests import it directly).
 *
 * A weekly competition (SOTW/BOTW/custom) runs in one of three modes:
 *  - solo:  everyone for themselves (the original);
 *  - teams: participants are split into teams, team totals are ranked;
 *  - clans: clan vs clan — the host plus every clan that accepted an invite, clan totals ranked.
 *
 * Teams and clans are the same question asked of a different grouping, so both are scored by
 * `rankGroups`: total = sum of the members' gains, average = total / members (so a team of 3 can be
 * compared with a team of 5), ties broken by who reached the total first, then by name.
 * The database half lives in lib/competitionTeamsDb.
 */

export const COMPETITION_MODES = ['solo', 'teams', 'clans'] as const;
export type CompetitionMode = (typeof COMPETITION_MODES)[number];

export function parseCompetitionMode(raw: unknown): CompetitionMode | null {
  return typeof raw === 'string' && (COMPETITION_MODES as readonly string[]).includes(raw)
    ? (raw as CompetitionMode)
    : null;
}

/** Normalise whatever the DB holds (old rows predate the column's values) to a mode. */
export function competitionMode(raw: string | null | undefined): CompetitionMode {
  return parseCompetitionMode(raw) ?? 'solo';
}

/** Gold first, then colours that read on the dark card background. Used for new teams. */
export const TEAM_COLOURS = ['#d4a017', '#4f8cff', '#e5534b', '#34d058', '#b083f0', '#f0883e', '#39c5cf', '#db61a2'];

export function teamColour(raw: unknown, fallbackIndex = 0): string {
  if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return TEAM_COLOURS[fallbackIndex % TEAM_COLOURS.length];
}

export interface GroupDef {
  key: number;
  name: string;
  colour?: string | null;
}

export interface GroupMember {
  rsn: string;
  /** Raw gain (current - baseline); negatives are floored at 0 when scored. */
  gained: number;
  /** When this member's gain last went up (ISO). Null = never moved / unknown. */
  gainAt: string | null;
  /** The group this member scores for; null = in no group (unassigned in teams mode). */
  groupKey: number | null;
}

export interface GroupEntry {
  rank: number;
  rsn: string;
  gained: number;
}

export interface GroupStanding {
  key: number;
  name: string;
  colour: string | null;
  rank: number;
  total: number;
  /** total / members, 0 for an empty group. */
  average: number;
  members: number;
  /** When the group last moved — the moment its current total was reached. Null when total is 0. */
  reachedAt: string | null;
  /** The group's members, best first (same tie rule as the solo board: gain, then name). */
  entries: GroupEntry[];
}

/** Compare two ISO-ish timestamps; earlier first, a missing one after any present one. */
function earlierFirst(a: string | null, b: string | null): number {
  if (a && b) return a < b ? -1 : a > b ? 1 : 0;
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/**
 * Score and rank groups. Every group in `groups` is returned, even an empty one (it ranks last on
 * 0). Members whose groupKey matches no group are ignored here — the caller shows them as unassigned.
 *
 * Tie rule, in order: higher total; reached that total first (the latest gainAt among the members
 * who contributed — a group that stopped moving earlier got there first); name, alphabetically.
 */
export function rankGroups(groups: GroupDef[], members: GroupMember[]): GroupStanding[] {
  const byKey = new Map<number, GroupMember[]>();
  for (const g of groups) byKey.set(g.key, []);
  for (const m of members) {
    if (m.groupKey == null) continue;
    byKey.get(m.groupKey)?.push(m);
  }

  const scored = groups.map((g) => {
    const list = byKey.get(g.key) ?? [];
    let total = 0;
    let reachedAt: string | null = null;
    for (const m of list) {
      const gain = Math.max(0, m.gained);
      total += gain;
      if (gain > 0 && m.gainAt && (!reachedAt || m.gainAt > reachedAt)) reachedAt = m.gainAt;
    }
    const entries = list
      .map((m) => ({ rsn: m.rsn, gained: Math.max(0, m.gained) }))
      .sort((a, b) => b.gained - a.gained || a.rsn.localeCompare(b.rsn))
      .map((e, i) => ({ rank: i + 1, ...e }));
    return {
      key: g.key,
      name: g.name,
      colour: g.colour ?? null,
      rank: 0,
      total,
      average: list.length ? total / list.length : 0,
      members: list.length,
      reachedAt: total > 0 ? reachedAt : null,
      entries,
    };
  });

  scored.sort(
    (a, b) => b.total - a.total || earlierFirst(a.reachedAt, b.reachedAt) || a.name.localeCompare(b.name),
  );
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}

export interface BalanceInput {
  id: number;
  /** Current level/XP/KC — the strength the split balances. */
  strength: number;
}

/**
 * Auto-balance: split players across `teamCount` teams so sizes differ by at most one and the
 * strength sums are as even as a greedy pass gets. Strongest first; each goes to the team with the
 * fewest members, then the lowest strength sum, then the lowest index (deterministic).
 * Returns teamIndex per player id.
 */
export function autoBalance(players: BalanceInput[], teamCount: number): Map<number, number> {
  const out = new Map<number, number>();
  if (teamCount < 1) return out;
  const size = new Array<number>(teamCount).fill(0);
  const sum = new Array<number>(teamCount).fill(0);
  const sorted = [...players].sort((a, b) => b.strength - a.strength || a.id - b.id);
  for (const p of sorted) {
    let best = 0;
    for (let t = 1; t < teamCount; t++) {
      if (size[t] < size[best] || (size[t] === size[best] && sum[t] < sum[best])) best = t;
    }
    out.set(p.id, best);
    size[best]++;
    sum[best] += Math.max(0, p.strength);
  }
  return out;
}

/** The team a late joiner goes into: fewest members, then lowest sort order/id (first in list). */
export function smallestTeam(teams: { id: number; members: number }[]): number | null {
  let best: { id: number; members: number } | null = null;
  for (const t of teams) if (!best || t.members < best.members) best = t;
  return best?.id ?? null;
}

/** "2nd", "11th", "23rd". */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** Is `nowMs` past the midpoint of the window (and not yet over)? Drives the halfway Discord post. */
export function pastHalfway(startIso: string, endIso: string, nowMs: number): boolean {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
  return nowMs >= a + (b - a) / 2 && nowMs < b;
}
