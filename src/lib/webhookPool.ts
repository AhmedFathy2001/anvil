// Webhook pools: several webhooks for the SAME Discord channel, used as one destination.
//
// Discord rate-limits each webhook on its own bucket (about 5 requests per 2 seconds, with the
// remaining budget in X-RateLimit-* headers). A busy event, a kill spree flushing a dozen
// submission buckets at once or a big draft, can drain one webhook's bucket in a second. With a pool
// we send round-robin, rest a webhook while Discord has asked it to wait, and carry on with the
// others. When every webhook is resting, the post waits for the soonest one instead of being
// dropped, up to a bound.
//
// Discord ALSO limits a channel as a whole (an answer with X-RateLimit-Scope: shared). Every webhook
// in the pool posts to the same channel, so a shared-scope 429 rests the whole pool. Pooling smooths
// bursts and removes per-webhook stalls; it does not lift the channel's own ceiling.
//
// State lives in memory: one process serves a clan's posts, and losing it on a restart only means
// the first post after it learns the limits again. Pure on purpose (no `@/` imports), so the
// selection, cooldown and failover logic run under the pure tests with fetch stubbed. Server-only:
// it hashes tokens with node:crypto, so a client component may import its TYPES only.
//
// TENANT SAFETY. A webhook URL is typed in by clan staff, so two clans can hold URLs with the same
// id and different tokens: one real, one bogus. All state is therefore keyed by the webhook's full
// identity (id + a hash of the token, never the raw token), and a 401/404 "dead webhook" rest is
// scoped to the pool that saw it, so nobody can rest another clan's real webhook by pasting its id.

import { createHash } from 'node:crypto';

/** Where a post goes: one or more webhook URLs for one channel, and the key its round-robin turns on. */
export interface WebhookDestination {
  urls: string[];
  cursorKey: string;
  /** Always try urls[0] first (a caller already chose it); the rest are only failover. */
  preferFirst?: boolean;
}

const WEBHOOK_PATH = /\/api\/(?:v\d+\/)?webhooks\/(\d+)\/([\w-]+)/;

/** The webhook's id (a snowflake, not a secret), or null for a URL that isn't a webhook. */
export function webhookIdOf(url: string): string | null {
  return WEBHOOK_PATH.exec(url)?.[1] ?? null;
}

/**
 * The state key for one webhook: its id plus a short hash of its token. Same id with another token is
 * another identity. Never the raw token, so nothing secret sits in a map key or a log line.
 */
export function webhookIdentity(url: string): string {
  const m = WEBHOOK_PATH.exec(url);
  if (!m) return `url:${createHash('sha256').update(url).digest('hex').slice(0, 24)}`;
  return `${m[1]}:${createHash('sha256').update(m[2]).digest('hex').slice(0, 24)}`;
}

/** A URL safe to log or show: the token replaced. Never log a webhook URL without this. */
export function redactWebhookUrl(url: string): string {
  return url.replace(WEBHOOK_PATH, (_m, id: string) => `/api/webhooks/${id}/[redacted]`);
}

/** What an admin sees for one pooled webhook: the last digits of its id, never the token. */
export function maskedWebhookId(url: string): string {
  const id = webhookIdOf(url);
  return id ? `…${id.slice(-4)}` : '…';
}

// ── Selection and cooldown state ─────────────────────────────────────────────────────────────────

/** A webhook Discord says no longer exists (or whose token was reset) rests this long. */
export const DEAD_WEBHOOK_REST_MS = 10 * 60_000;

export interface PoolCounters {
  sent: number;
  rateLimited: number;
  failovers: number;
  queued: number;
  dropped: number;
}

type PickResult = { url: string } | { waitMs: number } | null;

export class WebhookPoolState {
  /**
   * identity (lib webhookIdentity) → epoch ms it may be used again. A pool-scoped rest (a dead
   * webhook) is keyed `<cursorKey>|<identity>` and only that pool sees it.
   */
  private readonly restUntil = new Map<string, number>();
  private readonly cursors = new Map<string, number>();
  /** identity → the pool it was last seen in, so a caller holding one URL can still fail over. */
  private readonly siblings = new Map<string, string[]>();
  readonly counters: PoolCounters = { sent: 0, rateLimited: 0, failovers: 0, queued: 0, dropped: 0 };

  constructor(private readonly random: () => number = Math.random) {}

  /** Remember that these URLs form one pool (see siblingsOf). */
  remember(urls: string[]): void {
    if (urls.length < 2) return;
    for (const u of urls) this.siblings.set(webhookIdentity(u), urls);
    if (this.siblings.size > 5000) this.siblings.clear();
  }

