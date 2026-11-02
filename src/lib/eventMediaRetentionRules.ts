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

// ── Reminders ──────────────────────────────────────────────────────────────────────────────────────
// The clan's owner and admins are told before anything is deleted (lib/eventMediaNotice): a first
// reminder NOTICE_LEAD_DAYS ahead, a last one FINAL_NOTICE_LEAD_DAYS ahead. And deletion never comes
// sooner than MIN_NOTICE_DAYS after the first reminder went out — so an event that was ALREADY past
// its 90 days when retention shipped, or when a reminder could not go out on time, still gets a full
// week for someone to download the archive. The 90 days are the rule; the week is the promise.

/** First reminder: this many days before the images are deleted. */
export const NOTICE_LEAD_DAYS = 14;
/** Last reminder: this many days before. */
export const FINAL_NOTICE_LEAD_DAYS = 3;
/** Nothing is deleted sooner than this many days after the first reminder. */
export const MIN_NOTICE_DAYS = 7;

const DAY_MS = 24 * 60 * 60_000;

export interface RetentionState {
  endDate: string | null;
  forceEndedAt: string | null;
  /** When the first reminder went out; null = not yet. */
  mediaPurgeNoticeAt: string | null;
  /** When the last reminder went out; null = not yet. */
  mediaPurgeFinalNoticeAt: string | null;
}

/**
 * When this event's images will actually be deleted: 90 days after it ended, but never sooner than
 * MIN_NOTICE_DAYS after the first reminder — and while no reminder has gone out yet, never sooner
 * than MIN_NOTICE_DAYS from `now`, because one still has to. This is the date every page promises.
 */
export function effectivePurgeAt(e: RetentionState, now: Date): Date | null {
  const base = eventMediaPurgeAt(e);
  if (!base) return null;
  const noticed = parseStamp(e.mediaPurgeNoticeAt) ?? now.getTime();
  return new Date(Math.max(base.getTime(), noticed + MIN_NOTICE_DAYS * DAY_MS));
}

/** Which reminder is due now, if any. */
export function purgeNoticeDue(e: RetentionState, now: Date): 'first' | 'final' | null {
  const at = effectivePurgeAt(e, now);
  if (!at) return null;
  const t = now.getTime();
  const first = parseStamp(e.mediaPurgeNoticeAt);
  if (first == null) return at.getTime() - NOTICE_LEAD_DAYS * DAY_MS <= t ? 'first' : null;
  // Never both reminders on the same day: the last one waits at least a day after the first.
  if (e.mediaPurgeFinalNoticeAt == null && at.getTime() - FINAL_NOTICE_LEAD_DAYS * DAY_MS <= t && t - first >= DAY_MS) {
    return 'final';
  }
  return null;
}

/** True when the images may be deleted now: past the date, and the clan was told. */
export function isPurgeDue(e: RetentionState, now: Date): boolean {
  if (parseStamp(e.mediaPurgeNoticeAt) == null) return false;
  const at = effectivePurgeAt(e, now);
  return at != null && at.getTime() <= now.getTime();
}

/**
 * Which stored files a purge may delete: only what the event owns, and nothing another event still
 * shows. A row's URL is something a client sent, so "our storage, named by this event" is not
 * ownership. Never deleted while any OTHER event's live row names it (a player in two clans' bingos
 * may file one screenshot to both — purged rows stop naming it, so the last event out deletes it).
 *   proofUrls (proofs, clean frames, extras, starting shots) — the upload record's claim
 *     (lib/uploadClaims) is this event, or an event already purged; or there is no record at all
 *     (files from before records). Recorded but claimed by no event — a banner, say — is never ours.
 *   moneyUrls (fees, payouts) — under this clan's own folder (the write paths require it).
 */
export function deletableMedia(input: {
  eventId: number;
  proofUrls: string[];
  moneyUrls: string[];
  owner: Map<string, number | null>;
  unrecorded: Set<string>;
  purgedEvents: Set<number>;
  inClanFolder: (url: string) => boolean;
  usedElsewhere: Set<string>;
}): string[] {
  const { eventId, proofUrls, moneyUrls, owner, unrecorded, purgedEvents, inClanFolder, usedElsewhere } = input;
  const ownsProof = (u: string) => {
    if (unrecorded.has(u)) return true;
    const by = owner.get(u);
    return by != null && (by === eventId || purgedEvents.has(by));
  };
  return [
    ...proofUrls.filter((u) => !usedElsewhere.has(u) && ownsProof(u)),
    ...moneyUrls.filter((u) => !usedElsewhere.has(u) && inClanFolder(u)),
  ];
}
