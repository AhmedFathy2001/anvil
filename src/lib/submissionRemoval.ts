import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, events, submissions, teams, tiles } from '@/db/schema';
import { track } from '@/lib/analytics';
import { notifySubmissionDeleted } from '@/lib/discord';
import { syncDropTileCompletion } from '@/lib/submissions';
import { afterReply } from '@/lib/proofFinish';
import { removalNote } from '@/lib/discordPostEdit';
import { markCompletionPostsRemoved, markSubmissionPostsRemoved } from '@/lib/discordPostActions';

/**
 * Remove one submission the caller has already been cleared to remove, and do what follows it: the
 * team's completion on that tile is worked out again (a tile can drop back to open), the event's
 * Discord hears who removed it and why, and the analytics count it.
 *
 * The ONE path every surface deletes through — the web (DELETE /api/events/:id/submissions) and the
 * plugin's panel (lib/pluginUi) — so a removal from either behaves the same. Who may delete is the
 * caller's question, not this one's.
 */
export async function removeSubmission(opts: {
  submission: typeof submissions.$inferSelect;
  tile: typeof tiles.$inferSelect;
  clanId: number;
  deletedBy: string;
  deletedByRole: string;
  reason: string;
  /**
   * A credit reversed for want of its screenshot (lib/proofFinish): removed only while it is STILL
   * waiting (an upload that attached it a moment ago wins), and Discord hears nothing — it was never
   * posted. False when it was no longer waiting, and nothing else happens.
   */
  awaitingProof?: boolean;
}) {
  const { submission, tile } = opts;
  // clan-scope: global -- the submission was already matched to an event of the caller's clan.
  const [team, event, credit] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, submission.teamId) }),
    db.query.events.findFirst({ where: eq(events.id, tile.eventId) }),
    submission.creditPlayerId
      ? db.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, submission.creditPlayerId) })
      : Promise.resolve(null),
  ]);

  // Was the tile complete before? If the removal undoes it, its completion post is marked too.
  const wasComplete = !!(await db.query.completions.findFirst({ where: and(eq(completions.teamId, submission.teamId), eq(completions.tileId, tile.id)) }));
  const gone = await db.delete(submissions)
    .where(and(eq(submissions.id, submission.id), eq(submissions.tileId, tile.id), ...(opts.awaitingProof ? [isNotNull(submissions.proofDueAt)] : [])))
    .returning({ id: submissions.id });
  if (opts.awaitingProof && gone.length === 0) return false;
  const sync = await syncDropTileCompletion(submission.tileId, submission.teamId);

  if (team && event && !opts.awaitingProof) {
    // The post that announced it (lib/discordPosts) is edited to say it was removed and why, image
    // kept; one sent before posts were kept — or an edit Discord refuses — gets the short correction
    // post instead. After the reply: the removal never waits on Discord.
    const note = removalNote('removed', opts.reason);
    const correction = () => notifySubmissionDeleted({
      clanId: opts.clanId,
      eventName: event.name,
      tileLabel: tile.label,
      teamName: team.name,
      teamId: team.id,
      teamColor: team.color,
      creditPlayerName: credit?.name || null,
      amount: submission.amount,
      deletedBy: opts.deletedBy,
      deletedByRole: opts.deletedByRole,
      reason: opts.reason,
      eventId: event.id,
      tile,
    });
    const undone = wasComplete && !(await db.query.completions.findFirst({ where: and(eq(completions.teamId, submission.teamId), eq(completions.tileId, tile.id)) }));
    afterReply(async () => {
      await markSubmissionPostsRemoved(submission.id, note, correction);
      if (undone) await markCompletionPostsRemoved({ eventId: event.id, teamId: team.id, tileIds: [tile.id], action: 'edit', note });
    });
  }

  track('submission.removed', { clanId: opts.clanId, props: { by: opts.deletedByRole } });
  return sync;
}
