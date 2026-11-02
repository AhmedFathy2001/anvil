// Which event a stored proof file belongs to (proof_uploads.event_id).
//
// A proof's image is a URL the client sends, and the 90-day media purge deletes an event's files. So
// the purge must only ever delete files the purged event provably owns — not "any file our storage
// holds that some row of this event names". A file is claimed by the first proof, extra or starting
// shot that names it; naming a file another event already claimed is refused.

import { and, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { proofUploads } from '@/db/schema';

/**
 * Claim these uploaded files for this event. False when any of them already belongs to another
 * event. Files with no upload record are left alone (the callers refuse those before this).
 */
export async function claimUploads(urls: string[], eventId: number): Promise<boolean> {
  const list = [...new Set(urls.filter(Boolean))];
  if (list.length === 0) return true;
  // clan-scope: global -- keyed by exact file URLs the caller already checked are this person's own.
  await db.update(proofUploads).set({ eventId }).where(and(inArray(proofUploads.url, list), isNull(proofUploads.eventId)));
  // clan-scope: global -- same URLs: is any of them another event's?
  const other = await db
    .select({ url: proofUploads.url })
    .from(proofUploads)
    .where(and(inArray(proofUploads.url, list), ne(proofUploads.eventId, eventId)))
    .limit(1);
  return other.length === 0;
}

/** Of these URLs, the ones this event has claimed, and the ones with no upload record at all. */
export async function uploadOwnership(urls: string[], eventId: number): Promise<{ claimed: Set<string>; unrecorded: Set<string> }> {
  const claimed = new Set<string>();
  const recorded = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    const chunk = urls.slice(i, i + 500);
    // clan-scope: global -- the purge asks about this event's own file URLs.
    const rows = await db.select({ url: proofUploads.url, eventId: proofUploads.eventId }).from(proofUploads).where(inArray(proofUploads.url, chunk));
    for (const r of rows) {
      recorded.add(r.url);
      if (r.eventId === eventId) claimed.add(r.url);
    }
  }
  return { claimed, unrecorded: new Set(urls.filter((u) => !recorded.has(u))) };
}
