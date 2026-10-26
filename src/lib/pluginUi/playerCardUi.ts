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
  header,
  icon,
  muted,
  percent,
  row,
  seg,
  text,
} from './nodes';

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

/** A picture per log category — the thing people think of when they think of that shelf. */
const CATEGORY_ITEMS: Record<string, number> = {
  Bosses: 11832, // Bandos chestplate
  Raids: 20997, // Twisted bow
  Clues: 19835, // Clue scroll (master)
  Minigames: 6570, // Fire cape
  Skilling: 13320, // Heron
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
}

export function playerCardUi(c: PlayerCard, opts: CardOptions): Node {
  const anvil = c.source !== 'hiscores';
  const parts: Node[] = [identity(c, anvil)];
  const kills = pageKills(c);
  if (anvil && c.clog && c.clog.total > 0) parts.push(gap(6), clogSummary(c, kills));
  if (anvil && c.latest.length) parts.push(gap(6), latest(c));

  const sections: { label: string; c: Node }[] = [];
  const pages = new Set(anvil ? c.clogPages.map((p) => p.name.toLowerCase()) : []);
  const opens = (page: string | null | undefined, kc?: number): Action | undefined =>
    page && pages.has(page.toLowerCase()) ? openPage(c.rsn, page, 'root', kc) : undefined;

  if (c.skills.length) sections.push({ label: 'Skills', c: skills(c) });
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
  if (c.activities.length) {
    const cells = c.activities.map((a) => {
      const name = a.shortLabel || a.label;
      const pic = CLUE_ITEMS[a.key] ? icon({ item: CLUE_ITEMS[a.key] }) : icon({ boss: a.key });
      return countCell(pic, name, a.score, `${a.label} — ${fmt(a.score)}`, opens(cluePage(a.key)));
    });
    sections.push({ label: 'Clues', c: card([{ t: 'grid', cols: 3, gap: 2, vgap: 2, c: cells }]) });
  }
  if (anvil && c.times.length) sections.push({ label: 'Times', c: times(c) });
  if (anvil && opts.cas) {
    sections.push({
      label: 'CAs',
      c: card([
        { t: 'slot', id: 'cas', c: muted('Loading combat achievements…'), load: { a: 'load', v: 'cas', args: { rsn: c.rsn }, into: 'cas' } },
      ]),
    });
  }
  if (sections.length) parts.push(gap(6), { t: 'tabs', key: opts.sectionKey, tabs: sections });

  // The comparison (and its page on the site) is between Anvil profiles.
  if (anvil && opts.me && opts.me.trim().toLowerCase() !== c.rsn.trim().toLowerCase()) {
    parts.push(gap(6), button('Compare with me', { a: 'load', v: 'compare', args: { rsn: c.rsn } }, 'Side by side: levels, bosses and the log'));
  }
  return col(parts);
}

/** "Not on Anvil" — the same words whether the name is unknown or simply not shared. */
export function notFoundUi(rsn: string): Node {
  return card([text(rsn, 'white', { font: 'bold' }), gap(4), muted('Not on Anvil yet — or they haven’t shared their profile.', { wrap: true })]);
}

function identity(c: PlayerCard, anvil: boolean): Node {
  const parts: Node[] = [
    row(
      undefined,
      text(c.rsn, 'white', { font: 'bold' }),
      anvil ? icon({ glyph: 'external', w: 12, h: 12, color: 'muted', tip: 'Open on the Anvil website', on: { a: 'site', path: profilePath(c.rsn) } }) : undefined,
    ),
  ];
  if (!anvil) parts.push(gap(2), row(undefined, muted('From the hiscores — not on Anvil'), c.fetchedAt ? muted('', { at: c.fetchedAt }) : undefined));
  if (c.clan?.name) parts.push(gap(2), text(c.clan.name, 'brand'));
  const line = [
    c.totalLevel > 0 ? `${fmt(c.totalLevel)} total` : null,
    c.combatLevel != null ? `cb ${c.combatLevel}` : null,
    c.accountType ? accountTypeLabel(c.accountType) : null,
  ].filter(Boolean);
  if (line.length) parts.push(gap(2), muted(line.join(' · ')));
  const empty =
    c.totalLevel <= 0 && (!c.clog || c.clog.total <= 0) && !c.latest.length && !c.skills.length && !c.bosses.length && !c.topBosses.length;
  if (empty) parts.push(gap(6), muted('No stats tracked yet.'));
  return card(parts);
}

function clogSummary(c: PlayerCard, kills: Map<string, number>): Node {
  const clog = c.clog!;
  const parts: Node[] = [
    header('Collection log', `${fmt(clog.obtained)} / ${fmt(clog.total)}`),
    gap(4),
    { t: 'bar', pct: percent(clog.obtained, clog.total), color: 'brand', h: 14, label: `${percent(clog.obtained, clog.total)}%`, bg: 'panel' },
  ];
  if (c.clogPages.length) {
    parts.push(gap(6), logSlot(c, kills));
  } else if (clog.groups.length) {
    parts.push(gap(6), {
      t: 'grid',
      cols: 2,
      gap: 8,
      vgap: 4,
      c: clog.groups.map((g) => miniBar(g.name, g.obtained, g.total)),
    });
  }
  return card(parts);
}

/** "Bosses  62%" over a 3px bar — a share of the log at a glance. */
function miniBar(name: string, obtained: number, total: number): Node {
  const pct = percent(obtained, total);
  return col([row(muted(name), undefined, text(`${pct}%`), { gap: 0 }), gap(2), { t: 'bar', pct, h: 3, bg: 'panel' }], {
    tip: `${name}: ${fmt(obtained)} / ${fmt(total)}`,
  });
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
    tiles.push(
      col(
        [
          row(icon({ item: CATEGORY_ITEMS[group] ?? 995, w: 28, h: 26 }), col([text(`${group}  ›`), muted(`${got}/${of} · ${percent(got, of)}%`)]), undefined),
          gap(3),
          { t: 'bar', pct: percent(got, of), h: 3, bg: 'card' },
        ],
        { inset: 6, bg: 'panel', on: { a: 'pane', into: 'log', pane } },
      ),
    );
    panes[pane] = col([
      backHeader(group, `${got}/${of}`, got >= of, { a: 'pane', into: 'log', pane: 'root' }),
      gap(6),
      ...pages.flatMap((p) => [pageRow(c.rsn, p, kills.get(p.name.toLowerCase()), pane), gap(2)]),
    ]);
  }
  const root: Node = { t: 'grid', cols: 2, gap: 6, vgap: 6, c: tiles };
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
  return card([
    row(text('Latest', 'brand'), undefined, muted('See all ›', {
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
        color: level >= 99 ? 'brand' : 'white',
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
    const head = row(icon({ boss: e.base, w: 24, h: 22 }), text(e.name), text(e.best, 'brand'), { pad: 3 });
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
