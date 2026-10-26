import type { RosterOverview, RosterPersonOut, RosterSearchPage, RosterTeamOut, RosterTeamPage } from '@/lib/eventRoster';

import { type Action, type Color, type Node, button, card, col, gap, header, icon, muted, row, text } from './nodes';

// An event's Teams page in the plugin's side panel (was TeamsView.java): the teams ranked, a team's
// members, or players found by name — a page at a time (lib/eventRoster does the ranking and paging).
// The search box sits outside slot `roster`, so typing keeps its caret while the results reload.

export type RosterPage = RosterOverview | RosterTeamPage | RosterSearchPage;

/** Where the page is: the event, the team opened (0 = all), and the overview page to come back to. */
export interface TeamsState {
  event: number;
  team: number;
  page: number;
  back: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const swatch = (color: string | null, size: number): Node => icon({ glyph: 'swatch', color: (/^#[0-9a-f]{6}$/i.test(color ?? '') ? color : '#989898') as Color, w: size, h: size });
const load = (s: Partial<TeamsState> & { event: number }, q = ''): Action => ({
  a: 'load',
  v: 'teams',
  args: { event: String(s.event), team: String(s.team ?? 0), page: String(s.page ?? 1), back: String(s.back ?? 1), q, part: 'list' },
  into: 'roster',
});

/** "#2 · 12 tiles · 8 members" — what is known; the rank and score wait for the reveal. */
export function teamLine(t: RosterTeamOut): string {
  return [t.rank != null ? `#${t.rank}` : null, t.score, plural(t.members, 'member')].filter(Boolean).join(' · ');
}

/** The page with its search box; the results live in slot `roster`. */
export function teamsUi(data: RosterPage | null, s: TeamsState, q: string): Node {
  return col([
    muted('Search players'),
    gap(2),
    { t: 'input', name: 'q', kind: 'search', value: q, tip: 'Find a player on any team', on: load({ event: s.event }) },
    gap(8),
    { t: 'slot', id: 'roster', c: rosterUi(data, s) },
  ]);
}

/** The results under the search box. */
export function rosterUi(data: RosterPage | null, s: TeamsState): Node {
  if (!data) return col([text('Couldn’t load the teams.', 'error'), gap(6), button('Try again', load(s))]);
  const parts: Node[] = [];
  if (data.mode === 'teams') {
    if (!data.teams.length) {
      parts.push(muted(data.unplaced > 0 ? 'Teams haven’t been set yet.' : 'No teams yet.'));
      if (data.unplaced > 0) parts.push(muted(`${plural(data.unplaced, 'player')} signed up.`));
    } else {
      const yours = data.yourTeam;
      if (yours && !data.teams.some((t) => t.teamId === yours.teamId)) parts.push(header('Your team'), gap(3), teamRow(yours, s), gap(8));
      parts.push(header(plural(data.total, 'team'), data.unplaced > 0 ? `${data.unplaced} not placed` : null), gap(3));
      data.teams.forEach((t) => parts.push(teamRow(t, s), gap(2)));
    }
  } else if (data.mode === 'players') {
    if (!data.players.length) parts.push(muted('Nobody has signed up yet.'));
    else {
      if (data.you && !data.players.some((p) => p.you)) parts.push(header('You'), gap(3), personRow(data.you, true, false, s), gap(8));
      parts.push(header(plural(data.total, 'player')), gap(3));
      data.players.forEach((p) => parts.push(personRow(p, true, false, s), gap(2)));
    }
  } else if (data.mode === 'members') {
    const t = data.team;
    parts.push(text('‹ All teams', '#cdcdcd', { on: load({ event: s.event, page: s.back }) }), gap(6));
    parts.push(card([row(swatch(t.color, 10), text(t.name, 'white', { font: 'bold' }), undefined), gap(3), muted(teamLine(t))]), gap(8));
    if (!data.players.length) parts.push(muted('Nobody on this team yet.'));
    else {
      parts.push(header('Members'), gap(3));
      // A scored board sends each member's share (best first): shown like the ranked lists.
      data.players.forEach((p) => parts.push(personRow(p, p.rank != null, false, s), gap(2)));
    }
  } else {
    if (!data.players.length) parts.push(muted(`No players match "${data.query}".`));
    else {
      parts.push(header(plural(data.total, 'match', 'matches')), gap(3));
      data.players.forEach((p) => parts.push(personRow(p, false, true, s), gap(2)));
    }
  }
  if (data.pages > 1) {
    const q = data.mode === 'search' ? data.query : '';
    const at = (page: number) => load({ ...s, page }, q);
    parts.push(gap(6), row(
      { ...button('‹ Prev', at(data.page - 1), 'The previous page'), off: data.page <= 1 } as Node,
      muted(`${data.page} / ${data.pages}`, { align: 'c' }),
      { ...button('Next ›', at(data.page + 1), 'The next page'), off: data.page >= data.pages } as Node,
    ));
  }
  return col(parts);
}

function teamRow(t: RosterTeamOut, s: TeamsState): Node {
  return row(swatch(t.color, 8), col([text(t.name, t.yours ? 'brand' : 'white'), muted(teamLine(t))]), muted('›'), {
    pad: 5,
    inset: 6,
    tip: `${t.name} — see who's on it`,
    on: load({ event: s.event, team: t.teamId, back: s.team ? s.back : s.page }),
  });
}

/**
 * A person: rank (when ranked), name, and a second line — their score in a ranking, their team in a
 * search. The person looks them up; a search result's team line opens that team.
 */
function personRow(p: RosterPersonOut, ranked: boolean, showTeam: boolean, s: TeamsState): Node {
  const second = showTeam ? p.teamName ?? 'Not on a team yet' : ranked ? p.score : null;
  const openTeam = showTeam && p.teamId != null ? load({ event: s.event, team: p.teamId, back: 1 }) : undefined;
  const line = second
    ? muted(openTeam ? `${second} ›` : second, {
        ...(showTeam && p.teamColor ? { icon: swatch(p.teamColor, 6) } : {}),
        ...(openTeam ? { tip: `Open ${p.teamName}`, on: openTeam } : {}),
      })
    : null;
  const tag = p.captain && p.you ? 'Captain · you' : p.captain ? 'Captain' : p.you ? 'You' : null;
  return row(
    ranked ? text(p.rank == null ? '–' : `#${p.rank}`, p.rank != null && p.rank <= 3 ? 'brand' : 'muted', { w: 34 }) : undefined,
    col([text(p.name, p.you ? 'brand' : 'white'), ...(line ? [line] : [])]),
    tag ? text(tag, 'brand') : undefined,
    { pad: 4, inset: 6, tip: `Look up ${p.name}`, on: { a: 'lookup', rsn: p.name } },
  );
}
