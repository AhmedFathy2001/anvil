import { webhookIdentity } from '@/lib/discordIdentity';
import { fetchDiscordWebhook } from '@/lib/discordWebhookUrl';
import { currentPostRef, recordDiscordPost, withPostRef } from '@/lib/discordPosts';
import { raceTileHiddenFromOthers } from '@/lib/raceHideAheadDb';
import { safeError } from '@/lib/webhookRedact';
import { blockedWebhookIds, hasBlockedWebhook } from '@/lib/sharedWebhooks';
import {
  ActivityMeter,
  WebhookPoolState,
  sendThroughPool,
  webhookIdOf,
  type PoolSendResult,
  type WebhookDestination,
} from '@/lib/webhookPool';
import { eventHookTargets } from '@/lib/eventWebhooks';
import { EVENT_POST_KINDS, type EventPostKind } from '@/lib/eventWebhookKinds';
import { clanMarkUrl, eventMarkUrl } from '@/lib/clanMarkUrl';
import { log } from '@/lib/logger';
// The lab and friends hosts (lib/friendEventRules) never post: lib/friendEventsSql isHiddenHost.
import { isHiddenHost } from '@/lib/friendEventsSql';
import { getSettingText } from '@/lib/settings';
import { startBlockerLabel, type StartBlockerCode } from '@/lib/eventReadiness';
import { eventAxes, taskNoun } from '@/lib/eventAxes';
import { SKILLS, formatEfficiencyHours, metricKeys, weeklyKindLabel } from '@/lib/constants';
import { formatGp } from '@/lib/adminEventsFormat';
import { placeLabel } from '@/lib/eventRules';
import { deriveTileIcon, skillIconUrl, bossIconForStatKey, itemIconUrl, type IconableTile } from '@/lib/tileIcons';
import { discordAssetUrl } from '@/lib/seo';
import { eq } from 'drizzle-orm';
import { boardRevealImageQuery } from '@/lib/boardRevealImage';

import { db } from '@/db';
import { acceptedCohostClanIds } from '@/lib/coHost';
import { ttlMemo } from '@/lib/ttlMemo';
import { FEEDS_OFF_KEY, parseFeedsOff } from '@/lib/discordFeeds';
import {
  clanDefault,
  decideHostPost,
  decidePartnerPost,
  hostShares,
  postTypeInfo,
  type DiscordPostType,
  type PingChoice,
  type PostDecision,
} from '@/lib/discordPostPolicy';
import { loadClanPostDefaults, loadEventDiscordPrefs, loadPartnerDiscordPrefs } from '@/lib/eventDiscordPrefs';
import { curtainRoute, PROGRESS_POST_KINDS, standingsHidden } from '@/lib/standingsVisibility';
import { emitTileCompletion } from '@/lib/chatFeed';
import { queueBoardHighlight, queueStartHighlight } from '@/lib/highlights/store';
import { clans, events, teams } from '@/db/schema';
import {
  EMBED_COLOR,
  clamp,
  field,
  pluginNote,
  statField,
  stampEmbeds,
  teamColorToDecimal,
  LIMIT,
  type DiscordEmbed,
  type DiscordEmbedField,
} from '@/lib/discordEmbeds';

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  // Restrict which mentions actually ping. When pinging a role we set `roles` explicitly so the
  // role notifies even if it isn't "mentionable", and nothing else (e.g. @everyone) can slip in.
  allowed_mentions?: { parse?: string[]; roles?: string[]; users?: string[] };
  // Per-message identity — set from the clan's bot appearance setting (lib/discordIdentity).
  username?: string;
  avatar_url?: string;
}

// General / plugin-updates webhook — clan-roster changes (member joins / leaves / renames / count)
// and any non-event-specific posts. NOT bingo-specific.
const GENERAL_WEBHOOK_KEY = 'discord_webhook_url';
// Dedicated bingo-event webhook (event start/end, draft, blackout, submissions). Falls back to the
// general webhook when unset so existing single-webhook setups keep receiving bingo posts.
const BINGO_WEBHOOK_KEY = 'discord_webhook_bingo';
// Where a clan wants posts from boards it doesn't own but plays on with others — boards it co-hosts,
// and (from the other side) a co-host receiving the host's posts. Falls back to the bingo channel.
const COHOST_WEBHOOK_KEY = 'discord_webhook_cohost';
// 'false' turns the co-host fan-out INTO this clan off. Its own boards post as always.
const COHOST_POSTS_KEY = 'discord_cohost_posts_enabled';
// Dedicated weekly competition (SOTW/BOTW) start/end/winner webhook.
const WEEKLY_WEBHOOK_KEY = 'discord_webhook_weekly';
// Dedicated sign-up channel — posts when an admin approves a sign-up, nudging the member to pay
// their entry fee. No fallback: stays silent until a dedicated webhook is set.
const SIGNUP_WEBHOOK_KEY = 'discord_webhook_signups';
/**
 * The coffer ledger's own channel. DELIBERATELY WITHOUT A FALLBACK, unlike every key above it: the
 * others are clan news and a general channel is a fine home for them, while this is a running
 * commentary on the clan's money. A clan that has not asked for that gets silence, not its
 * announcements channel filling with who donated what.
 */
const COFFER_WEBHOOK_KEY = 'discord_webhook_coffer';
const CHALLENGES_WEBHOOK_KEY = 'discord_webhook_challenges';
// Clan events (lib/clanEvents): a mass, a hangout. Falls back to the main channel.
const CLAN_EVENTS_WEBHOOK_KEY = 'discord_webhook_clan_events';
// Roster-sync summaries, falling back to the main channel.
const ROSTER_WEBHOOK_KEY = 'discord_webhook_roster';
// The shared "playing an event right now" role (lib/discord-teams) — a ping choice for event posts.
const PLAYER_ROLE_KEY = 'discord_bingo_role_id';

// Wraps the shared reader because a notify must never throw on a database hiccup — the post is
// best-effort, and losing it is better than failing whatever triggered it.
async function getSettingUrl(clanId: number, key: string): Promise<string | null> {
  try {
    return await getSettingText(clanId, key);
  } catch (error) {
    log.warn('discord.db-read-fail', { clanId, key }, error);
    return null;
  }
}

// A webhook setting may hold MULTIPLE URLs (newline / comma / space separated). Splitting a
// destination across several webhooks lets us round-robin posts and dodge Discord's per-webhook
// rate limit on busy clans. Only well-formed https URLs are kept.
export function parseWebhookUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((u) => /^https:\/\/\S+/i.test(u));
}

// Webhook pools (lib/webhookPool): the round-robin cursor and each webhook's rest after a 429 live
// here, in this process, for every sender in the app. Exported read-only for the advice on an
// event's Discord tab (lib/webhookCapacity).
const poolState = new WebhookPoolState();
export const webhookActivity = new ActivityMeter();

// Round-robin over a pool, skipping a webhook Discord has asked to wait. All resting: the next in turn
// anyway, and the send path waits it out. The pool is remembered so a caller that only kept the one
// URL (the plugin forwards) can still fail over to its siblings.
function pickCycledUrl(urls: string[], key: string): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  poolState.remember(urls);
  const choice = poolState.pick({ urls, cursorKey: key }, Date.now());
  return choice && 'url' in choice ? choice.url : urls[0];
}

// Parse a raw multi-URL setting value and pick one round-robin. Exported for callers that already
// hold the raw value (e.g. the plugin-notify route reads all channel webhooks in one batch).
export function pickWebhookUrl(raw: string | null | undefined, cursorKey: string): string | null {
  return pickCycledUrl(parseWebhookUrls(raw), cursorKey);
}

// Resolve a webhook destination: the first key in `keys` that has any URL(s) wins, and one of its
// URLs is chosen round-robin. Pass the master key (`discord_webhook_url`) last so every destination
// falls back to it — set only the master and everything posts there ("simple" mode); set the
// specific keys to split channels ("advanced" mode).
async function resolveWebhookDestination(
  clanId: number,
  ...keys: string[]
): Promise<{ urls: string[]; cursorKey: string } | null> {
  // The tile lab never posts (lib/lab). It has no webhooks configured anyway; this keeps it that way
  // even if someone pastes one into the lab clan's settings.
  if (await isHiddenHost(clanId)) return null;
  for (const key of keys) {
    const urls = parseWebhookUrls(await getSettingUrl(clanId, key));
    if (urls.length) return { urls, cursorKey: `${clanId}:${key}` };
  }
  return null;
}

// The destination as a pool; the send path picks which webhook. Round-robin cursor is per (clan, key):
// two clans sharing a key must not share a cursor.
function resolveWebhookTarget(clanId: number, ...keys: string[]): Promise<WebhookDestination | null> {
  return resolveWebhookDestination(clanId, ...keys);
}

/** The webhooks of an event's own channel ("A channel just for this event"): its main one, then the pool. */
export function eventChannelUrls(prefs: { webhookUrl?: string | null; extraWebhookUrls?: string[] }): string[] {
  if (!prefs.webhookUrl) return [];
  return [prefs.webhookUrl, ...(prefs.extraWebhookUrls ?? []).filter((u) => u !== prefs.webhookUrl)];
}

/** The meter key for an event's posts (lib/webhookCapacity reads it back). */
export const eventActivityKey = (eventId: number) => `event:${eventId}`;
/** The cursor key of an event's own channel pool. */
export const eventPoolKey = (eventId: number) => `event-channel:${eventId}`;

/**
 * Every webhook post leaves through here. Webhook URLs are typed in by clan staff and members, and
 * the server is the one that fetches them — so anything that is not a Discord webhook is refused
 * before a socket opens, whichever route stored or supplied it.
 */
async function webhookFetch(url: string, init: RequestInit): Promise<Response> {
  // A webhook platform staff blocked (lib/sharedWebhooks) posts nowhere, for any clan. The pool
  // filters these out first; this is the backstop for every other exit (tests, edits, deletes).
  if (await hasBlockedWebhook(url)) return new Response('webhook blocked by Anvil staff', { status: 403 });
  // Refused unless it's a Discord webhook (or one of its /messages/<id>), and never follows a redirect.
  return (await fetchDiscordWebhook(url, init, { subpaths: true })) ?? new Response('not a Discord webhook', { status: 400 });
}

/** A single URL, or a pool. A lone URL that was last seen in a pool fails over to that pool. */
type WebhookTarget = string | WebhookDestination;

function asDestination(target: WebhookTarget): WebhookDestination {
  if (typeof target !== 'string') return target;
  const urls = poolState.siblingsOf(target);
  // Start the round-robin on the URL the caller chose; only a 429 moves it to a sibling.
  return { urls: [target, ...urls.filter((u) => u !== target)], cursorKey: 'chosen', preferFirst: true };
}

/**
 * THE transport. Every webhook post leaves through here: round-robin over the destination's pool,
 * failover on a 429 (lib/webhookPool), and a bounded wait when every webhook is resting. `wait`
 * asks Discord to answer with the created message (the result's `response`), and `webhookUrl` says
 * which webhook owns it, for anything that later edits or deletes that post.
 */
export async function deliverWebhook(
  target: WebhookTarget,
  init: () => RequestInit,
  opts: { wait?: boolean; messageId?: string } = {},
): Promise<PoolSendResult> {
  const asked = asDestination(target);
  // Blocked webhooks (lib/sharedWebhooks) leave the pool; the rest carry the post.
  const blocked = await blockedWebhookIds();
  const urls = blocked.size ? asked.urls.filter((u) => !blocked.has(webhookIdOf(u) ?? '')) : asked.urls;
  if (urls.length === 0) {
    log.warn('discord.webhook-blocked', { cursorKey: asked.cursorKey, webhooks: asked.urls.length });
    return { ok: false, status: 403, blocked: true };
  }
  const dest = urls.length === asked.urls.length ? asked : { ...asked, urls };
  return sendThroughPool(
    dest,
    init,
    {
      state: poolState,
      fetch: webhookFetch,
      warn: (event, meta) => log.warn(event, meta),
      onRateLimited: (key) => webhookActivity.noteRateLimit(key),
    },
    (url) => (opts.wait || opts.messageId ? webhookRequestUrl(url, opts) : url),
  );
}

