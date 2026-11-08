import { deleteWebhookMessage, editWebhookMessage, getWebhookMessage } from '@/lib/discord';
import { markPostDeleted, markPostEdited, postsForCompletions, postsForSubmission, type DiscordPostRow } from '@/lib/discordPosts';
import { removedMessage, type PostEmbed } from '@/lib/discordPostEdit';
import { log } from '@/lib/logger';

/**
 * Acting on board posts Anvil kept (lib/discordPosts) once what they announced is gone:
 *   edit   — strike the title, lead with "Removed by an admin: <reason>", keep the image;
 *   delete — remove the message.
 * When there is no stored post (one sent before ids were kept) or Discord refuses, `fallback` runs
 * once — the short correction post the caller would otherwise have sent. Rate limits are the shared
 * webhook helpers'. Callers run this after the reply (lib/proofFinish afterReply), never in it.
 */
export async function actOnPosts(
  rows: DiscordPostRow[],
  opts: { action: 'edit' | 'delete'; note: string; fallback?: () => Promise<unknown>; partialFor?: number },
): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (opts.action === 'delete') {
        if (await deleteWebhookMessage(row.webhookUrl, row.messageId)) {
          await markPostDeleted(row.id);
          done++;
        } else failed++;
        continue;
      }
      const message = await getWebhookMessage(row.webhookUrl, row.messageId);
      if (!message) {
        failed++;
        continue;
      }
      // A merged post that carried other submissions too: say part of it went, don't strike it all.
      const partial = opts.partialFor != null && row.submissionIds.length > 1;
      const note = partial ? `Part of this post (one submission) — ${opts.note.charAt(0).toLowerCase()}${opts.note.slice(1)}` : opts.note;
      if (await editWebhookMessage(row.webhookUrl, row.messageId, removedMessage(message as { embeds?: PostEmbed[] }, note, partial))) {
        await markPostEdited(row.id);
        done++;
      } else failed++;
    } catch (error) {
      failed++;
      log.warn('discord-posts.act-fail', { postId: row.id, action: opts.action }, error);
    }
  }
  if (opts.fallback && (rows.length === 0 || failed > 0)) await opts.fallback().catch(() => {});
  return { done, failed };
}

/** A removed submission: edit the post(s) that carried it. */
export async function markSubmissionPostsRemoved(submissionId: number, note: string, fallback?: () => Promise<unknown>) {
  return actOnPosts(await postsForSubmission(submissionId), { action: 'edit', note, fallback, partialFor: submissionId });
}

/**
 * Completions that no longer stand (a submission removal un-completed the tile, or an admin rolled
 * the route back): edit or delete the posts that announced them, the team's win post included when
 * asked.
 */
export async function markCompletionPostsRemoved(args: {
  eventId: number;
  teamId: number;
  tileIds: number[];
  action: 'edit' | 'delete';
  note: string;
  withWin?: boolean;
  fallback?: () => Promise<unknown>;
}) {
  const rows = await postsForCompletions(args.teamId, args.tileIds, { withWin: args.withWin, eventId: args.eventId });
  return actOnPosts(rows, { action: args.action, note: args.note, fallback: args.fallback });
}
