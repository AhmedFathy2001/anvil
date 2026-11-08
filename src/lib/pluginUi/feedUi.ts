import { formatGp } from '@/lib/itemPrices';
import { shownKiller } from '@/lib/deathSource';
import { clogItemIdByName } from '@/lib/moments';
import { fallenTitle, isFallenDeath } from '@/lib/hardcoreFall';
import { whoText } from '@/lib/reactionWho';
import { runSuffix } from '@/lib/feedRuns';
import { clanBoostInk } from '@/lib/clanBoostRules';
import type { ClanBoostNameStyle } from '@/lib/clanBoostRules';
import { inkForSurface } from '@/lib/supporterStyle';
import type { ChatLock } from '@/lib/eventChatRules';

import type { Action, Color, FeedRow, Node } from './nodes';
import { badge, button, col, gap, hero, muted, nameTint, row, text } from './nodes';
import { BLUE, GREEN, CORAL, PURPLE, TINT, boxChip, openRow, section, segSwitch } from './sections';
import { revisedMediaPath } from './mediaRevision';
import { CLUE_ITEM, milestoneTitle } from '@/lib/milestoneMoments';

// The plugin panel's Feed tab (view 'feed'): one live list per scope — the clan's moments, a board's
// moments, a board's chat — drawn once and then grown by push rows (lib/panelRows). Pure: the view
// in pluginUi/views gathers the data, this decides how it reads.
//
// Feed ids are how a push row finds its list. A row names every list it belongs in, so a filtered
// view is just another id and the plugin never has to understand a filter:
//   moments:clan:<clan>[:<group>]        a clan's moments, all or one kind group
//   moments:event:<event>[:<group>]      a board's moments
//   moments:event:<event>:team:<team>    one team's moments on it
//   chat:<event>:all · chat:<event>:team:<team> · chat:<event>:announce   (lib/eventChatRules ChatChannel)

export type KindGroup = 'drops' | 'pets' | 'achievements' | 'deaths' | 'milestones';
export const KIND_GROUPS: KindGroup[] = ['drops', 'pets', 'achievements', 'deaths', 'milestones'];

export function kindGroup(kind: string): KindGroup | null {
  if (kind === 'unique' || kind === 'loot') return 'drops';
  if (kind === 'pet') return 'pets';
  if (kind === 'death') return 'deaths';
  // Slayer, clues, speedruns, kill counts, BA gambles, clan patterns (lib/milestoneMoments).
  if (kind === 'milestone') return 'milestones';
  // Combat tasks, level milestones, log slots, diaries, quests (lib/moments ACHIEVEMENT_KINDS).
  if (kind === 'ca' || kind === 'level' || kind === 'clog' || kind === 'diary' || kind === 'quest' || kind === 'mode') return 'achievements';
  return null;
}

export type Scope = { kind: 'clan'; id: number; slug: string; name: string; boostLevel?: number; boostNameStyle?: ClanBoostNameStyle | null; banner?: boolean; logo?: boolean; mediaRevision?: string } | { kind: 'event'; id: number; name: string };

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

/** The opt-in separate-save timeline. It is deliberately outside every ordinary moments feed id. */
export function modeFeedId(clanId: number, filter?: KindGroup, worldMode?: string | null): string {
  const mode = worldMode ? `:mode:${encodeURIComponent(worldMode)}` : '';
  return `moments:clan:${clanId}:modes${mode}${filter ? `:${filter}` : ''}`;
}

export function modeMomentFeedIds(clanId: number, kind: string, mode?: string | null): string[] {
  const ids = [modeFeedId(clanId)];
  const g = kindGroup(kind);
  if (g) ids.push(modeFeedId(clanId, g));
  // A filtered mode list is a separate live address: a Leagues row must not enter Hardcore's view.
  if (mode) {
    ids.push(modeFeedId(clanId, undefined, mode));
    if (g) ids.push(modeFeedId(clanId, g, mode));
  }
  // A Fallen row is one stored moment with two doorways: Modes and the familiar Deaths filter.
  if (mode === 'hardcore' && kind === 'death') ids.push(momentsFeedId({ kind: 'clan', id: clanId }, 'deaths'));
  return ids;
}

