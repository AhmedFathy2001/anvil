// Who is on which team, a page at a time — the plugin's Teams page (api/plugin/event/[id]/roster).
//
// An event can be two teams of five, ten teams of 120, or 1,200 teams of one, so nothing here ever
// returns the whole roster. Three reads, each paged:
//
//   overview  the teams ranked by score, each with a member count — or, when every team is one
//             person (or the event ranks individuals), the PLAYERS ranked instead: a list of 300
//             one-member teams is a player list wearing a costume.
//   team      one team's members: best score first once the board is scored (each member's share,
//             lib/teamMemberPoints), else captain first, then you, then by name.
//   search    players by name across every team, each with the team they are on.
//
// Pure, no `@/` import, so it is tested directly (tests/event-roster.test.ts); the route loads rows.

import { competitionRanks, isManyTeams, standingsWindow, type StandingsWindow, type WindowOpts } from './standingsWindow';

export const ROSTER_PAGE_SIZE = 25;
export const ROSTER_MAX_PAGE_SIZE = 50;

export interface RosterTeamIn {
  teamId: number;
  name: string;
  color: string;
  /** Null before the tiles are revealed: there is nothing to score yet. */
  score: number | null;
  /** "12 tiles", "340 pts (+20 bonus)". */
  scoreText: string | null;
  /** players.id of the captain, when the team has one. */
  captainPlayerId: number | null;
  /**
   * A rank already worked out on the server (a tile race: first to the finish, then steps, then who
   * got there first — lib/raceRoutesDb raceStandingsForEvent). Set, it replaces the score ranking.
   */
  rank?: number | null;
}

export interface RosterPersonIn {
  participantId: number;
  name: string;
  teamId: number | null;
  /** players.id — the person behind the account. Null for an unlinked row. */
  playerId: number | null;
}

export interface RosterInput {
  teams: RosterTeamIn[];
  people: RosterPersonIn[];
  /** players.id of whoever is asking; null when signed out. */
  viewerPlayerId: number | null;
  /** The event ranks individuals (a ladder) rather than teams. */
  individuals: boolean;
  /** Solo placement (lib/standingsWindow isSoloLike): the people are what is ranked, whatever the team sizes. */
  solo?: boolean;
  /** Individual events: points per participant, best first. Ranked players lead the list in this order. */
  individualPoints?: { participantId: number; name: string; points: number }[];
  /** A team's page: each member's share of the team's score (participantId → points), and its unit. */
  memberPoints?: Map<number, number>;
  pointsUnit?: string;
}

export interface RosterTeamOut {
  teamId: number;
  name: string;
  color: string;
  rank: number | null;
  score: string | null;
  members: number;
  yours: boolean;
  /** Places climbed since the day began (lib/rankMoves); absent or null = unchanged or unknown. */
  move?: number | null;
}

export interface RosterPersonOut {
  name: string;
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  rank: number | null;
  score: string | null;
  captain: boolean;
  you: boolean;
  /** Places climbed since the day began (lib/rankMoves); absent or null = unchanged or unknown. */
  move?: number | null;
  /** Their weekly activity streak (lib/activityStreaks), when on one. */
  streak?: number;
}