  /** The pool a URL was last seen in, or just the URL. */
  siblingsOf(url: string): string[] {
    const pool = this.siblings.get(webhookIdentity(url));
    return pool && pool.includes(url) ? pool : [url];
  }

  private keyOf(url: string, scope?: string): string {
    return scope ? `${scope}|${webhookIdentity(url)}` : webhookIdentity(url);
  }

  private left(key: string, now: number): number {
    const until = this.restUntil.get(key);
    if (until == null) return 0;
    if (until <= now) {
      this.restUntil.delete(key);
      return 0;
    }
    return until - now;
  }

  /** Is this webhook resting — everywhere (a 429 on that identity), or in this pool (`scope`)? */
  isResting(url: string, now: number, scope?: string): boolean {
    return this.restLeft(url, now, scope) > 0;
  }

  /**
   * Rest a webhook. Without `scope` the rest is the identity's (Discord's bucket for that exact
   * webhook, shared by every pool holding the same id AND token). With `scope` only that pool sees it.
   */
  rest(url: string, ms: number, now: number, scope?: string): void {
    const key = this.keyOf(url, scope);
    const until = now + Math.max(0, ms);
    // Never shorten a rest Discord already asked for.
    if ((this.restUntil.get(key) ?? 0) < until) this.restUntil.set(key, until);
    if (this.restUntil.size > 20_000) for (const k of [...this.restUntil.keys()]) this.left(k, now);
  }

  /** ms until this webhook may be used again (0 when it may be used now), in pool `scope` if given. */
  restLeft(url: string, now: number, scope?: string): number {
    const own = this.left(this.keyOf(url), now);
    return scope ? Math.max(own, this.left(this.keyOf(url, scope), now)) : own;
  }

  /**
   * The next webhook to use: round-robin from this pool's cursor, skipping any that are resting. When
   * every one is resting, how long until the soonest is free. Null for an empty pool.
   */
  pick(dest: WebhookDestination, now: number, exclude: ReadonlySet<string> = new Set()): PickResult {
    const urls = dest.urls;
    if (urls.length === 0) return null;
    // A random seed so a cold start doesn't send every pool's first post down url[0].
    const start = dest.preferFirst ? 0 : (this.cursors.get(dest.cursorKey) ?? Math.floor(this.random() * urls.length));
    for (let i = 0; i < urls.length; i++) {
      const url = urls[(start + i) % urls.length];
      if (exclude.has(url) || this.isResting(url, now, dest.cursorKey)) continue;
      if (!dest.preferFirst) this.cursors.set(dest.cursorKey, start + i + 1);
      return { url };
    }
    const candidates = urls.filter((u) => !exclude.has(u));
    if (candidates.length === 0) return null;
    return { waitMs: Math.min(...candidates.map((u) => this.restLeft(u, now, dest.cursorKey))) };
  }

  /** Learn from a response: a drained bucket rests the webhook until Discord says it refills. */
  noteHeaders(url: string, headers: Headers, now: number): void {
    const remaining = headers.get('x-ratelimit-remaining');
    const resetAfter = Number(headers.get('x-ratelimit-reset-after'));
    if (remaining === '0' && Number.isFinite(resetAfter) && resetAfter > 0) this.rest(url, resetAfter * 1000, now);
  }
}

// ── Retry-After ──────────────────────────────────────────────────────────────────────────────────

export interface RateLimitInfo {
  retryMs: number;
  /** 'shared' = the channel's own limit (every webhook in the pool), 'global' = this whole app. */
  scope: 'user' | 'shared' | 'global';
}

/** How long Discord asked us to wait, from the header or the (more precise) JSON body. */
export async function readRateLimit(res: Response): Promise<RateLimitInfo> {
  let retryMs = 0;
  let global = res.headers.get('x-ratelimit-global') === 'true';
  try {
    const body = (await res.clone().json()) as { retry_after?: number; global?: boolean };
    if (typeof body.retry_after === 'number') retryMs = body.retry_after * 1000;
    if (body.global === true) global = true;
  } catch {
    /* body wasn't JSON */
  }
  if (!retryMs) {
    const header = Number(res.headers.get('retry-after'));
    if (Number.isFinite(header) && header > 0) retryMs = header * 1000;
  }
  const scopeHeader = res.headers.get('x-ratelimit-scope');
  const scope = global || scopeHeader === 'global' ? 'global' : scopeHeader === 'shared' ? 'shared' : 'user';
  return { retryMs: Math.max(250, retryMs || 1000), scope };
}

// ── Sending ──────────────────────────────────────────────────────────────────────────────────────

