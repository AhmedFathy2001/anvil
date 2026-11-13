import { BOSSES } from '@/lib/constants';
import type { PlayerCard, PlayerCardPage } from '@/lib/playerCardShape';
import { clogPageItems } from '@/lib/clogDataset';
import { XP_TABLE } from '@/lib/xp';

import {
  type Action,
  type Node,
  badge,
  button,
  card,
  col,
  count,
  fmt,
  gap,
  hero,
  icon,
  nameTint,
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

/** Where a log page opens: a page of its own in the profile's nav slot, with Back to the pane `back`. */
export function openPage(rsn: string, page: string, back: string, kc?: number): Action {
  return {
    a: 'load',
    v: 'clog-page',
    args: { rsn, page, back, ...(kc ? { kc: String(kc) } : {}) },
    into: 'prof',
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
  /** Their Supporter name colour: the banner's gradient when they have no banner (else one from the name). */
  tint?: string | null;
  /** Cards under the profile that a log page replaces along with it (You: goals). */
  below?: Node[];
  /** Cards over the profile, inside the same page. */
  above?: Node[];
}

const FLAME = '#ff8a3d' as const;
const STREAK_MARK = { a: FLAME, r: '#7ae0ff', m: '#3a3a3a' } as const;

/** Weekly activity streak (lib/activityStreak): weeks, the last weeks as a strip, this week's days. */
function streakCard(s: NonNullable<PlayerCard['streak']>): Node {
  const weeks = s.weeks > 0 ? `${s.weeks} week${s.weeks === 1 ? '' : 's'}` : 'No streak';
  const marks = s.recent.split('').map((m) => STREAK_MARK[m as keyof typeof STREAK_MARK] ?? STREAK_MARK.m);
  const week = s.safe ? 'This week counts' : `This week ${s.thisWeek} of ${s.needed} days`;
  return section([
    row(title('Activity streak'), undefined, text(weeks, s.weeks > 0 ? FLAME : 'muted', { font: 'bold', tip: s.milestone ? `${s.milestone} milestone` : undefined })),
    marks.length ? { t: 'segs', c: marks, h: 6 } : null,
    small(`${week} · best ${s.best}${s.restBanked && !s.safe ? ' · rest week banked' : ''}`, 'muted', { wrap: true }),
  ]);
}

export function playerCardUi(c: PlayerCard, opts: CardOptions): Node {
  const anvil = c.source !== 'hiscores';
  const parts: Node[] = [];
  parts.push(identity(c, anvil, !!opts.images, !!opts.own, opts.tint));
  // "Compare with me" is the one action, right under who this is. Between Anvil profiles only.
  if (anvil && opts.me && opts.me.trim().toLowerCase() !== c.rsn.trim().toLowerCase()) {
    parts.push(button('Compare with me', { a: 'load', v: 'compare', args: { rsn: c.rsn } }, 'Side by side: levels, bosses and the log'));
  }
  parts.push(...(opts.afterTop ?? []));
  if (anvil && c.streak && (c.streak.weeks > 0 || c.streak.thisWeek > 0 || c.streak.best > 0)) parts.push(streakCard(c.streak));
  if (anvil && c.displayCase?.length) parts.push(displayCase(c, opts.slots));

  // Stats | Bosses | Log (the collection log; the full words don't fit a third of 220px), the rest (Clues, Times, CAs) folded under them.
  const kills = pageKills(c);
  const sections: { label: string; c: Node }[] = [];
  const pages = new Set(anvil ? c.clogPages.map((p) => p.name.toLowerCase()) : []);
  const opens = (page: string | null | undefined, kc?: number): Action | undefined =>
    page && pages.has(page.toLowerCase()) ? openPage(c.rsn, page, 'main', kc) : undefined;

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
  else if (anvil) sections.push({ label: 'Log', c: card([muted('No collection log synced yet. Sync profile (the gear button) sends it.', { wrap: true })]) });

  const more: { label: string; summary?: string; c: Node }[] = [];
  const isClue = (key: string) => key.startsWith('clues');
  const activityCell = (a: PlayerCard['activities'][number]) => {
    const name = a.shortLabel || a.label;
    const pic = CLUE_ITEMS[a.key] ? icon({ item: CLUE_ITEMS[a.key] }) : icon({ boss: HISCORE_NAMES[a.key] ?? a.key });
    return countCell(pic, name, a.score, `${a.label} — ${fmt(a.score)}`, opens(cluePage(a.key)));
  };
  const clues = c.activities.filter((a) => isClue(a.key));
  const minigames = c.activities.filter((a) => !isClue(a.key));
  // One section: the clue tiers first, then the other activities, in one grid.
  if (clues.length || minigames.length) {
    const all = clues.find((a) => a.key === 'cluesAll')?.score ?? clues.reduce((t, a) => t + a.score, 0);
    more.push({
      label: 'Minigames & activities',
      summary: clues.length ? `Clues ${fmt(all)}` : String(minigames.length),
      // One grid: clue tiers lead, the other activities follow straight on.
      c: card([{ t: 'grid' as const, cols: 3, gap: 2, vgap: 2, c: [...clues, ...minigames].map(activityCell) }]),
    });
  }
  if (anvil && c.times.length) more.push({ label: 'Times', summary: `${c.times.length} PB${c.times.length === 1 ? '' : 's'}`, c: times(c) });
  if (anvil && opts.cas) {
    more.push({
      label: 'Combat tasks',
      c: card([
        { t: 'slot', id: 'cas', c: muted('Loading combat achievements…'), load: { a: 'load', v: 'cas', args: { rsn: c.rsn }, into: 'cas' } },
      ]),
    });
  }
  if (sections.length) parts.push({ t: 'tabs', key: opts.sectionKey, tabs: sections });
  // An accordion: a raised header per section (chevron, name, a short summary), its body opening in
  // place. A toggle builds only the open face, so the combat tasks fetch only once opened.
  for (const m of more) {
    const key = `acc:${opts.sectionKey}:${m.label}`;
    const head = (open: boolean): Node =>
      row(
        text(open ? '▾' : '›', 'muted', { w: 10 }),
        text(m.label, 'white'),
        m.summary ? muted(m.summary, { font: 'small' }) : undefined,
        { bg: 'raised', pad: 5, inset: 6, gap: 6, on: { a: 'flip', key } },
      );
    parts.push({ t: 'toggle', key, off: head(false), lit: col([head(true), gap(2), m.c]) });
  }
  if (anvil && c.latest.length) parts.push(latest(c));
  // Someone else's Anvil card: a quiet way to buy them Supporter on the site, last, never a pitch.
  if (anvil && opts.me && opts.me.trim().toLowerCase() !== c.rsn.trim().toLowerCase()) {
    parts.push(row(undefined, undefined, text('Gift them Supporter \u203a', 'muted', { font: 'small' }), { pad: 2, tip: `Buy ${c.rsn} Supporter time on anvilosrs.com`, on: { a: 'site', path: `/supporter/gift?to=${seg(c.rsn)}` } }));
  }
  const main = col([...(opts.above ?? []), ...parts, ...(opts.below ?? [])], { gap: 8 });
  // The log's categories and pages are pages of their own over the whole view (one ‹ Back at the top).
  return anvil && c.clogPages.length ? { t: 'slot', id: 'prof', nav: true, open: 'main', panes: { main, ...logPanes(c, kills) }, c: gap(0) } : main;
}

/** "Not on Anvil" — the same words whether the name is unknown or simply not shared. */
export function notFoundUi(rsn: string): Node {
  return card([text(rsn, 'white', { font: 'bold' }), gap(4), muted('Not on Anvil yet — or they haven’t shared their profile.', { wrap: true })]);
}

function identity(c: PlayerCard, anvil: boolean, images: boolean, own: boolean, tint?: string | null): Node {
  // The mockup's header: one hero card (banner, badge overlapping it, name beside the badge).
  const media = anvil && images ? c.panelMedia : undefined;
  const pic = (kind: 'banner' | 'avatar') => revisedMediaPath(`/api/plugin/media/player/${seg(c.rsn)}?kind=${kind}`, media!.revision);
  const avatar = badge(media?.avatar ? { t: 'img', src: pic('avatar'), w: 32, h: 32, rad: 8, ...(media.avatarAnimated ? { motion: true } : {}) } : undefined, c.rsn);
  const name = anvil ? nameText(c.rsn, 'white', { font: 'bold' }) : text(c.rsn, 'white', { font: 'bold' });
  const who = [c.clan?.name ?? null, c.accountType ? accountTypeLabel(c.accountType) : null, anvil ? 'on Anvil' : 'from the hiscores'].filter(Boolean).join(' · ');
  const totals = [c.totalLevel > 0 ? `${fmt(c.totalLevel)} total` : null, c.combatLevel != null ? `cb ${c.combatLevel}` : null].filter(Boolean);
  const clanOn = c.clan?.name ? { tip: `Open ${c.clan.name} in clan lookup`, on: { a: 'clan' as const, slug: c.clan.slug } } : {};
  const inner: Node[] = [
    muted(who, { font: 'small', ...clanOn }),
  ];
  if (!anvil && c.fetchedAt) inner.push(muted('', { at: c.fetchedAt, font: 'small' }));
  if (totals.length) inner.push(text(totals.join(' · '), 'white'));
  if (own && anvil && c.clog && c.clog.total > 0) {
    const pct = percent(c.clog.obtained, c.clog.total);
    inner.push(row(undefined, muted('Collection log', { font: 'small' }), muted(`${fmt(c.clog.obtained)} / ${fmt(c.clog.total)} · ${pct}%`, { font: 'small' })), { t: 'bar', pct, color: 'done', h: 6, bg: 'panel' });
  }
  const empty =
    c.totalLevel <= 0 && (!c.clog || c.clog.total <= 0) && !c.latest.length && !c.skills.length && !c.bosses.length && !c.topBosses.length;
  if (empty) inner.push(muted('No stats tracked yet.'));
  return hero(media?.banner ? { src: pic('banner'), motion: !!media.bannerAnimated } : null, tint || nameTint(c.rsn), avatar, [name, anvil ? icon({ glyph: 'external', w: 12, h: 12, color: 'muted', tip: 'Open on the Anvil website', on: { a: 'site', path: profilePath(c.rsn) } }) : undefined], inner);
}

/**
 * This character's pins, two to a row: the number on top (gold: a KC, a time) or the item's name in
 * purple (a drop, a log slot), what it is small and muted under it. Hidden when there are none.
 */
/** A pin's text width in pt: ~225 panel, two columns with a 4 gap (~110 each), less 4 inset a side and the card edge. */
const PIN_WRAP = 96;

function displayCase(c: PlayerCard, slots?: number): Node {
  const pins = c.displayCase ?? [];
  /** What the pin says big: a headline, else the luck line, else the KC it came at, else a count owned, else the month it came; null when none is known. */
  const value = (p: NonNullable<PlayerCard['displayCase']>[number]): string | null => {
    if (p.headline) return p.headline;
    if (p.luck) return p.luck.text;
    if (p.kc) return `${fmt(p.kc)} KC`;
    if (p.qty && p.qty > 1) return `×${fmt(p.qty)} owned`;
    const d = p.when ? new Date(p.when) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;
  };
  const picture = (p: NonNullable<PlayerCard['displayCase']>[number]): Node => {
    // An item sprite is 36x32: the box is made for it so it's never cut.
    if ((p.kind === 'drop' || p.kind === 'clog') && p.itemId > 0) return icon({ item: p.itemId, w: 36, h: 32 });
    const key = p.kind === 'pb' ? (p.statKey?.replace(/^\d+:/, '') ?? '') : (p.statKey ?? '');
    return icon({ boss: key, w: 32, h: 32, or: icon({ glyph: 'star', color: 'brand', w: 14, h: 14 }) });
  };
  return section([
    row(undefined, title('Display case'), slots ? muted(`${Math.min(pins.length, slots)} of ${slots} slots`, { font: 'small' }) : undefined),
    {
      t: 'grid',
      cols: 2,
      gap: 4,
      vgap: 4,
      c: pins.map((p) => {
        const item = p.kind === 'drop' || p.kind === 'clog';
        return col(
          [
            picture(p),
            ...(value(p)
              ? [small(value(p)!, p.luck ? (p.luck.tone === 'green' ? GREEN : 'muted') : item ? PURPLE : GOLD, { font: 'bold', wrap: PIN_WRAP }), small(p.name, item ? PURPLE : 'muted', { wrap: PIN_WRAP, tip: p.name })]
              : // Nothing known: the name, in the normal small font, wrapped — never the big line.
                [small(p.name, item ? PURPLE : GOLD, { wrap: PIN_WRAP, tip: p.name })]),
          ],
          { bg: 'panel', inset: 4, gap: 2, tip: [p.name, p.source].filter(Boolean).join(' · ') },
        );
      }),
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
  if (c.clogPages.length) return col([head, logIndex(c)], { gap: 8 });
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

const groupsOf = (c: PlayerCard): Map<string, PlayerCardPage[]> => {
  const by = new Map<string, PlayerCardPage[]>();
  for (const p of c.clogPages) by.set(p.group ?? 'Other', [...(by.get(p.group ?? 'Other') ?? []), p]);
  return by;
};
const toMain: Action = { a: 'pane', into: 'prof', pane: 'main' };

/** The Log tab's list: a row per category, searchable — a name or an item ("sire", "tbow") lists the pages that hold it. */
function logIndex(c: PlayerCard): Node {
  const cats = [...groupsOf(c)].map(([group, pages]) =>
    categoryRow(group, pages.reduce((t, p) => t + p.obtained, 0), pages.reduce((t, p) => t + p.total, 0), { a: 'pane', into: 'prof', pane: `cat:${group}` }),
  );
  const found = c.clogPages.map((p) => ({
    ...pageRow(c.rsn, p, undefined, 'main'),
    k: `${p.name} ${clogPageItems(p.name).map((i) => i.name).join(' ')}`,
    q: true,
  }));
  return card([{ t: 'filter', hint: 'Search pages and items…', box: true, none: 'Nothing matches.', max: 12, more: 'Keep typing to narrow it.', c: [{ t: 'grid', cols: 1, vgap: 4, c: [...cats, ...found] }] }]);
}

/** One pane per category: its pages, each opening its items. */
function logPanes(c: PlayerCard, kills: Map<string, number>): Record<string, Node> {
  const panes: Record<string, Node> = {};
  for (const [group, pages] of groupsOf(c)) {
    const got = pages.reduce((t, p) => t + p.obtained, 0);
    const of = pages.reduce((t, p) => t + p.total, 0);
    panes[`cat:${group}`] = col([backHeader(group, `${got}/${of}`, got >= of, toMain), gap(6), ...pages.flatMap((p) => [pageRow(c.rsn, p, kills.get(p.name.toLowerCase()), `cat:${group}`), gap(2)])]);
  }
  return panes;
}

function pageRow(rsn: string, p: PlayerCardPage, kc: number | undefined, back: string): Node {
  const complete = p.total > 0 && p.obtained >= p.total;
  const name = text(p.name, complete ? 'done' : 'white');
  return row(
    icon({ item: p.iconItemId ?? undefined, w: 36, h: 32 }),
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
          ? icon({ item: l.itemId, w: 36, h: 32 })
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
