/**
 * Item hunt drops on Discord, and the plugin's screenshot of them: the database half (lib/huntDropPost
 * is the pure one).
 *
 *   - A drop is posted the moment it COUNTS: a plugin report filed as counted, a staff "Add a drop", or
 *     a held report or member's proof that staff confirm. posted_at is claimed with a conditional
 *     UPDATE before anything is sent, so two callers (a double click, a retry) post it once.
 *   - A plugin drop's screenshot arrives under the key its moments reply named (POST
 *     /api/plugin/facts/proof, huntProofUpload). It is stored on the drop and added to the post, if
 *     there is one. UNLIKE A BINGO CREDIT, nothing is ever reversed for a missing screenshot: a plugin
 *     that never sends one (any older plugin) leaves the key unused and the drop exactly as it was.
 *
 * Every Discord failure is logged and swallowed: no plugin request ever fails because Discord did.
 */
import crypto from 'crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clans, huntDrops, proofUploads, rushDeathShots, weeklyCompetitions, weeklyParticipants, type HuntDropRow } from '@/db/schema';
import { resolvePluginMember } from '@/lib/auth';
import { parseStamp } from '@/lib/dbTime';
import { deleteWeeklyHuntDrop, notifyWeeklyHuntDrop } from '@/lib/discord';
import { HUNT_DROP_POSTS_KEY, huntDropPostable, huntProofOpen, type HuntDropPost } from '@/lib/huntDropPost';
import { defaultHuntTitle, dropOriginWords, dropStatWords, huntIconUrl, huntKindWord, isRush, parseHunt } from '@/lib/itemHunt';
import { huntStampModel } from '@/lib/huntStamp';
import { huntDropStanding } from '@/lib/itemHuntDb';
import { log } from '@/lib/logger';
import { attachedKeyMark } from '@/lib/proofAfter';
import type { StampModel } from '@/lib/proofStamp';
import { bakeStamp } from '@/lib/proofStampImage';
import { getSetting } from '@/lib/settings';
import { clanMediaKey, put } from '@/lib/storage';
import { stripImageMetadata } from '@/lib/stripImageMetadata';
import { switchOn } from '@/lib/weeklyDaily';

type Competition = typeof weeklyCompetitions.$inferSelect;

/** What lib/itemHuntDb hands over once drops count ('post') or are turned down ('retract'). Never throws. */
export async function afterHuntDrops(ids: number[], what: 'post' | 'retract'): Promise<void> {
  for (const id of ids) {
    try {
      if (what === 'post') await announceHuntDrop(id);
      else await retractHuntDrop(id);
    } catch (err) {
      log.warn('hunt.post-failed', { dropId: id, what }, err);
    }
  }
}

async function competitionOf(row: HuntDropRow): Promise<Competition | null> {
  // clan-scope: global -- the drop's own competition, by the id on the row.
  const [comp] = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, row.competitionId));
  return comp?.type === 'hunt' ? comp : null;
}

/** The post for one drop, with its standing as of that drop. Null when it is not a readable hunt drop. */
async function postFor(comp: Competition, row: HuntDropRow): Promise<HuntDropPost | null> {
  const standing = await huntDropStanding(comp, row.id);
  if (!standing) return null;
  const { config, drop } = standing;
  return {
    clanId: comp.clanId,
    title: comp.title || defaultHuntTitle(config),
    kind: huntKindWord(config),
    rule: config.rule,
    huntIconUrl: huntIconUrl(config),
    rsn: standing.row?.rsn ?? row.rsn,
    itemId: drop.itemId,
    itemName: drop.itemName,
    quantity: drop.quantity,
    source: drop.source,
    stat: dropStatWords(drop),
    origin: dropOriginWords(drop),
    count: standing.row?.count ?? 0,
    place: standing.row && standing.row.count > 0 ? standing.row.rank : null,
    endDate: comp.endDate,
    imageUrl: row.screenshotUrl,
    bounty: standing.bounty
      ? { place: standing.bounty.place, itemName: standing.bounty.itemName, amount: standing.bounty.amount, hcw: comp.prizeCurrency === 'hcw' }
      : null,
  };
}