function jsonInit(payload: DiscordWebhookPayload): () => RequestInit {
  // Brand every embed here rather than in each builder: this is the single JSON exit to Discord,
  // so a post added later can't forget the footer.
  const body = JSON.stringify(stampEmbeds(payload));
  return () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
}

// Post to a webhook (or a pool of them) with Discord's 429 handling. Returns true on a 2xx.
async function sendToWebhook(target: WebhookTarget, payload: DiscordWebhookPayload, clanId?: number): Promise<boolean> {
  // The clan's chosen name and icon (Anvil's by default, which sets nothing).
  if (clanId != null) payload = { ...(await webhookIdentity(clanId)), ...payload };
  // A board post that may need editing later (lib/discordPosts): ask Discord for the message back,
  // and record it against the webhook that actually sent it (a pool may pick any of its webhooks).
  const ref = currentPostRef();
  try {
    const result = await deliverWebhook(target, jsonInit(payload), { wait: !!ref });
    if (!result.ok && result.response && result.status !== 429) {
      const text = await result.response.text().catch(() => '');
      log.warn('discord.webhook-fail', { status: result.status, body: text.slice(0, 200) });
    } else if (result.ok && ref && result.response && result.webhookUrl) {
      const message = (await result.response.json().catch(() => ({}))) as { id?: unknown; channel_id?: unknown };
      await recordDiscordPost(ref, result.webhookUrl, clanId, message);
    }
    return result.ok;
  } catch (error) {
    // Safe fields only: a fetch error can echo the webhook URL, token included.
    log.warn('discord.webhook-exception', { error: safeError(error) });
    return false;
  }
}

// Forward a plugin-originated notification (death / kill / rare drop / CA) to a clan webhook. The
// plugin POSTs these to /api/plugin/notify, which resolves the channel's webhook server-side and
// calls this — so the plugin never holds or calls the Discord URL itself (RuneLite plugin-hub rule).
// `embed` is arbitrary embed JSON built by the plugin; `image` is an optional screenshot the embed
// references via "attachment://<filename>".
export async function forwardPluginNotification(
  webhookUrl: string,
  payload: {
    content?: string;
    embed?: Record<string, unknown> | null;
    /**
     * File to upload alongside the post. Usually a screenshot the embed references via
     * "attachment://<filename>"; clips ride the same path as a video Discord renders its own
     * player for (an embed can host an image but not a video).
     */
    attachment?: { bytes: ArrayBuffer; filename: string } | null;
    /** The clan posting — its bot appearance setting names and pictures the post. */
    clanId?: number;
  },
): Promise<boolean> {
  const { content, embed, attachment, clanId } = payload;
  const embeds = embed ? [embed as unknown as DiscordEmbed] : undefined;
  // content/embed are plugin-supplied and reach here from anyone holding a plugin token, so neutralize
  // mentions: these clan notifications never legitimately ping, and without this a tampered plugin
  // could blast @everyone/@here/role pings through the webhook.
  const allowed_mentions: DiscordWebhookPayload['allowed_mentions'] = { parse: [] };

  if (!attachment) {
    return sendToWebhook(webhookUrl, { content: content || undefined, embeds, allowed_mentions }, clanId);
  }

  // Multipart upload so the file rides along; Discord renders an image inline via the embed's
  // attachment:// reference, and gives a video its own player. sendToWebhook is JSON-only, so this
  // path posts directly — which means it also has to stamp the brand footer itself (postWebhook
  // does it for every other exit).
  try {
    const payloadJson = JSON.stringify(
      stampEmbeds({ ...(clanId != null ? await webhookIdentity(clanId) : {}), content: content || undefined, embeds, allowed_mentions }),
    );
    // A fresh form per attempt: a failover resends the file to the next webhook in the pool.
    const result = await deliverWebhook(webhookUrl, () => {
      const form = new FormData();
      form.append('payload_json', payloadJson);
      form.append('files[0]', new Blob([attachment.bytes]), attachment.filename);
      return { method: 'POST', body: form };
    });
    if (!result.ok && result.response) {
      const text = await result.response.text().catch(() => '');
      log.warn('discord.plugin-notify-fail', { status: result.status, body: text.slice(0, 200) });
    }
    return result.ok;
  } catch (error) {
    log.warn('discord.plugin-notify-exception', {}, error);
    return false;
  }
}

