import { type Action, type Color, type Node, card, col, icon, muted, row, text } from './nodes';

// The panel's page pattern, shared by every Clan-tab page (the race, a bingo, a ladder, a weekly, a
// clan event): a back line with the page's kind, the event's name, a top card that says where you
// are, at most one gold "Do this next" card, compact standings, then activity. Colours mean one
// thing each, and only on chips and small text:
//   green done · gold you / your action · coral urgent · blue info, upcoming, live · purple rare.

export const GREEN: Color = '#5fd35f';
export const GOLD: Color = '#ff981f';
export const CORAL: Color = '#ff7a6b';
export const BLUE: Color = '#6fb6ff';
export const PURPLE: Color = '#c79bff';
export const LATER: Color = '#4a4a4a';
export const FAINT: Color = '#a0a0a0';
export const SOFT: Color = '#c8c8c8';
export const PROGRESS: Color = '#ffd27a';
/** Wrap width (pt) of text straight in a card. */
export const CARD_W = 185;
/** "View all" opens in place up to this many entrants; more page through the Teams view. */
export const STANDINGS_INLINE_MAX = 100;
/** Under this long a countdown turns coral. */
export const URGENT_MS = 15 * 60_000;

/** Chip grounds for the semantic colours: a dark tint behind the light ink. */
const CHIP: Record<'green' | 'gold' | 'coral' | 'blue' | 'purple' | 'grey', [Color, Color]> = {
  green: ['#1f3320', '#7fe07f'],
  gold: ['#3a2a14', '#ffb54d'],
  coral: ['#3a1f1c', '#ff8f82'],
  blue: ['#1b2a3a', '#8cc8ff'],
  purple: ['#2e2140', '#d4a8ff'],
  grey: ['#3a3a3a', SOFT],
};

