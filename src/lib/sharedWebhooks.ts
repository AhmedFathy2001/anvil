// Shared Discord webhooks: the same webhook id configured by more than one clan, raised to platform
// staff (/staff/webhooks), who can block it, unblock it, or dismiss it as a legitimate shared setup.
//
//   DETECT. Every save of a webhook (clan settings, an event's channel and pool, a co-host's channel,
//           an event's extra hooks) runs a scan of just those ids; the lifecycle tick runs a bounded
//           full scan to catch what was there before. Findings live in shared_webhooks.
//   BLOCK.  blocked_webhooks is the platform blocklist. The send layer (lib/discord deliverWebhook and
//           webhookFetch) refuses a blocked id for every clan, saving one is refused, and the clans
//           that used it see a notice (user_notices for their owner/admins, and a dashboard card).
//
// Ids only. A webhook id is a snowflake, not a secret; no token is compared or stored here. Every
// staff action writes a `platform_*` row per affected clan so it shows in /staff/audit.

import { and, asc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import {
  blockedWebhooks,
  clanAuditLog,
  clanEvents,
  clanStaff,
  clans,
  eventCohosts,
  eventWebhooks,
  events,
  settings,
  sharedWebhooks,
  userNotices,
} from '@/db/schema';
import { fetchDiscordWebhook } from '@/lib/discordWebhookUrl';
import { log } from '@/lib/logger';
import {
  BLOCKED_NOTICE,
  BLOCKED_SAVE_ERROR,
  finalizeGroup,
  groupSharedWebhooks,
  nextFindingStatus,
  webhookIdsIn,
  webhookUsesIn,
  type WebhookUse,
} from '@/lib/sharedWebhookRules';

/** Rows read per source in one scan: bounded, so a tick can never turn into a table walk without end. */
const SCAN_LIMIT = 20_000;

// ── Blocklist ────────────────────────────────────────────────────────────────────────────────────

const BLOCK_TTL_MS = 30_000;
let blockMemo: { at: number; value: Promise<Set<string>> } | null = null;

/** Every blocked webhook id, memoised for 30s (a block applies everywhere within that). */
export function blockedWebhookIds(): Promise<Set<string>> {
  if (blockMemo && Date.now() - blockMemo.at < BLOCK_TTL_MS) return blockMemo.value;
  const value = db
    .select({ id: blockedWebhooks.webhookId })
    .from(blockedWebhooks)
    .then((rows) => new Set(rows.map((r) => r.id)))
    .catch((err) => {
      log.warn('shared-webhooks.blocklist-read-fail', { err: String(err) });
      blockMemo = null;
      return new Set<string>();
    });
  blockMemo = { at: Date.now(), value };
  return value;
}

function forgetBlocklist() {
  blockMemo = null;
}

/** Does this text (a URL, a list of them) name a blocked webhook? */
export async function hasBlockedWebhook(text: string | null | undefined): Promise<boolean> {
  const ids = webhookIdsIn(text);
  if (ids.length === 0) return false;
  const blocked = await blockedWebhookIds();
  return ids.some((id) => blocked.has(id));
}

/** The refusal for a save that includes a blocked webhook, or null when it may be saved. */
export async function refuseBlockedWebhooks(values: unknown[]): Promise<string | null> {
  const text = values.filter((v): v is string => typeof v === 'string').join(' ');
  return (await hasBlockedWebhook(text)) ? BLOCKED_SAVE_ERROR : null;
}

// ── Detection ────────────────────────────────────────────────────────────────────────────────────

/**
 * The SQL prefilter. Without ids, anything that mentions a webhook at all (the full scan). With ids,
 * a regex per id that also matches a padded spelling (`webhooks/0*<id>/`), so a raw stored URL with
 * leading zeros is still found. Either way it only narrows: which webhook a URL is gets decided by the
 * canonical parser (lib/discordWebhookUrl), in code, never by SQL text matching.
 */
function mentions(column: SQL | Parameters<typeof like>[0], ids?: string[]): SQL {
  if (!ids) return like(column as never, '%webhooks/%');
  const safe = ids.filter((id) => /^\d{1,25}$/.test(id));
  if (safe.length === 0) return sql`false`;
  return or(...safe.map((id) => sql`${column} ~ ${`webhooks/0*${id}/`}`))!;
}

export interface CollectedUses {
  uses: WebhookUse[];
  /**
   * A source query hit the row limit, so this is not every use. A cut-off scan proves nothing about
   * absence: callers must not drop or close anything on the strength of it.
   */
  truncated: boolean;
}

/** Every configured webhook use, from every place a clan can put one. `ids` narrows to those. */
export async function collectWebhookUsesScan(ids?: string[], limit: number = SCAN_LIMIT): Promise<CollectedUses> {
  if (ids && ids.length === 0) return { uses: [], truncated: false };
  const uses: WebhookUse[] = [];
  const push = (clanId: number | null, text: string | null, where: string) => {
    if (clanId == null) return;
    for (const u of webhookUsesIn(text, clanId, where)) if (!ids || ids.includes(u.webhookId)) uses.push(u);
  };
  const prefsText = (col: typeof events.discordPrefs | typeof eventCohosts.discordPrefs) => sql<string>`${col}::text`;
  // One row past the limit tells a full page from a cut-off one.
  const take = limit + 1;

  // clan-scope: global -- comparing webhooks ACROSS clans is the purpose of this scan. Each source is
  // read in primary-key order, so a cut-off scan is at least the same cut every time.
  const [settingRows, eventRows, cohostRows, hookRows, clanEventRows] = await Promise.all([
    db
      .select({ clanId: settings.clanId, key: settings.key, value: settings.value })
      .from(settings)
      .where(mentions(settings.value, ids))
      .orderBy(asc(settings.clanId), asc(settings.key))
      .limit(take),
    db
      .select({ id: events.id, clanId: events.clanId, prefs: prefsText(events.discordPrefs) })
      .from(events)
      .where(mentions(sql`${events.discordPrefs}::text`, ids))
      .orderBy(asc(events.id))
      .limit(take),
    db
      .select({ eventId: eventCohosts.eventId, clanId: eventCohosts.clanId, prefs: prefsText(eventCohosts.discordPrefs) })
      .from(eventCohosts)
      .where(mentions(sql`${eventCohosts.discordPrefs}::text`, ids))
      .orderBy(asc(eventCohosts.id))
      .limit(take),
    db
      .select({ eventId: eventWebhooks.eventId, clanId: events.clanId, url: eventWebhooks.url })
      .from(eventWebhooks)
      .innerJoin(events, eq(eventWebhooks.eventId, events.id))
      .where(mentions(eventWebhooks.url, ids))
      .orderBy(asc(eventWebhooks.id))
      .limit(take),
    db
      .select({ id: clanEvents.id, clanId: clanEvents.clanId, url: clanEvents.postWebhookUrl })
      .from(clanEvents)
      .where(mentions(clanEvents.postWebhookUrl, ids))
      .orderBy(asc(clanEvents.id))
      .limit(take),
  ]);
  const truncated = [settingRows, eventRows, cohostRows, hookRows, clanEventRows].some((rows) => rows.length > limit);
  for (const r of settingRows.slice(0, limit)) push(r.clanId, r.value, `Setting ${r.key}`);
  for (const r of eventRows.slice(0, limit)) push(r.clanId, r.prefs, `Event #${r.id} channel`);
  for (const r of cohostRows.slice(0, limit)) push(r.clanId, r.prefs, `Co-host channel for event #${r.eventId}`);
  for (const r of hookRows.slice(0, limit)) push(r.clanId, r.url, `Extra webhook on event #${r.eventId}`);
  for (const r of clanEventRows.slice(0, limit)) push(r.clanId, r.url, `Clan event #${r.id}`);
  if (truncated) log.warn('shared-webhooks.scan-truncated', { limit, targeted: !!ids });
  return { uses, truncated };
}

/** The uses alone, for callers that only read (the dashboard card). */
export async function collectWebhookUses(ids?: string[]): Promise<WebhookUse[]> {
  return (await collectWebhookUsesScan(ids)).uses;
}

type Verdict = 'real' | 'invalid' | 'unknown';

/**
 * Is this webhook real? Asked of Discord with its own token through the guarded fetch: 2xx = real,
 * 401/404 = not (a made-up token, a deleted webhook), anything else (Discord down) = unknown.
 */
async function verifyWebhook(url: string): Promise<Verdict> {
  try {
    const pending = fetchDiscordWebhook(url, { method: 'GET', signal: AbortSignal.timeout(8_000) });
    if (!pending) return 'invalid';
    const res = await pending;
    if (res.ok) return 'real';
    return res.status === 401 || res.status === 404 ? 'invalid' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Scan for shared webhooks and bring the findings up to date. With `ids`, only those (the save-time
 * check); without, everything (the lifecycle tick). `limit` is the per-source row cap (tests lower it).
 *
 * A finding needs the SAME webhook (id and token) in two clans, and Discord saying it is real. Every
 * identity held by 2+ clans is checked, so junk-token clans can never outnumber the real holders. Per id:
 *   - some identity confirmed real: the finding is written for the confirmed clans;
 *   - none confirmed but Discord couldn't be asked for one: left exactly as it was;
 *   - every candidate refused by Discord: nothing is created, and an open finding is dropped.
 * An open finding whose id is no longer shared is dropped too, but NEVER on a cut-off scan: when any
 * source hit the limit, absence proves nothing and every existing finding is kept.
 */
export async function scanSharedWebhooks(
  ids?: string[],
  opts: { limit?: number } = {},
): Promise<{ shared: number; opened: number; truncated: boolean }> {
  const { uses, truncated } = await collectWebhookUsesScan(ids, opts.limit);
  const groups = groupSharedWebhooks(uses);
  const existing = await db
    .select()
    .from(sharedWebhooks)
    .where(ids ? inArray(sharedWebhooks.webhookId, ids.length ? ids : ['-']) : undefined);
  const byId = new Map(existing.map((r) => [r.webhookId, r]));
  let opened = 0;
  const keep = new Set<string>();
  const verdicts = new Map<string, Verdict>();
  for (const g of groups) {
    const prior = byId.get(g.webhookId) ?? null;
    const confirmed = new Set<string>();
    let unknown = false;
    for (const c of g.candidates) {
      const v = verdicts.get(c.identity) ?? (await verifyWebhook(c.sampleUrl));
      verdicts.set(c.identity, v);
      if (v === 'real') confirmed.add(c.identity);
      else if (v === 'unknown') unknown = true;
    }
    const finding = finalizeGroup(g, confirmed);
    if (!finding) {
      // Nothing confirmed. Discord unreachable for some candidate: keep what was there.
      if (prior && (unknown || truncated || prior.status !== 'open')) keep.add(g.webhookId);
      continue;
    }
    keep.add(g.webhookId);
    const status = nextFindingStatus(prior, finding.clanIds);
    if (status === 'open' && prior?.status !== 'open') opened++;
    await db
      .insert(sharedWebhooks)
      .values({ webhookId: g.webhookId, clanIds: finding.clanIds, uses: finding.uses, status, verified: true })
      .onConflictDoUpdate({
        target: sharedWebhooks.webhookId,
        set: { clanIds: finding.clanIds, uses: finding.uses, status, verified: true, lastSeenAt: new Date() },
      });
  }
  if (!truncated) {
    const gone = existing.filter((r) => r.status === 'open' && !keep.has(r.webhookId)).map((r) => r.webhookId);
    if (gone.length) await db.delete(sharedWebhooks).where(inArray(sharedWebhooks.webhookId, gone));
  }
  if (opened) log.info('shared-webhooks.opened', { opened, shared: keep.size });
  return { shared: keep.size, opened, truncated };
}

/** After a save: check the ids it touched, in the background. Never throws, never delays the save. */
export function noteWebhookSave(values: unknown[]): void {
  const ids = webhookIdsIn(values.filter((v): v is string => typeof v === 'string').join(' '));
  if (ids.length === 0) return;
  void scanSharedWebhooks(ids).catch((err) => log.warn('shared-webhooks.save-scan-fail', { err: String(err) }));
}

/** The lifecycle tick's full scan, at most once an hour per process. */
let lastFullScan = 0;
export async function runSharedWebhookScan(nowMs: number = Date.now()): Promise<void> {
  if (nowMs - lastFullScan < 60 * 60_000) return;
  lastFullScan = nowMs;
  await scanSharedWebhooks();
}

// ── Staff ────────────────────────────────────────────────────────────────────────────────────────

export interface SharedWebhookView {
  webhookId: string;
  /** For display: the last digits only. */
  masked: string;
  status: string;
  clans: { id: number; name: string; slug: string | null }[];
  /** `tokenMatches` false: the same id with another (possibly made-up) token. Shown apart. */
  uses: { clanId: number; where: string; tokenMatches: boolean }[];
  /** Discord confirmed the shared webhook is real. Block is only offered when it is. */
  verified: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  blocked: boolean;
}

export const maskId = (id: string) => `…${id.slice(-4)}`;

export async function openSharedWebhookCount(): Promise<number> {
  // clan-scope: global -- the platform's queue.
  const rows = await db.select({ id: sharedWebhooks.webhookId }).from(sharedWebhooks).where(eq(sharedWebhooks.status, 'open'));
  return rows.length;
}

export async function listSharedWebhooks(status: 'open' | 'all'): Promise<SharedWebhookView[]> {
  // clan-scope: global -- staff see every clan's findings.
  const rows = await db
    .select()
    .from(sharedWebhooks)
    .where(status === 'open' ? eq(sharedWebhooks.status, 'open') : undefined)
    .orderBy(sql`${sharedWebhooks.firstSeenAt} desc`)
    .limit(200);
  const clanIds = [...new Set(rows.flatMap((r) => r.clanIds))];
  const [clanRows, blocked] = await Promise.all([
    clanIds.length ? db.select({ id: clans.id, name: clans.name, slug: clans.slug }).from(clans).where(inArray(clans.id, clanIds)) : [],
    blockedWebhookIds(),
  ]);
  const byId = new Map(clanRows.map((c) => [c.id, c]));
  return rows.map((r) => ({
    webhookId: r.webhookId,
    masked: maskId(r.webhookId),
    status: r.status,
    clans: r.clanIds.map((id) => byId.get(id) ?? { id, name: `Clan #${id}`, slug: null }),
    uses: r.uses.map((u) => ({ clanId: u.clanId, where: u.where, tokenMatches: u.tokenMatches !== false })),
    verified: r.verified,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    blocked: blocked.has(r.webhookId),
  }));
}

async function auditEach(clanIds: number[], eventType: string, actorUserId: number, webhookId: string, notes: string) {
  if (clanIds.length === 0) return;
  await db
    .insert(clanAuditLog)
    .values(clanIds.map((clanId) => ({ clanId, eventType, actorUserId, newValue: JSON.stringify({ webhookId: maskId(webhookId) }), notes })))
    .catch((err) => log.warn('shared-webhooks.audit-fail', { err: String(err) }));
}

/** The finding's clans: the ones holding the real, shared webhook (id AND token), not junk pastes. */
async function findingOf(webhookId: string) {
  const [row] = await db.select().from(sharedWebhooks).where(eq(sharedWebhooks.webhookId, webhookId));
  return row ?? null;
}

/** Tell each affected clan's owner and admins, on the site. */
async function noticeClanAdmins(clanIds: number[]) {
  if (clanIds.length === 0) return;
  const staff = await db
    .select({ userId: clanStaff.userId })
    .from(clanStaff)
    .where(and(inArray(clanStaff.clanId, clanIds), inArray(clanStaff.role, ['owner', 'admin'])));
  const userIds = [...new Set(staff.map((s) => s.userId))];
  if (userIds.length === 0) return;
  const now = new Date().toISOString();
  await db
    .insert(userNotices)
    .values(userIds.map((userId) => ({ userId, kind: 'webhook_blocked', title: BLOCKED_NOTICE.title, body: BLOCKED_NOTICE.body, createdAt: now })))
    .catch((err) => log.warn('shared-webhooks.notice-fail', { err: String(err) }));
}

export type StaffWebhookAction = 'block' | 'unblock' | 'dismiss';

export async function actOnSharedWebhook(input: {
  webhookId: string;
  action: StaffWebhookAction;
  actorUserId: number;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { webhookId, action, actorUserId } = input;
  if (!/^\d{5,25}$/.test(webhookId)) return { ok: false, error: 'Not a webhook id.', status: 400 };
  const finding = await findingOf(webhookId);
  if (!finding) return { ok: false, error: 'No such finding.', status: 404 };
  const clanIds = finding.clanIds;
  const now = new Date();

  if (action === 'block') {
    // Block is platform-wide for the id. Only on a webhook Discord confirmed is real and shared, so a
    // made-up token pasted beside another clan's id can never get the real owner's webhook blocked.
    if (!finding.verified) {
      return { ok: false, error: 'Discord has not confirmed this is one real webhook shared by these clans, so it can’t be blocked.', status: 409 };
    }
    await db
      .insert(blockedWebhooks)
      .values({ webhookId, reason: input.reason?.trim() || null, blockedByUserId: actorUserId })
      .onConflictDoNothing();
    await db
      .update(sharedWebhooks)
      .set({ status: 'blocked', decidedByUserId: actorUserId, decidedAt: now })
      .where(eq(sharedWebhooks.webhookId, webhookId));
    forgetBlocklist();
    await auditEach(clanIds, 'platform_webhook_blocked', actorUserId, webhookId, input.reason?.trim() || 'Shared with another clan');
    await noticeClanAdmins(clanIds);
    return { ok: true };
  }
  if (action === 'unblock') {
    await db.delete(blockedWebhooks).where(eq(blockedWebhooks.webhookId, webhookId));
    // Back to the queue if it is still shared; the next scan drops it if not.
    await db
      .update(sharedWebhooks)
      .set({ status: 'open', decidedByUserId: actorUserId, decidedAt: now })
      .where(eq(sharedWebhooks.webhookId, webhookId));
    forgetBlocklist();
    await auditEach(clanIds, 'platform_webhook_unblocked', actorUserId, webhookId, 'Webhook unblocked');
    await scanSharedWebhooks([webhookId]).catch(() => {});
    return { ok: true };
  }
  if (action === 'dismiss') {
    const res = await db
      .update(sharedWebhooks)
      .set({ status: 'dismissed', decidedByUserId: actorUserId, decidedAt: now })
      .where(eq(sharedWebhooks.webhookId, webhookId))
      .returning({ id: sharedWebhooks.webhookId });
    if (res.length === 0) return { ok: false, error: 'No such finding.', status: 404 };
    await auditEach(clanIds, 'platform_webhook_dismissed', actorUserId, webhookId, 'Shared webhook left as it is');
    return { ok: true };
  }
  return { ok: false, error: 'Unknown action.', status: 400 };
}

/** Where a clan still has a blocked webhook configured, for its dashboard card. */
export async function clanBlockedWebhookUses(clanId: number): Promise<string[]> {
  const blocked = [...(await blockedWebhookIds())];
  if (blocked.length === 0) return [];
  const uses = await collectWebhookUses(blocked);
  return [...new Set(uses.filter((u) => u.clanId === clanId).map((u) => u.where))];
}