/** The roster-sync summary: its own channel, else the main one. Off when the clan switched it off. */
export async function sendRosterWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  if (await feedOff(clanId, 'roster')) return false;
  const webhookUrl = await resolveWebhookTarget(clanId, ROSTER_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

/** Has the clan switched this feed off on its Discord page (lib/discordFeeds)? */
async function feedOff(clanId: number, feedId: string): Promise<boolean> {
  return parseFeedsOff(await getSettingUrl(clanId, FEEDS_OFF_KEY)).has(feedId);
}

// General / master channel — clan-roster sync summaries and other non-event posts. This is the
// webhook every other destination falls back to.
export async function sendDiscordWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookTarget(clanId, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

/** Anvil release notes (lib/releases): only where the clan set an "Anvil updates" channel, never the main one. */
export const ANVIL_UPDATES_WEBHOOK_KEY = 'discord_webhook_anvil_updates';
export async function sendAnvilUpdatesWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookTarget(clanId, ANVIL_UPDATES_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

// Bingo-event channel; falls back to the master webhook so single-webhook clans keep getting bingo
// posts until they split the channel.
export async function sendBingoWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookTarget(clanId, BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

/**
 * A post into a clan's server about a board it plays but doesn't own: its co-hosted-boards channel,
 * else its bingo channel, else its master one. 'skipped' when the clan switched the fan-out off or
 * has nowhere to post — neither is a failure, the clan simply didn't ask.
 */
export async function sendCohostWebhook(
  clanId: number,
  payload: DiscordWebhookPayload,
): Promise<'sent' | 'skipped' | 'failed'> {
  const enabled = (await getSettingUrl(clanId, COHOST_POSTS_KEY))?.trim();
  if (enabled === 'false' || enabled === '0') return 'skipped';
  const url = await resolveWebhookTarget(clanId, COHOST_WEBHOOK_KEY, BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!url) return 'skipped';
  return (await sendToWebhook(url, payload, clanId)) ? 'sent' : 'failed';
}

/** Would sendCohostWebhook have somewhere to post for this clan? (The host's partner readiness list.) */
export async function cohostChannelReady(clanId: number): Promise<boolean> {
  const enabled = (await getSettingUrl(clanId, COHOST_POSTS_KEY))?.trim();
  if (enabled === 'false' || enabled === '0') return false;
  return !!(await resolveWebhookTarget(clanId, COHOST_WEBHOOK_KEY, BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY));
}

/** A post into a clan's OWN bingo channel, saying why it didn't land. */
export async function sendBingoWebhookReport(
  clanId: number,
  payload: DiscordWebhookPayload,
): Promise<'sent' | 'skipped' | 'failed'> {
  const url = await resolveWebhookTarget(clanId, BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!url) return 'skipped';
  return (await sendToWebhook(url, payload, clanId)) ? 'sent' : 'failed';
}

export interface EditableWebhookResult {
  status: 'sent' | 'skipped' | 'failed';
  action?: 'posted' | 'updated';
  messageId?: string;
}

function webhookRequestUrl(webhookUrl: string, opts: { messageId?: string; wait?: boolean }): string {
  const url = new URL(webhookUrl);
  if (opts.messageId) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/messages/${encodeURIComponent(opts.messageId)}`;
  }
  if (opts.wait) url.searchParams.set('wait', 'true');
  return url.toString();
}

/**
 * One request to ONE webhook (a read, edit or delete of a message it owns), through the pool transport
 * so a 429 is waited out, the rest is shared with every other sender, and a blocked webhook is refused.
 * Never fails over: a message belongs to the webhook that sent it.
 */
async function editableWebhookRequest(url: string, method: 'POST' | 'PATCH' | 'GET' | 'DELETE', payload?: DiscordWebhookPayload): Promise<Response> {
  const body = payload ? JSON.stringify(payload) : undefined;
  const result = await deliverWebhook({ urls: [url], cursorKey: 'edit' }, () => ({
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
    signal: AbortSignal.timeout(10_000),
  }));
  return result.response ?? new Response(null, { status: result.status || 502 });
}

/**
 * A message one of our webhooks sent, read back (to edit it in place) — null when it's gone or the
 * webhook no longer works. 429s are waited out like every other webhook call.
 */
export async function getWebhookMessage(webhookUrl: string, messageId: string): Promise<{ embeds?: DiscordEmbed[]; content?: string | null } | null> {
  try {
    const res = await editableWebhookRequest(webhookRequestUrl(webhookUrl, { messageId }), 'GET');
    if (!res.ok) return null;
    return (await res.json()) as { embeds?: DiscordEmbed[]; content?: string | null };
  } catch {
    return null;
  }
}

/** Edit a message one of our webhooks sent. True on success. */
export async function editWebhookMessage(webhookUrl: string, messageId: string, payload: DiscordWebhookPayload): Promise<boolean> {
  try {
    const res = await editableWebhookRequest(webhookRequestUrl(webhookUrl, { messageId }), 'PATCH', payload);
    if (!res.ok) log.warn('discord.webhook-edit-fail', { status: res.status });
    return res.ok;
  } catch {
    return false;
  }
}

/** Delete a message one of our webhooks sent. A message already gone (404) counts as deleted. */
export async function deleteWebhookMessage(webhookUrl: string, messageId: string): Promise<boolean> {
  try {
    const res = await editableWebhookRequest(webhookRequestUrl(webhookUrl, { messageId }), 'DELETE');
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/**
 * Edit an earlier webhook post when its message id is known; otherwise post once with `wait=true`
 * so Discord returns the new id. A missing old message (or a replaced destination webhook) falls
 * back to a fresh post, while other edit failures do not risk creating a duplicate.
 */
async function upsertWebhookMessage(
  destination: { urls: string[]; cursorKey: string },
  payload: DiscordWebhookPayload,
  clanId: number,
  existingMessageId?: string,
): Promise<EditableWebhookResult> {
  try {
    const stamped = stampEmbeds(payload);
    if (existingMessageId) {
      // A destination may round-robin several webhooks. The message belongs to exactly one of
      // them, so try each configured token before deciding the old post disappeared.
      for (const webhookUrl of destination.urls) {
        // An edit must go to the webhook that owns the message, so this one never fails over.
        const body = JSON.stringify(stamped);
        const edit = (
          await deliverWebhook(
            { urls: [webhookUrl], cursorKey: 'edit' },
            () => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }),
            { messageId: existingMessageId },
          )
        ).response;
        if (!edit) return { status: 'failed' };
        if (edit.ok) return { status: 'sent', action: 'updated', messageId: existingMessageId };
        if (edit.status !== 404) {
          const body = await edit.text().catch(() => '');
          log.warn('discord.webhook-edit-fail', { clanId, status: edit.status, body: body.slice(0, 200) });
          return { status: 'failed' };
        }
      }
    }

    if (destination.urls.length === 0) return { status: 'skipped' };
    const createBody = JSON.stringify(stampEmbeds({ ...(await webhookIdentity(clanId)), ...payload }));
    const created = await deliverWebhook(
      destination,
      () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createBody }),
      { wait: true },
    );
    const create = created.response;
    if (!create) return { status: 'failed' };
    if (!create.ok) {
      const body = await create.text().catch(() => '');
      log.warn('discord.webhook-create-fail', { clanId, status: create.status, body: body.slice(0, 200) });
      return { status: 'failed' };
    }
    const body = (await create.json().catch(() => ({}))) as { id?: unknown };
    return {
      status: 'sent',
      action: 'posted',
      ...(typeof body.id === 'string' && body.id ? { messageId: body.id } : {}),
    };
  } catch (error) {
    log.warn('discord.webhook-upsert-exception', { clanId, error: safeError(error) });
    return { status: 'failed' };
  }
}

/** Rules-post variant: unlike general notifications, it can update the post it created earlier. */
export async function upsertBingoWebhookReport(
  clanId: number,
  payload: DiscordWebhookPayload,
  existingMessageId?: string,
  // An event's own channel (one URL, or its pool), used in place of the clan's bingo channel.
  overrideUrl?: string | string[] | null,
): Promise<EditableWebhookResult> {
  const override = typeof overrideUrl === 'string' ? [overrideUrl] : overrideUrl ?? [];
  const destination = override.length
    ? { urls: override, cursorKey: `${clanId}:override` }
    : await resolveWebhookDestination(clanId, BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!destination) return { status: 'skipped' };
  return upsertWebhookMessage(destination, payload, clanId, existingMessageId);
}

/** Co-host rules-post variant, respecting that clan's fan-out opt-out and preferred channel. */
export async function upsertCohostWebhook(
  clanId: number,
  payload: DiscordWebhookPayload,
  existingMessageId?: string,
  // This co-host's own channel for the board, in place of its co-hosted-boards channel.
  overrideUrl?: string | null,
): Promise<EditableWebhookResult> {
  const enabled = (await getSettingUrl(clanId, COHOST_POSTS_KEY))?.trim();
  if (enabled === 'false' || enabled === '0') return { status: 'skipped' };
  const destination = overrideUrl
    ? { urls: [overrideUrl], cursorKey: `${clanId}:override` }
    : await resolveWebhookDestination(clanId, COHOST_WEBHOOK_KEY, BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!destination) return { status: 'skipped' };
  return upsertWebhookMessage(destination, payload, clanId, existingMessageId);
}

/**
 * A post about one board, to EVERY clan on it: the host's bingo channel, plus each accepted
 * co-host's co-hosted-boards channel (falling back to its bingo channel). Symmetric by construction
 * — keyed on the event, so a clan gets its co-hosted boards' posts whichever side of the seat it's on.
 *
 * `ping` pings each clan's OWN member role in its own server; a role id means nothing elsewhere.
 * Returns the HOST's result, which is what every caller reported before co-hosts existed; a co-host
 * with no webhook (or the fan-out switched off) is skipped quietly.
 */
/** The clan that owns an event. A host never changes, so it is remembered for a while. */
function eventHostClanId(eventId: number): Promise<number | null> {
  return ttlMemo(
    `event-host:${eventId}`,
    async () => {
      // clan-scope: global -- reads only which clan owns this event, to address that clan's channel.
      const [row] = await db.select({ clanId: events.clanId }).from(events).where(eq(events.id, eventId)).limit(1);
      return row?.clanId ?? null;
    },
    10 * 60_000,
  ).catch(() => null);
}

/** Is this event's standings curtain down right now? Read fresh: the reveal must not lag a cache. */
async function eventStandingsHidden(eventId: number): Promise<boolean> {
  // clan-scope: global -- reads one event's own rule and clock, by id, to decide its own posts.
  const [row] = await db
    .select({ rules: events.rules, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return row ? standingsHidden(row) : false;
}

/** The mention a ping choice turns into, in one clan's own server. */
async function pingFor(clanId: number, choice: PingChoice): Promise<Pick<DiscordWebhookPayload, 'content' | 'allowed_mentions'>> {
  if (choice === 'none') return {};
  if (choice === 'members') return memberPing(clanId);
  const roleId = await getSettingUrl(clanId, PLAYER_ROLE_KEY);
  return roleId ? { content: `<@&${roleId}>`, allowed_mentions: { parse: [], roles: [roleId] } } : {};
}

/**
 * Whether the HOST of `eventId` posts this one, and with which ping — for posts that don't go through
 * sendEventBingoWebhook (payouts, the start hold, the monthly champion, sign-up approvals).
 */
export async function eventPostDecision(
  hostClanId: number,
  eventId: number | null | undefined,
  post: DiscordPostType,
): Promise<PostDecision> {
  if (eventId == null) return clanDefault(post, await loadClanPostDefaults(hostClanId));
  const [clan, prefs] = await Promise.all([loadClanPostDefaults(hostClanId), loadEventDiscordPrefs(eventId)]);
  return decideHostPost(post, clan, prefs);
}

export async function sendEventBingoWebhook(
  hostClanId: number,
  eventId: number | null | undefined,
  payload: DiscordWebhookPayload,
  // `post` names what this is (lib/discordPostPolicy): it decides, per clan, whether the post goes
  // out and who it pings, and which extra webhooks (lib/eventWebhooks) want it. `teamId` narrows
  // those to a team's own hooks.
  // `tileId`: the tile the post names, when it isn't already on the post's ref (lib/discordPosts).
  opts: { post: DiscordPostType; teamId?: number | null; tileId?: number | null; tileIds?: number[] },
): Promise<boolean> {
  const info = postTypeInfo(opts.post);

  if (eventId == null) {
    const d = clanDefault(opts.post, await loadClanPostDefaults(hostClanId));
    if (!d.send) return false;
    return sendBingoWebhook(hostClanId, { ...(await pingFor(hostClanId, d.ping)), ...payload });
  }

  // THE EVENT NAMES ITS HOST, not the caller. Callers pass whichever clan they were working in, and
  // for a co-hosted board that is often the CO-HOST — a live KC push from one of its members, a
  // captain completing a tile from their own clan's address. Taken as the host, that clan got the
  // "host" post into a bingo channel it may not have, the real host was never in the co-host list
  // so its server heard nothing, and the co-host's own channel was skipped as "the host". The
  // event's extra hooks don't care who hosts, which is why only they kept posting.
  const host = (await eventHostClanId(eventId)) ?? hostClanId;
  hostClanId = host;
  // A tile-lab board announces nothing, anywhere — not to co-hosts, not to its extra hooks (lib/lab).
  if (await isHiddenHost(hostClanId)) return false;

  const [clanDefaults, prefs] = await Promise.all([loadClanPostDefaults(hostClanId), loadEventDiscordPrefs(eventId)]);
  const hostDecision = decideHostPost(opts.post, clanDefaults, prefs);
  // Off for the event is off everywhere — the host's server, the co-hosts', the extra hooks.
  if (!hostDecision.send) return false;

  // HIDDEN STANDINGS (lib/standingsVisibility). While the host keeps the standings back, a post that
  // tells a reader how a team is doing never reaches a shared channel — the host's, a co-host's, a
  // whole-event hook. A team's OWN hook still hears about its own team. Dropped, not queued: the
  // reveal posts one summary of the standings instead (lib/standingsReveal).
  //
  // HIDDEN TILES (lib/raceHideAhead) ride the same route: a progress post naming a race tile that some
  // OTHER team still sees as a locked "?" goes to the posting team's own channel only. The tile comes
  // from the post's ref (lib/discordPosts) when the caller didn't name it.
  const refTile = opts.tileId ?? currentPostRef()?.tileId ?? null;
  const namedTiles = opts.tileIds ?? (refTile != null ? [refTile] : []);
  const route = PROGRESS_POST_KINDS.has(opts.post)
    ? curtainRoute(
        opts.post,
        opts.teamId,
        await eventStandingsHidden(eventId),
        namedTiles.length > 0 &&
          (await Promise.all(namedTiles.map((id) => raceTileHiddenFromOthers(eventId, id, opts.teamId).catch(() => true)))).some(Boolean),
      )
    : { shared: true, teamOnly: null };
  if (!route.shared) {
    if (route.teamOnly == null || !info.hook) return false;
    const hooks = await eventHookTargets(eventId, { kind: info.hook, teamId: route.teamOnly }).catch(() => []);
    const own = hooks.filter((h) => h.teamId === route.teamOnly);
    const sent = await Promise.all(own.map((h) => sendToWebhook(h.url, payload, hostClanId)));
    return sent.some(Boolean);
  }

  // How busy this event is, for the "add more webhooks" advice (lib/webhookCapacity).
  webhookActivity.notePost(eventActivityKey(eventId));

  // The event's own channel (with its pool of webhooks) when it has one, else the clan's bingo channel.
  const ownUrls = eventChannelUrls(prefs);
  const hostSend = pingFor(hostClanId, hostDecision.ping).then((ping) =>
    ownUrls.length
      ? sendToWebhook({ urls: ownUrls, cursorKey: eventPoolKey(eventId) }, { ...ping, ...payload }, hostClanId)
      : sendBingoWebhook(hostClanId, { ...ping, ...payload }),
  );

  const cohosts = hostShares(opts.post, prefs) ? await acceptedCohostClanIds(eventId).catch(() => [] as number[]) : [];
  await Promise.all(
    cohosts
      .filter((id) => id !== hostClanId)
      .map(async (clanId) => {
        const partner = await loadPartnerDiscordPrefs(eventId, clanId);
        const d = decidePartnerPost(opts.post, hostDecision, prefs, partner);
        if (!d.send) return;
        const body = { ...(await pingFor(clanId, d.ping)), ...payload };
        const sent = partner.webhookUrl
          ? ((await sendToWebhook(partner.webhookUrl, body, clanId)) ? 'sent' : 'failed')
          : await sendCohostWebhook(clanId, body);
        if (sent === 'failed') log.warn('discord.cohost-fanout-fail', { eventId, clanId });
      }),
  );
  if (info.hook) {
    // Extra hooks get the post WITHOUT the ping: a clan's role id means nothing in another server.
    const kind = info.hook;
    const hooks = await eventHookTargets(eventId, { kind, teamId: opts.teamId ?? null }).catch(() => []);
    await Promise.all(
      hooks.map(async (h) => {
        const ok = await sendToWebhook(h.url, payload, hostClanId);
        if (!ok) log.warn('discord.event-hook-fail', { eventId, hookId: h.id, kind });
      }),
    );
  }
  return hostSend;
}

// Weekly-competition channel; falls back to the master webhook when no dedicated one is set.
export async function sendWeeklyWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  if (await feedOff(clanId, 'weekly')) return false;
  const webhookUrl = await resolveWebhookTarget(clanId, WEEKLY_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

/** Members' head-to-heads (lib/h2h): its own channel only, so a clan that never set one hears nothing. */
export async function sendChallengesWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  if (await feedOff(clanId, 'challenges')) return false;
  const webhookUrl = await resolveWebhookTarget(clanId, CHALLENGES_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

/**
 * The coffer channel, and only it — see COFFER_WEBHOOK_KEY for why there is no fallback. Returns
 * false when unconfigured, which every caller treats as "fine, nobody asked for this".
 */
export async function sendCofferWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  if (await feedOff(clanId, 'coffer')) return false;
  const webhookUrl = await resolveWebhookTarget(clanId, COFFER_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

// Sign-up approvals channel; falls back to the master webhook when no dedicated one is set.
export async function sendSignupWebhook(clanId: number, payload: DiscordWebhookPayload): Promise<boolean> {
  if (await feedOff(clanId, 'signups')) return false;
  const webhookUrl = await resolveWebhookTarget(clanId, SIGNUP_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload, clanId);
}

interface SignupApprovedNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventId: number;
  eventName: string;
  displayName: string;
  discordId: string | null;
  rsn: string;
  feeAmount: number | null; // gp; null / 0 = free event
  feeAlreadyPaid: boolean;
}

// Posted when an admin approves a sign-up. Pings the approved member and nudges them to pay the
// entry fee so approvals convert into paid, committed seats. Fire-and-forget from the approve action.
export async function notifySignupApproved(params: SignupApprovedNotifyParams): Promise<boolean> {
  const { eventId, eventName, displayName, discordId, rsn, feeAmount, feeAlreadyPaid } = params;
  if (!(await eventPostDecision(params.clanId, eventId, 'signupApproved')).send) return false;
  const base = siteBaseUrl();
  const signupUrl = base ? `${base}/events/${eventId}/signup` : null;
  const hasFee = !!feeAmount && feeAmount > 0;

  const lines = [`**${displayName}** (\`${rsn}\`) is approved for **${eventName}**! 🎉`];
  if (hasFee && !feeAlreadyPaid) {
    lines.push(
      '',
      `💰 Lock your spot — pay the **${feeAmount!.toLocaleString()} gp** entry fee, then report it on the site.`,
    );
    if (signupUrl) lines.push(`→ [Pay & report your fee](${signupUrl})`);
  } else if (hasFee && feeAlreadyPaid) {
    lines.push('', "✅ Fee already received — you're locked in. Good luck!");
  }

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '✅ Sign-up approved',
    description: lines.join('\n'),
    color: EMBED_COLOR.green,
  };

  return sendSignupWebhook(params.clanId, {
    content: discordId ? `<@${discordId}>` : undefined,
    embeds: [embed],
    // Ping only the approved member; never @everyone/roles.
    allowed_mentions: discordId ? { parse: [], users: [discordId] } : { parse: [] },
  });
}

/** A sample post to one event webhook, saying what it will receive — the admin panel's Test button. */
export async function sendEventHookTest(
  eventId: number,
  webhookUrl: string,
  kinds: EventPostKind[],
  teamId: number | null,
): Promise<boolean> {
  // clan-scope: global -- the caller has already scoped the event to the admin's clan.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { name: true, clanId: true } });
  if (!event) return false;
  const team = teamId != null
    ? await db.query.teams.findFirst({ where: eq(teams.id, teamId), columns: { name: true } })
    : null;
  const labels = EVENT_POST_KINDS.filter((k) => kinds.includes(k.key)).map((k) => `• ${k.label}`);
  return sendToWebhook(webhookUrl, {
    embeds: [{
      ...eventAuthor(eventId, event.name),
      title: '✅ Event webhook connected',
      description: [
        team ? `This channel gets **${team.name}**’s posts from this event:` : 'This channel gets this event’s posts:',
        ...labels,
      ].join('\n'),
      color: EMBED_COLOR.green,
    }],
  }, event.clanId);
}

export async function sendTestWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await webhookFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Posts straight to the URL under test (it isn't a configured destination yet), so it stamps
      // the brand footer itself — this is also the admin's first look at the house style.
      body: JSON.stringify(
        stampEmbeds({
          embeds: [{
            title: '✅ Webhook connected',
            description: 'This channel is wired up. Anvil will post here.',
            color: EMBED_COLOR.green,
          }],
        }),
      ),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send test webhook:', error);
    return false;
  }
}

// The author line every board post opens with: "<event>" or "<event> · <team>", linking to the
// event page when the site URL is known. It carries the context that used to sit in three inline
// Event/Tile/Team fields, which frees the title to say what actually happened.
function eventAuthor(
  eventId: number | null | undefined,
  eventName: string,
  teamName?: string | null,
): Pick<DiscordEmbed, 'author'> {
  const name = teamName ? `${eventName} · ${teamName}` : eventName;
  const url = eventId != null ? eventLeaderboardUrl(eventId) : null;
  return { author: { name: clamp(name, LIMIT.author), ...(url ? { url } : {}) } };
}

// Thumbnail for a tile-driven post — the tile's own item/skill/boss sprite, the same image the
// board renders. Absent for tiles with no derivable icon (e.g. manual tiles).
function tileThumbnail(tile: IconableTile | null | undefined): Pick<DiscordEmbed, 'thumbnail'> {
  const icon = tile ? deriveTileIcon(tile) : null;
  return icon ? { thumbnail: { url: discordAssetUrl(icon) } } : {};
}

// Discord renders <t:UNIX:STYLE> dynamically per viewer: the timezone is the
// reader's own, and the `R` (relative) style is a live countdown that ticks
// down on its own — no re-posting needed. Far better than a server-side
// toLocaleString(), which would bake in the server's UTC clock for everyone.
//   F = full date+time (e.g. "Friday, June 26, 2026 8:00 PM")
//   R = relative/countdown (e.g. "in 3 days")
function discordTime(date: string | Date, style: 'F' | 'R' = 'F'): string {
  const secs = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${secs}:${style}>`;
}

interface SubmissionNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  /** The team it's about — routes it to that team's event webhooks. */
  teamId?: number | null;
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  creditPlayerName: string | null;
  amount: number;
  currentTotal: number;
  requiredAmount: number | null;
  note: string | null;
  imageUrl: string | null;
  // Tile kind so the embed can label itself ('drop' | 'kill' | 'timed'). Defaults to drop.
  tileType?: string | null;
  // Timed-tile clear time in seconds (shown as mm:ss). Null for drop/kill submissions.
  durationSeconds?: number | null;
  // True when this submission completed the tile — folds the old separate completion post into
  // this one message so a completing submission costs the bingo webhook one request, not two.
  completed?: boolean;
  // Links the author line to the live board. Optional: older callers just get an unlinked line.
  eventId?: number | null;
  // The tile row, for its icon (the thumbnail). Optional — no icon, no thumbnail.
  tile?: LinkedTile | null;
  /** The submission this post is about, so it can be found again (lib/discordPosts). */
  submissionIds?: number[];
}

function formatClearTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Headline for a submission post. Completions get their own line; otherwise the tile kind names
// what landed. The tile label rides in the title (it used to be a field) so the post reads as a
// sentence at a glance in a busy channel.
function submissionTitle(tileType: string | null | undefined, tileLabel: string, completed: boolean): string {
  const lead = completed
    ? '✅ Tile complete'
    : tileType === 'timed' ? '⏱️ Timed clear'
    : tileType === 'kill' ? '⚔️ Kill'
    : tileType === 'lap' ? '🏃 Laps'
    : tileType === 'pvp' ? '💀 PvP kill'
    : '🎯 Drop';
  return clamp(`${lead} — ${tileLabel}`, LIMIT.title);
}

export async function notifySubmission(params: SubmissionNotifyParams): Promise<boolean> {
  const {
    eventName,
    tileLabel,
    teamName,
    teamColor,
    creditPlayerName,
    amount,
    currentTotal,
    requiredAmount,
    note,
    imageUrl,
    tileType,
    durationSeconds,
    completed,
    eventId,
    tile,
  } = params;

  const fields: DiscordEmbedField[] = [];

  if (tileType === 'timed' && durationSeconds != null) {
    fields.push(statField('Clear time', formatClearTime(durationSeconds)));
  } else if (tileType === 'kill' || tileType === 'pvp') {
    fields.push(statField('Kills', requiredAmount ? `+${amount} · ${currentTotal}/${requiredAmount}` : `+${amount}`));
  } else if (tileType === 'lap') {
    fields.push(statField('Laps', requiredAmount ? `+${amount} · ${currentTotal}/${requiredAmount}` : `+${amount}`));
  } else if (requiredAmount) {
    fields.push(statField('Progress', `+${amount} · ${currentTotal}/${requiredAmount}`));
  }

  if (note) {
    fields.push(field('Note', pluginNote(note, eventId != null ? tileBoardUrl(eventId, tile) : null), false));
  }

  const who = creditPlayerName ? `**${creditPlayerName}**` : 'Someone';
  const description = completed
    ? `${who} finished it for **${teamName}**.`
    : `${who} submitted for **${teamName}**.`;

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: submissionTitle(tileType, tileLabel, !!completed),
    description,
    color: teamColorToDecimal(teamColor),
    ...(fields.length ? { fields } : {}),
  };

  const boardUrl = eventId != null ? tileBoardUrl(eventId, tile) : null;
  if (boardUrl) embed.url = boardUrl;
  if (imageUrl) embed.image = { url: imageUrl };

  return withPostRef({ kind: params.completed ? 'submissionComplete' : 'submission', clanId: params.clanId, eventId: params.eventId, tileId: params.tile?.id ?? null, teamId: params.teamId, submissionIds: params.submissionIds }, () => sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'submissions', teamId: params.teamId }));
}

// Merged/debounced variant of notifySubmission. Several submissions for the same tile+team that
// arrived within a quiet window collapse into ONE post: `pendingAmount` is the total accrued since
// the last flush, `currentTotal`/`requiredAmount` the live standing. Used by the server-side
// notification debounce so a kill spree (or a downtime boss ticking one kill at a time) is a single
// embed instead of one per submission. Mirrors notifySubmission's layout so the feed reads uniformly.
interface MergedSubmissionParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  /** The team it's about — routes it to that team's event webhooks. */
  teamId?: number | null;
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  tileType?: string | null;
  creditPlayerName?: string | null;
  pendingAmount: number;
  currentTotal: number | null;
  requiredAmount: number | null;
  note: string | null;
  imageUrl: string | null;
  completed: boolean;
  /** Kill-milestone post (25/50/75) — said in the description instead of "made progress". */
  milestonePct?: number | null;
  eventId?: number | null;
  tile?: LinkedTile | null;
  /** The submissions merged into this post, so it can be found again (lib/discordPosts). */
  submissionIds?: number[];
}

export async function notifyMergedSubmission(params: MergedSubmissionParams): Promise<boolean> {
  const {
    eventName, tileLabel, teamName, teamColor, tileType, creditPlayerName,
    pendingAmount, currentTotal, requiredAmount, note, imageUrl, completed, eventId, tile,
  } = params;

  const fields: DiscordEmbedField[] = [];

  const progress = requiredAmount != null && currentTotal != null
    ? ` · ${currentTotal}/${requiredAmount}`
    : '';
  fields.push(
    statField(
      tileType === 'kill' || tileType === 'pvp' ? 'Kills' : tileType === 'lap' ? 'Laps' : 'Progress',
      `+${pendingAmount}${progress}`,
    ),
  );

  if (note) {
    fields.push(field('Note', pluginNote(note, eventId != null ? tileBoardUrl(eventId, tile) : null), false));
  }

  // Who the credit went to — matches notifySubmission's wording so merged posts read the same.
  const who = creditPlayerName ? `**${creditPlayerName}**` : 'The team';
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: submissionTitle(tileType, tileLabel, completed),
    description: completed
      ? `${who} finished it for **${teamName}**.`
      : params.milestonePct
        ? `**${teamName}** is ${params.milestonePct}% of the way there.`
        : `${who} made progress for **${teamName}**.`,
    color: teamColorToDecimal(teamColor),
    fields,
  };

  const boardUrl = eventId != null ? tileBoardUrl(eventId, tile) : null;
  if (boardUrl) embed.url = boardUrl;
  if (imageUrl) embed.image = { url: imageUrl };

  return withPostRef({ kind: params.completed ? 'submissionComplete' : 'submission', clanId: params.clanId, eventId: params.eventId, tileId: params.tile?.id ?? null, teamId: params.teamId, submissionIds: params.submissionIds }, () => sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'submissions', teamId: params.teamId }));
}

interface SubmissionDeletedParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  /** The team it's about — routes it to that team's event webhooks. */
  teamId?: number | null;
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  creditPlayerName: string | null;
  amount: number;
  deletedBy: string;
  deletedByRole: string;
  reason: string;
  eventId?: number | null;
  tile?: LinkedTile | null;
}

export async function notifySubmissionDeleted(params: SubmissionDeletedParams): Promise<boolean> {
  // teamColor is accepted for call-site symmetry but deliberately unused: a removal reads as a
  // correction, so it's always red rather than the team's colour.
  const {
    eventName,
    tileLabel,
    teamName,
    creditPlayerName,
    amount,
    deletedBy,
    deletedByRole,
    reason,
    eventId,
    tile,
  } = params;

  const fields: DiscordEmbedField[] = [
    statField('Removed', `−${amount}`),
    field('By', `${deletedBy} (${deletedByRole})`),
    field('Reason', reason, false),
  ];

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: clamp(`🗑️ Submission removed — ${tileLabel}`, LIMIT.title),
    description: creditPlayerName
      ? `A submission credited to **${creditPlayerName}** was taken off **${teamName}**'s board.`
      : `A submission was taken off **${teamName}**'s board.`,
    color: EMBED_COLOR.red,
    fields,
  };

  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'submissionRemoved', teamId: params.teamId, tileId: params.tile?.id ?? null });
}

