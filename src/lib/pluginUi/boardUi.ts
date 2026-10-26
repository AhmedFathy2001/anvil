import type { buildBoard } from '@/app/api/plugin/board/route';

import { type Action, type Color, type Node, button, card, col, count, gap, muted, percent, row, text } from './nodes';

// The board's "All tiles" page in the plugin's side panel (was the catalogue in AnvilSidebarPanel):
// search, a status filter, fifteen rows a page, and a tile's detail with claiming and pinning. Pure;
// the board comes from buildBoard, the team's counts from the config builder.

type Board = Awaited<ReturnType<typeof buildBoard>>;
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
export type Status = (typeof STATUSES)[number]['v'];

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
}

/** What the caller may do here, and the team's counts per tile (the live board only). */
export interface BoardContext {
  /** The board's event id (the live board's resolved). */
  eventId: number;
  /** Null when claiming is possible; else why not, in the member's words. */
  claimBlock: string | null;
  /** Tiles this client has pinned over the game; null where it can't pin on this board. */
  pins: number[] | null;
  progress: Map<number, { current: number; goal: number }>;
  /** The board's page on the site, for "Open on Anvil". */
  boardPath: string | null;
}

const MANUAL: Color = '#e8b83a';
const DONE_LINE: Color = '#6fc26f';
const IN_PROGRESS: Color = '#7dc4f0';
const SET_COLORS: Color[] = ['#e0c06a', '#6ac8e0', '#e08ac4', '#a89af0', '#5fd4be', '#e8a87a'];
const TRACKED_TYPES = new Set(['kill', 'lap', 'pvp', 'diary', 'ca', 'timed', 'lms', 'value', 'valuetotal', 'deathless']);
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

const closedUndone = (t: BoardTile) => !t.complete && !!t.closedAt;

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
  ...extra,
});

/** Reload the list area (`tiles`) for this state. */
const list = (s: BoardState, extra: Record<string, string> = {}): Action => ({ a: 'load', v: 'board', args: args(s, { part: 'rows', ...extra }), into: 'tiles' });

function stateText(t: BoardTile, pre: boolean): string | null {
  if (pre) return isManual(t) ? '(manual)' : null;
  return `${t.complete ? 'Done' : closedUndone(t) ? 'Closed' : 'Open'}${isManual(t) ? ' (manual)' : ''}`;
}

/** The whole page: counts, the search and the filter, then the list — or `inner` — in slot `tiles`. */
export function boardUi(board: Board, s: BoardState, ctx: BoardContext, inner?: Node): Node {
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
    text(`${tiles.length} visible tile${tiles.length === 1 ? '' : 's'}${hidden}`, '#cdcdcd'),
    gap(2),
    muted(hint),
    gap(7),
    { t: 'input', name: 'q', kind: 'search', value: s.q, label: `Search ${tiles.length} tiles…`, tip: 'Search tile names, descriptions, requirements and categories', on: reload },
    ...(s.pre
      ? []
      : [gap(5), row(muted('Show'), { t: 'input', name: 'status', kind: 'select', options: [...STATUSES], value: s.status, tip: 'Filter tiles by completion state', on: reload } as Node, undefined)]),
    gap(7),
    { t: 'slot', id: 'tiles', c: inner ?? boardRowsUi(board, s, ctx) },
  ]);
}

