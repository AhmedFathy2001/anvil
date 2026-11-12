// Standings for a board with many entrants — a solo board of 170 players, each its own team — cut
// to what a person reads: the top few, a gap, then their own line with a couple of entrants either
// side; the rest is a paged list with a name search. Used by the site's scoreboard and the plugin
// panel (lib/eventRoster), so both cut the same list the same way.
//
// SOLO-LIKE: a board reads as PLAYERS rather than teams when the host chose solo placement and
// every entry still has one person, or when it has at least SOLO_MIN_TEAMS teams and none holds
// more than one person. A solo board can deliberately gain a shared entry through a team invite;
// once that happens its actual entries win over the setting and it reads as compact teams.
//
// MANY TEAMS: any other board with at least MANY_TEAMS_MIN teams (30 teams of 2–3, say) gets the
// same cut, worded as teams: the top five, the viewer's team(s) with two either side, the rest paged
// and searchable by team name or member name. Boards of 2–11 teams keep a card per team.
//
// Ranks are competition ranks (ties share a rank, the next skips: 1, 2, 2, 4) and are worked out
// ONCE, by the caller, before anything here cuts the list; within a tie the order is the caller's
// (best first, then name, the order lib/eventRoster uses).
//
// Pure, no `@/` import: tested directly (tests/standings-window.test.ts).

export const SOLO_MIN_TEAMS = 12;
export const WINDOW_TOP = 5;
export const WINDOW_AROUND = 2;
/** A person with several accounts on the board has several lines; this many are drawn, then "+N more". */
export const WINDOW_MAX_MINE = 3;
export const STANDINGS_PAGE_SIZE = 25;

/** Solo placement, or a big board of one-person teams. `teamSizes` = members per team. */
export function isSoloLike(placement: string | null | undefined, teamSizes: number[]): boolean {
  if (placement === 'solo') return teamSizes.every((n) => n <= 1);
  return teamSizes.length >= SOLO_MIN_TEAMS && teamSizes.every((n) => n <= 1);
}

export const MANY_TEAMS_MIN = SOLO_MIN_TEAMS;

/** Not a players board, but too many teams for a card each. */
export function isManyTeams(placement: string | null | undefined, teamSizes: number[]): boolean {
  // A mixed solo board must not expand into one card per entry just because it has fewer than the
  // usual large-board threshold. It keeps the compact standings, now truthfully worded as teams.
  if (placement === 'solo') return teamSizes.some((n) => n > 1);
  return !isSoloLike(placement, teamSizes) && teamSizes.length >= MANY_TEAMS_MIN;
}

/** How a board's standings are drawn: a card per team, or the cut list worded as players or teams. */
export type StandingsLayout = 'cards' | 'players' | 'teams';
export function standingsLayout(placement: string | null | undefined, teamSizes: number[]): StandingsLayout {
  return isSoloLike(placement, teamSizes) ? 'players' : isManyTeams(placement, teamSizes) ? 'teams' : 'cards';
}

/** Competition ranking over rows already sorted best first: ties share a rank. Null scores rank nothing. */
export function competitionRanks<T>(rows: T[], score: (r: T) => number | null): Map<T, number> {
  const out = new Map<T, number>();
  const scored = rows.filter((r) => score(r) != null).sort((a, b) => score(b)! - score(a)!);
  scored.forEach((r, i) => {
    const prev = scored[i - 1];
    out.set(r, prev && score(prev) === score(r) ? out.get(prev)! : i + 1);
  });
  return out;
}

export type WindowPart<T> = { kind: 'rows'; rows: T[] } | { kind: 'gap'; skipped: number };

export interface StandingsWindow<T> {
  parts: WindowPart<T>[];
  total: number;
  /** The viewer's own lines past the cap, not drawn: "+N more of yours". */
  mineMore: number;
  /** Every row is drawn: no gaps, nothing to page through. */
  complete: boolean;
}

export interface WindowOpts {
  top?: number;
  around?: number;
  maxMine?: number;
}

/**
 * The top `top`, then each of the viewer's lines (at most `maxMine`) with `around` either side,
 * merged where they touch or overlap, with a gap between runs. A gap of a single row is drawn
 * instead ("…1 more…" is longer than the row it hides). A trailing gap counts what's below.
 */
