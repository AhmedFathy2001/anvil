// Posting guides to Discord, and keeping what was posted in step with the guide.
//
// A post remembers the message ids it became (guide_posts.message_ids), so an edit to the guide
// EDITS THOSE MESSAGES rather than posting the guide again under the old one. The shapes:
//
//   same number of messages  → edit each in place
//   fewer                    → edit the first N, delete the rest
//   more, forum post         → edit, then append in the thread (it is the guide's own thread)
//   more, text channel       → delete and post fresh: appending would put the new part underneath
//                              whatever the channel said since, and a guide read out of order is
//                              worse than one that moved to the bottom of the channel
//
// Every send carries `allowed_mentions: { parse: [] }`. A guide is prose, not a ping, and a stray
// `@everyone` in step 3 of a raid guide must not wake the whole clan.

import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { guidePosts, guides, type Guide, type GuidePost } from '@/db/schema';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import {
  PERM,
  botAccess,
  channelPermissions,
  missingPermissions,
  type BotAccess,
  type PermName,
  type RawOverwrite,
} from '@/lib/discord-permissions';
import { log } from '@/lib/logger';
import { configuredOrigin } from '@/lib/request-origin';
import { resolveClanById } from '@/lib/clanContext';
import { renderGuideForDiscord, type DiscordGuideMessage } from '@/lib/guideDiscord';
import { discordBody } from '@/lib/dps/summary';
import { effectiveGearIndex } from '@/lib/dps/store';

const CH_TEXT = 0;
const CH_ANNOUNCEMENT = 5;
const CH_CATEGORY = 4;
const CH_FORUM = 15;
const CH_MEDIA = 16;
const FORUM_REQUIRE_TAG = 1 << 4;
const GOLD = 0xe0b341;
const NO_PINGS = { parse: [] as string[] };

export interface GuideChannel {
  id: string;
  name: string;
  kind: 'text' | 'forum';
  parentId: string | null;
  parentName: string | null;
  position: number;
  tags: { id: string; name: string; emoji: string | null }[];
  requiresTag: boolean;
  /** Permissions the bot lacks here — empty means it can post. Checked BEFORE anything is sent. */
  missing: string[];
  /** For a forum: whether the bot will be able to delete its posts later (Manage Threads). */
  canRemove: boolean;
}

