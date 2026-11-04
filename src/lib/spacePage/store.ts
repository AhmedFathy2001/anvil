// A space page's promotional content, the database half (lib/spacePage/rules is the pure half):
// the host's bio, panels, schedule and featured pick; the blocklist; viewers' reports and the staff
// queue that clears them.
//
// Keyed by clan id throughout, so a Streaming clan could opt in later. Today only creator spaces
// write it: the admin routes refuse anything else (lib/creatorSpaces isCreatorSpace).
//
// HIDDEN NEVER RENDERS. A panel the host hid, a panel staff hid, and every bit of a page staff hid
// are left out of publicSpacePage — not sent with a flag for the client to honour.

import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  clanKickChannels,
  clans,
  clanTwitchChannels,
  events,
  promoBlockedDomains,
  promoReports,
  spacePanels,
  spaceProfiles,
  spaceScheduleSlots,
  streamHighlights,
  users,
} from '@/db/schema';
import { kickLive, twitchLive } from '@/lib/connectedLive';
import { standingsHidden } from '@/lib/standingsVisibility';
import { type ShownHighlight, showable, visibleToScope } from '@/lib/highlights/rules';

import {
  BIO_MAX,
  type Checked,
  checkClipUrl,
  checkLink,
  checkSlot,
  checkTimeZone,
  cleanText,
  clipPlatformOf,
  contentError,
  FEATURED_TITLE_MAX,
  isSpaceMediaUrl,
  linkify,
  nextSlotStart,
  normalizeDomain,
  PANEL_BODY_MAX,
  PANEL_TITLE_MAX,
  PANELS_MAX,
  SLOTS_MAX,
  type SlotInput,
  type ClipPlatform,
  type TextSegment,
} from './rules.ts';
import { BLOCK_REASONS, type BlockReason } from './blocklistSeed.ts';

export interface Space {
  id: number;
  slug: string;
}

// ── Blocklist ────────────────────────────────────────────────────────────────────────────────────

const BLOCKLIST_TTL_MS = 60_000;
let blocklistMemo: { at: number; value: Promise<string[]> } | null = null;

/** Every blocked domain. Memoised for a minute; a staff edit clears it at once. */
export function loadBlocklist(): Promise<string[]> {
  if (blocklistMemo && Date.now() - blocklistMemo.at < BLOCKLIST_TTL_MS) return blocklistMemo.value;
  const value = db
    .select({ d: promoBlockedDomains.domain })
    .from(promoBlockedDomains)
    .then((rows) => rows.map((r) => r.d));
  blocklistMemo = { at: Date.now(), value };
  value.catch(() => {
    blocklistMemo = null;
  });
  return value;
}

export function forgetBlocklist(): void {
  blocklistMemo = null;
}

export interface BlockedDomainRow {
  id: number;
  domain: string;
  reason: string;
  addedBy: string | null;
  createdAt: string;
}

export async function listBlockedDomains(): Promise<BlockedDomainRow[]> {
  const rows = await db
    .select({ id: promoBlockedDomains.id, domain: promoBlockedDomains.domain, reason: promoBlockedDomains.reason, addedBy: users.displayName, createdAt: promoBlockedDomains.createdAt })
    .from(promoBlockedDomains)
    .leftJoin(users, eq(users.id, promoBlockedDomains.addedByUserId))
    .orderBy(asc(promoBlockedDomains.reason), asc(promoBlockedDomains.domain));
  return rows.map((r) => ({ ...r, addedBy: r.addedBy ?? null, createdAt: r.createdAt.toISOString() }));
}

export async function addBlockedDomain(raw: string, reason: unknown, actorUserId: number | null): Promise<Checked<string>> {
  const domain = normalizeDomain(raw);
  if (!domain) return { ok: false, error: 'That is not a domain (e.g. example.com).' };
  const r: BlockReason = typeof reason === 'string' && (BLOCK_REASONS as readonly string[]).includes(reason) ? (reason as BlockReason) : 'other';
  await db.insert(promoBlockedDomains).values({ domain, reason: r, addedByUserId: actorUserId }).onConflictDoUpdate({
    target: promoBlockedDomains.domain,
    set: { reason: r },
  });
  forgetBlocklist();
  return { ok: true, value: domain };
}