interface TileCompletionNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  /** The team it's about — routes it to that team's event webhooks. */
  teamId?: number | null;
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  tileType: string;
  trackedStat?: string | null;
  statType?: string | null;
  eventId?: number | null;
  tile?: LinkedTile | null;
  /** Whose update took it over the line, when it was one person's. */
  finisher?: string | null;
  /** Everyone who put work in, biggest first, with their share (KC / XP, capped at the goal). */
  contributors?: { name: string; amount: number }[];
  /**
   * A COMBO PART finishing (lib/combo) — posted as progress on its combo ("1 of 2"), not as a tile
   * complete: the part isn't a board cell and scores nothing; its combo does. `tile` should be the
   * combo, so the link opens the cell that's on the board.
   */
  partOf?: { label: string; done: number; needed: number } | null;
}

const CONTRIBUTORS_SHOWN = 5;

export async function notifyTileCompletion(params: TileCompletionNotifyParams): Promise<boolean> {
  const {
    eventName,
    tileLabel,
    teamName,
    teamColor,
    tileType,
    trackedStat,
    statType,
    eventId,
    tile,
    finisher,
    contributors = [],
    partOf,
  } = params;

  // What kind of goal was met — kept as one short field rather than the old four-field block, since
  // the event/tile/team now live in the author line and title.
  // A KC / XP tile is any tile tracking a stat, whatever its tileType says (statType 'skill' | 'boss' | 'kc').
  let typeDescription = 'Tile';
  const unit = statType === 'skill' || statType === 'xp' ? 'XP' : 'KC';
  if (tileType === 'drop') {
    typeDescription = 'Drop';
  } else if (tileType === 'combo') {
    typeDescription = 'Combo';
  } else if (trackedStat || tileType === 'stat') {
    typeDescription = `${unit} goal`;
  }
  // Who did it, not just which team: whose update crossed the line, then everyone who put work in.
  const people = contributors.filter((c) => c.name);
  const lines = people.slice(0, CONTRIBUTORS_SHOWN).map((c) =>
    c.amount > 0 ? `${c.name} · ${c.amount.toLocaleString('en-US')} ${unit}` : c.name,
  );
  if (people.length > CONTRIBUTORS_SHOWN) lines.push(`+${people.length - CONTRIBUTORS_SHOWN} more`);

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: clamp(
      partOf ? `🧩 ${partOf.label} — ${Math.min(partOf.done, partOf.needed)} of ${partOf.needed}` : `✅ Tile complete — ${tileLabel}`,
      LIMIT.title,
    ),
    description: partOf
      ? `${finisher ? `**${finisher}** did` : `**${teamName}** did`} *${tileLabel}* — part of **${partOf.label}**.`
      : finisher ? `**${finisher}** finished it for **${teamName}**.` : `**${teamName}** cleared it.`,
    color: teamColorToDecimal(teamColor),
    fields: [
      statField('Type', typeDescription),
      // A lone finisher is already named above; a list is only worth it with more than them.
      ...(people.length > 1 || (people.length === 1 && !finisher) ? [field('Contributors', lines.join('\n'), false)] : []),
    ],
  };

  const boardUrl = eventId != null ? tileBoardUrl(eventId, tile) : null;
  if (boardUrl) embed.url = boardUrl;

  // The other teams' in-game chat, on a board whose host turned the feed on (lib/chatFeed). Not for a
  // combo part: it scores nothing on its own, and its combo announces when it lands.
  if (eventId != null && !partOf) {
    void emitTileCompletion({ eventId, teamId: params.teamId, teamName, tileLabel, finisher, tileId: tile?.id ?? null });
  }
  const send = () => sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'tileComplete', teamId: params.teamId, tileId: tile?.id ?? null });
  // Kept (lib/discordPosts) so a rolled-back completion can find its post. A combo part's progress
  // post isn't a completion; it isn't kept.
  return partOf ? send() : withPostRef({ kind: 'tileComplete', clanId: params.clanId, eventId: params.eventId, tileId: tile?.id ?? null, teamId: params.teamId }, send);
}

