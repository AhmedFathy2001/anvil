import { formatGp } from '@/lib/itemPrices';
import { shownKiller } from '@/lib/deathSource';
import { clogItemIdByName } from '@/lib/moments';
import { fallenTitle, isFallenDeath } from '@/lib/hardcoreFall';
import { whoText } from '@/lib/reactionWho';
import { runSuffix } from '@/lib/feedRuns';

import type { Action, Color, FeedRow, Node } from './nodes';
import { button, col, gap, muted, text } from './nodes';

// The plugin panel's Feed tab (view 'feed'): one live list per scope — the clan's moments, a board's
// moments, a board's chat — drawn once and then grown by push rows (lib/panelRows). Pure: the view
// in pluginUi/views gathers the data, this decides how it reads.
//
// Feed ids are how a push row finds its list. A row names every list it belongs in, so a filtered
// view is just another id and the plugin never has to understand a filter:
//   moments:clan:<clan>[:<group>]        a clan's moments, all or one kind group
//   moments:event:<event>[:<group>]      a board's moments
//   moments:event:<event>:team:<team>    one team's moments on it
//   chat:<event> · chat:<event>:team:<team> · chat:<event>:mods

export type KindGroup = 'drops' | 'pets' | 'achievements' | 'deaths';
export const KIND_GROUPS: KindGroup[] = ['drops', 'pets', 'achievements', 'deaths'];

export function kindGroup(kind: string): KindGroup | null {
  if (kind === 'unique' || kind === 'loot') return 'drops';
  if (kind === 'pet') return 'pets';
  if (kind === 'death') return 'deaths';
  // Combat tasks, level milestones, log slots, diaries, quests (lib/moments ACHIEVEMENT_KINDS).
  if (kind === 'ca' || kind === 'level' || kind === 'clog' || kind === 'diary' || kind === 'quest') return 'achievements';
  return null;
}

export type Scope = { kind: 'clan'; id: number; slug: string; name: string } | { kind: 'event'; id: number; name: string };

export function momentsFeedId(scope: { kind: 'clan' | 'event'; id: number }, filter?: KindGroup | 'team' | 'tiles', teamId?: number | null): string {
  const base = `moments:${scope.kind}:${scope.id}`;
  if (filter === 'team') return teamId != null ? `${base}:team:${teamId}` : base;
  return filter ? `${base}:${filter}` : base;
}

/** "moments:event:9:team:4" → the list's scope, filter and team (pluginUi/feedUi momentsFeedId). */
export function parseMomentsFeedId(feed: string): { kind: 'clan' | 'event'; id: number; filter: string; teamId: number | null } | null {
  const p = feed.split(':');
  if (p[0] !== 'moments' || (p[1] !== 'clan' && p[1] !== 'event')) return null;
  const id = Number(p[2]);
  if (!Number.isInteger(id)) return null;
  if (p[3] === 'team') {
    const t = Number(p[4]);
    return Number.isInteger(t) ? { kind: p[1], id, filter: 'team', teamId: t } : null;
  }
  return { kind: p[1], id, filter: p[3] ?? 'all', teamId: null };
}

/** Every list a moment belongs in: its scope's, its kind group's, and its team's on a board. */
export function momentFeedIds(scope: { kind: 'clan' | 'event'; id: number }, kind: string, teamId: number | null): string[] {
  const ids = [momentsFeedId(scope)];
  const g = kindGroup(kind);
  if (g) ids.push(momentsFeedId(scope, g));
  if (scope.kind === 'event' && teamId != null) ids.push(momentsFeedId(scope, 'team', teamId));
  return ids;
}

export function chatFeedId(eventId: number, filter?: 'team' | 'mods', teamId?: number | null): string {
  if (filter === 'team' && teamId != null) return `chat:${eventId}:team:${teamId}`;
  if (filter === 'mods') return `chat:${eventId}:mods`;
  return `chat:${eventId}`;
}

