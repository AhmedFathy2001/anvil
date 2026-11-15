// One row for anything a clan runs: a board event or a weekly competition, running, scheduled or
// finished.
//
// The events page used to draw boards as small cards and weeklies as a card inside a frame, each
// frame repeating "This week" — two looks for one kind of thing. Every list now draws the same
// row, and this is where a board or a week is reduced to what that row says: what it is, what is
// measured, who is in it, who leads and by how much, and when it ends.
//
// Only what the caller already loaded: a summary never asks for more, and whatever the loaders
// held back (hidden standings, a clan-vs-clan board this viewer may not read) stays held back,
// because it never reaches here.
//
// Pure (no `@/` imports), so tests/competition-rows.test.ts runs without a database.

import { parseStamp } from './dbTime.ts';
import { START_WAITING_WORDS } from './eventStage.ts';

export type RowState = 'live' | 'upcoming' | 'past';

export interface CompetitionRowSummary {
  /** Unique across boards and weeks: `e<id>` or `w<id>`. */
  key: string;
  /** A hub kind key (lib/hubKinds): 'classic', 'race', 'sotw', 'botw', ... */
  kind: string;
  group: 'boards' | 'weeks';
  href: string;
  title: string;
  state: RowState;
  /** What it is and who is in it, most important first: 'Fishing XP', '22 entered', 'Teams'. */
  meta: string[];
  /** Leader while it runs, winner once done; the figure belongs right next to the name. */
  leader: { label: 'Leading' | 'Won by'; name: string; figure: string; color: string | null } | null;
  /** Said in the leader's place when there is none. Null = say nothing (it has not started). */
  noLeader: string | null;
  /** The viewer's own part in it: 'Your team: Red Dragons'. Null when they are not in it, or for a
      week (its "You're in" is the row's own control). Never a place: the list has one standing per
      board, the leader, and a board that hides its standings hands over none. */
  yours: string | null;
  startDate: string | null;
  endDate: string | null;
  /** The start time came but the event is waiting on teams (lib/eventStage startIsHeld). */
  startHeld: boolean;
  /** The competition's own picture (an event's icon or its clan's logo). */
  pictureUrl: string | null;
  /** The metric's sprite (a skill or a boss). */
  iconUrl: string | null;
}

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));

const whole = (n: number) => Math.round(n).toLocaleString('en-US');

/** The number a week is won by, written the way that metric is read. */
export function weeklyValueText(unit: string, value: number): string {
  if (unit === 'h') return `${(value / 1000).toFixed(1)}h`;
  if (unit === 'KC') return `${whole(value)} KC`;
  return `${short(value)} XP`;
}

export interface WeeklyRowInput {
  id: number;
  kind: string;
  name: string;
  metricLabel: string;
  iconUrl: string | null;
  state: RowState;
  startDate: string;
  endDate: string;
  entrants: number;
  unit: string;
  top: { rsn: string; value: number; tied: boolean } | null;
  /** 'solo' | 'teams' | 'clans'. */
  mode?: string | null;
  /** Set when another clan hosts this clan-vs-clan week. */
  hostName?: string | null;
}

/** 'Fishing XP', 'Vorkath KC'; an efficiency race's label already says hours. */
function measured(metricLabel: string, unit: string): string {
  return unit === 'h' ? metricLabel : `${metricLabel} ${unit}`;
}

function noLeaderWords(state: RowState): string | null {
  return state === 'live' ? 'Nobody has scored yet' : state === 'past' ? 'No winner' : null;
}

