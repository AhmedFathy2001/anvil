import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { clans, huntDrops, weeklyCompetitions } from '@/db/schema';
import { del, isClanMediaUrl, isManagedMediaUrl, type MediaTenant } from '@/lib/storage';
import { urlsUsedElsewhere } from '@/lib/eventMediaRetention';
import { deliverPurgeNotice } from '@/lib/eventMediaNotice';
import { EXPIRED_PROOF_URL, deletableHuntFiles, effectivePurgeAt, isPurgeDue, purgeNoticeDue, type RetentionState } from '@/lib/eventMediaRetentionRules';
import { log } from '@/lib/logger';
import { ATTACHED_PREFIX } from '@/lib/proofAfter';

// Item hunt and Boss Rush media retention: the same 90 days and reminders as an event's proofs
// (lib/eventMediaRetention, rules in lib/eventMediaRetentionRules), for a 'hunt' weekly competition.
//
// What goes: drop screenshots (hunt_drops.screenshot_url). What stays: every drop row, who, what,
// when, its points and the standings. A purged URL becomes EXPIRED_PROOF_URL, which says so.
//
// A file is deleted only when it is in the clan's own storage folder (plugin uploads and member
// uploads land there; a pasted link is never ours) and no other competition's drop or any event's
// row still names it.

type Hunt = RetentionState & { id: number; title: string; clanId: number };

const huntCols = {
  id: weeklyCompetitions.id,
  title: weeklyCompetitions.title,
  clanId: weeklyCompetitions.clanId,
  endDate: weeklyCompetitions.endDate,
  mediaPurgeNoticeAt: weeklyCompetitions.mediaPurgeNoticeAt,
  mediaPurgeFinalNoticeAt: weeklyCompetitions.mediaPurgeFinalNoticeAt,
};

const withForce = <T extends { endDate: string }>(r: T): T & { forceEndedAt: null } => ({ ...r, forceEndedAt: null });

/**
 * One hunt's stored drop screenshots. Already-expired URLs are skipped. `stored`: the server wrote
 * this URL itself, uploading the plugin's screenshot for this drop (its proof key is marked used,
 * lib/huntDropPosts huntProofUpload). A manual proof's URL is whatever the member typed, so it is only
 * ever blanked, never deleted: it could name any file.
 */
export async function huntMediaUrls(competitionId: number): Promise<{ id: number; url: string; stored: boolean }[]> {
  // clan-scope: global -- one competition's own rows, by id; the caller settled which.
  const rows = await db
    .select({ id: huntDrops.id, url: huntDrops.screenshotUrl, proofKey: huntDrops.proofKey })
    .from(huntDrops)
    .where(and(eq(huntDrops.competitionId, competitionId), isNotNull(huntDrops.screenshotUrl)));
  // TODO(rush_death_shots): once migration 0296 adds rush_death_shots.screenshot_url, include its rows here and in purgeHuntMedia.
  return rows
    .filter((r): r is typeof r & { url: string } => !!r.url && r.url !== EXPIRED_PROOF_URL)
    .map((r) => ({ id: r.id, url: r.url, stored: !!r.proofKey?.startsWith(ATTACHED_PREFIX) }));
}

/** Hunts with a reminder due now. */
export async function huntsNeedingNotice(now: Date, limit = 20): Promise<(Hunt & { stage: 'first' | 'final' })[]> {
  // clan-scope: global -- retention applies to every clan's hunts alike.
  const rows = await db
    .select(huntCols)
    .from(weeklyCompetitions)
    .where(and(eq(weeklyCompetitions.type, 'hunt'), isNull(weeklyCompetitions.mediaPurgedAt), isNull(weeklyCompetitions.mediaPurgeFinalNoticeAt)));
  const out: (Hunt & { stage: 'first' | 'final' })[] = [];
  for (const r of rows.map(withForce)) {
    const stage = purgeNoticeDue(r, now);
    if (stage) out.push({ ...r, stage });
  }
  return out.slice(0, limit);
}