/** What posting a guide needs, by where it goes. Editing and deleting its own messages need no more. */
export const NEEDS: Record<'text' | 'forum', PermName[]> = {
  text: ['SEND_MESSAGES', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY'],
  // A forum post is created with Send Messages; the rest of the guide goes into its thread.
  forum: ['SEND_MESSAGES', 'SEND_MESSAGES_IN_THREADS', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY'],
};

/** The bot's standing in the server, for the UI's pre-flight. */
export interface BotStanding {
  inGuild: boolean | null;
  reason?: string;
  /** Guild-wide, for bulk posting: create channels, and set who may write in them. */
  canCreateChannels: boolean;
  canSetPermissions: boolean;
  /** Server-wide permissions the bot lacks for granting itself access in read-only channels. */
  missingForReadOnly: string[];
}

/** What the bot keeps for itself in a read-only guide channel (lib/guideBulk). */
export const BOT_SELF_GRANT: PermName[] = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'SEND_MESSAGES_IN_THREADS',
  'EMBED_LINKS',
  'READ_MESSAGE_HISTORY',
];

function standing(access: BotAccess): BotStanding {
  const has = (p: bigint) => access.admin || (access.base & p) !== BigInt(0);
  return {
    inGuild: access.inGuild,
    reason: access.reason,
    canCreateChannels: access.inGuild === true && has(PERM.MANAGE_CHANNELS),
    canSetPermissions: access.inGuild === true && has(PERM.MANAGE_ROLES),
    missingForReadOnly: access.inGuild === true && !access.admin ? missingPermissions(access.base, BOT_SELF_GRANT) : [],
  };
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
  flags?: number;
  permission_overwrites?: RawOverwrite[];
  available_tags?: { id: string; name: string; emoji_name: string | null; moderated?: boolean }[];
}

export interface GuideChannelList {
  enabled: boolean;
  bot: BotStanding | null;
  channels: GuideChannel[];
  /** Existing categories, for "put the new channels under…". */
  categories?: { id: string; name: string }[];
  error?: string;
}

/**
 * Text, announcement and forum channels — the places a guide can go — each with what the bot is
 * missing there, plus the bot's standing in the server. A bot that isn't in the server comes back
 * with no channels and a reason, rather than a list that fails on the first click.
 */
export async function listGuideChannels(
  clanId: number,
): Promise<GuideChannelList> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return { enabled: false, bot: null, channels: [] };
  const access = await botAccess(creds.botToken, creds.guildId);
  const bot = standing(access);
  if (access.inGuild !== true) return { enabled: true, bot, channels: [], error: access.reason };

  const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`);
  if (!res.ok) {
    log.warn('guides.list-channels-fail', { status: res.status });
    return { enabled: true, bot, channels: [], error: `Discord ${res.status} while listing channels.` };
  }
  const raw = (await res.json()) as RawChannel[];
  const cats = new Map(raw.filter((c) => c.type === CH_CATEGORY).map((c) => [c.id, c.name]));
  const channels = raw
    .filter((c) => [CH_TEXT, CH_ANNOUNCEMENT, CH_FORUM, CH_MEDIA].includes(c.type))
    .map<GuideChannel>((c) => {
      const kind = c.type === CH_FORUM || c.type === CH_MEDIA ? 'forum' : 'text';
      return {
        id: c.id,
        name: c.name,
        kind,
        parentId: c.parent_id,
        parentName: c.parent_id ? (cats.get(c.parent_id) ?? null) : null,
        position: c.position,
        tags: (c.available_tags ?? []).map((t) => ({ id: t.id, name: t.name, emoji: t.emoji_name ?? null })),
        requiresTag: ((c.flags ?? 0) & FORUM_REQUIRE_TAG) !== 0,
        missing: missingPermissions(channelPermissions(access, c.permission_overwrites), NEEDS[kind]),
        canRemove: kind === 'text' || missingPermissions(channelPermissions(access, c.permission_overwrites), ['MANAGE_THREADS']).length === 0,
      };
    })
    .sort((a, b) => (a.parentName ?? '').localeCompare(b.parentName ?? '') || a.position - b.position);
  const categories = raw
    .filter((c) => c.type === CH_CATEGORY)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));
  return { enabled: true, bot, channels, categories };
}

/** Where a guide reads on the site — the canonical /c/<slug> address for a clan's own guide. */
export function guideSiteUrl(clanSlug: string | null, slug: string): string | null {
  const origin = configuredOrigin();
  if (!origin) return null;
  return clanSlug ? `${origin}/c/${clanSlug}/guides/${slug}` : `${origin}/guides/${slug}`;
}

/** The messages a guide becomes in this clan's Discord. */
export async function guideMessages(guide: Guide): Promise<DiscordGuideMessage[]> {
  const clan = guide.clanId != null ? await resolveClanById(guide.clanId) : null;
  const byline = guide.clanId == null ? 'Anvil guide library' : guide.followsSource ? `${clan?.name ?? 'Clan'} · from the Anvil library` : clan?.name ?? null;
  const siteUrl = guideSiteUrl(clan?.slug ?? null, guide.slug);
  return renderGuideForDiscord(
    {
      title: guide.title,
      summary: guide.summary,
      // Levels become headed messages and gear blocks a DPS summary — Discord can't switch or calculate.
      body: discordBody(guide.body, await effectiveGearIndex(), siteUrl),
      coverUrl: guide.coverUrl,
      siteUrl,
      updatedAt: guide.updatedAt,
      byline,
    },
    { origin: configuredOrigin(), color: GOLD },
  );
}

function hashMessages(title: string, messages: DiscordGuideMessage[]): string {
  return crypto.createHash('sha256').update(JSON.stringify({ title, messages })).digest('hex').slice(0, 32);
}

function payload(m: DiscordGuideMessage) {
  // `content: ''` is invalid alongside no embeds; an image-only message sends embeds alone.
  return { content: m.content || undefined, embeds: m.embeds, allowed_mentions: NO_PINGS };
}

export async function discordError(res: Response): Promise<string> {
  let message = '';
  let code: number | undefined;
  try {
    const body = (await res.clone().json()) as { message?: string; code?: number };
    message = body.message ?? '';
    code = body.code;
  } catch {
    /* not json */
  }
  const base = `Discord ${res.status}${message ? `: ${message}` : ''}`;
  if (res.status === 403 || code === 50013 || code === 50001) {
    return `${base} — give the bot View Channel, Send Messages, Embed Links (and Create Posts / Send Messages in Threads for a forum) on that channel.`;
  }
  if (res.status === 404 || code === 10003 || code === 10008) return `${base} — the channel or message no longer exists.`;
  if (code === 40067) return `${base} — this forum requires a tag; pick one.`;
  return base;
}

export type Creds = { botToken: string; guildId: string };

/**
 * A Discord refusal we can reason about: `gone` (the channel/thread or message was deleted — by hand,
 * usually) versus `forbidden` (a permission is missing) versus anything else.
 */
export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | undefined,
  ) {
    super(message);
  }
  get channelGone() {
    return this.status === 404 && (this.code === 10003 || this.code === undefined);
  }
  get messageGone() {
    return this.status === 404 && this.code === 10008;
  }
  get forbidden() {
    return this.status === 403 || this.code === 50013 || this.code === 50001;
  }
}

async function apiError(res: Response): Promise<DiscordApiError> {
  let code: number | undefined;
  try {
    code = ((await res.clone().json()) as { code?: number }).code;
  } catch {
    /* not json */
  }
  return new DiscordApiError(await discordError(res), res.status, code);
}

async function send(creds: Creds, channelId: string, m: DiscordGuideMessage): Promise<string> {
  const res = await discordRest(creds.botToken, `/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload(m)),
  });
  if (!res.ok) throw await apiError(res);
  return ((await res.json()) as { id: string }).id;
}

