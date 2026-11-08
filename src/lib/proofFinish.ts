/**
 * What follows a proof's picture: the site-drawn stamp and the Discord post that shows it — and, for
 * a credit filed before its picture (lib/proofAfter), the reversal when the picture never came.
 *
 * stampAndPost is the ONE place both paths run it: the submissions route right after the reply when
 * the picture came with the credit (every older plugin), and POST /api/plugin/facts/proof once a
 * waiting credit's picture arrives. A reversed credit never reaches it, so it is never posted.
 */
import crypto from 'crypto';
import { and, asc, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { after } from 'next/server';

import { db } from '@/db';
import { clans, eventParticipants, events, proofUploads, submissions, teams, tiles } from '@/db/schema';
import { notifySubmission } from '@/lib/discord';
import { flushPendingNotifications, queueSubmissionNotification } from '@/lib/notifications';
import { PROOF_REVERSAL_REASON } from '@/lib/proofAfter';
import { gameLines, stampModel, type ProofClaims } from '@/lib/proofStamp';
import { bakeStamp } from '@/lib/proofStampImage';
import { clanMediaKey, put } from '@/lib/storage';
import { removeSubmission } from '@/lib/submissionRemoval';

/** Run `work` after the reply; outside a request (a script, a test) just start it. */
export function afterReply(work: () => Promise<unknown>): void {
  try {
    after(work);
  } catch {
    void work().catch(() => {});
  }
}

export interface StampAndPost {
  submissionId: number;
  clanId: number;
  event: { id: number; name: string };
  tile: typeof tiles.$inferSelect;
  team: Pick<typeof teams.$inferSelect, 'id' | 'name' | 'color'>;
  /** The banner's claims; null = no stamp (a web upload, or a plugin that baked its own). */
  claims: ProofClaims | null;
  imageUrl: string | null;
  /** The picture's proof_uploads row: only a picture this site stored itself is fetched to stamp. */
  upload: { userId: number | null; sha256: string } | null;
  rsn: string | null;
  receivedAt: number;
  isCap: boolean;
  /** A clog row that replaced the live unlock push's bare row: that slot was announced already. */
  superseded: boolean;
  completed: boolean;
  creditPlayerName: string | null;
  currentTotal: number;
  amount: number;
  note: string | null;
  durationSeconds: number | null;
}

/**
 * SITE-DRAWN STAMP, then the post. A current plugin uploads the clean frame and says what the banner
 * should read; it is drawn after the insert so it can carry the proof id. The stamped copy becomes
 * imageUrl, so every view and Discord post shows it unchanged; the clean frame stays for "Hide stamp".
 * Any failure leaves the clean frame as the proof — a missing banner never costs a credit. Never throws.
 */
export async function stampAndPost(i: StampAndPost): Promise<void> {
  let imageUrl = i.imageUrl;
  try {
    if (i.claims && imageUrl) {
      const facts = { ...i.claims, chat: undefined, lines: gameLines(i.claims), receivedAt: i.receivedAt };
      try {
        // Only a picture this site stored itself (a proof_uploads row on a managed host), and no
        // redirects — the URL is client-supplied, so it must never become a fetch of somewhere else.
        if (!i.upload) throw new Error('no upload record for this image');
        const res = await fetch(imageUrl, { redirect: 'error' });
        if (!res.ok) throw new Error(`clean frame fetch ${res.status}`);
        const clean = Buffer.from(await res.arrayBuffer());
        const stamped = await bakeStamp(clean, stampModel({
          claims: i.claims, rsn: i.rsn, team: i.team.name, event: i.event.name,
          receivedAt: i.receivedAt, submissionId: i.submissionId, sha256: i.upload.sha256,
        }));
        const slug = (await db.query.clans.findFirst({ where: eq(clans.id, i.clanId), columns: { slug: true } }))?.slug;
        const { url } = await put(clanMediaKey(slug, `submissions/${crypto.randomUUID()}-stamped.webp`), stamped, 'image/webp');
        // Registered as a stamp, so posting this copy back as a fresh proof reads as foreign.
        await db.insert(proofUploads).values({
          url, sha256: crypto.createHash('sha256').update(stamped).digest('hex'), via: 'stamp', userId: i.upload.userId, eventId: i.event.id,
        }).onConflictDoNothing();
        await db.update(submissions)
          .set({ imageUrl: url, cleanImageUrl: imageUrl, proofFacts: JSON.stringify(facts) })
          .where(eq(submissions.id, i.submissionId));
        imageUrl = url;
      } catch (e) {
        console.error('[submissions] stamp failed; keeping the clean frame', e);
        await db.update(submissions).set({ proofFacts: JSON.stringify(facts) }).where(eq(submissions.id, i.submissionId));
      }
    }

    if (i.isCap) {
      // A cap counter's credits (energy) aren't the tile's progress: no per-ping post of their own. The
      // ping that lifts the cap far enough to finish the tile posts nothing either — the tile's own
      // proof-carrying search does, once it lands (lib/submissions holds the credit until then).
      flushPendingNotifications().catch(() => {});
    } else if (i.tile.tileType === 'timed') {
      // Timed clears are discrete, rare, and carry a clear-time the merged embed can't express — post
      // them immediately, unchanged.
      notifySubmission({
        clanId: i.clanId,
        eventName: i.event.name || 'Unknown Event',
        tileLabel: i.tile.label,
        teamName: i.team.name,
        teamId: i.team.id,
        teamColor: i.team.color,
        creditPlayerName: i.creditPlayerName,
        amount: i.amount,
        currentTotal: i.currentTotal,
        requiredAmount: i.tile.requiredAmount,
        note: i.note,
        imageUrl,
        tileType: i.tile.tileType,
        durationSeconds: i.durationSeconds,
        completed: i.completed,
        eventId: i.event.id,
        tile: i.tile,
      }).catch(() => {}); // Silently ignore errors
    } else if (i.superseded && !i.completed) {
      // The slot was already announced when the live unlock push credited it; this only added its proof.
    } else {
      // Drop/kill: debounce. Buffer into the (tile,team) bucket — a completing submission flushes its
      // own bucket inside queueSubmissionNotification; the opportunistic flush posts any *other* buckets
      // that have gone quiet.
      await queueSubmissionNotification({
        eventId: i.event.id,
        tileId: i.tile.id,
        teamId: i.team.id,
        amount: i.amount,
        currentTotal: i.currentTotal,
        requiredAmount: i.tile.requiredAmount,
        imageUrl,
        note: i.note,
        creditPlayerName: i.creditPlayerName,
        completed: i.completed,
      });
      flushPendingNotifications().catch(() => {});
    }
  } catch (e) {
    console.error('[submissions] after the reply', e);
  }
}

/** The credit player's name for a post. */
export async function participantName(id: number | null): Promise<string | null> {
  if (!id) return null;
  const p = await db.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, id), columns: { name: true } });
  return p?.name || null;
}

