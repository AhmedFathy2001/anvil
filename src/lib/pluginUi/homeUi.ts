import type { ActivityEntry } from '@/lib/pluginActivity';
import type { ClanEventView } from '@/lib/clanEvents';
import { CHANNEL_SLOT_LABELS, channelList } from '@/lib/clanEventChannels';
import { takesNames } from '@/lib/clanEventModules';
import { SKILLS } from '@/lib/constants';
import type { PanelActive, PanelTile } from '@/lib/pluginPanel';
import type { ScheduleBingo, ScheduleWeekly } from '@/lib/pluginConfig';
import type { RosterPersonOut, RosterTeamOut } from '@/lib/eventRoster';
import type { StandingsWindow } from '@/lib/standingsWindow';
import type { BoardSummary } from '@/lib/pluginBoards';

import { type Action, type Color, type Node, button, col, count, eventName, exact, gap, icon, muted, nameText, percent, row, text } from './nodes';
import { missionTileState } from '@/lib/tileState';
import { boardFeedLinks } from './feedUi';
import type { Board as RaceBoard, BoardContext } from './boardUi';
import { racePageUi } from './raceUi';
import { type PinRow, trackedCard } from './trackedUi';
import { ordinal } from '@/lib/raceSummary';
import { BLUE, CARD_W, CORAL, FAINT, GOLD, GREEN, PROGRESS, SOFT, big, cells, chip, clip, clock, compactStandings, goldCard, link, more, openRow, pageHead, section, small, standingsCard, stop, thin, title, withMove } from './sections';

// The plugin's Clan tab, built here (was the event list and event page in AnvilSidebarPanel, fed by
// AnvilSidebarDataSource/ConnectionView): the clan's events as cards, and one event's page — the
// board's summary, standings, what you've pinned, who's on what, missions, the team feed and the
// tiles nearest done; a weekly's standings; an upcoming bingo. Pure: views.ts gathers the data.

const NEAREST = 10;
const ACTIVITY_SHOWN = 12;
const EFFICIENCY_SCALE = 1000;
const IN_PROGRESS: Color = 'progress';
const SKILL_KEYS = new Set<string>(SKILLS);

export interface Mission {
  tileId: number;
  label: string;
  points: number;
  revealedAt: string | null;
  expiresAt?: string | null;
}

