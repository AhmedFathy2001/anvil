import type { ClanCard } from '@/lib/clanCard';

import { type Node, backRow, button, card, col, count, fmt, gap, header, icon, message, muted, row, seg, text } from './nodes';
import { namesRow, vsRow } from './playerMoreUi';

// A clan as the plugin's panel draws it (was ClanCardView.java): who the clan is, how hard it played
// this week and who carried it, its strongest accounts, what dropped lately and what's running. Under
// Events in the Clan tab (your clan) and in Lookup (any listed clan). Pure.

/** "Name ......... value" — the name opens that player's card. */
function nameLine(label: string, value: string, rsn: string): Node {
  return row(undefined, text(label), text(value, 'brand'), { pad: 2, inset: 2, tip: `Look up ${rsn}`, on: { a: 'lookup', rsn } });
}

/** @param compare offer "Compare with my clan" (another clan, and the viewer has one) */
export function clanCardUi(c: ClanCard, compare: boolean): Node {
  const parts: Node[] = [];
  const id: Node[] = [
    row(undefined, text(c.name, 'white', { font: 'bold' }), icon({
      glyph: 'external',
      w: 12,
      h: 12,
      color: 'muted',
      tip: 'Open the clan on the Anvil website',
      on: { a: 'site', path: `/c/${seg(c.slug)}` },
    })),
    gap(2),
    muted(`${fmt(c.members)} members · ${fmt(c.activeThisWeek)} active this week`),
  ];
  if (c.clog) id.push(muted(`Avg log ${fmt(c.clog.average)} slots · ${fmt(c.clog.synced)} synced`));
  if (c.competitions.length) {
    const running = c.competitions
      .map((x) => `${x.type === 'boss' ? 'BOTW ' : x.type === 'skill' ? 'SOTW ' : ''}${x.label}`)
      .join(' · ');
    id.push(gap(2), text(`Running: ${running}`, 'brand', { wrap: true }));
  }
  parts.push(card(id));

  if (c.topWeek.length) {
    parts.push(
      gap(6),
      card([
        header('This week', `+${fmt(Math.round(c.weekHours))}h gained`),
        gap(4),
        ...c.topWeek.map((g, i) => nameLine(`${i + 1}.  ${g.rsn}`, `+${g.hours.toFixed(1)}h`, g.rsn)),
      ]),
    );
  }
  if (c.topPlayers.length) {
    parts.push(gap(6), card([header('Top accounts', 'by total XP'), gap(4), ...c.topPlayers.map((p) => nameLine(p.rsn, `${count(p.overallXp)} xp`, p.rsn))]));
  }
  if (c.highlights.length) {
    parts.push(
      gap(6),
      card([
        header('Lately in the clan'),
        gap(4),
        ...c.highlights.flatMap((h) => [
          row(
            icon({ item: h.itemId ?? undefined, w: 24, h: 22 }),
            col([text(h.label), muted(`${h.rsn}${h.kind === 'pet' ? ' · pet' : ''}`)]),
            muted('', { at: h.at }),
          ),
          gap(2),
        ]),
      ]),
    );
  }
  if (compare) parts.push(gap(6), button('Compare with my clan', { a: 'load', v: 'clan-compare', args: { slug: c.slug } }));
  return col(parts);
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
      vsRow('Total EHP', Math.round(a.totalEhp), Math.round(b.totalEhp), hours),
      vsRow('Total EHB', Math.round(a.totalEhb), Math.round(b.totalEhb), hours),
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
export function clanSearchUi(q: string, found: { slug: string; name: string }[]): Node {
  if (!found.length) return message(`No listed clan matches "${q}".`).ui;
  return col(
    found.flatMap((f) => [
      row(undefined, text(f.name), icon({ glyph: 'chevron-right', w: 9, h: 9, color: 'muted' }), { bg: 'card', pad: 6, inset: 8, on: { a: 'load', v: 'clan', args: { slug: f.slug } } }),
      gap(2),
    ]),
  );
}
