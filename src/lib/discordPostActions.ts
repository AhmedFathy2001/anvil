import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventWebhooks } from '@/db/schema';
import { deleteWebhookMessage, editWebhookMessage, getWebhookMessage, parseWebhookUrls } from '@/lib/discord';
import { loadEventDiscordPrefs, loadPartnerDiscordPrefs } from '@/lib/eventDiscordPrefs';
import { getSettingText } from '@/lib/settings';
import { safeError, webhookIdOf } from '@/lib/webhookRedact';
import { markPostDeleted, markPostEdited, postsForCompletions, postsForSubmission, type DiscordPostRow } from '@/lib/discordPosts';
import { removedMessage, type PostEmbed } from '@/lib/discordPostEdit';
import { log } from '@/lib/logger';

/** The clan settings a board post can have gone out through (lib/discord). */
const CHANNEL_KEYS = ['discord_webhook_bingo', 'discord_webhook_url', 'discord_webhook_cohost'];

/**
 * The webhook URL a kept post was sent with, found again where its token lives — the destination
 * clan's channel settings, the event's or that co-host's Discord prefs, the event's extra hooks —
 * by matching the stored public id. Null when that webhook has since been replaced or removed.
 * Server-side only; never returned to a client or logged.
 */
export async function resolvePostWebhook(row: Pick<DiscordPostRow, 'webhookId' | 'clanId' | 'eventId'>): Promise<string | null> {
  const candidates: string[] = [];
  if (row.clanId != null) {
    for (const key of CHANNEL_KEYS) candidates.push(...parseWebhookUrls(await getSettingText(row.clanId, key).catch(() => null)));
  }
  if (row.eventId != null) {
    const prefs = await loadEventDiscordPrefs(row.eventId).catch(() => null);
    if (prefs?.webhookUrl) candidates.push(prefs.webhookUrl);
    if (row.clanId != null) {
      const partner = await loadPartnerDiscordPrefs(row.eventId, row.clanId).catch(() => null);
      if (partner?.webhookUrl) candidates.push(partner.webhookUrl);
    }
    const hooks = await db.select({ url: eventWebhooks.url }).from(eventWebhooks).where(eq(eventWebhooks.eventId, row.eventId)).catch(() => []);
    candidates.push(...hooks.map((h) => h.url));
  }
  return candidates.find((u) => webhookIdOf(u) === row.webhookId) ?? null;
}

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
      const url = await resolvePostWebhook(row);
      if (!url) {
        failed++;
        continue;
      }
      if (opts.action === 'delete') {
        if (await deleteWebhookMessage(url, row.messageId)) {
          await markPostDeleted(row.id);
          done++;
        } else failed++;
        continue;
      }
      const message = await getWebhookMessage(url, row.messageId);
      if (!message) {
        failed++;
        continue;
      }
      // A merged post that carried other submissions too: say part of it went, don't strike it all.
      const partial = opts.partialFor != null && row.submissionIds.length > 1;
      const note = partial ? `Part of this post (one submission) — ${opts.note.charAt(0).toLowerCase()}${opts.note.slice(1)}` : opts.note;
      if (await editWebhookMessage(url, row.messageId, removedMessage(message as { embeds?: PostEmbed[] }, note, partial))) {
        await markPostEdited(row.id);
        done++;
      } else failed++;
    } catch (error) {
      failed++;
      log.warn('discord-posts.act-fail', { postId: row.id, action: opts.action, error: safeError(error) });
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