/**
 * Reverse up to `limit` credits whose screenshot never came (proof_due_at passed): each removed
 * through the one removal path, which works the tile's completion out again (the live push then shows
 * the count dropping) — and, being reversed, never posted to Discord. `ids` narrows it to those rows
 * (the proof route reverses its own late key at once). Returns the labels of the tiles reversed.
 */
export async function sweepOverdueProofs(now = Date.now(), limit = 25, ids?: number[]): Promise<string[]> {
  // clan-scope: global -- a system sweep; each row is removed under its own event's clan.
  const due = await db.select().from(submissions)
    .where(and(isNotNull(submissions.proofDueAt), lte(submissions.proofDueAt, new Date(now).toISOString()), ...(ids?.length ? [inArray(submissions.id, ids)] : [])))
    .orderBy(asc(submissions.proofDueAt))
    .limit(limit);
  const labels: string[] = [];
  for (const submission of due) {
    try {
      const tile = await db.query.tiles.findFirst({ where: eq(tiles.id, submission.tileId) });
      const event = tile ? await db.query.events.findFirst({ where: eq(events.id, tile.eventId), columns: { clanId: true } }) : null;
      if (!tile || !event) continue;
      const sync = await removeSubmission({
        submission, tile, clanId: event.clanId, deletedBy: 'Anvil', deletedByRole: 'system', reason: PROOF_REVERSAL_REASON, awaitingProof: true,
      });
      if (sync !== false) {
        labels.push(tile.label);
        console.info('[proof-after] reversed', { submission: submission.id, tile: tile.id, team: submission.teamId });
      }
    } catch (e) {
      console.error('[proof-after] reversal failed', { submission: submission.id }, e);
    }
  }
  return labels;
}