/** One chat channel's list: chat:<event>:all · chat:<event>:team:<team> · chat:<event>:announce. */
export function chatFeedId(eventId: number, channel: string): string {
  return `chat:${eventId}:${channel}`;
}

/**
 * The lists a lock push names (the plugin matches them as prefixes). `chat:<event>` is every channel;
 * the board's pause, and a box reopening, name only the channels a player talks in, so the read-only
 * line on Announcements stays put.
 */
export function chatLockFeeds(eventId: number, which: 'every' | 'talk'): string[] {
  return which === 'every' ? [`chat:${eventId}`] : [`chat:${eventId}:all`, `chat:${eventId}:team`];
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
  worldMode?: string | null;
  worldModeLabel?: string | null;
  /** Back-to-back repeats this row stands for (lib/feedRuns): "×12" after the title. */
  run?: { n: number; mixed?: boolean } | null;
}

const PET = PURPLE;
/** A drop worth this much reads as rare: purple, like a pet. */
const RARE_GP = 10_000_000;
const ACHIEVEMENT = '#ffd35c';
export function momentTitle(m: MomentLike): string {
  const run = m.run && m.run.n > 1 ? m.run : null;
  if (!run) return oneTitle(m);
  // Deaths to different killers: the count leads, the latest killer after it.
  if (m.kind === 'death' && run.mixed) return m.source ? `Died ×${run.n} · last to ${m.source}` : `Died ×${run.n}`;
  return `${oneTitle(m)}${runSuffix(run)}`;
}

function rawTotalLevel(m: Pick<MomentLike, 'itemName' | 'source'>): number | null {
  for (const line of [m.itemName, m.source]) {
    if (!line) continue;
    const match = /\breached a total level of\s+([\d,]+)/i.exec(line);
    if (match) return Number(match[1].replace(/,/g, ''));
  }
  return null;
}

