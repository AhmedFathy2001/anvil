import { BOSSES } from '@/lib/constants';
import type { PlayerCard, PlayerCardPage } from '@/lib/playerCardShape';
import { XP_TABLE } from '@/lib/xp';

import {
  type Action,
  type Node,
  button,
  card,
  col,
  count,
  fmt,
  gap,
  icon,
  muted,
  nameText,
  percent,
  row,
  seg,
  text,
} from './nodes';
import { mediaRevision, revisedMediaPath } from './mediaRevision';
import { GOLD, GREEN, PURPLE, big, section, small, title } from './sections';

// A player card as the plugin's Lookup and You tabs draw it (was PlayerCardView.java). Pure: the
// route loads the card, this decides every line.
//
// Two layers. The summary says who this is and what's notable: clan, totals, how far the log is,
// what happened lately. Under it a switcher opens the profile itself — skills as the game's skill
// grid, bosses and clues as icon grids, the log as categories that open into pages. Only what has a
// number is drawn: at ~230px a table of every row is mostly `0 / --`.

/** The game's skill tab, read left to right: what a player's eye already knows. */
export const SKILL_GRID = [
  'attack', 'hitpoints', 'mining',
  'strength', 'agility', 'smithing',
  'defence', 'herblore', 'fishing',
  'ranged', 'thieving', 'cooking',
  'prayer', 'crafting', 'firemaking',
  'magic', 'fletching', 'woodcutting',
  'runecraft', 'slayer', 'farming',
  'construction', 'hunter', 'sailing',
] as const;

const SEARCH_FROM = 10;

/** Clue tiers have no hiscore sprite; the game's own clue scroll items stand in. */
const CLUE_ITEMS: Record<string, number> = {
  cluesBeginner: 23182, cluesEasy: 2677, cluesMedium: 2801, cluesHard: 2722, cluesElite: 12073, cluesMaster: 19835,
};

/**
 * Activities whose site key the plugin can't fold onto RuneLite's hiscore entry ("bhHunter" is not
 * "Bounty Hunter - Hunter"), so the card names the entry outright. The legacy ladders share the
 * current ones' emblem — RuneLite has no separate sprite for them.
 */
const HISCORE_NAMES: Record<string, string> = {
  bhHunter: 'Bounty Hunter - Hunter', bhHunterLegacy: 'Bounty Hunter - Hunter',
  bhRogue: 'Bounty Hunter - Rogue', bhRogueLegacy: 'Bounty Hunter - Rogue',
};

const ACCOUNT_TYPES: Record<string, string> = {
  normal: 'Main', main: 'Main', ironman: 'Ironman', ultimate: 'UIM', hardcore: 'HCIM',
  group: 'GIM', hardcore_group: 'HCGIM', unranked_group: 'UGIM',
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES[type] ?? type[0].toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Level off XP past 99, as the game's virtual levels count it (to 126). */
export function virtualLevel(xp: number): number {
  for (let level = XP_TABLE.length - 1; level >= 1; level--) {
    if (xp >= XP_TABLE[level]) return level;
  }
  return 1;
}

/** The log page a clue tier fills: cluesHard → "Hard Treasure Trails". "All tiers" has none. */
export function cluePage(key: string): string | null {
  if (!key.startsWith('clues') || key === 'cluesAll') return null;
  const tier = key.slice('clues'.length);
  return tier ? `${tier} Treasure Trails` : null;
}

/**
 * What a milestone is about, so it can wear its boss or skill icon: "500 Zulrah KC" → "Zulrah",
 * "50M Attack XP" → "Attack", "99 Attack" → "Attack".
 */
export function milestoneSubject(label: string): string {
  return label.replace(/^[\d,.]+[KMBkmb]?\s+/, '').replace(/\s+(KC|XP)$/, '');
}

/** Kills behind each log page — a raid's page counts every mode, as the game's log counts it. */
export function pageKills(card: PlayerCard): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of card.bosses) {
    if (b.clogPage && b.kc > 0) out.set(b.clogPage.toLowerCase(), (out.get(b.clogPage.toLowerCase()) ?? 0) + b.kc);
  }
  return out;
}

export const profilePath = (rsn: string) => `/p/${seg(rsn)}`;

/** Where a log page opens: the page view in the card's `log` slot, with a way back to `back`. */
export function openPage(rsn: string, page: string, back: string, kc?: number): Action {
  return {
    a: 'load',
    v: 'clog-page',
    args: { rsn, page, back, ...(kc ? { kc: String(kc) } : {}) },
    into: 'log',
  };
}

