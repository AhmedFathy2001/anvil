// The stream overlay — the rules. Pure: no database import (tests/pure-module-imports), so every
// decision about what an overlay may show is unit-tested without Postgres.
//
// An overlay is a page a streamer adds to OBS as a "Browser source": transparent, no site chrome,
// big outlined text. Its URL carries an unguessable per-event key (event_overlays), which is the
// host's consent to show the board on stream. The key is NOT a staff pass:
//
//   THE OVERLAY SHOWS WHAT THE PUBLIC SEES, NEVER MORE.
//
//   - Standings curtain down (lib/standingsVisibility) → no standings, no claimed tiles, no feed —
//     a notice instead. A stream is the most public surface there is; the curtain exists precisely
//     so nobody can read the race, and a streamer's audience includes the other teams.
//   - Board not revealed (`tilesRevealed`) → no tiles at all, not even the count.
//   - Staged reveals and missions → only the tiles the event has revealed (eventRules.visibleTiles).
//   - Deaths never show (the clan feed keeps them under their own chip; an overlay has none).
//
// Everything here takes already-loaded rows and returns the JSON the overlay renders; the loaders
// (lib/overlay/overlayData) do no filtering of their own beyond the queries.

import crypto from 'node:crypto';

export const OVERLAY_VIEWS = ['standings', 'feed', 'board'] as const;
export type OverlayView = (typeof OVERLAY_VIEWS)[number];

export function isOverlayView(v: unknown): v is OverlayView {
  return typeof v === 'string' && (OVERLAY_VIEWS as readonly string[]).includes(v);
}

// ── The key ──────────────────────────────────────────────────────────────────────────────────────