export function standingsWindow<T>(rows: T[], isMine: (r: T) => boolean, opts: WindowOpts = {}): StandingsWindow<T> {
  const top = opts.top ?? WINDOW_TOP;
  const around = opts.around ?? WINDOW_AROUND;
  const maxMine = opts.maxMine ?? WINDOW_MAX_MINE;
  const total = rows.length;

  const show = new Set<number>();
  for (let i = 0; i < Math.min(top, total); i++) show.add(i);
  const mine = rows.flatMap((r, i) => (isMine(r) ? [i] : []));
  for (const i of mine.slice(0, maxMine)) {
    for (let j = Math.max(0, i - around); j <= Math.min(total - 1, i + around); j++) show.add(j);
  }
  // Fill one-row holes, so a gap always hides at least two.
  for (let i = 1; i < total - 1; i++) if (!show.has(i) && show.has(i - 1) && show.has(i + 1)) show.add(i);
  // A single hidden row at the very end is drawn too.
  if (total >= 2 && !show.has(total - 1) && show.has(total - 2)) show.add(total - 1);

  const parts: WindowPart<T>[] = [];
  let run: T[] = [];
  let skipped = 0;
  for (let i = 0; i < total; i++) {
    if (show.has(i)) {
      if (skipped) parts.push({ kind: 'gap', skipped });
      skipped = 0;
      run.push(rows[i]);
    } else {
      if (run.length) parts.push({ kind: 'rows', rows: run });
      run = [];
      skipped++;
    }
  }
  if (run.length) parts.push({ kind: 'rows', rows: run });
  if (skipped) parts.push({ kind: 'gap', skipped });

  const drawn = new Set(parts.flatMap((p) => (p.kind === 'rows' ? p.rows : [])));
  return {
    parts,
    total,
    mineMore: mine.filter((i) => !drawn.has(rows[i])).length,
    complete: drawn.size === total,
  };
}

/** Names compared loosely: case, spaces, underscores and dashes don't matter (OSRS treats them alike). */
export const looseName = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, ' ').trim();

export interface StandingsPage<T> {
  rows: T[];
  page: number;
  pages: number;
  /** Rows matching the search (all rows without one). */
  matched: number;
}

/**
 * One page of the full list, in standing order, narrowed to rows with a name containing `query`.
 * `nameOf` may give several names (a team's own and its members'): any of them matching counts.
 */
export function standingsPage<T>(
  rows: T[],
  nameOf: (r: T) => string | string[],
  opts: { page?: number; pageSize?: number; query?: string } = {},
): StandingsPage<T> {
  const size = Math.max(1, opts.pageSize ?? STANDINGS_PAGE_SIZE);
  const q = looseName(opts.query ?? '');
  const names = (r: T) => {
    const n = nameOf(r);
    return typeof n === 'string' ? [n] : n;
  };
  const hits = q ? rows.filter((r) => names(r).some((n) => looseName(n).includes(q))) : rows;
  const pages = Math.max(1, Math.ceil(hits.length / size));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), pages);
  return { rows: hits.slice((page - 1) * size, page * size), page, pages, matched: hits.length };
}

// ---- Rank movement since the day began (lib/rankMoves reads the baselines) ----------------------

/** Places climbed since the baseline (positive up, negative down); null when unchanged or unknown. */
export function rankMove(before: number | null | undefined, now: number | null | undefined): number | null {
  if (before == null || now == null || before <= 0 || now <= 0 || before === now) return null;
  return before - now;
}

/** A day snapshot's teams ranked as the standings rank them (ties share a rank). */
export function teamRanksFromDay(data: unknown): Map<number, number> {
  const teams = (data as { teams?: Record<string, { score?: number }> } | null)?.teams ?? {};
  const rows = Object.entries(teams).map(([id, t]) => ({ id: Number(id), score: Number(t?.score ?? 0) }));
  const ranked = competitionRanks(rows, (r) => r.score);
  return new Map(rows.map((r) => [r.id, ranked.get(r) ?? 0]));
}