export interface CardOptions {
  /** Which profile section's choice the plugin remembers ("you" and "lookup" keep their own). */
  sectionKey: string;
  /** The Combat achievements tab (`player-cas`): loaded when first opened. */
  cas: boolean;
  /** The character the viewer is playing, for "Compare with me". */
  me?: string | null;
  /** This plugin advertises panel image support. */
  images?: boolean;
  /** Your own card: the log's progress sits in the top card. */
  own?: boolean;
  /** Display case slots the owner's Supporter tier allows ("4 of 4 slots"); omitted, no count. */
  slots?: number;
  /** Cards that go right under the top card (You: a challenge to answer, running head-to-heads). */
  afterTop?: Node[];
}

export function playerCardUi(c: PlayerCard, opts: CardOptions): Node {
  const anvil = c.source !== 'hiscores';
  const parts: Node[] = [];
  if (anvil && opts.images && c.panelMedia?.banner) {
    parts.push({
      t: 'img',
      src: revisedMediaPath(`/api/plugin/media/player/${seg(c.rsn)}?kind=banner`, c.panelMedia.revision),
      w: 220,
      h: 73,
      ...(c.panelMedia.bannerAnimated ? { motion: true } : {}),
    });
  }
  parts.push(identity(c, anvil, !!opts.images, !!opts.own));
  // "Compare with me" is the one action, right under who this is. Between Anvil profiles only.
  if (anvil && opts.me && opts.me.trim().toLowerCase() !== c.rsn.trim().toLowerCase()) {
    parts.push(button('Compare with me', { a: 'load', v: 'compare', args: { rsn: c.rsn } }, 'Side by side: levels, bosses and the log'));
  }
  parts.push(...(opts.afterTop ?? []));
  if (anvil && c.displayCase?.length) parts.push(displayCase(c, opts.slots));

  // Stats | Bosses | Log (the collection log; the full words don't fit a third of 220px), the rest (Clues, Times, CAs) folded under them.
  const kills = pageKills(c);
  const sections: { label: string; c: Node }[] = [];
  const pages = new Set(anvil ? c.clogPages.map((p) => p.name.toLowerCase()) : []);
  const opens = (page: string | null | undefined, kc?: number): Action | undefined =>
    page && pages.has(page.toLowerCase()) ? openPage(c.rsn, page, 'root', kc) : undefined;

  if (c.skills.length) sections.push({ label: 'Stats', c: skills(c) });
  const bosses = c.bosses.length ? c.bosses : c.topBosses;
  if (bosses.length) {
    const killed = new Set(bosses.map((b) => b.key));
    const cells: Node[] = bosses.map((b) => {
      const on = opens(b.clogPage, kills.get(b.clogPage?.toLowerCase() ?? ''));
      return countCell(icon({ boss: b.key }), b.label, b.kc, `${b.label} — ${fmt(b.kc)} kills${on ? ' · click for its log' : ''}`, on);
    });
    // A boss they've never killed isn't on the card; a search for it still answers: 0 KC.
    for (const b of BOSSES) {
      if (!killed.has(b.key)) {
        cells.push({ ...countCell(icon({ boss: b.key }), b.label, 0, `${b.label} — 0 kills`), k: [b.label, ...(b.aliases ?? [])].join(' '), q: true });
      }
    }
    sections.push({ label: 'Bosses', c: searchable('bosses', bosses.length, { t: 'grid', cols: 3, gap: 2, vgap: 2, c: cells }) });
  }
  if (anvil && c.clog && c.clog.total > 0) sections.push({ label: 'Log', c: logTab(c, kills) });
  else if (anvil) sections.push({ label: 'Log', c: card([muted('No collection log synced yet. Sync profile (⚙) sends it.', { wrap: true })]) });

  const more: { label: string; c: Node }[] = [];
  if (c.activities.length) {
    const cells = c.activities.map((a) => {
      const name = a.shortLabel || a.label;
      const pic = CLUE_ITEMS[a.key] ? icon({ item: CLUE_ITEMS[a.key] }) : icon({ boss: HISCORE_NAMES[a.key] ?? a.key });
      return countCell(pic, name, a.score, `${a.label} — ${fmt(a.score)}`, opens(cluePage(a.key)));
    });
    more.push({ label: 'Clues', c: card([{ t: 'grid', cols: 3, gap: 2, vgap: 2, c: cells }]) });
  }
  if (anvil && c.times.length) more.push({ label: 'Times', c: times(c) });
  if (anvil && opts.cas) {
    more.push({
      label: 'CAs',
      c: card([
        { t: 'slot', id: 'cas', c: muted('Loading combat achievements…'), load: { a: 'load', v: 'cas', args: { rsn: c.rsn }, into: 'cas' } },
      ]),
    });
  }
  if (sections.length) parts.push({ t: 'tabs', key: opts.sectionKey, tabs: sections });
  if (more.length) {
    parts.push({
      t: 'fold',
      head: muted(`${more.map((m) => m.label).join(' · ')} ▾`, { font: 'small', align: 'r' }),
      c: { t: 'tabs', key: `${opts.sectionKey}:more`, tabs: more },
    });
  }
  if (anvil && c.latest.length) parts.push(latest(c));
  return col(parts, { gap: 8 });
}