export function weeklyRow(w: WeeklyRowInput): CompetitionRowSummary {
  const meta = [measured(w.metricLabel, w.unit), `${w.entrants} entered`];
  // Who it is against, once: the host's name is all the list knows about the other side.
  if (w.hostName) meta.push(`Clan vs clan, ${w.hostName} hosts`);
  else if (w.mode === 'clans') meta.push('Clan vs clan');
  else if (w.mode === 'teams') meta.push('In teams');
  return {
    key: `w${w.id}`,
    kind: w.kind,
    group: 'weeks',
    href: `/weekly/${w.id}`,
    title: w.name,
    state: w.state,
    meta,
    leader: w.top
      ? {
          label: w.state === 'past' ? 'Won by' : 'Leading',
          name: w.top.tied ? `${w.top.rsn} (tied)` : w.top.rsn,
          figure: weeklyValueText(w.unit, w.top.value),
          color: null,
        }
      : null,
    noLeader: w.top ? null : noLeaderWords(w.state),
    yours: null,
    startDate: w.startDate,
    endDate: w.endDate,
    startHeld: false,
    pictureUrl: null,
    iconUrl: w.iconUrl,
  };
}

export interface BoardRowInput {
  id: number;
  name: string;
  shape: string;
  /** '4 teams' or '16 players' first when there are any, then '20 claimed', 'co-hosted · slug'. */
  chips: string[];
  status: RowState;
  top: { name: string; color: string; score: number; total: number; unit: string } | null;
  foot: string;
  startDate: string | null;
  endDate: string | null;
  mode: string;
  iconUrl: string | null;
}

/** The viewer's part in a board event (lib/viewerEvents). */
export interface BoardViewer {
  teamNames: string[];
  signedUp: boolean;
}

function yoursWords(v: BoardViewer, individuals: boolean): string | null {
  if (v.teamNames.length > 0) {
    // A players board gives everyone a team of one, named after them.
    if (individuals) return `Playing as ${v.teamNames.join(', ')}`;
    return `${v.teamNames.length === 1 ? 'Your team' : 'Your teams'}: ${v.teamNames.join(', ')}`;
  }
  return v.signedUp ? 'You are signed up' : null;
}

export function boardRow(b: BoardRowInput, viewer?: BoardViewer | null): CompetitionRowSummary {
  const hasEntrants = /^\d+ (team|player)/.test(b.chips[0] ?? '');
  const meta = [b.shape, ...(hasEntrants ? [] : ['No teams yet']), ...b.chips];
  return {
    key: `e${b.id}`,
    kind: b.mode,
    group: 'boards',
    href: `/events/${b.id}`,
    title: b.name,
    state: b.status,
    meta,
    leader: b.top
      ? {
          label: b.status === 'past' ? 'Won by' : 'Leading',
          name: b.top.name,
          // "8 of 25 tiles" while it runs: the figure alone does not say how far along the board is.
          figure:
            b.status === 'live' && b.top.total > 0
              ? `${whole(b.top.score)} of ${whole(b.top.total)} ${b.top.unit}`
              : `${whole(b.top.score)} ${b.top.unit}`,
          color: b.top.color,
        }
      : null,
    noLeader: b.top ? null : noLeaderWords(b.status),
    yours: viewer ? yoursWords(viewer, /^\d+ player/.test(b.chips[0] ?? '')) : null,
    startDate: b.startDate,
    endDate: b.endDate,
    startHeld: b.status === 'upcoming' && b.foot === START_WAITING_WORDS,
    pictureUrl: b.iconUrl,
    iconUrl: null,
  };
}

export interface RecordRowInput {
  key: string;
  kind: string;
  group: 'boards' | 'weeks';
  name: string;
  href: string;
  startDate: string | null;
  endDate: string | null;
  state: RowState;
  entrants: number;
  entrantLabel: string;
  top: { name: string; text: string; color?: string } | null;
}

