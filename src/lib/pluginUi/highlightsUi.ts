import type { Node } from './nodes';
import { type Color, col, icon, muted, nameText, row, text } from './nodes';
import { GOLD, GREEN, SOFT, clip, more, section, title } from './sections';
import { rankBestDrops, type DropMoment } from '@/lib/bestDrops';
import { weeklyRsnKey } from '@/lib/weeklyRsn';

// A competition's drops in the side panel, under its standings: "Best drops" (lib/bestDrops, the
// same ranking the site shows) and "Latest" (the newest few). Built from nodes the panel already
// draws: an item icon, two lines of text, a relative time, and the "+N more" toggle. Pure.

/** One line, as /api/plugin/weekly-leaderboard sends it (`highlights.best` / `highlights.latest`). */
export interface PanelDrop {
  rsn: string;
  itemId: number | null;
  itemName: string;
  /** Times this person got it; best drops only. */
  count?: number;
  /** 1 in N, when known. */
  rarity?: number | null;
  /** Kill count at the drop, when the report had it. */
  kc?: number | null;
  /** When, ISO. Drawn by the panel as "2h ago". */
  at: string;
}

export interface PanelHighlights {
  best: PanelDrop[];
  latest: PanelDrop[];
  /** The competition's feed, newest first: drops, deaths and kills finished together. Replaces "Latest" when sent. */
  feed?: PanelFeedLine[];
}

/** One feed line: a drop (with its item), a death, or clanmates finishing a kill together. */
export interface PanelFeedLine {
  kind: 'drop' | 'death' | 'together';
  /** Who: one name, or "Ann, Bob and Cy" for a kill done together. */
  who: string;
  /** What, after the name: "Twisted bow", "died to Zebak", "finished Nex together". */
  text: string;
  itemId?: number | null;
  /** Rush points a drop was worth, when it was worth any. */
  pts?: number | null;
  at: string;
}

/** "Ann", "Ann and Bob", "Ann, Bob and Cy". */
export function namesWords(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const DEATH_RED: Color = '#ff7b6b';

/** One feed line: picture, who and what, and how long ago. */
export function feedLineRow(l: PanelFeedLine): Node {
  const pic =
    l.kind === 'drop' ? icon({ item: l.itemId ?? undefined, w: 24, h: 22 }) : icon({ glyph: l.kind === 'together' ? 'star' : 'close', w: 12, h: 12, color: l.kind === 'together' ? GOLD : DEATH_RED });
  const color: Color = l.kind === 'death' ? DEATH_RED : l.kind === 'together' ? GOLD : SOFT;
  return row(
    pic,
    col([
      text(clip(l.who, 30), 'white', { tip: l.who, wrap: 165 }),
      text(l.text, color, { tip: l.text, wrap: 165 }),
      muted('', { at: l.at, font: 'small' }),
    ]),
    l.pts ? text(`+${l.pts}`, GREEN, { font: 'bold' }) : undefined,
    { gap: 6 },
  );
}

/** How many feed lines show before "+N more", and how many the panel is sent. */
const FEED_SHOWN = 5;
export const PANEL_FEED = 20;

/** How many best drops show before "+N more". */
const BEST_SHOWN = 3;

/**
 * "Name · Item" with the item's picture, and under it a dim "1 in 5,000 · 1,204 kc · 2h ago".
 * Narrow on purpose: the side panel is about 225px wide, so the name and the item are both cut.
 */
export function dropRow(d: PanelDrop): Node {
  const facts = [d.rarity ? `1 in ${d.rarity.toLocaleString('en-US')}` : null, d.kc ? `${d.kc.toLocaleString('en-US')} kc` : null].filter(Boolean).join(', ');
  const item = `${clip(d.itemName, 16)}${d.count && d.count > 1 ? ` ×${d.count}` : ''}`;
  return row(
    icon({ item: d.itemId ?? undefined, w: 24, h: 22 }),
    col([
      row(nameText(clip(d.rsn, 12), 'white', { tip: d.rsn }), text(item, SOFT, { tip: d.itemName }), undefined, { gap: 3 }),
      // The time is its own text: the panel works "2h ago" out when it draws.
      row(facts ? muted(`${facts},`, { font: 'small' }) : undefined, muted('', { at: d.at, font: 'small' }), undefined, { gap: 3 }),
    ]),
    undefined,
    { gap: 6 },
  );
}

/** The two cards, in order. Nothing at all when there are no drops: no empty box. */
export function highlightNodes(h: PanelHighlights | null | undefined, key: string): Node[] {
  if (!h) return [];
  const out: Node[] = [];
  if (h.best.length) out.push(section([title('Best drops'), ...more(h.best.map(dropRow), BEST_SHOWN, `best:${key}`, 5)], { gap: 5 }));
  if (h.feed?.length) out.push(section([title('Feed'), ...more(h.feed.map(feedLineRow), FEED_SHOWN, `feed:${key}`, 5)], { gap: 5 }));
  else if (h.latest.length) out.push(section([title('Latest'), ...h.latest.map(dropRow)], { gap: 5 }));
  return out;
}

/** How many of each the panel is sent. */
export const PANEL_BEST = 5;
export const PANEL_LATEST = 4;

/** Pure: rank the drops and cut both lists. `onBoard` keeps out anyone the standings have dropped. */
export function panelHighlights(drops: DropMoment[], onBoard: ReadonlySet<string>): PanelHighlights | null {
  const shown = drops.filter((d) => onBoard.has(weeklyRsnKey(d.rsn)));
  const best: PanelDrop[] = rankBestDrops(shown)
    .slice(0, PANEL_BEST)
    .map((d) => ({ rsn: d.rsn, itemId: d.itemId, itemName: d.itemName, count: d.count, rarity: d.rarity, kc: d.kc, at: d.occurredAt }));
  const latest: PanelDrop[] = shown
    .filter((d) => (d.kind === 'pet' || d.kind === 'unique' || d.kind === 'loot') && (d.itemName || d.kind === 'pet'))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id)
    .slice(0, PANEL_LATEST)
    .map((d) => ({ rsn: d.rsn, itemId: d.itemId, itemName: d.itemName ?? 'A pet', rarity: d.rarityDenominator, kc: d.kc, at: d.occurredAt }));
  return best.length || latest.length ? { best, latest } : null;
}

