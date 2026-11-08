import { type Action, type Color, type Node, card, col, count, gap, icon, muted, row, text } from './nodes';
import { type Board, type BoardContext, type BoardState, type BoardTile, pinAction, raceModel, racePayload, trackingLines } from './boardUi';
import { roadOf, type RaceGraph, type TeamRoute } from '@/lib/raceRoutes';
import { ordinal, raceLines } from '@/lib/raceSummary';

// A tile race on the plugin's Clan tab, the way a player reads it at a glance: where am I (state,
// rank, a bar of steps), the one thing to do next, the road ahead as a vertical track, and the
// standings cut to the top three and you. A tile opens its detail IN PLACE of the page (a `nav`
// slot): one "Back to the race" button, and the way back lands where the reader was, that row
// outlined. Pure; views.ts gathers the board.

/** Road letter badge colours (ground, letter), A first; the mockup's three, then two more. */
const ROADS: [Color, Color][] = [
  ['#5a4a2a', '#ffd27a'],
  ['#2a4a5a', '#9fd8ff'],
  ['#4a2a5a', '#e0b0ff'],
  ['#2a5a3a', '#9fe0a8'],
  ['#5a2a2a', '#ff9f9f'],
];
const GREEN: Color = '#5fd35f';
const GOLD: Color = '#ff981f';
const LATER: Color = '#444444';
const FAINT: Color = '#888888';
const SOFT: Color = '#c8c8c8';
const PROGRESS: Color = '#ffd27a';
/** Wrap widths (pt): text straight in a card, and beside a track's dots. */
const CARD_W = 185;
const TRACK_W = 178;
/** "View all" opens in place up to this many entrants; more page through the Teams view. */
export const STANDINGS_INLINE_MAX = 100;
export const NAMES_SHOWN = 5;

const roadInk = (letter: string): [Color, Color] => ROADS[Math.max(0, letter.charCodeAt(0) - 65) % ROADS.length];
/** The small square road letter. */
export const roadBadge = (letter: string): Node => text(letter, roadInk(letter)[1], { chip: roadInk(letter)[0], w: 18, align: 'c' });
/** "Road B" as a tinted chip. */
export const roadChip = (letter: string): Node => text(`Road ${letter}`, roadInk(letter)[1], { chip: roadInk(letter)[0] });