interface TilesRevealedNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventName: string;
  /**
   * `icon` (when the tile has one) becomes the thumbnail on a single-tile reveal. `prizeGp` is the
   * gp riding on the tile's first place — the number that decides whether anyone gets out of bed.
   */
  tiles: { label: string; points: number | null; icon?: string | null; prizeGp?: number }[];
  /** Show per-tile point values (points-scoring events only). */
  pointsMode: boolean;
  /** Hidden tiles left after this reveal — the "more to come" teaser. */
  hiddenRemaining: number;
  /** 'bounty' posts a claim-framed title. */
  bounty?: boolean;
  /** Mission announce (mid-event objective drop) — posts mission-framed wording. */
  mission?: boolean;
  /** Links the author line + title to the board. */
  eventId?: number | null;
  /** When the next batch is due, for a live countdown. Null on bounty (draws on a claim instead). */
  nextRevealAt?: string | null;
  /** A double-value day, from the daily schedule. 1 (or absent) is an ordinary drop. */
  multiplier?: number;
}

// Reveal-engine post: fired once per reveal batch (scheduled due-times, interval draws, bounty
// next-tile, mission announces). One embed per batch, not per tile, so an interval batch of 5 is a
// single post.
export async function notifyTilesRevealed(params: TilesRevealedNotifyParams): Promise<boolean> {
  const { eventName, tiles, pointsMode, hiddenRemaining, bounty, mission, eventId, nextRevealAt } = params;
  if (tiles.length === 0) return false;
  const boost = params.multiplier && params.multiplier !== 1 ? params.multiplier : null;

  const noun = mission ? 'mission' : 'tile';
  const single = tiles.length === 1;

  // A single reveal is the common case (batch size 1, bounty, most mission drops) and deserves to
  // read as one thing rather than a bullet list of one: the tile's name IS the headline, its art is
  // the thumbnail, and its value is a boxed field like every other number Anvil posts.
  const boostTag = boost ? `${boost % 1 === 0 ? boost : boost.toFixed(1)}x ` : '';
  const title = mission
    ? single
      ? `⚡ New ${boostTag}mission: ${tiles[0].label}`
      : `⚡ ${tiles.length} new ${boostTag}missions are live!`
    : bounty
      ? `🎯 New bounty: ${tiles[0].label}`
      : single
        ? `🔓 Now open: ${tiles[0].label}`
        : `🔓 ${tiles.length} new ${noun}s revealed!`;

  const lines = single
    ? []
    : tiles
        .slice(0, 15)
        .map(
          (t) =>
            `• **${t.label}**${pointsMode && t.points != null ? ` — ${t.points} pts` : ''}` +
            // Several missions dropping at once are rarely worth the same, and which of them carries
            // money is the whole reason anyone reads the list.
            (t.prizeGp ? ` · 💰 ${formatGp(t.prizeGp)}` : ''),
        );
  if (tiles.length > 15) lines.push(`…and ${tiles.length - 15} more`);

  const boostLine = boost ? `\n**${boost % 1 === 0 ? boost : boost.toFixed(1)}x points** — today only.` : '';
  const description = single
    ? (bounty
        ? 'First to finish it claims it — nobody else can score it.'
        : mission
          ? 'Live now. Go get it.'
          : 'Live now — it counts from this moment.') + boostLine
    : clamp(lines.join('\n') + boostLine, LIMIT.description);

  const fields: DiscordEmbedField[] = [];
  if (single && pointsMode && tiles[0].points != null) {
    fields.push(statField('Worth', `${tiles[0].points} pts`));
  }
  // The prize on a single drop gets a box of its own, next to the points, because "first takes 50m"
  // is the announcement — the points are the consolation.
  if (single && tiles[0].prizeGp) {
    fields.push(statField('First takes', `${formatGp(tiles[0].prizeGp)} gp`));
  }
  // Missions drop from their own pool; a "still hidden" count would spoil the surprise.
  if (!mission && hiddenRemaining > 0) {
    fields.push(statField(`Still hidden`, `${hiddenRemaining} ${noun}${hiddenRemaining === 1 ? '' : 's'}`));
  }
  // A live countdown beats "more to come" — every client renders it ticking, in its own timezone.
  if (nextRevealAt) {
    fields.push(field('Next drop', discordTime(nextRevealAt, 'R')));
  } else if (bounty) {
    fields.push(field('Next drop', 'When this one is claimed'));
  }

  const boardUrl = eventId != null ? eventLeaderboardUrl(eventId) : null;
  const icon = single ? tiles[0].icon : null;
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: clamp(title, LIMIT.title),
    description,
    color: EMBED_COLOR.gold,
    ...(icon ? { thumbnail: { url: discordAssetUrl(icon) } } : {}),
    ...(fields.length ? { fields } : {}),
    ...(boardUrl ? { url: boardUrl } : {}),
  };

  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'reveals' });
}

export interface BoardRevealedNotifyParams {
  clanId: number;
  eventId: number;
  eventName: string;
  startDate?: string | null;
  /** A cache-busting reveal stamp; scheduled/manual callers pass the instant that won the reveal. */
  revealedAt: string;
  tileCount: number;
  /** Host-only preview: exercise the exact embed/image without notifying accepted co-hosts. */
  test?: boolean;
}

/** Whole-board reveal, distinct from the live reveal engine's per-tile/mission announcements. */
export async function notifyBoardRevealed(params: BoardRevealedNotifyParams): Promise<boolean> {
  const boardUrl = eventLeaderboardUrl(params.eventId);
  const base = siteBaseUrl();
  const imageUrl = base
    ? `${base}/api/og/board?${boardRevealImageQuery(params.eventId, params.revealedAt)}`
    : null;
  const starts = params.startDate ? ` Play begins ${discordTime(params.startDate, 'R')}.` : '';
  const description = params.test
    ? `This is a private test of tomorrow's board-reveal post.${boardUrl ? `\n\n[Open the interactive board →](${boardUrl})` : ''}`
    : `The full board is open for preview.${starts}${boardUrl ? `\n\n[Browse every tile and its details →](${boardUrl})` : ''}`;
  const embed: DiscordEmbed = {
    ...eventAuthor(params.eventId, params.eventName),
    title: params.test ? '🧪 Board reveal preview' : '🧩 Board revealed',
    description,
    color: EMBED_COLOR.gold,
    fields: [statField('Board', `${params.tileCount} ${params.tileCount === 1 ? 'tile' : 'tiles'}`)],
    ...(boardUrl ? { url: boardUrl } : {}),
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
  };
  const payload = { embeds: [await withClanCrest(params.clanId, embed, params.eventId)] };
  // A test must never surprise co-host servers. The real reveal uses the ordinary accepted-cohost
  // fan-out, where each receiving clan may independently disable co-host posts.
  return params.test
    ? (await sendBingoWebhookReport(params.clanId, payload)) === 'sent'
    : sendEventBingoWebhook(params.clanId, params.eventId, payload, { post: 'boardRevealed' });
}

interface BountyClaimNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventName: string;
  tileLabel: string;
  points: number | null;
  /** The player who was first to finish the mission and locked it. */
  rsn: string;
  eventId?: number | null;
}

// Fired when a lock-out (bounty) mission is claimed — the first player to finish it locks everyone
// else out. Posts to the same bingo channel as the reveal announcement; the reveal engine calls it
// fire-and-forget from handleBountyClaim, once, for the completion that actually closed the tile.
export async function notifyBountyClaim(params: BountyClaimNotifyParams): Promise<boolean> {
  const { eventName, tileLabel, points, rsn, eventId } = params;
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: clamp(`🏆 Mission claimed — ${tileLabel}`, LIMIT.title),
    description: `**${rsn}** got there first.\n🔒 Locked — nobody else can claim it.`,
    color: EMBED_COLOR.gold,
    ...(points != null ? { fields: [statField('Points', points)] } : {}),
  };
  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'claims' });
}

interface MissionPrizeNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventName: string;
  tileLabel: string;
  /** The winner, and where they finished (1 = first). */
  rsn: string;
  place: number;
  /** What the place was worth in gp — announced whether or not the coffer could cover it. */
  offeredGp: number;
  /** False when the pot was dry: they take the points instead, and the post says so plainly. */
  funded: boolean;
  /** Points the claim ended up holding. Null on a non-points event. */
  points: number | null;
  eventId?: number | null;
}

/**
 * A mission prize, the moment it is settled against the coffer.
 *
 * Posted for the money, not for the finish — the mission-claimed post already covers "somebody got
 * there first". What this one adds is what they actually won, INCLUDING when the answer is nothing:
 * a clan that runs prizes out of a pot will empty that pot, and saying so in the same channel that
 * promised the gp is the difference between a dry week and a broken promise.
 */
