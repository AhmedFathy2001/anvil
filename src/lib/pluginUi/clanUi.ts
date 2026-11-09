import type { ClanCard } from '@/lib/clanCard';
import { clanBoostInk } from '@/lib/clanBoostRules';
import { inkForSurface } from '@/lib/supporterStyle';

import { FEED_STEP, dropLine } from './momentsUi';
import { type Node, backRow, badge, hero, nameTint, button, card, col, count, fmt, gap, icon, message, muted, nameText, row, seg, text } from './nodes';
import { namesRow, vsRow } from './playerMoreUi';
import { mediaRevision, revisedMediaPath } from './mediaRevision';
import { BLUE, chip, section, small, title } from './sections';

// A clan as the plugin's panel draws it (was ClanCardView.java): who the clan is, how hard it played
// this week and who carried it, its strongest accounts, what dropped lately and what's running. Under
// Events in the Clan tab (your clan) and in Lookup (any listed clan). Pure.

/** "Name ......... value" — the name opens that player's card. */
function nameLine(label: string, value: string, rsn: string): Node {
  return row(undefined, text(label, 'white', { who: rsn }), muted(value), { pad: 2, inset: 2, tip: `Look up ${rsn}`, on: { a: 'lookup', rsn } });
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
export function clanCardUi(c: ClanCard, compare: boolean, feedTab = false, tabLinks = false, images = false): Node {
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
  const link = icon({ glyph: 'external', w: 12, h: 12, color: 'muted', tip: 'Open the clan on the Anvil website', on: { a: 'site', path: `/c/${seg(c.slug)}` } });
  const id: Node[] = [
    row(muted(`${fmt(c.members)} members ·`), small(`${fmt(c.activeThisWeek)} active this week`, BLUE), undefined, { gap: 4 }),
  ];
  if (c.clog) id.push(muted(`Avg log ${fmt(c.clog.average)} slots · ${fmt(c.clog.synced)} synced`));
  if (c.competitions.length) {
    const running = c.competitions
      .map((x) => `${x.type === 'boss' ? 'BOTW ' : x.type === 'skill' ? 'SOTW ' : ''}${x.label}`)
      .join(' · ');
    id.push(row(text('Running:', 'white', { font: 'small' }), small(running, BLUE, { wrap: true }), undefined, { gap: 4 }));
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

  if (c.topWeek.length) {
    parts.push(
      section([
        siteHeader('This week', `+${fmt(Math.round(c.weekHours))}h gained`, `/members?sort=week`),
        ...c.topWeek.map((g, i) => nameLine(`${i + 1}  ${g.rsn}`, `+${g.hours.toFixed(1)}h`, g.rsn)),
      ], { gap: 4 }),
    );
  }
  if (c.topPlayers.length) {
    parts.push(section([
      siteHeader('Top accounts', 'by total XP', `/members?sort=xp`),
      ...c.topPlayers.map((p) => nameLine(p.rsn, `${count(p.overallXp)} xp`, p.rsn)),
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
export function spaceCardUi(c: Pick<ClanCard, 'slug' | 'name'>): Node {
  return col([
    card([
      row(undefined, text(c.name, 'white', { font: 'bold' }), icon({
        glyph: 'external',
        w: 12,
        h: 12,
        color: 'muted',
        tip: 'Open this space on the Anvil website',
        on: { a: 'site', path: `/c/${seg(c.slug)}` },
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

/** Lookup's clan search: a row per listed clan that matches, each opening its card. */
export function clanSearchUi(q: string, found: { slug: string; name: string; boostLevel?: number; boostNameStyle?: import('@/lib/clanBoostRules').ClanBoostNameStyle | null }[]): Node {
  if (!found.length) return message(`No listed clan matches "${q}".`).ui;
  return col(
    found.flatMap((f) => {
      const source = clanBoostInk(f.boostLevel ?? 0, f.boostNameStyle);
      const boost = source ? inkForSurface(source, 'dark') : null;
      return [
        row(undefined, text(f.name, boost?.color ?? 'white', {
          ...(boost?.grad ? { grad: boost.grad } : {}),
          ...(boost?.move ? { move: true } : {}),
        }), row((f.boostLevel ?? 0) > 0 ? chip(`Boost ${f.boostLevel}`, 'purple') : undefined, undefined, icon({ glyph: 'chevron-right', w: 9, h: 9, color: 'muted' }), { gap: 6 }), { bg: 'raised', pad: 7, inset: 8, on: { a: 'load', v: 'clan', args: { slug: f.slug } } }),
        gap(4),
      ];
    }),
  );
}
