import type { SignupProfile } from '@/lib/signup';

/**
 * What a roster looks like, from the answers it already gave.
 *
 * Sign-up forms collect the bosses people run, the skills they train, how many hours a week they
 * play and when — and every one of those answers was only ever readable one card at a time. A
 * captain deciding who to pick, or a host looking at a finished draft, has no way to see the shape
 * of the whole group: where it's thin, whether anyone plays outside one timezone, how much time is
 * actually on the board.
 *
 * Pure and dependency-free (no `@/db`) so tests run it directly and both the war room and the team
 * page can call it with whatever profiles they already loaded.
 *
 * Everything here is SELF-REPORTED and frozen at sign-up. The UI says so; this module doesn't
 * pretend otherwise by dressing it up as measurement.
 */

/** The middle of a stated range, which is the only honest single number to take from one. */
export function hoursMidpoint(range: { min?: number; max?: number } | undefined): number {
  if (!range) return 0;
  const min = typeof range.min === 'number' && Number.isFinite(range.min) ? Math.max(0, range.min) : undefined;
  const max = typeof range.max === 'number' && Number.isFinite(range.max) ? Math.max(0, range.max) : undefined;
  if (min == null && max == null) return 0;
  if (min == null) return max!;
  if (max == null) return min;
  return (min + max) / 2;
}

export interface CoverageRow {
  /** BOSSES key (or skill name) as stored on the profile. */
  key: string;
  /** How many people on this roster named it. */
  count: number;
  /** Share of the roster, 0–100, for the bar. */
  pct: number;
}

export interface TimezoneRow {
  /** The stored offset label, e.g. "UTC+1", or null for people who didn't say. */
  tz: string | null;
  players: number;
  /** Their stated active hours per week, summed. */
  weeklyHours: number;
}

export interface RosterShape {
  /** How many profiles had anything in them at all — the denominator every share is taken over. */
  answered: number;
  /** Everyone counted, answered or not. */
  size: number;
  /** Bosses the roster runs, most-covered first. */
  bosses: CoverageRow[];
  /** Skills the roster trains, most-covered first. */
  skills: CoverageRow[];
  /** Where the roster plays, most-populated first; unstated last. */
  timezones: TimezoneRow[];
  /** Stated active hours per week across the roster, and the AFK hours beside it. */
  activeHoursPerWeek: number;
  afkHoursPerWeek: number;
  /** The busiest single person's stated active week — the scale every bar is drawn against. */
  busiestWeek: number;
}

function countInto(map: Map<string, number>, values: string[] | undefined): void {
  for (const v of values ?? []) map.set(v, (map.get(v) ?? 0) + 1);
}

function coverage(map: Map<string, number>, answered: number): CoverageRow[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count, pct: answered > 0 ? Math.round((count / answered) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Fold a roster's sign-up answers into the shape above. */
export function rosterShape(profiles: SignupProfile[]): RosterShape {
  const bosses = new Map<string, number>();
  const skills = new Map<string, number>();
  const tzPlayers = new Map<string, number>();
  const tzHours = new Map<string, number>();
  let answered = 0;
  let activeHoursPerWeek = 0;
  let afkHoursPerWeek = 0;
  let busiestWeek = 0;

  for (const profile of profiles) {
    const active = hoursMidpoint(profile.activeWeeklyHours);
    const afk = hoursMidpoint(profile.afkWeeklyHours);
    const said =
      (profile.bosses?.length ?? 0) > 0 ||
      (profile.skills?.length ?? 0) > 0 ||
      active > 0 ||
      afk > 0 ||
      !!profile.timezone;
    if (said) answered++;

    countInto(bosses, profile.bosses);
    countInto(skills, profile.skills);
    activeHoursPerWeek += active;
    afkHoursPerWeek += afk;
    busiestWeek = Math.max(busiestWeek, active);

    // Unstated is its own bucket rather than a silent drop: "four people didn't say" is a fact a
    // captain wants, and folding them into UTC would invent a roster that's covered when it isn't.
    const tz = profile.timezone ?? '';
    tzPlayers.set(tz, (tzPlayers.get(tz) ?? 0) + 1);
    tzHours.set(tz, (tzHours.get(tz) ?? 0) + active);
  }

  const timezones: TimezoneRow[] = [...tzPlayers.entries()]
    .map(([tz, players]) => ({
      tz: tz === '' ? null : tz,
      players,
      weeklyHours: Math.round(tzHours.get(tz) ?? 0),
    }))
    .sort((a, b) => {
      if ((a.tz === null) !== (b.tz === null)) return a.tz === null ? 1 : -1;
      return b.players - a.players || (a.tz ?? '').localeCompare(b.tz ?? '');
    });

  return {
    answered,
    size: profiles.length,
    bosses: coverage(bosses, answered),
    skills: coverage(skills, answered),
    timezones,
    activeHoursPerWeek: Math.round(activeHoursPerWeek),
    afkHoursPerWeek: Math.round(afkHoursPerWeek),
    busiestWeek: Math.round(busiestWeek),
  };
}

/**
 * Which of the bosses THIS BOARD asks about nobody on the roster runs.
 *
 * Coverage on its own only ever says what a roster has. The useful half is what it's missing, and
 * "missing" only means something against the board in front of them — a roster with no Nex is
 * fine until the board has three Nex tiles on it.
 */
export function coverageGaps(shape: RosterShape, boardBossKeys: string[]): string[] {
  const covered = new Set(shape.bosses.filter((b) => b.count > 0).map((b) => b.key));
  return [...new Set(boardBossKeys)].filter((key) => !covered.has(key)).sort();
}
