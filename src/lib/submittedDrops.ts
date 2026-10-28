import { and, eq, isNotNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '@/db';
import { eventParticipants, submissions, tiles } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { getItemPrices } from '@/lib/itemPrices';
import type { SubmittedDrop } from '@/lib/momentsAnalytics';
import { getItemMapping } from '@/lib/osrsItems';

/**
 * Every drop credited on a board, priced, for the recap's "By the numbers" (momentsAnalytics
 * `withSubmittedDrops`). Whatever the source — plugin or a screenshot uploaded on the site — so a
 * drop the feed never saw still counts toward the value seen.
 *
 * The item is the submission's own (per-item tracking), or the tile's when it tracks exactly one;
 * a submission that can't name an item can't be priced and is left out.
 */
export async function submittedDropsForEvent(eventId: number): Promise<SubmittedDrop[]> {
  const credited = alias(eventParticipants, 'credited');
  const rows = await db
    .select({
      id: submissions.id,
      itemId: submissions.itemId,
      tracked: tiles.trackedItemIds,
      amount: submissions.amount,
      teamId: submissions.teamId,
      createdAt: submissions.createdAt,
      submitter: eventParticipants.name,
      creditedName: credited.name,
    })
    .from(submissions)
    .innerJoin(tiles, eq(tiles.id, submissions.tileId))
    .leftJoin(eventParticipants, eq(eventParticipants.id, submissions.playerId))
    .leftJoin(credited, eq(credited.id, submissions.creditPlayerId))
    // Drop tiles only: a value tile's `amount` is gp, and a kill or timed tile's isn't an item at all.
    .where(and(eq(tiles.eventId, eventId), eq(tiles.tileType, 'drop'), or(isNotNull(submissions.itemId), isNotNull(tiles.trackedItemIds))));
  if (rows.length === 0) return [];

  const [prices, mapping] = await Promise.all([getItemPrices(), getItemMapping()]);
  const names = new Map(mapping.map((m) => [m.id, m.name]));
  const drops: SubmittedDrop[] = [];
  for (const r of rows) {
    const itemId = r.itemId ?? soleTracked(r.tracked);
    const rsn = r.creditedName ?? r.submitter;
    const at = parseStamp(r.createdAt);
    if (itemId == null || !rsn || at == null) continue;
    const quantity = Math.max(1, r.amount);
    const price = prices.get(itemId);
    drops.push({
      submissionId: r.id,
      rsn,
      itemId,
      itemName: names.get(itemId) ?? null,
      quantity,
      valueGp: price ? price * quantity : null,
      teamId: r.teamId,
      at,
    });
  }
  return drops;
}

function soleTracked(json: string | null): number | null {
  if (!json) return null;
  try {
    const ids = JSON.parse(json);
    return Array.isArray(ids) && ids.length === 1 && Number.isInteger(ids[0]) ? ids[0] : null;
  } catch {
    return null;
  }
}