/** "Not on Anvil" — the same words whether the name is unknown or simply not shared. */
export function notFoundUi(rsn: string): Node {
  return card([text(rsn, 'white', { font: 'bold' }), gap(4), muted('Not on Anvil yet — or they haven’t shared their profile.', { wrap: true })]);
}

function identity(c: PlayerCard, anvil: boolean, images: boolean, own: boolean): Node {
  const details: Node[] = [
    row(
      anvil ? nameText(c.rsn, 'white', { font: 'bold' }) : text(c.rsn, 'white', { font: 'bold' }),
      undefined,
      anvil ? icon({ glyph: 'external', w: 12, h: 12, color: 'muted', tip: 'Open on the Anvil website', on: { a: 'site', path: profilePath(c.rsn) } }) : undefined,
    ),
  ];
  // "Iron Forge · Ironman": the clan opens in clan lookup.
  const who = [c.accountType ? accountTypeLabel(c.accountType) : null, anvil ? null : 'from the hiscores'].filter(Boolean).join(' · ');
  if (c.clan?.name) {
    const clanMediaRev = mediaRevision(c.clan.logoUrl);
    details.push(row(
      images && c.clan.logoUrl
        ? { t: 'img', src: revisedMediaPath(`/api/plugin/media/clan/${seg(c.clan.slug)}?kind=logo`, clanMediaRev), w: 16, h: 16, motion: true, round: true }
        : undefined,
      row(text(c.clan.name, 'brand', { font: 'small', tip: `Open ${c.clan.name} in clan lookup`, on: { a: 'clan', slug: c.clan.slug } }), who ? muted(`· ${who}`, { font: 'small' }) : undefined, undefined, { gap: 4 }),
      undefined,
      { gap: 4 },
    ));
  } else if (who) details.push(muted(who, { font: 'small' }));
  if (!anvil && c.fetchedAt) details.push(muted('', { at: c.fetchedAt, font: 'small' }));
  const totals = [c.totalLevel > 0 ? `${fmt(c.totalLevel)} total` : null, c.combatLevel != null ? `cb ${c.combatLevel}` : null].filter(Boolean);
  const avatar = anvil && images && c.panelMedia?.avatar
    ? { t: 'img' as const, src: revisedMediaPath(`/api/plugin/media/player/${seg(c.rsn)}?kind=avatar`, c.panelMedia.revision), w: 40, h: 40, round: true, ...(c.panelMedia.avatarAnimated ? { motion: true } : {}) }
    : undefined;
  const parts: Node[] = [row(avatar, col(details, { gap: 2 }), undefined, { gap: 7 })];
  if (totals.length) parts.push(text(totals.join(' · '), 'white'));
  if (own && anvil && c.clog && c.clog.total > 0) {
    const pct = percent(c.clog.obtained, c.clog.total);
    parts.push(row(undefined, muted('Collection log', { font: 'small' }), muted(`${fmt(c.clog.obtained)} / ${fmt(c.clog.total)} · ${pct}%`, { font: 'small' })), { t: 'bar', pct, color: 'done', h: 6, bg: 'panel' });
  }
  const empty =
    c.totalLevel <= 0 && (!c.clog || c.clog.total <= 0) && !c.latest.length && !c.skills.length && !c.bosses.length && !c.topBosses.length;
  if (empty) parts.push(muted('No stats tracked yet.'));
  return section(parts);
}

/**
 * This character's pins, two to a row: the number on top (gold: a KC, a time) or the item's name in
 * purple (a drop, a log slot), what it is small and muted under it. Hidden when there are none.
 */
