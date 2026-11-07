// Notices from Anvil: the database half (the rules are lib/noticeRules).
//
// One notice, written once on /staff/notices, shows wherever it was ticked to: the site inbox (always),
// the plugin panel's "From Anvil" card, the login brief, and a bot DM for people who said yes to DMs.
// Who it's for is worked out when it's READ, from what the person is right now (an admin, a supporter),
// so a notice to "admins" reaches someone who becomes one next week, and nothing is fanned out to rows.

import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff, platformNoticeReads, platformNotices, users } from '@/db/schema';
import { apexDomain } from '@/lib/clanContext';
import { sharedBotToken } from '@/lib/discord-roles';
import { log } from '@/lib/logger';
import {
  BODY_MAX,
  LINK_LABEL_MAX,
  TITLE_MAX,
  audienceKey,
  clip,
  noticeBriefLine,
  noticeDmContent,
  noticeIsFor,
  parseAudience,
  safeNoticeLink,
  type NoticeLevel,
  type ReaderFacts,
} from '@/lib/noticeRules';
import { sendDm } from '@/lib/onboardingNudge';
import { apexOrigin } from '@/lib/seo';
import { supporterForUser, supporterForUsers } from '@/lib/supporter';
import { mayReach } from '@/lib/welcomeDm';
import { stopRow } from '@/lib/welcomeDmText';

/** How far back the inbox looks. Older notices have done their job. */
const LOOKBACK_DAYS = 90;
/** The brief only prints recent notices, so someone's first login doesn't replay months of them. */
const BRIEF_DAYS = 14;

export type NoticeRow = typeof platformNotices.$inferSelect;

export interface NoticeView {
  id: number;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  level: NoticeLevel;
  createdAt: string;
  read: boolean;
}

async function readerFacts(userId: number): Promise<ReaderFacts> {
  const [staff, supporter] = await Promise.all([
    db
      .select({ clanId: clanStaff.clanId })
      .from(clanStaff)
      .where(and(eq(clanStaff.userId, userId), inArray(clanStaff.role, ['owner', 'admin']))),
    supporterForUser(userId).catch(() => null),
  ]);
  return { userId, staffClanIds: staff.map((s) => s.clanId), tier: supporter?.tier.id ?? null };
}

/** Live notices from the lookback window, newest first, with this person's read state. */
async function candidates(userId: number, sinceDays = LOOKBACK_DAYS) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  return db
    .select({ n: platformNotices, r: platformNoticeReads })
    .from(platformNotices)
    .leftJoin(platformNoticeReads, and(eq(platformNoticeReads.noticeId, platformNotices.id), eq(platformNoticeReads.userId, userId)))
    .where(
      and(
        isNull(platformNotices.withdrawnAt),
        gt(platformNotices.createdAt, since),
        or(isNull(platformNotices.expiresAt), gt(platformNotices.expiresAt, new Date())),
      ),
    )
    .orderBy(desc(platformNotices.createdAt))
    .limit(100);
}

async function forReader(userId: number, sinceDays?: number) {
  const [rows, facts] = await Promise.all([candidates(userId, sinceDays), readerFacts(userId)]);
  return rows.filter(({ n }) => {
    const a = parseAudience(n.audience);
    return !!a && noticeIsFor(a, facts);
  });
}

function view(n: NoticeRow, read: boolean): NoticeView {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    linkUrl: n.linkUrl,
    linkLabel: n.linkLabel,
    level: n.level === 'important' ? 'important' : 'info',
    createdAt: n.createdAt.toISOString(),
    read,
  };
}

/** The inbox: unread important ones first, then newest. */
export async function inboxFor(userId: number): Promise<{ notices: NoticeView[]; unread: number }> {
  const rows = await forReader(userId);
  const notices = rows.map(({ n, r }) => view(n, !!r?.readAt));
  notices.sort((a, b) => Number(!b.read && b.level === 'important') - Number(!a.read && a.level === 'important'));
  return { notices, unread: notices.filter((x) => !x.read).length };
}

