import type { buildBoard } from '@/app/api/plugin/board/route';

import { type Action, type Color, type Node, button, card, col, count, exact, gap, muted, percent, row, text } from './nodes';
import { boardFeedLinks } from './feedUi';
import { BLUE, CARD_W, GREEN, PROGRESS, SOFT, chip, clip, goldCard, more, section, small, title } from './sections';
import { raceGraph, raceTileInfo, roadChoiceLine, type RaceGraph, type TeamRoute, type RaceTileState } from '@/lib/raceRoutes';
import { orderLinesBy, panelSteps, raceLines, raceSummaryLine } from '@/lib/raceSummary';

// The board's "All tiles" page in the plugin's side panel (was the catalogue in AnvilSidebarPanel):
// search, a status filter, fifteen rows a page, and a tile's detail with claiming and pinning. Pure;
// the board comes from buildBoard, the team's counts from the config builder.

export type Board = Awaited<ReturnType<typeof buildBoard>>;
export type BoardTile = Board['tiles'][number] & {
  claims?: { name: string; note: string | null; mine: boolean }[];
  finishedBy?: { name: string; amount: number }[];
  finishedByMore?: number;
  contributors?: { name: string; amount: number }[];
  contributorsMore?: number;
  closedAt?: string | null;
};

export const STATUSES = [
  { v: 'all', label: 'All' },
  { v: 'open', label: 'Not done' },
  // A sort, but one more choice in the same dropdown beats a second control on a 240px panel.
  { v: 'closest', label: 'Closest first' },
  { v: 'progress', label: 'In progress' },
  { v: 'new', label: 'Not started' },
  { v: 'done', label: 'Done' },
] as const;
/** A branching race's list filter (the same select, its own words). */
export const RACE_STATUSES = [
  { v: 'all', label: 'All' },
  { v: 'next', label: 'Next for us' },
  { v: 'done', label: 'Done' },
  { v: 'locked', label: 'Locked' },
] as const;
export type Status = (typeof STATUSES)[number]['v'] | 'next' | 'locked';

export const PAGE_SIZE = 15;
export const MAX_PINS = 3;

/** Where this list is: the board, and what the member has narrowed it to. */
export interface BoardState {
  /** 0 = the live board the caller plays on. */
  event: number;
  /** Before the start: no done state, only previews. */
  pre: boolean;
  q: string;
  status: Status;
  page: number;
  /** The page's way back (back, backLabel, title), carried on every action so a redraw keeps its Back row. */
  nav?: Record<string, string>;
}

/** What the caller may do here, and the team's counts per tile (the live board only). */
export interface BoardContext {
  /** The board's event id (the live board's resolved). */
  eventId: number;
  /** Null when claiming is possible; else why not, in the member's words. */
  claimBlock: string | null;
  /** Tiles this client has pinned over the game; null where it can't pin on this board. */
  pins: number[] | null;
  /** The team's count per tile; `sets` names the sets on a one-of-several-sets tile (lib/pluginPanel setsLine). */
  progress: Map<number, { current: number; goal: number; sets?: string }>;
  /** The board's page on the site, for "Open on Anvil". */
  boardPath: string | null;
  /** Where the board's Feed / Chat (opened in the same tab) go back to. */
  feedBack?: { open: string; label: string };
  /** The plugin opens those on its Feed tab instead (hasTabArgs). */
  feedTab?: boolean;
  /** The board's chat is on (lib/eventChat boardChatOn): offer the Chat button. */
  chatOn?: boolean;
}

const MANUAL: Color = '#e8b83a';
const DONE_LINE: Color = '#6fc26f';
const IN_PROGRESS: Color = 'progress';
const SET_COLORS: Color[] = ['#e0c06a', '#6ac8e0', '#e08ac4', '#a89af0', '#5fd4be', '#e8a87a'];
const TRACKED_TYPES = new Set(['kill', 'lap', 'pvp', 'diary', 'ca', 'timed', 'lms', 'value', 'valuetotal', 'deathless', 'clog']);
const TYPE_WORDS: Record<string, string[]> = {
  drop: ['drop', 'drops'],
  kill: ['kill', 'kills'],
  lap: ['lap', 'laps', 'agility'],
  pvp: ['pvp'],
  gain: ['gain', 'gains', 'item gain', 'gather'],
  timed: ['timed', 'time', 'speedrun'],
  deathless: ['deathless'],
  diary: ['diary', 'diaries', 'achievement diary'],
  ca: ['ca', 'cas', 'combat task', 'combat achievement'],
  clog: ['clog', 'collection log', 'log slot', 'log page'],
  lms: ['lms'],
  value: ['value', 'loot value', 'gp'],
  valuetotal: ['value', 'loot value', 'gp'],
};
/** Boss nicknames both ways, so a search finds a tile by whichever name the player knows. */
const ALIASES: [string, string][] = [
  ['toa', 'tombs of amascut'], ['tob', 'theatre of blood'], ['cox', 'chambers of xeric'], ['tfa', 'fractured archive'],
  ['cm', 'challenge mode'], ['hm', 'hard mode'], ['jad', 'tztok jad'], ['fight caves', 'tztok jad'],
  ['zuk', 'tzkal zuk'], ['inferno', 'tzkal zuk'], ['colo', 'sol heredit'], ['colosseum', 'sol heredit'],
  ['kq', 'kalphite queen'], ['kbd', 'king black dragon'], ['dks', 'dagannoth'], ['corp', 'corporeal beast'],
  ['cerb', 'cerberus'], ['gg', 'grotesque guardians'], ['nm', 'nightmare'], ['pnm', 'phosani'],
  ['cg', 'corrupted gauntlet'], ['sire', 'abyssal sire'], ['hydra', 'alchemical hydra'], ['vork', 'vorkath'],
  ['zul', 'zulrah'], ['muspah', 'phantom muspah'], ['kril', 'k ril tsutsaroth'], ['zammy', 'k ril tsutsaroth'],
  ['zily', 'commander zilyana'], ['sara', 'commander zilyana'], ['kree', 'kree arra'], ['arma', 'kree arra'],
  ['bandos', 'general graardor'], ['graardor', 'general graardor'], ['gwd', 'god wars'], ['levi', 'leviathan'],
  ['whisp', 'whisperer'], ['vard', 'vardorvis'], ['duke', 'duke sucellus'], ['dt2', 'desert treasure'],
  ['rax', 'araxxor'], ['huey', 'hueycoatl'], ['amox', 'amoxliatl'], ['scur', 'scurrius'],
  ['titans', 'royal titans'], ['wt', 'wintertodt'], ['gotr', 'guardians of the rift'], ['tempo', 'tempoross'],
  ['mole', 'giant mole'], ['vene', 'venenatis'], ['calv', 'calvar ion'], ['sepulchre', 'hallowed sepulchre'],
  ['ba', 'barbarian assault'], ['lms', 'last man standing'], ['pc', 'pest control'], ['ca', 'combat achievement'],
];