function displayCase(c: PlayerCard, slots?: number): Node {
  const pins = c.displayCase ?? [];
  const picture = (p: NonNullable<PlayerCard['displayCase']>[number]): Node => {
    if ((p.kind === 'drop' || p.kind === 'clog') && p.itemId > 0) return icon({ item: p.itemId, w: 22, h: 20 });
    const key = p.kind === 'pb' ? (p.statKey?.replace(/^\d+:/, '') ?? '') : (p.statKey ?? '');
    return icon({ boss: key, w: 20, h: 20, or: icon({ glyph: 'star', color: 'brand', w: 12, h: 12 }) });
  };
  return section([
    row(undefined, title('Display case'), slots ? muted(`${Math.min(pins.length, slots)} of ${slots} slots`, { font: 'small' }) : undefined),
    {
      t: 'grid',
      cols: 2,
      gap: 4,
      vgap: 4,
      c: pins.map((p) => row(
        picture(p),
        p.headline
          ? col([small(p.headline, GOLD, { tip: p.name }), muted(p.name, { font: 'small' })])
          : small(p.name, PURPLE, { wrap: true }),
        undefined,
        { bg: 'panel', pad: 4, gap: 4, tip: [p.name, p.source].filter(Boolean).join(' · ') },
      )),
    },
  ]);
}

/**
 * The Collection log tab: the total and its share, the latest slot, then a bar per category — each
 * opens its pages, and a page opens its items.
 */
function logTab(c: PlayerCard, kills: Map<string, number>): Node {
  const clog = c.clog!;
  const pct = percent(clog.obtained, clog.total);
  const slot = c.latest.find((l) => l.kind === 'item');
  const head = section([
    row(undefined, big(`${fmt(clog.obtained)} / ${fmt(clog.total)}`), small(`${pct}%`, GREEN, { font: 'bold' })),
    { t: 'bar', pct, color: 'done', h: 6, bg: 'panel' },
    ...(slot ? [row(undefined, small(`Latest: ${slot.label}`, PURPLE), muted('', { at: slot.at, font: 'small' }))] : []),
  ]);
  if (c.clogPages.length) return col([head, logSlot(c, kills)], { gap: 8 });
  return col([head, ...clog.groups.map((g) => categoryRow(g.name, g.obtained, g.total))], { gap: 5 });
}

/** "Bosses ....... 412/664 · 62%" over a green bar, in a raised row (that opens, when `on`). */
function categoryRow(name: string, got: number, of: number, on?: Action): Node {
  const pct = percent(got, of);
  return col([
    row(undefined, text(name, got >= of ? 'done' : 'white'), row(muted(`${fmt(got)}/${fmt(of)} · ${pct}%`, { font: 'small' }), undefined, on ? icon({ glyph: 'chevron-right', w: 9, h: 9, color: 'muted' }) : undefined, { gap: 5 })),
    { t: 'bar', pct, color: 'done', h: 5, bg: 'panel' },
  ], { bg: 'raised', inset: 8, gap: 4, ...(on ? { on, tip: `${name}: its pages` } : {}) });
}

/**
 * The log as three levels, each obviously clickable: categories as tiles → that category's pages →
 * a page's items (fetched). The first two are panes already in hand; the third replaces the slot.
 */
function logSlot(c: PlayerCard, kills: Map<string, number>): Node {
  const byGroup = new Map<string, PlayerCardPage[]>();
  for (const p of c.clogPages) {
    const g = p.group ?? 'Other';
    byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
  }
  const panes: Record<string, Node> = {};
  const tiles: Node[] = [];
  for (const [group, pages] of byGroup) {
    const got = pages.reduce((s, p) => s + p.obtained, 0);
    const of = pages.reduce((s, p) => s + p.total, 0);
    const pane = `cat:${group}`;
    tiles.push(categoryRow(group, got, of, { a: 'pane', into: 'log', pane }));
    panes[pane] = col([
      backHeader(group, `${got}/${of}`, got >= of, { a: 'pane', into: 'log', pane: 'root' }),
      gap(6),
      ...pages.flatMap((p) => [pageRow(c.rsn, p, kills.get(p.name.toLowerCase()), pane), gap(2)]),
    ]);
  }
  const root: Node = col(tiles, { gap: 5 });
  panes.root = root;
  return { t: 'slot', id: 'log', c: root, panes };
}

function pageRow(rsn: string, p: PlayerCardPage, kc: number | undefined, back: string): Node {
  const complete = p.total > 0 && p.obtained >= p.total;
  const name = text(p.name, complete ? 'done' : 'white');
  return row(
    icon({ item: p.iconItemId ?? undefined, w: 26, h: 24 }),
    kc != null ? col([name, muted(`${fmt(kc)} kc`)]) : name,
    row(undefined, muted(`${p.obtained}/${p.total}`), icon({ glyph: 'chevron-right', w: 9, h: 9, color: 'muted' })),
    { pad: 3, tip: 'See the items on this page', on: openPage(rsn, p.name, back, kc) },
  );
}