/** The lists a chat line goes to: everyone's (unless team-only), its team's, and the staff list for staff. */
export function chatFeedIds(eventId: number, m: { teamId: number | null; teamOnly: boolean; staff: boolean }): string[] {
  const ids: string[] = [];
  if (!m.teamOnly) ids.push(chatFeedId(eventId));
  if (m.teamId != null) ids.push(chatFeedId(eventId, 'team', m.teamId));
  if (m.staff && !m.teamOnly) ids.push(chatFeedId(eventId, 'mods'));
  return ids;
}

// ── Rows ─────────────────────────────────────────────────────────────────────────────────────────

export interface MomentLike {
  id: number;
  rsn: string;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp: number | null;
  source: string | null;
  teamId: number | null;
  occurredAt: string;
  /** Combat task / diary tier. */
  tier?: string | null;
  /** 'level': skill / total / max. 'quest': 'cape' on the last quest. */
  sourceKind?: string | null;
  /** Back-to-back repeats this row stands for (lib/feedRuns): "×12" after the title. */
  run?: { n: number; mixed?: boolean } | null;
}

const PET = '#ff7f27';
const ACHIEVEMENT = '#ffd35c';

export function momentTitle(m: MomentLike): string {
  const run = m.run && m.run.n > 1 ? m.run : null;
  if (!run) return oneTitle(m);
  // Deaths to different killers: the count leads, the latest killer after it.
  if (m.kind === 'death' && run.mixed) return m.source ? `Died ×${run.n} · last to ${m.source}` : `Died ×${run.n}`;
  return `${oneTitle(m)}${runSuffix(run)}`;
}

function oneTitle(m: MomentLike): string {
  const name = m.itemName ?? m.source ?? m.kind;
  if (m.kind === 'pet') return `Pet: ${name}`;
  if (isFallenDeath(m)) return fallenTitle(shownKiller(m.source));
  if (m.kind === 'death') return shownKiller(m.source) ? `Died to ${m.source}` : 'Died';
  if (m.kind === 'ca') return m.tier ? `${m.tier} combat task: ${name}` : `Combat task: ${name}`;
  if (m.kind === 'level') {
    // The number reached rides in `quantity`, the skill in `itemName` (lib/moments Observation).
    const n = m.quantity.toLocaleString('en-US');
    if (m.sourceKind === 'max') return `Maxed: ${n} total level`;
    if (m.sourceKind === 'total') return `${n} total level`;
    return m.itemName ? `${n} ${m.itemName}` : `Level ${n}`;
  }
  if (m.kind === 'clog') return `New log slot: ${name}`;
  if (m.kind === 'diary') return `Completed the ${m.tier ? `${m.tier} ` : ''}${name} Diary`;
  if (m.kind === 'quest') return m.sourceKind === 'cape' ? `Quest cape: ${name}` : `Quest: ${name}`;
  return m.quantity > 1 ? `${m.quantity} × ${name}` : name;
}

/** The glyph a row without an item icon gets: a star for a pet, a gold tick for an achievement. */
function glyphOf(kind: string): Pick<FeedRow, 'glyph' | 'glyphColor'> {
  if (kind === 'pet') return { glyph: 'star', glyphColor: PET as Color };
  if (kindGroup(kind) === 'achievements') return { glyph: 'check', glyphColor: ACHIEVEMENT as Color };
  return { glyph: 'check', glyphColor: 'done' };
}

export type RowReactKind = 'gz' | 'sad' | 'sit';

/** What each reaction reads as on a row. */
export const REACT_LABEL: Record<RowReactKind, string> = { gz: 'GZ', sad: 'Sad', sit: 'Sit' };

/**
 * The reactions a feed row offers for a moment of this kind: a death is met with "Sad" or told to
 * "Sit" (the game's way of telling someone who died to sit down), everything else gets a GZ. The
 * react-row action takes only these, so a GZ never lands on a death.
 */