/** 24 random bytes → 32 base64url characters (192 bits). */
export function newOverlayKey(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** The exact shape newOverlayKey makes. Anything else is refused before it reaches a query. */
export function isOverlayKey(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{32}$/.test(v);
}

// ── Options from the query string ───────────────────────────────────────────────────────────────

export interface OverlayOptions {
  view: OverlayView;
  /** Text scale. 1 = the default, which is already large; OBS sources are usually scaled anyway. */
  scale: number;
  /** How many rows (standings / feed). */
  limit: number;
  /** Show the event name above the view. */
  title: boolean;
  /** Accent colour as #rrggbb (team colours stay their own). */
  accent: string;
  /** Text alignment of the whole overlay, for a source docked to the right of the scene. */
  align: 'left' | 'right';
  /**
   * Celebrate completions on stream: a short toast and a glow when a tile finishes (board) or a
   * team's score rises (standings); a glow on new feed rows. Opt-in (`celebrate=1`) so a link
   * already sitting in somebody's OBS scene never starts popping things up mid-stream.
   */
  celebrate: boolean;
}

export const SIZE_SCALES: Record<string, number> = { s: 0.8, m: 1, l: 1.3, xl: 1.7 };
const DEFAULT_ACCENT = '#e0aa1e';

function clampInt(raw: string | null, min: number, max: number, dflt: number): number {
  const n = raw == null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Read the overlay's options. Every value is checked against a closed set or clamped: the page puts
 * these into CSS and markup, so nothing is passed through as typed.
 */
export function parseOverlayOptions(params: URLSearchParams): OverlayOptions {
  const view = params.get('view');
  const size = (params.get('size') ?? '').toLowerCase();
  let scale = SIZE_SCALES[size] ?? 1;
  const rawScale = params.get('scale');
  if (rawScale != null && rawScale !== '') {
    const n = Number(rawScale);
    if (Number.isFinite(n)) scale = Math.min(3, Math.max(0.5, Math.round(n * 100) / 100));
  }
  const v: OverlayView = isOverlayView(view) ? view : 'standings';
  const accentRaw = (params.get('accent') ?? '').replace(/^#/, '');
  return {
    view: v,
    scale,
    limit: clampInt(params.get('limit'), 1, 20, v === 'feed' ? 6 : 5),
    title: params.get('title') !== '0',
    accent: /^[0-9a-f]{6}$/i.test(accentRaw) ? `#${accentRaw.toLowerCase()}` : DEFAULT_ACCENT,
    align: params.get('align') === 'right' ? 'right' : 'left',
    celebrate: params.get('celebrate') === '1',
  };
}

// ── What each view shows ────────────────────────────────────────────────────────────────────────

/** The curtain's state for the event, as loaded (standingsHidden / standingsRevealAt). */
export interface OverlayCurtain {
  hidden: boolean;
  /** When it lifts (ISO) — for the notice; null = at an end the event doesn't have yet. */
  revealAt: string | null;
}

export interface OverlayHeader {
  name: string;
  /** 'build' | 'run' | 'wrap' (lib/eventStage). */
  stage: string;
  endsAt: string | null;
  startsAt: string | null;
}

export interface OverlayNotice {
  notice: string;
}

export interface StandingsRowIn {
  teamId: number;
  name: string;
  color: string | null;
  score: number;
  total: number;
  unit: string;
  pct: number;
}

export interface StandingsRowOut {
  rank: number;
  name: string;
  color: string;
  score: number;
  total: number;
  unit: string;
  pct: number;
}

export type StandingsPayload = { rows: StandingsRowOut[] } | OverlayNotice;

const FALLBACK_TEAM = ['#d9534f', '#5b8def', '#3fbf7f', '#b06fe0', '#e0aa1e', '#3fc1c9'];

/** Team colours are free text in principle; only a hex colour reaches the overlay's CSS. */
export function safeColor(raw: string | null | undefined, i: number): string {
  return raw && /^#[0-9a-f]{6}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : FALLBACK_TEAM[i % FALLBACK_TEAM.length];
}

export function curtainNotice(c: OverlayCurtain): string {
  if (c.revealAt) {
    const d = new Date(c.revealAt);
    if (Number.isFinite(d.getTime())) {
      return `Standings are hidden until ${d.toUTCString().replace(/:\d\d GMT$/, ' UTC')}`;
    }
  }
  return 'Standings are hidden until the end of the event';
}

/** Ranked teams, or the curtain's notice. Ties share a rank. */
export function standingsPayload(rows: StandingsRowIn[], curtain: OverlayCurtain, limit: number): StandingsPayload {
  if (curtain.hidden) return { notice: curtainNotice(curtain) };
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const out: StandingsRowOut[] = [];
  let rank = 0;
  let prev: number | null = null;
  sorted.forEach((r, i) => {
    if (prev === null || r.score !== prev) rank = i + 1;
    prev = r.score;
    out.push({
      rank,
      name: r.name,
      color: safeColor(r.color, i),
      score: r.score,
      total: r.total,
      unit: r.unit,
      pct: Math.max(0, Math.min(100, Math.round(r.pct))),
    });
  });
  return { rows: out.slice(0, limit) };
}

export interface FeedItemIn {
  /** A stable id, so the overlay animates only what is new. */
  id: string;
  kind: 'moment' | 'tile';
  /** Moment kind ('drop' | 'pet' | 'death' | …) or 'tile'. */
  sub: string;
  text: string;
  who: string | null;
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  icon: string | null;
  at: string;
}

export interface FeedItemOut {
  id: string;
  sub: string;
  text: string;
  who: string | null;
  team: string | null;
  color: string | null;
  icon: string | null;
  at: string;
}

export type FeedPayload = { items: FeedItemOut[] } | OverlayNotice;

/**
 * The latest drops and finished tiles, newest first.
 *
 * Under the curtain the public sees no team's lines (lib/pluginUi/feedView eventRows: a viewer with
 * no team sees only their own, which is nothing), so the overlay shows the notice. Deaths are left
 * out entirely, and an item icon must be one of our own asset paths.
 */
export function feedPayload(items: FeedItemIn[], curtain: OverlayCurtain, limit: number): FeedPayload {
  if (curtain.hidden) return { notice: curtainNotice(curtain) };
  const ms = (s: string) => {
    const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
    return Number.isFinite(t) ? t : 0;
  };
  const out = items
    .filter((i) => i.sub !== 'death')
    .sort((a, b) => ms(b.at) - ms(a.at))
    .slice(0, limit)
    .map((i) => ({
      id: i.id,
      sub: i.sub,
      text: i.text,
      who: i.who,
      team: i.teamName,
      color: i.teamName ? safeColor(i.teamColor, i.teamId ?? 0) : null,
      icon: safeIcon(i.icon),
      at: new Date(ms(i.at)).toISOString(),
    }));
  return { items: out };
}

/** Only a same-origin asset path (/img/…) may be an overlay image — no hotlinks, no other schemes. */
export function safeIcon(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return /^\/img\/[A-Za-z0-9_./%-]+$/.test(raw) && !raw.includes('..') ? raw : null;
}

export interface BoardTileIn {
  id: number;
  label: string;
  icon: string | null;
}

export interface BoardCellOut {
  label: string;
  icon: string | null;
  /** The colours of the teams that finished it, earliest first. Empty under the curtain. */
  done: string[];
}

export type BoardPayload = { cols: number; cells: BoardCellOut[] } | OverlayNotice;

/** The most cells the compact board draws. */
export const MAX_BOARD_CELLS = 100;

/**
 * The compact board.
 *
 * `tiles` must already be the tiles the public may see (revealed board, visibleTiles, board cells
 * only) in board order; `revealed` false means the board itself is still hidden. Claims are dropped
 * under the curtain — the shape of the board is not progress, who has finished what is.
 */
export function boardPayload(opts: {
  revealed: boolean;
  tiles: BoardTileIn[];
  /** tileId → team ids in the order they finished it. */
  claims: Map<number, number[]>;
  teamColors: Map<number, string>;
  curtain: OverlayCurtain;
  /** A square grid's side, or null for a list board (drawn 5 wide). */
  square: number | null;
}): BoardPayload {
  if (!opts.revealed) return { notice: 'The board is not revealed yet' };
  const cells = opts.tiles.slice(0, MAX_BOARD_CELLS).map((t) => ({
    label: t.label,
    icon: safeIcon(t.icon),
    done: opts.curtain.hidden
      ? []
      : (opts.claims.get(t.id) ?? []).map((team) => opts.teamColors.get(team)).filter((c): c is string => !!c),
  }));
  if (!cells.length) return { notice: 'No tiles yet' };
  const cols = opts.square && opts.square > 0 ? Math.min(10, opts.square) : 5;
  return { cols: Math.min(cols, cells.length), cells };
}

// ── The wire ────────────────────────────────────────────────────────────────────────────────────

export interface OverlayPayload {
  header: OverlayHeader;
  view: OverlayView;
  /** Standings / feed / board, by `view`. */
  body: StandingsPayload | FeedPayload | BoardPayload;
  /** Show the small "Anvil" mark in the corner (a creator space's plan — lib/creatorPlans). */
  mark?: boolean;
}

/** A weak ETag over the payload, so a poll that changes nothing costs a 304 and no body. */
export function overlayEtag(json: string): string {
  return `W/"${crypto.createHash('sha1').update(json).digest('base64url').slice(0, 22)}"`;
}

/** Does an If-None-Match header name this ETag? */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(',').some((t) => t.trim() === etag || t.trim() === '*');
}

/** How often the overlay page polls, in ms. Live enough for a stream; a 304 when nothing moved. */
export const OVERLAY_POLL_MS = 10_000;

/**
 * The poll while the page holds a live socket to the push server (lib/push/hub, watchers): changes
 * arrive as a nudge within a couple of seconds, so the timer is only a safety net for a lost one.
 */
export const OVERLAY_LIVE_POLL_MS = 60_000;