const STAMP_COLUMN = { readAt: 'read_at', panelHiddenAt: 'panel_hidden_at', briefedAt: 'briefed_at' } as const;

/** Stamp a column on this person's rows, keeping the first time it happened. */
async function stamp(userId: number, noticeIds: number[], col: keyof typeof STAMP_COLUMN): Promise<void> {
  if (noticeIds.length === 0) return;
  const now = new Date();
  const name = sql.raw(`"${STAMP_COLUMN[col]}"`);
  await db
    .insert(platformNoticeReads)
    .values(noticeIds.map((noticeId) => ({ noticeId, userId, [col]: now })))
    .onConflictDoUpdate({
      target: [platformNoticeReads.noticeId, platformNoticeReads.userId],
      set: { [col]: sql`coalesce("platform_notice_reads".${name}, excluded.${name})` },
    });
}

/** Mark read: the given ids that are really this person's, or all of them. */
export async function markRead(userId: number, ids: number[] | 'all'): Promise<void> {
  const mine = (await forReader(userId)).filter(({ r }) => !r?.readAt).map(({ n }) => n.id);
  await stamp(userId, ids === 'all' ? mine : mine.filter((id) => ids.includes(id)), 'readAt');
}

/** The plugin panel's card: the newest panel notice they haven't read on the site or hidden. Text only. */
export async function panelNoticeFor(userId: number): Promise<{ id: number; title: string; body: string; important: boolean } | null> {
  const hit = (await forReader(userId)).find(({ n, r }) => n.inPlugin && !r?.readAt && !r?.panelHiddenAt);
  return hit ? { id: hit.n.id, title: clip(hit.n.title, TITLE_MAX), body: clip(hit.n.body, 220), important: hit.n.level === 'important' } : null;
}

export async function hidePanelNotice(userId: number, noticeId: number): Promise<void> {
  const mine = (await forReader(userId)).some(({ n }) => n.id === noticeId);
  if (mine) await stamp(userId, [noticeId], 'panelHiddenAt');
}

/** One brief line for the newest recent brief notice not printed to them yet, stamped as printed. */
export async function briefNoticeLine(userId: number): Promise<string | null> {
  const hit = (await forReader(userId, BRIEF_DAYS)).find(({ n, r }) => n.inBrief && !r?.briefedAt && !r?.readAt);
  if (!hit) return null;
  await stamp(userId, [hit.n.id], 'briefedAt');
  return noticeBriefLine(hit.n);
}

// ---- Writing (staff) --------------------------------------------------------------------------------

export interface NoticeInput {
  title: unknown;
  body: unknown;
  linkUrl: unknown;
  linkLabel: unknown;
  audience: unknown;
  inPlugin: unknown;
  inBrief: unknown;
  byDm: unknown;
  level: unknown;
  expiresInDays: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function siteHosts(): string[] {
  return [...new Set(['anvilosrs.com', apexDomain().replace(/^beta\./, '')].filter(Boolean))];
}

export async function createNotice(input: NoticeInput, actorUserId: number): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const title = clip(str(input.title), TITLE_MAX);
  if (!title) return { ok: false, error: 'Give it a title.' };
  const body = str(input.body).trim().slice(0, BODY_MAX);
  const audience = parseAudience(str(input.audience));
  if (!audience) return { ok: false, error: 'Pick who it is for.' };
  if (audience.kind === 'user') {
    const u = await db.query.users.findFirst({ where: eq(users.id, audience.userId), columns: { id: true } });
    if (!u) return { ok: false, error: 'No such person.' };
  }
  const rawLink = str(input.linkUrl).trim();
  const linkUrl = safeNoticeLink(rawLink, siteHosts());
  if (rawLink && !linkUrl) return { ok: false, error: 'Links can only go to an Anvil page or a Discord invite, and never to a file.' };
  const days = Number(input.expiresInDays);
  const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + Math.min(days, 365) * 86_400_000) : null;
  const [row] = await db
    .insert(platformNotices)
    .values({
      title,
      body,
      linkUrl,
      linkLabel: linkUrl ? clip(str(input.linkLabel), LINK_LABEL_MAX) || null : null,
      audience: audienceKey(audience),
      inPlugin: input.inPlugin === true,
      inBrief: input.inBrief === true,
      byDm: input.byDm === true,
      level: input.level === 'important' ? 'important' : 'info',
      createdByUserId: actorUserId,
      expiresAt,
    })
    .returning({ id: platformNotices.id });
  if (input.byDm === true) void sendNoticeDms(row.id);
  return { ok: true, id: row.id };
}

