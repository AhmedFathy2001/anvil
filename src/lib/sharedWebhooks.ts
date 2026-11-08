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

import { and, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';

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
import { log } from '@/lib/logger';
import {
  BLOCKED_NOTICE,
  BLOCKED_SAVE_ERROR,
  groupSharedWebhooks,
  nextFindingStatus,
  webhookIdsIn,
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

/** A `like` filter for text naming any of these ids (or any webhook at all when ids is absent). */
function mentions(column: SQL | Parameters<typeof like>[0], ids?: string[]): SQL {
  if (!ids) return like(column as never, '%/webhooks/%');
  return or(...ids.map((id) => like(column as never, `%/webhooks/${id}/%`)))!;
}

/** Every configured webhook use, from every place a clan can put one. `ids` narrows to those. */
export async function collectWebhookUses(ids?: string[]): Promise<WebhookUse[]> {
  if (ids && ids.length === 0) return [];
  const uses: WebhookUse[] = [];
  const push = (clanId: number | null, text: string | null, where: string) => {
    if (clanId == null) return;
    for (const webhookId of webhookIdsIn(text)) if (!ids || ids.includes(webhookId)) uses.push({ webhookId, clanId, where });
  };
  const prefsText = (col: typeof events.discordPrefs | typeof eventCohosts.discordPrefs) => sql<string>`${col}::text`;

  // clan-scope: global -- comparing webhooks ACROSS clans is the purpose of this scan.
  const [settingRows, eventRows, cohostRows, hookRows, clanEventRows] = await Promise.all([
    db
      .select({ clanId: settings.clanId, key: settings.key, value: settings.value })
      .from(settings)
      .where(mentions(settings.value, ids))
      .limit(SCAN_LIMIT),
    db
      .select({ id: events.id, clanId: events.clanId, prefs: prefsText(events.discordPrefs) })
      .from(events)
      .where(mentions(sql`${events.discordPrefs}::text`, ids))
      .limit(SCAN_LIMIT),
    db
      .select({ eventId: eventCohosts.eventId, clanId: eventCohosts.clanId, prefs: prefsText(eventCohosts.discordPrefs) })
      .from(eventCohosts)
      .where(mentions(sql`${eventCohosts.discordPrefs}::text`, ids))
      .limit(SCAN_LIMIT),
    db
      .select({ eventId: eventWebhooks.eventId, clanId: events.clanId, url: eventWebhooks.url })
      .from(eventWebhooks)
      .innerJoin(events, eq(eventWebhooks.eventId, events.id))
      .where(mentions(eventWebhooks.url, ids))
      .limit(SCAN_LIMIT),
    db
      .select({ id: clanEvents.id, clanId: clanEvents.clanId, url: clanEvents.postWebhookUrl })
      .from(clanEvents)
      .where(mentions(clanEvents.postWebhookUrl, ids))
      .limit(SCAN_LIMIT),
  ]);
  for (const r of settingRows) push(r.clanId, r.value, `Setting ${r.key}`);
  for (const r of eventRows) push(r.clanId, r.prefs, `Event #${r.id} channel`);
  for (const r of cohostRows) push(r.clanId, r.prefs, `Co-host channel for event #${r.eventId}`);
  for (const r of hookRows) push(r.clanId, r.url, `Extra webhook on event #${r.eventId}`);
  for (const r of clanEventRows) push(r.clanId, r.url, `Clan event #${r.id}`);
  return uses;
}

/**
 * Scan for shared webhooks and bring the findings up to date. With `ids`, only those (the save-time
 * check); without, everything (the lifecycle tick). An OPEN finding that is no longer shared is
 * deleted; dismissed and blocked ones are kept as staff's record.
 */
export async function scanSharedWebhooks(ids?: string[]): Promise<{ shared: number; opened: number }> {
  const groups = groupSharedWebhooks(await collectWebhookUses(ids));
  const scopeIds = ids ?? null;
  const existing = await db
    .select()
    .from(sharedWebhooks)
    .where(scopeIds ? inArray(sharedWebhooks.webhookId, scopeIds.length ? scopeIds : ['-']) : undefined);
  const byId = new Map(existing.map((r) => [r.webhookId, r]));
  let opened = 0;
  for (const g of groups) {
    const prior = byId.get(g.webhookId) ?? null;
    const status = nextFindingStatus(prior, g.clanIds);
    if (status === 'open' && prior?.status !== 'open') opened++;
    await db
      .insert(sharedWebhooks)
      .values({ webhookId: g.webhookId, clanIds: g.clanIds, uses: g.uses, status })
      .onConflictDoUpdate({
        target: sharedWebhooks.webhookId,
        set: { clanIds: g.clanIds, uses: g.uses, status, lastSeenAt: new Date() },
      });
  }
  const still = new Set(groups.map((g) => g.webhookId));
  const gone = existing.filter((r) => r.status === 'open' && !still.has(r.webhookId)).map((r) => r.webhookId);
  if (gone.length) await db.delete(sharedWebhooks).where(inArray(sharedWebhooks.webhookId, gone));
  if (opened) log.info('shared-webhooks.opened', { opened, shared: groups.length });
  return { shared: groups.length, opened };
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
  uses: { clanId: number; where: string }[];
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
    uses: r.uses,
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

/** The clans using a webhook right now, from the live configuration (not just the finding). */
async function clansUsing(webhookId: string): Promise<number[]> {
  const uses = await collectWebhookUses([webhookId]);
  const finding = await db.select({ clanIds: sharedWebhooks.clanIds }).from(sharedWebhooks).where(eq(sharedWebhooks.webhookId, webhookId));
  return [...new Set([...uses.map((u) => u.clanId), ...(finding[0]?.clanIds ?? [])])];
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
  const clanIds = await clansUsing(webhookId);
  const now = new Date();

  if (action === 'block') {
    await db
      .insert(blockedWebhooks)
      .values({ webhookId, reason: input.reason?.trim() || null, blockedByUserId: actorUserId })
      .onConflictDoNothing();
    await db
      .insert(sharedWebhooks)
      .values({ webhookId, clanIds, status: 'blocked', decidedByUserId: actorUserId, decidedAt: now })
      .onConflictDoUpdate({ target: sharedWebhooks.webhookId, set: { status: 'blocked', decidedByUserId: actorUserId, decidedAt: now } });
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
