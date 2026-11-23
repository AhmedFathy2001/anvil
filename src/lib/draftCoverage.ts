import { ABLE } from '@/lib/capability';
import { bossKeyForName } from '@/lib/capabilityData';
import { BOSSES } from '@/lib/constants';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Team coverage: for the hard content THIS board actually asks for, which teams have nobody able to
// do it. Strength bars can be level while one team has no one for the CM tiles — that's the gap a
// captain or admin can act on, and it never names a player or a rating (privacy: team-level only).
// PURE.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const BOSS_KEYS = new Set(BOSSES.map((b) => b.key));
const LABEL = new Map(BOSSES.map((b) => [b.key, b.label]));

interface TileLike {
  trackedStat?: string | null;
  timedActivity?: string | null;
  sourceNpcs?: string | null;
  label?: string | null;
}

/** Boss keys the board's tiles point at (KC stat, timed activity, drop sources). */
export function boardActivityKeys(tiles: TileLike[]): Set<string> {
  const out = new Set<string>();
  for (const t of tiles) {
    if (t.trackedStat && BOSS_KEYS.has(t.trackedStat)) out.add(t.trackedStat);
    const timed = bossKeyForName(t.timedActivity);
    if (timed) out.add(timed);
    if (t.sourceNpcs) {
      try {
        const names = JSON.parse(t.sourceNpcs);
        if (Array.isArray(names)) for (const n of names) {
          const k = bossKeyForName(String(n));
          if (k) out.add(k);
        }
      } catch {
        /* not JSON — ignore */
      }
    }
  }
  return out;
}

export interface CoverageGap {
  key: string;
  label: string;
  /** Teams with nobody able. */
  teamIds: number[];
  /** Able people still undrafted — the fix, when there is one. */
  ableInPool: number;
}

/**
 * Gaps only where it's fixable or worth knowing: some team HAS cover (so it's an imbalance, not a
 * board nobody can play), or someone able is still in the pool.
 */
export function coverageGaps(
  people: { teamId: number | null; abilities: Record<string, number> }[],
  teamIds: number[],
  boardKeys: Set<string>,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const key of boardKeys) {
    const able = people.filter((p) => (p.abilities[key] ?? 0) >= ABLE);
    if (!able.length) continue; // nobody at all can: a pricing problem, not a team one
    const covered = new Set(able.map((p) => p.teamId).filter((t): t is number => t != null));
    const missing = teamIds.filter((t) => !covered.has(t));
    if (!missing.length) continue;
    const ableInPool = able.filter((p) => p.teamId == null).length;
    if (covered.size === 0 && ableInPool === 0) continue;
    gaps.push({ key, label: LABEL.get(key) ?? key, teamIds: missing, ableInPool });
  }
  return gaps.sort((a, b) => b.teamIds.length - a.teamIds.length || a.label.localeCompare(b.label));
}

/** "Team B has nobody for CoX: CM" — one line per gap, team names resolved by the caller. */
export function describeGap(gap: CoverageGap, teamName: (id: number) => string): string {
  const names = gap.teamIds.map(teamName);
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${who} ${names.length === 1 ? 'has' : 'have'} nobody for ${gap.label}` +
    (gap.ableInPool > 0 ? ` (${gap.ableInPool} able player${gap.ableInPool === 1 ? '' : 's'} still in the pool).` : '.');
}
