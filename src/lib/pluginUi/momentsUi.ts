import type { Action, Node } from './nodes';
import { button, col, gap, icon, muted, nameText, row, text } from './nodes';

// The clan's Recent drops in the plugin panel: the clan card's short "lately" list grown into a log,
// with a GZ on every line for clanmates. GZ is any member's; the gold one is a supporting member's. Pure.

export interface FeedItem {
  id: number;
  rsn: string;
  label: string;
  itemId: number | null;
  kind: string;
  at: string;
  gz: number;
  gold: number;
  mineGz: boolean;
  mineGold: boolean;
}

export interface FeedOptions {
  slug: string;
  /** How many lines this answer holds; "Show more" asks for more. */
  n: number;
  /** The query found more than `n`. */
  more: boolean;
  /** The viewer is an Anvil Supporter and may give gold. */
  canGold: boolean;
  /** Signed in with the plugin AND a member of this clan: reacting is for clanmates. */
  canReact: boolean;
}

export const FEED_STEP = 15;
export const FEED_MAX = 60;

const GOLD = '#ffd35c';

const react = (o: FeedOptions, id: number, kind: 'gz' | 'gold'): Action => ({
  a: 'post',
  act: 'react',
  args: { slug: o.slug, id: String(id), kind, n: String(o.n) },
  into: 'moments',
});

function reactions(m: FeedItem, o: FeedOptions): Node {
  const gz = text(m.gz > 0 ? `GZ ${m.gz}` : 'GZ', m.mineGz ? 'brand' : 'muted', {
    font: 'small',
    tip: !o.canReact ? 'GZs from their clanmates' : m.mineGz ? 'You said GZ — click to take it back' : `Say GZ to ${m.rsn}`,
    ...(o.canReact ? { on: react(o, m.id, 'gz') } : {}),
  });
  // Gold is only drawn where it means something: on a line that has some, or for a supporter.
  if (!o.canGold && m.gold === 0) return gz;
  const gold = text(String(m.gold), m.mineGold ? GOLD : 'muted', {
    font: 'small',
    icon: icon({ glyph: 'star', w: 9, h: 9, color: GOLD, alt: 'Gold' }),
    tip: o.canGold && o.canReact
      ? m.mineGold
        ? 'You gave this a gold GZ — click to take it back'
        : 'Give a gold GZ (an Anvil Supporter reaction)'
      : 'Gold GZs come from Anvil Supporters',
    ...(o.canGold && o.canReact ? { on: react(o, m.id, 'gold') } : {}),
  });
  return row(gz, undefined, gold, { gap: 8 });
}

export function momentsFeedUi(items: FeedItem[], o: FeedOptions): Node {
  if (!items.length) return muted('Nothing dropped lately. The next pet or unique lands here.', { wrap: true });
  const parts: Node[] = [];
  for (const m of items) {
    parts.push(
      row(
        icon({ item: m.itemId ?? undefined, w: 24, h: 22 }),
        col([
          text(m.kind === 'pet' ? `${m.label} · pet` : m.label),
          row(nameText(m.rsn, 'muted', { font: 'small' }), undefined, reactions(m, o)),
        ]),
        muted('', { at: m.at }),
      ),
      gap(3),
    );
  }
  if (o.more && o.n < FEED_MAX) {
    parts.push(
      gap(3),
      button('Show more', { a: 'load', v: 'moments', args: { slug: o.slug, n: String(Math.min(FEED_MAX, o.n + FEED_STEP)) }, into: 'moments' }),
    );
  }
  return col(parts);
}
