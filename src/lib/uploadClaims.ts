// Which event a stored proof file belongs to (proof_uploads.event_id).
//
// A proof's image is a URL the client sends, and the 90-day media purge deletes an event's files. So
// the purge must only ever delete files the purged event provably owns — not "any file our storage
// holds that some row of this event names". A file is claimed by the first event whose proof, extra
// or starting shot names it (eventMediaRetentionRules deletableMedia says how the purge uses that).

import { and, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { proofUploads } from '@/db/schema';

/**
 * Stamp these uploaded files with this event, where no event has claimed them yet. Sharing is fine —
 * a player in two clans' bingos may file one screenshot to both; the purge keeps a file while any
 * other event still names it.
 */
export async function claimUploads(urls: string[], eventId: number): Promise<void> {
  const list = [...new Set(urls.filter(Boolean))];
  if (list.length === 0) return;
  // clan-scope: global -- keyed by exact file URLs the caller already checked are this person's own.
  await db.update(proofUploads).set({ eventId }).where(and(inArray(proofUploads.url, list), isNull(proofUploads.eventId)));
}

/** Who claimed each of these URLs (null = recorded, claimed by no event), and which have no record. */
export async function uploadOwnership(urls: string[]): Promise<{ owner: Map<string, number | null>; unrecorded: Set<string> }> {
  const owner = new Map<string, number | null>();
  for (let i = 0; i < urls.length; i += 500) {
    const chunk = urls.slice(i, i + 500);
    // clan-scope: global -- the purge asks about this event's own file URLs.
    const rows = await db.select({ url: proofUploads.url, eventId: proofUploads.eventId }).from(proofUploads).where(inArray(proofUploads.url, chunk));
    for (const r of rows) owner.set(r.url, r.eventId);
  }
  return { owner, unrecorded: new Set(urls.filter((u) => !owner.has(u))) };
}