/** The longest one post waits in total for a webhook to come free before it is given up. */
export const MAX_QUEUE_WAIT_MS = 30_000;
/** The most posts waiting at once in this process; past it a post is dropped (and counted). */
export const MAX_QUEUED = 200;
/** Attempts per post across the pool (sends, not waits). */
const MAX_ATTEMPTS = 6;

export interface PoolSendDeps {
  state: WebhookPoolState;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Structured log sink. Meta never carries a URL with its token. */
  warn?: (event: string, meta: Record<string, unknown>) => void;
  /** A 429 seen on this pool (the advice on an event's Discord tab reads it). */
  onRateLimited?: (cursorKey: string) => void;
}

export interface PoolSendResult {
  ok: boolean;
  /** HTTP status of the last attempt; 0 when nothing could be sent. */
  status: number;
  /** The final response, unread, so a caller that asked for `?wait=true` can take the message id. */
  response?: Response;
  /** Which webhook the post went out on — the one that owns the message for a later edit. */
  webhookUrl?: string;
  dropped?: boolean;
  /** Every webhook in the destination is on the platform blocklist (lib/sharedWebhooks). */
  blocked?: boolean;
}

let queuedNow = 0;

/**
 * Send one request through a pool. `buildUrl` turns the chosen webhook into the request URL (adding
 * `?wait=true` or a `/messages/<id>` suffix), and `init` is built fresh per attempt, so a multipart
 * body is never reused after being consumed.
 *
 * 429: the webhook rests for retry_after (the whole pool when the limit is the channel's) and the
 * next healthy webhook is tried at once. 404/401: that webhook is gone or its token reset, so it rests
 * for DEAD_WEBHOOK_REST_MS and the next one is tried. Every webhook resting: wait for the soonest,
 * within MAX_QUEUE_WAIT_MS and MAX_QUEUED. Any other answer is returned as it is.
 */
export async function sendThroughPool(
  dest: WebhookDestination,
  init: () => RequestInit,
  deps: PoolSendDeps,
  buildUrl: (webhookUrl: string) => string = (u) => u,
): Promise<PoolSendResult> {
  const { state } = deps;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const warn = deps.warn ?? (() => {});
  state.remember(dest.urls);

  let waited = 0;
  let attempts = 0;
  let last: PoolSendResult = { ok: false, status: 0 };
  const dead = new Set<string>();

  while (attempts < MAX_ATTEMPTS) {
    const choice = state.pick(dest, now(), dead);
    if (!choice) return last;
    if ('waitMs' in choice) {
      if (waited + choice.waitMs > MAX_QUEUE_WAIT_MS || queuedNow >= MAX_QUEUED) {
        state.counters.dropped++;
        warn('discord.pool-dropped', {
          cursorKey: dest.cursorKey,
          webhooks: dest.urls.length,
          waitMs: choice.waitMs,
          dropped: state.counters.dropped,
        });
        return { ...last, ok: false, dropped: true };
      }
      state.counters.queued++;
      queuedNow++;
      try {
        await sleep(choice.waitMs);
      } finally {
        queuedNow--;
      }
      waited += choice.waitMs;
      continue;
    }

    const url = choice.url;
    attempts++;
    let res: Response;
    try {
      res = await deps.fetch(buildUrl(url), init());
    } catch (error) {
      warn('discord.webhook-exception', {
        webhookId: webhookIdOf(url),
        message: redactWebhookUrl(String((error as Error)?.message ?? error)),
      });
      return { ok: false, status: 0, webhookUrl: url };
    }
    state.noteHeaders(url, res.headers, now());

    if (res.status === 429) {
      const info = await readRateLimit(res);
      state.counters.rateLimited++;
      deps.onRateLimited?.(dest.cursorKey);
      const restUrls = info.scope === 'user' ? [url] : dest.urls;
      for (const u of restUrls) state.rest(u, info.retryMs, now());
      warn('discord.rate-limited', {
        cursorKey: dest.cursorKey,
        webhookId: webhookIdOf(url),
        retryMs: info.retryMs,
        scope: info.scope,
        webhooks: dest.urls.length,
        rateLimited: state.counters.rateLimited,
      });
      last = { ok: false, status: 429, response: res, webhookUrl: url };
      if (dest.urls.length > 1) state.counters.failovers++;
      continue;
    }

    if ((res.status === 404 || res.status === 401) && dest.urls.length > 1) {
      // One pooled webhook deleted in Discord shouldn't silence the channel: rest it, use the rest.
      // Scoped to THIS pool: the 404 proves only that this exact URL is dead for this caller.
      state.rest(url, DEAD_WEBHOOK_REST_MS, now(), dest.cursorKey);
      dead.add(url);
      state.counters.failovers++;
      warn('discord.pool-webhook-gone', { cursorKey: dest.cursorKey, webhookId: webhookIdOf(url), status: res.status });
      last = { ok: false, status: res.status, response: res, webhookUrl: url };
      continue;
    }

    if (res.ok) state.counters.sent++;
    return { ok: res.ok, status: res.status, response: res, webhookUrl: url };
  }
  return last;
}