/** Post one counted drop, once. Returns whether this call posted it. */
export async function announceHuntDrop(dropId: number): Promise<boolean> {
  // clan-scope: global -- one drop by id; its competition names the clan the post goes to.
  const [row] = await db.select().from(huntDrops).where(eq(huntDrops.id, dropId));
  if (!row || !huntDropPostable(row)) return false;
  const comp = await competitionOf(row);
  if (!comp) return false;
  // The clan's own switch (Discord settings, Competition posts). Claimed either way: a drop that was
  // not posted when it counted is not posted later, when it is old news.
  const on = switchOn(await getSetting(comp.clanId, HUNT_DROP_POSTS_KEY));
  const claimed = await db
    .update(huntDrops)
    .set({ postedAt: new Date().toISOString() })
    .where(and(eq(huntDrops.id, row.id), eq(huntDrops.status, 'counted'), isNull(huntDrops.postedAt)))
    .returning();
  if (claimed.length === 0 || !on) return false;
  const post = await postFor(comp, claimed[0]);
  if (!post) return false;
  const sent = await notifyWeeklyHuntDrop(post);
  if (sent.messageId) await db.update(huntDrops).set({ discordMessageId: sent.messageId }).where(eq(huntDrops.id, row.id));
  if (sent.status === 'failed') log.warn('hunt.post-failed', { dropId: row.id, competitionId: comp.id });
  return sent.status === 'sent';
}

/** The screenshot has landed: add it to the drop's post (posted fresh with it when the message has gone). */
export async function showHuntDropImage(dropId: number): Promise<void> {
  // clan-scope: global -- one drop by id, its screenshot just attached by its own character.
  const [row] = await db.select().from(huntDrops).where(eq(huntDrops.id, dropId));
  if (!row?.discordMessageId || row.status !== 'counted' || !row.screenshotUrl) return;
  const comp = await competitionOf(row);
  const post = comp ? await postFor(comp, row) : null;
  if (!post) return;
  const sent = await notifyWeeklyHuntDrop(post, row.discordMessageId);
  if (sent.messageId && sent.messageId !== row.discordMessageId) {
    await db.update(huntDrops).set({ discordMessageId: sent.messageId }).where(eq(huntDrops.id, row.id));
  }
}

/** A drop turned down after it was posted: its post comes down. */
async function retractHuntDrop(dropId: number): Promise<void> {
  // clan-scope: global -- one drop by id; its competition names the clan whose channel holds the post.
  const [row] = await db.select().from(huntDrops).where(eq(huntDrops.id, dropId));
  if (!row?.discordMessageId || row.status !== 'rejected') return;
  const comp = await competitionOf(row);
  if (!comp) return;
  await deleteWeeklyHuntDrop(comp.clanId, row.discordMessageId);
  await db.update(huntDrops).set({ discordMessageId: null }).where(eq(huntDrops.id, row.id));
}

const SHOT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Store the plugin's screenshot of a hunt drop, re-encoded the way every proof is (/api/upload: the
 * metadata dropped, at most 1600px, WebP), in the clan's media folder. Stored here rather than through
 * /api/upload, which takes a plugin token only with a bingo seat: a hunt needs no board.
 */
async function storeHuntShot(
  clanId: number,
  userId: number,
  file: File,
  stamp: (sha256: string) => StampModel,
): Promise<{ url: string; cleanUrl: string | null } | { status: number; error: string }> {
  if (file.size > SHOT_MAX_BYTES) return { status: 400, error: 'File too large. Max 10MB' };
  const clean = await stripImageMetadata(Buffer.from(await file.arrayBuffer()), { maxDimension: 1600, quality: 80, onUnreadable: 'refuse' });
  if (!clean) return { status: 400, error: 'That image could not be read' };
  try {
    const tenant = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { slug: true, kind: true } });
    const keep = async (bytes: Buffer, ext: string, type: string) => {
      const { url } = await put(clanMediaKey(tenant, `hunts/${crypto.randomUUID()}.${ext}`), bytes, type);
      await db
        .insert(proofUploads)
        .values({ url, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), via: 'plugin', userId })
        .onConflictDoNothing()
        .catch((err) => log.warn('hunt.proof-provenance-failed', {}, err));
      return url;
    };
    const cleanUrl = await keep(clean.bytes, clean.ext, clean.contentType ?? 'image/webp');
    // The stamp the site draws, like a bingo proof's (lib/huntStamp): the clean frame is kept beside it.
    // A frame the stamp cannot be drawn on is still stored, plain.
    const sha = crypto.createHash('sha256').update(clean.bytes).digest('hex');
    const stamped = await bakeStamp(clean.bytes, stamp(sha)).catch((err) => {
      log.warn('hunt.stamp-failed', { clanId }, err);
      return null;
    });
    if (!stamped) return { url: cleanUrl, cleanUrl: null };
    return { url: await keep(stamped, 'webp', 'image/webp'), cleanUrl };
  } catch (err) {
    log.warn('hunt.proof-store-failed', { clanId }, err);
    return { status: 503, error: 'Image upload failed' };
  }
}

/**
 * POST /api/plugin/facts/proof for an item hunt drop's key. Null when the key is no hunt drop's (the
 * route goes on to the bingo credits). The caller must be the drop's own character: the same seat
 * (token + character) that reported it. Answers like the bingo upload: 200 attached 1, 200 attached 0
 * for a repeat, 404 for someone else's, 410 when it is too late or the drop was turned down.
 * A refusal changes nothing about the drop.
 */
