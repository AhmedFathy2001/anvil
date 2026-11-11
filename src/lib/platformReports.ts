// Platform reports, the database half (lib/platformReportRules is the pure half): a signed-in viewer
// reports a creator page or panel, a clan, an event, a player profile or a stream highlight to Anvil
// staff, and staff clear the queue at /staff/promotions ("Reports").
//
// One table, promo_reports (it began as the creator-page queue in 0211; 0213 generalised it). A report
// carries what it is about (target_type + target_id), the reporter's reason and optional note, and a
// snapshot of the content as it was — sanitized text and URLs only.
//
// THE REPORTER IS NEVER SHOWN TO THE REPORTED PARTY. Nothing outside the platform queue reads this
// table, the report route answers the same "thanks" whether the report is new or a duplicate, and the
// operator log records staff actions without the reporter.
//
// STAFF ACT WITH POWERS THE PLATFORM ALREADY HAS: hiding a creator panel or a page's promotions
// (lib/spacePage), the platform hide of a clan from every directory (clans.platform_hidden, the same
// switch as /staff/clans), and hiding a stream highlight. Nothing here suspends, bans or deletes.

import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clans, events, promoReports, spacePanels, spaceProfiles, streamHighlights, users } from '@/db/schema';
import { apexPerson } from '@/lib/apexProfiles';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { canSeeClan } from '@/lib/clanAccess';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { canSeeEvent } from '@/lib/eventAccess';
import { showable } from '@/lib/highlights/rules';
import { rateLimitByKey } from '@/lib/rate-limit';
import { standingsHidden } from '@/lib/standingsVisibility';
import { reportContent, staffSetPanelHidden, staffSetSpaceHidden } from '@/lib/spacePage/store';
import {
  buildSnapshot,
  cleanReportNote,
  cleanStaffNote,
  isReportCategory,
  isReportTarget,
  type ReportAction,
  type ReportCategory,
  type ReportStatus,
  type ReportTarget,
  TARGET_ACTIONS,
} from '@/lib/platformReportRules';
import type { Checked } from '@/lib/spacePage/rules';
import { clanBasePath,clanPathOf } from '@/lib/clanScopedPaths';

// ── Rate limits ──────────────────────────────────────────────────────────────────────────────────

/** Per person and per network, shared by every kind of report (and the older /api/space-report). */
export const REPORT_RATE = {
  perUser: { limit: 5, windowMs: 10 * 60_000 },
  perIp: { limit: 20, windowMs: 10 * 60_000 },
} as const;

/** One report attempt against both budgets. `ip` is lib/clientIp's answer for the request. */
export async function reportRateCheck(userId: number, ip: string): Promise<{ ok: boolean; reset: number }> {
  const perUser = await rateLimitByKey('space-report', String(userId), REPORT_RATE.perUser);
  const perIp = await rateLimitByKey('space-report-ip', ip, REPORT_RATE.perIp);
  return { ok: perUser.ok && perIp.ok, reset: Math.max(perUser.reset, perIp.reset) };
}

// ── Filing ───────────────────────────────────────────────────────────────────────────────────────

export interface ReportInput {
  type: unknown;
  id: unknown;
  category: unknown;
  note: unknown;
  reporterUserId: number;
  /** The reporter's player id, for "may they see this?" (an event, an unshared character). */
  reporterPlayerId: number | null;
}

interface Resolved {
  clanId: number | null;
  snapshot: string;
}

/** The one answer for "no such thing" AND "not yours to see" — a report is never an existence oracle. */
export const NOT_FOUND_ERROR = 'That is not there any more.';
const GONE: Checked<never> = { ok: false, error: NOT_FOUND_ERROR };

type ClanRow = typeof clans.$inferSelect;

/**
 * May this reporter see this clan's (or creator space's) page as it stands? A public clan the
 * platform has not hidden, yes. A members-only clan, or one the platform hid from the public, only
 * for someone with a seat or a staff grant in it (lib/clanAccess canSeeClan, the rule the clan layout
 * gates its pages with). Archived clans for nobody.
 */