export async function notifyMissionPrize(params: MissionPrizeNotifyParams): Promise<boolean> {
  const { eventName, tileLabel, rsn, place, offeredGp, funded, points, eventId } = params;
  const fields: DiscordEmbedField[] = [];
  if (funded) fields.push(statField('Prize', `${formatGp(offeredGp)} gp`));
  if (points != null) fields.push(statField('Points', points));
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: clamp(funded ? `💰 ${rsn} won ${formatGp(offeredGp)}` : `🏅 ${rsn} took ${placeLabel(place)}`, LIMIT.title),
    description: funded
      ? `**${placeLabel(place)}** on **${tileLabel}**. A treasurer will send it over.`
      : `**${placeLabel(place)}** on **${tileLabel}** — the coffer is empty, so this one pays points only.`,
    color: EMBED_COLOR.gold,
    ...(fields.length ? { fields } : {}),
  };
  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'claims' });
}

interface MonthlyChampionNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventName: string;
  /** 'YYYY-MM' of the month that just closed. */
  month: string;
  rsn: string;
  points: number;
  tasks: number;
  runnersUp: { rsn: string; points: number }[];
  /** Whether the champion role actually moved, so the post doesn't promise a role nobody got. */
  roleGranted: boolean;
  eventId?: number | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' → "August 2026", falling back to the raw key rather than to nonsense. */
function monthName(key: string): string {
  const [y, m] = key.split('-').map((n) => parseInt(n, 10));
  const name = MONTH_NAMES[m - 1];
  return name && Number.isFinite(y) ? `${name} ${y}` : key;
}

/**
 * The month closing on a ladder.
 *
 * Posted by the engine rather than by a person, because the moment it marks — midnight on the last
 * day — is the one nobody is awake for. Says what the winner scored, who was close, and whether the
 * clan's champion role actually moved; a post claiming a role that failed to apply is worse than one
 * that says nothing about roles at all.
 */
export async function notifyMonthlyChampion(params: MonthlyChampionNotifyParams): Promise<boolean> {
  const { eventName, month, rsn, points, tasks, runnersUp, roleGranted, eventId } = params;
  const fields: DiscordEmbedField[] = [statField('Points', points), statField('Tasks', tasks)];
  if (runnersUp.length > 0) {
    fields.push(
      field(
        'Close behind',
        runnersUp.map((r, i) => `${i === 0 ? '🥈' : '🥉'} **${r.rsn}** — ${r.points}`).join('\n'),
      ),
    );
  }
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: clamp(`👑 ${monthName(month)} goes to ${rsn}`, LIMIT.title),
    description: roleGranted
      ? 'The champion role is theirs until somebody takes it off them.'
      : 'The board resets today — everyone starts the new month level.',
    color: EMBED_COLOR.gold,
    fields,
  };
  const d = await eventPostDecision(params.clanId, params.eventId, 'monthlyChampion');
  if (!d.send) return false;
  // A month's champion IS the standings — held while the host keeps them back.
  if (params.eventId != null && (await eventStandingsHidden(params.eventId))) return false;
  return sendBingoWebhook(params.clanId, { ...(await pingFor(params.clanId, d.ping)), embeds: [embed] });
}

interface TeamWithPlayers {
  name: string;
  color: string;
  players: string[];
}

interface DraftCompleteNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventName: string;
  teams: TeamWithPlayers[];
  eventId?: number | null;
  /** The rosters were assembled directly, so do not claim a draft happened. */
  directAssignment?: boolean;
}

function draftCompletePayload(params: DraftCompleteNotifyParams): DiscordWebhookPayload {
  const { eventName, teams, eventId, directAssignment = false } = params;

  // One field per team — the roster is the point of this post, so it stays a field block.
  const fields: DiscordEmbedField[] = teams.map((team) =>
    field(team.name, team.players.length ? team.players.map((p) => `• ${p}`).join('\n') : '_No players_'),
  );

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: directAssignment ? '🏆 Teams confirmed' : '🏆 Draft complete',
    description: directAssignment
      ? `Rosters are set for **${eventName}**.`
      : `Rosters are locked for **${eventName}**.`,
    color: EMBED_COLOR.gold,
    fields,
  };

  return { embeds: [embed] };
}

export async function notifyDraftComplete(params: DraftCompleteNotifyParams): Promise<boolean> {
  return sendEventBingoWebhook(params.clanId, params.eventId, draftCompletePayload(params), { post: 'draftDone' });
}

/** Manual roster post: the viewing clan posts only into its own chosen event channel. */
export async function notifyDraftCompleteForClan(
  params: DraftCompleteNotifyParams & { cohost: boolean },
): Promise<boolean> {
  const payload = draftCompletePayload(params);
  // A manual re-send from the admin: posts whatever the event's switches say.
  if (!params.cohost) return sendBingoWebhook(params.clanId, payload);
  return (await sendCohostWebhook(params.clanId, payload)) === 'sent';
}

interface DraftStartNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventName: string;
  teamCount?: number;
  eventId?: number | null;
}

export async function notifyDraftStart(params: DraftStartNotifyParams): Promise<boolean> {
  const { eventName, teamCount, eventId } = params;

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🎬 Draft started',
    description: `The draft for **${eventName}** is underway — captains, make your picks!`,
    color: EMBED_COLOR.blue,
    ...(teamCount ? { fields: [statField('Teams', teamCount)] } : {}),
  };

  // Ping members so captains show up for their picks (same reach as start/finish posts).
  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'draftStart' });
}

interface TeamWinNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  /** The team it's about — routes it to that team's event webhooks. */
  teamId?: number | null;
  eventName: string;
  teamName: string;
  teamColor: string;
  totalTiles: number;
  eventId?: number | null;
}

export async function notifyTeamWin(params: TeamWinNotifyParams): Promise<boolean> {
  const { eventName, teamName, teamColor, totalTiles, eventId } = params;
  // A streamed board clips its first full clear on the host's live channel (lib/highlights; later
  // clears are the same 'board' beat and dedupe away). Queued: the post never waits on Twitch.
  if (eventId != null && params.teamId != null) queueBoardHighlight(eventId, params.teamId, teamName);

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    title: '🎉 BLACKOUT!',
    description: `**${teamName}** has completed all ${totalTiles} tiles.`,
    color: teamColorToDecimal(teamColor),
  };

  return withPostRef({ kind: 'teamWin', clanId: params.clanId, eventId: params.eventId, teamId: params.teamId }, () => sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [embed] }, { post: 'teamWin', teamId: params.teamId }));
}

// Role pinged on event start/finish posts so the whole clan is notified. Clan-specific, so it's
// settings-driven (admin UI) with an env fallback; no role is pinged when neither is set.
const MEMBER_ROLE_KEY = 'discord_member_ping_role_id';
async function memberPingRoleId(clanId: number): Promise<string | null> {
  // A role id only means anything inside one guild, so an env default is the same cross-clan leak
  // the guild id had — it would point this clan at a role in the operator's server.
  return (await getSettingUrl(clanId, MEMBER_ROLE_KEY)) || null;
}

// Public site origin, derived from the OAuth redirect URI (cron has no request context to read a
// host header from). Used to build deep links into the app for Discord posts. Null if unconfigured.
export function siteBaseUrl(): string | null {
  const uri = process.env.DISCORD_REDIRECT_URI;
  if (!uri) return null;
  try {
    return new URL(uri).origin;
  } catch {
    return null;
  }
}

// The clan's crest image, as an author-line icon for the lifecycle announcements — the clan's mark on
// its own big posts, alongside the Anvil mark in the footer. Keyed by SLUG because these posts are
// built off the single apex base (siteBaseUrl), not a per-clan origin, so the by-host crest route
// would resolve the apex and draw a generic mark; the slug route draws the right clan's. Null when
// the base or the slug is unknown, so the author line simply goes out without an icon.
async function clanCrestIcon(clanId: number): Promise<string | null> {
  const base = siteBaseUrl();
  if (!base) return null;
  const clan = await db.query.clans.findFirst({ columns: { slug: true, logoUrl: true }, where: eq(clans.id, clanId) });
  return clan?.slug ? clanMarkUrl(base, clan.slug, clan.logoUrl) : null;
}

/** An event's own icon, when it has one (lib/eventImage); null = use the clan's mark. */
async function eventIcon(eventId: number | undefined): Promise<string | null> {
  const base = siteBaseUrl();
  if (!base || eventId == null) return null;
  // clan-scope: global -- one event by id, from a sender that was handed that event.
  const event = await db.query.events.findFirst({ columns: { iconUrl: true }, where: eq(events.id, eventId) });
  return event?.iconUrl ? eventMarkUrl(base, eventId, event.iconUrl) : null;
}

/**
 * Stamp a mark onto an embed's existing author line: the event's own icon when the post is about an
 * event that has one, else the clan's crest.
 */
async function withClanCrest(clanId: number, embed: DiscordEmbed, eventId?: number): Promise<DiscordEmbed> {
  const icon = (await eventIcon(eventId)) ?? (await clanCrestIcon(clanId));
  if (icon && embed.author) embed.author = { ...embed.author, icon_url: icon };
  return embed;
}

// Live standings page for an event — the public board doubles as the leaderboard.
function eventLeaderboardUrl(eventId: number): string | null {
  const base = siteBaseUrl();
  return base ? `${base}/events/${eventId}` : null;
}

/** A tile as the notifiers receive it: icon facts, plus the id when the caller has the row. */
type LinkedTile = IconableTile & { id?: number | null };

// A tile post links to that tile opened on the board (the event page reads ?tile=), not just the board.
function tileBoardUrl(eventId: number, tile: LinkedTile | null | undefined): string | null {
  const url = eventLeaderboardUrl(eventId);
  return url && tile?.id ? `${url}?tile=${tile.id}` : url;
}

// The "go look at the board" call to action, as a trailing description line rather than the old
// standalone field — a full-width field for one link pushed every post taller than it needed to be.
// Empty string when the site URL is unconfigured, so it concatenates safely.
function boardLinkLine(eventId: number): string {
  const url = eventLeaderboardUrl(eventId);
  return url ? `\n\n[View live standings →](${url})` : '';
}

// The end post adds Wrapped (events/<id>/wrapped): one generic link, where each player finds their own
// card and copies its share link — posting everyone's card here would bury the channel.
function endLinkLine(eventId: number): string {
  const url = eventLeaderboardUrl(eventId);
  return url ? `\n\n[Final standings →](${url}) · [🎁 Get your Wrapped card →](${url}/wrapped)` : '';
}

// The stats posts link both the board and the per-player stats page (events/<id>/stats).
function statsLinkLine(eventId: number): string {
  const url = eventLeaderboardUrl(eventId);
  return url ? `\n\n[Live standings →](${url}) · [Full stats →](${url}/stats)` : '';
}

// Ping the member role: explicit allowed_mentions so it notifies reliably and nothing else pings.
// Returns no content when no role is configured, so the post simply goes out without a ping.
const memberPing = async (clanId: number): Promise<Pick<DiscordWebhookPayload, 'content' | 'allowed_mentions'>> => {
  const roleId = await memberPingRoleId(clanId);
  if (!roleId) return {};
  return {
    content: `<@&${roleId}>`,
    allowed_mentions: { parse: [], roles: [roleId] },
  };
};

interface EventStartHeldNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventId?: number;
  eventName: string;
  /** The start the admins scheduled (reached but not honored). */
  scheduledStart: string;
  blockers: StartBlockerCode[];
}

// The start-safeguard warning (lib/eventLifecycle): the scheduled start was reached while the event
// wasn't startable, so the start is being held. Posted to the bingo channel exactly once per hold
// (startHoldNotified latch) — it's the alert that reaches admins who scheduled a start and walked
// away, and it tells members why the countdown is stalling. No member ping: it's a heads-up, not a
// celebration.
export async function notifyEventStartHeld(params: EventStartHeldNotifyParams): Promise<boolean> {
  const { eventName, scheduledStart, blockers } = params;

  const embed: DiscordEmbed = {
    author: { name: eventName },
    title: '⏸️ Start held',
    description:
      `**${eventName}** was due to start ${discordTime(scheduledStart)} but isn't ready to go live:\n` +
      blockers.map((b) => `• ${startBlockerLabel(b)}`).join('\n') +
      '\n\nThe event will start automatically once this is resolved.',
    color: EMBED_COLOR.amber,
  };

  const d = await eventPostDecision(params.clanId, params.eventId, 'startHeld');
  if (!d.send) return false;
  return sendBingoWebhook(params.clanId, { ...(await pingFor(params.clanId, d.ping)), embeds: [embed] });
}

