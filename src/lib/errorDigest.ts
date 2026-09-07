// Turning a table of failures into something a person will actually read at 09:00.
//
// PURE — the message builder takes rows and returns an embed, so what the digest SAYS can be tested
// without a database or a webhook. The reading and posting live in the cron route.
//
// THE DIGEST REPORTS THE DELTA, not the total. A failure that happened four thousand times overnight
// and has now stopped should go quiet on its own; one that is still going should keep being
// mentioned. Storing the count at the last digest and reporting the difference gives both, and it
// means a digest that fails to send does not lose the occurrences it would have covered — the next
// one reports them instead.

/** How many distinct failures a single digest names. Beyond this it stops being a message. */
export const DIGEST_LIMIT = 10;

export interface DigestRow {
  id: number;
  fingerprint: string;
  name: string;
  message: string;
  path: string | null;
  source: string | null;
  release: string | null;
  clanSlug: string | null;
  count: number;
  notifiedCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DigestEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

/** New occurrences since the last digest. Rows with none are not news. */
export function deltaOf(row: Pick<DigestRow, 'count' | 'notifiedCount'>): number {
  return Math.max(0, row.count - row.notifiedCount);
}

/** A failure nobody has reported before reads differently from one that is continuing. */
export function isNew(row: Pick<DigestRow, 'notifiedCount'>): boolean {
  return row.notifiedCount === 0;
}

const RED = 0xd9534f;
const AMBER = 0xe0aa1e;

/**
 * The digest, or null when there is nothing to say.
 *
 * NULL IS THE COMMON CASE and it matters that it stays that way: an hourly job that posts "0 errors"
 * every hour trains everyone to ignore the channel it posts in, which costs exactly the alarm the
 * job exists to raise.
 */
export function buildDigest(rows: DigestRow[], windowLabel = 'the last hour'): DigestEmbed | null {
  const news = rows.map((r) => ({ row: r, delta: deltaOf(r) })).filter((r) => r.delta > 0);
  if (news.length === 0) return null;

  news.sort((a, b) => b.delta - a.delta);
  const shown = news.slice(0, DIGEST_LIMIT);
  const newCount = news.filter((n) => isNew(n.row)).length;
  const total = news.reduce((sum, n) => sum + n.delta, 0);

  const headline =
    newCount > 0
      ? `${newCount} new ${newCount === 1 ? 'failure' : 'failures'}, ${total.toLocaleString()} ${total === 1 ? 'occurrence' : 'occurrences'} in ${windowLabel}`
      : `${total.toLocaleString()} ${total === 1 ? 'occurrence' : 'occurrences'} in ${windowLabel}, nothing new`;

  return {
    title: newCount > 0 ? '🔴 Errors' : '🟡 Errors continuing',
    description: headline,
    color: newCount > 0 ? RED : AMBER,
    fields: shown.map(({ row, delta }) => ({
      name: `${isNew(row) ? '🆕 ' : ''}${row.name} ×${delta.toLocaleString()}`.slice(0, 256),
      value: [
        // The message is the useful line, so it goes first and gets the room.
        '```', row.message.slice(0, 300), '```',
        [
          row.path ? `\`${row.path}\`` : null,
          row.clanSlug ? `clan \`${row.clanSlug}\`` : 'apex',
          row.source ? `_${row.source}_` : null,
          row.release ? `v${row.release}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ]
        .join('\n')
        .slice(0, 1024),
      inline: false,
    })),
    footer:
      news.length > shown.length
        ? { text: `+${news.length - shown.length} more — see /staff/errors` }
        : { text: 'See /staff/errors' },
  };
}