export function rowReactKinds(momentKind: string): RowReactKind[] {
  return momentKind === 'death' ? ['sad', 'sit'] : ['gz'];
}

export interface MomentRowOptions {
  /** The viewer's own drop, or their team's on a board. */
  mine?: boolean;
  /**
   * The viewer may react: each kind's count and whether they gave it, and the action that toggles it.
   * A death's become `reacts` chips (a plugin from before them draws none); anything else's the `gz`.
   * Kinds the row doesn't offer (rowReactKinds) are never asked for.
   */
  reacts?: {
    tally: (kind: RowReactKind) => { n: number; mine: boolean };
    act: (kind: RowReactKind) => Action;
    /** Who gave it, by character name there (lib/momentReactions reactorNames); omitted = no tooltip. */
    who?: (kind: RowReactKind) => readonly (string | null)[] | undefined;
  };
  /** "Team Ruby" under the name on a board. */
  team?: { name: string; color: string | null } | null;
  /** A Supporter's name colours (lib/supporter supporterInksForRsns), the same as their chat lines. */
  ink?: { color: string; grad?: string[]; move?: boolean } | null;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The name's colour: a Supporter's own, else their team's on a board, else muted. */
function whoInk(o: MomentRowOptions): Pick<FeedRow, 'whoColor' | 'grad' | 'move'> {
  if (o.ink && HEX.test(o.ink.color)) {
    const grad = (o.ink.grad ?? []).filter((c) => HEX.test(c)) as `#${string}`[];
    return { whoColor: o.ink.color as Color, ...(grad.length >= 2 ? { grad, ...(o.ink.move ? { move: true } : {}) } : {}) };
  }
  if (o.team?.color && HEX.test(o.team.color)) return { whoColor: o.team.color as Color };
  return { whoColor: 'muted' };
}

/** A row's item picture. Pets stored by name only (their log line names them) are looked up in the log. */
function itemOf(m: { kind: string; itemId?: number | null; itemName?: string | null }): number | null {
  if (m.itemId != null) return m.itemId;
  return m.kind === 'pet' ? clogItemIdByName(m.itemName) : null;
}

export function momentRow(m: MomentLike, o: MomentRowOptions = {}): FeedRow {
  const value = m.valueGp != null && m.valueGp > 0 ? formatGp(m.valueGp * Math.max(1, m.quantity)) : undefined;
  return {
    id: `m${m.id}`,
    // A death has no item: the game's Skull (item 964) stands for it.
    ...(itemOf(m) != null ? { item: itemOf(m)! } : m.kind === 'death' ? { item: 964 } : glyphOf(m.kind)),
    title: momentTitle(m),
    who: m.rsn,
    ...whoInk(o),
    ...(o.team ? { tag: o.team.name, tagColor: (o.team.color as Color | null) ?? 'muted' } : {}),
    at: m.occurredAt,
    ...(value ? { value } : {}),
    ...(m.kind === 'pet' ? { textColor: PET as Color } : m.kind === 'death' ? { textColor: 'error' as Color } : {}),
    ...(o.mine ? { mine: true } : {}),
    ...reactsOf(m.kind, o),
  };
}

/** Where a row's reaction goes: a clan's Feed (by slug) or a board's (by id). */
export type ReactOn = { slug: string } | { e: number };

/** The post a GZ / Sad / Sit chip sends (views reactRowAct): the opened list and a live row send the same. */
export function reactRowAction(on: ReactOn, momentId: number, kind: RowReactKind): Action {
  const where: Record<string, string> = 'slug' in on ? { slug: on.slug } : { e: String(on.e) };
  return { a: 'post', act: 'react-row', args: { ...where, id: String(momentId), kind } };
}

/**
 * A moment just stored, as its live row offers it: nobody has reacted yet, so every count is 0 and
 * the chip is the same for everyone it's sent to. Without it a pushed row showed no GZ until the
 * Feed was opened again. Undefined for a lab row (no real moment to react to).
 */
export function freshReacts(on: ReactOn, momentId: number): MomentRowOptions['reacts'] {
  if (!(momentId > 0)) return undefined;
  return { tally: () => ({ n: 0, mine: false }), act: (k) => reactRowAction(on, momentId, k) };
}

function reactsOf(kind: string, o: MomentRowOptions): Pick<FeedRow, 'gz' | 'reacts'> {
  if (!o.reacts) return {};
  const { tally, act, who } = o.reacts;
  const kinds = rowReactKinds(kind);
  const tip = (k: RowReactKind) => {
    const line = who ? whoText(REACT_LABEL[k], who(k) ?? []) : '';
    return line ? { who: line } : {};
  };
  if (kinds.length === 1 && kinds[0] === 'gz') return { gz: { ...tally('gz'), on: act('gz'), ...tip('gz') } };
  return { reacts: kinds.map((k) => ({ kind: k, label: REACT_LABEL[k], ...tally(k), on: act(k), ...tip(k) })) };
}

/** A board tile some team finished: the tile, who finished it (or the team), the team, when. */
export function completionRow(c: {
  tileId: number;
  teamId: number;
  label: string;
  who: string | null;
  team: { name: string; color: string | null } | null;
  at: string;
  mine?: boolean;
}): FeedRow {
  return {
    // One per tile and team: the live row and the opened list's row are the same row.
    id: `t${c.tileId}:${c.teamId}`,
    glyph: 'check',
    glyphColor: 'done',
    title: `Tile complete: ${c.label}`,
    // In the team's colour, so each team's finishes read at a glance (green when it has none).
    textColor: ((c.team?.color && /^#[0-9a-f]{6}$/i.test(c.team.color) ? c.team.color : 'done') as Color),
    // Who AND which team on the line itself: the plugin puts a row's tag only in its tooltip.
    who: c.who && c.team ? `${c.who} · ${c.team.name}` : c.who ?? c.team?.name ?? '',
    whoColor: 'muted',
    ...(c.team ? { tag: c.team.name, tagColor: (c.team.color as Color | null) ?? 'muted' } : {}),
    at: c.at,
    ...(c.mine ? { mine: true } : {}),
  };
}

/** The lists a finished tile goes in on its board: everything, Tiles, and its team's. */
export function completionFeedIds(eventId: number, teamId: number): string[] {
  const scope = { kind: 'event' as const, id: eventId };
  return [momentsFeedId(scope), momentsFeedId(scope, 'tiles'), momentsFeedId(scope, 'team', teamId)];
}

/** "+214 smaller drops in the last minute" — what a big board's floor kept out, so the list still says it's busy. */
export function rollupRow(eventId: number, count: number, at: string): FeedRow {
  return {
    id: `roll${eventId}:${at}`,
    glyph: 'chevron-right',
    glyphColor: 'muted',
    text: `+${count} smaller drop${count === 1 ? '' : 's'} in the last minute`,
    textColor: 'muted',
    at,
  };
}

export interface ChatLike {
  id: number;
  rsn: string;
  body: string;
  teamOnly: boolean;
  createdAt: string;
}

export interface ChatRowOptions {
  mine?: boolean;
  /** HOST / MOD, drawn as a tag before the name. */
  role?: 'host' | 'mod' | null;
  team?: { name: string; color: string | null } | null;
  /** Supporter name colour. */
  whoColor?: Color;
  grad?: `#${string}`[];
  move?: boolean;
  /** The viewer moderates: right-click to delete or mute. */
  modActions?: { del: Action; mute: Action } | null;
}

export function chatRow(m: ChatLike, o: ChatRowOptions = {}): FeedRow {
  const tag = o.role === 'host' ? 'HOST' : o.role === 'mod' ? 'MOD' : m.teamOnly ? 'TEAM' : o.team?.name;
  const tagColor: Color = o.role ? '#7ae0ff' : m.teamOnly ? 'claim' : ((o.team?.color as Color | null) ?? 'muted');
  return {
    id: `c${m.id}`,
    who: m.rsn,
    whoColor: o.whoColor ?? 'white',
    ...(o.grad ? { grad: o.grad } : {}),
    ...(o.grad && o.move ? { move: true } : {}),
    text: m.body,
    textColor: 'text',
    ...(tag ? { tag, tagColor } : {}),
    at: m.createdAt,
    ...(o.mine ? { mine: true } : {}),
    ...(o.modActions
      ? { menu: [{ label: 'Delete message', on: o.modActions.del }, { label: `Mute ${m.rsn}`, on: o.modActions.mute }] }
      : {}),
  };
}

// ── The tab ──────────────────────────────────────────────────────────────────────────────────────

const ON = 'brand';
const OFF = 'muted';

function chip(label: string, on: boolean, act: Action): Node {
  return text(label, on ? ON : OFF, { font: on ? 'bold' : 'small', on: act });
}

export interface FeedTabOptions {
  scopes: Scope[];
  current: Scope;
  /** 'feed' or 'chat' on a board whose chat is on and the viewer plays in. */
  pane: 'feed' | 'chat';
  chatAvailable: boolean;
  /** The filter chip that's lit. */
  filter: string;
  /** The viewer's team on this board, for "My team". */
  teamId: number | null;
  rows: FeedRow[];
  /** The floor line under the list: "Drops 5m+ · pets". */
  floorNote?: string;
  /** For the chat pane. */
  send?: { act: string; args: Record<string, string>; hint: string } | null;
  /** Chat: the names the viewer's own lines carry (lib/eventChat myChatNames), so live lines highlight too. */
  mine?: string[];
  locked?: string | null;
  /** The viewer moderates this chat: the mods filter and the pause switch show. */
  staff?: boolean;
  paused?: boolean;
}

const scopeKey = (s: Scope) => (s.kind === 'clan' ? `clan:${s.slug}` : `event:${s.id}`);

function load(args: Record<string, string>): Action {
  return { a: 'load', v: 'feed', args };
}

export function feedTabUi(o: FeedTabOptions): Node {
  const key = scopeKey(o.current);
  const parts: Node[] = [];

  // Which feed: a dropdown of every clan the viewer is in and every board they're on (chips ran out
  // of room past two). One scope is just a heading.
  if (o.scopes.length > 1) {
    parts.push(
      {
        t: 'input',
        name: 's',
        kind: 'select',
        options: o.scopes.map((s) => ({ v: scopeKey(s), label: `${s.kind === 'clan' ? 'Clan' : 'Event'} · ${s.name}` })),
        value: key,
        tip: 'Whose feed to show',
        on: load({}),
      } as Node,
      gap(4),
    );
  } else {
    parts.push(text(o.current.name, 'brand', { font: 'bold' }), gap(4));
  }

  if (o.chatAvailable) {
    parts.push(
      rowOf([
        chip('Feed', o.pane === 'feed', load({ s: key, p: 'feed' })),
        chip('Chat', o.pane === 'chat', load({ s: key, p: 'chat' })),
      ]),
      gap(4),
    );
  }

  const filters: [string, string][] =
    o.pane === 'chat'
      ? [['all', 'All'], ...(o.teamId != null ? [['team', 'My team'] as [string, string]] : []), ...(o.staff ? [['mods', 'Host & mods'] as [string, string]] : [])]
      // Achievements: log slots, diaries, quests, the clan's level milestones and combat-task tier,
      // kept for the clan whether or not anything is running (a board keeps its own tasks and levels).
      : [
          ['all', 'All'],
          // A board's finished tiles (lib/panelRows completionRow); a clan has no tiles of its own.
          ...(o.current.kind === 'event' ? [['tiles', 'Tiles'] as [string, string]] : []),
          ['drops', 'Drops'],
          ['pets', 'Pets'],
          ['achievements', 'Achievements'],
          // A board keeps every death; a clan its members' deaths unless it turned them off (Rules).
          ['deaths', 'Deaths'],
          ...(o.current.kind === 'event' && o.teamId != null ? [['team', 'My team'] as [string, string]] : []),
        ];
  // Three to a row: the panel splits a row evenly, and "Achievements" is too wide for a quarter of it.
  parts.push(rowOf(filters.map(([id, label]) => chip(label, o.filter === id, load({ s: key, p: o.pane, f: id }))), 3), gap(4));

  const id =
    o.pane === 'chat' && o.current.kind === 'event'
      ? chatFeedId(o.current.id, o.filter === 'team' ? 'team' : o.filter === 'mods' ? 'mods' : undefined, o.teamId)
      : momentsFeedId(o.current, o.filter === 'all' ? undefined : (o.filter as KindGroup | 'team' | 'tiles'), o.teamId);

  parts.push({
    t: 'feed',
    id,
    rows: o.rows,
    cap: o.pane === 'chat' ? 300 : 200,
    h: 460,
    empty: emptyLine(o.pane, o.filter),
    ...(o.pane === 'chat' && o.send ? { send: { ...o.send, max: 200 } } : {}),
    ...(o.pane === 'chat' && o.mine?.length ? { mine: o.mine } : {}),
    ...(o.locked ? { locked: o.locked } : {}),
  });

  if (o.pane === 'chat' && o.staff && o.current.kind === 'event') {
    parts.push(
      gap(4),
      text(o.paused ? 'Resume chat' : 'Pause chat (read-only for everyone)', o.paused ? 'done' : 'muted', {
        font: 'small',
        on: { a: 'post', act: 'chat-pause', args: { e: String(o.current.id), on: o.paused ? '0' : '1', s: key } },
      }),
    );
  }
  if (o.floorNote && o.pane === 'feed') parts.push(gap(4), muted(o.floorNote, { font: 'small' }));
  return col(parts);
}

/** What an empty list says, for the filter that's on. */
function emptyLine(pane: 'feed' | 'chat', filter: string): string {
  if (pane === 'chat') return filter === 'team' ? 'Nothing said to your team yet.' : filter === 'mods' ? 'The host and mods haven’t said anything yet.' : 'No messages yet. Say hi to the board.';
  if (filter === 'pets') return 'No pets yet. The next one lands here.';
  if (filter === 'drops') return 'No big drops yet. The next one lands here.';
  if (filter === 'achievements') return 'No achievements yet. The next log slot, 99 or diary lands here.';
  if (filter === 'team') return 'Nothing from your team yet.';
  return 'Nothing yet. The next pet, big drop or achievement lands here.';
}

/** A row of chips with a little space between, wrapping is the plugin's business. */
function rowOf(items: Node[], maxCols = 5): Node {
  return { t: 'grid', cols: Math.min(items.length, maxCols), c: items, gap: 4, vgap: 2 };
}

/**
 * "Feed" and "Chat" for one board, side by side: straight to its list or its chat on the Feed view.
 * `back` (a Clan-tab page, e.g. 'board') puts a way back over the feed.
 */
export function boardFeedLinks(eventId: number, back?: { open: string; label: string }): Node {
  const go = (p: 'feed' | 'chat'): Action => ({
    a: 'load',
    v: 'feed',
    args: { s: `event:${eventId}`, p, ...(back ? { back: back.open, backLabel: back.label } : {}) },
  });
  return {
    t: 'grid',
    cols: 2,
    gap: 6,
    c: [button('Feed', go('feed'), 'This board’s drops, pets and finished tiles'), button('Chat', go('chat'), 'This board’s chat')],
  };
}
