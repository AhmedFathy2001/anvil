import type { ClanCard } from '@/lib/clanCard';
import { clanBoostInk } from '@/lib/clanBoostRules';
import { inkForSurface } from '@/lib/supporterStyle';

import { FEED_STEP, dropLine } from './momentsUi';
import { type Color, type Node, backRow, badge, hero, nameTint, button, card, col, count, fmt, gap, icon, message, muted, nameText, row, seg, text } from './nodes';
import { namesRow, vsRow } from './playerMoreUi';
import { mediaRevision, revisedMediaPath } from './mediaRevision';
import { BAR_BLUE, BLUE, FLAME, chip, clock, section, small, streakBar, streakChip, title } from './sections';
import { clanBasePath } from '@/lib/clanScopedPaths';

// A clan as the plugin's panel draws it (was ClanCardView.java): who the clan is, how hard it played
// this week and who carried it, its strongest accounts, what dropped lately and what's running. Under
// Events in the Clan tab (your clan) and in Lookup (any listed clan). Pure.

/** "Name [streak] ......... value" — the name opens that player's card. */
function nameLine(name: Node, value: string, rsn: string, streak = 0): Node {
  const left = streak >= 2 ? row(name, undefined, streakChip(streak), { gap: 4 }) : name;
  return row(undefined, left, muted(value), { pad: 2, inset: 2, tip: `Look up ${rsn}`, on: { a: 'lookup', rsn } });
}

/** A stat tile: the number big, what it counts under it. */
const tile = (n: string, label: string, color: Color = 'white', tip?: string): Node =>
  col([text(n, color, { font: 'bold', align: 'c' }), small(label, 'muted', { align: 'c' })], { bg: 'raised', rad: 5, inset: 3, gap: 0, ...(tip ? { tip } : {}) });

/** The clan's heat card: the % big, the last weeks brightening into this one, the change. */
function heatCard(h: NonNullable<ClanCard['heat']>): Node {
  const weeks = h.weeks?.length ? h.weeks : [h.pct];
  // Hotter weeks are brighter: the strip reads as the trend (segments are all one height).
  const top = Math.max(1, ...weeks);
  const shade = (p: number): `#${string}` => {
    const t = Math.max(0.15, p / top);
    const ch = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
    return `#${ch(0x3a, 0xff)}${ch(0x2a, 0x8a)}${ch(0x22, 0x3d)}`;
  };
  const change = h.change ?? 0;
  return section([
    row(title('Clan heat'), undefined, text(`${h.pct}%`, FLAME, { font: 'bold' }), { tip: 'Members with 3+ active days a week, week after week' }),
    weeks.length > 1 ? { t: 'segs', c: weeks.map(shade), h: 8, tip: `The last ${weeks.length} weeks` } : null,
    row(muted(`${fmt(h.on)} of ${fmt(h.total)} keep 3+ days a week going`, { font: 'small', wrap: true }), undefined, undefined),
    change ? small(change > 0 ? `up ${fmt(change)} from last week` : `down ${fmt(-change)} from last week`, change > 0 ? FLAME : 'muted') : null,
  ], { gap: 5 });
}

/** The clan's longest streaks, a bar each against the longest. */
function hottestCard(list: NonNullable<ClanCard['hottest']>): Node {
  const top = Math.max(1, ...list.map((x) => x.weeks));
  return section([
    title('Hottest streaks'),
    ...list.flatMap((x) => [
      row(undefined, text(x.rsn, 'white', { who: x.rsn, font: 'small' }), streakChip(x.weeks), { pad: 1, tip: `Look up ${x.rsn}`, on: { a: 'lookup', rsn: x.rsn } }),
      { t: 'bar', pct: Math.max(4, Math.round((x.weeks * 100) / top)), color: streakBar(x.weeks), h: 3, bg: 'panel' } as Node,
    ]),
  ], { gap: 4 });
}

const MEDAL: `#${string}`[] = ['#ffb347', '#d98c5f', '#a8714a'];

/** The game's picture for a competition: the boss, else the skill. */
function compIcon(c: ClanCard['competitions'][number]): Node | undefined {
  if (c.type === 'boss') return icon({ boss: c.metric, w: 18, h: 18, alt: 'B' });
  if (c.type === 'skill') return icon({ skill: c.metric, w: 16, h: 16, alt: 'S' });
  return undefined;
}