export async function removeBlockedDomain(id: number): Promise<void> {
  await db.delete(promoBlockedDomains).where(eq(promoBlockedDomains.id, id));
  forgetBlocklist();
}

// ── The host's side ──────────────────────────────────────────────────────────────────────────────

export interface PanelInput {
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
}

/** A panel as typed, checked against the limits, the wording and the link policy. */
export async function checkPanelInput(space: Space, raw: unknown): Promise<Checked<PanelInput>> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = cleanText(r.title, PANEL_TITLE_MAX, { field: 'The title' });
  if (!title.ok) return title;
  if (!title.value) return { ok: false, error: 'Give the panel a title.' };
  const body = cleanText(r.body, PANEL_BODY_MAX, { field: 'The text', multiline: true });
  if (!body.ok) return body;
  const blocked = await loadBlocklist();
  const textErr = contentError(`${title.value}\n${body.value}`, blocked);
  if (textErr) return { ok: false, error: textErr };
  let linkUrl: string | null = null;
  if (typeof r.linkUrl === 'string' && r.linkUrl.trim()) {
    const link = checkLink(r.linkUrl, blocked);
    if (!link.ok) return link;
    linkUrl = link.value;
  }
  let imageUrl: string | null = null;
  if (typeof r.imageUrl === 'string' && r.imageUrl.trim()) {
    // Only our own upload for THIS space; typed URLs are never accepted.
    if (!isSpaceMediaUrl(r.imageUrl.trim(), space.slug)) return { ok: false, error: 'That image did not come from an upload here.' };
    imageUrl = r.imageUrl.trim();
  }
  return { ok: true, value: { title: title.value, body: body.value, imageUrl, linkUrl } };
}

export async function panelsOf(clanId: number) {
  // clan-scope: clanId is the space whose panels these are.
  return db.select().from(spacePanels).where(eq(spacePanels.clanId, clanId)).orderBy(asc(spacePanels.position), asc(spacePanels.id));
}

export async function createPanel(space: Space, raw: unknown): Promise<Checked<number>> {
  const input = await checkPanelInput(space, raw);
  if (!input.ok) return input;
  const existing = await panelsOf(space.id);
  if (existing.length >= PANELS_MAX) return { ok: false, error: `You can have up to ${PANELS_MAX} panels.` };
  const position = existing.reduce((m, p) => Math.max(m, p.position), -1) + 1;
  const [row] = await db
    .insert(spacePanels)
    .values({ clanId: space.id, position, ...input.value })
    .returning({ id: spacePanels.id });
  return { ok: true, value: row.id };
}

export async function updatePanel(space: Space, id: number, raw: unknown): Promise<Checked<true>> {
  const input = await checkPanelInput(space, raw);
  if (!input.ok) return input;
  const r = (raw ?? {}) as Record<string, unknown>;
  const res = await db
    .update(spacePanels)
    .set({ ...input.value, ...(typeof r.hidden === 'boolean' ? { hidden: r.hidden } : {}), updatedAt: new Date() })
    // clan-scope: the panel must be this space's own.
    .where(and(eq(spacePanels.id, id), eq(spacePanels.clanId, space.id)))
    .returning({ id: spacePanels.id });
  return res.length ? { ok: true, value: true } : { ok: false, error: 'That panel is gone.' };
}

export async function setPanelHidden(clanId: number, id: number, hidden: boolean): Promise<boolean> {
  const res = await db
    .update(spacePanels)
    .set({ hidden, updatedAt: new Date() })
    // clan-scope: the panel must be this space's own.
    .where(and(eq(spacePanels.id, id), eq(spacePanels.clanId, clanId)))
    .returning({ id: spacePanels.id });
  return res.length > 0;
}

export async function deletePanel(clanId: number, id: number): Promise<boolean> {
  // clan-scope: the panel must be this space's own.
  const res = await db.delete(spacePanels).where(and(eq(spacePanels.id, id), eq(spacePanels.clanId, clanId))).returning({ id: spacePanels.id });
  return res.length > 0;
}

