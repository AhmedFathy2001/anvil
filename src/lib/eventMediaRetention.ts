import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { clans, eventSignups, eventStartProofs, events, payouts, signupFees, submissionAttachments, submissions, tiles } from '@/db/schema';
import { del, isClanMediaUrl, isManagedMediaUrl } from '@/lib/storage';
import { uploadOwnership } from '@/lib/uploadClaims';
import { log } from '@/lib/logger';
import { EXPIRED_PROOF_URL, deletableMedia, effectivePurgeAt, isPurgeDue } from '@/lib/eventMediaRetentionRules';

// Event media retention: 90 days after an event ends, its stored images are deleted.
//
// What goes: the files — submission screenshots, sign-up fee and payout payment proofs, starting
// shots. What stays: everything they were evidence FOR. The event, tiles, teams, completions, every
// submission row with who, when and for what, fee and payout records — the history a clan looks back
// on, the Hall of Records and recaps all read rows, never pictures. A clan that wants the pictures
// downloads the event archive first (/api/admin/events/[id]/archive); the event admin page says when,
// and the owner and admins are reminded 14 and 3 days ahead (lib/eventMediaNotice). Nothing is
// deleted sooner than a week after the first reminder.
//
// Each deleted URL is replaced with EXPIRED_PROOF_URL, a site image that SAYS the proof was deleted
// after 90 days. Every page that shows a proof therefore explains itself instead of drawing a broken
// image, with no per-page special case.

export { EXPIRED_PROOF_URL, eventMediaPurgeAt, effectivePurgeAt, MEDIA_RETENTION_DAYS } from '@/lib/eventMediaRetentionRules';

export interface EventMediaUrls {
  submissions: { id: number; url: string }[];
  fees: { id: number; url: string }[];
  payouts: { id: number; url: string }[];
  startProofs: { id: number; url: string }[];
  /** Extra screenshots on proofs and saved start shots (lib/proofAttachments); links are not files. */
  attachments: { id: number; url: string }[];
  /** The untouched frame under a site-drawn stamp (submissions.cleanImageUrl). */
  cleanFrames: { id: number; url: string }[];
}

const isStored = (u: string | null): u is string => !!u && u !== EXPIRED_PROOF_URL;

/** Every stored image an event holds, by where it is referenced. Already-expired URLs are skipped. */
export async function eventMediaUrls(eventId: number): Promise<EventMediaUrls> {
  // clan-scope: global -- one event's own rows, by id; the caller settled which event.
  const [subs, fees, pays, starts, extras, clean] = await Promise.all([
    db
      .select({ id: submissions.id, url: submissions.imageUrl })
      .from(submissions)
      .innerJoin(tiles, eq(tiles.id, submissions.tileId))
      .where(and(eq(tiles.eventId, eventId), isNotNull(submissions.imageUrl))),
    db
      .select({ id: signupFees.id, url: signupFees.proofBlobUrl })
      .from(signupFees)
      .innerJoin(eventSignups, eq(eventSignups.id, signupFees.signupId))
      .where(and(eq(eventSignups.eventId, eventId), isNotNull(signupFees.proofBlobUrl))),
    db
      .select({ id: payouts.id, url: payouts.proofBlobUrl })
      .from(payouts)
      .where(and(eq(payouts.eventId, eventId), isNotNull(payouts.proofBlobUrl))),
    db
      .select({ id: eventStartProofs.id, url: eventStartProofs.imageUrl })
      .from(eventStartProofs)
      .where(eq(eventStartProofs.eventId, eventId)),
    db
      .select({ id: submissionAttachments.id, url: submissionAttachments.url })
      .from(submissionAttachments)
      .innerJoin(tiles, eq(tiles.id, submissionAttachments.tileId))
      .where(and(eq(tiles.eventId, eventId), eq(submissionAttachments.kind, 'image'))),
    db
      .select({ id: submissions.id, url: submissions.cleanImageUrl })
      .from(submissions)
      .innerJoin(tiles, eq(tiles.id, submissions.tileId))
      .where(and(eq(tiles.eventId, eventId), isNotNull(submissions.cleanImageUrl))),
  ]);
  const keep = <T extends { url: string | null }>(rows: T[]) =>
    rows.filter((r): r is T & { url: string } => isStored(r.url));
  return { submissions: keep(subs), fees: keep(fees), payouts: keep(pays), startProofs: keep(starts), attachments: keep(extras), cleanFrames: keep(clean) };
}

export interface PurgeResult {
  eventId: number;
  eventName: string;
  files: number;
  bySource: { submissions: number; fees: number; payouts: number; startProofs: number; attachments: number; cleanFrames: number };
  dryRun: boolean;
}

/**
 * Delete one event's stored images and point their rows at EXPIRED_PROOF_URL, then stamp the event.
 * Rows are updated before the files go, so a crash part-way leaves an orphaned file in the bucket
 * (harmless, and the next run's URL list no longer names it) rather than a row pointing at nothing.
 */
