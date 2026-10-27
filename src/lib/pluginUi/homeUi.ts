import type { ActivityEntry } from '@/lib/pluginActivity';
import type { PanelActive, PanelTile } from '@/lib/pluginPanel';
import type { ScheduleBingo, ScheduleWeekly } from '@/lib/pluginConfig';
import type { RosterTeamOut } from '@/lib/eventRoster';

import { type Action, type Color, type Node, backRow, button, card, col, count, exact, gap, icon, muted, percent, row, text } from './nodes';

// The plugin's Clan tab, built here (was the event list and event page in AnvilSidebarPanel, fed by
// AnvilSidebarDataSource/ConnectionView): the clan's events as cards, and one event's page — the
// board's summary, standings, what you've pinned, who's on what, missions, the team feed and the
// tiles nearest done; a weekly's standings; an upcoming bingo. Pure: views.ts gathers the data.

const NEAREST = 10;
const STANDINGS_SHOWN = 3;
const ACTIVITY_SHOWN = 12;
const WEEKLY_SHOWN = 10;
const EFFICIENCY_SCALE = 1000;
const IN_PROGRESS: Color = 'progress';
const LIGHT: Color = '#cdcdcd';

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
    format?: string | null;
    scoringMode?: string | null;
    revealPolicy?: string | null;
    hiddenTileCount?: number;
    nextRevealAt?: string | null;
    decay?: { hours: number; targetPct: number } | null;
    missions?: Mission[];
    missionsLeft?: number;
    standings?: { yourRank: number } | null;
    monthlyStandings?: { yourRank: number; yourPoints: number } | null;
  } | null;
  board?: { tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null;
  homeBoard?: { eventId: number; eventName: string; tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null;
  unlinkedActiveEvent?: string | null;
  startProof?: unknown;
  panel?: { tiles?: PanelTile[]; activeNow?: PanelActive[]; scheduled?: ScheduleBingo[]; weeklies?: ScheduleWeekly[] };
  clans?: {
    slug: string;
    name: string | null;
    live: { kind?: string; eventId: number; eventName: string; tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null;
    liveCount?: number;
  }[];
  activeClan?: { slug: string } | null;
}

export interface WeeklyStanding {
  rank: number;
  rsn: string;
  gained: number;
  self: boolean;
}

/** Everything the tab draws, gathered by the view. */
export interface HomeData {
  cfg: HomeConfig;
  /** The board is live for this character (a team on it, the clock running). */
  live: boolean;
  /** In game on a character with no team on the home board: it watches rather than plays. */
  inGame: boolean;
  feed: ActivityEntry[];
  standings: RosterTeamOut[];
  /** Live weeklies' boards by competition id: the caller's line and the top. */
  weekly: Map<number, { total: number; top: WeeklyStanding[]; you: WeeklyStanding | null }>;
  /** Tiles this client has pinned on the live board; null where it can't pin. */
  pins: number[] | null;
  /** The member picked this clan rather than leaving it on Auto: no "Also live" then. */
  chosen: boolean;
  /** The clan's own card, already built (clanUi), or null. */
  ownClan: Node | null;
  /** Site path of the live board's page. */
  boardPath: string | null;
  /** Site path prefix for this clan (`/c/<slug>`), for weekly and event links. */
  clanPath: string;
  now: number;
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
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`);
const heading = (s: string): Node[] => [text(s, 'brand'), gap(6)];
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
    return { title: c.event.name, done: scored.tilesComplete, total: scored.tilesTotal, points: scored.pointsScored, note: null, ladder: isLadder(c.event.format), spectating: false };
  }
  if (c.homeBoard) {
    return {
      title: c.homeBoard.eventName,
      done: c.homeBoard.tilesComplete,
      total: c.homeBoard.tilesTotal,
      points: c.homeBoard.pointsScored,
      note: d.inGame ? 'This character isn’t on a team in this event.' : 'Log in in-game for live tracking.',
      ladder: false,
      spectating: d.inGame,
    };
  }
  if (c.unlinkedActiveEvent) return { title: c.unlinkedActiveEvent, done: 0, total: 0, points: false, note: 'Log in in-game to load your board.', ladder: false, spectating: false };
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

/** A clickable card on a list — its title and a chevron, then its lines. */
function drillCard(title: string, lines: Node[], on: Action, tip = title): Node {
  return card([row(undefined, text(clip(title, 22), 'text', { font: 'regular' }), icon({ glyph: 'chevron-right', w: 12, h: 12, color: 'brand' })), ...lines], { on, tip });
}

const thickBar = (p: number): Node => ({ t: 'bar', pct: p, color: p >= 100 ? 'done' : 'brand', h: 6, bg: 'panel' });

// ---- The list ------------------------------------------------------------------------------------

/** The clan's events as cards, then your other clans' boards, then your clan's card. */
export function homeUi(d: HomeData): Node {
  const parts: Node[] = [];
  const b = boardOf(d);
  const cards: Node[] = [];
  if (b) {
    const lines: Node[] = [text(b.ladder ? 'Ladder' : 'Bingo', LIGHT), muted(clip(statusLine(b, d), 30))];
    if (b.total > 0 && !b.ladder) lines.push(gap(4), thickBar(pct(b.done, b.total)));
    cards.push(drillCard(b.title, lines, home('board')));
  }
  for (const w of d.cfg.panel?.weeklies ?? []) {
    const upcoming = w.status !== 'active';
    const lines: Node[] = [text(weeklyKind(w.type), LIGHT), muted(clip(`${w.metricLabel}${suffix(timingLabel(upcoming, w.startDate, w.endDate, d.now))}`, 30))];
    if (!upcoming) {
      const s = d.weekly.get(w.id);
      lines.push(text(clip(yourWeeklyLine(w, s), 30), s?.you ? 'brand' : 'muted'));
    }
    cards.push(drillCard(w.title || weeklyKind(w.type), lines, home(`weekly:${w.id}`)));
  }
  for (const s of d.cfg.panel?.scheduled ?? []) {
    const live = s.status === 'active';
    const timing = timingLabel(!live, s.startDate, s.endDate, d.now);
    cards.push(drillCard(s.title || 'Bingo', [text(scheduledKind(s), LIGHT), muted(clip(timing ?? sizeLabel(s), 30)), muted(clip(live ? 'Running — you’re not in it' : sizeLabel(s), 30))], home(`event:${s.id}`)));
  }
  if (cards.length) parts.push(...heading('Events'), ...cards.flatMap((c, i) => (i ? [gap(8), c] : [c])));
  else parts.push(muted('No active event yet.'));
  parts.push(gap(12));

  const others = d.chosen ? [] : otherBoards(d.cfg);
  if (others.length) {
    parts.push(...heading('Also live'));
    others.forEach((c, i) => {
      const name = c.name || c.slug;
      const live = c.live!;
      const weekly = live.kind === 'weekly' || live.tilesTotal <= 0;
      const lines: Node[] = [text(clip(live.eventName, 30), LIGHT), muted(weekly ? 'Competition running' : `${live.tilesComplete} / ${live.tilesTotal} ${live.pointsScored ? 'points' : 'tiles'}`)];
      if ((c.liveCount ?? 0) > 1) lines.push(text(`+ ${(c.liveCount ?? 0) - 1} more here`, 'brand'));
      if (!weekly) lines.push(gap(4), thickBar(percent(live.tilesComplete, live.tilesTotal)));
      parts.push(...(i ? [gap(6)] : []), drillCard(name, lines, { a: 'switch', slug: c.slug }, `Switch to ${name} — the sidebar and your submissions follow`));
    });
    parts.push(gap(12));
  }
  if (d.ownClan) parts.push(...heading('Your clan'), d.ownClan, gap(12));
  return col(parts);
}

const suffix = (label: string | null) => (label ? ` · ${label[0].toLowerCase()}${label.slice(1)}` : '');

function yourWeeklyLine(w: ScheduleWeekly, s: { top: WeeklyStanding[]; you: WeeklyStanding | null } | undefined): string {
  if (s?.you) return `You: #${s.you.rank} · +${weeklyGain(w, s.you.gained)}`;
  return !s || !s.top.length ? 'Standings unavailable' : 'You’re not on the board yet';
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

/** One event's page: the board, a weekly, or a bingo on the schedule. Null when `open` names nothing. */
export function eventUi(d: HomeData, open: string): Node | null {
  const back = backRow('All events', home());
  if (open === 'board') {
    const b = boardOf(d);
    return b ? col([back, gap(8), ...boardPage(d, b)]) : null;
  }
  const weekly = /^weekly:(\d+)$/.exec(open);
  if (weekly) {
    const w = d.cfg.panel?.weeklies?.find((x) => x.id === Number(weekly[1]));
    return w ? col([back, gap(8), ...weeklyPage(d, w)]) : null;
  }
  const event = /^event:(\d+)$/.exec(open);
  if (event) {
    const s = d.cfg.panel?.scheduled?.find((x) => x.id === Number(event[1]));
    return s ? col([back, gap(8), ...scheduledPage(d, s)]) : null;
  }
  return null;
}

function boardPage(d: HomeData, b: Board): Node[] {
  const parts: Node[] = [];
  const tiles = new Map((d.cfg.panel?.tiles ?? []).map((t) => [t.tileId, t]));
  const event = d.cfg.event;
  // Not playing this board (an alt while the main is on a team): the whole board, read-only.
  if (b.spectating && b.total > 0) {
    const eventId = d.cfg.homeBoard?.eventId ?? 0;
    return [text(b.title, 'brand'), muted(b.note ?? '', { wrap: true }), gap(8), button('View the board', { a: 'load', v: 'board', args: { event: String(eventId), back: 'board', backLabel: b.title } })];
  }

  parts.push(summary(d, b), gap(12));
  if (d.live && d.standings.length) {
    parts.push(...heading('Standings'));
    let shown = 0;
    for (const t of d.standings) {
      if (shown < STANDINGS_SHOWN || t.yours) {
        if (shown) parts.push(gap(3));
        parts.push(row(undefined, text(`${t.rank}. ${clip(t.name, 22)}`, t.yours ? 'brand' : 'text', { icon: icon({ glyph: 'swatch', color: (/^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#989898') as Color, w: 8, h: 8 }) }), text(t.score ?? '', t.yours ? 'brand' : 'muted'), {
          tip: `${t.name} — ${t.members} member${t.members === 1 ? '' : 's'}. Click for the roster.`,
          on: teams(b.title),
        }));
        shown++;
      }
    }
    if (d.standings.length > shown) parts.push(gap(3), muted(`+${d.standings.length - shown} more teams`));
    parts.push(gap(8));
  }
  if (d.live) parts.push(button(d.standings.length ? 'All teams & members' : 'Teams', teams(b.title), 'Who’s on which team'), gap(12));

  // The starting shot is this client's own: where it stands, its checks, its capture button.
  if (d.live && d.cfg.startProof) parts.push({ t: 'native', name: 'start-proof' }, gap(12));

  const pinned = (d.pins ?? []).filter((id) => tiles.has(id));
  if (d.live && event && pinned.length) {
    parts.push(...heading('Tracked on screen'));
    pinned.forEach((id, i) => {
      const t = tiles.get(id)!;
      parts.push(...(i ? [gap(8)] : []), row(undefined, progressRow(t.label, t, null, IN_PROGRESS, b.title), text('✕', 'muted', {
        tip: 'Stop tracking this tile',
        on: { a: 'pin', event: event.id, tile: id, on: false, then: home('board') },
      }), { gap: 6 }));
    });
    if (pinned.length > 1) parts.push(gap(6), button('Untrack all', { a: 'pin', event: event.id, tile: 0, on: false, then: home('board') }, 'Take every pinned tile off the screen'));
    parts.push(gap(12));
  }

  const active = (d.cfg.panel?.activeNow ?? []).filter((a) => tiles.has(a.tileId) && !tiles.get(a.tileId)!.complete && a.workers.length);
  if (d.live && active.length) {
    parts.push(...heading('Active now'));
    active.forEach((a, i) => parts.push(...(i ? [gap(8)] : []), progressRow(tiles.get(a.tileId)!.label, tiles.get(a.tileId)!, a, a.self ? 'brand' : IN_PROGRESS, b.title)));
    parts.push(gap(12));
  }

  const ladder = event && (b.ladder || event.missions?.length) ? event : null;
  if (d.live && ladder && !b.ladder && ladder.missions?.length) parts.push(...heading('Missions'), card([countdown(ladder, false), gap(4), ...missionRows(d, ladder, b.title)]), gap(12));

  const feed = foldFeed(d.feed);
  const actions = feed.filter((e) => e.kind !== 'reveal');
  const reveals = feed.filter((e) => e.kind === 'reveal');
  if (d.live && actions.length) parts.push(...heading(b.ladder ? 'Recent activity' : 'Team activity'), feedList(actions, tiles, b.title), gap(12));
  const missionStrip = !!ladder && (b.ladder || !!ladder.missions?.length);
  if (d.live && reveals.length && !missionStrip) parts.push(...heading('Just opened'), feedList(reveals, tiles, b.title), gap(12));

  if (d.live && b.total > 0) {
    const nearest = [...tiles.values()]
      .filter((t) => !t.complete)
      .sort((x, y) => frac(y) - frac(x) || x.position - y.position)
      .slice(0, NEAREST);
    parts.push(...heading('Nearest tiles'));
    if (!nearest.length) parts.push(muted('No tiles to show yet.'));
    nearest.forEach((t, i) => parts.push(...(i ? [gap(8)] : []), progressRow(t.label, t, null, IN_PROGRESS, b.title, true)));
    parts.push(gap(8), button(b.points ? 'View all tiles' : `View all ${b.total} tiles`, allTiles(b.title), 'Search the full board, including manual tiles'), { t: 'warm', on: allTiles(b.title) });
  }
  return parts;
}

const frac = (t: PanelTile) => (t.goal > 0 ? Math.min(1, t.current / t.goal) : 0);
const teams = (title: string): Action => ({ a: 'load', v: 'teams', args: { event: '0', back: 'board', backLabel: title } });

/** The board's headline card: the event, its tally and bar, the reveal note, the site link. */
function summary(d: HomeData, b: Board): Node {
  if (b.ladder && d.cfg.event) {
    const e = d.cfg.event;
    const m = e.monthlyStandings;
    const rank = !m || m.yourRank <= 0
      ? 'You: unranked — finish a mission to get on the board'
      : `You: #${m.yourRank} this month · ${m.yourPoints} pts${e.standings && e.standings.yourRank > 0 ? ` · #${e.standings.yourRank} all-time` : ''}`;
    return card([
      text(b.title, 'text', { font: 'regular' }),
      muted(rank, { wrap: true }),
      gap(6),
      countdown(e, true),
      gap(6),
      ...(e.missions?.length ? [text('Active missions', LIGHT), gap(2), ...missionRows(d, e, b.title)] : [text('Waiting for the next mission…', LIGHT)]),
      ...(d.boardPath ? [gap(6), siteLink('View standings', 'Open the full standings on the Anvil site', d.boardPath)] : []),
    ]);
  }
  const reveal = d.live && d.cfg.event ? revealNote(d.cfg.event, d.now) : null;
  return card([
    text(b.title, 'text', { font: 'regular' }),
    gap(4),
    ...(b.total <= 0
      ? [text(b.note ?? 'No active event yet.', LIGHT, { wrap: true })]
      : [muted(statusLine(b, d)), gap(2), { ...thickBar(pct(b.done, b.total)), h: 7 } as Node, ...(reveal ? [gap(2), text(reveal, 'brand')] : [])]),
    ...(d.boardPath && d.live ? [gap(6), siteLink('View standings', 'Open the full standings on the Anvil site', d.boardPath)] : []),
  ]);
}

/** "Next mission in 12:34", ticking in the plugin. */
function countdown(e: NonNullable<HomeConfig['event']>, ladder: boolean): Node {
  const none = ladder ? 'Next mission drops on a claim' : e.missionsLeft === 0 ? 'No more missions to come' : 'Next mission: whenever staff drop it';
  return { t: 'countdown', at: e.nextRevealAt ?? null, prefix: 'Next mission in ', due: 'New mission dropping…', none, font: 'bold', color: 'brand' };
}

function missionRows(d: HomeData, e: NonNullable<HomeConfig['event']>, title: string): Node[] {
  const tiles = new Map((d.cfg.panel?.tiles ?? []).map((t) => [t.tileId, t]));
  return (e.missions ?? []).map((m) => {
    const val = liveValue(m.points, m.revealedAt, e.decay ?? null, d.now);
    const color: Color = val === m.points ? 'muted' : val > m.points ? 'done' : 'brand';
    const parts: Node[] = [row(undefined, text(clip(m.label, 22)), text(val === m.points ? String(m.points) : `${m.points} -> ${val}`, color, { align: 'r' }), { bg: 'card' })];
    if (m.expiresAt) parts.push({ t: 'countdown', at: m.expiresAt, prefix: 'Expires in ', due: 'Expired', none: '', color: 'brand' });
    const p = tiles.get(m.tileId);
    if (p && p.goal > 0) {
      parts.push(gap(2), row(undefined, { t: 'bar', pct: p.complete ? 100 : percent(p.current, p.goal), color: p.complete ? 'done' : IN_PROGRESS, h: 6, bg: 'panel' }, muted(p.complete ? 'Done' : `${count(p.current)} / ${count(p.goal)}`, { tip: p.complete ? undefined : exact(p.current, p.goal) })));
    }
    return col(parts, { on: openTile(m.tileId, title) });
  });
}

/** A tile's line: name and count, a "who" byline, a bar; a click opens it on the board page. */
function progressRow(label: string, t: PanelTile, a: PanelActive | null, color: Color, title: string, nearest = false): Node {
  const big = nearest && t.goal >= 100_000;
  const value = nearest ? (t.complete ? 'Done' : t.goal <= 0 ? '—' : big ? `${percent(t.current, t.goal)}%` : `${t.current} / ${t.goal}`) : t.goal > 0 ? `${count(t.current)} / ${count(t.goal)}` : '';
  const who = a ? workersLine(a) : '';
  return col(
    [
      row(undefined, text(clip(label, 24), a?.self ? 'brand' : 'text'), muted(value, { tip: t.complete ? undefined : exact(t.current, t.goal) })),
      ...(who ? [gap(1), text(clip(who, 36), a?.self ? 'brand' : 'muted', { tip: who })] : []),
      gap(3),
      { t: 'bar', pct: t.complete ? 100 : percent(t.current, t.goal), color: t.complete ? 'done' : color, h: 6, bg: 'card' },
    ],
    { on: openTile(t.tileId, title), tip: tileTip(t) },
  );
}

const tileTip = (t: PanelTile) => (t.description?.trim() && t.description.trim().toLowerCase() !== t.label.trim().toLowerCase() ? `${t.label}\n${t.description.trim()}` : t.label);

function feedList(entries: ActivityEntry[], tiles: Map<number, PanelTile>, title: string): Node {
  const rows: Node[] = entries.slice(0, ACTIVITY_SHOWN).flatMap((e, i) => {
    const line = feedLine(e);
    const color: Color = e.kind === 'complete' ? 'done' : e.kind === 'reveal' || e.isSelf ? 'brand' : 'text';
    const t = tiles.get(e.tileId);
    const others = (e.participants ?? []).filter((p) => p && p !== e.player);
    const detail = e.kind === 'complete' && others.length ? `${line} — with ${others.join(', ')}` : line;
    return [...(i ? [gap(3)] : []), text(clip(line, 36), color, { tip: t ? `${tileTip(t)}\n\n${detail}` : detail, ...(e.tileId > 0 ? { on: openTile(e.tileId, title) } : {}) })];
  });
  if (entries.length > ACTIVITY_SHOWN) rows.push(gap(3), muted(`+${entries.length - ACTIVITY_SHOWN} more`));
  return col(rows);
}

// ---- A weekly, and a bingo on the schedule -----------------------------------------------------

function weeklyPage(d: HomeData, w: ScheduleWeekly): Node[] {
  const upcoming = w.status !== 'active';
  const s = d.weekly.get(w.id);
  const timing = timingLabel(upcoming, w.startDate, w.endDate, d.now);
  const headcount = s && s.total > 0 ? `${s.total} ${s.total === 1 ? 'player' : 'players'}` : null;
  const line = [timing, headcount].filter(Boolean).join(' · ');
  const path = `${d.clanPath}/weekly/${w.id}`;
  const parts: Node[] = [
    card([
      text(w.title || weeklyKind(w.type), 'text', { font: 'regular' }),
      text(`${weeklyKind(w.type)} · ${w.metricLabel}`, LIGHT),
      ...(line ? [muted(line)] : []),
      gap(4),
      upcoming ? text('No standings until it starts.', LIGHT) : text(yourWeeklyLine(w, s), s?.you ? 'brand' : LIGHT),
      upcoming ? siteLink('View event', 'Open this event on the Anvil site', path) : siteLink('View standings', 'Open the full standings on the Anvil site', path),
    ]),
  ];
  if (!upcoming) {
    parts.push(gap(12), ...heading('Standings'));
    if (!s || !s.top.length) parts.push(muted('No one has scored yet.'));
    else {
      let shown = 0;
      for (const r of s.top) {
        if (shown >= WEEKLY_SHOWN && !r.self) continue;
        if (shown >= WEEKLY_SHOWN) parts.push(gap(3), muted('…'));
        parts.push(gap(3), row(text(String(r.rank), 'muted', { w: 22, align: 'r' }), text(clip(r.rsn, 16), r.self ? 'brand' : 'text', { tip: r.rsn }), text(`+${weeklyGain(w, r.gained)}`, r.self ? 'brand' : 'muted', { align: 'r' })));
        shown++;
      }
    }
  }
  return parts;
}

function scheduledPage(d: HomeData, s: ScheduleBingo): Node[] {
  const live = s.status === 'active';
  const timing = timingLabel(!live, s.startDate, s.endDate, d.now);
  const entry =
    s.yourEntry === 'entered'
      ? text(live ? 'You’re in — your board shows once it loads.' : 'You’re signed up — waiting for it to start.', 'done', { wrap: true })
      : s.yourEntry === 'pending'
        ? text('Signed up — waiting for the host to approve.', 'text', { wrap: true })
        : text(live ? 'You’re not enrolled in this one.' : 'Sign up on the site to take part.', LIGHT, { wrap: true });
  const parts: Node[] = [
    card([
      text(s.title || 'Bingo', 'text', { font: 'regular' }),
      text(scheduledKind(s), LIGHT),
      ...(timing ? [text(timing, live ? 'done' : 'muted')] : []),
      ...(sizeLabel(s) ? [muted(sizeLabel(s))] : []),
      gap(4),
      entry,
      siteLink('View event', 'Open this event on the Anvil site', `${d.clanPath}/events/${s.id}`),
    ]),
    gap(8),
    button('Teams', { a: 'load', v: 'teams', args: { event: String(s.id), back: `event:${s.id}`, backLabel: s.title || 'Bingo' } }, 'Who’s on which team'),
  ];
  if ((s.tileCount ?? 0) > 0) {
    parts.push(gap(8), button(live ? 'Tiles' : 'Revealed tiles', { a: 'load', v: 'board', args: { event: String(s.id), pre: live ? '' : '1', back: `event:${s.id}`, backLabel: s.title || 'Bingo' } }));
  } else if (!live) {
    parts.push(gap(10), muted('Tiles will appear here when the host reveals them.', { wrap: true }));
  }
  return parts;
}
