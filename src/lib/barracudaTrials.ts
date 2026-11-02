// Sailing's Barracuda Trials: three courses, each awarding one of three ranks by completion time.
// The ranks are SEPARATE challenges (different routes, each with its own PB), so a trial bingo tile
// targets an exact course + rank ("Gwenith Glide — Marlin") and is gated on the RANK the game reports
// — never a time cap (a Shark run is not a slow Marlin run). Kept in one place so the tile-authoring
// suggestions, the plugin config, and the submission-completion gate all agree.

export const TRIAL_COURSES = ['tempor tantrum', 'jubbly jive', 'gwenith glide'] as const;
export const TRIAL_RANKS = ['swordfish', 'shark', 'marlin'] as const;

const COURSE_LABELS: Record<string, string> = {
  'tempor tantrum': 'Tempor Tantrum',
  'jubbly jive': 'Jubbly Jive',
  'gwenith glide': 'Gwenith Glide',
};
const RANK_LABELS: Record<string, string> = {
  swordfish: 'Swordfish',
  shark: 'Shark',
  marlin: 'Marlin',
};

// Sailing level each course unlocks at. The ranks on a course unlock in order (Swordfish → Shark →
// Marlin) by beating the previous one, not by level — so the level gate is per course only.
export const TRIAL_COURSE_LEVELS: Record<(typeof TRIAL_COURSES)[number], number> = {
  'tempor tantrum': 30,
  'jubbly jive': 55,
  'gwenith glide': 72,
};

export interface TrialRankOption {
  /** The tile's timedActivity string, e.g. "Gwenith Glide — Marlin". */
  activity: string;
  course: string;
  rank: string;
  /** Sailing level the course unlocks at. */
  level: number;
}

/** Every course × rank combo, in course-then-rank order, with the course's Sailing level. */
export const TRIAL_RANK_OPTIONS: TrialRankOption[] = TRIAL_COURSES.flatMap((c) =>
  TRIAL_RANKS.map((r) => ({
    activity: `${COURSE_LABELS[c]} — ${RANK_LABELS[r]}`,
    course: COURSE_LABELS[c],
    rank: RANK_LABELS[r],
    level: TRIAL_COURSE_LEVELS[c],
  })),
);

/** The nine "Course — Rank" activity strings offered in the timed-tile activity picker. */
export const TRIAL_RANK_ACTIVITIES: string[] = TRIAL_RANK_OPTIONS.map((o) => o.activity);

/**
 * Parse a timed-tile activity into its Barracuda Trials course + rank, or null if it isn't a rank
 * tile. Tolerant of the separator (em dash / hyphen / space) and a leading "The". Mirrors the
 * plugin's TimedClearParser.trialTileTarget so both ends agree on what counts as a rank tile.
 */
export function parseTrialRankTile(activity: string | null | undefined): { course: string; rank: string } | null {
  if (!activity) return null;
  const a = activity.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const rank of TRIAL_RANKS) {
    if (a.endsWith(' ' + rank)) {
      const course = a.slice(0, a.length - rank.length).trim();
      const match = TRIAL_COURSES.find((c) => course === c || course.endsWith(c));
      if (match) return { course: match, rank };
    }
  }
  return null;
}

/** Sailing level a trial rank tile's course needs, or null when the activity isn't a rank tile. */
export function trialRankLevel(activity: string | null | undefined): number | null {
  const t = parseTrialRankTile(activity);
  return t ? TRIAL_COURSE_LEVELS[t.course as (typeof TRIAL_COURSES)[number]] : null;
}
