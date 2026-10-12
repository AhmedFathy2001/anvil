import type { PlayerCard } from '@/lib/playerCardShape';
import type { ClanCard } from '@/lib/clanCard';

// Two of a thing, side by side: the shareable /compare pages.
//
// The cards already say everything worth saying about one character or one clan — the plugin draws
// them, and /compare reuses the exact same loaders so a comparison can never disagree with the
// profile it links to. All this module decides is how two of them line up: who leads each number,
// which differences are the interesting ones, and in what order to tell them.
//
// Pure on purpose (type-only imports — clanCard itself reaches for the database): the pages load,
// this compares, and a test can drive every rule here without a DATABASE_URL.
//
// UNKNOWN IS NOT ZERO. A character the hiscores sweep has not reached yet has no total level, and a
// clan where nobody has synced their log has no average. Calling either a zero would hand the other
// side a "lead" it never earned, so a missing value on either side means NO leader for that row —
// the page shows a dash and colours nothing.

export type Leader = 'a' | 'b' | 'tie';

/** How a headline number should be written — the page formats, this only says which kind it is. */
export type CompareFormat = 'int' | 'xp' | 'hours';

export interface CompareRow {
  label: string;
  a: number | null;
  b: number | null;
  /** Null when either side is unknown: an unknown cannot lose, and cannot win either. */
  leader: Leader | null;
  format: CompareFormat;
}

export interface SkillDiff {
  key: string;
  levelA: number | null;
  levelB: number | null;
  xpA: number | null;
  xpB: number | null;
  /** By level first, then xp — two 99s are told apart by who is further past it. */
  leader: Leader | null;
}

export interface BossDiff {
  key: string;
  label: string;
  /** Null when that side has no hiscores at all; 0 when tracked and simply never killed. */
  kcA: number | null;
  kcB: number | null;
  leader: Leader | null;
}

export interface LogPageDiff {
  name: string;
  total: number;
  a: number;
  b: number;
  iconItemId: number | null;
  leader: Leader;
}

export interface PlayerComparison {
  headline: CompareRow[];
  skills: SkillDiff[];
  bosses: BossDiff[];
  /** Only pages whose counts differ, biggest gap first. Empty unless BOTH logs are synced. */
  logPages: LogPageDiff[];
  /** "a ahead in N skills, b ahead in M" — the one-line verdict above the skills table. */
  skillsAhead: { a: number; b: number; tied: number };
}

export interface ClanComparison {
  headline: CompareRow[];
}

/** Higher wins. Either side unknown ⇒ no leader at all. */
export function leaderOf(a: number | null | undefined, b: number | null | undefined): Leader | null {
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  if (a > b) return 'a';
  if (b > a) return 'b';
  return 'tie';
}

function row(label: string, a: number | null, b: number | null, format: CompareFormat = 'int'): CompareRow {
  return { label, a, b, leader: leaderOf(a, b), format };
}

/**
 * Total XP as the profile page reads it: the hiscores overall when there is one, otherwise the sum of
 * the skills the plugin pushed. Null only when there is neither.
 */
function totalXp(c: PlayerCard): number | null {
  if (c.overallXp != null) return c.overallXp;
  if (c.skills.length > 0) return c.skills.reduce((sum, s) => sum + s.xp, 0);
  return null;
}

/** No skills and no bosses means the sweep has not seen this character — not that it killed nothing. */
function hasStats(c: PlayerCard): boolean {
  return c.skills.length > 0 || c.bosses.length > 0 || c.totalLevel > 0;
}