async function edit(creds: Creds, channelId: string, messageId: string, m: DiscordGuideMessage): Promise<void> {
  const res = await discordRest(creds.botToken, `/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    // content: '' explicitly clears old text when a message became image-only.
    body: JSON.stringify({ content: m.content, embeds: m.embeds, allowed_mentions: NO_PINGS }),
  });
  if (!res.ok) throw await apiError(res);
}

async function remove(creds: Creds, channelId: string, messageId: string): Promise<void> {
  const res = await discordRest(creds.botToken, `/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
  // Already gone is the outcome we wanted.
  if (!res.ok && res.status !== 404) throw await apiError(res);
}

/** Delete a whole channel (or thread). Already gone counts as done. */
async function deleteChannel(creds: Creds, channelId: string): Promise<void> {
  const res = await discordRest(creds.botToken, `/channels/${channelId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw await apiError(res);
}

export interface PostRequest {
  clanId: number;
  guide: Guide;
  channelId: string;
  tagIds?: string[];
  autoUpdate?: boolean;
  userId: number | null;
  /** Set by a bulk post (lib/guideBulk). */
  bulkRunId?: number | null;
  /** Anvil created this channel just for this guide. */
  ownsChannel?: boolean;
}

/** Post a guide to a channel or forum, and remember what it became. */
export async function postGuide(req: PostRequest): Promise<PostResult> {
  const creds = await getBotCredentials(req.clanId);
  if (!creds) return { ok: false, error: 'The Discord bot is not connected for this clan. Set it up under Settings → Discord.' };
  if (req.guide.clanId !== req.clanId) return { ok: false, error: 'Copy the guide into your clan before posting it.' };

  // THE PRE-FLIGHT. Is the bot in the server, can it see this channel, and does it hold everything a
  // post needs there — asked before a single message goes out, so a missing permission is a sentence
  // naming it rather than half a guide stranded in the channel.
  const list = await listGuideChannels(req.clanId);
  if (list.bot?.inGuild !== true) return { ok: false, error: list.error ?? "The bot isn't in your Discord server." };
  const channel = list.channels.find((c) => c.id === req.channelId);
  if (!channel) return { ok: false, error: 'That channel is not one the bot can see. Reload the list and pick again.' };
  if (channel.missing.length) {
    return { ok: false, error: `The bot is missing ${channel.missing.join(', ')} in #${channel.name}.` };
  }
  const tagIds = (req.tagIds ?? []).filter((t) => channel.tags.some((x) => x.id === t)).slice(0, 5);
  if (channel.kind === 'forum' && channel.requiresTag && tagIds.length === 0) {
    return { ok: false, error: `#${channel.name} requires a tag on every post — pick one.` };
  }
  return postToChannel(creds, req, channel, tagIds);
}

export type PostResult = { ok: true; post: GuidePost } | { ok: false; error: string };

/**
 * Send a guide into a channel ALREADY checked by the caller, and remember what it became. Split out
 * so a bulk post checks the server once and then posts many guides without re-reading it each time.
 */
export async function postToChannel(
  creds: Creds,
  req: Omit<PostRequest, 'channelId' | 'tagIds'>,
  channel: Pick<GuideChannel, 'id' | 'name' | 'kind'>,
  tagIds: string[],
): Promise<PostResult> {
  const messages = await guideMessages(req.guide);
  const ids: string[] = [];
  let threadId: string | null = null;
  try {
    if (channel.kind === 'forum') {
      const [first, ...rest] = messages;
      const res = await discordRest(creds.botToken, `/channels/${channel.id}/threads`, {
        method: 'POST',
        body: JSON.stringify({ name: req.guide.title.slice(0, 100), message: payload(first), applied_tags: tagIds }),
      });
      if (!res.ok) throw new Error(await discordError(res));
      const thread = (await res.json()) as { id: string; message?: { id: string } };
      threadId = thread.id;
      // A forum post's starter message shares the thread's id.
      ids.push(thread.message?.id ?? thread.id);
      for (const m of rest) ids.push(await send(creds, threadId, m));
    } else {
      for (const m of messages) ids.push(await send(creds, channel.id, m));
    }
  } catch (err) {
    log.warn('guides.post-fail', { guideId: req.guide.id, channelId: channel.id, err: String(err) });
    // Don't strand half a guide in the channel with nothing remembering it: record what did land so
    // the editor can remove it, with the error beside it.
    if (!ids.length) return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const at = new Date().toISOString();
  const [post] = await db
    .insert(guidePosts)
    .values({
      clanId: req.clanId,
      guideId: req.guide.id,
      channelId: channel.id,
      channelName: channel.name,
      channelKind: channel.kind,
      threadId,
      messageIds: ids,
      postedVersion: req.guide.version,
      contentHash: ids.length === messages.length ? hashMessages(req.guide.title, messages) : null,
      autoUpdate: req.autoUpdate !== false,
      ownsChannel: req.ownsChannel === true,
      bulkRunId: req.bulkRunId ?? null,
      lastError: ids.length === messages.length ? null : `Posted ${ids.length} of ${messages.length} messages, then Discord refused the rest. Use "Update now" to retry.`,
      postedByUserId: req.userId,
      createdAt: at,
      updatedAt: at,
    })
    .returning();
  return { ok: true, post };
}

/**
 * Bring one post in line with its guide. `force` re-sends even when the hash says nothing changed —
 * the "Update now" button, for when somebody edited or deleted a message by hand.
 */
export async function resyncPost(
  post: GuidePost,
  guide: Guide,
  force = false,
): Promise<{ ok: boolean; error?: string; changed: boolean; gone?: boolean }> {
  const messages = await guideMessages(guide);
  const hash = hashMessages(guide.title, messages);
  if (!force && hash === post.contentHash && !post.lastError) return { ok: true, changed: false };

  const creds = await getBotCredentials(post.clanId);
  if (!creds) return { ok: false, error: 'The Discord bot is not connected.', changed: false };

  const where = post.threadId ?? post.channelId;
  let ids = [...post.messageIds];
  try {
    if (post.threadId) {
      // An archived thread refuses edits; wake it (and keep the name in step with the title).
      const res = await discordRest(creds.botToken, `/channels/${post.threadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: false, name: guide.title.slice(0, 100) }),
      });
      if (!res.ok && res.status !== 404) log.warn('guides.thread-patch-fail', { status: res.status, postId: post.id });
    }

    if (messages.length > ids.length && !post.threadId) {
      // Growing in a text channel: repost rather than append out of order. See the file header.
      for (const id of ids) await remove(creds, where, id);
      ids = [];
      for (const m of messages) ids.push(await send(creds, where, m));
    } else {
      for (let i = 0; i < messages.length; i++) {
        if (i < ids.length) await edit(creds, where, ids[i], messages[i]);
        else ids.push(await send(creds, where, messages[i]));
      }
      // Shrinking: the starter of a forum post can't be deleted without the thread, but it is always
      // index 0, and there is always at least one message, so it is never in the tail.
      for (const id of ids.slice(messages.length)) await remove(creds, where, id);
      ids = ids.slice(0, messages.length);
    }
  } catch (err) {
    // Deleted by hand in Discord. The whole channel or forum post: that IS a removal — forget it.
    if (err instanceof DiscordApiError && err.channelGone) {
      await db.delete(guidePosts).where(eq(guidePosts.id, post.id));
      log.info('guides.post-gone', { postId: post.id });
      return { ok: true, changed: true, gone: true };
    }
    // Some of its messages: post the guide again in the same place, so it is whole.
    if (err instanceof DiscordApiError && err.messageGone && !force) {
      const keep = post.threadId ? ids.slice(0, 1) : [];
      for (const id of ids) if (!keep.includes(id)) await remove(creds, where, id).catch(() => {});
      await db.update(guidePosts).set({ messageIds: [], contentHash: null }).where(eq(guidePosts.id, post.id));
      try {
        const fresh: string[] = [];
        for (const m of messages) fresh.push(await send(creds, where, m));
        await db
          .update(guidePosts)
          .set({ messageIds: fresh, postedVersion: guide.version, contentHash: hash, lastError: null, updatedAt: new Date().toISOString() })
          .where(eq(guidePosts.id, post.id));
        return { ok: true, changed: true };
      } catch (again) {
        err = again;
      }
    }
    const error = err instanceof Error ? err.message : String(err);
    await db
      .update(guidePosts)
      .set({ messageIds: ids, lastError: error, updatedAt: new Date().toISOString() })
      .where(eq(guidePosts.id, post.id));
    return { ok: false, error, changed: true };
  }

  await db
    .update(guidePosts)
    .set({
      messageIds: ids,
      postedVersion: guide.version,
      contentHash: hash,
      lastError: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(guidePosts.id, post.id));
  return { ok: true, changed: true };
}

/** Re-sync every auto-updating post of a guide. Sequential: Discord rate-limits per channel anyway. */
export async function resyncGuidePosts(guideId: number): Promise<void> {
  const guide = await db.query.guides.findFirst({ where: eq(guides.id, guideId) });
  if (!guide) return;
  const posts = await db
    .select()
    .from(guidePosts)
    .where(and(eq(guidePosts.guideId, guideId), eq(guidePosts.autoUpdate, true)));
  for (const post of posts) {
    const r = await resyncPost(post, guide);
    if (!r.ok) log.warn('guides.resync-post-fail', { postId: post.id, error: r.error });
  }
}

/**
 * Take a post down. `deleteMessages` false just forgets it. Otherwise, in order of preference:
 *   - a channel Anvil made for this guide → delete the channel (the bot made it; it can)
 *   - a forum post → delete the thread; without Manage Threads (Discord requires it even for the
 *     bot's own post) fall back to deleting the bot's messages in it, and say what's left
 *   - messages in a channel → delete them
 * Anything already deleted by hand counts as done.
 */
export async function unpost(post: GuidePost, deleteMessages: boolean): Promise<{ ok: boolean; error?: string; note?: string }> {
  let note: string | undefined;
  if (deleteMessages) {
    const creds = await getBotCredentials(post.clanId);
    if (!creds) return { ok: false, error: 'The Discord bot is not connected — nothing could be deleted.' };
    try {
      if (post.ownsChannel) {
        await deleteChannel(creds, post.channelId);
      } else if (post.threadId) {
        try {
          await deleteChannel(creds, post.threadId);
        } catch (err) {
          if (!(err instanceof DiscordApiError && err.forbidden)) throw err;
          // Its own messages the bot can always delete. The starter shares the thread's id.
          for (const id of [...post.messageIds].reverse()) await remove(creds, post.threadId, id).catch(() => {});
          await discordRest(creds.botToken, `/channels/${post.threadId}`, {
            method: 'PATCH',
            body: JSON.stringify({ archived: true }),
          }).catch(() => {});
          note = 'The guide was removed from the forum post, but the empty post stays: deleting a forum post needs the bot to have "Manage Threads". Re-invite the bot from Settings → Discord to add it.';
        }
      } else {
        for (const id of post.messageIds) await remove(creds, post.channelId, id);
      }
    } catch (err) {
      if (!(err instanceof DiscordApiError && (err.channelGone || err.messageGone))) {
        const e = err instanceof DiscordApiError && err.forbidden ? `${removalHint(post)} (${err.message.split(' — ')[0]})` : err instanceof Error ? err.message : String(err);
        return { ok: false, error: e };
      }
    }
  }
  await db.delete(guidePosts).where(eq(guidePosts.id, post.id));
  return { ok: true, note };
}

function removalHint(post: GuidePost): string {
  if (post.ownsChannel) return 'The bot needs "Manage Channels" to delete the channel it made.';
  if (post.threadId) return 'The bot needs "Manage Threads" in that forum to delete the post.';
  return 'The bot couldn\'t delete its messages there.';
}

/** Delete what a bulk post created, and forget its posts. Returns what could not be removed. */
export async function removeCreated(clanId: number, ids: string[]): Promise<{ removed: string[]; failed: { id: string; error: string }[] }> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return { removed: [], failed: ids.map((id) => ({ id, error: 'The Discord bot is not connected.' })) };
  const removed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of ids) {
    try {
      await deleteChannel(creds, id);
      removed.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof DiscordApiError && err.forbidden ? 'The bot needs "Manage Channels".' : String(err) });
    }
  }
  return { removed, failed };
}

/** A jump link to the post's first message. */
export function postJumpUrl(guildId: string | null, post: Pick<GuidePost, 'channelId' | 'threadId' | 'messageIds'>): string | null {
  if (!guildId) return null;
  if (post.threadId) return `https://discord.com/channels/${guildId}/${post.threadId}`;
  const first = post.messageIds[0];
  return first ? `https://discord.com/channels/${guildId}/${post.channelId}/${first}` : null;
}
