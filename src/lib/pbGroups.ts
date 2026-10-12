// Personal bests, grouped the way a player reads them. The game names a raid's times by mode and team
// size — "Chambers of Xeric Challenge Mode 5 Players", "Tombs of Amascut Expert Mode Solo" — so one
// raid is a dozen rows that differ only at the end. Here they fold into one entry per boss, a line per
// mode, and each team size as a chip on that line. Pure (tests/pure-module-imports).

export interface PbVariant {
  /** "Solo", "2", "11-15" — or "" for a time with no team size. */
  team: string;
  time: string;
  activity: string;
}

export interface PbMode {
  /** "", "Challenge Mode", "Expert Mode", "Hard Mode", "Entry Mode", "Awakened", … */
  mode: string;
  variants: PbVariant[];
}

export interface PbGroup {
  /** The boss or raid: "Chambers of Xeric". */
  base: string;
  modes: PbMode[];
}

const TEAM = /\s+(solo|(\d+(?:-\d+)?)\s+players?)$/i;
const MODE = /:?\s+(challenge mode|expert mode|hard mode|entry mode)$/i;
const PAREN = /\s*\(([^)]+)\)$/;

/** Split an activity name into the boss, its mode and its team size. */
export function parsePbActivity(activity: string): { base: string; mode: string; team: string } {
  let rest = activity.trim();
  let team = '';
  // A stored team size the site appended: "Something (3)".
  const n = rest.match(/\s*\((\d+)\)$/);
  if (n) {
    team = n[1] === '1' ? 'Solo' : n[1];
    rest = rest.slice(0, n.index).trim();
  }
  const t = team ? null : rest.match(TEAM);
  if (t) {
    team = t[2] ?? 'Solo';
    rest = rest.slice(0, t.index).trim();
  }
  let mode = '';
  const m = rest.match(MODE);
  if (m) {
    mode = m[1].replace(/\b\w/g, (c) => c.toUpperCase());
    rest = rest.slice(0, m.index).trim();
  } else {
    const p = rest.match(PAREN); // "Duke Sucellus (awakened)"
    if (p) {
      mode = p[1][0].toUpperCase() + p[1].slice(1);
      rest = rest.slice(0, p.index).trim();
    }
  }
  return { base: rest, mode, team };
}

function teamOrder(team: string): number {
  if (team === '') return -1;
  if (team.toLowerCase() === 'solo') return 1;
  return parseInt(team, 10) || 99;
}

/** "16:43.00" / "1:03:43.00" → seconds, for picking the fastest. */
export function timeSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return Number.POSITIVE_INFINITY;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** One row in the list: a boss in one mode ("Chambers of Xeric: Challenge Mode"), its best time first. */
export interface PbEntry {
  /** What the row says: the boss, with its mode when it has one. */
  name: string;
  /** The boss alone — what the icon is looked up by. */
  base: string;
  mode: string;
  /** The headline time: the overall best when the game keeps one, else the fastest team size. */
  best: string;
  /** Every team size, Solo first; empty when there's only the one time to show. */
  variants: PbVariant[];
}

function entryName(base: string, mode: string): string {
  if (!mode) return base;
  // "Awakened" reads as a version of the boss; the raid modes read as a mode of it.
  return /mode$/i.test(mode) ? `${base}: ${mode}` : `${base} (${mode})`;
}

/**
 * One entry per boss AND mode — a raid's Challenge Mode is its own row, an awakened boss its own row —
 * each showing its best time, with the team sizes behind it for whoever opens the row.
 */
export function personalBestEntries(bests: { activity: string; time: string }[]): PbEntry[] {
  const out: PbEntry[] = [];
  for (const group of groupPersonalBests(bests)) {
    for (const m of group.modes) {
      const overall = m.variants.find((v) => v.team === '');
      const fastest = [...m.variants].sort((a, b) => timeSeconds(a.time) - timeSeconds(b.time))[0];
      const teams = m.variants.filter((v) => v.team !== '');
      out.push({
        name: entryName(group.base, m.mode),
        base: group.base,
        mode: m.mode,
        best: (overall ?? fastest).time,
        variants: teams.length > 1 || (teams.length === 1 && overall) ? teams : [],
      });
    }
  }
  return out;
}

export function groupPersonalBests(bests: { activity: string; time: string }[]): PbGroup[] {
  const groups = new Map<string, Map<string, PbVariant[]>>();
  for (const b of bests) {
    const { base, mode, team } = parsePbActivity(b.activity);
    const modes = groups.get(base) ?? new Map<string, PbVariant[]>();
    const list = modes.get(mode) ?? [];
    list.push({ team, time: b.time, activity: b.activity });
    modes.set(mode, list);
    groups.set(base, modes);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([base, modes]) => ({
      base,
      // The normal mode first, then the harder ones alphabetically.
      modes: [...modes.entries()]
        .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
        .map(([mode, variants]) => ({ mode, variants: variants.sort((x, y) => teamOrder(x.team) - teamOrder(y.team)) })),
    }));
}