function oneTitle(m: MomentLike): string {
  const name = m.itemName ?? m.source ?? m.kind;
  // Older mode rows stored this main-game announcement verbatim. Normalize it at presentation time
  // as well as structured `level` rows, so historical rows become compact without a migration.
  const rawTotal = rawTotalLevel(m);
  if (rawTotal != null) return `${rawTotal.toLocaleString('en-US')} total`;
  if (m.kind === 'pet') return `Pet: ${name}`;
  if (isFallenDeath(m)) return fallenTitle(shownKiller(m.source));
  if (m.kind === 'death') return shownKiller(m.source) ? `Died to ${m.source}` : 'Died';
  if (m.kind === 'ca') return m.tier ? `${m.tier}: ${name}` : name;
  if (m.kind === 'level') {
    // The number reached rides in `quantity`, the skill in `itemName` (lib/moments Observation).
    const n = m.quantity.toLocaleString('en-US');
    if (m.sourceKind === 'max') return `Maxed: ${n} total level`;
    if (m.sourceKind === 'total') return `${n} total`;
    return m.itemName ? `${n} ${m.itemName}` : `Level ${n}`;
  }
  if (m.kind === 'clog') return name;
  if (m.kind === 'diary') return `${m.tier ? `${m.tier} ` : ''}${name}`;
  if (m.kind === 'quest') return m.sourceKind === 'cape' ? `Quest cape: ${name}` : name;
  if (m.kind === 'milestone') return milestoneTitle(m);
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

/**
 * The row's colour by kind, on its title and the tile behind its picture: purple for a pet, a log
 * slot or a rare drop; green for a 99 or a max; coral for a death. Everything else stays plain.
 */
function toneOf(m: MomentLike, totalLevel: boolean): Pick<FeedRow, 'textColor' | 'tint'> {
  if (m.kind === 'death') return { textColor: CORAL, tint: TINT.coral };
  if (m.kind === 'pet' || m.kind === 'clog' || (m.kind === 'drop' && (m.valueGp ?? 0) >= RARE_GP)) return { textColor: PURPLE, tint: TINT.purple };
  if (m.kind === 'level' && (m.sourceKind === 'max' || (!totalLevel && m.quantity >= 99))) return { textColor: GREEN, tint: TINT.green };
  // Milestones read as info (blue); a master clue as rare (purple).
  if (m.kind === 'milestone') return m.sourceKind === 'clues' && m.tier === 'master' ? { textColor: PURPLE, tint: TINT.purple } : { textColor: BLUE, tint: TINT.blue };
  return {};
}

export function momentRow(m: MomentLike, o: MomentRowOptions = {}): FeedRow {
  // valueGp is the whole stack's worth (the plugin prices quantity × each), so it is shown as is.
  const value = m.valueGp != null && m.valueGp > 0 ? formatGp(m.valueGp) : undefined;
  const totalLevel = (m.kind === 'level' && (m.sourceKind === 'total' || m.sourceKind === 'max')) || rawTotalLevel(m) != null;
  const levelSkill = m.kind === 'level' && !totalLevel ? m.itemName?.trim().toLowerCase() : null;
  return {
    id: `m${m.id}`,
    // A death has no item: the game's Skull (item 964) stands for it.
    ...(totalLevel
      ? { sprite: 'total' as const }
      : levelSkill
      ? { skill: levelSkill }
      : m.kind === 'milestone' && m.sourceKind === 'slayer'
      ? { skill: 'slayer' }
      : m.kind === 'milestone' && m.sourceKind === 'clues' && m.tier && CLUE_ITEM[m.tier]
      ? { item: CLUE_ITEM[m.tier] }
      : m.kind === 'milestone'
      ? { glyph: 'check' as const, glyphColor: BLUE as Color }
      : m.kind === 'clog'
        ? { sprite: 'collection-log' as const }
        : itemOf(m) != null
          ? { item: itemOf(m)! }
          : m.kind === 'death'
            ? { item: 964 }
            : m.kind === 'quest'
              ? { sprite: 'quest' as const }
              : m.kind === 'diary'
                ? { sprite: 'diary' as const }
                : m.kind === 'ca'
                  ? { sprite: 'combat' as const }
                  : glyphOf(m.kind)),
    title: momentTitle(m),
    who: m.rsn,
    ...whoInk(o),
    ...(o.team
      ? { tag: o.team.name, tagColor: (o.team.color as Color | null) ?? 'muted' }
      : m.worldModeLabel
        ? { tag: m.worldModeLabel, tagColor: (m.worldMode === 'hardcore' ? 'error' : 'brand') as Color }
        : {}),
    at: m.occurredAt,
    ...(value ? { value } : {}),
    ...toneOf(m, totalLevel),
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
    // The green check on a green tile says "complete"; the line is the tile, green too. The team
    // is the row's tag, in its own colour.
    title: c.label,
    textColor: GREEN,
    tint: TINT.green,
    // Who, then the team as the row's tag (the panel prints it after the name). No finisher: the team
    // is the name, untagged, so it never reads "Jade · Jade".
    who: c.who ?? c.team?.name ?? '',
    whoColor: 'muted',
    ...(c.team && c.who ? { tag: c.team.name, tagColor: (c.team.color as Color | null) ?? 'muted' } : {}),
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
  // HOST in gold, MOD in blue (the mockup's chips); everyone else carries their team's name.
  const tag = o.role === 'host' ? 'HOST' : o.role === 'mod' ? 'MOD' : o.team?.name;
  const tagColor: Color = o.role === 'host' ? '#ffb54d' : o.role === 'mod' ? '#8cc8ff' : ((o.team?.color as Color | null) ?? 'muted');
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

/** One segment of the chat's channel switch (nodes feed `chans`). */
export interface ChatChan {
  label: string;
  on: boolean;
  act: Action;
  feed: string;
  n?: number;
  blue?: boolean;
}

export interface FeedTabOptions {
  scopes: Scope[];
  current: Scope;
  /** 'feed' or 'chat' on a board whose chat is on and the viewer plays in. */
  pane: 'feed' | 'chat';
  chatAvailable: boolean;
  /** A board whose chat is closed to this viewer: why, said where the Chat chip would be. */
  chatClosed?: string | null;
  /** The filter chip that's lit. */
  filter: string;
  /** The viewer's team on this board, for "My team". */
  teamId: number | null;
  rows: FeedRow[];
  /** This plugin advertises panel image support. */
  images?: boolean;
  /** The floor line under the list: "Drops 5m+ · pets". */
  floorNote?: string;
  /** For the chat pane. */
  send?: { act: string; args: Record<string, string>; hint: string } | null;
  /** Chat: the names the viewer's own lines carry (lib/eventChat myChatNames), so live lines highlight too. */
  mine?: string[];
  /** Chat: what stands in place of the message box (lib/eventChatRules lockFor). */
  lock?: ChatLock | null;
  /** Chat: the channel switch (My team | All teams | Announcements) over the list. */
  chans?: ChatChan[];
  /** Chat, staff on a team channel: which team's, as chips. */
  teamPicks?: { label: string; on: boolean; act: Action }[] | null;
  /** Chat: the open channel's list id (lib/eventChatRules ChatChannel via chatFeedId). */
  feedId?: string;
  /** The viewer moderates this chat: the mods filter and the pause switch show. */
  staff?: boolean;
  paused?: boolean;
  /** Quiet doorway on the ordinary clan feed; when active, this view is the separate-save timeline. */
  mode?: {
    active: boolean;
    count: number;
    selected?: string;
    options?: { key: string; label: string }[];
  } | null;
}

const scopeKey = (s: Scope) => (s.kind === 'clan' ? `clan:${s.slug}` : `event:${s.id}`);

function load(args: Record<string, string>): Action {
  return { a: 'load', v: 'feed', args };
}

export function feedTabUi(o: FeedTabOptions): Node {
  const key = scopeKey(o.current);
  const parts: Node[] = [];

  // The top card says where you are: which feed (a dropdown of every clan the viewer is in and every
  // board they're on; one scope is just its name), and what lands in it.
  const top: Node[] = [];
  if (o.scopes.length > 1) {
    top.push(
      {
        t: 'input',
        name: 's',
        kind: 'select',
        options: o.scopes.map((s) => ({ v: scopeKey(s), label: `${s.kind === 'clan' ? 'Clan' : 'Event'} · ${s.name}` })),
        value: key,
        tip: 'Whose feed to show',
        on: load({}),
      } as Node,
    );
  }
  const live = !o.mode?.active
    ? text('', 'muted', { font: 'small', runs: [{ s: 'Live', color: BLUE }, { s: o.pane === 'chat' ? ' · your board’s chat' : o.current.kind === 'event' ? ' · drops, pets and finished tiles from every team' : ' · drops, pets and achievements from the clan', color: 'muted' }] })
    : null;
  const cur = o.current;
  if (cur.kind === 'clan') {
    // The clan's header is the shared hero card: banner, badge over it, the name, what lands here.
    const sourceBoost = clanBoostInk(cur.boostLevel ?? 0, cur.boostNameStyle);
    const boost = sourceBoost ? inkForSurface(sourceBoost, 'dark') : null;
    const slug = encodeURIComponent(cur.slug);
    const rev = (kind: 'banner' | 'logo') => revisedMediaPath(`/api/plugin/media/clan/${slug}?kind=${kind}`, cur.mediaRevision, cur.boostLevel ?? 0);
    parts.push(hero(
      o.images && cur.banner ? { src: rev('banner'), motion: (cur.boostLevel ?? 0) >= 2 } : null,
      nameTint(cur.name),
      badge(o.images && cur.logo ? { t: 'img', src: rev('logo'), w: 32, h: 32, rad: 4, motion: true } : undefined, cur.name),
      [text(cur.name, boost?.color ?? 'white', { font: 'bold', ...(boost?.grad ? { grad: boost.grad } : {}), ...(boost?.move ? { move: true } : {}) })],
      live ? [live] : [],
    ), gap(6));
  } else {
    if (o.scopes.length <= 1) top.push(text(o.current.name, 'brand', { font: 'bold' }));
    if (live) top.push(live);
  }
  if (top.length) parts.push(section(top), gap(6));

  if (o.mode?.active) {
    parts.push(
      text('‹ Feed', 'muted', { font: 'small', on: load({ s: key, p: 'feed' }) }),
      text('Game-mode activity', 'brand', { font: 'bold' }),
      muted('Separate from main-game progress', { font: 'small' }),
      gap(4),
    );
    if ((o.mode.options?.length ?? 0) > 1) {
      parts.push(
        {
          t: 'input',
          name: 'wm',
          kind: 'select',
          options: [
            { v: 'all', label: 'All game modes' },
            ...o.mode.options!.map((m) => ({ v: m.key, label: m.label })),
          ],
          value: o.mode.selected || 'all',
          tip: 'Show activity from one separate-save mode',
          on: load({ s: key, p: 'feed', m: '1', f: o.filter }),
        } as Node,
        gap(4),
      );
    }
  } else if (o.chatAvailable) {
    parts.push(
      segSwitch(`feed-pane:${key}`, [
        { label: 'Feed', on: o.pane === 'feed', act: load({ s: key, p: 'feed' }) },
        { label: 'Chat', on: o.pane === 'chat', act: load({ s: key, p: 'chat' }) },
      ]),
      gap(6),
    );
  } else if (o.chatClosed) {
    parts.push(muted(o.chatClosed, { wrap: true }), gap(4));
  }

  // The chat's channels are a switch on the list itself (`chans`); staff pick a team's under it.
  if (o.pane === 'chat' && o.teamPicks?.length) parts.push(rowOf(o.teamPicks.map((t) => boxChip(t.label, t.on, t.act)), 3), gap(4));
  const filters: [string, string][] =
    o.pane === 'chat'
      ? []
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
          // Slayer, clues, speedruns, kill counts, BA gambles: the clan's and each live board's.
          ['milestones', 'Milestones'],
          ...(o.current.kind === 'event' && o.teamId != null ? [['team', 'My team'] as [string, string]] : []),
        ];
  // Three to a row: the panel splits a row evenly, and "Achievements" is too wide for a quarter of it.
  if (filters.length) parts.push(rowOf(filters.map(([id, label]) => boxChip(label, o.filter === id, load({
    s: key,
    p: o.pane,
    f: id,
    ...(o.mode?.active ? { m: '1', ...(o.mode.selected && o.mode.selected !== 'all' ? { wm: o.mode.selected } : {}) } : {}),
  }))), 3), gap(6));

  const id =
    o.mode?.active && o.current.kind === 'clan'
      ? modeFeedId(
          o.current.id,
          o.filter === 'all' ? undefined : (o.filter as KindGroup),
          o.mode.selected === 'all' ? undefined : o.mode.selected,
        )
      : o.pane === 'chat' && o.current.kind === 'event'
      ? (o.feedId ?? chatFeedId(o.current.id, o.filter))
      : momentsFeedId(o.current, o.filter === 'all' ? undefined : (o.filter as KindGroup | 'team' | 'tiles'), o.teamId);

  parts.push({
    t: 'feed',
    id,
    rows: o.rows,
    cap: o.pane === 'chat' ? 300 : 200,
    h: 460,
    empty: o.mode?.active ? emptyModeLine(o.filter) : emptyLine(o.pane, o.filter),
    ...(o.pane === 'chat' && o.send ? { send: { ...o.send, max: 200 } } : {}),
    ...(o.pane === 'chat' && o.mine?.length ? { mine: o.mine } : {}),
    ...(o.pane === 'chat' && o.chans?.length ? { chans: o.chans } : {}),
    ...(o.lock ? { locked: o.lock.locked, ...(o.lock.sub ? { lockSub: o.lock.sub } : {}), ...(o.lock.warn ? { lockWarn: true } : {}) } : {}),
  });

  if (!o.mode?.active && o.mode && o.mode.count > 0 && o.pane === 'feed' && o.current.kind === 'clan') {
    parts.push(
      gap(6),
      openRow(
        text(`Game-mode activity · ${o.mode.count}`),
        undefined,
        [],
        load({ s: key, p: 'feed', m: '1', f: 'all', wm: 'all' }),
        'Leagues, Hardcore Worlds, Deadman and other separate saves',
      ),
    );
  }

  if (o.pane === 'chat' && o.staff && o.current.kind === 'event') {
    parts.push(
      gap(4),
      button(
        o.paused ? 'Resume chat' : 'Pause chat',
        { a: 'post', act: 'chat-pause', args: { e: String(o.current.id), on: o.paused ? '0' : '1', s: key } },
        o.paused ? 'Let everyone talk again' : 'Read-only for everyone until resumed',
      ),
    );
  }
  if (o.floorNote && o.pane === 'feed') parts.push(gap(4), muted(o.floorNote, { font: 'small' }));
  return col(parts);
}

function emptyModeLine(filter: string): string {
  if (filter === 'pets') return 'No game-mode pets yet.';
  if (filter === 'drops') return 'No notable game-mode drops yet.';
  if (filter === 'achievements') return 'No game-mode achievements yet.';
  if (filter === 'deaths') return 'No game-mode deaths yet.';
  return 'No game-mode activity yet.';
}

/** What an empty list says, for the filter that's on. */
function emptyLine(pane: 'feed' | 'chat', filter: string): string {
  if (pane === 'chat') return filter.startsWith('team') ? 'Nothing said to your team yet.' : filter === 'announce' ? 'No announcements yet.' : 'No messages yet. Say hi to the board.';
  if (filter === 'pets') return 'No pets yet. The next one lands here.';
  if (filter === 'drops') return 'No big drops yet. The next one lands here.';
  if (filter === 'achievements') return 'No achievements yet. The next log slot, 99 or diary lands here.';
  if (filter === 'milestones') return 'No milestones yet. Slayer tasks, clues, PBs, kill counts and BA gambles land here once members turn them on.';
  if (filter === 'team') return 'Nothing from your team yet.';
  return 'Nothing yet. The next pet, big drop or achievement lands here.';
}

/** A row of chips with a little space between, wrapping is the plugin's business. */
function rowOf(items: Node[], maxCols = 5): Node {
  return { t: 'grid', cols: Math.min(items.length, maxCols), c: items, gap: 4, vgap: 4 };
}

/**
 * "Feed" and "Chat" for one board, side by side: straight to its list or its chat on the Feed view.
 * `tab`: the plugin opens it on its own Feed tab (hasTabArgs). Otherwise it loads in this tab, and
 * `back` (a Clan-tab page, e.g. 'board') puts a way back over the feed.
 */
export function boardFeedLinks(eventId: number, back?: { open: string; label: string }, tab = false, chat = true): Node {
  const go = (p: 'feed' | 'chat'): Action =>
    tab
      ? { a: 'tab', tab: 'feed', args: { s: `event:${eventId}`, p } }
      : {
          a: 'load',
          v: 'feed',
          args: { s: `event:${eventId}`, p, ...(back ? { back: back.open, backLabel: back.label } : {}) },
        };
  const feed = button('Feed', go('feed'), 'This board’s drops, pets and finished tiles');
  // No Chat button on a board whose chat is off: it would only open a pane saying so.
  if (!chat) return feed;
  return { t: 'grid', cols: 2, gap: 6, c: [feed, button('Chat', go('chat'), 'This board’s chat')] };
}