/** "‹ Name" over "12/30  ↗": back on the left, the count, and — for a page — the page on the site. */
export function backHeader(name: string, countText: string, complete: boolean, back: Action, sitePath?: string): Node {
  return col([
    text(name, complete ? 'done' : 'white', {
      font: 'bold',
      icon: icon({ glyph: 'chevron-left', w: 10, h: 10, color: 'white' }),
      tip: 'Back',
      on: back,
    }),
    row(
      undefined,
      muted(countText),
      sitePath ? icon({ glyph: 'external', w: 11, h: 11, color: 'muted', tip: 'Open this page on the Anvil website', on: { a: 'site', path: sitePath } }) : undefined,
      { pad: 1, inset: 16 },
    ),
  ]);
}

function latest(c: PlayerCard): Node {
  return section([
    row(undefined, title('Latest'), small('See all ›', GOLD, {
      tip: 'Everything they’ve done lately, on the Anvil website',
      on: { a: 'site', path: `${profilePath(c.rsn)}?tab=records` },
    })),
    gap(4),
    ...c.latest.map((l) =>
      row(
        l.kind === 'item' && l.itemId != null
          ? icon({ item: l.itemId, w: 24, h: 22 })
          : icon({ boss: milestoneSubject(l.label), w: 24, h: 22, or: icon({ glyph: 'check', w: 12, h: 12, color: 'brand' }) }),
        text(l.label),
        muted('', { at: l.at }),
      ),
    ),
  ]);
}

/** A count with the game's own picture; the name stands in when the plugin has no picture for it. */
function countCell(pic: Node, name: string, n: number, tip: string, on?: Action): Node {
  return { t: 'text', s: count(n), color: 'white', cell: true, icon: { ...(pic as Extract<Node, { t: 'icon' }>), alt: name }, tip, ...(on ? { on } : {}), k: name };
}

/** The game's skill tab: icon + level, three across, XP on hover; total level and a virtual toggle below. */
function skills(c: PlayerCard): Node {
  const byKey = new Map(c.skills.map((s) => [s.key.toLowerCase(), s]));
  const face = (virtual: boolean): Node => {
    let sum = 0;
    const cells = SKILL_GRID.map((key) => {
      const s = byKey.get(key);
      const level = !s ? 1 : virtual && s.level >= 99 ? virtualLevel(s.xp) : s.level;
      sum += level;
      return {
        t: 'text',
        s: String(level),
        color: level >= 99 ? GREEN : 'white',
        cell: true,
        icon: { t: 'icon', skill: key, alt: cap(key).slice(0, 3) },
        tip: s ? `${cap(key)} — ${fmt(s.xp)} XP` : cap(key),
      } as Node;
    });
    const total = virtual || c.totalLevel <= 0 ? sum : c.totalLevel;
    const xp = c.overallXp && c.overallXp > 0 ? c.overallXp : c.skills.reduce((s, k) => s + k.xp, 0);
    return col([
      { t: 'grid', cols: 3, gap: 2, vgap: 2, c: cells },
      gap(2),
      row(
        text(`Total level  ${fmt(total)}`, 'white', { tip: `Total XP — ${fmt(xp)}` }),
        undefined,
        text(`${virtual ? '✓ ' : ''}Virtual levels`, virtual ? 'brand' : 'muted', { tip: 'Show levels past 99 from XP', on: { a: 'flip', key: 'virtual' } }),
        { bg: 'panel', pad: 4 },
      ),
    ]);
  };
  return card([{ t: 'toggle', key: 'virtual', off: face(false), lit: face(true) }]);
}

/** A section's list in its card, with a search box above once it's long enough to need one. */
function searchable(what: string, n: number, list: Extract<Node, { t: 'grid' | 'col' }>): Node {
  return card([{ t: 'filter', hint: `Search ${n} ${what}…`, box: n >= SEARCH_FROM, none: 'Nothing matches.', c: [list] }]);
}

/** Personal bests: one row per boss and mode; a row with several team sizes opens to list them. */
function times(c: PlayerCard): Node {
  const rows: Node[] = c.times.map((e) => {
    const head = row(icon({ boss: e.icon, w: 24, h: 22 }), text(e.name), text(e.best, 'brand'), { pad: 3 });
    if (!e.variants.length) return { ...head, k: e.name };
    return {
      t: 'fold',
      k: e.name,
      head,
      c: col(
        e.variants.map((v) =>
          row(muted(/^solo$/i.test(v.team) ? 'Solo' : `${v.team} players`), undefined, text(v.time, 'brand'), { tip: v.activity }),
        ),
        { inset: 32 },
      ),
    } as Node;
  });
  return searchable('times', c.times.length, col(rows) as Extract<Node, { t: 'col' }>);
}