export async function huntProofUpload(request: Request, key: string, file: File | null): Promise<Response | null> {
  // clan-scope: global -- found by an unguessable key, then checked against the caller's own seat.
  const [row] = await db.select().from(huntDrops).where(inArray(huntDrops.proofKey, [key, attachedKeyMark(key)])).limit(1);
  if (!row) return rushDeathShotUpload(request, key, file);
  const member = await resolvePluginMember(request);
  if (!member || member.clanMemberId !== row.clanMemberId) return Response.json({ error: 'Not found' }, { status: 404 });
  if (row.proofKey !== key) return Response.json({ ok: true, attached: 0 });
  if (!huntProofOpen({ status: row.status, createdAtMs: parseStamp(row.createdAt) }, Date.now())) {
    return Response.json({ error: 'Too late for this drop’s screenshot. The drop still counts.' }, { status: 410 });
  }
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
  const comp = await competitionOf(row);
  if (!comp) return Response.json({ error: 'Not found' }, { status: 404 });
  const rush = isRush(parseHunt(comp.hunt));
  const stored = await storeHuntShot(comp.clanId, member.userId, file, (sha256) =>
    huntStampModel({
      kind: 'drop', competition: comp.title, rush, rsn: row.rsn, item: row.itemName, quantity: row.quantity, source: row.source,
      recordedAt: parseStamp(row.createdAt) ?? Date.now(), stampedAt: Date.now(), id: row.id, sha256, split: 0.5,
    }),
  );
  if ('error' in stored) return Response.json({ error: stored.error }, { status: stored.status });
  // Only status-free columns change: a screenshot never moves a drop in or out of the standings.
  const attached = await db
    .update(huntDrops)
    .set({ screenshotUrl: stored.url, cleanScreenshotUrl: stored.cleanUrl, proofKey: attachedKeyMark(key) })
    .where(and(eq(huntDrops.id, row.id), eq(huntDrops.proofKey, key)))
    .returning({ id: huntDrops.id });
  if (attached.length === 0) return Response.json({ ok: true, attached: 0 });
  void showHuntDropImage(row.id).catch((err) => log.warn('hunt.post-image-failed', { dropId: row.id }, err));
  return Response.json({ ok: true, attached: 1 });
}

/**
 * A Boss Rush death's screenshot, under the key the moments reply named for it (lib/itemHuntDb
 * recordRushDeath). Seen by the player and staff only; it changes nothing about the score.
 */
async function rushDeathShotUpload(request: Request, key: string, file: File | null): Promise<Response | null> {
  // clan-scope: global -- found by an unguessable key, then checked against the caller's own seat.
  const [row] = await db.select().from(rushDeathShots).where(inArray(rushDeathShots.proofKey, [key, attachedKeyMark(key)])).limit(1);
  if (!row) return null;
  const member = await resolvePluginMember(request);
  if (!member || member.clanMemberId !== row.clanMemberId) return Response.json({ error: 'Not found' }, { status: 404 });
  if (row.proofKey !== key) return Response.json({ ok: true, attached: 0 });
  if (!huntProofOpen({ status: 'counted', createdAtMs: parseStamp(row.createdAt) }, Date.now())) {
    return Response.json({ error: 'Too late for this death’s screenshot. The death still counts.' }, { status: 410 });
  }
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
  const [comp] = await db.select({ clanId: weeklyCompetitions.clanId, title: weeklyCompetitions.title }).from(weeklyCompetitions).where(eq(weeklyCompetitions.id, row.competitionId)).limit(1);
  if (!comp) return Response.json({ error: 'Not found' }, { status: 404 });
  const [seat] = await db.select({ rsn: weeklyParticipants.rsn }).from(weeklyParticipants).where(eq(weeklyParticipants.id, row.participantId)).limit(1);
  const stored = await storeHuntShot(comp.clanId, member.userId, file, (sha256) =>
    huntStampModel({
      kind: 'death', competition: comp.title, rush: true, rsn: seat?.rsn ?? 'Unknown', source: row.source,
      recordedAt: parseStamp(row.createdAt) ?? Date.now(), stampedAt: Date.now(), id: row.id, sha256, split: null,
    }),
  );
  if ('error' in stored) return Response.json({ error: stored.error }, { status: stored.status });
  const attached = await db
    .update(rushDeathShots)
    .set({ screenshotUrl: stored.url, cleanScreenshotUrl: stored.cleanUrl, proofKey: attachedKeyMark(key) })
    .where(and(eq(rushDeathShots.id, row.id), eq(rushDeathShots.proofKey, key)))
    .returning({ id: rushDeathShots.id });
  return Response.json({ ok: true, attached: attached.length });
}