async function reporterSeesClan(c: ClanRow | undefined, playerId: number | null, userId: number): Promise<boolean> {
  if (!c || c.status === 'archived') return false;
  const openToAll = clanVisibilityOf(c.visibility) === 'public' && !c.platformHidden;
  if (openToAll) return true;
  // Forced to the closed rule so only a seat or a grant opens it, whatever `visibility` says.
  return canSeeClan({ clanId: c.id, visibility: 'members', playerId, userId });
}

/**
 * The reported thing as the reporter can see it, with its snapshot — or null when it does not exist
 * or is not theirs to see (the same answer for both, so a report cannot probe for hidden things).
 */
async function resolveTarget(type: ReportTarget, id: number, playerId: number | null, userId: number): Promise<Resolved | null> {
  switch (type) {
    case 'clan': {
      // clan-scope: global -- the reported clan, addressed by its own id.
      const c = await db.query.clans.findFirst({ where: eq(clans.id, id) });
      if (!c || !(await reporterSeesClan(c, playerId, userId))) return null;
      return {
        clanId: c.id,
        snapshot: buildSnapshot(
          [
            ['Name', c.name],
            ['Address', clanBasePath(c)],
            ['Tagline', c.tagline],
            ['About', c.description],
          ],
          [
            ['Logo', c.logoUrl],
            ['Banner', c.bannerUrl],
          ],
        ),
      };
    }
    case 'event': {
      if (!(await canSeeEvent({ eventId: id, playerId }))) return null;
      // clan-scope: global -- the reported event by its own id, already access-checked above.
      const [e] = await db
        .select({ id: events.id, name: events.name, bannerUrl: events.bannerUrl, clanId: events.clanId, hostName: clans.name, hostSlug: clans.slug, hostKind: clans.kind })
        .from(events)
        .innerJoin(clans, eq(clans.id, events.clanId))
        .where(eq(events.id, id))
        .limit(1);
      if (!e) return null;
      return {
        clanId: e.clanId,
        snapshot: buildSnapshot(
          [
            ['Event', e.name],
            ['Host', `${e.hostName} (${clanBasePath({ slug: e.hostSlug, kind: e.hostKind })})`],
            ['Address', clanPathOf({ slug: e.hostSlug, kind: e.hostKind }, `/events/${e.id}`)],
          ],
          [['Banner', e.bannerUrl]],
        ),
      };
    }
    case 'character': {
      // clan-scope: global -- a character belongs to a person, not to a clan.
      const a = await db.query.accounts.findFirst({ where: eq(accounts.id, id), columns: { id: true, rsn: true, shared: true, playerId: true } });
      // The same rule as /p/<rsn>: shared, or the viewer's own.
      if (!a || (!a.shared && a.playerId !== playerId)) return null;
      return { clanId: null, snapshot: buildSnapshot([['Character', a.rsn], ['Address', `/p/${encodeURIComponent(a.rsn)}`]]) };
    }
    case 'person': {
      const p = await apexPerson(id);
      if (!p) return null;
      return {
        clanId: null,
        snapshot: buildSnapshot([
          ['Person', p.label],
          ['Address', `/u/${p.playerId}`],
          ['Characters', p.characters.map((c) => c.rsn).join(', ')],
        ]),
      };
    }
    case 'highlight': {
      // clan-scope: global -- the reported clip by its own id; its event is access-checked below.
      const [h] = await db
        .select({ h: streamHighlights, eventName: events.name, rules: events.rules, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
        .from(streamHighlights)
        .innerJoin(events, eq(events.id, streamHighlights.eventId))
        .where(and(eq(streamHighlights.id, id), isNull(streamHighlights.staffHiddenAt)))
        .limit(1);
      if (!h || !showable({ clipUrl: h.h.clipStatus === 'ready' ? h.h.clipUrl : null, vodUrl: h.h.vodStatus === 'ready' ? h.h.vodUrl : null })) return null;
      if (!(await canSeeEvent({ eventId: h.h.eventId, playerId }))) return null;
      // Behind hidden standings a team's clip is that team's secret (lib/highlights visibleToScope);
      // only the start, which names no side, is anybody's to see — and so to report.
      if (h.h.beat !== 'start' && standingsHidden({ rules: h.rules, endDate: h.endDate, forceEndedAt: h.forceEndedAt })) return null;
      return {
        clanId: h.h.clanId,
        snapshot: buildSnapshot(
          [
            ['Title', h.h.title],
            ['Channel', `${h.h.platform} / ${h.h.channelName}`],
            ['Event', h.eventName],
          ],
          [
            ['Clip', h.h.clipUrl],
            ['Stream', h.h.vodUrl],
          ],
        ),
      };
    }
    default:
      return null;
  }
}

/**
 * File a report. One open report per person per thing — a second press answers with the first. The
 * creator page and panel go through lib/spacePage reportContent, which owns their snapshot.
 */
export async function fileReport(input: ReportInput): Promise<Checked<number>> {
  if (!isReportTarget(input.type)) return { ok: false, error: 'That cannot be reported.' };
  const category: ReportCategory = isReportCategory(input.category) ? input.category : 'other';
  if (input.category != null && !isReportCategory(input.category)) return { ok: false, error: 'Pick a reason.' };
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'That cannot be reported.' };
  const note = cleanReportNote(input.note);
  if (!note.ok) return note;

  if (input.type === 'space' || input.type === 'creator_panel') {
    let clanId = id;
    if (input.type === 'creator_panel') {
      // clan-scope: global -- the reported panel by its own id; reportContent checks it is the space's.
      const p = await db.query.spacePanels.findFirst({ where: eq(spacePanels.id, id), columns: { clanId: true } });
      if (!p) return GONE;
      clanId = p.clanId;
    }
    // clan-scope: global -- the reported space by its own id.
    const c = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
    if (!c || !isCreatorSpace(c) || !(await reporterSeesClan(c, input.reporterPlayerId, input.reporterUserId))) return GONE;
    const r = await reportContent(
      { id: c.id, slug: c.slug },
      { panelId: input.type === 'creator_panel' ? id : null, reason: note.value, reporterUserId: input.reporterUserId, category },
    );
    // A panel the host or staff hid answers exactly like a missing one.
    return r.ok ? r : GONE;
  }

  const target = await resolveTarget(input.type, id, input.reporterPlayerId, input.reporterUserId);
  if (!target) return GONE;

  // clan-scope: global -- one open report per reporter per reported thing, addressed by its own id.
  const [dupe] = await db
    .select({ id: promoReports.id })
    .from(promoReports)
    .where(
      and(
        eq(promoReports.targetType, input.type),
        eq(promoReports.targetId, id),
        eq(promoReports.reporterUserId, input.reporterUserId),
        eq(promoReports.status, 'open'),
      ),
    )
    .limit(1);
  if (dupe) return { ok: true, value: dupe.id };

  const [row] = await db
    .insert(promoReports)
    .values({
      clanId: target.clanId,
      targetType: input.type,
      targetId: id,
      category,
      reporterUserId: input.reporterUserId,
      reason: note.value || null,
      snapshot: target.snapshot,
    })
    .returning({ id: promoReports.id });
  return { ok: true, value: row.id };
}

// ── The staff queue ──────────────────────────────────────────────────────────────────────────────

export interface StaffReport {
  id: number;
  targetType: ReportTarget;
  targetId: number | null;
  category: string;
  status: ReportStatus;
  /** The reporter's note. */
  note: string | null;
  staffNote: string | null;
  snapshot: string;
  createdAt: string;
  resolvedAt: string | null;
  /** Staff-only: who reported it. Never shown anywhere else. */
  reporter: string | null;
  resolvedBy: string | null;
  /** The clan it lives under (null for a player profile). */
  clan: { id: number; name: string; slug: string; platformHidden: boolean; kind: string } | null;
  /** A short name for the thing, from its live row (falls back to the snapshot when it is gone). */
  title: string | null;
  /** Where staff can look at it now. */
  href: string | null;
  /** The content is already hidden (panel, page promotions, highlight) — for the buttons. */
  hidden: boolean;
  /** What staff can do here besides dismiss / mark handled / note. */
  actions: ReportAction[];
}

export interface ReportFilter {
  status?: 'open' | 'all' | ReportStatus;
  type?: 'all' | ReportTarget;
}

export async function openReportCount(): Promise<number> {
  // clan-scope: global -- the platform's queue across every clan.
  const [r] = await db.select({ n: count() }).from(promoReports).where(eq(promoReports.status, 'open'));
  return Number(r?.n ?? 0);
}

/** Open reports by kind, for the filter chips. */
export async function openReportCountsByType(): Promise<Record<string, number>> {
  // clan-scope: global -- the platform's queue across every clan.
  const rows = await db.select({ t: promoReports.targetType, n: count() }).from(promoReports).where(eq(promoReports.status, 'open')).groupBy(promoReports.targetType);
  return Object.fromEntries(rows.map((r) => [r.t, Number(r.n)]));
}

export async function listReports(filter: ReportFilter = {}, limit = 200): Promise<StaffReport[]> {
  const status = filter.status ?? 'open';
  const type = filter.type && filter.type !== 'all' && isReportTarget(filter.type) ? filter.type : null;
  const resolver = sql<string | null>`(select display_name from users ru where ru.id = ${promoReports.resolvedByUserId})`;
  // clan-scope: global -- platform staff queue across every clan.
  const rows = await db
    .select({
      r: promoReports,
      reporter: users.displayName,
      resolvedBy: resolver,
      clanName: clans.name,
      clanSlug: clans.slug,
      clanKind: clans.kind,
      clanHidden: clans.platformHidden,
      spaceHiddenAt: spaceProfiles.hiddenAt,
    })
    .from(promoReports)
    .leftJoin(clans, eq(clans.id, promoReports.clanId))
    .leftJoin(users, eq(users.id, promoReports.reporterUserId))
    .leftJoin(spaceProfiles, eq(spaceProfiles.clanId, promoReports.clanId))
    .where(
      and(
        status === 'all' ? undefined : eq(promoReports.status, status),
        // A player profile is a character or a person; staff filter them as one.
        type === 'character' || type === 'person' ? inArray(promoReports.targetType, ['character', 'person']) : type ? eq(promoReports.targetType, type) : undefined,
      ),
    )
    .orderBy(desc(promoReports.createdAt))
    .limit(limit);

  // The live rows, a batch per kind, for a name, a link and whether it is already hidden.
  const ids = (t: ReportTarget) => [...new Set(rows.filter((x) => x.r.targetType === t && x.r.targetId != null).map((x) => x.r.targetId!))];
  const [panels, evs, chars, clips] = await Promise.all([
    ids('creator_panel').length
      ? // clan-scope: global -- reported panels by id, for the staff queue.
        db.select({ id: spacePanels.id, title: spacePanels.title, hidden: spacePanels.staffHiddenAt }).from(spacePanels).where(inArray(spacePanels.id, ids('creator_panel')))
      : [],
    ids('event').length
      ? // clan-scope: global -- reported events by id, for the staff queue.
        db.select({ id: events.id, name: events.name }).from(events).where(inArray(events.id, ids('event')))
      : [],
    ids('character').length
      ? // clan-scope: global -- reported characters by id, for the staff queue.
        db.select({ id: accounts.id, rsn: accounts.rsn }).from(accounts).where(inArray(accounts.id, ids('character')))
      : [],
    ids('highlight').length
      ? // clan-scope: global -- reported clips by id, for the staff queue.
        db
          .select({ id: streamHighlights.id, title: streamHighlights.title, eventId: streamHighlights.eventId, hidden: streamHighlights.staffHiddenAt, clipUrl: streamHighlights.clipUrl, vodUrl: streamHighlights.vodUrl })
          .from(streamHighlights)
          .where(inArray(streamHighlights.id, ids('highlight')))
      : [],
  ]);
  const panelBy = new Map(panels.map((p) => [p.id, p]));
  const eventBy = new Map(evs.map((e) => [e.id, e]));
  const charBy = new Map(chars.map((c) => [c.id, c]));
  const clipBy = new Map(clips.map((c) => [c.id, c]));

  return rows.map((x) => {
    const t = (isReportTarget(x.r.targetType) ? x.r.targetType : 'space') as ReportTarget;
    const tid = x.r.targetId;
    const clan = x.r.clanId != null && x.clanName != null ? { id: x.r.clanId, name: x.clanName, slug: x.clanSlug!, platformHidden: !!x.clanHidden, kind: x.clanKind ?? 'clan' } : null;
    let title: string | null = null;
    let href: string | null = null;
    let hidden = false;
    switch (t) {
      case 'space':
      case 'clan':
        title = clan?.name ?? null;
        href = clan ? clanBasePath(clan) : null;
        hidden = t === 'space' ? !!x.spaceHiddenAt : !!clan?.platformHidden;
        break;
      case 'creator_panel': {
        const p = tid != null ? panelBy.get(tid) : undefined;
        title = p ? `“${p.title}” on ${clan?.name ?? 'a creator page'}` : null;
        href = clan ? clanBasePath(clan) : null;
        hidden = !!p?.hidden;
        break;
      }
      case 'event': {
        const e = tid != null ? eventBy.get(tid) : undefined;
        title = e?.name ?? null;
        href = clan && tid != null ? clanPathOf(clan, `/events/${tid}`) : null;
        hidden = !!clan?.platformHidden;
        break;
      }
      case 'character': {
        const c = tid != null ? charBy.get(tid) : undefined;
        title = c?.rsn ?? null;
        href = c ? `/p/${encodeURIComponent(c.rsn)}` : null;
        break;
      }
      case 'person':
        href = tid != null ? `/u/${tid}` : null;
        break;
      case 'highlight': {
        const h = tid != null ? clipBy.get(tid) : undefined;
        title = h?.title ?? null;
        href = h?.clipUrl ?? h?.vodUrl ?? (clan && h ? clanPathOf(clan, `/events/${h.eventId}`) : null);
        hidden = !!h?.hidden;
        break;
      }
    }
    return {
      id: x.r.id,
      targetType: t,
      targetId: tid,
      category: x.r.category ?? 'other',
      status: x.r.status as ReportStatus,
      note: x.r.reason,
      staffNote: x.r.staffNote,
      snapshot: x.r.snapshot,
      createdAt: x.r.createdAt.toISOString(),
      resolvedAt: x.r.resolvedAt?.toISOString() ?? null,
      reporter: x.reporter ?? null,
      resolvedBy: x.resolvedBy ?? null,
      clan,
      title,
      href,
      hidden,
      actions: TARGET_ACTIONS[t],
    };
  });
}

/** Staff hide (or show again) one stream highlight. The host cannot undo a staff hide. */
export async function staffSetHighlightHidden(id: number, hidden: boolean, actorUserId: number): Promise<boolean> {
  // clan-scope: global -- platform staff act on any clan's clip by its id.
  const res = await db
    .update(streamHighlights)
    .set(hidden ? { staffHiddenAt: new Date(), staffHiddenByUserId: actorUserId } : { staffHiddenAt: null, staffHiddenByUserId: null })
    .where(eq(streamHighlights.id, id))
    .returning({ id: streamHighlights.id });
  return res.length > 0;
}

/** Highlights staff have hidden, to undo from the queue page. */
export async function listHiddenHighlights() {
  // clan-scope: global -- platform staff view across every clan.
  const rows = await db
    .select({ id: streamHighlights.id, title: streamHighlights.title, clanId: streamHighlights.clanId, clanName: clans.name, clanSlug: clans.slug, at: streamHighlights.staffHiddenAt })
    .from(streamHighlights)
    .innerJoin(clans, eq(clans.id, streamHighlights.clanId))
    .where(sql`${streamHighlights.staffHiddenAt} is not null`)
    .orderBy(desc(streamHighlights.staffHiddenAt))
    .limit(200);
  return rows.map((r) => ({ ...r, at: r.at?.toISOString() ?? null }));
}

/** The platform hide of a clan (clans.platform_hidden), the same switch as /staff/clans. */
async function setClanPlatformHidden(clanId: number, hidden: boolean): Promise<boolean> {
  // clan-scope: global -- platform staff act on any clan by its id.
  const res = await db.update(clans).set({ platformHidden: hidden }).where(eq(clans.id, clanId)).returning({ id: clans.id });
  return res.length > 0;
}

export type StaffReportOp = { op: 'dismiss' } | { op: 'resolve' } | { op: 'note'; note: unknown } | { op: 'act'; action: ReportAction };

export interface ActResult {
  /** The clan the action touched (for the operator log), when it touched one. */
  clanId: number | null;
  /** What was done, for the operator log: `report_<what>`. */
  what: string;
  targetType: ReportTarget;
  targetId: number | null;
  /** The platform hide of a clan changed — link cards must forget it. */
  clanHiddenChanged: boolean;
}

/**
 * A staff move on one report:
 *   dismiss  — close this report, nothing done.
 *   resolve  — close it as handled elsewhere (a profile dealt with from /staff/people, say).
 *   note     — set staff's own note; the status is unchanged.
 *   act      — hide / unlist (lib/platformReportRules TARGET_ACTIONS), then close every open report on
 *              the same thing.
 */
export async function actOnReport(id: number, op: StaffReportOp, actorUserId: number): Promise<Checked<ActResult>> {
  // clan-scope: global -- platform staff act on a report by its id.
  const [r] = await db.select().from(promoReports).where(eq(promoReports.id, id)).limit(1);
  if (!r) return { ok: false, error: 'That report is gone.' };
  const t = (isReportTarget(r.targetType) ? r.targetType : 'space') as ReportTarget;
  const base = { clanId: r.clanId, targetType: t, targetId: r.targetId, clanHiddenChanged: false };
  const done = { resolvedAt: new Date(), resolvedByUserId: actorUserId };

  if (op.op === 'note') {
    const n = cleanStaffNote(op.note);
    if (!n.ok) return n;
    // clan-scope: global -- by report id.
    await db.update(promoReports).set({ staffNote: n.value || null }).where(eq(promoReports.id, id));
    return { ok: true, value: { ...base, what: 'note' } };
  }
  if (op.op === 'dismiss' || op.op === 'resolve') {
    const status: ReportStatus = op.op === 'dismiss' ? 'dismissed' : 'resolved';
    // clan-scope: global -- by report id.
    await db.update(promoReports).set({ status, ...done }).where(eq(promoReports.id, id));
    return { ok: true, value: { ...base, what: op.op === 'dismiss' ? 'dismissed' : 'resolved' } };
  }

  const action = op.action;
  if (!TARGET_ACTIONS[t].includes(action)) return { ok: false, error: 'That cannot be done to this kind of report.' };
  let what: string;
  let clanId = r.clanId;
  let clanHiddenChanged = false;
  if (action === 'hide') {
    if (t === 'creator_panel') {
      if (r.panelId == null || !(await staffSetPanelHidden(r.panelId, true, actorUserId))) return { ok: false, error: 'That panel is gone.' };
      what = 'panel_hidden';
    } else if (t === 'space') {
      if (r.clanId == null) return { ok: false, error: 'That page is gone.' };
      await staffSetSpaceHidden(r.clanId, true, actorUserId);
      what = 'page_hidden';
    } else {
      if (r.targetId == null || !(await staffSetHighlightHidden(r.targetId, true, actorUserId))) return { ok: false, error: 'That clip is gone.' };
      what = 'highlight_hidden';
    }
  } else {
    // Unlist: the clan itself, or for an event its host (the events directory lists only events
    // whose host is not hidden — lib/eventsDirectoryDb).
    if (t === 'event' && r.targetId != null) {
      // clan-scope: global -- the reported event's host, by the event's own id.
      const e = await db.query.events.findFirst({ where: eq(events.id, r.targetId), columns: { clanId: true } });
      clanId = e?.clanId ?? null;
    } else if (t === 'space' || t === 'clan') {
      clanId = r.targetId ?? r.clanId;
    }
    if (clanId == null || !(await setClanPlatformHidden(clanId, true))) return { ok: false, error: 'That clan is gone.' };
    what = 'clan_unlisted';
    clanHiddenChanged = true;
  }

  // clan-scope: global -- every open report on the same thing, by its own id.
  await db
    .update(promoReports)
    .set({ status: 'hidden', ...done })
    .where(and(eq(promoReports.targetType, t), eq(promoReports.targetId, r.targetId ?? -1), eq(promoReports.status, 'open')));
  // clan-scope: global -- and this one, whatever its target id.
  await db.update(promoReports).set({ status: 'hidden', ...done }).where(and(eq(promoReports.id, id), eq(promoReports.status, 'open')));
  return { ok: true, value: { ...base, clanId, what, clanHiddenChanged } };
}

/** Undo a staff hide on a highlight, from the Hidden tab. */
export async function showHighlight(id: number, actorUserId: number): Promise<boolean> {
  return staffSetHighlightHidden(id, false, actorUserId);
}
