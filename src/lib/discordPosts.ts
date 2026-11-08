import { AsyncLocalStorage } from 'node:async_hooks';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { discordPosts } from '@/db/schema';
import { log } from '@/lib/logger';

/**
 * WHICH BOARD POST WAS WHICH. A webhook post is sent with `?wait=true` while a post ref is set
 * (withPostRef), so Discord answers with the message; this records it against what it announced —
 * so a removed submission or a rolled-back completion can find its post and edit or delete it
 * (lib/discordPostActions). The ref rides an AsyncLocalStorage, so every fan-out destination of one
 * notify call (host channel, co-hosts, extra hooks) is recorded without threading it through.
 */
export type DiscordPostKind = 'submission' | 'submissionComplete' | 'tileComplete' | 'teamWin';

export interface DiscordPostRef {
  kind: DiscordPostKind;
  clanId?: number | null;
  eventId?: number | null;
  tileId?: number | null;
  teamId?: number | null;
  submissionIds?: number[];
}

const store = new AsyncLocalStorage<DiscordPostRef>();

export function withPostRef<T>(ref: DiscordPostRef, fn: () => Promise<T>): Promise<T> {
  return store.run(ref, fn);
}

export function currentPostRef(): DiscordPostRef | undefined {
  return store.getStore();
}

/** Store one sent message. Best-effort: a failure here never fails the post. */
export async function recordDiscordPost(ref: DiscordPostRef, webhookUrl: string, message: { id?: unknown; channel_id?: unknown }): Promise<void> {
  if (typeof message.id !== 'string' || !message.id) return;
  try {
    await db.insert(discordPosts).values({
      clanId: ref.clanId ?? null,
      kind: ref.kind,
      eventId: ref.eventId ?? null,
      tileId: ref.tileId ?? null,
      teamId: ref.teamId ?? null,
      submissionIds: ref.submissionIds ?? [],
      webhookUrl,
      messageId: message.id,
      channelId: typeof message.channel_id === 'string' ? message.channel_id : null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Never the webhook URL: its token is a secret.
    log.warn('discord-posts.record-fail', { kind: ref.kind, eventId: ref.eventId ?? null }, error);
  }
}

export type DiscordPostRow = typeof discordPosts.$inferSelect;

/** The live posts that carried this submission (on its own, or in a merged bucket). */
export async function postsForSubmission(submissionId: number): Promise<DiscordPostRow[]> {
  return db
    .select()
    .from(discordPosts)
    .where(and(isNull(discordPosts.deletedAt), sql`${discordPosts.submissionIds} @> ${JSON.stringify([submissionId])}::jsonb`));
}

/** The live posts that announced these tiles complete for a team (and its win, when asked). */
export async function postsForCompletions(teamId: number, tileIds: number[], opts: { withWin?: boolean; eventId?: number } = {}): Promise<DiscordPostRow[]> {
  const rows = tileIds.length
    ? await db
        .select()
        .from(discordPosts)
        .where(and(
          isNull(discordPosts.deletedAt),
          eq(discordPosts.teamId, teamId),
          inArray(discordPosts.tileId, tileIds),
          inArray(discordPosts.kind, ['tileComplete', 'submissionComplete']),
        ))
    : [];
  if (opts.withWin && opts.eventId != null) {
    rows.push(...(await db.select().from(discordPosts).where(and(isNull(discordPosts.deletedAt), eq(discordPosts.teamId, teamId), eq(discordPosts.eventId, opts.eventId), eq(discordPosts.kind, 'teamWin')))));
  }
  return rows;
}

export async function markPostEdited(id: number): Promise<void> {
  await db.update(discordPosts).set({ editedAt: new Date().toISOString() }).where(eq(discordPosts.id, id));
}

export async function markPostDeleted(id: number): Promise<void> {
  await db.update(discordPosts).set({ deletedAt: new Date().toISOString() }).where(eq(discordPosts.id, id));
}