export const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`);
export const title = (s: string, color: Color = 'white'): Node => text(s, color, { font: 'bold' });
/** The big line of a top card ("14 of 25 tiles"). */
export const big = (s: string, color: Color = 'white'): Node => text(s, color, { font: 'bold' });
export const section = (c: (Node | null | false | undefined)[], extra: Partial<Extract<Node, { t: 'col' }>> = {}): Node => card(c, { inset: 10, gap: 6, ...extra });
export const chip = (s: string, kind: keyof typeof CHIP, extra: Partial<Extract<Node, { t: 'text' }>> = {}): Node => text(s, CHIP[kind][1], { chip: CHIP[kind][0], font: 'small', ...extra });
export const small = (s: string, color: Color, extra: Partial<Extract<Node, { t: 'text' }>> = {}): Node => text(s, color, { font: 'small', ...extra });
export const link = (s: string, on: Action, tip?: string): Node => text(s, GOLD, { font: 'small', on, ...(tip ? { tip } : {}) });
const chevron = () => icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT });

/** "‹ All events" on the left, the page's kind on the right, then the event's name. */
export function pageHead(back: Action, backLabel: string, kind: string, name?: string, tip = 'Back to your events'): Node {
  return col([
    row(text(backLabel, 'muted', { icon: icon({ glyph: 'chevron-left', w: 9, h: 9, color: 'muted' }), on: back, tip }), undefined, muted(kind)),
    ...(name ? [text(name, 'brand', { font: 'bold', wrap: 205 })] : []),
  ], { gap: 4 });
}

/** The gold card: "▶ Do this next" (or its own head) over what to do. At most one per page. */
export function goldCard(head: string, body: (Node | null | false | undefined)[]): Node {
  return section([text(head, GOLD, { font: 'bold', icon: icon({ glyph: 'chevron-right', w: 10, h: 10, color: GOLD }) }), ...body], { edge: GOLD });
}

/** A lighter rounded row to open: its lines, a chevron at the right of the first. */
export function openRow(first: Node, right: Node | undefined, lines: Node[], on: Action, tip?: string, edge?: Color): Node {
  const top = row(undefined, first, row(right, undefined, chevron(), { gap: 6 }), { gap: 6 });
  return col([top, ...lines], { bg: 'raised', inset: 8, gap: 4, on, ...(tip ? { tip } : {}), ...(edge ? { edge } : {}) });
}

/** A bar in cells: done green, now gold, the rest grey. Past 40 cells a plain bar reads better. */
export function cells(done: number, total: number, now = 0): Node {
  if (total > 40) return { t: 'bar', pct: total > 0 ? Math.min(100, Math.round((done * 100) / total)) : 0, color: done >= total ? 'done' : 'brand', h: 6, bg: 'panel' };
  return { t: 'segs', c: Array.from({ length: Math.max(1, total) }, (_, i) => (i < done ? GREEN : i < done + now ? GOLD : LATER)) };
}

/** A thin progress bar in a row (a tile's 4 / 5). */
export const thin = (pct: number, done = false, live?: Extract<Node, { t: 'bar' }>['live']): Node => ({ t: 'bar', pct, color: done ? 'done' : 'brand', h: 5, bg: 'panel', ...(live ? { live } : {}) });

/** "▲3" green / "▼2" coral beside a rank: places moved since the day began. Nothing when unchanged. */
export function moveMark(move: number | null | undefined): Node | undefined {
  if (!move) return undefined;
  const up = move > 0;
  const ink = up ? GREEN : CORAL;
  return text(String(Math.abs(move)), ink, { font: 'small', icon: icon({ glyph: up ? 'up' : 'down', w: 7, h: 7, color: ink, alt: up ? '+' : '-' }), tip: `${up ? 'Up' : 'Down'} ${Math.abs(move)} since the day began` });
}

/** A rank line's left side: the words, and the move after them. */
export function withMove(words: Node, move: number | null | undefined): Node {
  const m = moveMark(move);
  return m ? row(words, m, undefined, { gap: 5 }) : words;
}

/** A countdown in blue, coral once under 15 minutes (decided when drawn; the panel refreshes often). */
export function clock(at: string | null | undefined, prefix: string, due: string, now: number, extra: Partial<Extract<Node, { t: 'countdown' }>> = {}): Node {
  const left = at ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(at) ? at.replace(' ', 'T') : `${at.replace(' ', 'T')}Z`) - now : NaN;
  return { t: 'countdown', at: at ?? null, prefix, due, none: '', color: Number.isFinite(left) && left < URGENT_MS ? CORAL : BLUE, font: 'small', ...extra };
}

/** One stop on a vertical track. */
export function stop(dot: 'done' | 'now' | 'todo' | 'end', head: Node, sub: Node, on?: Action, last = false, tip = 'Open this tile'): Node {
  const line: Color | undefined = last ? undefined : dot === 'done' ? GREEN : LATER;
  return { t: 'step', dot, ...(line ? { line } : {}), c: col([head, sub]), ...(on ? { on, tip } : {}) };
}

/** The first `shown` nodes, then "+N more" that opens the rest in place (and "Show less"). */
export function more(nodes: Node[], shown: number, key: string, gapPx = 4): Node[] {
  if (nodes.length <= shown) return nodes;
  const flip: Action = { a: 'flip', key };
  return [{
    t: 'toggle',
    key,
    off: col([...nodes.slice(0, shown), link(`+${nodes.length - shown} more`, flip)], { gap: gapPx }),
    lit: col([...nodes, link('Show less', flip)], { gap: gapPx }),
  }];
}

/**
 * Any board's standings, compact: the top three and your own line(s) with "· · ·" between, then
 * "View all N" — the rest open in place (a toggle) when there are few enough, else `all` (the paged
 * Teams view). Shared by every competition the panel shows.
 */
export function compactStandings<T>(rows: T[], mine: (r: T) => boolean, line: (r: T) => Node, all: Action | null, key: string, total = rows.length): Node[] {
  const top = rows.slice(0, 3);
  const yours = rows.filter((r, i) => i >= 3 && mine(r)).slice(0, 3);
  const dots = row(undefined, muted('· · ·', { align: 'c' }), undefined);
  const compact: Node[] = [...top.map(line), ...(yours.length ? [dots, ...yours.map(line)] : [])];
  if (total <= top.length + yours.length && rows.length === total) return compact;
  const go = (s: string, on: Action) => link(s, on);
  if (rows.length < total || rows.length > STANDINGS_INLINE_MAX) return [...compact, ...(all ? [go(`View all ${total.toLocaleString('en-US')}`, all)] : [])];
  const flip: Action = { a: 'flip', key: `standings:${key}` };
  return [{ t: 'toggle', key: `standings:${key}`, off: col([...compact, go(`View all ${total.toLocaleString('en-US')}`, flip)], { gap: 5 }), lit: col([...rows.map(line), go('Show less', flip)], { gap: 5 }) }];
}

/** The standings card: "Standings" and a count, the compact rows, and an extra link under them. */
export function standingsCard(rows: Node[], count?: string, foot?: Node): Node {
  return section([row(undefined, title('Standings'), count ? muted(count) : undefined), ...rows, ...(foot ? [foot] : [])], { gap: 5 });
}

/** Chip grounds for a feed row's picture: purple rare, green done, coral a death. */
export const TINT = { purple: CHIP.purple[0], green: CHIP.green[0], coral: CHIP.coral[0] } as const;

/**
 * A segmented switch whose segments go somewhere (Feed | Chat, Players | Clans): the lit one is
 * `on`. Drawn by the plugin's `tabs` node; a plugin from before link segments shows nothing.
 */
export function segSwitch(key: string, items: { label: string; on: boolean; act: Action }[]): Node {
  return { t: 'tabs', key, tabs: items.map((i) => ({ label: i.label, on: i.act, ...(i.on ? { sel: true } : {}) })) };
}

/** A filter chip in a grid: grey outline, the lit one raised with a gold edge. */
export function boxChip(label: string, on: boolean, act: Action, tip?: string): Node {
  // A row, so the label's centre stretches the full cell and centres in it.
  return row(undefined, text(label, on ? 'white' : FAINT, { font: 'small', align: 'c' }), undefined, {
    bg: on ? 'raised' : 'panel',
    edge: on ? GOLD : LATER,
    pad: 3,
    on: act,
    ...(tip ? { tip } : {}),
  });
}

/** "Name ........ 312 / 500" over a progress bar: a goal, a log category, anything with a target. */
export function progressRow(name: Node, right: Node, pct: number, done = false, color?: Color): Node {
  return col([row(undefined, name, right, { gap: 6 }), { t: 'bar', pct, color: color ?? (done ? 'done' : 'brand'), h: 6, bg: 'panel' }], { gap: 3 });
}
