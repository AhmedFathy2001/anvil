/**
 * An item hunt drop on Discord: the pure half (no database; lib/huntDropPosts is the other).
 *
 * Every drop that counts is posted once, as it happens: who, what, from where, at what kill count,
 * and where that leaves them in the hunt. A plugin drop's screenshot follows a few seconds later and
 * is added to the same post; the post never waits for it, and a drop never needs it to count.
 */
import { EMBED_COLOR, clamp, field, LIMIT, type DiscordEmbed } from '@/lib/discordEmbeds';
import { formatGp } from '@/lib/adminEventsFormat';
import { placeWords, type HuntRule } from '@/lib/itemHunt';
import { discordAssetUrl } from '@/lib/seo';
import { itemIconUrl } from '@/lib/tileIcons';

/** The clan switch for these posts, on unless turned off (lib/weeklyDaily switchOn). */
export const HUNT_DROP_POSTS_KEY = 'weekly_post_hunt_drops';

/** How long after a plugin drop is filed its screenshot may still be added. */
export const HUNT_PROOF_WINDOW_MS = 15 * 60_000;

/** Only a counted drop is news, and only the first time. Held, waiting and turned-down drops never post. */
export function huntDropPostable(row: { status: string; postedAt: string | null }): boolean {
  return row.status === 'counted' && row.postedAt == null;
}

/** Can a screenshot still be added under this drop's key? A turned-down drop takes none. */
export function huntProofOpen(row: { status: string; createdAtMs: number | null }, nowMs: number): boolean {
  if (row.status === 'rejected') return false;
  return row.createdAtMs == null || nowMs - row.createdAtMs <= HUNT_PROOF_WINDOW_MS;
}

export interface HuntDropPost {
  clanId: number;
  /** The hunt (a weekly competition), for the title link to its page. */
  competitionId?: number | null;
  /** The hunt's title, as its start and results posts show it. */
  title: string;
  /** 'Item hunt' or 'Pet hunt'. */
  kind: string;
  rule: HuntRule;
  /** The hunt's own picture, when the drop has no item id. */
  huntIconUrl: string | null;
  rsn: string;
  itemId: number | null;
  itemName: string;
  quantity: number;
  source: string | null;
  /** "at 512 kc" / "at 13,034,431 Woodcutting XP" (lib/itemHunt dropStatWords), or null. */
  stat: string | null;
  /** "plugin" or "manual proof (approved by Olive)" (lib/itemHunt dropOriginWords). */
  origin: string;
  /** Their count once this drop is in: drops, or points on a points hunt. */
  count: number;
  /** Their place once this drop is in; null when they are not on the board. */
  place: number | null;
  endDate: string;
  imageUrl: string | null;
  /** The bounty place this drop claimed (lib/itemHunt huntBountyClaims); absent when it claimed none. */
  bounty?: { place: number; itemName: string; amount: number; hcw: boolean } | null;
}

/** "+ claims the Baron bounty: 20m" / "+ claims 2nd Baron bounty: 10m". */
export function bountyClaimLine(b: NonNullable<HuntDropPost['bounty']>): string {
  const amount = `${formatGp(b.amount)}${b.hcw ? ' HCW gp' : ''}`;
  return b.place === 1 ? `+ claims the ${b.itemName} bounty: ${amount}` : `+ claims ${placeWords(b.place)} ${b.itemName} bounty: ${amount}`;
}

const medal = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '');

function countWords(rule: HuntRule, n: number): string {
  const unit = rule === 'points' || rule === 'rush' ? (n === 1 ? 'point' : 'points') : n === 1 ? 'drop' : 'drops';
  return `${n.toLocaleString()} ${unit}`;
}

function relative(iso: string): string | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:R>` : null;
}

/** The post. The same embed is sent again with the picture when the plugin's screenshot lands. */
export function huntDropEmbed(p: HuntDropPost): DiscordEmbed {
  const item = `${p.itemName}${p.quantity > 1 ? ` ×${p.quantity.toLocaleString()}` : ''}`;
  const where = [p.source ? `from **${p.source}**` : null, p.stat].filter(Boolean).join(' ');
  const icon = p.itemId != null ? itemIconUrl(p.itemId) : p.huntIconUrl;
  const standing = p.place != null ? `${medal(p.place)} ${placeWords(p.place)}, ${countWords(p.rule, p.count)}`.trim() : countWords(p.rule, p.count);
  const ends = relative(p.endDate);
  return {
    author: { name: `${p.kind}: new drop` },
    ...(icon ? { thumbnail: { url: discordAssetUrl(icon) } } : {}),
    title: clamp(`🎁 ${p.title}`, LIMIT.title),
    description: clamp(`**${p.rsn}** got **${item}**${where ? ` ${where}` : ''}.${p.bounty ? `\n💰 **${bountyClaimLine(p.bounty)}**` : ''}`, LIMIT.description),
    color: EMBED_COLOR.green,
    fields: [
      field('Standing', standing),
      field('Counted from', p.origin),
      ...(ends ? [field('Ends', ends)] : []),
    ],
    ...(p.imageUrl ? { image: { url: p.imageUrl } } : {}),
  };
}
