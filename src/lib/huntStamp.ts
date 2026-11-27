import type { StampModel } from '@/lib/proofStamp';

// The stamp on an item hunt / Boss Rush screenshot: a drop's, or a rush death's. The same banner a
// bingo proof gets (lib/proofStampImage bakeStamp), but every word on it is the server's own: the
// drop or death as the site recorded it, the competition, the character, the times it was filed and
// stamped, and the stored image's hash. Nothing the client typed reaches it.
//
// Pure: the upload path and the tests read it.

/** "2026-11-27 08:22:29": a server timestamp (ISO or the database's space form) in UTC, to the second. */
export function utcWords(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

export interface HuntStampInput {
  kind: 'drop' | 'death';
  /** The competition's title. */
  competition: string;
  /** Item hunt or Boss Rush: the stamp's heading. */
  rush: boolean;
  rsn: string;
  /** Drops: the item and how many. */
  item?: string | null;
  quantity?: number;
  /** Drops: where it came from. Deaths: what killed them, as the feed words it. */
  source?: string | null;
  /** When the site recorded it, epoch ms. */
  recordedAt: number;
  /** When the screenshot arrived and was stamped, epoch ms. */
  stampedAt: number;
  /** The drop's or death's row id. */
  id: number;
  sha256: string | null;
  /** Two stacked frames (at drop, moments later): where the second starts. */
  split: number | null;
}

export function huntStampModel(i: HuntStampInput): StampModel {
  const heading = i.rush ? 'BOSS RUSH' : 'ITEM HUNT';
  const drop = i.kind === 'drop';
  const detail = drop
    ? `${i.item ?? 'A drop'}${(i.quantity ?? 1) > 1 ? ` x${i.quantity}` : ''}`
    : i.source ? `Died to ${i.source}` : 'Died';
  const meta = [`RSN: ${i.rsn}`, `Event: ${i.competition}`];
  if (drop && i.source) meta.push(`From: ${i.source}`);
  meta.push(`Recorded: ${utcWords(i.recordedAt)} UTC`);
  meta.push(`Stamped: ${utcWords(i.stampedAt)} UTC`);
  const hash = i.sha256 ? `, sha256 ${i.sha256.slice(0, 12)}` : '';
  return {
    title: `${heading} ${drop ? 'DROP' : 'DEATH'}`,
    detail,
    meta,
    lines: [],
    anvil: [],
    footer: `${drop ? 'Drop' : 'Death'} #${i.id}${hash}, stamped by Anvil`,
    split: i.split,
  };
}
