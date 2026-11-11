// The website's Feed & chat page (app/events/[eventId]/live): the board's Feed rows and chat lines,
// shaped for the browser (lib/liveView). Pure (tests/live-view.test.ts). The words, titles, tones and
// pictures are the plugin panel's own (lib/pluginUi/feedUi), so a row reads the same on a phone as in
// RuneLite; only the shape changes, from panel rows to plain data a React page draws. Server-side
// only by habit: feedUi's titles pull in the game datasets, which no page should ship to a browser.

import { itemAssetUrl, wikiImageUrl } from '@/lib/assetUrls';
import { formatGp } from '@/lib/itemPrices';
import { emptyLine, momentIcon, momentTitle, momentTone, type MomentLike } from '@/lib/pluginUi/feedUi';
import type { FeedRow } from '@/lib/pluginUi/nodes';
import { cssColor, inkOf, isoStamp, type LiveChatLine, type LiveFeedRow, type LiveIcon } from '@/lib/liveView';

const HEX = /^#[0-9a-f]{6}$/i;

const SPRITES: Record<NonNullable<FeedRow['sprite']>, { src: string; alt: string }> = {
  total: { src: wikiImageUrl('Stats_icon.png'), alt: 'Total level' },
  combat: { src: wikiImageUrl('Combat_Achievements_icon.png'), alt: 'Combat task' },
  diary: { src: wikiImageUrl('Achievement_Diaries_icon.png'), alt: 'Diary' },
  quest: { src: wikiImageUrl('Quest_point_icon.png'), alt: 'Quest' },
  // The Collection log item.
  'collection-log': { src: itemAssetUrl(22711), alt: 'Collection log' },
};

/** The panel's picture for a moment, as something a browser can draw. */
export function liveIcon(m: MomentLike): LiveIcon {
  const ic = momentIcon(m);
  if (ic.item != null) return { src: itemAssetUrl(ic.item), alt: m.itemName ?? m.kind };
  if (ic.sprite) return SPRITES[ic.sprite];
  if (ic.skill) {
    const name = ic.skill.charAt(0).toUpperCase() + ic.skill.slice(1);
    return { src: wikiImageUrl(`${name}_icon.png`), alt: name };
  }
  return { glyph: ic.glyph ?? 'check', color: cssColor(ic.glyphColor) };
}

/** One moment (maybe a collapsed run) as the page's row. */
export function liveMomentRow(
  m: MomentLike,
  o: { mine?: boolean; team?: { name: string; color: string | null } | null; ink?: { color: string; grad?: readonly string[]; move?: boolean; glyph?: string | null } | null } = {},
): LiveFeedRow {
  const ink = inkOf(o.ink);
  const tone = momentTone(m);
  const value = m.valueGp != null && m.valueGp > 0 ? formatGp(m.valueGp) : null;
  return {
    id: `m${m.id}`,
    momentId: m.id > 0 ? m.id : null,
    kind: m.kind,
    title: momentTitle(m),
    titleColor: cssColor(tone.textColor),
    icon: liveIcon(m),
    who: m.rsn,
    ink,
    // A Supporter's own colours, else their team's, else muted (the panel's order).
    whoColor: ink ? null : cssColor(o.team?.color ?? null),
    tag: o.team ? { label: o.team.name, color: cssColor(o.team.color) } : m.worldModeLabel ? { label: m.worldModeLabel, color: m.worldMode === 'hardcore' ? '#ff7a6b' : '#ff981f' } : null,
    value,
    at: isoStamp(m.occurredAt),
    mine: !!o.mine,
  };
}

/** A board tile some team finished, as the page's row (lib/pluginUi/feedUi completionRow's words). */
export function liveTileRow(c: { tileId: number; teamId: number; label: string; who: string | null; team: { name: string; color: string | null } | null; at: string; mine?: boolean }): LiveFeedRow {
  return {
    id: `t${c.tileId}:${c.teamId}`,
    momentId: null,
    kind: 'tile',
    title: c.label,
    titleColor: '#5fd35f',
    icon: { glyph: 'check', color: '#5fd35f' },
    // Who, then the team as the tag. No finisher: the team is the name, untagged.
    who: c.who ?? c.team?.name ?? '',
    ink: null,
    whoColor: null,
    tag: c.team && c.who ? { label: c.team.name, color: cssColor(c.team.color) } : null,
    value: null,
    at: isoStamp(c.at),
    mine: !!c.mine,
  };
}

/** A chat line from the chat engine (lib/eventChat chatHistory) as the page's line. */
export function liveChatLine(r: FeedRow): LiveChatLine | null {
  const id = Number(r.id.startsWith('c') ? r.id.slice(1) : NaN);
  if (!Number.isInteger(id) || id <= 0) return null;
  const ink = r.whoColor && HEX.test(r.whoColor) ? inkOf({ color: r.whoColor, grad: r.grad, move: r.move, glyph: r.whoGlyph }) : null;
  return {
    id,
    who: r.who ?? '',
    ink,
    tag: r.tag ? { label: r.tag, color: cssColor(r.tagColor) } : null,
    body: r.text ?? '',
    at: isoStamp(r.at ?? ''),
    mine: !!r.mine,
    canMod: !!r.menu?.length,
  };
}

/** What an empty chat channel or Feed filter says: the panel's words. */
export function liveEmptyLine(pane: 'feed' | 'chat', filter: string): string {
  return emptyLine(pane, filter);
}