interface Paged {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

export type RosterOverview =
  | (Paged & {
      mode: 'teams';
      teams: RosterTeamOut[];
      yourTeam: RosterTeamOut | null;
      unplaced: number;
      /** Asked for, on a board of many teams (lib/standingsWindow isManyTeams): the top, then the viewer's team(s) with neighbours. */
      window?: StandingsWindow<RosterTeamOut>;
    })
  | (Paged & {
      mode: 'players';
      players: RosterPersonOut[];
      you: RosterPersonOut | null;
      /** Every line of the viewer's (one per account on the board), in standing order. */
      yours: RosterPersonOut[];
      /** Asked for: the top, then the viewer's lines with their neighbours (lib/standingsWindow). */
      window?: StandingsWindow<RosterPersonOut>;
    });

export type RosterTeamPage = Paged & { mode: 'members'; team: RosterTeamOut; players: RosterPersonOut[] };
/** `ranked`: a players board — each hit carries its standing rather than its (one-person) team. */
export type RosterSearchPage = Paged & {
  mode: 'search';
  query: string;
  players: RosterPersonOut[];
  ranked?: boolean;
  /** A many-teams board: teams whose own name matches too (the first few, best first). */
  teams?: RosterTeamOut[];
};

/** Teams matched by name that a search shows above the players it found. */
export const SEARCH_TEAMS_SHOWN = 5;

/** A 1-based page number and a size, from untrusted query params. */
export function pageParams(page: string | null, size: string | null): { page: number; pageSize: number } {
  const p = Math.floor(Number(page));
  const s = Math.floor(Number(size));
  return {
    page: Number.isFinite(p) && p >= 1 ? p : 1,
    pageSize: Number.isFinite(s) && s >= 1 ? Math.min(s, ROSTER_MAX_PAGE_SIZE) : ROSTER_PAGE_SIZE,
  };
}

function slice<T>(all: T[], page: number, pageSize: number): Paged & { items: T[] } {
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const p = Math.min(page, pages);
  return { page: p, pageSize, total: all.length, pages, items: all.slice((p - 1) * pageSize, p * pageSize) };
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/** Competition ranking: ties share a rank, the next rank skips ("1, 2, 2, 4"). Null scores rank nothing. */
const ranks = competitionRanks;

class Roster {
  private readonly teamById = new Map<number, RosterTeamIn>();
  private readonly teamRank: Map<RosterTeamIn, number>;
  private readonly membersOf = new Map<number, RosterPersonIn[]>();

  constructor(private readonly input: RosterInput) {
    for (const t of input.teams) this.teamById.set(t.teamId, t);
    // A race hands its ranks in, so the roster never re-ranks by score and then by name.
    this.teamRank = input.teams.some((t) => t.rank != null)
      ? new Map(input.teams.filter((t) => t.rank != null).map((t) => [t, t.rank!]))
      : ranks(input.teams, (t) => t.score);
    for (const p of input.people) {
      if (p.teamId == null || !this.teamById.has(p.teamId)) continue;
      const list = this.membersOf.get(p.teamId) ?? [];
      list.push(p);
      this.membersOf.set(p.teamId, list);
    }
  }

  private isYou(p: RosterPersonIn): boolean {
    return this.input.viewerPlayerId != null && p.playerId === this.input.viewerPlayerId;
  }

  private isCaptain(p: RosterPersonIn): boolean {
    const t = p.teamId != null ? this.teamById.get(p.teamId) : undefined;
    return !!t && t.captainPlayerId != null && p.playerId === t.captainPlayerId;
  }

  private yours: number | null | undefined;
  yourTeamId(): number | null {
    if (this.yours === undefined) {
      const me = this.input.people.find((p) => this.isYou(p) && p.teamId != null && this.teamById.has(p.teamId));
      this.yours = me?.teamId ?? null;
    }
    return this.yours;
  }

  private yourSet: Set<number> | undefined;
  /** Every team the viewer has an account on (rarely more than one). */
  yourTeamIds(): Set<number> {
    this.yourSet ??= new Set(
      this.input.people.filter((p) => this.isYou(p) && p.teamId != null && this.teamById.has(p.teamId)).map((p) => p.teamId!),
    );
    return this.yourSet;
  }

  team(t: RosterTeamIn): RosterTeamOut {
    return {
      teamId: t.teamId,
      name: t.name,
      color: t.color,
      rank: this.teamRank.get(t) ?? null,
      score: t.scoreText,
      members: this.membersOf.get(t.teamId)?.length ?? 0,
      yours: this.yourTeamIds().has(t.teamId),
    };
  }

  person(p: RosterPersonIn, rank: number | null = null, score: string | null = null): RosterPersonOut {
    const t = p.teamId != null ? this.teamById.get(p.teamId) : undefined;
    return {
      name: p.name,
      teamId: t?.teamId ?? null,
      teamName: t?.name ?? null,
      teamColor: t?.color ?? null,
      rank,
      score,
      captain: this.isCaptain(p),
      you: this.isYou(p),
    };
  }

  /** 12+ teams with people sharing them (lib/standingsWindow isManyTeams): cut, and searchable by team name. */
  manyTeams(): boolean {
    return !this.playersMode() && isManyTeams(null, this.input.teams.map((t) => this.membersOf.get(t.teamId)?.length ?? 0));
  }

  /** One-person teams, or an individual event: the people are what is ranked. */
  playersMode(): boolean {
    if (this.input.individuals || this.input.solo) return true;
    if (this.input.teams.length === 0) return false;
    return [...this.membersOf.values()].every((m) => m.length <= 1);
  }

  /** One player with their standing: their own on a ladder, their (one-person) team's otherwise. */
  standing(p: RosterPersonIn): RosterPersonOut {
    if (this.input.individuals) {
      const standings = this.input.individualPoints ?? [];
      const s = standings.find((x) => x.participantId === p.participantId);
      if (!s) return this.person(p);
      return this.person(p, ranks(standings, (x) => x.points).get(s) ?? null, `${Math.round(s.points)} pts`);
    }
    const t = p.teamId != null ? this.teamById.get(p.teamId) : undefined;
    return t ? this.person(p, this.teamRank.get(t) ?? null, t.scoreText) : this.person(p);
  }

  /** Every player in standing order: ranked first, then the rest by name. */
  rankedPlayers(): RosterPersonOut[] {
    if (this.input.individuals) {
      const byId = new Map(this.input.people.map((p) => [p.participantId, p]));
      const standings = this.input.individualPoints ?? [];
      const rank = ranks(standings, (s) => s.points);
      const seen = new Set<number>();
      const ranked = standings.map((s) => {
        seen.add(s.participantId);
        const p = byId.get(s.participantId) ?? { participantId: s.participantId, name: s.name, teamId: null, playerId: null };
        return this.person({ ...p, name: s.name }, rank.get(s) ?? null, `${Math.round(s.points)} pts`);
      });
      // A per-person ladder rolls a person's alts into one standing; their other accounts are the
      // same human, not more players.
      const placedPeople = new Set(standings.map((s) => byId.get(s.participantId)?.playerId).filter((x) => x != null));
      const rest = this.input.people
        .filter((p) => !seen.has(p.participantId) && (p.playerId == null || !placedPeople.has(p.playerId)))
        .sort(byName)
        .map((p) => this.person(p));
      return [...ranked, ...rest];
    }
    const withTeam = this.input.people
      .filter((p) => p.teamId != null && this.teamById.has(p.teamId))
      .map((p) => ({ p, t: this.teamById.get(p.teamId!)! }));
    withTeam.sort((a, b) => (this.teamRank.get(a.t) ?? Infinity) - (this.teamRank.get(b.t) ?? Infinity) || byName(a.p, b.p));
    return withTeam.map(({ p, t }) => this.person(p, this.teamRank.get(t) ?? null, t.scoreText));
  }

  overview(page: number, pageSize: number, window?: WindowOpts): RosterOverview {
    if (this.playersMode()) {
      const all = this.rankedPlayers();
      const { items, ...paged } = slice(all, page, pageSize);
      const yours = all.filter((p) => p.you);
      return {
        mode: 'players',
        ...paged,
        players: items,
        you: yours[0] ?? null,
        yours,
        ...(window ? { window: standingsWindow(all, (p) => p.you, window) } : {}),
      };
    }
    const ordered = [...this.input.teams].sort(
      (a, b) => (this.teamRank.get(a) ?? Infinity) - (this.teamRank.get(b) ?? Infinity) || byName(a, b),
    );
    const { items, ...paged } = slice(ordered, page, pageSize);
    const yours = this.yourTeamId();
    const unplaced = this.input.people.filter((p) => p.teamId == null || !this.teamById.has(p.teamId)).length;
    return {
      mode: 'teams',
      ...paged,
      teams: items.map((t) => this.team(t)),
      yourTeam: yours != null ? this.team(this.teamById.get(yours)!) : null,
      unplaced,
      ...(window && this.manyTeams()
        ? { window: standingsWindow(ordered.map((x) => this.team(x)), (x) => x.yours, window) }
        : {}),
    };
  }

  members(teamId: number, page: number, pageSize: number): RosterTeamPage | null {
    const t = this.teamById.get(teamId);
    if (!t) return null;
    const order = (p: RosterPersonIn) => (this.isCaptain(p) ? 0 : this.isYou(p) ? 1 : 2);
    const pts = this.input.memberPoints;
    const unit = this.input.pointsUnit ?? 'pts';
    const scoreOf = (p: RosterPersonIn) => pts?.get(p.participantId) ?? 0;
    const members = this.membersOf.get(teamId) ?? [];
    // Scored board: best first, ranked within the team (ties share a rank), captain/you breaking ties.
    // Unscored (before the reveal): captain, you, then by name, as before.
    const all = pts
      ? [...members].sort((a, b) => scoreOf(b) - scoreOf(a) || order(a) - order(b) || byName(a, b))
      : [...members].sort((a, b) => order(a) - order(b) || byName(a, b));
    const rank = pts ? ranks(members, scoreOf) : null;
    const { items, ...paged } = slice(all, page, pageSize);
    return {
      mode: 'members',
      ...paged,
      team: this.team(t),
      players: items.map((p) =>
        rank ? this.person(p, rank.get(p) ?? null, `${Math.round(scoreOf(p)).toLocaleString('en-US')} ${unit}`) : this.person(p),
      ),
    };
  }

  search(query: string, page: number, pageSize: number): RosterSearchPage {
    const q = query.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    const hits = q
      ? this.input.people
          .filter((p) => p.name.toLowerCase().replace(/[\s_-]+/g, ' ').includes(q))
          .sort((a, b) => {
            // Names that START with the query first: typing "zez" should find "Zezima" before "Mezez".
            const sa = a.name.toLowerCase().replace(/[\s_-]+/g, ' ').startsWith(q) ? 0 : 1;
            const sb = b.name.toLowerCase().replace(/[\s_-]+/g, ' ').startsWith(q) ? 0 : 1;
            return sa - sb || byName(a, b);
          })
      : [];
    // A players board: each hit with its standing (a one-person team's name is the player's own).
    if (this.playersMode()) {
      const { items, ...paged } = slice(hits, page, pageSize);
      return { mode: 'search', query: query.trim(), ...paged, ranked: true, players: items.map((p) => this.standing(p)) };
    }
    const { items, ...paged } = slice(hits, page, pageSize);
    // A team board: a team's own name finds it too (on the first page only, so paging stays by player).
    const teams = q && paged.page === 1 && this.manyTeams()
      ? this.input.teams
          .filter((t) => t.name.toLowerCase().replace(/[\s_-]+/g, ' ').includes(q))
          .sort((a, b) => (this.teamRank.get(a) ?? Infinity) - (this.teamRank.get(b) ?? Infinity) || byName(a, b))
          .slice(0, SEARCH_TEAMS_SHOWN)
          .map((t) => this.team(t))
      : [];
    return { mode: 'search', query: query.trim(), ...paged, players: items.map((p) => this.person(p)), ...(teams.length ? { teams } : {}) };
  }
}

/** `window`: also cut the players list to the top and the viewer's neighbourhood (players boards only). */
export function rosterOverview(input: RosterInput, page: number, pageSize: number, window?: WindowOpts): RosterOverview {
  return new Roster(input).overview(page, pageSize, window);
}

export function rosterTeam(input: RosterInput, teamId: number, page: number, pageSize: number): RosterTeamPage | null {
  return new Roster(input).members(teamId, page, pageSize);
}

export function rosterSearch(input: RosterInput, query: string, page: number, pageSize: number): RosterSearchPage {
  return new Roster(input).search(query, page, pageSize);
}