interface EventStartNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventId: number;
  eventName: string;
  startDate: string;
  endDate?: string | null;
  /** What this event IS — a ladder isn't played by teams, so it isn't wished luck as teams. */
  format?: string | null;
  /** Tiles/tasks on the board, and how many of them are open right now (reveal-policy boards). */
  tileCount?: number | null;
  openTileCount?: number | null;
  /** Total points on the board, for a points-scored event. */
  totalPoints?: number | null;
  /** Starting shot required (lib/startProof): where everyone has to be for their proof screenshot. */
  startProofLocation?: string | null;
  /** Minutes the session may have been running when the shot is taken. 0/null = not asked for. */
  startProofSessionMinutes?: number | null;
  /** Set only when starting the event also flips the master board reveal gate. */
  boardImageVersion?: string | null;
}

interface FinalHourNotifyParams {
  clanId: number;
  eventId: number;
  eventName: string;
  startDate: string;
  /** Set when the board needs a starting shot; the post then walks through the steps. */
  startProof: { maxSessionMinutes: number } | null;
}

/**
 * The "final hour" heads-up, sent by hand from the admin panel before the start. An embed can't tick,
 * but `<t:…:R>` does in every client, so this one post counts down on its own. Links straight to the
 * starting-shot card on the event page; until the start that page shows the countdown instead.
 */
export function finalHourEmbed(params: FinalHourNotifyParams): DiscordEmbed {
  const { eventId, eventName, startDate, startProof } = params;
  const url = eventLeaderboardUrl(eventId);
  const shotUrl = url ? `${url}#starting-shot` : null;
  const lines = [`**${eventName}** starts ${discordTime(startDate, 'R')} (${discordTime(startDate)}).`];
  const fields: DiscordEmbedField[] = [];
  if (startProof) {
    const relog = startProof.maxSessionMinutes > 0
      ? `**Log out and back in** right before you take it — the shot must be within ${startProof.maxSessionMinutes} min of logging in. Hiscores only save on logout, and that sets your starting totals.`
      : '**Log out and back in** before the start — hiscores only save on logout, and that sets your starting totals.';
    lines.push('', 'This event needs a **starting shot** before your drops count.');
    fields.push(
      field(
        '📸 Starting shot — the steps',
        [
          `1. ${relog}`,
          '2. At the start, the spot is drawn. Go there.',
          '3. **Plugin:** press **Take starting shot** in the Anvil panel (the arrow points you to the spot). Done.',
          `4. **Mobile / no plugin:** open ${shotUrl ? `**[your starting shot](${shotUrl})**` : 'the event page'}, type your keyword in the chatbox (don\u2019t send it), screenshot with your character in view, and upload it there.`,
        ].join('\n'),
      ),
    );
  } else if (url) {
    lines.push('', `[Open the board →](${url})`);
  }
  return {
    ...eventAuthor(eventId, eventName),
    title: '🔥 Starting soon',
    description: clamp(lines.join('\n'), LIMIT.description),
    color: EMBED_COLOR.amber,
    ...(fields.length ? { fields } : {}),
    ...(shotUrl && startProof ? { url: shotUrl } : url ? { url } : {}),
  };
}

/**
 * Post the heads-up to every clan on the board — host bingo channel, each co-host's co-hosted/bingo
 * channel — pinging the TEAM roles that live in that clan's server (`rolesByClan`), never a member
 * role. A clan with no team role in its server gets the post silently.
 */
export async function notifyFinalHour(
  params: FinalHourNotifyParams,
  rolesByClan: Map<number, string[]>,
): Promise<{ clanId: number; status: 'sent' | 'skipped' | 'failed' }[]> {
  const embed = await withClanCrest(params.clanId, finalHourEmbed(params), params.eventId);
  const payloadFor = (clanId: number): DiscordWebhookPayload => {
    const roles = rolesByClan.get(clanId) ?? [];
    return roles.length
      ? { content: roles.map((r) => `<@&${r}>`).join(' '), allowed_mentions: { parse: [], roles }, embeds: [embed] }
      : { embeds: [embed] };
  };
  const cohosts = (await acceptedCohostClanIds(params.eventId).catch(() => [] as number[])).filter((id) => id !== params.clanId);
  const [host, ...rest] = await Promise.all([
    sendBingoWebhookReport(params.clanId, payloadFor(params.clanId)),
    ...cohosts.map((id) => sendCohostWebhook(id, payloadFor(id))),
  ]);
  return [{ clanId: params.clanId, status: host }, ...cohosts.map((clanId, k) => ({ clanId, status: rest[k] }))];
}

export async function notifyEventStart(params: EventStartNotifyParams): Promise<boolean> {
  const { eventId, eventName, startDate, endDate, format, tileCount, openTileCount, totalPoints, startProofLocation, startProofSessionMinutes, boardImageVersion } = params;
  // A streamed event's start is clipped on the host's live channel (lib/highlights). Both start doors
  // (the lifecycle cron and start-now) come through here behind the startNotified flip. Queued.
  if (eventId != null) queueStartHighlight(eventId, eventName);
  // Wording follows who is competing, not the format name — a board that ranks people can't be
  // wished luck "to all teams", and its entries are tasks.
  const axes = eventAxes({ format, scoringMode: 'points', endDate });
  const ladder = axes.competitors === 'individuals';
  const noun = taskNoun(axes);

  const fields: DiscordEmbedField[] = [field('Started', discordTime(startDate))];

  if (endDate) {
    // Exact end time + a live countdown that ticks down in everyone's client.
    fields.push(field('Ends', `${discordTime(endDate)}\n${discordTime(endDate, 'R')}`));
  } else {
    // An open-ended run is a deliberate setup (a ladder that cycles monthly), so say so rather
    // than leaving a conspicuous hole where the end date goes.
    fields.push(field('Ends', 'No end date — runs until it\u2019s closed'));
  }

  // What's actually on the board. A start post that says only "it started" makes every event look
  // identical; the size and shape of the board is the first thing anyone wants to know.
  if (tileCount && tileCount > 0) {
    const open = openTileCount != null && openTileCount < tileCount
      ? `${openTileCount} of ${tileCount} open`
      : `${tileCount} ${noun}${tileCount === 1 ? '' : 's'}`;
    fields.push(statField('Board', open));
  }
  if (totalPoints && totalPoints > 0) {
    fields.push(statField('Points up for grabs', totalPoints.toLocaleString()));
  }

  // Starting shot: the location is drawn at this exact moment, so this post is the first place
  // anyone can learn it. Each player's keyword is personal and lives on the site, never here.
  if (startProofLocation) {
    // The relog isn't ceremony: hiscores only flush on logout, so a session that predates the start
    // leaves everyone's baseline stale. Say WHY, or people will read it as busywork and skip it.
    const relog = startProofSessionMinutes && startProofSessionMinutes > 0
      ? `\n**Log out and back in first** (within ${startProofSessionMinutes} min of your shot) — that's what flushes your hiscores so your starting totals are right.`
      : '';
    fields.push(
      field(
        '📸 Starting shot required',
        `Go to **${startProofLocation}** and take your shot before you play.${relog}\n` +
          'Plugin users: press **Take starting shot** in the Anvil panel. ' +
          'Everyone else: grab your keyword on the site and type it in-game.',
      ),
    );
  }

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: ladder ? '🚀 Ladder is live' : '🚀 Event started',
    description: ladder
      ? `**${eventName}** is live. Climb the board — every task you finish is points on your name.${boardLinkLine(eventId)}`
      : `**${eventName}** has begun. Good luck to all teams!${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.green,
    fields,
    ...(eventLeaderboardUrl(eventId) ? { url: eventLeaderboardUrl(eventId)! } : {}),
    ...(boardImageVersion && siteBaseUrl()
      ? { image: { url: `${siteBaseUrl()}/api/og/board?${boardRevealImageQuery(eventId, boardImageVersion)}` } }
      : {}),
  };

  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [await withClanCrest(params.clanId, embed, params.eventId)] }, { post: 'eventStart' });
}

interface EventEndNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventId: number;
  eventName: string;
  // `tilesCompleted`/`totalTiles` carry summed point weights for points-scoring
  // events; `unit` controls the label (defaults to 'tiles').
  standings: { teamName: string; tilesCompleted: number }[];
  totalTiles: number;
  unit?: string;
  // Optional fun end-of-event "superlatives" (MVP, biggest drop, most kills, …) to celebrate in the
  // end post. Each is one pre-formatted line: emoji, award title, the winner, and their number.
  superlatives?: { emoji: string; title: string; winner: string; valueLabel: string }[];
  // One-line event facts from lib/eventDigest (the comeback, the nemesis, clan-of-the-day tally).
  facts?: string[];
}

export async function notifyEventForceEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventId, eventName, standings, totalTiles, unit = 'tiles' } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🛑 Event force-ended',
    description: `**${eventName}** was ended early by an admin.${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.red,
    fields: [field('Final standings', standingsText || 'No completions', false)],
  };

  // No member ping on an admin force-end (abnormal termination, not a celebratory finish).
  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [await withClanCrest(params.clanId, embed, params.eventId)] }, { post: 'eventEnd' });
}

export async function notifyEventEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventId, eventName, standings, totalTiles, unit = 'tiles', superlatives, facts } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const fields: DiscordEmbedField[] = [field('Final standings', standingsText || 'No completions', false)];
  if (superlatives && superlatives.length > 0) {
    const awardsText = superlatives
      .map((a) => `${a.emoji} **${a.title}** — ${a.winner} _(${a.valueLabel})_`)
      .join('\n');
    fields.push(field('🏅 Superlatives', awardsText, false));
  }
  if (facts && facts.length > 0) fields.push(field('📌 Event facts', facts.join('\n'), false));

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🏁 Event ended',
    description: `**${eventName}** has concluded. Well played!${endLinkLine(eventId)}`,
    color: EMBED_COLOR.gold,
    fields,
  };

  return sendEventBingoWebhook(params.clanId, params.eventId, { embeds: [await withClanCrest(params.clanId, embed, params.eventId)] }, { post: 'eventEnd' });
}

interface PayoutNotifyParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  eventId: number;
  eventName: string;
  // Total gp actually paid out (sum of paid rows).
  totalPaid: number;
  // Paid recipients, grouped for display. `place` orders them (1 = winner); `amount` is gp.
  recipients: { rsn: string; teamName: string | null; place: number | null; amount: number }[];
}

interface EventStatsPostParams {
  clanId: number;
  eventId: number;
  /** Which stats post this is — each can be switched off on its own. */
  post: 'digest' | 'halfway' | 'standingsRevealed';
  eventName: string;
  title: string;
  description: string;
  fields: DiscordEmbedField[];
}

// The daily digest and the halfway report (lib/eventDigest composes them). Reaches the host AND
// every co-host clan through the same fan-out as the start/end posts, never pinging — a stats post
// once a day is something to read, not something to be woken for.
export async function notifyEventStatsPost(params: EventStatsPostParams): Promise<boolean> {
  const embed: DiscordEmbed = {
    ...eventAuthor(params.eventId, params.eventName),
    title: clamp(params.title, LIMIT.title),
    description: clamp(`${params.description}${statsLinkLine(params.eventId)}`, LIMIT.description),
    color: EMBED_COLOR.gold,
    fields: params.fields.slice(0, 25),
  };
  return sendEventBingoWebhook(
    params.clanId,
    params.eventId,
    { embeds: [await withClanCrest(params.clanId, embed, params.eventId)] },
    { post: params.post },
  );
}

