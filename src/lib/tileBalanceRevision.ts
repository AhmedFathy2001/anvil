import { createHash } from 'node:crypto';

/**
 * Opaque stamp for the tile state the effort report was calculated from.
 *
 * A bulk point review can sit open while another editor changes the board. The apply endpoint
 * recomputes this stamp while holding the board rows for update and refuses a stale review, so the
 * user either gets every value they reviewed or none of them.
 */
export function tileBalanceRevision(
  rows: Array<{ id: number; points: number; updatedAt?: string | null }>,
): string {
  const canonical = [...rows]
    .sort((a, b) => a.id - b.id)
    .map((row) => `${row.id}:${row.points}:${row.updatedAt ?? ''}`)
    .join('|');

  return createHash('sha256').update(canonical).digest('base64url');
}
