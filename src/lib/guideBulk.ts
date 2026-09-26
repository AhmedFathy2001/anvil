// Posting many guides at once — the "we adopted the Anvil library, put it all in our Discord" case.
//
// Three shapes:
//   'channels'  a new category, one text channel per guide (the tidy reading-room layout)
//   'forum'     one new forum channel, one post per guide, tagged by guide category
//   'existing'  every guide into a channel or forum the clan already has
//
// EVERYTHING IS CHECKED BEFORE ANYTHING IS CREATED: the bot is in the server, it can create channels
// (and set their permissions, when the new channels are to be read-only), or — for an existing
// channel — it can post there. A bulk post that fails on guide 4 of 9 leaves a half-built category
// for somebody to clean up by hand, which is the outcome the pre-flight exists to prevent.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { guidePosts, guides, type Guide } from '@/db/schema';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { PERM } from '@/lib/discord-permissions';
import { categoryOf, slugify } from '@/lib/guideCategories';
import { listCategories } from '@/lib/guideCategoryStore';
import { BOT_SELF_GRANT, discordError, listGuideChannels, postToChannel, type Creds } from '@/lib/guidePosting';
import { log } from '@/lib/logger';

export type BulkLayout = 'channels' | 'forum' | 'existing';

export interface BulkRequest {
  clanId: number;
  guideIds: number[];
  layout: BulkLayout;
  /** New category name ('channels'; optional for 'forum'). */
  categoryName?: string;
  /** Put the new channels under an existing category instead of creating one. */
  parentId?: string | null;
  /** New forum's name ('forum'). */
  forumName?: string;
  /** Target for 'existing'. */
  channelId?: string;
  /** Members can read but not write in the new channels (the bot keeps its own access). */
  readOnly?: boolean;
  autoUpdate?: boolean;
  userId: number | null;
}

export interface BulkResult {
  ok: boolean;
  error?: string;
  created?: { categoryId?: string; forumId?: string; channelIds: string[] };
  results: { guideId: number; title: string; ok: boolean; error?: string; postId?: number }[];
}

/** Bulk is bounded: Discord caps a category at 50 channels, and a request has to end sometime. */
export const BULK_MAX = 25;

const CH_TEXT = 0;
const CH_CATEGORY = 4;
const CH_FORUM = 15;

const bit = (...ps: bigint[]) => ps.reduce((a, b) => a | b, BigInt(0)).toString();

/**
 * Read-only for @everyone, with a member overwrite keeping the bot's own access — without it the
 * @everyone deny lands on the bot too, and it could not post (or later edit) in its own channels.
 * In a forum, readers keep one thing: replying inside a guide's thread (questions go there).
 *
 * The bot may only grant itself permissions it already holds — Discord refuses the whole channel
 * otherwise — so BOT_SELF_GRANT is exactly what the pre-flight checks it has (see BotStanding).
 */
function readOnlyOverwrites(guildId: string, botId: string, forum: boolean) {
  return [
    {
      id: guildId,
      type: 0,
      allow: '0',
      deny: forum ? bit(PERM.SEND_MESSAGES) : bit(PERM.SEND_MESSAGES, PERM.SEND_MESSAGES_IN_THREADS),
    },
    {
      id: botId,
      type: 1,
      allow: bit(...BOT_SELF_GRANT.map((n) => PERM[n])),
      deny: '0',
    },
  ];
}

async function createChannel(creds: Creds, body: Record<string, unknown>): Promise<{ id: string; available_tags?: { id: string; name: string }[] }> {
  const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await discordError(res));
  return res.json();
}

async function botUserId(creds: Creds): Promise<string | null> {
  const res = await discordRest(creds.botToken, '/users/@me');
  return res.ok ? (((await res.json()) as { id?: string }).id ?? null) : null;
}