// ── Activity: how busy a destination is ──────────────────────────────────────────────────────────

const ACTIVITY_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;

/** Post timestamps and 429s per key (an event, a pool), kept for the advice on the Discord tab. */
export class ActivityMeter {
  private readonly posts = new Map<string, number[]>();
  private readonly limited = new Map<string, number[]>();

  private push(map: Map<string, number[]>, key: string, at: number, keepMs: number): void {
    const list = (map.get(key) ?? []).filter((t) => at - t < keepMs);
    list.push(at);
    // A hard cap keeps one runaway key from growing without bound.
    map.set(key, list.length > 2000 ? list.slice(-2000) : list);
    if (map.size > 5000) map.clear();
  }

  notePost(key: string, at: number = Date.now()): void {
    this.push(this.posts, key, at, ACTIVITY_WINDOW_MS);
  }

  noteRateLimit(key: string, at: number = Date.now()): void {
    this.push(this.limited, key, at, RATE_LIMIT_WINDOW_MS);
  }

  /** Average posts per minute over the last 10 minutes. */
  postsPerMinute(key: string, at: number = Date.now()): number {
    const n = (this.posts.get(key) ?? []).filter((t) => at - t < ACTIVITY_WINDOW_MS).length;
    return Math.round((n / (ACTIVITY_WINDOW_MS / 60_000)) * 10) / 10;
  }

  /** 429s in the last hour. */
  recentRateLimits(key: string, at: number = Date.now()): number {
    return (this.limited.get(key) ?? []).filter((t) => at - t < RATE_LIMIT_WINDOW_MS).length;
  }
}

// ── Advice: how many webhooks a destination should have ──────────────────────────────────────────

/** One webhook comfortably carries this many active players' posts. */
export const PLAYERS_PER_WEBHOOK = 40;
/** ...or this many posts a minute, well inside one webhook's bucket. */
export const POSTS_PER_MINUTE_PER_WEBHOOK = 20;
/** Discord allows 15 webhooks per channel; stop well short so the clan keeps room for its own. */
export const MAX_RECOMMENDED_WEBHOOKS = 10;

export const BIG_EVENT_PLAYERS = 50;
export const BUSY_POSTS_PER_MINUTE = 20;

/** Recommended pool size: 1 per ~40 active players or ~20 posts a minute, whichever is more, capped at 10. */
export function recommendedWebhookCount(input: { participants: number; postsPerMinute?: number }): number {
  const byPlayers = Math.ceil(Math.max(0, input.participants) / PLAYERS_PER_WEBHOOK);
  const byRate = Math.ceil(Math.max(0, input.postsPerMinute ?? 0) / POSTS_PER_MINUTE_PER_WEBHOOK);
  return Math.min(MAX_RECOMMENDED_WEBHOOKS, Math.max(1, byPlayers, byRate));
}

export interface WebhookAdvice {
  recommended: number;
  /** How many more to add to reach the recommendation. */
  missing: number;
  reasons: string[];
}

/**
 * Advice for a destination, or null when it's fine. Shown when the event is big (50+ players), busy
 * (20+ posts a minute) or Discord has recently said slow down, AND the pool is below the recommendation.
 */
export function webhookAdvice(input: {
  participants: number;
  postsPerMinute: number;
  recentRateLimits: number;
  webhooks: number;
}): WebhookAdvice | null {
  const reasons: string[] = [];
  if (input.participants >= BIG_EVENT_PLAYERS) reasons.push(`${input.participants} players`);
  if (input.postsPerMinute >= BUSY_POSTS_PER_MINUTE) reasons.push(`about ${Math.round(input.postsPerMinute)} posts a minute`);
  if (input.recentRateLimits > 0) {
    reasons.push(`Discord asked Anvil to slow down ${input.recentRateLimits} time${input.recentRateLimits === 1 ? '' : 's'} in the last hour`);
  }
  if (reasons.length === 0) return null;
  let recommended = recommendedWebhookCount(input);
  // Discord already said no to the pool as it is: one more than that is the least that helps.
  if (input.recentRateLimits > 0) recommended = Math.max(recommended, Math.min(MAX_RECOMMENDED_WEBHOOKS, input.webhooks + 1));
  const missing = Math.max(0, recommended - Math.max(0, input.webhooks));
  if (missing === 0) return null;
  return { recommended, missing, reasons };
}
