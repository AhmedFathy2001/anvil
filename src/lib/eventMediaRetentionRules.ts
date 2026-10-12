import { parseStamp } from '@/lib/dbTime';

// The pure rules of event media retention (lib/eventMediaRetention) — no database, so the dates the
// event admin page promises and the job acts on come from one function and are tested directly.

/** Proof images are kept this long after an event ends. */
export const MEDIA_RETENTION_DAYS = 90;

/** What a deleted proof's URL becomes: a site image that says the proof was deleted, and why. */
export const EXPIRED_PROOF_URL = '/proof-expired.svg';

/** True for a URL the retention job replaced — the image is gone, the row it belonged to is not. */
export function isExpiredProof(url: string | null | undefined): boolean {
  return url === EXPIRED_PROOF_URL;
}

/**
 * When an event's media is deleted: MEDIA_RETENTION_DAYS after it ended — the earlier of a
 * force-end and its scheduled end, since a force-ended event is over whatever its end date says.
 * Null while it has no end at all (a draft, or an event running with no end date).
 */
export function eventMediaPurgeAt(e: { endDate: string | null; forceEndedAt: string | null }): Date | null {
  const ends = [parseStamp(e.forceEndedAt), parseStamp(e.endDate)].filter((t): t is number => t != null);
  if (ends.length === 0) return null;
  return new Date(Math.min(...ends) + MEDIA_RETENTION_DAYS * 24 * 60 * 60_000);
}