/** Send one hunt's due reminder and stamp it (stamped even when nobody could be told). */
export async function sendHuntPurgeNotice(h: Hunt & { stage: 'first' | 'final' }, now: Date, opts: { dryRun?: boolean } = {}) {
  const files = (await huntMediaUrls(h.id)).length;
  const stamped: RetentionState = h.stage === 'first' ? { ...h, mediaPurgeNoticeAt: now.toISOString() } : { ...h, mediaPurgeFinalNoticeAt: now.toISOString() };
  const purgeAt = effectivePurgeAt(stamped, now)!;
  const result = { competitionId: h.id, name: h.title, stage: h.stage, files, purgeAt: purgeAt.toISOString(), dms: 0, emails: 0, channel: false, dryRun: !!opts.dryRun };
  if (opts.dryRun) return result;
  if (files > 0) {
    Object.assign(result, await deliverPurgeNotice(h.clanId, { stage: h.stage, name: h.title, purgeAt, files, path: `/admin/events/weekly/${h.id}`, now, hunt: true }));
  }
  // clan-scope: global -- one competition, by id; the job settled which.
  await db
    .update(weeklyCompetitions)
    .set(h.stage === 'first' ? { mediaPurgeNoticeAt: now.toISOString() } : { mediaPurgeFinalNoticeAt: now.toISOString() })
    .where(eq(weeklyCompetitions.id, h.id));
  log.info('media-retention.hunt-notice', { competitionId: h.id, stage: h.stage, files, dms: result.dms, emails: result.emails, channel: result.channel });
  return result;
}

/** Hunts past their date and reminded in time, not purged yet. Oldest first, capped. */
export async function huntsDueForPurge(now: Date, limit = 20): Promise<{ id: number; name: string; purgeAt: Date }[]> {
  // clan-scope: global -- retention applies to every clan's hunts alike.
  const rows = await db
    .select(huntCols)
    .from(weeklyCompetitions)
    .where(and(eq(weeklyCompetitions.type, 'hunt'), isNull(weeklyCompetitions.mediaPurgedAt), isNotNull(weeklyCompetitions.mediaPurgeNoticeAt)));
  return rows
    .map(withForce)
    .filter((r) => isPurgeDue(r, now))
    .map((r) => ({ id: r.id, name: r.title, purgeAt: effectivePurgeAt(r, now)! }))
    .sort((a, b) => a.purgeAt.getTime() - b.purgeAt.getTime())
    .slice(0, limit);
}

/** Of these URLs, the ones another competition's drop names. */
async function namedByOtherHunts(competitionId: number, urls: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    // clan-scope: global -- looking across every competition for these exact URLs.
    const rows = await db
      .select({ url: huntDrops.screenshotUrl })
      .from(huntDrops)
      .where(and(ne(huntDrops.competitionId, competitionId), inArray(huntDrops.screenshotUrl, urls.slice(i, i + 500))));
    for (const r of rows) if (r.url) out.add(r.url);
  }
  return out;
}

/** Point one hunt's screenshots at EXPIRED_PROOF_URL, stamp it, then delete the files it owns. */
export async function purgeHuntMedia(competitionId: number, opts: { dryRun?: boolean } = {}) {
  // clan-scope: global -- the retention job walks every clan's ended hunts; that is what it is for.
  const [comp] = await db
    .select({ id: weeklyCompetitions.id, title: weeklyCompetitions.title, slug: clans.slug, kind: clans.kind })
    .from(weeklyCompetitions)
    .leftJoin(clans, eq(clans.id, weeklyCompetitions.clanId))
    .where(eq(weeklyCompetitions.id, competitionId));
  if (!comp) return null;
  const media = await huntMediaUrls(competitionId);
  const result = { competitionId, name: comp.title, files: media.length, dryRun: !!opts.dryRun };
  if (opts.dryRun) return result;
  await db.transaction(async (tx) => {
    if (media.length) await tx.update(huntDrops).set({ screenshotUrl: EXPIRED_PROOF_URL }).where(inArray(huntDrops.id, media.map((m) => m.id)));
    await tx.update(weeklyCompetitions).set({ mediaPurgedAt: new Date().toISOString() }).where(eq(weeklyCompetitions.id, competitionId));
  });
  const tenant: MediaTenant | null = comp.slug ? { slug: comp.slug, kind: comp.kind } : null;
  const urls = media.filter((m) => isManagedMediaUrl(m.url));
  if (urls.length && tenant) {
    const list = urls.map((m) => m.url);
    const elsewhere = new Set([...(await namedByOtherHunts(competitionId, list)), ...(await urlsUsedElsewhere(null, list))]);
    const gone = deletableHuntFiles(urls, (u) => isClanMediaUrl(u, tenant), elsewhere);
    for (let i = 0; i < gone.length; i += 100) {
      await del(gone.slice(i, i + 100)).catch((e) => log.warn('media-retention.hunt-delete-failed', { competitionId, error: (e as Error).message }));
    }
  }
  return result;
}