export function comparePlayers(a: PlayerCard, b: PlayerCard): PlayerComparison {
  const headline: CompareRow[] = [
    // A total level of 0 is the shape's way of saying "no hiscores yet" — nobody's real total is 0.
    row('Total level', a.totalLevel > 0 ? a.totalLevel : null, b.totalLevel > 0 ? b.totalLevel : null),
    row('Combat', a.combatLevel, b.combatLevel),
    row('Total XP', totalXp(a), totalXp(b), 'xp'),
    row('EHP', a.ehp, b.ehp, 'hours'),
    row('EHB', a.ehb, b.ehb, 'hours'),
    row('Log slots', a.clog?.obtained ?? null, b.clog?.obtained ?? null),
  ];

  // ---- Skills: the union, so a skill one side has and the other hasn't still shows. ----
  const skillA = new Map(a.skills.map((s) => [s.key, s]));
  const skillB = new Map(b.skills.map((s) => [s.key, s]));
  const skillKeys = [...new Set([...a.skills.map((s) => s.key), ...b.skills.map((s) => s.key)])];
  const skills: SkillDiff[] = skillKeys.map((key) => {
    const sa = skillA.get(key);
    const sb = skillB.get(key);
    const levelA = sa?.level ?? null;
    const levelB = sb?.level ?? null;
    const byLevel = leaderOf(levelA, levelB);
    return {
      key,
      levelA,
      levelB,
      xpA: sa?.xp ?? null,
      xpB: sb?.xp ?? null,
      leader: byLevel === 'tie' ? leaderOf(sa?.xp, sb?.xp) : byLevel,
    };
  });
  const gap = (x: number | null, y: number | null) => (x != null && y != null ? Math.abs(x - y) : -1);
  // Biggest level gap first; between equal gaps (two 99s, most often) the bigger xp gap. A skill only
  // one side has sorts last — there is no gap to measure. Stable, so ties keep the game's order.
  skills.sort(
    (x, y) => gap(y.levelA, y.levelB) - gap(x.levelA, x.levelB) || gap(y.xpA, y.xpB) - gap(x.xpA, x.xpB),
  );

  const skillsAhead = { a: 0, b: 0, tied: 0 };
  for (const s of skills) {
    if (s.leader === 'a') skillsAhead.a++;
    else if (s.leader === 'b') skillsAhead.b++;
    else if (s.leader === 'tie') skillsAhead.tied++;
  }

  // ---- Bosses: the union by key. The card lists only bosses with a kill, so absent means 0 — unless
  // that side has no hiscores at all, in which case it means "unknown". ----
  const aTracked = hasStats(a);
  const bTracked = hasStats(b);
  const kcA = new Map(a.bosses.map((x) => [x.key, x]));
  const kcB = new Map(b.bosses.map((x) => [x.key, x]));
  const bossKeys = [...new Set([...a.bosses.map((x) => x.key), ...b.bosses.map((x) => x.key)])];
  const bosses: BossDiff[] = bossKeys.map((key) => {
    const ka = kcA.get(key)?.kc ?? (aTracked ? 0 : null);
    const kb = kcB.get(key)?.kc ?? (bTracked ? 0 : null);
    return {
      key,
      label: kcA.get(key)?.label ?? kcB.get(key)?.label ?? key,
      kcA: ka,
      kcB: kb,
      leader: leaderOf(ka, kb),
    };
  });
  bosses.sort((x, y) => Math.max(y.kcA ?? 0, y.kcB ?? 0) - Math.max(x.kcA ?? 0, x.kcB ?? 0) || x.label.localeCompare(y.label));

  // ---- Log pages: only when both logs are synced. An unsynced log is not an empty one, and listing
  // every page as "you have 0" would be the zero-vs-unknown mistake on a much larger scale. ----
  const logPages: LogPageDiff[] = [];
  if (a.clog && b.clog) {
    const pageA = new Map(a.clogPages.map((p) => [p.name, p]));
    const pageB = new Map(b.clogPages.map((p) => [p.name, p]));
    const names = [...new Set([...pageA.keys(), ...pageB.keys()])];
    for (const name of names) {
      const pa = pageA.get(name);
      const pb = pageB.get(name);
      const oa = pa?.obtained ?? 0;
      const ob = pb?.obtained ?? 0;
      if (oa === ob) continue;
      logPages.push({
        name,
        total: pa?.total ?? pb?.total ?? 0,
        a: oa,
        b: ob,
        iconItemId: pa?.iconItemId ?? pb?.iconItemId ?? null,
        leader: oa > ob ? 'a' : 'b',
      });
    }
    logPages.sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b) || x.name.localeCompare(y.name));
  }

  return { headline, skills, bosses, logPages, skillsAhead };
}

export function compareClans(a: ClanCard, b: ClanCard): ClanComparison {
  return {
    headline: [
      row('Members', a.members, b.members),
      row('Active this week', a.activeThisWeek, b.activeThisWeek),
      row('Total EHP', a.totalEhp, b.totalEhp, 'hours'),
      row('Total EHB', a.totalEhb, b.totalEhb, 'hours'),
      // Null when nobody in the clan has synced — no average, not an average of zero.
      row('Average log', a.clog?.average ?? null, b.clog?.average ?? null),
    ],
  };
}

/** "512.3M", "4.61B", "12.5K" — the profile page's compact XP. */
export function compactNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}

/** One headline value as the page writes it; a dash for unknown. */
export function formatCompareValue(value: number | null, format: CompareFormat): string {
  if (value == null) return '—';
  switch (format) {
    case 'xp':
      return compactNumber(value);
    case 'hours':
      return value.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    default:
      return value.toLocaleString('en-US');
  }
}

/**
 * Read one name off the query string the way the card route reads one off its path: trimmed, an
 * RSN-sized string or nothing. A repeated `?a=` takes the first.
 */
export function queryName(v: string | string[] | undefined, maxLength = 12): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = raw?.trim();
  if (!s || s.length > maxLength) return null;
  return s;
}