/** The config fields the Clan tab reads (the same answer /api/plugin/config gives this caller). */
export interface HomeConfig {
  clanName?: string | null;
  event?: {
    id: number;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    format?: string | null;
    scoringMode?: string | null;
    revealPolicy?: string | null;
    hiddenTileCount?: number;
    nextRevealAt?: string | null;
    decay?: { hours: number; targetPct: number } | null;
    missions?: Mission[];
    missionsLeft?: number;
    /** Missions shown as Locked before they drop — their names only. */
    lockedMissions?: { label: string }[];
    standings?: { yourRank: number } | null;
    monthlyStandings?: { yourRank: number; yourPoints: number } | null;
    /** A branching tile race (lib/raceRoutes): the "Your race" card. */
    race?: {
      steps: number; stepsDone: number; finished: boolean; mode: 'achieve' | 'choose';
      open: { tileId: number; label: string; road: string }[]; pickFrom: { tileId: number; label: string; road: string }[];
      rank: number | null; entrants: number; leaderSteps: number; atYourStep: number; ahead: number;
    } | null;
  } | null;
  board?: { tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null;
  homeBoard?: { eventId: number; eventName: string; tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null;
  /** Every live board this character is on, the addressed one first (X-Anvil-Boards, lib/pluginBoards). */
  boards?: BoardSummary[];
  unlinkedActiveEvent?: string | null;
  startProof?: unknown;
  panel?: { tiles?: PanelTile[]; activeNow?: PanelActive[]; scheduled?: ScheduleBingo[]; weeklies?: ScheduleWeekly[] };
  clans?: {
    slug: string;
    name: string | null;
    live: { kind?: string; eventId: number; eventName: string; tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null;
    liveCount?: number;
  }[];
  /** `kind` 'creator': a creator space (lib/creatorSpaces) — the tab speaks of it by name, not as "your clan". */
  activeClan?: { slug: string; name?: string | null; gameName?: string | null; kind?: string | null; boostLevel?: number } | null;
}

export interface WeeklyStanding {
  rank: number;
  rsn: string;
  gained: number;
  self: boolean;
  /** Places climbed since the UTC day began (lib/rankMoves); null = unchanged or unknown. */
  move?: number | null;
}

/** Everything the tab draws, gathered by the view. */
export interface HomeData {
  cfg: HomeConfig;
  /** Show the Support Anvil line: the viewer isn't a supporter (or isn't signed in). */
  supportCta?: boolean;
  /** The board is live for this character (a team on it, the clock running). */
  live: boolean;
  /** In game on a character with no team on the home board: it watches rather than plays. */
  inGame: boolean;
  feed: ActivityEntry[];
  standings: RosterTeamOut[];
  /**
   * A players board (solo placement, or a big board of one-person teams — lib/standingsWindow): the
   * standings cut to the top five and the caller's own line(s) with two either side, never the
   * whole list. Set, it replaces `standings`; "View all players" pages the rest with a search.
   */
  soloStandings?: StandingsWindow<RosterPersonOut> | null;
  /**
   * A board of many teams of any size (12+, lib/standingsWindow isManyTeams): the same cut, worded as
   * teams — top five, the caller's team(s) with two either side. Set, it replaces `standings`.
   */
  teamStandings?: StandingsWindow<RosterTeamOut> | null;
  /** Set while the host keeps the standings hidden (lib/standingsVisibility): the notice to show. */
  standingsNotice?: string | null;
  /** Live weeklies' boards by competition id: the caller's line and the top. */
  weekly: Map<number, { total: number; top: WeeklyStanding[]; you: WeeklyStanding | null }>;
  /** Tiles this client has pinned on the live board; null where it can't pin. */
  pins: number[] | null;
  /** Every pin with its name, board and count (views.ts pinRowsFor), this board's and the others'. */
  pinRows?: PinRow[];
  /** The member picked this clan rather than leaving it on Auto: no "Also live" then. */
  chosen: boolean;
  /** The clan's own card, already built (clanUi), or null. */
  ownClan: Node | null;
  /** Site path of the live board's page. */
  boardPath: string | null;
  /** The plugin opens a board's Feed / Chat on its Feed tab (load hasTabArgs). */
  feedTab?: boolean;
  /** The live board's chat is on (lib/eventChat boardChatOn). */
  chatOn?: boolean;
  /** Site path prefix for this clan (`/c/<slug>`), for weekly and event links. */
  clanPath: string;
  now: number;
  /** The clan's events (a mass, a hangout) in the next fortnight, soonest first (lib/clanEvents). */
  clanEvents?: ClanEventView[];
  /** Every OTHER live board this character is on, any clan (lib/pluginBoards). Absent = not looked up. */
  myBoards?: BoardSummary[];
  /** A tile race's whole board, for its page (lib/pluginUi/raceUi); only gathered when it's opened. */
  raceBoard?: { board: RaceBoard; ctx: BoardContext } | null;
}

// ---- Small words ----------------------------------------------------------------------------------

const ms = (iso: string | null | undefined) => {
  if (!iso) return -1;
  const t = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso.replace(' ', 'T') : `${iso.replace(' ', 'T')}Z`);
  return Number.isNaN(t) ? -1 : t;
};

/** "42m", "3h 10m", "2d 4h". */
export function minutesText(mins: number): string {
  return mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d ${Math.floor(mins / 60) % 24}h`;
}

function gapLabel(prefix: string, iso: string | null | undefined, passed: string, now: number): string | null {
  const at = ms(iso);
  if (at < 0) return null;
  const left = at - now;
  return left <= 0 ? passed : prefix + minutesText(Math.max(1, Math.floor(left / 60_000)));
}

/** When it starts if it hasn't, else when it ends. */
export const timingLabel = (upcoming: boolean, start: string | null | undefined, end: string | null | undefined, now: number) =>
  upcoming ? gapLabel('Starts in ', start, 'Starting…', now) : gapLabel('Ends in ', end, 'Ended', now);

const pct = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done * 100) / total)) : 0);
const isLadder = (format: string | null | undefined) => (format ?? '').toLowerCase() === 'ladder';

export function weeklyKind(type: string): string {
  if (type === 'skill') return 'Skill of the Week';
  return type === 'efficiency' ? 'Efficiency of the Week' : 'Boss of the Week';
}

function weeklyGain(w: ScheduleWeekly, gained: number): string {
  const safe = Math.max(0, gained);
  if (w.type === 'efficiency') return `${(safe / EFFICIENCY_SCALE).toFixed(2)} hrs`;
  return `${count(safe)} ${w.type === 'skill' ? 'xp' : 'kc'}`;
}

export function scheduledKind(b: ScheduleBingo): string {
  if (isLadder(b.format)) return 'Ladder';
  if (b.format === 'tilerace') return 'Tile race';
  return b.scoringMode === 'points' ? 'Bingo (points)' : 'Bingo';
}

/** "5×5 · 25 tiles" for a grid, "240 tiles" for a list (Leagues, races, ladders), or "". */
export function sizeLabel(b: ScheduleBingo): string {
  const tiles = b.tileCount ?? 0;
  const side = b.boardSize ?? 0;
  const square = b.format ? b.format === 'bingo' && b.scoringMode !== 'points' : tiles > 0 && side > 0 && side * side === tiles;
  const n = (k: number) => `${k} ${k === 1 ? 'tile' : 'tiles'}`;
  if (square) {
    if (side <= 0) return tiles > 0 ? n(tiles) : '';
    return tiles > 0 ? `${side}×${side} · ${n(tiles)}` : `${side}×${side}`;
  }
  const c = tiles > 0 ? tiles : side;
  return c > 0 ? n(c) : '';
}

/** A mission's value now: face scaled by the decay ramp (grows above 100%, decays below). */
export function liveValue(face: number, revealedAt: string | null | undefined, decay: { hours: number; targetPct: number } | null | undefined, now: number): number {
  const at = ms(revealedAt);
  if (!decay || decay.hours <= 0 || at < 0) return face;
  const frac = Math.min(1, Math.max(0, (now - at) / (decay.hours * 3_600_000)));
  return Math.max(0, Math.round(face * (1 - (1 - decay.targetPct / 100) * frac)));
}

/** "Bob +3 · Zulrah", "Kayle & 2 more completed Zulrah", "New tile revealed: …". */
export function feedLine(e: ActivityEntry): string {
  if (e.kind === 'reveal') return `New tile revealed: ${e.tileLabel}`;
  const who = e.isSelf ? 'You' : e.player || null;
  const others = (e.participants ?? []).filter((p) => p && p !== e.player);
  if (e.kind === 'complete') {
    const lead = who ?? others[0] ?? null;
    const more = others.length - (who != null || !others.length ? 0 : 1);
    return lead ? `${lead}${more > 0 ? ` & ${more} more` : ''} completed ${e.tileLabel}` : `Team completed ${e.tileLabel}`;
  }
  const amt = `+${e.amount > 0 ? e.amount : 1}`;
  return who ? `${who} ${amt} · ${e.tileLabel}` : `${e.tileLabel} ${amt}`;
}

/** The feed newest first, each run of one worker's progress on one tile folded into one "+N" line. */
export function foldFeed(feed: ActivityEntry[]): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  const at = new Map<string, number>();
  for (const e of [...feed].reverse()) {
    if (e.kind !== 'progress') {
      out.push(e);
      continue;
    }
    const key = `${e.isSelf ? ' you' : e.player ?? ''} ${e.tileId}`;
    const i = at.get(key);
    if (i == null) {
      at.set(key, out.length);
      out.push({ ...e });
    } else out[i] = { ...out[i], amount: out[i].amount + e.amount };
  }
  return out;
}

/** "Kurrozive 312 · You 45 · +2", or "A + B", "A + 3 others". */
export function workersLine(a: PanelActive): string {
  if (!a.workers.length) return '';
  if (a.gains && Object.keys(a.gains).length) {
    const shown = a.workers.slice(0, 3).map((w) => (a.gains?.[w] ? `${w} ${count(a.gains[w])}` : w));
    return shown.join(' · ') + (a.workers.length > 3 ? ` · +${a.workers.length - 3}` : '');
  }
  if (a.workers.length === 1) return a.workers[0];
  if (a.workers.length === 2) return `${a.workers[0]} + ${a.workers[1]}`;
  return `${a.workers[0]} + ${a.workers.length - 1} others`;
}

/** "4 tiles hidden · next in 42m" on a reveal-policy board; null otherwise. */
export function revealNote(e: NonNullable<HomeConfig['event']>, now: number): string | null {
  if (!e.revealPolicy || !e.hiddenTileCount || e.hiddenTileCount <= 0) return null;
  const n = e.hiddenTileCount;
  const bounty = e.revealPolicy === 'bounty';
  const what = bounty ? `${n} ${n === 1 ? 'bounty' : 'bounties'} left` : `${n} ${n === 1 ? 'tile' : 'tiles'} hidden`;
  const at = ms(e.nextRevealAt);
  const next = bounty ? 'next on claim' : at < 0 ? null : at - now < 60_000 ? 'next any minute' : `next in ${minutesText(Math.floor((at - now) / 60_000))}`;
  return what + (next ? ` · ${next}` : '');
}

// ---- The board ----------------------------------------------------------------------------------

interface Board {
  /** The event's id; 0 when only its name is known (an unlinked character). */
  id: number;
  title: string;
  /** Null when there's no tally (no live board); then `note` says why. */
  done: number;
  total: number;
  points: boolean;
  note: string | null;
  ladder: boolean;
  spectating: boolean;
}

function boardOf(d: HomeData): Board | null {
  const c = d.cfg;
  if (d.live && c.event) {
    const tiles = c.panel?.tiles ?? [];
    const scored = c.board && c.board.tilesTotal > 0 ? c.board : { tilesComplete: tiles.filter((t) => t.complete).length, tilesTotal: tiles.length, pointsScored: false };
    return { id: c.event.id, title: c.event.name, done: scored.tilesComplete, total: scored.tilesTotal, points: scored.pointsScored, note: null, ladder: isLadder(c.event.format), spectating: false };
  }
  if (c.homeBoard) {
    return {
      id: c.homeBoard.eventId,
      title: c.homeBoard.eventName,
      done: c.homeBoard.tilesComplete,
      total: c.homeBoard.tilesTotal,
      points: c.homeBoard.pointsScored,
      note: d.inGame ? 'This character isn’t on a team in this event.' : 'Log in in-game for live tracking.',
      ladder: false,
      spectating: d.inGame,
    };
  }
  if (c.unlinkedActiveEvent) return { id: 0, title: c.unlinkedActiveEvent, done: 0, total: 0, points: false, note: 'Log in in-game to load your board.', ladder: false, spectating: false };
  return null;
}

const statusLine = (b: Board, d: HomeData): string => {
  const m = d.cfg.event?.monthlyStandings;
  if (b.ladder) return m && m.yourRank > 0 ? `You: #${m.yourRank} · ${m.yourPoints} pts this month` : 'Unranked — claim a mission';
  if (b.total > 0) return `${b.done} / ${b.total} ${b.points ? 'pts' : 'tiles'} · ${pct(b.done, b.total)}%`;
  return b.note ?? 'No board to show yet.';
};

const home = (open?: string): Action => ({ a: 'load', v: 'home', args: open ? { open } : {} });
/** A tile's detail on the board page, with a way back to this event. */
/** The live board's tiles page; a tile opens on it as a pane, so every tile is the one answer the page warms. */
const allTiles = (title: string): Action => ({ a: 'load', v: 'board', args: { event: '0', back: 'board', backLabel: title } });
const openTile = (tileId: number, title: string): Action => ({ ...(allTiles(title) as Extract<Action, { a: 'load' }>), open: { into: 'tile', pane: `t:${tileId}` } });
const siteLink = (label: string, tip: string, path: string): Node =>
  text(label, 'brand', { tip, on: { a: 'site', path }, icon: icon({ glyph: 'external', w: 11, h: 11, color: 'brand' }), iconAfter: true });

/** Every event the tab lists, by id: a name two of them share gets its "#id" (nodes eventName). */
function listed(d: HomeData): { id: number; name: string }[] {
  const b = boardOf(d);
  return [
    ...(b?.id ? [{ id: b.id, name: b.title }] : []),
    ...(d.cfg.panel?.scheduled ?? []).map((s) => ({ id: s.id, name: s.title || 'Bingo' })),
    ...(d.myBoards ?? []).map((m) => ({ id: m.eventId, name: m.name })),
  ];
}

/** A board opened from the list: its own page, with a way back to the list (eventUi has no page called 'events'). */
const boardFromList = (id: number, title: string): Action => ({ a: 'load', v: 'board', args: { event: String(id), back: 'events', backLabel: 'All events', title } });

/** "3 / 25 tiles" as cells or a bar. */
const tally = (done: number, total: number, points: boolean): Node => (points ? thin(pct(done, total), done >= total) : cells(done, total));

// ---- Where you stand on the live board ----------------------------------------------------------

interface Place {
  rank: number | null;
  of: number;
  team: string | null;
  /** "2 behind Iron Lads", "In the lead", or null. */
  gap: string | null;
  move: number | null;
}

const scoreOf = (s: string | null | undefined) => {
  const n = Number.parseFloat((s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
/** The rows a standings window drew, best first (its gaps dropped). */
const windowRows = <T,>(w: StandingsWindow<T>): T[] => w.parts.flatMap((p) => (p.kind === 'rows' ? p.rows : []));

/** Your place on the live board, from whichever standings it has. */
function placeOf(d: HomeData): Place {
  const none: Place = { rank: null, of: 0, team: null, gap: null, move: null };
  if (!d.live) return none;
  const gapTo = (mine: number | null, top: number | null, name: string, rank: number | null): string | null => {
    if (rank === 1) return 'In the lead';
    if (mine == null || top == null || top <= mine) return null;
    const n = Math.round((top - mine) * 100) / 100;
    return `${count(n)} behind ${clip(name, 14)}`;
  };
  if (d.soloStandings) {
    const rows = windowRows(d.soloStandings);
    const me = rows.find((p) => p.you);
    return { rank: me?.rank ?? null, of: d.soloStandings.total, team: null, gap: me ? gapTo(scoreOf(me.score), scoreOf(rows[0]?.score), rows[0]?.name ?? '', me.rank) : null, move: me?.move ?? null };
  }
  const teamsList = d.teamStandings ? windowRows(d.teamStandings) : d.standings;
  const of = d.teamStandings ? d.teamStandings.total : d.standings.length;
  const me = teamsList.find((t) => t.yours);
  if (!me) return { ...none, of };
  const top = teamsList[0];
  return { rank: me.rank, of, team: me.name, gap: gapTo(scoreOf(me.score), scoreOf(top?.score), top?.name ?? '', me.rank), move: me.move ?? null };
}

/** "Live · ends in 56:13", or a plain "Ends 24 Nov" while it is more than a week off; "Live" with no date. */
function endsNode(end: string | null | undefined, now: number): Node {
  if (!end) return small('Live', BLUE);
  const at = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(end) ? end.replace(' ', 'T') : `${end.replace(' ', 'T')}Z`);
  if (Number.isFinite(at) && at - now > 7 * 86_400_000) return small(`Ends ${new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`, BLUE);
  return clock(end, 'Live · ends in ', 'Ended', now);
}
const endOf = (d: HomeData) => d.cfg.event?.endDate ?? null;
const placeText = (p: Place) => (p.rank != null && p.of > 1 ? `${ordinal(p.rank)} of ${count(p.of)}` : null);
/** "3rd of 6" and its move, right-aligned in a top card. */
const placeNode = (p: Place): Node | undefined => {
  const t = placeText(p);
  return t ? withMove(text(t, SOFT), p.move) : undefined;
};

// ---- The list ------------------------------------------------------------------------------------

/** One clan event on a list: what, when, where and who, and its "I'm going" / "Register" right there. */
function clanEventRow(d: HomeData, ce: ClanEventView): Node {
  const when = ce.phase === 'live' ? clock(ce.occurrence.end, 'Live now · ends in ', 'Just finished', d.now, { color: GREEN }) : clock(ce.occurrence.start, 'Starts in ', 'Starting now', d.now);
  const who = [where(ce), takesNames(ce.modules) ? goingLabel(ce) : null].filter(Boolean).join(' · ');
  const cta = clanEventCta(d, ce, '', true);
  return openRow(text(clip(ce.title, 24), '#e6e6e6'), undefined, [when, ...(who ? [muted(clip(who, 34))] : []), ...(cta ? [cta] : [])], home(`clan-event:${ce.id}`), ce.title);
}

/** The clan's events and your boards, under a "where am I" card; then your clan's card. */
export function homeUi(d: HomeData): Node {
  const parts: Node[] = [];
  const b = boardOf(d);
  const all = listed(d);
  const titled = (id: number, t: string) => eventName(all, { id, name: t }, 22);
  const seated = new Map((d.myBoards ?? []).map((m) => [m.eventId, m]));
  const scheduled = d.cfg.panel?.scheduled ?? [];
  const weeklies = d.cfg.panel?.weeklies ?? [];
  const others = d.chosen ? [] : otherBoards(d.cfg);
  // Each clan card under "Also live" stands for its live board; every OTHER board this character is
  // on gets a row of its own (several in one clan included), which is what "+ N more" hinted at.
  const inAlsoLive = new Set(others.flatMap((c) => (c.live && (!c.live.kind || c.live.kind === 'bingo') ? [c.live.eventId] : [])));
  const shownBoard = d.cfg.event?.id ?? d.cfg.homeBoard?.eventId ?? null;
  const onList = new Set(scheduled.map((x) => x.id));
  const mine = (d.myBoards ?? []).filter((m) => m.eventId !== shownBoard && !inAlsoLive.has(m.eventId) && !onList.has(m.eventId));

  const upcoming = [
    ...scheduled.filter((s) => s.status !== 'active').map((s) => ({ at: ms(s.startDate), node: scheduledRow(d, s, seated.get(s.id), titled), yours: !!s.yourEntry || seated.has(s.id) })),
    ...weeklies.filter((w) => w.status !== 'active').map((w) => ({ at: ms(w.startDate), node: weeklyRow(d, w), yours: false })),
    ...(d.clanEvents ?? []).filter((ce) => ce.phase !== 'live').map((ce) => ({ at: ms(ce.occurrence.start), node: clanEventRow(d, ce), yours: ce.mine })),
  ].sort((x, y) => x.at - y.at);
  const running = [
    ...weeklies.filter((w) => w.status === 'active').map((w) => weeklyRow(d, w)),
    ...scheduled.filter((s) => s.status === 'active').map((s) => scheduledRow(d, s, seated.get(s.id), titled)),
    ...(d.clanEvents ?? []).filter((ce) => ce.phase === 'live').map((ce) => clanEventRow(d, ce)),
  ];

  // Where am I: how many boards you're playing, or that nothing is on and what's next.
  const playing = (b && d.live && !b.spectating ? 1 : 0) + mine.length;
  const clanName = clip(d.cfg.activeClan?.name || d.cfg.clanName || '', 16);
  const p = placeOf(d);
  if (playing > 0 || b) {
    const sub = [p.team && b ? `You’re on ${clip(p.team, 14)} in ${clip(b.title, 18)}` : null, upcoming.length ? `${upcoming.length} more coming up` : null].filter(Boolean).join(' · ');
    parts.push(section([
      row(undefined, big(playing > 0 ? `${playing} live board${playing === 1 ? '' : 's'}` : 'On the board'), clanName ? text(clanName, SOFT) : undefined),
      ...(sub ? [muted(sub, { wrap: CARD_W })] : []),
    ]));
  } else {
    const next = upcoming[0];
    const nextName = next ? firstText(next.node) : null;
    parts.push(section([
      big(running.length ? 'Nothing of yours live' : 'Nothing live right now'),
      muted(nextName ? `No active board · next up: ${clip(nextName, 22)}` : 'No active event yet.', { wrap: CARD_W }),
    ]));
  }

  // Your live board: the gold card.
  let playingHere: Node | null = null;
  if (b) {
    const kind = b.ladder ? 'Ladder' : d.cfg.event?.race ? 'Tile race' : d.cfg.event?.revealPolicy === 'bounty' ? 'Bounty hunt' : d.cfg.event?.revealPolicy ? 'Showdown' : b.points ? 'Bingo (points)' : 'Bingo';
    const lines: Node[] = [];
    if (b.total > 0 && !b.ladder && !b.spectating) {
      lines.push(row(muted(clip([kind, p.team].filter(Boolean).join(' · '), 24)), undefined, placeNode(p)));
      lines.push(tally(b.done, b.total, b.points));
      lines.push(row(muted(`${count(b.done)} / ${count(b.total)} ${b.points ? 'pts' : 'tiles'}`), undefined, d.live && endOf(d) ? clock(endOf(d), 'Live · ends in ', 'Ended', d.now) : d.live ? small('Live', BLUE) : undefined));
    } else lines.push(muted(clip(statusLine(b, d), 34), { wrap: CARD_W }));
    const open = openRow(text(clip(titled(b.id, b.title), 24), 'white'), undefined, lines, home('board'), `Open ${b.title}`);
    if (d.live && !b.spectating) playingHere = open;
    else parts.push(section([title('Board'), open]));
  }
  // Every live board you're on, side by side in one card, each with its own progress: no one of them
  // is "the" tracked board — the plugin tracks them all (lib/pluginBoards).
  const mineRows = mine.map((m) => {
    const t = titled(m.eventId, m.name);
    // The same four things as the board above: clan · team and the rank, the bar, the count and the clock.
    const rank = m.rank != null && (m.of ?? 0) > 1 ? text(`${ordinal(m.rank)} of ${count(m.of ?? 0)}`, SOFT) : undefined;
    const lines: Node[] = [row(muted(clip(`${m.clanName} · ${m.teamName}`, 24)), undefined, rank)];
    if (m.tilesTotal > 0) lines.push(tally(m.tilesComplete, m.tilesTotal, m.pointsScored), row(muted(`${count(m.tilesComplete)} / ${count(m.tilesTotal)} ${m.pointsScored ? 'pts' : 'tiles'}`), undefined, endsNode(m.endDate, d.now)));
    else lines.push(muted('Board not revealed yet'));
    return openRow(text(clip(t, 24), '#e6e6e6'), undefined, lines, home(`board:${m.eventId}`), `Open ${t}`);
  });
  const liveRows = [...(playingHere ? [playingHere] : []), ...mineRows];
  if (liveRows.length > 1) {
    // Several boards: the card folds to its heading (open by default, the choice kept per toggle key).
    const flip: Action = { a: 'flip', key: 'liveboards' };
    const head = (open: boolean) =>
      row(
        text(`Your live boards · ${liveRows.length}`, GOLD, { font: 'bold', icon: icon({ glyph: open ? 'down' : 'chevron-right', w: 10, h: 10, color: GOLD }) }),
        undefined,
        muted(open ? 'Hide' : 'Show'),
        { on: flip, tip: open ? 'Fold the list' : 'Show every live board' },
      );
    parts.push({
      t: 'toggle',
      key: 'liveboards',
      off: section([head(true), ...liveRows], { edge: GOLD }),
      lit: section([head(false)], { edge: GOLD }),
    });
  } else if (liveRows.length) parts.push(goldCard('Your live board', liveRows));

  const heading = (s: string) => title(s);
  if (running.length) parts.push(col([heading('Running'), ...running], { gap: 5 }));
  if (upcoming.length) {
    if (b || running.length) parts.push(col([heading('Coming up'), ...upcoming.map((u) => u.node)], { gap: 5 }));
    // Nothing live: the next things are the page, in one card — gold-edged when you're signed up to one.
    else parts.push(section([text('Coming up', upcoming.some((u) => u.yours) ? GOLD : 'white', { font: 'bold' }), ...upcoming.map((u) => u.node)], upcoming.some((u) => u.yours) ? { edge: GOLD } : {}));
  }
  if (others.length) {
    parts.push(col([heading('Also live'), ...others.map((c) => {
      const name = c.name || c.slug;
      const live = c.live!;
      const weekly = live.kind === 'weekly' || live.tilesTotal <= 0;
      const lines: Node[] = [muted(clip(live.eventName, 32)), ...(weekly ? [muted('Competition running')] : [tally(live.tilesComplete, live.tilesTotal, live.pointsScored), muted(`${count(live.tilesComplete)} / ${count(live.tilesTotal)} ${live.pointsScored ? 'pts' : 'tiles'}`)])];
      // Once the boards are looked up they are listed as rows of their own above.
      if (!mine.some((m) => m.clan.toLowerCase() === c.slug.toLowerCase()) && (c.liveCount ?? 0) > 1) lines.push(small(`+ ${(c.liveCount ?? 0) - 1} more here`, GOLD));
      return openRow(text(clip(name, 24), '#e6e6e6'), undefined, lines, { a: 'switch', slug: c.slug }, `Switch to ${name} — the sidebar and your submissions follow`);
    })], { gap: 5 }));
  }
  if (d.ownClan) parts.push(col([heading(ownHeading(d.cfg)), d.ownClan], { gap: 5 }));
  if (d.supportCta) parts.push(supportLine());
  return col(parts, { gap: 10 });
}

/** The first words of a node (a row's title), for "next up: …". */
function firstText(n: Node): string | null {
  if (n.t === 'text') return n.s ?? null;
  const kids: (Node | undefined)[] = n.t === 'col' ? n.c : n.t === 'row' ? [n.l, n.c, n.r] : [];
  for (const k of kids) {
    const s = k ? firstText(k) : null;
    if (s) return s;
  }
  return null;
}

/** A weekly on the list: its metric and clock, and your rank and gain once it runs. */
function weeklyRow(d: HomeData, w: ScheduleWeekly): Node {
  const upcoming = w.status !== 'active';
  const s = d.weekly.get(w.id);
  const lines: Node[] = [row(muted(clip(w.metricLabel, 16)), undefined, upcoming ? clock(w.startDate, 'Starts in ', 'Starting…', d.now) : clock(w.endDate, 'Ends in ', 'Ended', d.now))];
  if (!upcoming) lines.push(withMove(small(clip(yourWeeklyLine(w, s), 32), s?.you ? GOLD : FAINT), s?.you?.move));
  return openRow(text(clip(w.title || weeklyKind(w.type), 24), '#e6e6e6'), undefined, lines, home(`weekly:${w.id}`), w.title || weeklyKind(w.type));
}

/** A bingo on the clan's schedule: your team on it opens the board, else its page. */
function scheduledRow(d: HomeData, s: ScheduleBingo, on: BoardSummary | undefined, titled: (id: number, t: string) => string): Node {
  const live = s.status === 'active';
  const t = titled(s.id, s.title || on?.name || 'Bingo');
  const when = live ? (s.endDate ? clock(s.endDate, 'Ends in ', 'Ended', d.now) : small('Running', BLUE)) : clock(s.startDate, 'Starts in ', 'Starting…', d.now);
  const size = sizeLabel(s);
  const lines: Node[] = [muted(clip([scheduledKind(s), size].filter(Boolean).join(' · '), 32))];
  if (on) {
    lines.push(row(when, undefined, small(clip(`On ${on.teamName}`, 16), GOLD)));
    if (on.tilesTotal > 0) lines.push(tally(on.tilesComplete, on.tilesTotal, on.pointsScored));
    return openRow(text(clip(t, 24), '#e6e6e6'), undefined, lines, boardFromList(s.id, t), `Open ${t}`);
  }
  const entry = s.yourEntry === 'entered' ? chip('Signed up ✓', 'green') : s.yourEntry === 'pending' ? chip('Waiting on host', 'gold') : live ? small('You’re not in it', FAINT) : gateChip(s);
  lines.push(row(when, undefined, entry ?? undefined));
  return openRow(text(clip(t, 24), '#e6e6e6'), undefined, lines, home(`event:${s.id}`), t);
}

/** Over the card of the place the plugin is pointed at: "Your clan", or a creator space by its name. */
export function ownHeading(cfg: Pick<HomeConfig, 'activeClan'>): string {
  const c = cfg.activeClan;
  if (c?.kind !== 'creator') return 'Your clan';
  return clip((c.name ?? '').trim() || 'This space', 30);
}

function yourWeeklyLine(w: ScheduleWeekly, s: { top: WeeklyStanding[]; you: WeeklyStanding | null } | undefined): string {
  // On +0 the rank is only an alphabetical place among everyone else on +0 — not worth a number.
  if (s?.you) return s.you.gained > 0 ? `You: #${s.you.rank} · +${weeklyGain(w, s.you.gained)}` : `You: +${weeklyGain(w, 0)} so far`;
  return !s || !s.top.length ? 'No one has scored yet' : 'You’re not on the board yet';
}

/** Your boards in the clans this plugin isn't addressing, one per board (a co-hosted one once). */
export function otherBoards(cfg: HomeConfig): NonNullable<HomeConfig['clans']> {
  const addressed = (cfg.activeClan?.slug ?? '').toLowerCase();
  const id = (l: NonNullable<NonNullable<HomeConfig['clans']>[number]['live']>) => (!l.kind || l.kind === 'bingo' ? `bingo:${l.eventId}` : `${l.kind}:${l.eventId}`);
  const seen = new Set<string>();
  const shown = cfg.event?.id ?? cfg.homeBoard?.eventId;
  if (shown) seen.add(`bingo:${shown}`);
  for (const c of cfg.clans ?? []) if (c.live && c.slug.toLowerCase() === addressed) seen.add(id(c.live));
  return (cfg.clans ?? []).filter((c) => {
    if (!c.live || !c.slug || c.slug.toLowerCase() === addressed) return false;
    const k = id(c.live);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- One event -----------------------------------------------------------------------------------

/**
 * Re-points a board page's links at board `id`: "the active board" (event 0, back/open/home 'board')
 * becomes that board's own, so tiles, teams, the feed and back all stay on it.
 */
export function refocus<T>(node: T, id: number): T {
  const own = `board:${id}`;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = walk(x);
    if (typeof o.a === 'string' && (o.a === 'load' || o.a === 'post') && o.args && typeof o.args === 'object') {
      const args = { ...(out.args as Record<string, unknown>) };
      if (args.event === '0') args.event = String(id);
      for (const k of ['back', 'open', 'home']) if (args[k] === 'board') args[k] = own;
      out.args = args;
    }
    return out;
  };
  return walk(node) as T;
}

/** One event's page: the board, a weekly, or a bingo on the schedule. Null when `open` names nothing. */
export function eventUi(d: HomeData, open: string): Node | null {
  // `board:<id>`: another board this character is seated on, built from that board's own data
  // (lib/pluginUi/views homeView); its links keep naming it instead of "the active board".
  const other = /^board:(\d+)$/.exec(open);
  if (other) {
    const page = eventUi(d, 'board');
    return page ? refocus(page, Number(other[1])) : null;
  }
  const all = listed(d);
  if (open === 'board') {
    const b = boardOf(d);
    if (!b) return null;
    const titled = { ...b, title: eventName(all, { id: b.id, name: b.title }) };
    const race = d.live && d.raceBoard && !b.spectating
      ? racePageUi(d.raceBoard.board, { title: titled.title, back: home(), rest: boardPage(d, titled, true), ctx: d.raceBoard.ctx, teams: teams(titled.title), reload: home('board'), pick: { event: '0', home: 'board' }, tracked: trackedOf(d, titled) })
      : null;
    return race ?? col(boardPage(d, titled), { gap: 10 });
  }
  const weekly = /^weekly:(\d+)$/.exec(open);
  if (weekly) {
    const w = d.cfg.panel?.weeklies?.find((x) => x.id === Number(weekly[1]));
    return w ? col(weeklyPage(d, w), { gap: 10 }) : null;
  }
  const clanEvent = /^clan-event:(\d+)$/.exec(open);
  if (clanEvent) {
    const ce = d.clanEvents?.find((x) => x.id === Number(clanEvent[1]));
    return ce ? col(clanEventPage(d, ce), { gap: 10 }) : null;
  }
  const event = /^event:(\d+)$/.exec(open);
  if (event) {
    const s = d.cfg.panel?.scheduled?.find((x) => x.id === Number(event[1]));
    return s ? col(scheduledPage(d, { ...s, title: eventName(all, { id: s.id, name: s.title || 'Bingo' }) }), { gap: 10 }) : null;
  }
  return null;
}

// ---- A clan event (a mass, a hangout): scheduled, not tracked -------------------------------------------

const where = (ce: ClanEventView) => [ce.location, ce.world ? `W${ce.world}` : null].filter(Boolean).join(' · ');

/** "4 going", or with sign-ups "4/10 registered". */
function goingLabel(ce: ClanEventView): string {
  return ce.signup ? `${ce.going}${ce.signup.cap != null ? `/${ce.signup.cap}` : ''} registered` : `${ce.going} going`;
}

/**
 * "I'm going" / "Register", or once tapped "Going ✓ · undo" / "Registered ✓ · undo" — the real
 * clan-event-going act (lib/clanEvents setGoing: an RSVP, or a sign-up when the host takes them).
 * `compact`: a list row's chips; else the page's big button. Null when there's nothing to tap.
 */
function clanEventCta(d: HomeData, ce: ClanEventView, open: string, compact: boolean): Node | null {
  if (!takesNames(ce.modules)) return null;
  const post = (going: boolean): Action => ({ a: 'post', act: 'clan-event-going', args: { id: String(ce.id), going: going ? '1' : '0', open, clan: d.cfg.activeClan?.slug ?? '' } });
  const tap = (label: string, tip: string): Node => (compact ? text(label, 'white', { chip: '#5a5a5a', font: 'small', on: post(true), tip }) : button(label, post(true), tip));
  const done = (label: string, undo: boolean, tip: string): Node => row(chip(label, 'green'), undo ? small('undo', FAINT, { on: post(false), tip }) : undefined, undefined, { gap: 6 });
  const s = ce.signup;
  if (!s) return ce.mine ? done('Going ✓', true, 'Take your name off the list') : tap('I’m going', 'Put your name on the list — your clan sees it here, on the site and in Discord');
  if (s.myStatus === 'pending' || s.myStatus === 'approved') return done('Registered ✓', s.open && !s.hasForm, 'Withdraw your sign-up');
  if (s.myStatus === 'rejected') return small('The host turned this sign-up down', CORAL);
  if (!s.open) return small(s.reason ?? 'Sign-ups are closed', FAINT);
  if (s.hasForm) return compact ? small('Register on Anvil', GOLD) : d.clanPath ? siteLink('Register on Anvil', 'The host has a few questions — answer them on the site', `${d.clanPath}/clan-events/${ce.id}`) : null;
  return tap('Register', 'Put your name down — the host sees it here, on the site and in Discord');
}

function clanEventPage(d: HomeData, ce: ClanEventView): Node[] {
  const picture = ce.icon ? icon(SKILL_KEYS.has(ce.icon) ? { skill: ce.icon, w: 20, h: 20 } : { boss: ce.icon, w: 20, h: 20 }) : undefined;
  const parts: Node[] = [
    col([
      pageHead(home(), 'All events', ce.repeat === 'weekly' ? 'Clan event · every week' : 'Clan event'),
      row(picture, text(ce.title, 'brand', { font: 'bold', wrap: 180 }), undefined, { gap: 6 }),
    ], { gap: 4 }),
  ];
  const about: Node[] = [
    ce.phase === 'live'
      ? clock(ce.occurrence.end, 'Live now · ends in ', 'Just finished', d.now, { color: GREEN, font: 'bold' })
      : clock(ce.occurrence.start, 'Starts in ', 'Starting now', d.now, { font: 'bold' }),
  ];
  if (where(ce)) about.push(text(where(ce), 'text', { wrap: CARD_W }));
  if (ce.host) about.push(muted(`Hosted by ${ce.host}`, { wrap: CARD_W }));
  for (const { slot, channel } of channelList(ce.channels)) about.push(muted(`${CHANNEL_SLOT_LABELS[slot]}: ${slot === 'voice' ? '' : '#'}${channel.name} on Discord`, { wrap: CARD_W }));
  if (ce.description) about.push(muted(ce.description, { wrap: CARD_W }));
  parts.push(section(about));
  if (takesNames(ce.modules)) {
    const s = ce.signup;
    const head = s ? `Registered · ${ce.going}${s.cap != null ? `/${s.cap}` : ''}` : `Going · ${ce.going}`;
    const body: Node[] = [title(head), ...(ce.modules.fee.on ? [row(chip(`Entry ${ce.modules.fee.amount.toLocaleString('en-US')} gp`, 'blue'), undefined, undefined)] : [])];
    if (ce.goingNames.length) body.push(muted(ce.goingNames.join(', ') + (ce.going > ce.goingNames.length ? ` +${ce.going - ce.goingNames.length}` : ''), { wrap: CARD_W }));
    const cta = clanEventCta(d, ce, `clan-event:${ce.id}`, false);
    if (cta) body.push(cta);
    if (s && (s.myStatus === 'pending' || s.myStatus === 'approved')) {
      const waits = [s.myStatus === 'pending' ? 'Waiting on the host' : null].filter(Boolean);
      if (waits.length || s.myFee === 'pending') {
        body.push(text('', 'muted', { wrap: CARD_W, font: 'small', runs: [...waits.map((w) => ({ s: w as string })), ...(s.myFee === 'pending' ? [{ s: `${waits.length ? ' · ' : ''}entry fee not marked paid yet`, color: CORAL }] : [])] }));
      }
    }
    // Your action: the gold card, at most one on the page.
    parts.push(section(body, { edge: GOLD }));
  }
  const links: Node[] = [];
  if (ce.surveyOpen && d.clanPath) links.push(siteLink('Answer the survey', 'Tell the host how it went', `${d.clanPath}/clan-events/${ce.id}/survey`));
  if (d.clanPath) links.push(siteLink('Open on Anvil', 'Open this clan event on the Anvil site', `${d.clanPath}/clan-events/${ce.id}`));
  if (links.length) parts.push(col(links, { gap: 6 }));
  return parts;
}

// ---- A live board ----------------------------------------------------------------------------------

type Kind = 'tiles' | 'points' | 'reveal' | 'bounty' | 'ladder';
function kindOf(d: HomeData, b: Board): Kind {
  if (b.ladder) return 'ladder';
  const e = d.cfg.event;
  if (e?.revealPolicy === 'bounty') return 'bounty';
  if (e?.revealPolicy && (e.hiddenTileCount ?? 0) > 0) return 'reveal';
  return b.points ? 'points' : 'tiles';
}
const KIND_WORDS: Record<Kind, string> = { tiles: 'Bingo', points: 'Bingo · points', reveal: 'Showdown', bounty: 'Bounty hunt', ladder: 'Ladder' };
function kindWords(d: HomeData, b: Board, k: Kind): string {
  if (k === 'tiles' && d.soloStandings) return 'Bingo · solo';
  if (k === 'tiles' && b.total > 0) {
    const side = Math.round(Math.sqrt(b.total));
    if (side * side === b.total && side > 1) return `Bingo ${side}×${side}`;
  }
  return KIND_WORDS[k];
}

/** `raceRest`: only what goes under a race's own page (raceUi draws the top and the standings). */
function boardPage(d: HomeData, b: Board, raceRest = false): Node[] {
  const tiles = new Map((d.cfg.panel?.tiles ?? []).map((t) => [t.tileId, t]));
  const event = d.cfg.event;
  const feedChat = event?.id ? boardFeedLinks(event.id, { open: 'board', label: b.title }, d.feedTab, d.chatOn ?? true) : null;
  if (raceRest) return [...(feedChat ? [feedChat] : []), ...boardTail(d, b, tiles, event, true)];
  const k = kindOf(d, b);
  const parts: Node[] = [pageHead(home(), 'All events', kindWords(d, b, k), b.title)];
  const other = switcher(d, b.id);
  if (other) parts.push(other);
  // Not playing this board (an alt while the main is on a team): the whole board, read-only.
  if (b.spectating && b.total > 0) {
    const eventId = d.cfg.homeBoard?.eventId ?? 0;
    return [...parts, section([muted(b.note ?? '', { wrap: CARD_W }), button('View the board', { a: 'load', v: 'board', args: { event: String(eventId), back: 'board', backLabel: b.title } })])];
  }
  parts.push(topCard(d, b, k, tiles));
  const next = d.live ? nextCard(d, b, k, tiles) : null;
  if (next) parts.push(next);
  if (d.live && (k === 'reveal' || k === 'bounty')) {
    const track = revealTrack(d, k, tiles, b.title);
    if (track) parts.push(track);
  }
  if (d.live && event && (k === 'ladder' || event.missions?.length || event.lockedMissions?.length)) parts.push(missionsCard(d, event, b.title, k === 'ladder'));
  if (feedChat) parts.push(feedChat);
  parts.push(...standingsPart(d, b));
  parts.push(...boardTail(d, b, tiles, event, false));
  return parts;
}

/** On one board's page, the character's other live boards, one tap away (the board switcher). */
function switcher(d: HomeData, current: number): Node | null {
  const others = (d.cfg.boards ?? []).filter((m) => m.eventId !== current);
  if (!others.length) return null;
  return section([
    muted('Your other live boards'),
    ...others.map((m) => link(clip(m.tilesTotal > 0 ? `${m.name} · ${count(m.tilesComplete)} / ${count(m.tilesTotal)}` : m.name, 32), home(`board:${m.eventId}`), `Open ${m.name}`)),
  ]);
}

/** Where you are: the tally, your place, a bar, and one quiet line with the clock. */
function topCard(d: HomeData, b: Board, k: Kind, tiles: Map<number, PanelTile>): Node {
  if (b.total <= 0 && k !== 'ladder') return section([big(b.title), muted(b.note ?? 'No active event yet.', { wrap: CARD_W })]);
  const p = placeOf(d);
  const e = d.cfg.event;
  const ends = d.live && endOf(d) ? clock(endOf(d), 'Ends in ', 'Ended', d.now) : undefined;
  const whoLine = (extra: string[] = []) => muted(clip([p.team, ...extra, p.gap].filter(Boolean).join(' · '), 34), { wrap: CARD_W });
  if (k === 'ladder' && e) {
    const m = e.monthlyStandings;
    const ranked = !!m && m.yourRank > 0;
    return section([
      row(undefined, big(ranked ? `#${m!.yourRank} this month` : 'Unranked'), ranked ? text(`${count(m!.yourPoints)} pts`, SOFT) : undefined),
      muted(ranked ? (e.standings && e.standings.yourRank > 0 ? `#${e.standings.yourRank} all-time` : 'This month’s ladder') : 'Finish a mission to get on the board', { wrap: CARD_W }),
      ...(d.boardPath ? [siteLink('View standings', 'Open the full standings on the Anvil site', d.boardPath)] : []),
    ]);
  }
  const open = [...tiles.values()];
  const hidden = e?.hiddenTileCount ?? 0;
  if (k === 'reveal' && e) {
    const done = open.filter((t) => t.complete).length;
    return section([
      { t: 'countdown', at: e.nextRevealAt ?? null, prefix: 'Next reveal in ', due: 'Revealing…', none: 'Waiting on the host', font: 'bold', color: BLUE },
      row(undefined, text(clip([`${count(b.done)} ${b.points ? 'pts' : 'tiles'}`, placeText(p)].filter(Boolean).join(' · '), 24), 'text'), muted(`${open.length} of ${open.length + hidden} open`)),
      cells(done, open.length + hidden, open.length - done),
      whoLine([`${hidden} hidden`]),
    ]);
  }
  if (k === 'bounty') {
    const live = open.filter((t) => !t.complete).length;
    const done = open.length - live;
    return section([
      row(undefined, big(`${live} ${live === 1 ? 'bounty' : 'bounties'} open`), placeNode(p)),
      cells(done, open.length + hidden, live),
      muted(clip([e ? revealNote(e, d.now) : null, p.team ? `${p.team} ${count(b.done)} ${b.points ? 'pts' : 'tiles'}` : null].filter(Boolean).join(' · '), 40), { wrap: CARD_W }),
    ]);
  }
  if (d.soloStandings && p.rank != null && p.of > 1) {
    return section([
      row(undefined, withMove(big(`${ordinal(p.rank)} of ${count(p.of)}`), p.move), text(`${count(b.done)} / ${count(b.total)} ${b.points ? 'pts' : 'tiles'}`, SOFT)),
      tally(b.done, b.total, b.points),
      row(muted(clip(p.gap ?? 'Solo board', 22)), undefined, ends),
    ]);
  }
  const head = b.points ? `${count(b.done)} pts` : `${count(b.done)} of ${count(b.total)} tiles`;
  return section([
    row(undefined, big(head), placeNode(p)),
    tally(b.done, b.total, b.points),
    row(whoLine(b.points ? [`${count(b.total)} pts on the board`] : []), undefined, ends),
  ]);
}

/** A tile to open, with its count and bar: a row in the gold card or a list. */
function tileLine(t: PanelTile, title: string, right?: Node, sub?: Node): Node {
  const moving = !t.complete && t.goal > 1;
  const prog = moving ? text(`${count(Math.min(t.current, t.goal))}/${count(t.goal)}`, PROGRESS, { font: 'small', live: { tile: t.tileId, cur: t.current, goal: t.goal, fmt: 'raw' } }) : undefined;
  const lines: Node[] = [];
  if (moving && t.current > 0) lines.push(thin(percent(t.current, t.goal), false, { tile: t.tileId, cur: t.current, goal: t.goal }));
  if (sub) lines.push(sub);
  return openRow(text(clip(t.label, 24), '#e6e6e6'), right ?? prog, lines, openTile(t.tileId, title), tileTip(t));
}

/** At most one gold card: the starting shot, the mission running out, the tile just opened, or the nearest. */
function nextCard(d: HomeData, b: Board, k: Kind, tiles: Map<number, PanelTile>): Node | null {
  if (d.cfg.startProof) return goldCard('Do this next: starting shot', [{ t: 'native', name: 'start-proof' }]);
  const e = d.cfg.event;
  if (k === 'ladder' && e) {
    const live = (e.missions ?? []).filter((m) => !tiles.get(m.tileId)?.complete).sort((x, y) => (ms(x.expiresAt) < 0 ? Infinity : ms(x.expiresAt)) - (ms(y.expiresAt) < 0 ? Infinity : ms(y.expiresAt)));
    const m = live[0];
    if (!m) return null;
    const val = liveValue(m.points, m.revealedAt, e.decay ?? null, d.now);
    const t = tiles.get(m.tileId) ?? { tileId: m.tileId, label: m.label, current: 0, goal: 0, points: m.points, complete: false, position: 0, description: null };
    const worth = small(val === m.points ? `${m.points}` : `${m.points} → ${val}`, val < m.points ? CORAL : val > m.points ? GREEN : SOFT);
    return goldCard('Do this next', [tileLine({ ...t, label: m.label }, b.title, worth, m.expiresAt ? clock(m.expiresAt, 'Expires in ', 'Expired', d.now) : undefined)]);
  }
  if (k === 'reveal' || k === 'bounty') {
    const fresh = foldFeed(d.feed).find((x) => x.kind === 'reveal' && tiles.has(x.tileId) && !tiles.get(x.tileId)!.complete);
    if (fresh) {
      const t = tiles.get(fresh.tileId)!;
      return goldCard('Do this next', [muted(k === 'bounty' ? 'First team to finish it takes the points.' : t.current > 0 ? 'Just opened. Your team is on it.' : 'Just opened. Nobody has it yet.', { wrap: CARD_W }), tileLine(t, b.title, b.points ? chip(`${t.points} pts`, 'blue') : undefined)]);
    }
  }
  const nearest = [...tiles.values()].filter((t) => !t.complete).sort((x, y) => frac(y) - frac(x) || x.position - y.position).slice(0, 2);
  if (!nearest.length) return null;
  return goldCard('Do this next', [muted('Closest to done for your team.', { wrap: CARD_W }), ...nearest.map((t) => tileLine(t, b.title, b.points && !(t.goal > 1 && !t.complete) ? chip(`${t.points} pts`, 'blue') : undefined))]);
}

/** A showdown's reveals or a bounty hunt's bounties so far, as a vertical track. */
function revealTrack(d: HomeData, k: Kind, tiles: Map<number, PanelTile>, title: string): Node | null {
  const e = d.cfg.event!;
  const reveals = foldFeed(d.feed).filter((x) => x.kind === 'reveal' && tiles.has(x.tileId)).reverse().slice(-4);
  const hidden = e.hiddenTileCount ?? 0;
  if (!reveals.length && hidden <= 0) return null;
  const sub = (s: string, color: Color = FAINT) => small(s, color, { wrap: 170 });
  const newestOpen = [...reveals].reverse().find((r) => !tiles.get(r.tileId)!.complete)?.tileId;
  const stops: { dot: 'done' | 'now' | 'todo' | 'end'; head: Node; sub: Node; on?: Action }[] = reveals.map((r) => {
    const t = tiles.get(r.tileId)!;
    const on = openTile(t.tileId, title);
    if (t.complete) return { dot: 'done', head: text(clip(t.label, 26), GREEN), sub: sub(k === 'bounty' ? `Claimed by your team${b2p(t)}` : 'Done by your team', GREEN), on };
    if (t.tileId === newestOpen) return { dot: 'now', head: text(clip(t.label, 26), 'white', { font: 'bold' }), sub: sub('Open now', GOLD), on };
    return { dot: 'todo', head: text(clip(t.label, 26), 'text'), sub: sub('Open'), on };
  });
  if (hidden > 0) {
    if (k === 'reveal' && e.nextRevealAt) stops.push({ dot: 'end', head: text('Next reveal', 'white', { font: 'bold' }), sub: clock(e.nextRevealAt, 'in ', 'any minute', d.now) });
    stops.push({ dot: 'todo', head: text(`${hidden} more ${k === 'bounty' ? '' : 'hidden'}`.trim(), 'text'), sub: sub(k === 'bounty' ? 'Drawn one at a time' : 'Names stay hidden until each drops') });
  }
  return col([title2(k === 'bounty' ? 'Bounties so far' : 'Reveals'), ...stops.map((s, i) => stop(s.dot, s.head, s.sub, s.on, i === stops.length - 1))], { gap: 0 });
}
const b2p = (t: PanelTile) => (t.points > 1 ? ` · ${t.points} pts` : '');
const title2 = (s: string): Node => col([title(s), gap(4)]);

/** Missions as a track: Live (coral under 15 minutes), Done, Expired, Locked. */
function missionsCard(d: HomeData, e: NonNullable<HomeConfig['event']>, boardTitle: string, ladder: boolean): Node {
  const tiles = new Map((d.cfg.panel?.tiles ?? []).map((t) => [t.tileId, t]));
  const missions = e.missions ?? [];
  const locked = e.lockedMissions ?? [];
  const none = ladder ? 'Next on a claim' : 'Whenever staff drop it';
  const head = row(undefined, title('Missions'), { t: 'countdown', at: e.nextRevealAt ?? null, prefix: 'Next in ', due: 'Dropping…', none, font: 'small', color: BLUE });
  const stops: Node[] = [];
  const total = missions.length + locked.length;
  missions.forEach((m, i) => {
    const val = liveValue(m.points, m.revealedAt, e.decay ?? null, d.now);
    const p = tiles.get(m.tileId);
    const hours = m.expiresAt && m.revealedAt ? (ms(m.expiresAt) - ms(m.revealedAt)) / 3_600_000 : null;
    const st = missionTileState({ revealedAt: m.revealedAt, expiryHours: hours != null && Number.isFinite(hours) ? hours : null }, { done: !!p?.complete, now: d.now });
    const last = i === total - 1;
    const on = openTile(m.tileId, boardTitle);
    const worth = val === m.points ? String(m.points) : `${m.points} → ${val}`;
    if (st.kind === 'done') {
      stops.push(stop('done', row(undefined, text(clip(m.label, 22), GREEN), muted(worth)), small('Done', GREEN), on, last));
    } else if (st.kind === 'expired') {
      stops.push(stop('todo', row(undefined, text(clip(m.label, 22), 'muted'), muted(worth)), small('Expired', FAINT), on, last));
    } else {
      const prog = p && p.goal > 1 ? ` · ${count(Math.min(p.current, p.goal))}/${count(p.goal)}` : '';
      const sub: Node = m.expiresAt
        ? clock(m.expiresAt, `Live${prog} · ends in `, 'Expired', d.now)
        : small(`Live${val > m.points ? ' · growing' : ''}${prog}`, BLUE);
      stops.push(stop('now', row(undefined, text(clip(m.label, 22), 'white'), small(worth, val < m.points ? CORAL : val > m.points ? GREEN : SOFT)), sub, on, last));
    }
  });
  locked.forEach((m, i) => {
    stops.push(stop('todo', row(undefined, text(clip(m.label, 22), 'muted'), muted('Locked')), small('Not announced yet', FAINT), undefined, missions.length + i === total - 1));
  });
  if (!stops.length) stops.push(muted('Waiting for the next mission…'));
  return section([head, col(stops)]);
}

/** The standings, compact on every board: the top three and your own, the rest one click away. */
function standingsPart(d: HomeData, b: Board): Node[] {
  if (!d.live || b.ladder) return [];
  if (d.standingsNotice) return [section([title('Standings'), muted(d.standingsNotice, { wrap: CARD_W })])];
  const solo = d.soloStandings ?? null;
  const many = !solo ? d.teamStandings ?? null : null;
  if (solo) return soloStandingRows(solo, teams(b.title));
  if (many) return teamStandingRows(many, b.title);
  if (!d.standings.length) return [button('Teams', teams(b.title), 'Who’s on which team')];
  const line = (t: RosterTeamOut) => {
    const ink: Color = t.yours ? GOLD : SOFT;
    return row(withMove(text(`${t.rank}  ${clip(t.name, 18)}${t.yours ? ' · you' : ''}`, ink, { icon: swatch(t.color) }), t.move), undefined, text(t.score ?? '', t.yours ? GOLD : FAINT), {
      tip: `${t.name} — ${t.members} member${t.members === 1 ? '' : 's'}. Click for the roster.`,
      on: teams(b.title),
      gap: 6,
    });
  };
  const n = d.standings.length;
  return [standingsCard(compactStandings(d.standings, (t) => !!t.yours, line, teams(b.title), `board:${b.id}`), `${n} team${n === 1 ? '' : 's'}`, link('All teams & members', teams(b.title), 'Who’s on which team'))];
}

const swatch = (color: string | null | undefined) => icon({ glyph: 'swatch', color: (/^#[0-9a-f]{6}$/i.test(color ?? '') ? color : '#989898') as Color, w: 8, h: 8 });

/** The "Tracked on screen" card for this board's page: every pin, on any board, or null. */
function trackedOf(d: HomeData, b: Board): Node | null {
  const event = d.cfg.event;
  if (!d.live || !event) return null;
  // views.ts looks every pin up (other boards too); without that, this board's own from the panel tiles.
  const own = (d.cfg.panel?.tiles ?? []);
  const rows = d.pinRows ?? (d.pins ?? []).flatMap((id) => {
    const t = own.find((x) => x.tileId === id);
    return t ? [{ tileId: id, label: t.label, eventId: event.id, board: null, cur: t.current, goal: t.goal, done: t.complete }] : [];
  });
  return trackedCard(rows, event.id, home('board'));
}

/** Under the standings: pins, who's active, the feed and the nearest tiles. */
function boardTail(d: HomeData, b: Board, tiles: Map<number, PanelTile>, event: HomeConfig['event'], race: boolean): Node[] {
  const parts: Node[] = [];
  // On a race the starting shot sits under the race's own page (it has no gold card of ours).
  if (race && d.live && d.cfg.startProof) parts.push({ t: 'native', name: 'start-proof' });

  // Race boards draw it inside their own page (raceUi), right under the next tile.
  if (!race) {
    const tr = trackedOf(d, b);
    if (tr) parts.push(tr);
  }

  const active = (d.cfg.panel?.activeNow ?? []).filter((a) => tiles.has(a.tileId) && !tiles.get(a.tileId)!.complete && a.workers.length);
  if (d.live && active.length && !race) {
    parts.push(section([title('Active now'), ...more(active.map((a) => progressRow(tiles.get(a.tileId)!.label, tiles.get(a.tileId)!, a, a.self ? 'brand' : IN_PROGRESS, b.title)), 2, `active:${b.id}`, 8)]));
  }

  const feed = foldFeed(d.feed).filter((e) => e.kind !== 'reveal');
  if (d.live && feed.length) parts.push(activityCard(d, feed, tiles, b));

  // The buttons below sit under the Feed | Chat row: keep a gap so they never touch.
  if (d.live && b.total > 0 && race) parts.push(gap(8), button(`View all ${b.total} tiles`, allTiles(b.title), 'Every tile on the route, with search'));
  else if (d.live && b.total > 0) {
    // A points board's nearest tiles and what each is worth; a square bingo has its gold card.
    if (b.points) {
      const nearest = [...tiles.values()].filter((t) => !t.complete).sort((x, y) => frac(y) - frac(x) || x.position - y.position).slice(0, NEAREST);
      if (nearest.length) parts.push(section([title('Nearest tiles'), ...more(nearest.map((t) => tileLine(t, b.title, chip(`${t.points} pts`, 'blue'))), 3, `nearest:${b.id}`, 5)]));
    }
    parts.push(gap(8), button(b.points ? 'View all tiles' : `View all ${b.total} tiles`, allTiles(b.title), 'Search the full board, including manual tiles'), { t: 'warm', on: allTiles(b.title) });
  }
  return parts;
}

/** The team's latest, a few lines: finished tiles green, yours gold; the rest on the Feed. */
function activityCard(d: HomeData, entries: ActivityEntry[], tiles: Map<number, PanelTile>, b: Board): Node {
  const lines = entries.slice(0, ACTIVITY_SHOWN).map((e) => {
    const line = feedLine(e);
    const color: Color = e.kind === 'complete' ? GREEN : e.isSelf ? GOLD : 'text';
    const t = tiles.get(e.tileId);
    const others = (e.participants ?? []).filter((p) => p && p !== e.player);
    const detail = e.kind === 'complete' && others.length ? `${line} — with ${others.join(', ')}` : line;
    return text(clip(`${e.kind === 'complete' ? '✓ ' : ''}${line}`, 36), color, { tip: t ? `${tileTip(t)}\n\n${detail}` : detail, ...(e.tileId > 0 ? { on: openTile(e.tileId, b.title) } : {}) });
  });
  const shown = 4;
  const event = d.cfg.event;
  const rest = entries.length - shown;
  const toFeed: Action | null = event?.id
    ? d.feedTab ? { a: 'tab', tab: 'feed', args: { s: `event:${event.id}`, p: 'feed' } } : { a: 'load', v: 'feed', args: { s: `event:${event.id}`, p: 'feed', back: 'board', backLabel: b.title } }
    : null;
  const body = rest > 0 && toFeed ? [...lines.slice(0, shown), link(`+${rest} more`, toFeed, 'This board’s feed')] : more(lines, shown, `activity:${b.id}`, 3);
  return section([title(b.ladder ? 'Recent activity' : 'Team activity'), ...body], { gap: 4 });
}

const frac = (t: PanelTile) => (t.goal > 0 ? Math.min(1, t.current / t.goal) : 0);

/**
 * A players board's standings: the top, a "· · ·" over each stretch left out, and the caller's own
 * line(s) with their neighbours. A row looks the player up.
 */
export function soloStandingRows(w: StandingsWindow<RosterPersonOut>, all?: Action): Node[] {
  const line = (p: RosterPersonOut) => {
    const ink: Color = p.you ? GOLD : SOFT;
    return row(withMove(row(text(p.rank == null ? '–' : `${p.rank}`, ink, { w: 26 }), nameText(p.name, ink), undefined, { gap: 2 }), p.move), undefined, text(p.score ?? '', p.you ? GOLD : FAINT), {
      tip: `Look up ${p.name}`,
      on: { a: 'lookup', rsn: p.name },
      gap: 6,
    });
  };
  const rows = compactStandings(windowRows(w), (p) => !!p.you, line, null, 'players', w.total);
  const foot: Node[] = [];
  if (w.mineMore > 0) foot.push(muted(`+${w.mineMore} more of your accounts`));
  if (all) foot.push(link(w.complete ? 'Players' : `View all ${w.total.toLocaleString('en-US')} players`, all, 'Every player, a page at a time, with a search by name'));
  return [standingsCard([...rows, ...foot], `${w.total.toLocaleString('en-US')} player${w.total === 1 ? '' : 's'}`)];
}

/** A many-teams board's standings: like the players cut, each row a team with its colour and size. */
export function teamStandingRows(w: StandingsWindow<RosterTeamOut>, title: string): Node[] {
  const line = (t: RosterTeamOut) => {
    const ink: Color = t.yours ? GOLD : SOFT;
    return row(
      withMove(text(`${t.rank == null ? '–' : t.rank}  ${clip(t.name, 16)}${t.yours ? ` · ${t.members} member${t.members === 1 ? '' : 's'}` : ''}`, ink, { icon: swatch(t.color) }), t.move),
      undefined,
      text(t.score ?? '', t.yours ? GOLD : FAINT),
      { tip: `${t.name} — ${t.members} member${t.members === 1 ? '' : 's'}. Click for the roster.`, on: { a: 'load', v: 'teams', args: { event: '0', team: String(t.teamId), back: 'board', backLabel: title } }, gap: 6 },
    );
  };
  const rows = compactStandings(windowRows(w), (t) => !!t.yours, line, null, `teams:${title}`, w.total);
  const foot: Node[] = [];
  if (w.mineMore > 0) foot.push(muted(`+${w.mineMore} more of your teams`));
  foot.push(link(w.complete ? 'All teams & members' : `View all ${w.total.toLocaleString('en-US')} teams`, teams(title), 'Every team, a page at a time, with a search by team or player name'));
  return [standingsCard([...rows, ...foot], `${w.total.toLocaleString('en-US')} team${w.total === 1 ? '' : 's'}`)];
}

const teams = (title: string): Action => ({ a: 'load', v: 'teams', args: { event: '0', back: 'board', backLabel: title } });

/** A tile's line: name and count, a "who" byline, a bar; a click opens it on the board page. */
function progressRow(label: string, t: PanelTile, a: PanelActive | null, color: Color, title: string): Node {
  const value = t.goal > 0 ? `${count(t.current)} / ${count(t.goal)}` : '';
  const who = a ? workersLine(a) : '';
  const moving = !t.complete && t.goal > 0;
  return col(
    [
      row(undefined, text(clip(label, 24), a?.self ? 'brand' : 'text'), muted(value, { tip: t.complete ? undefined : exact(t.current, t.goal), ...(moving ? { live: { tile: t.tileId, cur: t.current, goal: t.goal, fmt: 'of' } } : {}) })),
      ...(t.sets ? [muted(clip(t.sets, 40), { tip: t.sets })] : []),
      ...(who ? [text(clip(who, 36), a?.self ? 'brand' : 'muted', { tip: who, font: 'small' })] : []),
      { t: 'bar', pct: t.complete ? 100 : percent(t.current, t.goal), color: t.complete ? 'done' : color, h: 5, bg: 'panel', ...(moving ? { live: { tile: t.tileId, cur: t.current, goal: t.goal } } : {}) },
    ],
    { on: openTile(t.tileId, title), tip: tileTip(t), gap: 3 },
  );
}

const tileTip = (t: PanelTile) => (t.description?.trim() && t.description.trim().toLowerCase() !== t.label.trim().toLowerCase() ? `${t.label}\n${t.description.trim()}` : t.label);

// ---- A weekly, and a bingo on the schedule -----------------------------------------------------

function weeklyPage(d: HomeData, w: ScheduleWeekly): Node[] {
  const upcoming = w.status !== 'active';
  const s = d.weekly.get(w.id);
  const path = `${d.clanPath}/weekly/${w.id}`;
  const headcount = s && s.total > 0 ? `${s.total} ${s.total === 1 ? 'player' : 'players'}` : null;
  const parts: Node[] = [pageHead(home(), 'All events', weeklyKind(w.type), w.title || `${w.metricLabel} week`)];
  const you = s?.you;
  const top: Node[] = upcoming
    ? [row(undefined, clock(w.startDate, 'Starts in ', 'Starting…', d.now, { font: 'bold' }), text(clip(w.metricLabel, 14), SOFT)), muted('No standings until it starts.')]
    : [
        row(undefined, withMove(big(you && you.gained > 0 ? `#${you.rank} · +${weeklyGain(w, you.gained)}` : you ? `+${weeklyGain(w, 0)} so far` : 'Not on the board'), you?.move), text(clip(w.metricLabel, 14), SOFT)),
        row(clock(w.endDate, 'Ends in ', 'Ended', d.now), headcount ? muted(` · ${headcount}`) : undefined, undefined, { gap: 0 }),
      ];
  top.push(siteLink(upcoming ? 'View event' : 'View standings', upcoming ? 'Open this event on the Anvil site' : 'Open the full standings on the Anvil site', path));
  parts.push(section(top));
  if (!upcoming) {
    if (!s || !s.top.length) parts.push(section([title('Standings'), muted('No one has scored yet.')]));
    else {
      const rows = [...s.top, ...(s.you && !s.top.some((r) => r.self) ? [s.you] : [])];
      const line = (r: WeeklyStanding) => standingRow(w, r);
      parts.push(standingsCard(compactStandings(rows, (r) => r.self, line, { a: 'site', path }, `weekly:${w.id}`, Math.max(s.total, rows.length)), headcount ?? undefined));
    }
  }
  // The rest of the clan's weekly schedule, one line each.
  const rest = (d.cfg.panel?.weeklies ?? []).filter((x) => x.id !== w.id);
  if (rest.length) {
    parts.push(col([title('Also on the schedule'), ...rest.map((x) => weeklyRow(d, x))], { gap: 5 }));
  }
  return parts;
}

function standingRow(w: ScheduleWeekly, r: WeeklyStanding): Node {
  const ink: Color = r.self ? GOLD : SOFT;
  return row(withMove(row(text(String(r.rank), ink, { w: 26 }), text(clip(r.rsn, 14), ink, { tip: r.rsn, who: r.rsn }), undefined, { gap: 2 }), r.move), undefined, text(`+${weeklyGain(w, r.gained)}`, r.self ? GOLD : FAINT, { align: 'r' }), { gap: 6 });
}

/**
 * Who may join a gated event, in a few words ("Subs only (Twitch)", "Discord role: Raiders") — from
 * the schedule's `gate` (lib/entryGates gatesShortLabel). Nothing on an open event, or once you're in.
 */
export function gateLine(s: ScheduleBingo): Node[] {
  const c = gateChip(s);
  return c ? [c] : [];
}
function gateChip(s: ScheduleBingo): Node | null {
  if (!s.gate || s.yourEntry === 'entered') return null;
  return chip(clip(s.gate, 28), 'blue', { tip: `Who can join: ${s.gate}` });
}

function scheduledPage(d: HomeData, s: ScheduleBingo): Node[] {
  const live = s.status === 'active';
  const name = s.title || 'Bingo';
  const back = `event:${s.id}`;
  const entry: Node =
    s.yourEntry === 'entered'
      ? row(chip('Signed up ✓', 'green'), muted(live ? 'your board shows once it loads' : 'waiting for it to start'), undefined, { gap: 6 })
      : s.yourEntry === 'pending'
        ? row(chip('Signed up', 'gold'), muted('waiting for the host to approve'), undefined, { gap: 6 })
        : muted(live ? 'You’re not enrolled in this one.' : 'Sign up on the site to take part.', { wrap: CARD_W });
  const top: Node[] = [
    live ? (s.endDate ? clock(s.endDate, 'Running · ends in ', 'Ended', d.now, { font: 'bold' }) : big('Running', BLUE)) : clock(s.startDate, 'Starts in ', 'Starting…', d.now, { font: 'bold' }),
    ...(sizeLabel(s) || s.scoringMode === 'points' ? [muted([sizeLabel(s), s.scoringMode === 'points' ? 'points' : null].filter(Boolean).join(' · '))] : []),
    entry,
    ...gateLine(s),
  ];
  const before: Node[] = [
    title(live ? 'The board' : 'Before it starts'),
    openRow(text('Teams', '#e6e6e6'), undefined, [], { a: 'load', v: 'teams', args: { event: String(s.id), back, backLabel: name } }, 'Who’s on which team'),
  ];
  if ((s.tileCount ?? 0) > 0) {
    before.push(openRow(text(live ? `Tiles · ${s.tileCount}` : `Revealed tiles · ${s.tileCount}`, '#e6e6e6'), undefined, [], { a: 'load', v: 'board', args: { event: String(s.id), pre: live ? '' : '1', back, backLabel: name } }, 'The tiles so far'));
  }
  if (!live) before.push(muted((s.tileCount ?? 0) > 0 ? 'More tiles appear as the host reveals them.' : 'Tiles will appear here when the host reveals them.', { wrap: CARD_W }));
  return [
    pageHead(home(), 'All events', scheduledKind(s), name),
    section(top),
    section(before),
    siteLink('View event', 'Open this event on the Anvil site', `${d.clanPath}/events/${s.id}`),
  ];
}

/**
 * One quiet line at the foot of the panel for anyone who isn't a supporter: what pays for Anvil,
 * and the way to the tier page. Opens the site; nothing is bought in the client.
 */
export function supportLine(): Node {
  return row(
    text('Support Anvil', '#ffd35c', { icon: icon({ glyph: 'star', w: 10, h: 10, color: '#ffd35c', alt: '★' }) }),
    undefined,
    muted('7 days free', { font: 'small' }),
    {
      bg: 'card',
      pad: 8,
      on: { a: 'site', path: '/supporter' },
      tip: 'Anvil is free and made by one dev. Supporters pay for the servers, and their name shows it.',
    },
  );
}