/** One page of matching rows, with Previous / Next. */
export function boardRowsUi(board: Board, s: BoardState, ctx: BoardContext): Node {
  const found = filterTiles(board.tiles as BoardTile[], s.q, s.status, s.pre, ctx.progress);
  if (!found.length) return muted('No matching tiles.');
  const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const page = Math.max(0, Math.min(s.page, pages - 1));
  const from = page * PAGE_SIZE;
  const to = Math.min(found.length, from + PAGE_SIZE);
  const rows: Node[] = [muted(`${from + 1}–${to} of ${found.length}`), gap(5)];
  found.slice(from, to).forEach((t, i) => rows.push(...(i ? [gap(5)] : []), tileRow(t, { ...s, page }, ctx)));
  if (pages > 1) {
    rows.push(gap(7), {
      t: 'grid',
      cols: 2,
      gap: 4,
      c: [
        { ...button('‹ Previous', list({ ...s, page: page - 1 }), 'Show the previous tiles'), off: page <= 0 } as Node,
        { ...button('Next ›', list({ ...s, page: page + 1 }), 'Show the next tiles'), off: page >= pages - 1 } as Node,
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
  const right = state
    ? text(state, done ? 'done' : started != null ? IN_PROGRESS : isManual(t) ? MANUAL : 'muted', done ? { icon: { t: 'icon', glyph: 'check', w: 11, h: 11, color: 'done' } } : {})
    : undefined;
  const head = row(undefined, text(name.length > 28 ? `${name.slice(0, 27)}…` : name, done ? 'done' : 'white'), right, { gap: 6 });
  return col([head, ...(planning ? [text(planning.length > 36 ? `${planning.slice(0, 35)}…` : planning, mine(t.claims) ? 'brand' : 'claim', { tip: claimWho(t.claims) })] : [])], {
    bg: 'card',
    inset: 7,
    tip: `${details ? `${name} — ${details}` : name}${canClaim ? ' (right-click to claim)' : ''}`,
    on: list(s, { tile: String(t.tileId) }),
    menu: [...claimMenu(t, s, ctx), ...pinMenu(t, s, ctx)],
  });
}

function claimMenu(t: BoardTile, s: BoardState, ctx: BoardContext): { label: string; on?: Action }[] {
  if (t.complete) return [{ label: 'This tile is already complete.' }];
  if (ctx.claimBlock) return [{ label: ctx.claimBlock }];
  const post = (act: string, extra: Partial<Extract<Action, { a: 'post' }>> = {}): Action => ({
    a: 'post',
    act,
    args: args(s, { tile: String(t.tileId) }),
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
  const b = pinAction(t, s, ctx);
  return b ? [{ label: b.label, on: b.on }] : [];
}

/** "Track on screen" / "Stop tracking"; null where the tile can't be pinned. */
function pinAction(t: BoardTile, s: BoardState, ctx: BoardContext, then?: Action): { label: string; on?: Action; tip: string } | null {
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

const heading = (s: string, above = 9): Node[] => [...(above ? [gap(above)] : []), text(s, 'brand'), gap(2)];
const note = (s: string, color: Color = 'white'): Node => text(s, color, { wrap: true });

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
  const parts: Node[] = [text(name, 'white', { font: 'bold' }), gap(4)];
  if (error) parts.push(text(error, 'error', { wrap: true }), gap(4));
  const p = ctx.progress.get(t.tileId);
  if (p && !t.complete && p.current < p.goal && p.goal > 1) {
    parts.push(...heading('Progress', 0), row(text(`${percent(p.current, p.goal)}%`), { t: 'bar', pct: percent(p.current, p.goal), color: IN_PROGRESS, h: 6, bg: 'panel' }, text(`${count(p.current)} / ${count(p.goal)}`, 'muted')), gap(9));
  }
  const facts = [
    !s.pre ? `Status: ${stateText(t, false)}` : isManual(t) ? 'Completion: manual' : null,
    t.points > 0 ? `Points: ${t.points}` : null,
    t.tier?.trim() ? `Tier: ${t.tier.trim()}` : null,
    t.category?.trim() ? `Category: ${t.category.trim().replace(/,/g, ' ·')}` : null,
  ].filter((f): f is string => !!f);
  if (facts.length) parts.push(...heading('Details', 0), ...facts.map((f) => note(f)));
  const who = (title: string, list: { name: string; amount: number }[] | undefined, more: number | undefined, color: Color) => {
    if (!list?.length) return;
    parts.push(...heading(title), ...list.map((f) => note(finisherLine(t, f), color)), ...(more ? [note(`+${more} more`, 'muted')] : []));
  };
  if (t.complete) who('Finished by', t.finishedBy, t.finishedByMore, 'done');
  const teamsDone = board.teams.filter((tm) => tm.completedTileIds.includes(t.tileId));
  if (teamsDone.length) parts.push(...heading('Teams done'), ...teamsDone.map((tm) => note(tm.name ?? 'Team', /^#[0-9a-f]{6}$/i.test(tm.color ?? '') ? (tm.color as Color) : 'done')));
  if (!t.complete) who('On it', t.contributors, t.contributorsMore, IN_PROGRESS);
  if (t.description?.trim()) parts.push(...heading('Objective'), note(t.description.trim()));
  const lines = trackingLines(t);
  if (isManual(t)) {
    parts.push(
      ...heading('Manual completion'),
      note('manualOnly' in t && t.manualOnly
        ? 'The plugin can’t see this item arrive — it isn’t a drop (it’s bought, made or handed over), so it isn’t tracked. Screenshot it and submit it on the site.'
        : 'This task is not completed automatically. A captain or admin marks it done.'),
    );
  } else if (lines.length) {
    if (t.howItCounts?.trim()) parts.push(...heading('How it counts'), note(t.howItCounts.trim(), 'brand'));
    parts.push(...heading('Tracked automatically'));
    let headers = 0;
    lines.forEach((line, i) => {
      const header = line.endsWith(':');
      const ticked = line.trim().startsWith('✓');
      const s2 = ticked ? line.trim().slice(1).trim() : line.trim();
      const color: Color = header ? SET_COLORS[headers++ % SET_COLORS.length] : ticked ? DONE_LINE : 'white';
      parts.push(
        ...(header && i > 0 ? [gap(6)] : []),
        row(undefined, text(s2, color, { wrap: true, ...(ticked ? { icon: { t: 'icon', glyph: 'check', w: 11, h: 11, color: DONE_LINE } } : {}) }), undefined, { inset: line.startsWith('  ') ? 8 : 0 }),
      );
    });
  }
  const req = t.requirement?.trim();
  if (req && req !== (t.description ?? '').trim() && !lines.includes(req)) parts.push(...heading('Requirements'), note(req));
  const planning = claimWho(t.claims);
  if (planning) parts.push(gap(7), note(planning, mine(t.claims) ? 'brand' : 'claim'));

  if (ctx.claimBlock == null && !t.complete) {
    // The right-click menu's two choices, as buttons: claimed → change note / drop; not → claim / with a note.
    const [first, second] = claimMenu(t, s, ctx);
    const claimed = mine(t.claims);
    parts.push(gap(8), {
      t: 'grid',
      cols: 2,
      gap: 4,
      c: [
        button(claimed ? 'Change note…' : 'Claim tile', first.on!, claimed ? 'Edit the note your team sees' : 'Tell your team you’re going for this'),
        button(claimed ? 'Drop claim' : 'Add note…', second.on!, claimed ? 'Stop planning this tile' : 'Claim it with a note for your team'),
      ],
    });
  }
  const pin = pinAction(t, s, ctx, list(s, { tile: String(t.tileId) }));
  if (pin) parts.push(gap(5), pin.on ? button(pin.label, pin.on, pin.tip) : muted(pin.tip, { wrap: true }));
  if (ctx.boardPath) parts.push(gap(5), text('Open on Anvil ↗', 'brand', { tip: 'Open this tile on the Anvil site', on: { a: 'site', path: `${ctx.boardPath}?tile=${t.tileId}` } }));

  return col([button('Back to tiles', list(s), 'Return to the searchable tile list'), gap(7), card(parts, { inset: 9 })]);
}