/** A line of the record (lib/eventsHub HubItem) as the same row. */
export function recordRow(i: RecordRowInput): CompetitionRowSummary {
  const label = i.entrants === 1 && i.entrantLabel.endsWith('s') ? i.entrantLabel.slice(0, -1) : i.entrantLabel;
  return {
    key: i.key,
    kind: i.kind,
    group: i.group,
    href: i.href,
    title: i.name,
    state: i.state,
    meta: i.entrants > 0 ? [`${i.entrants} ${label}`] : [],
    leader: i.top
      ? { label: i.state === 'past' ? 'Won by' : 'Leading', name: i.top.name, figure: i.top.text, color: i.top.color ?? null }
      : null,
    noLeader: i.top ? null : noLeaderWords(i.state),
    yours: null,
    startDate: i.startDate,
    endDate: i.endDate,
    startHeld: false,
    pictureUrl: null,
    iconUrl: null,
  };
}

/** '5d 18h', '3h 20m', '12m': two units at most, never zero. */
export function spanText(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days >= 1) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours >= 1) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

export interface RowWhen {
  /** 'Ends in 5d 18h', 'Starts in 4d', 'No end date', 'Start is waiting on teams'. */
  text: string;
  /** The moment the text counts to, for the exact local time beside it. Null when there is none. */
  at: string | null;
}

/** When a running or scheduled row ends or starts. Null for a finished one: its dates say it. */
export function rowWhen(
  row: Pick<CompetitionRowSummary, 'state' | 'startDate' | 'endDate' | 'startHeld'>,
  now: number,
): RowWhen | null {
  if (row.state === 'past') return null;
  if (row.state === 'upcoming') {
    if (row.startHeld) return { text: START_WAITING_WORDS, at: null };
    const start = parseStamp(row.startDate);
    if (start === null) return { text: 'Not scheduled yet', at: null };
    return start > now ? { text: `Starts in ${spanText(start - now)}`, at: row.startDate } : { text: 'Due to start', at: row.startDate };
  }
  const end = parseStamp(row.endDate);
  if (end === null) return { text: 'No end date', at: null };
  return end > now ? { text: `Ends in ${spanText(end - now)}`, at: row.endDate } : { text: 'Ending now', at: row.endDate };
}

const LAST = Number.MAX_SAFE_INTEGER;

/** Soonest to end first; a board with no end date goes last. Ties keep boards before weeks. */
function byEnd(a: CompetitionRowSummary, b: CompetitionRowSummary): number {
  return (parseStamp(a.endDate) ?? LAST) - (parseStamp(b.endDate) ?? LAST) || a.key.localeCompare(b.key);
}

/** Soonest to start first; an unscheduled one goes last. */
function byStart(a: CompetitionRowSummary, b: CompetitionRowSummary): number {
  return (parseStamp(a.startDate) ?? LAST) - (parseStamp(b.startDate) ?? LAST) || a.key.localeCompare(b.key);
}

export interface RowSections {
  /** What the viewer is entered in: running first, then scheduled. */
  mine: CompetitionRowSummary[];
  /** Everything else that is running. */
  running: CompetitionRowSummary[];
  /** Everything else that is scheduled. */
  upNext: CompetitionRowSummary[];
}

/**
 * The page's order: the viewer's own first, then the rest running, then what is next.
 * Every row lands in exactly one section; nothing is dropped. Finished rows are not for here.
 */
export function sectionRows(rows: CompetitionRowSummary[], mineKeys: ReadonlySet<string>): RowSections {
  const open = rows.filter((r) => r.state !== 'past');
  const live = open.filter((r) => r.state === 'live').sort(byEnd);
  const upcoming = open.filter((r) => r.state === 'upcoming').sort(byStart);
  return {
    mine: [...live, ...upcoming].filter((r) => mineKeys.has(r.key)),
    running: live.filter((r) => !mineKeys.has(r.key)),
    upNext: upcoming.filter((r) => !mineKeys.has(r.key)),
  };
}

/** "2 events and 3 competitions" needs the two counted apart (lib/runningCount). */
export function countRows(rows: readonly CompetitionRowSummary[]): { events: number; competitions: number } {
  const competitions = rows.filter((r) => r.group === 'weeks').length;
  return { events: rows.length - competitions, competitions };
}