export async function purgeEventMedia(eventId: number, opts: { dryRun?: boolean } = {}): Promise<PurgeResult | null> {
  // clan-scope: global -- the retention job walks every clan's ended events; that is what it is for.
  const [event] = await db
    .select({ id: events.id, name: events.name, clanSlug: clans.slug })
    .from(events)
    .leftJoin(clans, eq(clans.id, events.clanId))
    .where(eq(events.id, eventId));
  if (!event) return null;
  const media = await eventMediaUrls(eventId);
  const bySource = {
    submissions: media.submissions.length,
    fees: media.fees.length,
    payouts: media.payouts.length,
    startProofs: media.startProofs.length,
    attachments: media.attachments.length,
    cleanFrames: media.cleanFrames.length,
  };
  const files = Object.values(bySource).reduce((a, b) => a + b, 0);
  if (opts.dryRun) return { eventId, eventName: event.name, files, bySource, dryRun: true };

  const ids = (rows: { id: number }[]) => rows.map((r) => r.id);
  await db.transaction(async (tx) => {
    if (media.submissions.length) {
      await tx.update(submissions).set({ imageUrl: EXPIRED_PROOF_URL }).where(inArray(submissions.id, ids(media.submissions)));
    }
    if (media.fees.length) {
      await tx.update(signupFees).set({ proofBlobUrl: EXPIRED_PROOF_URL }).where(inArray(signupFees.id, ids(media.fees)));
    }
    if (media.payouts.length) {
      await tx.update(payouts).set({ proofBlobUrl: EXPIRED_PROOF_URL }).where(inArray(payouts.id, ids(media.payouts)));
    }
    if (media.startProofs.length) {
      await tx
        .update(eventStartProofs)
        .set({ imageUrl: EXPIRED_PROOF_URL })
        .where(inArray(eventStartProofs.id, ids(media.startProofs)));
    }
    if (media.attachments.length) {
      await tx
        .update(submissionAttachments)
        .set({ url: EXPIRED_PROOF_URL })
        .where(inArray(submissionAttachments.id, ids(media.attachments)));
    }
    if (media.cleanFrames.length) {
      await tx.update(submissions).set({ cleanImageUrl: null }).where(inArray(submissions.id, ids(media.cleanFrames)));
    }
    await tx.update(events).set({ mediaPurgedAt: new Date().toISOString() }).where(eq(events.id, eventId));
  });

  // Delete only what this event provably owns (deletableMedia says how).
  const managed = (rows: { url: string }[]) => [...new Set(rows.map((r) => r.url).filter((u) => isManagedMediaUrl(u)))];
  const proofUrls = managed([...media.submissions, ...media.cleanFrames, ...media.startProofs, ...media.attachments]);
  const moneyUrls = managed([...media.fees, ...media.payouts]);
  const { claimed, unrecorded } = await uploadOwnership(proofUrls, eventId);
  const urls = deletableMedia({
    proofUrls,
    moneyUrls,
    claimed,
    unrecorded,
    inClanFolder: (u) => !!event.clanSlug && isClanMediaUrl(u, event.clanSlug),
    usedElsewhere: await urlsUsedElsewhere(eventId, [...unrecorded, ...moneyUrls]),
  });
  const kept = proofUrls.length + moneyUrls.length - urls.length;
  if (kept) log.warn('media-retention.unowned-files-kept', { eventId, count: kept });
  for (let i = 0; i < urls.length; i += 100) {
    await del(urls.slice(i, i + 100)).catch((e) =>
      log.warn('media-retention.delete-failed', { eventId, error: (e as Error).message }),
    );
  }
  return { eventId, eventName: event.name, files, bySource, dryRun: false };
}

/**
 * Events whose media is due for deletion: past the retention date AND the clan was reminded at least
 * a week before (lib/eventMediaRetentionRules isPurgeDue), not purged yet. Oldest first, capped so
 * one run stays bounded.
 */
export async function eventsDueForPurge(now: Date, limit = 20): Promise<{ id: number; name: string; purgeAt: Date }[]> {
  // clan-scope: global -- retention applies to every clan's events alike.
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      mediaPurgeNoticeAt: events.mediaPurgeNoticeAt,
      mediaPurgeFinalNoticeAt: events.mediaPurgeFinalNoticeAt,
    })
    .from(events)
    .where(and(isNull(events.mediaPurgedAt), isNotNull(events.mediaPurgeNoticeAt)));
  return rows
    .filter((r) => isPurgeDue(r, now))
    .map((r) => ({ id: r.id, name: r.name, purgeAt: effectivePurgeAt(r, now)! }))
    .sort((a, b) => a.purgeAt.getTime() - b.purgeAt.getTime())
    .slice(0, limit);
}

/** Of these URLs, the ones some OTHER event's proof, fee, payout, start shot or attachment names. */
async function urlsUsedElsewhere(eventId: number, urls: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    const chunk = urls.slice(i, i + 500);
    // clan-scope: global -- the point is to look across every clan's events for these exact URLs.
    const found = await Promise.all([
      db.select({ url: submissions.imageUrl }).from(submissions).innerJoin(tiles, eq(tiles.id, submissions.tileId))
        .where(and(ne(tiles.eventId, eventId), inArray(submissions.imageUrl, chunk))),
      db.select({ url: submissions.cleanImageUrl }).from(submissions).innerJoin(tiles, eq(tiles.id, submissions.tileId))
        .where(and(ne(tiles.eventId, eventId), inArray(submissions.cleanImageUrl, chunk))),
      db.select({ url: submissionAttachments.url }).from(submissionAttachments).innerJoin(tiles, eq(tiles.id, submissionAttachments.tileId))
        .where(and(ne(tiles.eventId, eventId), inArray(submissionAttachments.url, chunk))),
      db.select({ url: eventStartProofs.imageUrl }).from(eventStartProofs)
        .where(and(ne(eventStartProofs.eventId, eventId), inArray(eventStartProofs.imageUrl, chunk))),
      db.select({ url: signupFees.proofBlobUrl }).from(signupFees).innerJoin(eventSignups, eq(eventSignups.id, signupFees.signupId))
        .where(and(ne(eventSignups.eventId, eventId), inArray(signupFees.proofBlobUrl, chunk))),
      db.select({ url: payouts.proofBlobUrl }).from(payouts)
        .where(and(ne(payouts.eventId, eventId), inArray(payouts.proofBlobUrl, chunk))),
    ]);
    for (const rows of found) for (const r of rows) if (r.url) out.add(r.url);
  }
  return out;
}