export async function bulkPost(req: BulkRequest): Promise<BulkResult> {
  const fail = (error: string): BulkResult => ({ ok: false, error, results: [] });

  const ids = [...new Set(req.guideIds)].slice(0, BULK_MAX);
  if (!ids.length) return fail('Pick at least one guide.');
  const rows = await db
    .select()
    .from(guides)
    .where(and(eq(guides.clanId, req.clanId), inArray(guides.id, ids)));
  const list: Guide[] = ids.map((id) => rows.find((g) => g.id === id)).filter((g): g is Guide => !!g);
  const drafts = list.filter((g) => g.status !== 'published');
  if (drafts.length) return fail(`Publish these first — drafts stay off Discord: ${drafts.map((g) => g.title).join(', ')}.`);
  if (!list.length) return fail('None of those guides belong to this clan.');

  const creds = await getBotCredentials(req.clanId);
  if (!creds) return fail('The Discord bot is not connected for this clan. Set it up under Settings → Discord.');

  // ── Pre-flight ──────────────────────────────────────────────────────────────────────────
  const server = await listGuideChannels(req.clanId);
  const bot = server.bot;
  if (!bot || bot.inGuild !== true) return fail(server.error ?? "The bot isn't in your Discord server.");

  if (req.layout === 'existing') {
    const target = server.channels.find((c) => c.id === req.channelId);
    if (!target) return fail('Pick a channel the bot can see.');
    if (target.missing.length) return fail(`The bot is missing ${target.missing.join(', ')} in #${target.name}.`);
    if (target.kind === 'forum' && target.requiresTag) {
      return fail(`#${target.name} requires a tag on every post. Post them one at a time, or use a new forum.`);
    }
    // Posting a guide twice into the same place is never what anyone meant.
    const already = new Set(
      (
        await db
          .select({ guideId: guidePosts.guideId })
          .from(guidePosts)
          .where(and(eq(guidePosts.clanId, req.clanId), eq(guidePosts.channelId, target.id)))
      ).map((r) => r.guideId),
    );
    const results: BulkResult['results'] = [];
    for (const guide of list) {
      if (already.has(guide.id)) {
        results.push({ guideId: guide.id, title: guide.title, ok: false, error: `Already posted in #${target.name}.` });
        continue;
      }
      const r = await postToChannel(creds, { clanId: req.clanId, guide, autoUpdate: req.autoUpdate, userId: req.userId }, target, []);
      results.push({ guideId: guide.id, title: guide.title, ok: r.ok, error: r.ok ? undefined : r.error, postId: r.ok ? r.post.id : undefined });
    }
    return { ok: results.every((r) => r.ok), results, created: { channelIds: [] } };
  }

  // Creating channels: Manage Channels, and Manage Roles to set read-only overwrites on them.
  if (!bot.canCreateChannels) return fail('The bot needs the "Manage Channels" permission in your server to create channels.');
  if (req.readOnly && !bot.canSetPermissions) {
    return fail('Read-only channels need the bot to hold "Manage Roles" (to set who may write). Grant it, or untick read-only.');
  }
  if (req.readOnly && bot.missingForReadOnly.length) {
    return fail(`Read-only channels need the bot to hold ${bot.missingForReadOnly.join(', ')} server-wide. Grant them, or untick read-only.`);
  }
  if (req.parentId && !server.categories?.some((c) => c.id === req.parentId)) return fail('That category no longer exists.');

  const botId = req.readOnly ? await botUserId(creds) : null;
  if (req.readOnly && !botId) return fail('Could not resolve the bot user — re-check the bot token.');

  const created: NonNullable<BulkResult['created']> = { channelIds: [] };
  const results: BulkResult['results'] = [];
  try {
    // The category: an existing one, a new one, or (forum only) none at all.
    let parentId = req.parentId ?? null;
    const categoryName = (req.categoryName ?? '').trim();
    if (!parentId && (req.layout === 'channels' || categoryName)) {
      const cat = await createChannel(creds, {
        name: (categoryName || 'Guides').slice(0, 100),
        type: CH_CATEGORY,
        ...(req.readOnly && botId ? { permission_overwrites: readOnlyOverwrites(creds.guildId, botId, false) } : {}),
      });
      parentId = cat.id;
      created.categoryId = cat.id;
    }

    if (req.layout === 'channels') {
      for (const guide of list) {
        let channelId: string | null = null;
        try {
          const ch = await createChannel(creds, {
            name: slugify(guide.title).slice(0, 100),
            type: CH_TEXT,
            parent_id: parentId,
            topic: guide.summary.slice(0, 1024) || undefined,
            // Said explicitly rather than trusting category sync, which only applies to channels
            // created with no overwrites of their own — and is not documented as a guarantee.
            ...(req.readOnly && botId ? { permission_overwrites: readOnlyOverwrites(creds.guildId, botId, false) } : {}),
          });
          channelId = ch.id;
          created.channelIds.push(ch.id);
        } catch (err) {
          results.push({ guideId: guide.id, title: guide.title, ok: false, error: err instanceof Error ? err.message : String(err) });
          continue;
        }
        const r = await postToChannel(
          creds,
          { clanId: req.clanId, guide, autoUpdate: req.autoUpdate, userId: req.userId },
          { id: channelId, name: slugify(guide.title), kind: 'text' },
          [],
        );
        results.push({ guideId: guide.id, title: guide.title, ok: r.ok, error: r.ok ? undefined : r.error, postId: r.ok ? r.post.id : undefined });
      }
    } else {
      // One forum, tagged by guide category so members can filter "raids" from "skilling".
      const cats = [...new Set(list.map((g) => g.category))].slice(0, 20);
      const catList = await listCategories(req.clanId);
      const forum = await createChannel(creds, {
        name: slugify(req.forumName || 'guides').slice(0, 100),
        type: CH_FORUM,
        parent_id: parentId,
        topic: 'Guides, kept up to date by Anvil.',
        available_tags: cats.map((c) => ({ name: categoryOf(c, catList).label.slice(0, 20), emoji_name: categoryOf(c, catList).icon })),
        ...(req.readOnly && botId ? { permission_overwrites: readOnlyOverwrites(creds.guildId, botId, true) } : {}),
      });
      created.forumId = forum.id;
      const tagFor = new Map(
        cats.map((c) => [c, forum.available_tags?.find((t) => t.name === categoryOf(c, catList).label.slice(0, 20))?.id]),
      );
      const forumName = slugify(req.forumName || 'guides');
      for (const guide of list) {
        const tag = tagFor.get(guide.category);
        const r = await postToChannel(
          creds,
          { clanId: req.clanId, guide, autoUpdate: req.autoUpdate, userId: req.userId },
          { id: forum.id, name: forumName, kind: 'forum' },
          tag ? [tag] : [],
        );
        results.push({ guideId: guide.id, title: guide.title, ok: r.ok, error: r.ok ? undefined : r.error, postId: r.ok ? r.post.id : undefined });
      }
    }
  } catch (err) {
    // A failure creating the category or forum itself: nothing was posted.
    log.warn('guides.bulk-fail', { clanId: req.clanId, err: String(err) });
    return { ok: false, error: err instanceof Error ? err.message : String(err), created, results };
  }

  return { ok: results.every((r) => r.ok), created, results };
}
