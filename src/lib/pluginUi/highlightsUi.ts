import type { Node } from './nodes';
import { col, icon, muted, nameText, row, text } from './nodes';
import { SOFT, clip, more, section, title } from './sections';
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
}

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
  if (h.latest.length) out.push(section([title('Latest'), ...h.latest.map(dropRow)], { gap: 5 }));
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