/** A new order: `ids` must be exactly this space's panels, each once. */
export async function reorderPanels(clanId: number, ids: unknown): Promise<Checked<true>> {
  const list = Array.isArray(ids) ? ids.map(Number) : [];
  const mine = await panelsOf(clanId);
  const have = new Set(mine.map((p) => p.id));
  if (list.length !== mine.length || new Set(list).size !== list.length || !list.every((id) => have.has(id))) {
    return { ok: false, error: 'That order does not match your panels. Reload and try again.' };
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < list.length; i++) {
      // clan-scope: ids were checked against this space's panels above.
      await tx.update(spacePanels).set({ position: i }).where(and(eq(spacePanels.id, list[i]), eq(spacePanels.clanId, clanId)));
    }
  });
  return { ok: true, value: true };
}

async function upsertProfile(clanId: number, patch: Partial<typeof spaceProfiles.$inferInsert>): Promise<void> {
  await db
    .insert(spaceProfiles)
    .values({ clanId, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({ target: spaceProfiles.clanId, set: { ...patch, updatedAt: new Date() } });
}

export async function profileOf(clanId: number) {
  // clan-scope: clanId is the space whose page this is.
  return (await db.query.spaceProfiles.findFirst({ where: eq(spaceProfiles.clanId, clanId) })) ?? null;
}

export async function setBio(clanId: number, raw: unknown): Promise<Checked<string | null>> {
  const bio = cleanText(raw, BIO_MAX, { field: 'Your bio', multiline: true });
  if (!bio.ok) return bio;
  const err = contentError(bio.value, await loadBlocklist());
  if (err) return { ok: false, error: err };
  await upsertProfile(clanId, { bio: bio.value || null });
  return { ok: true, value: bio.value || null };
}

/** Replace the weekly schedule: the zone it is written in, and its slots. */
export async function setSchedule(clanId: number, tzRaw: unknown, slotsRaw: unknown): Promise<Checked<true>> {
  const list = Array.isArray(slotsRaw) ? slotsRaw : [];
  if (list.length > SLOTS_MAX) return { ok: false, error: `Up to ${SLOTS_MAX} times a week.` };
  const tz = list.length ? checkTimeZone(tzRaw) : checkTimeZone(tzRaw ?? 'UTC');
  if (!tz.ok) return tz;
  const slots: SlotInput[] = [];
  const blocked = await loadBlocklist();
  for (const raw of list) {
    const s = checkSlot(raw);
    if (!s.ok) return s;
    if (s.value.label) {
      const err = contentError(s.value.label, blocked);
      if (err) return { ok: false, error: err };
    }
    slots.push(s.value);
  }
  await db.transaction(async (tx) => {
    // clan-scope: replacing this space's own slots.
    await tx.delete(spaceScheduleSlots).where(eq(spaceScheduleSlots.clanId, clanId));
    if (slots.length) await tx.insert(spaceScheduleSlots).values(slots.map((s, i) => ({ clanId, ...s, position: i })));
  });
  await upsertProfile(clanId, { scheduleTz: tz.value });
  return { ok: true, value: true };
}

export async function slotsOf(clanId: number) {
  // clan-scope: clanId is the space whose schedule this is.
  return db.select().from(spaceScheduleSlots).where(eq(spaceScheduleSlots.clanId, clanId)).orderBy(asc(spaceScheduleSlots.position), asc(spaceScheduleSlots.id));
}

/**
 * Highlights a space may feature: its own, on its OWN channel (a player's channel is theirs, not the
 * host's to promote), with a clip or a VOD link to show.
 */
export async function featurableHighlights(clanId: number, limit = 30) {
  const rows = await db
    .select({ h: streamHighlights, eventName: events.name })
    .from(streamHighlights)
    .innerJoin(events, eq(events.id, streamHighlights.eventId))
    .where(and(eq(streamHighlights.clanId, clanId), eq(events.clanId, clanId), eq(streamHighlights.channelOwner, 'host')))
    .orderBy(desc(streamHighlights.occurredAt))
    .limit(limit * 3);
  return rows
    .filter((r) => showable({ clipUrl: r.h.clipStatus === 'ready' ? r.h.clipUrl : null, vodUrl: r.h.vodStatus === 'ready' ? r.h.vodUrl : null }))
    .slice(0, limit)
    .map((r) => ({ id: r.h.id, title: r.h.title, eventName: r.eventName, occurredAt: r.h.occurredAt.toISOString(), platform: r.h.platform }));
}

/** Pin one of the space's own highlights, or one clip link, or nothing. */
export async function setFeatured(clanId: number, raw: unknown): Promise<Checked<true>> {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.highlightId != null) {
    const id = Number(r.highlightId);
    const ok = Number.isInteger(id) && (await featurableHighlights(clanId, 500)).some((h) => h.id === id);
    if (!ok) return { ok: false, error: 'Pick one of your own stream highlights.' };
    await upsertProfile(clanId, { featuredHighlightId: id, featuredClipUrl: null, featuredTitle: null });
    return { ok: true, value: true };
  }
  if (r.clipUrl != null && String(r.clipUrl).trim()) {
    const blocked = await loadBlocklist();
    // Canonicalised from its ids (no redirect parameters survive) and checked against the blocklist.
    const clip = checkClipUrl(r.clipUrl, blocked);
    if (!clip.ok) return clip;
    const title = cleanText(r.title, FEATURED_TITLE_MAX, { field: 'The title' });
    if (!title.ok) return title;
    const err = contentError(title.value, blocked);
    if (err) return { ok: false, error: err };
    await upsertProfile(clanId, { featuredHighlightId: null, featuredClipUrl: clip.value.url, featuredTitle: title.value || null });
    return { ok: true, value: true };
  }
  await upsertProfile(clanId, { featuredHighlightId: null, featuredClipUrl: null, featuredTitle: null });
  return { ok: true, value: true };
}

// ── The public page ──────────────────────────────────────────────────────────────────────────────

export interface ShownPanel {
  id: number;
  title: string;
  body: TextSegment[];
  imageUrl: string | null;
  linkUrl: string | null;
}

export interface ShownSlot {
  id: number;
  /** The next start (UTC ms), for the viewer's own clock. */
  startsAt: number;
  label: string | null;
}

export type ShownFeatured =
  | { kind: 'highlight'; highlight: ShownHighlight & { eventName: string } }
  | { kind: 'clip'; url: string; platform: ClipPlatform; title: string | null };

export interface PublicSpacePage {
  bio: TextSegment[] | null;
  panels: ShownPanel[];
  schedule: ShownSlot[];
  scheduleTz: string | null;
  featured: ShownFeatured | null;
  /** Live on a connected Twitch or Kick channel right now. */
  live: { twitch: boolean; kick: boolean };
}

const EMPTY_PAGE: PublicSpacePage = { bio: null, panels: [], schedule: [], scheduleTz: null, featured: null, live: { twitch: false, kick: false } };

/**
 * What a visitor sees. Hidden panels (host or staff) and a staff-hidden page are left out entirely;
 * links are re-checked against TODAY's blocklist (it may have grown since the save) and images must be
 * this space's own uploads. `canSeeEvent` gates a featured highlight to events this viewer may open.
 */
export async function publicSpacePage(
  space: Space,
  opts: { canSeeEvent: (eventId: number) => Promise<boolean>; now?: number; live?: boolean },
): Promise<PublicSpacePage> {
  const profile = await profileOf(space.id);
  const live = opts.live === false ? { twitch: false, kick: false } : await spaceLive(space.id).catch(() => ({ twitch: false, kick: false }));
  if (profile?.hiddenAt) return { ...EMPTY_PAGE, live };
  const [blocked, panels, slots] = await Promise.all([loadBlocklist(), panelsOf(space.id), slotsOf(space.id)]);
  const now = opts.now ?? Date.now();

  const shownPanels: ShownPanel[] = panels
    .filter((p) => !p.hidden && !p.staffHiddenAt)
    .slice(0, PANELS_MAX)
    .map((p) => {
      const link = p.linkUrl ? checkLink(p.linkUrl, blocked) : null;
      return {
        id: p.id,
        title: p.title,
        body: linkify(p.body, blocked),
        imageUrl: isSpaceMediaUrl(p.imageUrl, space.slug) ? p.imageUrl : null,
        linkUrl: link?.ok ? link.value : null,
      };
    });

  const tz = profile?.scheduleTz ?? null;
  const schedule: ShownSlot[] = tz
    ? slots
        .map((s) => ({ id: s.id, startsAt: nextSlotStart(s, tz, now), label: s.label }))
        .sort((a, b) => a.startsAt - b.startsAt)
    : [];

  let featured: ShownFeatured | null = null;
  if (profile?.featuredHighlightId) {
    const h = await featuredHighlight(space.id, profile.featuredHighlightId, opts.canSeeEvent);
    if (h) featured = { kind: 'highlight', highlight: h };
  } else if (profile?.featuredClipUrl) {
    const clip = checkClipUrl(profile.featuredClipUrl, blocked);
    if (clip.ok) featured = { kind: 'clip', url: clip.value.url, platform: clip.value.platform, title: profile.featuredTitle ?? null };
  }

  return {
    bio: profile?.bio ? linkify(profile.bio, blocked) : null,
    panels: shownPanels,
    schedule,
    scheduleTz: tz,
    featured,
    live,
  };
}

/** The pinned highlight, if it is still this space's own, host-channel, showable and this viewer's to see. */
async function featuredHighlight(
  clanId: number,
  id: number,
  canSeeEvent: (eventId: number) => Promise<boolean>,
): Promise<(ShownHighlight & { eventName: string }) | null> {
  const [r] = await db
    .select({ h: streamHighlights, eventName: events.name, rules: events.rules, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(streamHighlights)
    .innerJoin(events, eq(events.id, streamHighlights.eventId))
    .where(and(eq(streamHighlights.id, id), eq(streamHighlights.clanId, clanId), eq(events.clanId, clanId), eq(streamHighlights.channelOwner, 'host')))
    .limit(1);
  if (!r) return null;
  const h: ShownHighlight = {
    id: r.h.id,
    beat: r.h.beat as ShownHighlight['beat'],
    platform: r.h.platform as ShownHighlight['platform'],
    channelName: r.h.channelName,
    title: r.h.title,
    occurredAt: r.h.occurredAt.toISOString(),
    clipUrl: r.h.clipStatus === 'ready' ? r.h.clipUrl : null,
    thumbnailUrl: null,
    durationS: r.h.durationS,
    vodUrl: r.h.vodStatus === 'ready' ? r.h.vodUrl : null,
    teamId: r.h.teamId,
    tileId: r.h.tileId,
    momentId: r.h.momentId,
  };
  if (!showable(h)) return null;
  if (!(await canSeeEvent(r.h.eventId))) return null;
  // Behind hidden standings a team's beat is a secret; the page has no team to show it against.
  if (standingsHidden({ rules: r.rules, endDate: r.endDate, forceEndedAt: r.forceEndedAt }) && visibleToScope([h], () => false).length === 0) return null;
  return { ...h, eventName: r.eventName };
}

/** Is the space's connected Twitch or Kick channel live? Cached and batched (lib/connectedLive). */
export async function spaceLive(clanId: number): Promise<{ twitch: boolean; kick: boolean }> {
  const [tw, kk] = await Promise.all([
    // clan-scope: clanId is the space whose page is being rendered.
    db.query.clanTwitchChannels.findFirst({ where: eq(clanTwitchChannels.clanId, clanId), columns: { twitchUserId: true } }),
    // clan-scope: clanId is the space whose page is being rendered.
    db.query.clanKickChannels.findFirst({ where: eq(clanKickChannels.clanId, clanId), columns: { kickUserId: true } }),
  ]);
  const [twitch, kick] = await Promise.all([
    tw ? twitchLive([tw.twitchUserId]).then((m) => m.get(tw.twitchUserId) ?? false) : Promise.resolve(false),
    kk ? kickLive([kk.kickUserId]).then((m) => m.get(kk.kickUserId)?.live ?? false) : Promise.resolve(false),
  ]);
  return { twitch, kick };
}

// ── Reports and the staff queue ──────────────────────────────────────────────────────────────────

export const REPORT_REASON_MAX = 300;

/**
 * A signed-in viewer reports a panel (or the page as a whole). The content is snapshotted, so an edit
 * after the report cannot erase what was reported. One open report per person per thing: a second
 * press answers with the first.
 */
export async function reportContent(
  space: Space,
  input: { panelId: number | null; reason: unknown; reporterUserId: number },
): Promise<Checked<number>> {
  const reason = cleanText(input.reason, REPORT_REASON_MAX, { field: 'The reason', multiline: true });
  if (!reason.ok) return reason;
  let snapshot: string;
  if (input.panelId != null) {
    // clan-scope: the panel must be this space's own.
    const [p] = await db.select().from(spacePanels).where(and(eq(spacePanels.id, input.panelId), eq(spacePanels.clanId, space.id))).limit(1);
    if (!p || p.hidden || p.staffHiddenAt) return { ok: false, error: 'That panel is not there any more.' };
    snapshot = [p.title, p.body, p.linkUrl ? `Link: ${p.linkUrl}` : '', p.imageUrl ? `Image: ${p.imageUrl}` : ''].filter(Boolean).join('\n');
  } else {
    const prof = await profileOf(space.id);
    snapshot = [prof?.bio ? `Bio: ${prof.bio}` : '', prof?.featuredClipUrl ? `Featured: ${prof.featuredClipUrl}` : ''].filter(Boolean).join('\n');
  }
  const [dupe] = await db
    .select({ id: promoReports.id })
    .from(promoReports)
    .where(
      and(
        eq(promoReports.clanId, space.id),
        input.panelId != null ? eq(promoReports.panelId, input.panelId) : isNull(promoReports.panelId),
        eq(promoReports.reporterUserId, input.reporterUserId),
        eq(promoReports.status, 'open'),
      ),
    )
    .limit(1);
  if (dupe) return { ok: true, value: dupe.id };
  const [row] = await db
    .insert(promoReports)
    .values({ clanId: space.id, panelId: input.panelId, reporterUserId: input.reporterUserId, reason: reason.value || null, snapshot: snapshot.slice(0, 4000) })
    .returning({ id: promoReports.id });
  return { ok: true, value: row.id };
}

export async function openPromoReportCount(): Promise<number> {
  // clan-scope: global -- the platform's queue across every space.
  const [r] = await db.select({ n: count() }).from(promoReports).where(eq(promoReports.status, 'open'));
  return Number(r?.n ?? 0);
}

export interface StaffPromoReport {
  id: number;
  status: string;
  reason: string | null;
  snapshot: string;
  createdAt: string;
  reporter: string | null;
  space: { id: number; name: string; slug: string; hidden: boolean };
  panel: { id: number; title: string; staffHidden: boolean } | null;
}

export async function listPromoReports(status: 'open' | 'all' = 'open', limit = 200): Promise<StaffPromoReport[]> {
  // clan-scope: global -- platform staff queue across every space.
  const rows = await db
    .select({
      r: promoReports,
      reporter: users.displayName,
      clanName: clans.name,
      clanSlug: clans.slug,
      hiddenAt: spaceProfiles.hiddenAt,
      panelTitle: spacePanels.title,
      panelStaffHidden: spacePanels.staffHiddenAt,
    })
    .from(promoReports)
    .innerJoin(clans, eq(clans.id, promoReports.clanId))
    .leftJoin(users, eq(users.id, promoReports.reporterUserId))
    .leftJoin(spaceProfiles, eq(spaceProfiles.clanId, promoReports.clanId))
    .leftJoin(spacePanels, eq(spacePanels.id, promoReports.panelId))
    .where(status === 'open' ? eq(promoReports.status, 'open') : undefined)
    .orderBy(desc(promoReports.createdAt))
    .limit(limit);
  return rows.map((x) => ({
    id: x.r.id,
    status: x.r.status,
    reason: x.r.reason,
    snapshot: x.r.snapshot,
    createdAt: x.r.createdAt.toISOString(),
    reporter: x.reporter ?? null,
    space: { id: x.r.clanId, name: x.clanName, slug: x.clanSlug, hidden: !!x.hiddenAt },
    panel: x.r.panelId != null && x.panelTitle != null ? { id: x.r.panelId, title: x.panelTitle, staffHidden: !!x.panelStaffHidden } : null,
  }));
}

/** Staff hide (or unhide) one panel. The host cannot undo a staff hide. */
export async function staffSetPanelHidden(panelId: number, hidden: boolean, actorUserId: number): Promise<boolean> {
  // clan-scope: global -- platform staff act on any space's panel by its id.
  const res = await db
    .update(spacePanels)
    .set(hidden ? { staffHiddenAt: new Date(), staffHiddenByUserId: actorUserId } : { staffHiddenAt: null, staffHiddenByUserId: null })
    .where(eq(spacePanels.id, panelId))
    .returning({ id: spacePanels.id });
  return res.length > 0;
}

/** Staff hide (or unhide) a whole space's promotional content: bio, panels, schedule, featured. */
export async function staffSetSpaceHidden(clanId: number, hidden: boolean, actorUserId: number): Promise<void> {
  await upsertProfile(clanId, hidden ? { hiddenAt: new Date(), hiddenByUserId: actorUserId } : { hiddenAt: null, hiddenByUserId: null });
}

/**
 * Close a report. `hide` hides what it was about (the panel, or the whole page for a page report) and
 * closes every other open report on the same thing; `dismiss` closes just this one.
 */
export async function resolvePromoReport(id: number, action: 'hide' | 'dismiss', actorUserId: number): Promise<Checked<true>> {
  // clan-scope: global -- platform staff resolve a report by its id.
  const [r] = await db.select().from(promoReports).where(eq(promoReports.id, id)).limit(1);
  if (!r) return { ok: false, error: 'That report is gone.' };
  const done = { resolvedAt: new Date(), resolvedByUserId: actorUserId };
  if (action === 'dismiss') {
    // clan-scope: global -- by report id.
    await db.update(promoReports).set({ status: 'dismissed', ...done }).where(eq(promoReports.id, id));
    return { ok: true, value: true };
  }
  if (r.panelId != null) await staffSetPanelHidden(r.panelId, true, actorUserId);
  else await staffSetSpaceHidden(r.clanId, true, actorUserId);
  await db
    .update(promoReports)
    .set({ status: 'hidden', ...done })
    .where(
      and(
        eq(promoReports.clanId, r.clanId),
        eq(promoReports.status, 'open'),
        r.panelId != null ? eq(promoReports.panelId, r.panelId) : isNull(promoReports.panelId),
      ),
    );
  return { ok: true, value: true };
}

/** Everything staff have hidden, to undo from the queue page. */
export async function listStaffHidden() {
  // clan-scope: global -- platform staff view across every space.
  const panels = await db
    .select({ id: spacePanels.id, title: spacePanels.title, clanId: spacePanels.clanId, clanName: clans.name, clanSlug: clans.slug, at: spacePanels.staffHiddenAt })
    .from(spacePanels)
    .innerJoin(clans, eq(clans.id, spacePanels.clanId))
    .where(sql`${spacePanels.staffHiddenAt} is not null`)
    .orderBy(desc(spacePanels.staffHiddenAt))
    .limit(200);
  // clan-scope: global -- platform staff view across every space.
  const spaces = await db
    .select({ clanId: spaceProfiles.clanId, clanName: clans.name, clanSlug: clans.slug, at: spaceProfiles.hiddenAt })
    .from(spaceProfiles)
    .innerJoin(clans, eq(clans.id, spaceProfiles.clanId))
    .where(sql`${spaceProfiles.hiddenAt} is not null`)
    .orderBy(desc(spaceProfiles.hiddenAt))
    .limit(200);
  return {
    panels: panels.map((p) => ({ ...p, at: p.at?.toISOString() ?? null })),
    spaces: spaces.map((s) => ({ ...s, at: s.at?.toISOString() ?? null })),
  };
}

/** The host's editor view: everything, hidden included, with what staff hid marked. */
export async function spacePageForAdmin(clanId: number) {
  const [profile, panels, slots, highlights] = await Promise.all([profileOf(clanId), panelsOf(clanId), slotsOf(clanId), featurableHighlights(clanId)]);
  return {
    bio: profile?.bio ?? '',
    pageHiddenByStaff: !!profile?.hiddenAt,
    scheduleTz: profile?.scheduleTz ?? null,
    slots: slots.map((s) => ({ id: s.id, weekday: s.weekday, minuteOfDay: s.minuteOfDay, label: s.label })),
    panels: panels.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      imageUrl: p.imageUrl,
      linkUrl: p.linkUrl,
      hidden: p.hidden,
      hiddenByStaff: !!p.staffHiddenAt,
    })),
    featured: profile?.featuredHighlightId
      ? { highlightId: profile.featuredHighlightId }
      : profile?.featuredClipUrl
        ? { clipUrl: profile.featuredClipUrl, title: profile.featuredTitle ?? '', platform: clipPlatformOf(profile.featuredClipUrl) }
        : null,
    highlights,
  };
}