/** Lowercase words with punctuation collapsed, so "Barrows—chest" matches "barrows chest". */
export const norm = (v: string | null | undefined) => (v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** `textIn` plus the other name of every boss it mentions. */
export function withAliases(textIn: string): string {
  const words = ` ${norm(textIn)} `;
  const extra = ALIASES.flatMap(([a, b]) => (words.includes(` ${a} `) ? [b] : words.includes(` ${b} `) ? [a] : []));
  return [textIn, ...extra].join(' ');
}

export function isManual(t: BoardTile): boolean {
  if (t.autoTrackDisabled || ('manualOnly' in t && t.manualOnly)) return true;
  if (t.statName) return false;
  const type = (t.tileType ?? '').toLowerCase();
  if (type === 'drop' || type === 'gain') return !t.itemIds?.length && !t.trackedItems?.length && !t.itemRequirements?.length;
  return !TRACKED_TYPES.has(type);
}

// A closed bounty/mission, or a branching race tile this team passed up (lib/raceRoutes).
const closedUndone = (t: BoardTile) => !t.complete && (!!t.closedAt || ('raceState' in t && t.raceState === 'closed'));
const raceStateOf = (t: BoardTile): string | null => ('raceState' in t ? (t.raceState as string | null) ?? null : null);

/** The words a player might type for this tile's TYPE ("boss", "kc" and "boss kc" are one thing). */
export function kindWords(t: BoardTile): Set<string> {
  const out = new Set<string>();
  if (isManual(t)) out.add('manual');
  if (t.statName) {
    const boss = t.statType === 'boss' || t.statType === 'kc';
    (boss ? ['boss', 'kc', 'boss kc', 'bosses'] : ['skill', 'xp', 'skilling', 'skills']).forEach((w) => out.add(w));
  }
  (TYPE_WORDS[(t.tileType ?? '').toLowerCase()] ?? []).forEach((w) => out.add(w));
  if (t.tileType === 'drop' && t.itemRequirements?.length) ['set', 'sets', 'item set', 'collection'].forEach((w) => out.add(w));
  return out;
}

/** What the tile is about beyond its name: its stat, sources, items and sets, rule and type. */
export function subjects(t: BoardTile): string {
  const parts = [
    t.statLabel,
    t.statName,
    ...(t.sources ?? []),
    ...(t.trackedItems ?? []).map((i) => i.name),
    ...(t.itemRequirements ?? []).flatMap((r) => [r.name, r.group]),
    t.howItCounts,
    ...kindWords(t),
  ].filter((s): s is string => !!s && !!s.trim());
  const own = `${parts.join(' ')} ${t.label ?? ''}`;
  return `${parts.join(' ')} ${withAliases(own).slice(own.length)}`;
}

const hasTier = (t: BoardTile, n: string) => norm(t.tier) === n || norm(t.tierKey) === n;
const hasCategory = (t: BoardTile, n: string) => !!n && (t.category ?? '').split(',').some((c) => norm(c) === n);

/** Lower is better: label phrase → label words → category → tier → subjects → requirement → description. */
function rank(t: BoardTile, phrase: string, terms: string[]): number {
  if (hasTier(t, phrase)) return 0;
  if (hasCategory(t, phrase)) return 2;
  if (kindWords(t).has(phrase)) return 3;
  const label = norm(t.label);
  if (label === phrase) return 4;
  if (label.startsWith(phrase)) return 5;
  if (label.includes(phrase)) return 10;
  const fields = [norm(t.category), norm(`${t.tier ?? ''} ${t.tierKey ?? ''}`), norm(subjects(t)), norm(t.requirement), norm(t.description)];
  const weights = [8, 10, 12, 14, 22];
  let score = 20;
  for (const term of terms) {
    if (label.startsWith(term)) continue;
    if (label.includes(term)) score += 2;
    else {
      const i = fields.findIndex((f) => f.includes(term));
      score += i < 0 ? 100 : weights[i];
    }
  }
  return score;
}

/** "260 / 500" for an open tile the team has started on, else null (untouched, pass/fail or done). */
export function startedCount(t: BoardTile, progress: BoardContext['progress']): string | null {
  const p = progress.get(t.tileId);
  return t.complete || !p || p.current <= 0 || p.goal <= 1 || p.current >= p.goal ? null : `${count(p.current)} / ${count(p.goal)}`;
}

/**
 * The tiles a search and a status leave, in the order shown. A whole category, tier or type name
 * also brings in every tile filed under it, ranked first; "Closest first" sorts by how far along.
 */
export function filterTiles(tiles: BoardTile[], q: string, status: Status, pre: boolean, progress: BoardContext['progress']): BoardTile[] {
  const needle = norm(q);
  const terms = needle ? needle.split(' ') : [];
  const tierFacet = !!needle && tiles.some((t) => hasTier(t, needle));
  const categoryFacet = !tierFacet && !!needle && tiles.some((t) => hasCategory(t, needle));
  const kindFacet = !tierFacet && !!needle && tiles.some((t) => kindWords(t).has(needle));
  const out = tiles.filter((t) => {
    const done = !pre && t.complete;
    const closed = !pre && closedUndone(t);
    const started = startedCount(t, progress) != null;
    if ((status === 'open' || status === 'closest') && (done || closed)) return false;
    if (status === 'done' && !done) return false;
    if (status === 'progress' && (done || closed || !started)) return false;
    if (status === 'new' && (done || closed || started)) return false;
    if (status === 'next' && raceStateOf(t) !== 'open') return false;
    if (status === 'locked' && !(raceStateOf(t) === 'ahead' || raceStateOf(t) === 'closed')) return false;
    const facet =
      (tierFacet && hasTier(t, needle)) ||
      (categoryFacet && hasCategory(t, needle)) ||
      (kindFacet && (kindWords(t).has(needle) || hasCategory(t, needle)));
    const hay = norm([t.label, t.category, t.tier, t.tierKey, t.requirement, t.description, subjects(t)].join(' '));
    return facet || terms.every((term) => hay.includes(term));
  });
  if (needle) {
    const r = new Map(out.map((t) => [t, rank(t, needle, terms)]));
    out.sort((a, b) => r.get(a)! - r.get(b)! || a.position - b.position);
  }
  // A branching race reads in step order, its open-next tiles first.
  if (!needle && tiles.some((t) => 'raceStep' in t)) {
    const step = (t: BoardTile) => ('raceStep' in t ? (t.raceStep as number) : 1e6);
    out.sort((a, b) => Number(raceStateOf(b) === 'open') - Number(raceStateOf(a) === 'open') || step(a) - step(b) || a.position - b.position);
  }
  if (status === 'closest') {
    const frac = (t: BoardTile) => {
      const p = progress.get(t.tileId);
      return !p || p.goal <= 0 ? 0 : Math.min(1, p.current / p.goal);
    };
    out.sort((a, b) => frac(b) - frac(a));
  }
  return out;
}

// ---- Claims ----------------------------------------------------------------------------------------

/** "Planning: You, Alice +2", or null when nobody has claimed it. Yours first. */
export function claimLine(claims: BoardTile['claims']): string | null {
  const names = (claims ?? []).flatMap((c) => (c.mine ? [] : c.name?.trim() ? [c.name.trim()] : []));
  if ((claims ?? []).some((c) => c.mine)) names.unshift('You');
  if (!names.length) return null;
  return `Planning: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`;
}

export function claimWho(claims: BoardTile['claims']): string {
  return (claims ?? []).map((c) => `${c.mine ? 'You' : c.name ?? 'A teammate'}${c.note?.trim() ? ` (${c.note.trim()})` : ''}`).join(' · ');
}

const mine = (claims: BoardTile['claims']) => (claims ?? []).some((c) => c.mine);

// ---- The list ------------------------------------------------------------------------------------

const args = (s: BoardState, extra: Record<string, string> = {}): Record<string, string> => ({
  event: String(s.event),
  pre: s.pre ? '1' : '',
  q: s.q,
  status: s.status,
  page: String(s.page),
  ...s.nav,
  ...extra,
});

/** Reload the list area (`tiles`) for this state. */
const list = (s: BoardState, extra: Record<string, string> = {}): Action => ({ a: 'load', v: 'board', args: args(s, { part: 'rows', ...extra }), into: 'tiles' });

function stateText(t: BoardTile, pre: boolean): string | null {
  if (pre) return isManual(t) ? '(manual)' : null;
  const race = raceStateOf(t);
  const open = race === 'open' ? 'Next' : race === 'ahead' ? 'Locked' : 'Open';
  // A closed mission / bounty in the shared tile-state words (lib/tileState): claimed by someone, or
  // expired (hourglass, timed ones only — the site decides which, so hidden standings never name or
  // leak a taker). A race tile off the team's road is "Locked", not closed.
  const closedWord = t.closedAt ? ('closedReason' in t && t.closedReason === 'expired' ? '⌛ Expired' : 'Closed') : '🔒 Locked';
  return `${t.complete ? 'Done' : closedUndone(t) ? closedWord : open}${isManual(t) ? ' (manual)' : ''}`;
}

/** A read-only board's claim block: who may join, when the host gates entry ("… · Subs only (Twitch)"). */
export function joinToClaimLine(gate: string | null): string {
  return gate ? `Join this event to claim tiles · ${gate}` : 'Join this event to claim tiles.';
}

export type RacePayload = {
  steps: number; mode: 'achieve' | 'choose'; path: number[]; open: number[]; pickFrom: number[]; finished: boolean;
  rank: number | null; entrants: number; leaderSteps: number; field: number[];
  standings?: { teamId: number; rank: number; stepsDone: number; finished: boolean }[];
};
export const racePayload = (board: Board): RacePayload | null => ('race' in board && board.race ? (board.race as RacePayload) : null);

/** The route rebuilt from the board payload (steps and links), plus the caller's route as the site sent it. */
export function raceModel(board: Board): { graph: RaceGraph; route: TeamRoute | null } | null {
  const race = racePayload(board);
  if (!race) return null;
  const tiles = board.tiles as BoardTile[];
  const graph = raceGraph(tiles.filter((t) => 'raceStep' in t).map((t) => ({ id: t.tileId, position: t.position, raceStep: t.raceStep as number, raceNext: t.raceNext as number[] })));
  if (board.readOnly) return { graph, route: null };
  const state = new Map<number, RaceTileState>();
  for (const t of tiles) if (raceStateOf(t)) state.set(t.tileId, raceStateOf(t) as RaceTileState);
  const route: TeamRoute = {
    path: race.path, stepsDone: race.path.length, open: race.open, pickFrom: race.pickFrom, picked: null, finished: race.finished, state,
    ahead: new Set([...state].filter(([, v]) => v === 'ahead').map(([k]) => k)),
    closed: new Set([...state].filter(([, v]) => v === 'closed').map(([k]) => k)),
  };
  return { graph, route };
}

/** A race tile's banner in its detail: Locked / Next / Done, why, where it leads and where it's reached from. */
function raceDetailUi(board: Board, t: BoardTile, s: BoardState, ctx: BoardContext): Node[] {
  const m = raceModel(board);
  if (!m || !m.graph.byId.has(t.tileId)) return [];
  const tiles = board.tiles as BoardTile[];
  const label = (id: number) => tiles.find((x) => x.tileId === id)?.label?.trim() || `Tile ${id}`;
  const info = raceTileInfo(m.graph, m.route, t.tileId, label)!;
  const color: Color = info.state === 'open' ? 'brand' : info.state === 'done' ? 'done' : 'muted';
  const head = info.state === 'open' ? '▸ Next for your team' : info.state === 'done' ? '✓ Done' : info.state === 'closed' ? '🔒 Locked' : info.state === 'ahead' ? '🔒 Locked' : info.stepLine;
  const chips = (ids: number[]) => ids.map((id) => text(`· ${label(id)}`, 'white', { tip: 'Open this tile', on: pane(`t:${id}`) }));
  const out: Node[] = [
    card([
      text(head, color, { font: 'bold' }),
      muted(`${info.stepLine} · road ${info.road}`),
      ...(info.why ? [text(info.why, info.state === 'open' ? 'text' : 'muted', { wrap: true })] : []),
      ...(m.route?.pickFrom.includes(t.tileId) && !ctx.claimBlock
        ? [gap(4), button('Pick this road', { a: 'post', act: 'race-pick', args: args(s, { tile: String(t.tileId) }) }, 'Lock in this tile for your team — a pick can’t be changed')]
        : []),
    ]),
    gap(6),
  ];
  if (info.leadsTo.length) out.push(muted('Leads to:'), ...chips(info.leadsTo), gap(4));
  if (info.reachedFrom.length) out.push(muted('Reached from:'), ...chips(info.reachedFrom), gap(4));
  const here = board.teams.filter((tm) => {
    const done = tm.completedTileIds;
    return done.includes(t.tileId) && !m.graph.byId.get(t.tileId)!.next.some((n) => done.includes(n));
  });
  if (here.length) out.push(muted(`On it now: ${here.map((tm) => tm.name).slice(0, 4).join(', ')}${here.length > 4 ? ` +${here.length - 4}` : ''}`, { wrap: true }), gap(4));
  return out;
}

/**
 * The race as an ORDERED list for a 240px panel (lib/raceSummary panelSteps): a one-line summary
 * ("Lab · step 3 of 10 · 2nd, 3 behind Iron Lads"), then every step numbered — "Step 1 of 10 ·
 * Start", "Step 2 of 10", … "Junction", "Finish" — with its tile(s) and their lane letters where a
 * step has several. Done steps are ticked, the current step's open tiles say Next (gold), later steps
 * are muted behind a padlock, alternatives off the team's road are dimmed, and a "you are
 * here" line marks the current step. A crowd shows how many stand at each step. Null off a race.
 */
export function raceRouteUi(board: Board, s?: BoardState): Node | null {
  const race = racePayload(board);
  const m = raceModel(board);
  if (!race || !m) return null;
  const tiles = board.tiles as BoardTile[];
  const name = (id: number) => {
    const l = tiles.find((t) => t.tileId === id)?.label?.trim() || `Tile ${id}`;
    return l.length > 24 ? `${l.slice(0, 23)}…` : l;
  };
  const teams = board.teams.map((tm) => ({ id: tm.teamId, name: tm.name ?? 'Team', color: tm.color ?? '#989898' }));
  const completions = board.teams.flatMap((tm) => tm.completedTileIds.map((tileId) => ({ teamId: tm.teamId, tileId })));
  // The server's race order (completion times break ties), never a local re-sort by name.
  const lines = orderLinesBy(raceLines(m.graph, teams, completions), race.standings ?? []);
  const viewer = board.readOnly ? null : board.yourTeamId;
  const steps = panelSteps(m.graph, m.route, name, lines);
  const crowdWord = race.entrants > 30 ? 'here' : null;
  const out: Node[] = [text(raceSummaryLine(m.graph, lines, viewer), 'brand', { wrap: true, font: 'bold' }), gap(6)];
  for (const st of steps) {
    if (st.phase === 'current' && !race.finished) {
      out.push(gap(2), text('▸ You are here', 'brand', { font: 'small' }), { t: 'bar', pct: 100, color: 'brand', h: 2, bg: 'panel' } as Node, gap(3));
    }
    const crowd = st.crowd > 0 && race.entrants > 6 ? ` · ${st.crowd} ${crowdWord ?? `team${st.crowd === 1 ? '' : 's'}`}` : '';
    const mark = st.phase === 'done' ? '✓ ' : st.phase === 'later' ? '🔒 ' : '';
    out.push(text(`${mark}${st.heading}${crowd}`, st.phase === 'done' ? 'done' : st.phase === 'current' ? 'text' : 'muted', { font: st.phase === 'current' ? 'bold' : 'small' }));
    for (const t of st.tiles) {
      const lane = t.road ? `${t.road}: ` : '';
      if (t.state === 'done') out.push(text(`   ✓ ${lane}${t.label}`, 'done', { on: pane(`t:${t.id}`), tip: 'Done — open this tile' }));
      else if (t.state === 'open') {
        const choice = m.route ? ` · ${roadChoiceLine(m.graph, m.route, t.id).toLowerCase()}` : '';
        out.push(text(`   Next ▸ ${lane}${t.label}${st.tiles.length > 1 ? choice : ''}`, 'brand', { wrap: true, on: pane(`t:${t.id}`), tip: 'Open this tile' }));
      } else if (m.route?.pickFrom.includes(t.id) && s && !board.readOnly) {
        out.push({ ...button(`Pick ${lane}${t.label}`, { a: 'post', act: 'race-pick', args: args(s, { tile: String(t.id) }) }, 'Lock in this tile for your team — a pick can’t be changed') } as Node);
      } else if (t.state === 'closed') out.push(muted(`   ${lane}${t.label}`, { tip: 'Not on your team’s road' }));
      else out.push(muted(`   ${lane}${t.label}`));
    }
  }
  if (m.route?.pickFrom.length) out.push(gap(4), muted('A fork: your team picks its road before any tile here counts.', { wrap: true }));
  else if (m.route && m.route.open.length > 1) out.push(gap(4), muted('Up next — whichever you get first sets your road.', { wrap: true }));
  return card(out);
}

/** The whole page: counts, the search and the filter, then the list — or `inner` — in slot `tiles`. */
export function boardUi(board: Board, s: BoardState, ctx: BoardContext, inner: Node): Node {
  const tiles = board.tiles as BoardTile[];
  if (!tiles.length) return muted(board.tilesRevealed ? 'No visible tiles.' : 'Tiles haven’t been revealed yet.');
  const hidden = 'hiddenTileCount' in board && board.hiddenTileCount ? ` · ${board.hiddenTileCount} still hidden` : '';
  const hint =
    ctx.claimBlock == null
      ? 'Click for details · right-click to claim.'
      : ctx.claimBlock.startsWith('Log in')
        ? 'Click for details · log in to claim tiles.'
        : board.readOnly
          ? 'Click for details · join this event to claim tiles.'
          : 'Click for details · claims aren’t available on this site.';
  const reload = list({ ...s, page: 0 });
  return col([
    // This board's feed and chat, one click away (any board, not only the one the plugin tracks).
    boardFeedLinks(ctx.eventId, ctx.feedBack, ctx.feedTab, ctx.chatOn ?? true),
    gap(8),
    ...(raceRouteUi(board, s) ? [raceRouteUi(board, s), gap(7)] : []),
    text(`${tiles.length} visible tile${tiles.length === 1 ? '' : 's'}${hidden}`, '#cdcdcd'),
    gap(2),
    muted(hint),
    gap(7),
    { t: 'input', name: 'q', kind: 'search', value: s.q, label: `Search ${tiles.length} tiles…`, tip: 'Search tile names, descriptions, requirements and categories', on: reload },
    ...(s.pre
      ? []
      : [gap(5), row(muted('Show'), { t: 'input', name: 'status', kind: 'select', options: 'race' in board && board.race ? [...RACE_STATUSES] : [...STATUSES], value: s.status, tip: 'Filter tiles by completion state', on: reload } as Node, undefined)]),
    gap(7),
    { t: 'slot', id: 'tiles', c: inner },
  ]);
}

/** Switch slot `tile` to a page (`p<n>`) or a tile's detail (`t:<id>`) the answer already carries. */
const pane = (name: string): Action => ({ a: 'pane', into: 'tile', pane: name });

/**
 * The matching tiles: every page and every tile's detail arrive together as panes of slot `tile`, so
 * paging, opening a tile and going back draw at once instead of waiting on the site. `open` is the
 * tile shown first (opened from the Clan tab, or after a claim); otherwise the state's page.
 */
export function boardRowsUi(board: Board, s: BoardState, ctx: BoardContext, open?: BoardTile, error: string | null = null): Node {
  const found = filterTiles(board.tiles as BoardTile[], s.q, s.status, s.pre, ctx.progress);
  if (!found.length && !open) return muted('No matching tiles.');
  const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const panes: Record<string, Node> = {};
  for (let page = 0; page < pages; page++) panes[`p${page}`] = rowsPage(found, page, pages, { ...s, page }, ctx);
  found.forEach((t, i) => (panes[`t:${t.tileId}`] = tileDetailUi(board, t, { ...s, page: Math.floor(i / PAGE_SIZE) }, ctx)));
  let first = panes[`p${Math.max(0, Math.min(s.page, pages - 1))}`];
  if (open) {
    const at = found.findIndex((t) => t.tileId === open.tileId);
    first = tileDetailUi(board, open, { ...s, page: at < 0 ? 0 : Math.floor(at / PAGE_SIZE) }, ctx, error);
    panes[`t:${open.tileId}`] = first;
  }
  return { t: 'slot', id: 'tile', panes, c: first };
}

/** One page of matching rows, with Previous / Next. */
function rowsPage(found: BoardTile[], page: number, pages: number, s: BoardState, ctx: BoardContext): Node {
  if (!found.length) return muted('No matching tiles.');
  const from = page * PAGE_SIZE;
  const to = Math.min(found.length, from + PAGE_SIZE);
  const rows: Node[] = [muted(`${from + 1}–${to} of ${found.length}`), gap(5)];
  found.slice(from, to).forEach((t, i) => rows.push(...(i ? [gap(5)] : []), tileRow(t, s, ctx)));
  if (pages > 1) {
    rows.push(gap(7), {
      t: 'grid',
      cols: 2,
      gap: 4,
      c: [
        { ...button('‹ Previous', pane(`p${page - 1}`), 'Show the previous tiles'), off: page <= 0 } as Node,
        { ...button('Next ›', pane(`p${page + 1}`), 'Show the next tiles'), off: page >= pages - 1 } as Node,
      ],
    });
  }
  return col(rows);
}

function tileRow(t: BoardTile, s: BoardState, ctx: BoardContext): Node {
  const name = t.label?.trim() || `Tile ${t.tileId}`;
  const started = startedCount(t, ctx.progress);
  const state = started != null && !closedUndone(t) ? started : stateText(t, s.pre);
  const done = !s.pre && t.complete;
  const details = t.description?.trim() || t.requirement;
  const canClaim = ctx.claimBlock == null && !t.complete;
  const planning = claimLine(t.claims);
  const p = started != null ? ctx.progress.get(t.tileId) : undefined;
  const right = state
    ? text(state, done ? 'done' : started != null ? IN_PROGRESS : isManual(t) ? MANUAL : 'muted', done ? { icon: { t: 'icon', glyph: 'check', w: 11, h: 11, color: 'done' } } : p && !closedUndone(t) ? { live: { tile: t.tileId, cur: p.current, goal: p.goal } } : {})
    : undefined;
  const race = raceStateOf(t);
  // A race tile's row leads with its step, so the list reads in race order.
  const shown = 'raceStep' in t ? `Step ${(t.raceStep as number) + 1} · ${name}` : name;
  const head = row(undefined, text(shown.length > 28 ? `${shown.slice(0, 27)}…` : shown, done ? 'done' : race === 'open' ? 'brand' : race === 'closed' || race === 'ahead' ? 'muted' : 'text'), right, { gap: 6 });
  const raceLine = 'raceStep' in t && 'raceLanes' in t && (t.raceLanes as number) > 1 ? muted(`${race === 'open' ? '▸ ' : race === 'ahead' || race === 'closed' ? '🔒 ' : ''}Road ${'raceRoad' in t ? t.raceRoad : ''}`) : null;
  return col([head, ...(raceLine ? [raceLine] : []), ...(planning ? [text(planning.length > 36 ? `${planning.slice(0, 35)}…` : planning, mine(t.claims) ? 'brand' : 'claim', { tip: claimWho(t.claims) })] : [])], {
    bg: 'card',
    inset: 7,
    tip: `${details ? `${name} — ${details}` : name}${canClaim ? ' (right-click to claim)' : ''}`,
    on: pane(`t:${t.tileId}`),
    menu: [...claimMenu(t, s, ctx, true), ...pinMenu(t, s, ctx)],
  });
}

/** The claim choices; from a row (`fromRow`), the answer stays on the list instead of opening the tile. */
function claimMenu(t: BoardTile, s: BoardState, ctx: BoardContext, fromRow = false): { label: string; on?: Action }[] {
  if (t.complete) return [{ label: 'This tile is already complete.' }];
  if (ctx.claimBlock) return [{ label: ctx.claimBlock }];
  const post = (act: string, extra: Partial<Extract<Action, { a: 'post' }>> = {}): Action => ({
    a: 'post',
    act,
    args: args(s, { tile: String(t.tileId), ...(fromRow ? { list: '1' } : {}) }),
    into: 'tiles',
    ...extra,
  });
  const note = (claims: BoardTile['claims']) => (claims ?? []).find((c) => c.mine)?.note ?? '';
  return mine(t.claims)
    ? [
        { label: 'Change my note…', on: post('claim', { ask: 'Note for your team (optional, e.g. "doing it tonight"):', askValue: note(t.claims) }) },
        { label: 'Drop my claim', on: post('unclaim') },
      ]
    : [
        { label: 'I’m going for this', on: post('claim') },
        { label: 'I’m going for this, with a note…', on: post('claim', { ask: 'Note for your team (optional, e.g. "doing it tonight"):' }) },
      ];
}

function pinMenu(t: BoardTile, s: BoardState, ctx: BoardContext): { label: string; on?: Action }[] {
  const b = pinAction(t, s, ctx, list(s)); // redrawn on the same page, so the menu says "Stop tracking"
  return b ? [{ label: b.label, on: b.on }] : [];
}

/** "Track on screen" / "Stop tracking"; null where the tile can't be pinned. */
export function pinAction(t: BoardTile, s: BoardState, ctx: BoardContext, then?: Action): { label: string; on?: Action; tip: string } | null {
  if (t.complete || !ctx.pins || ctx.eventId <= 0) return null;
  const pinned = ctx.pins.includes(t.tileId);
  if (!pinned && ctx.pins.length >= MAX_PINS) return { label: 'Track on screen', tip: `You're already tracking ${MAX_PINS} tiles — stop one first` };
  return {
    label: pinned ? 'Stop tracking' : 'Track on screen',
    tip: pinned ? 'Remove this tile’s in-game widget' : 'Pin a live widget for this tile over the game — Alt+drag to move and resize',
    on: { a: 'pin', event: ctx.eventId, tile: t.tileId, on: !pinned, ...(then ? { then } : {}) },
  };
}

// ---- One tile ------------------------------------------------------------------------------------


/** "Kurrozive · 312 KC" — a finisher and their share, in the tile's unit. */
export function finisherLine(t: BoardTile, f: { name: string; amount: number }): string {
  if (f.amount <= 0) return f.name;
  const unit =
    t.statType === 'skill' ? ' XP' : t.statType === 'boss' || t.statType === 'kc' ? ' KC' : t.tileType === 'value' || t.tileType === 'valuetotal' ? ' gp' : '';
  return `${f.name} · ${count(f.amount)}${unit}`;
}

/** The exact inputs the plugin watches, as lines: set headers end in ":", items start with two spaces. */
export function trackingLines(t: BoardTile): string[] {
  if (isManual(t)) return [];
  const lines: string[] = [];
  const itemName = (id: number, name: string | null | undefined) => name?.trim() || `Item ${id}`;
  if (t.itemRequirements?.length) {
    const loose = t.itemRequirements.filter((r) => !r.group?.trim());
    const groups = new Map<string, { name: string; reqs: typeof loose }>();
    for (const r of t.itemRequirements) {
      const g = r.group?.trim();
      if (!g) continue;
      const k = g.toLowerCase();
      groups.set(k, { name: groups.get(k)?.name ?? g, reqs: [...(groups.get(k)?.reqs ?? []), r] });
    }
    const itemLine = (r: (typeof loose)[number]) => {
      const need = Math.max(1, r.requiredAmount);
      const name = itemName(r.itemId, r.name);
      if (r.currentAmount >= need) return `  ✓ ${need > 1 || r.currentAmount > need ? `${r.currentAmount}× ` : ''}${name}`;
      return `  ${r.currentAmount > 0 ? `${r.currentAmount}/${need}` : `${need}×`} ${name}`;
    };
    if (loose.length) lines.push(groups.size ? 'Always required:' : 'All of these:', ...loose.map(itemLine));
    for (const { name, reqs } of groups.values()) {
      const need0 = Math.max(0, ...reqs.map((r) => r.groupRequire));
      const need = need0 <= 0 ? reqs.length : Math.min(need0, reqs.length);
      const times = setTimes(reqs, need);
      lines.push(`${name} set — ${need < reqs.length ? `any ${need} of ${reqs.length}` : `all ${reqs.length}`}${times > 1 ? ` · done ×${times}` : times === 1 ? ' · done' : ''}:`);
      lines.push(...reqs.map(itemLine));
    }
  } else if (t.trackedItems?.length) {
    if (t.trackedItems.length === 1) lines.push(`${Math.max(1, t.requiredAmount)}× ${itemName(t.trackedItems[0].itemId, t.trackedItems[0].name)}`);
    else {
      const distinct = 'countMode' in t && t.countMode === 'distinct';
      const need = Math.max(1, t.requiredAmount);
      lines.push(distinct ? `${need} DIFFERENT items from:` : need === 1 ? 'Any ONE of:' : `Any ${need} drops (repeats count) from:`);
      const counted = new Set('countedItemIds' in t ? t.countedItemIds ?? [] : []);
      for (const i of t.trackedItems) lines.push(`${distinct && counted.has(i.itemId) ? '✓ ' : '- '}${itemName(i.itemId, i.name)}`);
    }
  } else if (t.statName) {
    lines.push(`${(t.statLabel || t.statName).trim()}${t.statType === 'boss' || t.statType === 'kc' ? ' KC' : ' XP'}`);
  } else if (t.requirement?.trim()) {
    lines.push(t.requirement.trim());
  }
  if (t.sources?.length) lines.push(`Only from: ${t.sources.join(', ')}`);
  return lines;
}

/** How many times over a set is done: the `need`-th best item's count of full amounts. */
function setTimes(reqs: { requiredAmount: number; currentAmount: number }[], need: number): number {
  const per = reqs.map((r) => Math.floor(r.currentAmount / Math.max(1, r.requiredAmount))).sort((a, b) => b - a);
  return need <= 0 ? 0 : per[Math.min(need, per.length) - 1] ?? 0;
}

export function tileDetailUi(board: Board, t: BoardTile, s: BoardState, ctx: BoardContext, error: string | null = null): Node {
  const name = t.label?.trim() || `Tile ${t.tileId}`;
  const out: Node[] = [row(undefined, text('Back to tiles', '#e6e6e6', { icon: { t: 'icon', glyph: 'chevron-left', w: 9, h: 9, color: '#e6e6e6' } }), undefined, { bg: 'raised', pad: 8, on: pane(`p${s.page}`), tip: 'Return to the searchable tile list' })];
  const p = ctx.progress.get(t.tileId);
  const moving = !!p && !t.complete && p.current < p.goal && p.goal > 1;
  const live = moving ? { tile: t.tileId, cur: p!.current, goal: p!.goal } : undefined;
  const meta = [t.tier?.trim() ? `Tier: ${t.tier.trim()}` : null, t.category?.trim() ? t.category.trim().replace(/,/g, ' ·') : null].filter(Boolean).join(' · ');
  const state = s.pre ? (isManual(t) ? chip('Manual', 'blue') : null) : t.complete ? chip('Done', 'green') : closedUndone(t) ? chip('Closed', 'grey') : moving && p!.current > 0 ? chip('In progress', 'gold') : chip(stateText(t, false) ?? 'Open', 'grey');
  out.push(col([
    ...(meta ? [muted(clip(meta, 40))] : []),
    text(name, 'white', { font: 'bold', wrap: 205 }),
    row(state ?? undefined, moving ? text(`${count(p!.current)} of ${count(p!.goal)}`, PROGRESS, { tip: exact(p!.current, p!.goal), live: { ...live!, fmt: 'raw' } }) : undefined, t.points > 1 ? chip(`${t.points} pts`, 'blue') : undefined, { gap: 6 }),
  ], { gap: 4 }));
  if (error) out.push(text(error, 'error', { wrap: true }));
  const race = raceDetailUi(board, t, s, ctx);
  if (race.length) out.push(section(race));

  // Your claim: the gold card. Not yours: the claim buttons sit with who's planning it.
  const claimed = mine(t.claims);
  const canClaim = ctx.claimBlock == null && !t.complete;
  const claimButtons = (): Node | null => {
    if (!canClaim) return null;
    const [first, second] = claimMenu(t, s, ctx);
    return {
      t: 'grid',
      cols: 2,
      gap: 4,
      c: [
        button(claimed ? 'Change note…' : 'Claim tile', first.on!, claimed ? 'Edit the note your team sees' : 'Tell your team you’re going for this'),
        button(claimed ? 'Drop claim' : 'Add note…', second.on!, claimed ? 'Stop planning this tile' : 'Claim it with a note for your team'),
      ],
    };
  };
  const pin = pinAction(t, s, ctx, list(s, { tile: String(t.tileId) }));
  const pinNode = pin ? (pin.on ? button(pin.label, pin.on, pin.tip) : muted(pin.tip, { wrap: true })) : null;
  if (claimed && !t.complete) {
    const note = (t.claims ?? []).find((c) => c.mine)?.note?.trim();
    out.push(goldCard('You’re going for this', [
      ...(moving ? [{ t: 'bar', pct: percent(p!.current, p!.goal), color: 'brand', h: 5, bg: 'panel', live } as Node] : []),
      ...(note ? [muted(`Your note: “${note}”`, { wrap: CARD_W })] : []),
      claimButtons(),
      pinNode,
    ]));
  }

  // What counts: the objective, then exactly what the plugin watches; a long list folds to "+N more".
  const lines = trackingLines(t);
  const what: Node[] = [title('What counts')];
  if (t.description?.trim()) what.push(text(t.description.trim(), SOFT, { wrap: CARD_W }));
  if (isManual(t)) {
    what.push(muted('manualOnly' in t && t.manualOnly
      ? 'The plugin can’t see this item arrive — it isn’t a drop (it’s bought, made or handed over), so it isn’t tracked. Screenshot it and submit it on the site.'
      : 'This task is not completed automatically. A captain or admin marks it done.', { wrap: CARD_W }));
  } else if (lines.length) {
    if (t.howItCounts?.trim()) what.push(text(t.howItCounts.trim(), 'brand', { wrap: CARD_W }));
    let headers = 0;
    const tracked = lines.map((line) => {
      const header = line.endsWith(':');
      const ticked = line.trim().startsWith('✓');
      const s2 = ticked ? line.trim().slice(1).trim() : line.trim();
      const color: Color = header ? SET_COLORS[headers++ % SET_COLORS.length] : ticked ? DONE_LINE : 'muted';
      return row(undefined, text(s2, color, { wrap: CARD_W - 10, ...(ticked ? { icon: { t: 'icon', glyph: 'check', w: 11, h: 11, color: DONE_LINE } } : {}) }), undefined, { inset: line.startsWith('  ') ? 8 : 0 });
    });
    what.push(...more(tracked, 6, `tile-what:${t.tileId}`, 2), small('Tracked automatically.', BLUE));
  }
  const req = t.requirement?.trim();
  if (req && req !== (t.description ?? '').trim() && !lines.includes(req)) what.push(muted(req, { wrap: CARD_W }));
  if (p?.sets) what.push(muted(p.sets, { wrap: CARD_W }));
  if (what.length > 1) out.push(section(what));

  // Who: on it (and who's planning it), finished by, teams done.
  const who = (head: string, list: { name: string; amount: number }[] | undefined, extra: number | undefined, color: Color, foot: Node[] = []): Node | null => {
    if (!list?.length && !foot.length) return null;
    const names = (list ?? []).map((f) => text(finisherLine(t, f), color, { wrap: CARD_W }));
    const n = (list?.length ?? 0) + (extra ?? 0);
    return section([row(undefined, title(head), n ? muted(`${n} player${n === 1 ? '' : 's'}`) : undefined), ...more(names, 3, `tile-who:${head}:${t.tileId}`, 3), ...(extra ? [muted(`+${extra} more on the site`)] : []), ...foot]);
  };
  const planning = claimWho(t.claims);
  const planNode = planning && !claimed ? [muted(planning, { wrap: CARD_W })] : [];
  const notMine = !claimed && canClaim ? [claimButtons()!] : [];
  if (t.complete) {
    const c = who('Finished by', t.finishedBy, t.finishedByMore, GREEN);
    if (c) out.push(c);
  } else {
    const c = who('On it', t.contributors, t.contributorsMore, PROGRESS, [...planNode, ...notMine]);
    if (c) out.push(c);
    else if (notMine.length) out.push(col(notMine));
  }
  const teamsDone = board.teams.filter((tm) => tm.completedTileIds.includes(t.tileId));
  if (teamsDone.length) {
    out.push(section([title('Teams done'), text('', SOFT, { wrap: CARD_W, runs: teamsDone.flatMap((tm, i) => [...(i ? [{ s: ', ' }] : []), { s: `${tm.name ?? 'Team'} ✓`, color: (/^#[0-9a-f]{6}$/i.test(tm.color ?? '') ? tm.color : GREEN) as Color }]) })]));
  }
  if (!claimed && pinNode) out.push(pinNode);
  // The team's proofs, fetched when this tile is opened (one tile's, not every pane's): lib/pluginUi proofsUi.
  if (!s.pre && ctx.eventId > 0) {
    const load: Action = { a: 'load', v: 'proofs', args: { ...args(s), ev: String(ctx.eventId), tile: String(t.tileId) } };
    out.push(section([{ t: 'slot', id: 'proofs', c: muted('Loading proofs…'), load }]));
  }
  if (ctx.boardPath) out.push(text('Open on Anvil', 'brand', { font: 'small', tip: 'Open this tile on the Anvil site', on: { a: 'site', path: `${ctx.boardPath}?tile=${t.tileId}` }, icon: { t: 'icon', glyph: 'external', w: 11, h: 11, color: 'brand' }, iconAfter: true }));
  return col(out, { gap: 10 });
}