export async function withdrawNotice(id: number): Promise<void> {
  await db.update(platformNotices).set({ withdrawnAt: new Date() }).where(eq(platformNotices.id, id));
}

/** Everything sent, newest first, with how many have read each. */
export async function staffNoticeList(): Promise<(NoticeRow & { reads: number })[]> {
  const rows = await db.select().from(platformNotices).orderBy(desc(platformNotices.createdAt)).limit(100);
  if (rows.length === 0) return [];
  const counts = await db
    .select({ id: platformNoticeReads.noticeId, n: sql<number>`count(${platformNoticeReads.readAt})::int` })
    .from(platformNoticeReads)
    .where(inArray(platformNoticeReads.noticeId, rows.map((r) => r.id)))
    .groupBy(platformNoticeReads.noticeId);
  const by = new Map(counts.map((c) => [c.id, c.n]));
  return rows.map((r) => ({ ...r, reads: by.get(r.id) ?? 0 }));
}

/**
 * DM a notice to everyone it's for who said yes to DMs, once. Only people who pressed "Yes" on the
 * welcome are even considered, so the set is small; facts are read in a batch. Each DM carries Stop.
 */
export async function sendNoticeDms(noticeId: number, opts: { pauseMs?: number } = {}): Promise<number> {
  try {
    const token = sharedBotToken();
    const notice = await db.query.platformNotices.findFirst({ where: eq(platformNotices.id, noticeId) });
    const audience = parseAudience(notice?.audience);
    if (!token || !notice || !audience || notice.dmSentAt || notice.withdrawnAt) return 0;
    const opted = await db
      .select({ id: users.id, discordId: users.discordId, isOwner: users.isOwner, platformRole: users.platformRole })
      .from(users)
      .where(and(eq(users.anvilDms, 'yes'), eq(users.banned, false)));
    const ids = opted.map((u) => u.id);
    const [staff, tiers] = ids.length
      ? await Promise.all([
          db
            .select({ userId: clanStaff.userId, clanId: clanStaff.clanId })
            .from(clanStaff)
            .where(and(inArray(clanStaff.userId, ids), inArray(clanStaff.role, ['owner', 'admin']))),
          supporterForUsers(ids),
        ])
      : [[], new Map()];
    const content = noticeDmContent(notice, apexOrigin());
    let sent = 0;
    for (const u of opted) {
      if (!u.discordId || !mayReach(u)) continue;
      const facts: ReaderFacts = {
        userId: u.id,
        staffClanIds: staff.filter((s) => s.userId === u.id).map((s) => s.clanId),
        tier: tiers.get(u.id)?.tier.id ?? null,
      };
      if (!noticeIsFor(audience, facts)) continue;
      const ok = await sendDm(token, u.discordId, { content, allowed_mentions: { parse: [] }, components: [stopRow()] }).catch(() => false);
      if (ok) sent++;
      await new Promise((r) => setTimeout(r, opts.pauseMs ?? 300));
    }
    await db.update(platformNotices).set({ dmSentAt: new Date(), dmSentCount: sent }).where(eq(platformNotices.id, noticeId));
    return sent;
  } catch (err) {
    log.warn('notices.dm-failed', { noticeId }, err);
    return 0;
  }
}