const pane = (name: string): Action => ({ a: 'pane', into: 'race', pane: name });
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`);
const title = (s: string, color: Color = 'white'): Node => text(s, color, { font: 'bold' });
const section = (c: (Node | null | false | undefined)[], extra: Partial<Extract<Node, { t: 'col' }>> = {}): Node => card(c, { inset: 10, gap: 6, ...extra });
const hasRoads = (g: RaceGraph, id: number) => (g.steps[g.byId.get(id)?.step ?? -1]?.length ?? 0) > 1;

export interface RacePageOpts {
  /** The event's name over the page. */
  title: string;
  /** The page's one way back, and its words ("All events"). */
  back: Action;
  backLabel?: string;
  /** What a "Pick this road" posts with (act race-pick): where the answer redraws. */
  pick: Record<string, string>;
  /** The board page's sections that still belong under the race (feed links, the starting shot, …). */
  rest: Node[];
  ctx: BoardContext;
  /** Every team, a page at a time (a field too big to open in place). */
  teams: Action;
  /** After a pin or a pick: this page again. */
  reload: Action;
}

/** The race page as a nav slot: pane `main`, and `t:<id>` per route tile. Null off a race or for a spectator. */
export function racePageUi(board: Board, o: RacePageOpts): Node | null {
  const race = racePayload(board);
  const m = raceModel(board);
  if (!race || !m || !m.route) return null;
  const tiles = board.tiles as BoardTile[];
  const byId = new Map(tiles.map((t) => [t.tileId, t]));
  const name = (id: number) => byId.get(id)?.label?.trim() || `Tile ${id}`;
  const ctx = { ...m, race, name, byId, board, o };
  const panes: Record<string, Node> = { main: col(mainPage(ctx), { gap: 10 }) };
  for (const id of m.graph.byId.keys()) if (byId.has(id)) panes[`t:${id}`] = col(tilePage(ctx, byId.get(id)!), { gap: 10 });
  return { t: 'slot', id: 'race', nav: true, open: 'main', panes, c: gap(0) };
}

interface Ctx {
  graph: RaceGraph;
  route: TeamRoute | null;
  race: NonNullable<ReturnType<typeof racePayload>>;
  name: (id: number) => string;
  byId: Map<number, BoardTile>;
  board: Board;
  o: RacePageOpts;
}

// ---- The page ------------------------------------------------------------------------------------

function mainPage(x: Ctx): Node[] {
  const route = x.route!;
  return [
    col([
      row(text(x.o.backLabel ?? 'All events', 'muted', { icon: icon({ glyph: 'chevron-left', w: 9, h: 9, color: 'muted' }), on: x.o.back, tip: 'Back to your events' }), undefined, muted('Tile race')),
      gap(4),
      text(x.o.title, 'brand', { font: 'bold' }),
    ]),
    whereCard(x),
    nextCard(x, route),
    track(x, route),
    standingsCard(x),
    ...(x.o.rest.length ? [col(x.o.rest)] : []),
  ];
}

/** "Not started" / "Step 2 of 4" / "Finished", the rank, the bar of steps and one quiet line. */
export function whereCard(x: Pick<Ctx, 'graph' | 'route' | 'race' | 'board'>): Node {
  const r = x.race;
  const done = x.route?.stepsDone ?? 0;
  const state = r.finished ? 'Finished' : done === 0 ? 'Not started' : `Step ${done + 1} of ${r.steps}`;
  const segs: Color[] = Array.from({ length: r.steps }, (_, i) => (i < done || r.finished ? GREEN : i === done && done > 0 ? GOLD : LATER));
  const cur = x.route?.path[x.route.path.length - 1];
  const leader = (r.standings ?? [])[0];
  const leaderName = leader ? x.board.teams.find((t) => t.teamId === leader.teamId)?.name ?? 'The leader' : null;
  const behind = Math.max(0, r.leaderSteps - done);
  let line: Node;
  if (done === 0 && !r.finished) {
    const lead = leader && leaderName && leader.teamId !== x.board.yourTeamId
      ? leader.finished ? ` · ${clip(leaderName, 16)} already finished` : leader.stepsDone > 0 ? ` · ${clip(leaderName, 16)} is on step ${leader.stepsDone + 1}` : ''
      : '';
    line = muted(`${r.steps} steps to the finish${lead}`, { wrap: CARD_W });
  } else {
    const words = r.finished ? 'Finished the race' : behind === 0 ? (r.entrants > 1 ? 'In the lead' : 'On your own') : `${behind} behind the leader`;
    line = row(cur != null && hasRoads(x.graph, cur) && !r.finished ? roadChip(roadOf(x.graph, cur)) : undefined, muted(words), undefined, { gap: 6 });
  }
  return section([
    row(undefined, title(state), r.rank != null ? text(`${ordinal(r.rank)} of ${r.entrants}`, SOFT) : undefined),
    { t: 'segs', c: segs },
    line,
  ]);
}

function tileRow(x: Ctx, id: number, letter: boolean, right?: Node, current = false): Node {
  const t = x.byId.get(id);
  return row(letter ? roadBadge(roadOf(x.graph, id)) : undefined, text(clip(x.name(id), 26), '#e6e6e6', { tip: x.name(id) }), row(right, undefined, icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT }), { gap: 6 }), {
    gap: 8,
    pad: 8,
    bg: 'raised',
    ...(current ? { edge: GOLD } : {}),
    on: pane(`t:${id}`),
    tip: `${x.name(id)}${t?.description?.trim() ? ` — ${t.description.trim()}` : ''}`,
  });
}

/** The gold card: the open tile(s), or the fork to pick from, each opening its detail. */
function nextCard(x: Ctx, route: TeamRoute): Node {
  const head = text('Do this next', GOLD, { font: 'bold', icon: icon({ glyph: 'chevron-right', w: 10, h: 10, color: GOLD }) });
  if (x.race.finished) return section([title('Finished!', GREEN), muted('Your road is done. The standings below say where you placed.', { wrap: CARD_W })]);
  if (route.pickFrom.length) {
    return section([head, text('Pick your road first: open one and press Pick. A pick can’t be changed.', SOFT, { wrap: CARD_W }), ...route.pickFrom.map((id) => tileRow(x, id, true))], { edge: GOLD });
  }
  if (route.open.length > 1) {
    return section([head, text('Get any one of these. The first you finish picks your road.', SOFT, { wrap: CARD_W }), ...route.open.map((id) => tileRow(x, id, hasRoads(x.graph, id)))], { edge: GOLD });
  }
  const id = route.open[0];
  if (id == null) return section([head, muted('Nothing is open for your team right now.', { wrap: CARD_W })], { edge: GOLD });
  const p = x.o.ctx.progress.get(id);
  const prog = p && p.goal > 1 ? text(`${count(Math.min(p.current, p.goal))}/${count(p.goal)}`, PROGRESS, { live: { tile: id, cur: p.current, goal: p.goal, fmt: 'raw' } }) : undefined;
  return section([head, tileRow(x, id, false, prog, true), muted('Only this one counts now. Drops for later tiles don’t count yet.', { wrap: CARD_W, color: FAINT })], { edge: GOLD });
}

/** One stop on the track. */
function stop(dot: 'done' | 'now' | 'todo' | 'end', head: Node, sub: Node, on?: Action, last = false): Node {
  const line: Color | undefined = last ? undefined : dot === 'done' ? GREEN : LATER;
  return { t: 'step', dot, ...(line ? { line } : {}), c: col([head, sub]), ...(on ? { on, tip: 'Open this tile' } : {}) };
}

/**
 * The road ahead. Past a fork the team hasn't taken yet the road isn't known: those steps say so
 * ("Depends on your road", or "Roads cross here" where a tile has several ways in). Once the team is
 * on a road, each later step is the tile that road leads to, and where the road splits the other
 * ways are offered as "or switch: C: <tile>".
 */
export function trackStops(x: Pick<Ctx, 'graph' | 'route' | 'name' | 'race'>): Node[] {
  const g = x.graph;
  const route = x.route!;
  const out: Node[] = [];
  const last = g.lastStep;
  const done = x.race.finished ? last + 1 : route.path.length;
  const sub = (s: string, color: Color = FAINT) => text(s, color, { font: 'small', wrap: TRACK_W });
  route.path.forEach((id, step) => {
    if (step > last) return;
    out.push(stop('done', text(clip(x.name(id), 28), GREEN), sub(`${step === last ? 'Finish' : `Step ${step + 1}`} · done`), pane(`t:${id}`), step === last));
  });
  if (x.race.finished) return out;
  // Where the team stands: one open tile is "you are here"; several (a fork) are in the gold card.
  let at: number | null = route.open.length === 1 && route.pickFrom.length === 0 ? route.open[0] : null;
  if (at != null) out.push(stop('now', text(clip(x.name(at), 28), 'white', { font: 'bold' }), sub(`${done === last ? 'Finish' : `Step ${done + 1}`} · you are here`, GOLD), pane(`t:${at}`), done === last));
  for (let step = done + 1; step <= last; step++) {
    const end = step === last;
    const ids = g.steps[step];
    const dot = end ? 'end' : 'todo';
    const word = end ? 'Finish' : `Step ${step + 1}`;
    const ways = at != null ? g.byId.get(at)!.next.filter((id) => ids.includes(id)) : [];
    if (at != null && ways.length) {
      // Keep to the road the team is on; the rest are switches.
      const road = roadOf(g, at);
      const main = ways.find((id) => roadOf(g, id) === road) ?? ways[0];
      const others = ways.filter((id) => id !== main);
      const other = others[0];
      const subLine = other != null
        ? row(text(`${word} · or switch: `, FAINT, { font: 'small' }), text(clip(`${roadOf(g, other)}: ${x.name(other)}`, 22), roadInk(roadOf(g, other))[1], { font: 'small', on: pane(`t:${other}`), tip: `Open ${x.name(other)}` }), undefined, { gap: 0 })
        : sub(word);
      out.push(stop(dot, text(clip(x.name(main), 28), 'text'), subLine, pane(`t:${main}`), end));
      at = main;
    } else if (ids.length === 1) {
      out.push(stop(dot, text(word, 'text'), sub(`${clip(x.name(ids[0]), 22)} · same for everyone`), pane(`t:${ids[0]}`), end));
      at = ids[0];
    } else {
      const cross = ids.some((id) => (g.prev.get(id)?.length ?? 0) > 1);
      out.push(stop(dot, text(word, 'text'), sub(cross ? 'Roads cross here: you can switch' : 'Depends on your road'), undefined, end));
      at = null;
    }
  }
  return out;
}

function track(x: Ctx, route: TeamRoute): Node {
  const started = route.path.length > 0 || (route.open.length === 1 && !route.pickFrom.length);
  return col([title(started ? 'Your road' : 'After that'), gap(4), ...trackStops(x)]);
}

/** A team's place in words: "Finished", "Step 3", "Not started". */
const placeWord = (s: { stepsDone: number; finished: boolean }) => (s.finished ? 'Finished' : s.stepsDone === 0 ? 'Not started' : `Step ${s.stepsDone + 1}`);

/** Top three, "· · ·", you, and "View all N": in place, or the Teams pages for a big field. */
function standingsCard(x: Ctx): Node {
  const st = x.race.standings ?? [];
  const names = new Map(x.board.teams.map((t) => [t.teamId, t.name ?? 'Team']));
  const you = x.board.yourTeamId;
  const line = (s: (typeof st)[number]) => {
    const mine = s.teamId === you;
    const ink: Color = mine ? GOLD : SOFT;
    return row(text(`${s.rank}  ${mine ? 'You' : clip(names.get(s.teamId) ?? 'Team', 20)}`, ink), undefined, text(placeWord(s), s.finished && !mine ? GREEN : ink), { gap: 6 });
  };
  return section([title('Standings'), ...compactStandings(st, (s) => s.teamId === you, line, x.o.teams, `race:${x.o.ctx.eventId}`)], { gap: 5 });
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
  const link = (s: string, on: Action) => text(s, GOLD, { on, font: 'small' });
  if (rows.length < total || rows.length > STANDINGS_INLINE_MAX) return [...compact, ...(all ? [link(`View all ${total.toLocaleString('en-US')}`, all)] : [])];
  const flip: Action = { a: 'flip', key: `standings:${key}` };
  return [{ t: 'toggle', key: `standings:${key}`, off: col([...compact, link(`View all ${total.toLocaleString('en-US')}`, flip)], { gap: 5 }), lit: col([...rows.map(line), link('Show less', flip)], { gap: 5 }) }];
}

// ---- One tile ------------------------------------------------------------------------------------

const STATE_CHIP: Record<string, [string, Color, Color]> = {
  open: ['Do this next', GOLD, '#1e1e1e'],
  pick: ['Pick one', GOLD, '#1e1e1e'],
  done: ['Done', '#2f5f2f', GREEN],
  ahead: ['Later', '#3a3a3a', SOFT],
  closed: ['Off your road', '#3a3a3a', FAINT],
};

/** The names in a "Done it" / "On it now" card: the first five, then "+N more" opening the rest. */
function namesCard(head: string, teams: { name: string; color: Color }[], word: string, key: string): Node | null {
  if (!teams.length) return null;
  // One wrapped line of names, each in its team's colour.
  const grid = (list: typeof teams): Node => text('', SOFT, { wrap: CARD_W, runs: list.flatMap((t, i) => [...(i ? [{ s: ', ' }] : []), { s: t.name, color: t.color }]) });
  const more = teams.length - NAMES_SHOWN;
  const flip: Action = { a: 'flip', key };
  const body: Node = more > 0
    ? { t: 'toggle', key, off: col([grid(teams.slice(0, NAMES_SHOWN)), text(`+${more} more`, GOLD, { font: 'small', on: flip })], { gap: 4 }), lit: col([grid(teams), text('Show less', GOLD, { font: 'small', on: flip })], { gap: 4 }) }
    : grid(teams);
  return section([row(undefined, title(head), text(`${teams.length} ${word}`, SOFT)), body]);
}

function tilePage(x: Ctx, t: BoardTile): Node[] {
  const g = x.graph;
  const route = x.route!;
  const id = t.tileId;
  const node = g.byId.get(id)!;
  const state = route.pickFrom.includes(id) ? 'pick' : route.state.get(id) ?? 'ahead';
  const chip = STATE_CHIP[state] ?? STATE_CHIP.ahead;
  const p = x.o.ctx.progress.get(id);
  const prog = state === 'open' && p && p.goal > 1 ? text(`${count(Math.min(p.current, p.goal))} of ${count(p.goal)}`, PROGRESS, { live: { tile: id, cur: p.current, goal: p.goal, fmt: 'raw' } }) : undefined;
  const where = `${node.step === g.lastStep ? 'Finish' : `Step ${node.step + 1}`}${hasRoads(g, id) ? ` · Road ${roadOf(g, id)}` : ''}`;
  const out: Node[] = [
    row(undefined, text('Back to the race', '#e6e6e6', { icon: icon({ glyph: 'chevron-left', w: 9, h: 9, color: '#e6e6e6' }) }), undefined, { bg: 'raised', pad: 8, on: pane('main'), tip: 'Back to the race' }),
    col([muted(where), text(x.name(id), 'white', { font: 'bold', wrap: 205 }), row(text(chip[0], chip[2], { chip: chip[1], font: 'small' }), prog, undefined, { gap: 6 })], { gap: 4 }),
  ];

  // What counts: the tile's own words, then exactly what the plugin watches.
  const lines = trackingLines(t);
  const what = [t.description?.trim(), ...lines.filter((l) => l.trim() && l.trim() !== t.description?.trim())].filter((s): s is string => !!s);
  out.push(section([
    title('What counts'),
    ...(what.length ? what.slice(0, 8).map((s) => text(s.trim(), SOFT, { wrap: CARD_W })) : [text(t.requirement?.trim() || 'See the tile on the site.', SOFT, { wrap: CARD_W })]),
    ...(what.length > 8 ? [muted(`+${what.length - 8} more on the site`)] : []),
    muted(['Worth 1 step', t.tier?.trim() ? `Tier: ${t.tier.trim()}` : null].filter(Boolean).join(' · ')),
  ]));

  // Where it goes: the tile the team came from, the tile(s) it leads to, and where it may switch.
  const prev = g.prev.get(id) ?? [];
  const from = prev.filter((pid) => route.path.includes(pid));
  const cameFrom = from.length ? from : prev;
  const link = (pid: number) => {
    const ok = route.state.get(pid) === 'done';
    return text(clip(`${x.name(pid)}${ok ? ' ✓' : ''}`, 26), ok ? GREEN : 'text', { on: pane(`t:${pid}`), tip: `Open ${x.name(pid)}` });
  };
  const goes: Node[] = [];
  if (cameFrom.length) goes.push(row(muted('Came from'), link(cameFrom[0]), undefined, { gap: 4 }), ...cameFrom.slice(1).map((pid) => row(muted('or'), link(pid), undefined, { gap: 4 })));
  else goes.push(muted(node.step === 0 ? 'The first step: open from the start.' : 'Nothing leads here.', { wrap: CARD_W }));
  const road = roadOf(g, id);
  const ahead = node.next;
  const keep = ahead.find((n) => roadOf(g, n) === road) ?? ahead[0];
  if (keep != null) goes.push(row(muted('Leads to'), link(keep), undefined, { gap: 4 }));
  else goes.push(muted('The finish: the race ends here.'));
  const switches = ahead.filter((n) => n !== keep);
  if (switches.length) goes.push(text(`At step ${node.step + 2} you can switch to ${switches.map((n) => `Road ${roadOf(g, n)} (${x.name(n)})`).join(' or ')}.`, FAINT, { wrap: CARD_W, font: 'small' }));
  out.push(section([title('Where it goes'), ...goes]));

  // Who: the teams done with it, and the teams it's open for right now.
  const teams = x.board.teams.map((tm) => ({ id: tm.teamId, name: tm.name ?? 'Team', color: (/^#[0-9a-f]{6}$/i.test(tm.color ?? '') ? tm.color : SOFT) as Color, done: tm.completedTileIds }));
  const lines2 = raceLines(g, teams.map((tm) => ({ id: tm.id, name: tm.name, color: tm.color })), teams.flatMap((tm) => tm.done.map((tileId) => ({ teamId: tm.id, tileId }))));
  const order = new Map((x.race.standings ?? []).map((s, i) => [s.teamId, i]));
  const ranked = (list: typeof teams) => [...list].sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const doneBy = ranked(teams.filter((tm) => tm.done.includes(id)));
  const onIt = ranked(teams.filter((tm) => lines2.find((l) => l.team.id === tm.id)?.route.open.includes(id)));
  const word = (n: number) => (n === 1 ? 'team' : 'teams');
  const doneCard = namesCard('Done it', doneBy, word(doneBy.length), `race-done:${id}`);
  const onCard = namesCard('On it now', onIt, word(onIt.length), `race-on:${id}`);
  if (doneCard) out.push(doneCard);
  if (onCard) out.push(onCard);

  // Pick (choose-and-lock forks), track on screen, the proofs, the site.
  const s: BoardState = { event: 0, pre: false, q: '', status: 'all', page: 0 };
  const acts: Node[] = [];
  if (state === 'pick' && !x.o.ctx.claimBlock) {
    acts.push({ t: 'button', label: 'Pick this road', tip: 'Lock in this tile for your team: a pick can’t be changed', on: { a: 'post', act: 'race-pick', args: { ...x.o.pick, tile: String(id) } } });
  }
  const pin = pinAction(t, s, x.o.ctx, x.o.reload);
  if (pin && state !== 'done' && state !== 'closed') acts.push(pin.on ? { t: 'button', label: pin.label, tip: pin.tip, on: pin.on } : muted(pin.tip, { wrap: true }));
  if (acts.length) out.push(col(acts, { gap: 5 }));
  if (x.o.ctx.eventId > 0) {
    out.push(section([
      { t: 'slot', id: 'proofs', c: muted('Loading proofs…'), load: { a: 'load', v: 'proofs', args: { ev: String(x.o.ctx.eventId), tile: String(id), head: 'Your proofs' } } },
      ...(x.o.ctx.boardPath ? [text('Open on the website', GOLD, { font: 'small', on: { a: 'site', path: `${x.o.ctx.boardPath}?tile=${id}` }, tip: 'Open this tile on the Anvil site' })] : []),
    ]));
  }
  return out;
}