// Announce the prize payouts to the bingo channel once the winners have been paid. Fired
// automatically when the last pending payout is marked paid, and re-runnable from the admin
// "Announce" button. Mirrors notifyEventEnd's medal styling.
export async function notifyPayout(params: PayoutNotifyParams): Promise<boolean> {
  const { eventId, eventName, totalPaid, recipients } = params;

  // Order by place (nulls/manual last), then by amount desc within a place.
  const ordered = [...recipients].sort(
    (a, b) => (a.place ?? 99) - (b.place ?? 99) || b.amount - a.amount,
  );
  const lines = ordered.map((r) => {
    const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : '•';
    const team = r.teamName ? ` _(${r.teamName})_` : '';
    return `${medal} **${r.rsn}**${team} — ${r.amount.toLocaleString()} gp`;
  });

  const fields: DiscordEmbedField[] = [
    statField('Total paid out', `${totalPaid.toLocaleString()} gp`),
    field('Winners', lines.join('\n') || 'No payouts', false),
  ];

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    ...{ thumbnail: { url: discordAssetUrl(itemIconUrl(995)) } }, // coins — the payout's own icon
    title: '💰 Prizes paid out',
    description: `Congratulations to the winners of **${eventName}**. Prizes have been sent.${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.gold,
    fields,
  };

  const d = await eventPostDecision(params.clanId, eventId, 'payouts');
  if (!d.send) return false;
  return sendBingoWebhook(params.clanId, { ...(await pingFor(params.clanId, d.ping)), embeds: [await withClanCrest(params.clanId, embed, eventId)] });
}

// ---- Weekly competitions (SOTW / BOTW) — post to the dedicated weekly webhook ----

// One definition, shared with the home page (lib/constants.weeklyKindLabel).
const weeklyKind = weeklyKindLabel;

// The competition's own icon: the skill's wiki icon for a SOTW, the boss's hiscores sprite (the one
// RuneLite shows) for a BOTW. Efficiency spans everything, so it gets none.
function weeklyThumbnail(type: string, metric: string): Pick<DiscordEmbed, 'thumbnail'> {
  if (type === 'skill') {
    const url = skillIconUrl(metric);
    return url ? { thumbnail: { url: discordAssetUrl(url) } } : {};
  }
  if (type === 'boss') {
    // discordAssetUrl asks for the 4× nearest-neighbour sprite: crisp at thumbnail size, not thumb-sized.
    const url = bossIconForStatKey(metricKeys(metric)[0] ?? metric);
    return url ? { thumbnail: { url: discordAssetUrl(url) } } : {};
  }
  return {};
}

/** A clan event's picture: a skill or boss key, as a weekly's would be. */
export function clanEventThumbnail(icon: string | null): Pick<DiscordEmbed, 'thumbnail'> {
  if (!icon) return {};
  return weeklyThumbnail((SKILLS as readonly string[]).includes(icon) ? 'skill' : 'boss', icon);
}

/**
 * Where a clan event posts: its own "Post to" channel when the host picked one (a bot-made webhook,
 * lib/clanEvents resolvePostTarget), else the clan's clan-events channel, else its main one.
 */
async function clanEventDestination(clanId: number, postWebhookUrl?: string | null): Promise<{ urls: string[]; cursorKey: string } | null> {
  const own = parseWebhookUrls(postWebhookUrl);
  if (own.length) return (await isHiddenHost(clanId)) ? null : { urls: own, cursorKey: `${clanId}:clan-event-own` };
  return resolveWebhookDestination(clanId, CLAN_EVENTS_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
}

/**
 * A clan event's announcement, posted once and then edited in place (its id kept by the caller).
 * The first post pings the member role when asked; an edit leaves the message's content alone, so a
 * going count ticking up never pings anyone again.
 */
export async function upsertClanEventPost(clanId: number, embed: DiscordEmbed, existingMessageId?: string, ping = false, postWebhookUrl?: string | null): Promise<EditableWebhookResult> {
  if (await feedOff(clanId, 'clanEvents')) return { status: 'skipped' };
  const destination = await clanEventDestination(clanId, postWebhookUrl);
  if (!destination) return { status: 'skipped' };
  const mention = ping && !existingMessageId ? await memberPing(clanId) : {};
  return upsertWebhookMessage(destination, { ...mention, embeds: [await withClanCrest(clanId, embed)] }, clanId, existingMessageId);
}

/**
 * Take a clan event's announcement down from where it was posted (the event's own channel webhook,
 * or the clan default when null). Used when "Post to" changes: a webhook can only edit its own
 * messages, so the new destination would otherwise post a second copy beside the old one.
 */
export async function deleteClanEventPost(clanId: number, messageId: string, postWebhookUrl?: string | null): Promise<void> {
  const destination = await clanEventDestination(clanId, postWebhookUrl);
  for (const webhookUrl of destination?.urls ?? []) {
    try {
      const res = await webhookFetch(webhookRequestUrl(webhookUrl, { messageId }), { method: 'DELETE', signal: AbortSignal.timeout(8_000) });
      if (res.ok || res.status === 404) {
        if (res.ok) return;
        continue; // not this webhook's message: try the next configured one
      }
      log.warn('discord.webhook-delete-fail', { clanId, status: res.status });
      return;
    } catch (err) {
      log.warn('discord.webhook-delete-fail', { clanId }, err);
      return;
    }
  }
}

/** A clan event's reminder or "starting now": a fresh post, pinging the member role when asked. */
export async function sendClanEventPost(clanId: number, embed: DiscordEmbed, ping: boolean, postWebhookUrl?: string | null): Promise<boolean> {
  if (await feedOff(clanId, 'clanEvents')) return false;
  const destination = await clanEventDestination(clanId, postWebhookUrl);
  if (!destination?.urls.length) return false;
  return sendToWebhook(destination, { ...(ping ? await memberPing(clanId) : {}), embeds: [await withClanCrest(clanId, embed)] }, clanId);
}

/**
 * Team or clan standings carried by a weekly post (lib/competitionTeams). `you` marks the group the
 * receiving clan is (clans mode: the clan itself), so each server sees its own side called out.
 */
export interface WeeklyGroupPost {
  mode: 'teams' | 'clans';
  groups: { name: string; total: number; average: number; members: number; key: number }[];
  you?: number | null;
}

function weeklyGroupField(type: string, g: WeeklyGroupPost, label: string) {
  const fmt = (n: number) => (type === 'efficiency' ? formatEfficiencyHours(Math.round(n)) : Math.round(n).toLocaleString());
  const unit = type === 'efficiency' ? 'h' : type === 'skill' ? 'XP' : 'KC';
  const lines = g.groups.slice(0, 10).map((x, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const mine = g.you != null && x.key === g.you ? ' ← you' : '';
    return `${medal} **${x.name}** — +${fmt(x.total)} ${unit} · ${fmt(x.average)} avg · ${x.members} ${x.members === 1 ? 'player' : 'players'}${mine}`;
  });
  return field(label, lines.join('\n') || 'No teams yet', false);
}

interface WeeklyStartParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  type: string;   // 'skill' | 'boss'
  title: string;
  metric: string; // e.g. 'attack', 'zulrah'
  endDate: string;
  /** Teams / clan-vs-clan line-up. Absent on a solo competition. */
  groups?: WeeklyGroupPost | null;
}

export async function notifyWeeklyStart(params: WeeklyStartParams): Promise<boolean> {
  const { type, title, metric, endDate } = params;
  const kind = weeklyKind(type);
  const emoji = type === 'efficiency' ? '⏱️' : type === 'skill' ? '📈' : '⚔️';

  const embed: DiscordEmbed = {
    author: { name: kind },
    ...weeklyThumbnail(type, metric),
    // Just the admin-set title — no raw metric key (e.g. "lunarChests").
    title: clamp(`${emoji} ${title}`, LIMIT.title),
    // No sign-up step to advertise: the clan roster IS the entry list, so everyone synced from the
    // in-game clan is already racing. Saying "enroll with the plugin" sent people looking for a
    // button that doesn't exist. What the plugin actually does is track your gains live.
    description: "Live now — everyone on the clan roster is entered. Run the Anvil plugin and your gains track themselves.",
    color: EMBED_COLOR.green,
    fields: [
      // Exact end time + a live countdown that ticks down in everyone's client.
      field('Ends', `${discordTime(endDate)}\n${discordTime(endDate, 'R')}`),
      ...(params.groups ? [weeklyGroupField(type, params.groups, params.groups.mode === 'clans' ? 'Clans racing' : 'Teams')] : []),
    ],
  };
  if (params.groups?.mode === 'clans') {
    embed.description = 'Clan vs clan — live now. Every clan on the line-up races its whole roster; clan totals decide it.';
  } else if (params.groups) {
    embed.description = 'Team competition — live now. Your gains count for your team; team totals decide it.';
  }

  return sendWeeklyWebhook(params.clanId, { embeds: [await withClanCrest(params.clanId, embed)] });
}

/** Halfway through a team / clan-vs-clan competition: the standings so far. Solo comps don't post one. */
export async function notifyWeeklyHalfway(params: {
  clanId: number;
  type: string;
  title: string;
  metric: string;
  endDate: string;
  groups: WeeklyGroupPost;
}): Promise<boolean> {
  const { type, title, metric, endDate, groups } = params;
  const leader = groups.groups[0];
  const embed: DiscordEmbed = {
    author: { name: `${weeklyKind(type)} · halfway` },
    ...weeklyThumbnail(type, metric),
    title: clamp(`⏳ ${title}`, LIMIT.title),
    description: leader && leader.total > 0
      ? `Halfway there — **${leader.name}** leads. Ends ${discordTime(endDate, 'R')}.`
      : `Halfway there and it's still level. Ends ${discordTime(endDate, 'R')}.`,
    color: EMBED_COLOR.gold,
    fields: [weeklyGroupField(type, groups, groups.mode === 'clans' ? 'Clan standings' : 'Team standings')],
  };
  return sendWeeklyWebhook(params.clanId, { embeds: [await withClanCrest(params.clanId, embed)] });
}

interface WeeklyResultsParams {
  /** The clan this posts for — decides which webhook it lands in. */
  clanId: number;
  type: string;
  title: string;
  metric: string;
  // Pre-ranked, gains floored at 0. First entry is the winner.
  standings: { rsn: string; gained: number }[];
  /** Teams / clan-vs-clan final standings — lead the post when present. */
  groups?: WeeklyGroupPost | null;
}

// Fired when a weekly competition ends — announces the winner and the final standings (top 10).
export async function notifyWeeklyResults(params: WeeklyResultsParams): Promise<boolean> {
  const { type, title, metric, standings } = params;
  const kind = weeklyKind(type);
  const winner = standings[0];
  // Human unit, not the raw metric key. Efficiency is stored in milli-hours, so its values are
  // scaled back to hours where they're rendered below.
  const unit = type === 'efficiency' ? 'hours' : type === 'skill' ? 'XP' : 'KC';

  const fmt = (gained: number) =>
    type === 'efficiency' ? formatEfficiencyHours(gained) : gained.toLocaleString();

  const standingsText = standings
    .slice(0, 10)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.rsn}** — +${fmt(s.gained)}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    author: { name: `${kind} · results` },
    ...weeklyThumbnail(type, metric),
    title: clamp(`🏁 ${title}`, LIMIT.title),
    description: winner
      ? `🥇 **${winner.rsn}** takes it with **+${fmt(winner.gained)}** ${unit}.`
      : 'It has ended — nobody posted a gain.',
    color: EMBED_COLOR.gold,
    fields: [field('Final standings', standingsText || 'No participants', false)],
  };
  // Team / clan competitions: the group result is the headline, the players are the detail.
  if (params.groups && params.groups.groups.length) {
    const top = params.groups.groups[0];
    embed.description = top.total > 0
      ? `🏆 **${top.name}** wins with **+${fmt(top.total)}** ${unit}.` + (winner ? `\nTop player: **${winner.rsn}** (+${fmt(winner.gained)}).` : '')
      : 'It has ended — nobody posted a gain.';
    embed.fields = [
      weeklyGroupField(type, params.groups, params.groups.mode === 'clans' ? 'Clan standings' : 'Team standings'),
      field('Top players', standingsText || 'No participants', false),
    ];
  }

  return sendWeeklyWebhook(params.clanId, { embeds: [await withClanCrest(params.clanId, embed)] });
}