/** A competition's end as the panel's countdown wants it (an ISO instant), or null. */
function isoEnd(at?: string): string | null {
  if (!at) return null;
  const s = at.replace(' ', 'T');
  const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : /T/.test(s) ? `${s}Z` : `${s}T23:59:59Z`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function siteHeader(label: string, note: string, path: string): Node {
  return row(undefined, title(label), muted(note, { font: 'small' }), {
    gap: 0,
    pad: 2,
    tip: 'Open this ranking on the clan website',
    on: { a: 'site', path },
  });
}

/** @param compare offer "Compare with my clan" (another clan, and the viewer has one) */
/**
 * `feedTab`: the plugin has the Feed tab (it sends X-Anvil-Feed-Tab), so the full drop log lives
 * there and this card keeps only a short taste of it.
 * `tabLinks`: the plugin can open its Feed tab from a row, so the pointer is a link, not a hint.
 */
export function clanCardUi(c: ClanCard, compare: boolean, feedTab = false, tabLinks = false, images = false, glyphs = false): Node {
  if (c.kind === 'creator') return spaceCardUi(c);
  const parts: Node[] = [];
  const sourceBoost = clanBoostInk(c.boostLevel ?? 0, c.boostNameStyle);
  const boost = sourceBoost ? inkForSurface(sourceBoost, 'dark') : null;
  const mediaRev = mediaRevision(c.logoUrl, c.bannerUrl);
  const rev = (kind: 'banner' | 'logo') => revisedMediaPath(`/api/plugin/media/clan/${seg(c.slug)}?kind=${kind}`, mediaRev, c.boostLevel ?? 0);
  const nm = text(c.name, boost?.color ?? 'white', {
    font: 'bold',
    ...(boost?.grad ? { grad: boost.grad } : {}),
    ...(boost?.move ? { move: true } : {}),
  });
  const link = icon({ glyph: 'external', w: 12, h: 12, color: 'muted', tip: 'Open the clan on the Anvil website', on: { a: 'site', path: clanBasePath({ slug: seg(c.slug), kind: c.kind }) } });
  // Three numbers as tiles: who's in it, who played this week, who's keeping a streak.
  const id: Node[] = [
    {
      t: 'grid',
      cols: 3,
      gap: 4,
      c: [
        tile(fmt(c.members), 'members'),
        tile(fmt(c.activeThisWeek), 'active', BLUE, 'Gained anything in the last 7 days'),
        tile(fmt(c.heat?.on ?? 0), 'on streak', FLAME, '3+ active days a week, week after week'),
      ],
    },
  ];
  if (c.clog) id.push(muted(`Avg log ${fmt(c.clog.average)} slots · ${fmt(c.clog.synced)} synced`, { font: 'small' }));
  // Clan tenure: how long it has backed Anvil, in the Supporter star's shapes (older plugins: the star).
  if (c.tenure && c.tenure.months >= 1) {
    id.push(row(icon(glyphs ? { glyph: c.tenure.glyph, w: 22, h: 22, color: '#ffd35c' } : { glyph: 'star', w: 10, h: 10, color: '#ffd35c' }), small(c.tenure.line, '#ffd35c'), undefined, { gap: 4 }));
  }
  // What's running: the boss's (or skill's) own picture, its name, and how long is left.
  for (const x of c.competitions.slice(0, 2)) {
    const kind = x.type === 'boss' ? 'BOTW' : x.type === 'skill' ? 'SOTW' : '';
    const end = isoEnd(x.endsAt);
    id.push(row(compIcon(x), row(kind ? small(kind, 'white') : undefined, small(x.label, BLUE), undefined, { gap: 4 }), end ? clock(end, 'ends in ', 'ending', Date.now(), { color: 'muted' }) : undefined, { gap: 5 }));
  }
  parts.push(hero(
    images && c.bannerUrl ? { src: rev('banner'), motion: !!boost?.move } : null,
    c.accent ?? nameTint(c.name),
    badge(images && c.logoUrl ? { t: 'img', src: rev('logo'), w: 32, h: 32, rad: 8, motion: true } : undefined, c.name),
    [nm, link],
    id,
  ));
  // "Compare with my clan" is the one action, right under who the clan is.
  if (compare) parts.push(button('Compare with my clan', { a: 'load', v: 'clan-compare', args: { slug: c.slug } }));

  if (c.heat && c.heat.on > 0) parts.push(heatCard(c.heat));
  if (c.hottest?.length) parts.push(hottestCard(c.hottest));

  if (c.topWeek.length) {
    const most = Math.max(0.1, ...c.topWeek.map((g) => g.hours));
    parts.push(
      section([
        siteHeader('This week', `+${fmt(Math.round(c.weekHours))}h gained`, `/members?sort=week`),
        // A medal for the place, a bar for the hours against the week's best.
        ...c.topWeek.flatMap((g, i) => [
          nameLine(row(text(`${i + 1}`, '#1b1b1b', { chip: MEDAL[i] ?? '#7a7a7a', w: 15, align: 'c', font: 'small' }), text(g.rsn, 'white', { who: g.rsn }), undefined, { gap: 5 }), `+${g.hours.toFixed(1)}h`, g.rsn, c.streaks?.[g.rsn]),
          { t: 'bar', pct: Math.max(4, Math.round((g.hours * 100) / most)), color: BAR_BLUE, h: 3, bg: 'panel' } as Node,
        ]),
      ], { gap: 4 }),
    );
  }
  if (c.topPlayers.length) {
    parts.push(section([
      siteHeader('Top accounts', 'by total XP', `/members?sort=xp`),
      ...c.topPlayers.map((p) => nameLine(text(p.rsn, 'white', { who: p.rsn }), `${count(p.overallXp)} xp`, p.rsn, c.streaks?.[p.rsn])),
      // The clan's feed is one click from its card.
      ...(feedTab && tabLinks ? [gap(4), row(text('Open the clan feed \u203a', 'brand', { font: 'small' }), undefined, undefined, { pad: 2, tip: 'Open the Feed tab', on: { a: 'tab', tab: 'feed' } })] : []),
    ], { gap: 4 }));
  }
  if (c.highlights.length) {
    // The cached list shows at once; the live feed (counts, GZ buttons, more lines) replaces it.
    const quick = col(
      c.highlights.flatMap((h) => [
        dropLine(h.itemId, h.kind === 'pet' ? `${h.label} · pet` : h.label, h.at, nameText(h.rsn, 'muted', { font: 'small' })),
        gap(6),
      ]),
    );
    parts.push(
      section([
        title('Recent drops'),
        feedTab
          ? col([
              quick,
              tabLinks
                ? row(text('See them all live in Feed \u203a', 'brand', { font: 'small' }), undefined, undefined, { pad: 2, tip: 'Open the Feed tab', on: { a: 'tab', tab: 'feed' } })
                : muted('The full list, live, is in the Feed tab.', { font: 'small', wrap: true }),
            ])
          : { t: 'slot', id: 'moments', c: quick, load: { a: 'load', v: 'moments', args: { slug: c.slug, n: String(FEED_STEP) }, into: 'moments' } },
      ]),
    );
  }
  return col(parts, { gap: 8 });
}

/**
 * A creator space (lib/creatorSpaces) where a clan's card would go: its name and a way to its page.
 * No member count, week, top accounts or "Compare with my clan" — a space has no members.
 */
export function spaceCardUi(c: Pick<ClanCard, 'slug' | 'name'> & { kind?: string | null }): Node {
  return col([
    card([
      row(undefined, text(c.name, 'white', { font: 'bold' }), icon({
        glyph: 'external',
        w: 12,
        h: 12,
        color: 'muted',
        tip: 'Open this space on the Anvil website',
        on: { a: 'site', path: clanBasePath({ slug: seg(c.slug), kind: c.kind ?? 'creator' }) },
      })),
      gap(2),
      muted(`Events by ${c.name} on Anvil`, { wrap: true }),
    ]),
  ]);
}

/** Two clans side by side: one line per measure, the leader's number in orange. */
export function clanCompareUi(a: ClanCard, b: ClanCard): Node {
  const hours = (n: number) => `${fmt(n)}h`;
  return col([
    backRow(`Back to ${b.name}`, { a: 'load', v: 'clan', args: { slug: b.slug } }),
    card([
      namesRow(a.name, b.name),
      gap(4),
      vsRow('Members', a.members, b.members, String),
      vsRow('Active this week', a.activeThisWeek, b.activeThisWeek, String),
      vsRow('Total hours played', Math.round(a.totalEhp), Math.round(b.totalEhp), hours),
      vsRow('Total hours bossed', Math.round(a.totalEhb), Math.round(b.totalEhb), hours),
      vsRow('Avg log slots', a.clog?.average ?? -1, b.clog?.average ?? -1),
      vsRow('Gained this week', Math.round(a.weekHours), Math.round(b.weekHours), hours),
    ]),
    gap(6),
    button(
      'Full comparison on the site ↗',
      { a: 'site', path: `/compare/clans?a=${seg(a.slug)}&b=${seg(b.slug)}` },
      'Top players, gainers and highlights side by side',
    ),
  ]);
}

/** A space that shares its slug with a clan says so (`s/<slug>`; visibleClan reads it); everything else stays bare. */
function searchArgSlug(f: { slug: string; kind?: string | null }): string {
  return f.kind === 'creator' ? `s/${f.slug}` : f.slug;
}

/** Lookup's clan search: a row per listed clan that matches, each opening its card. */
export function clanSearchUi(q: string, found: { slug: string; kind?: string | null; name: string; boostLevel?: number; boostNameStyle?: import('@/lib/clanBoostRules').ClanBoostNameStyle | null }[]): Node {
  if (!found.length) return message(`No listed clan matches "${q}".`).ui;
  return col(
    found.flatMap((f) => {
      const source = clanBoostInk(f.boostLevel ?? 0, f.boostNameStyle);
      const boost = source ? inkForSurface(source, 'dark') : null;
      return [
        row(undefined, text(f.name, boost?.color ?? 'white', {
          ...(boost?.grad ? { grad: boost.grad } : {}),
          ...(boost?.move ? { move: true } : {}),
        }), row((f.boostLevel ?? 0) > 0 ? chip(`Boost ${f.boostLevel}`, 'purple') : undefined, undefined, icon({ glyph: 'chevron-right', w: 9, h: 9, color: 'muted' }), { gap: 6 }), { bg: 'raised', pad: 7, inset: 8, on: { a: 'load', v: 'clan', args: { slug: searchArgSlug(f) } } }),
        gap(4),
      ];
    }),
  );
}
