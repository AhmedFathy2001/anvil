// Item hunt: the database half (rules in lib/itemHunt).
//
// THE DATA SOURCE is the plugin's moment reports (POST /api/plugin/moments): the same 'drop', 'pet'
// and 'clog' observations the highlight feed classifies. They arrive for every plugin user with a
// seat in the clan, event or no event; the route hands them here before the feed's own floors
// decide what to keep, so a hunt sees every report, not only the ones worth a feed line. Nothing new
// is asked of the plugin: a hunt's item ids ride on the config's existing `luckItemIds`, which is
// what makes the plugin report an item whatever it sells for (the head-to-head drop races do the
// same, lib/h2h).
//
// Everything that counts is a hunt_drops row: a plugin report, or a manual proof staff approved.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanRoster, huntDrops, users, weeklyCompetitions, weeklyParticipants, type HuntDropRow } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { dropCounts } from '@/lib/h2hRules';
import {
  type DropSighting,
  type HuntConfig,
  type HuntDrop,
  type HuntReport,
  type HuntRow,
  countedDrops,
  dropWeight,
  huntStat,
  isSameDrop,
  manualSourceAllowed,
  matchHuntReport,
  mergeSighting,
  parseHunt,
  rankHunt,
  serializeHunt,
} from '@/lib/itemHunt';
import { log } from '@/lib/logger';
import { clogItemIdByName } from '@/lib/moments';
import { computeLeaderboard, countsTowardLeaderboard, getEffectiveParticipants, type LeaderboardEntry } from '@/lib/weekly';
import { weeklyStatus } from '@/lib/weeklyStage';

type Competition = typeof weeklyCompetitions.$inferSelect;
type CompetitionLike = Pick<Competition, 'id' | 'type' | 'startDate' | 'endDate'> & { hunt?: string | null };

const windowOf = (comp: { startDate: string; endDate: string }) => ({ startMs: parseStamp(comp.startDate), endMs: parseStamp(comp.endDate) });

function toHuntDrop(r: HuntDropRow): HuntDrop {
  return {
    id: r.id,
    rsnKey: r.rsnNormalized,
    itemId: r.itemId,
    itemName: r.itemName,
    quantity: r.quantity,
    source: r.source,
    kc: r.kc,
    xp: r.xp,
    statSkill: r.statSkill,
    statBasis: r.statBasis,
    occurredAt: r.occurredAt,
    origin: r.origin === 'manual' ? 'manual' : 'plugin',
    status: r.status,
    approvedBy: r.decidedByName,
    screenshotUrl: r.screenshotUrl,
    note: r.note,
  };
}

/** Every drop row of one hunt, oldest first. The caller has settled which clan the hunt belongs to. */
export async function huntDropRows(competitionId: number): Promise<HuntDropRow[]> {
  // clan-scope: global -- one competition's rows by its id; the caller settled the owning clan.
  return db.select().from(huntDrops).where(eq(huntDrops.competitionId, competitionId)).orderBy(asc(huntDrops.occurredAt), asc(huntDrops.id));
}

export interface HuntStandings {
  config: HuntConfig;
  rows: HuntRow[];
  /** Counted drops, oldest first. */
  drops: HuntDrop[];
  /** Manual proofs waiting for staff. */
  pending: HuntDropRow[];
  /** Every row, for the staff page. */
  all: HuntDropRow[];
  participants: Awaited<ReturnType<typeof getEffectiveParticipants>>;
}

/** The hunt's standings, ranked by its rule. Null when the competition is not a readable hunt. */
export async function huntStandings(comp: CompetitionLike): Promise<HuntStandings | null> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return null;
  const [participants, all] = await Promise.all([getEffectiveParticipants(comp.id), huntDropRows(comp.id)]);
  const tracked = huntStat(config) != null;
  const drops = all.map(toHuntDrop);
  const rows = rankHunt(
    config,
    participants.map((p) => ({
      rsn: p.rsn,
      statGain: tracked && p.baselineValue != null && p.currentValue != null ? Math.max(0, p.currentValue - p.baselineValue) : null,
    })),
    drops,
    windowOf(comp),
  );
  return { config, rows, drops: countedDrops(drops, windowOf(comp)), pending: all.filter((d) => d.status === 'pending'), all, participants };
}

/**
 * A competition's board, best first, whatever kind it is.
 *
 * Skill, boss and efficiency rank by the gain (lib/weekly computeLeaderboard). A hunt ranks by its
 * rule, and `gained` is then the count of drops, so every card, post and prize that reads a board
 * names the right people in the right order without knowing what a hunt is.
 */
export async function competitionBoard(
  comp: CompetitionLike,
  participants: { rsn: string; baselineValue: number | null; currentValue: number | null }[],
): Promise<LeaderboardEntry[]> {
  const config = comp.type === 'hunt' ? parseHunt(comp.hunt) : null;
  if (comp.type !== 'hunt') return computeLeaderboard(participants);
  if (!config) return participants.map((p) => ({ rsn: p.rsn, baselineValue: 0, currentValue: 0, gained: 0 }));
  const rows = rankHunt(
    config,
    participants.map((p) => ({ rsn: p.rsn, statGain: p.baselineValue != null && p.currentValue != null ? Math.max(0, p.currentValue - p.baselineValue) : null })),
    (await huntDropRows(comp.id)).map(toHuntDrop),
    windowOf(comp),
  );
  return rows.map((r) => ({ rsn: r.rsn, baselineValue: 0, currentValue: r.count, gained: r.count }));
}

// ── Plugin reports ────────────────────────────────────────────────────────────────────────────

/** The running hunts in a clan, with their rules. */
async function activeHunts(clanId: number, nowMs: number): Promise<{ comp: Competition; config: HuntConfig }[]> {
  const rows = await db
    .select()
    .from(weeklyCompetitions)
    .where(and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.type, 'hunt'), eq(weeklyCompetitions.status, 'active')));
  return rows.flatMap((comp) => {
    const config = parseHunt(comp.hunt);
    return config && weeklyStatus(comp, nowMs) === 'active' ? [{ comp, config }] : [];
  });
}

/**
 * Item ids the plugin should report whatever they sell for: the targets of the clan's running item
 * hunts. Added to the config's `luckItemIds` (api/plugin/config), the list the plugin already reads.
 * Pets need no entry: the plugin reports every pet.
 */
export async function huntReportItemIds(clanId: number, nowMs: number = Date.now()): Promise<number[]> {
  const hunts = await activeHunts(clanId, nowMs);
  return [...new Set(hunts.flatMap((h) => (h.config.target === 'items' ? h.config.items.map((i) => i.id) : [])))];
}

function sightingOf(row: HuntDropRow): DropSighting {
  // The stored key is "<kind>|..." exactly as the plugin built it, so the kind reads back off it.
  const kind = row.dedupKey.split(/[|:]/)[0] || 'drop';
  return { kind, itemId: row.itemId, itemName: row.itemName, source: row.source, kc: row.kc, quantity: row.quantity, atMs: parseStamp(row.occurredAt) ?? 0, dedupKey: row.dedupKey };
}

/**
 * File a member's plugin reports against the clan's running hunts.
 *
 * Counted only when the character is entered (and has not opted out), the report matches a target
 * from an accepted source, and it happened inside the hunt's window. The same drop reported twice
 * (two loot events, the collection-log line, the pet line) is one row: lib/itemHunt isSameDrop.
 * With "end when the first one lands" the first counted drop closes the hunt at that moment.
 */
export async function recordHuntReports(
  member: { clanMemberId: number; rsn: string },
  clanId: number,
  reports: HuntReport[],
  now: Date = new Date(),
): Promise<number> {
  if (reports.length === 0) return 0;
  const hunts = await activeHunts(clanId, now.getTime());
  if (hunts.length === 0) return 0;
  // clan-scope: this clan -- the member's own seat in this clan's running hunts.
  const seats = await db
    .select()
    .from(weeklyParticipants)
    .where(
      and(
        inArray(weeklyParticipants.competitionId, hunts.map((h) => h.comp.id)),
        eq(weeklyParticipants.clanMemberId, member.clanMemberId),
        eq(weeklyParticipants.optedOut, false),
      ),
    );
  let stored = 0;
  for (const { comp, config } of hunts) {
    const seat = seats.find((s) => s.competitionId === comp.id);
    if (!seat) continue;
    const window = windowOf(comp);
    for (const report of reports) {
      // A log line or a pet line names the item only; the log's own id lets it meet the loot report.
      const withId = report.itemId == null && report.itemName ? { ...report, itemId: clogItemIdByName(report.itemName) } : report;
      const hit = matchHuntReport(config, withId);
      const atMs = parseStamp(report.occurredAt);
      if (!hit || atMs == null || !dropCounts(atMs, window.startMs, window.endMs)) continue;
      const sighting: DropSighting = { kind: report.kind, itemId: hit.itemId, itemName: hit.itemName, source: hit.source, kc: report.kc ?? null, quantity: hit.quantity, atMs, dedupKey: report.dedupKey };

      // clan-scope: global -- this character's own rows in one competition the caller resolved.
      const near = await db
        .select()
        .from(huntDrops)
        .where(
          and(
            eq(huntDrops.competitionId, comp.id),
            eq(huntDrops.rsnNormalized, seat.rsnNormalized),
            eq(huntDrops.origin, 'plugin'),
          ),
        );
      const same = near.find((row) => isSameDrop(sightingOf(row), sighting));
      if (same) {
        const patch = mergeSighting(sightingOf(same), sighting);
        if (patch) {
          await db
            .update(huntDrops)
            .set({ ...patch, itemName: patch.itemName ?? same.itemName, ...(patch.kc != null ? { statBasis: 'reported' } : {}) })
            .where(eq(huntDrops.id, same.id));
        }
        continue;
      }

      // The number the drop landed at. The plugin's own kill count when the report carries one;
      // otherwise the site's reading for this character right now (the live plugin push, else the
      // last hiscores read), marked as such.
      const stat = huntStat(config);
      const kc = report.kc ?? (stat?.type === 'boss' ? seat.currentValue : null);
      const xp = stat?.type === 'skill' ? seat.currentValue : null;
      const inserted = await db
        .insert(huntDrops)
        .values({
          competitionId: comp.id,
          clanMemberId: member.clanMemberId,
          rsn: seat.rsn,
          rsnNormalized: seat.rsnNormalized,
          itemId: hit.itemId,
          itemName: hit.itemName,
          quantity: hit.quantity,
          source: hit.source,
          kc,
          xp: kc == null ? xp : null,
          statSkill: kc == null && xp != null ? stat?.metric ?? null : null,
          statBasis: report.kc != null ? 'reported' : kc != null || xp != null ? 'site' : null,
          occurredAt: new Date(atMs).toISOString(),
          origin: 'plugin',
          status: 'counted',
          dedupKey: report.dedupKey,
        })
        .onConflictDoNothing()
        .returning({ id: huntDrops.id });
      if (inserted.length > 0) {
        stored++;
        await closeOnFirst(comp, config);
      }
    }
  }
  return stored;
}

/**
 * "End the hunt when the first one lands": pull the end back to the first counted drop. The weekly
 * lifecycle cron then finishes it the way it finishes any competition (results post, prizes, repeat).
 */
async function closeOnFirst(comp: Competition, config: HuntConfig): Promise<void> {
  if (config.rule !== 'first' || !config.endOnFirst) return;
  const drops = (await huntDropRows(comp.id)).map(toHuntDrop);
  const first = countedDrops(drops, windowOf(comp))[0];
  if (!first) return;
  const firstMs = Date.parse(first.occurredAt);
  const endMs = parseStamp(comp.endDate);
  if (endMs != null && endMs <= firstMs) return;
  await db
    .update(weeklyCompetitions)
    .set({ endDate: new Date(firstMs).toISOString(), hunt: serializeHunt({ ...config, plannedEnd: config.plannedEnd ?? comp.endDate }) })
    .where(and(eq(weeklyCompetitions.id, comp.id), eq(weeklyCompetitions.type, 'hunt')));
  log.info('hunt.closed-on-first', { competitionId: comp.id, rsn: first.rsnKey });
}

// ── Manual proofs ─────────────────────────────────────────────────────────────────────────────

export interface ManualDropInput {
  /** weekly_participants.id of the character the drop belongs to. */
  participantId: number;
  /** A target item's id; null on a pet hunt where the pet is given by name. */
  itemId: number | null;
  itemName: string;
  source: string | null;
  quantity: number;
  occurredAt: string;
  kc: number | null;
  xp: number | null;
  xpSkill: string | null;
  screenshotUrl: string;
  note: string | null;
}

export type ManualDropResult = { ok: true; id: number } | { ok: false; error: string };

/**
 * A drop that did not come from the plugin: a member's "I got it" (waits for staff) or a staff
 * "Add a drop" (counts at once). Both need a screenshot and the kill count or XP at the drop, and
 * both name a source the hunt accepts.
 */
export async function addManualDrop(
  comp: Competition,
  input: ManualDropInput,
  by: { userId: number; staff: boolean },
): Promise<ManualDropResult> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return { ok: false, error: 'This competition is not an item hunt.' };
  if (!input.screenshotUrl) return { ok: false, error: 'Add a screenshot of the drop.' };
  if (input.kc == null && input.xp == null) return { ok: false, error: 'Enter the kill count or the XP you had when you got it.' };
  const atMs = parseStamp(input.occurredAt);
  const window = windowOf(comp);
  if (atMs == null) return { ok: false, error: 'Pick when the drop happened.' };
  if (atMs > Date.now() + 60_000) return { ok: false, error: 'That time is in the future.' };
  if (!dropCounts(atMs, window.startMs, window.endMs)) return { ok: false, error: 'That time is outside the hunt. Only drops between its start and end count.' };

  let itemId: number | null = null;
  let itemName = input.itemName.trim().slice(0, 80);
  if (config.target === 'items') {
    const item = config.items.find((it) => it.id === input.itemId);
    if (!item) return { ok: false, error: 'Pick one of the items this hunt is for.' };
    itemId = item.id;
    itemName = item.name;
    if (item.sources.length > 0 && !input.source) return { ok: false, error: `Say where it came from: ${item.sources.join(' or ')}.` };
    if (!manualSourceAllowed(config, item.id, input.source)) return { ok: false, error: `${item.name} only counts from ${item.sources.join(' or ')} in this hunt.` };
  } else {
    const hit = matchHuntReport(config, { kind: 'pet', itemId: input.itemId, itemName: itemName || null, occurredAt: input.occurredAt, dedupKey: '' });
    if (!hit || hit.itemId == null) return { ok: false, error: 'Pick the pet. It has to be one this hunt is for.' };
    itemId = hit.itemId;
    itemName = hit.itemName;
  }

  // clan-scope: global -- one participant row by id, checked against the competition the caller resolved.
  const [seat] = await db
    .select()
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.id, input.participantId), eq(weeklyParticipants.competitionId, comp.id)));
  if (!seat) return { ok: false, error: 'That character is not entered in this hunt.' };

  // The site's own reading for this character now, kept beside the stated number for the reviewer.
  const stat = huntStat(config);
  const siteKc = stat?.type === 'boss' ? seat.currentValue : null;
  const siteXp = stat?.type === 'skill' ? seat.currentValue : null;

  let decidedByName: string | null = null;
  if (by.staff) decidedByName = await staffName(by.userId);
  const nowIso = new Date().toISOString();
  const [row] = await db
    .insert(huntDrops)
    .values({
      competitionId: comp.id,
      clanMemberId: seat.clanMemberId,
      rsn: seat.rsn,
      rsnNormalized: seat.rsnNormalized,
      itemId,
      itemName,
      quantity: Math.max(1, Math.min(1_000_000, Math.floor(input.quantity || 1))),
      source: input.source?.trim().slice(0, 80) || null,
      kc: input.kc,
      xp: input.kc == null ? input.xp : null,
      statSkill: input.kc == null && input.xp != null ? input.xpSkill ?? config.xpSkill ?? null : null,
      statBasis: 'stated',
      siteKc,
      siteXp,
      occurredAt: new Date(atMs).toISOString(),
      origin: 'manual',
      status: by.staff ? 'counted' : 'pending',
      dedupKey: `manual|${by.userId}|${Date.now()}|${Math.random().toString(36).slice(2, 8)}`,
      screenshotUrl: input.screenshotUrl.slice(0, 1000),
      note: input.note?.trim().slice(0, 500) || null,
      requestedByUserId: by.userId > 0 ? by.userId : null,
      decidedByUserId: by.staff && by.userId > 0 ? by.userId : null,
      decidedByName,
      decidedAt: by.staff ? nowIso : null,
    })
    .returning({ id: huntDrops.id });
  if (by.staff) {
    await audit(comp, seat.clanMemberId, 'hunt_drop_added', by.userId, { dropId: row.id, rsn: seat.rsn, item: itemName, source: input.source, kc: input.kc, xp: input.xp, at: input.occurredAt });
    await closeOnFirst(comp, config);
  }
  return { ok: true, id: row.id };
}

async function staffName(userId: number): Promise<string> {
  if (userId <= 0) return 'staff';
  const [u] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, userId));
  return u?.name?.trim() || 'staff';
}

async function audit(comp: Competition, clanMemberId: number | null, eventType: string, actorUserId: number, value: Record<string, unknown>, notes?: string) {
  await db.insert(clanAuditLog).values({
    clanId: comp.clanId,
    clanMemberId,
    eventType,
    actorUserId: actorUserId > 0 ? actorUserId : null,
    newValue: JSON.stringify({ competitionId: comp.id, ...value }),
    notes: notes ?? `Item hunt "${comp.title}"`,
  });
}

/** Staff approve or turn down a member's proof, or remove a drop that should not count. */
export async function decideHuntDrop(
  comp: Competition,
  dropId: number,
  decision: 'approve' | 'reject' | 'remove',
  by: { userId: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = parseHunt(comp.hunt);
  // clan-scope: global -- one drop by id, checked against the competition the caller resolved.
  const [row] = await db.select().from(huntDrops).where(and(eq(huntDrops.id, dropId), eq(huntDrops.competitionId, comp.id)));
  if (!row || !config) return { ok: false, error: 'That drop is not on this hunt.' };
  if (decision !== 'remove' && row.status !== 'pending') return { ok: false, error: 'That proof has already been decided.' };
  const name = await staffName(by.userId);
  const nowIso = new Date().toISOString();
  await db
    .update(huntDrops)
    .set({
      status: decision === 'approve' ? 'counted' : 'rejected',
      decidedByUserId: by.userId > 0 ? by.userId : null,
      decidedByName: name,
      decidedAt: nowIso,
    })
    .where(eq(huntDrops.id, row.id));
  await audit(
    comp,
    row.clanMemberId,
    decision === 'approve' ? 'hunt_drop_approved' : decision === 'reject' ? 'hunt_drop_rejected' : 'hunt_drop_removed',
    by.userId,
    { dropId: row.id, rsn: row.rsn, item: row.itemName, source: row.source, kc: row.kc, xp: row.xp, origin: row.origin, at: row.occurredAt },
  );
  if (decision === 'approve') await closeOnFirst(comp, config);
  return { ok: true };
}

/** The viewer's own entries in a hunt (their characters' participant rows), for "I got it". */
export async function myHuntSeats(competitionId: number, playerId: number): Promise<{ id: number; rsn: string }[]> {
  // clan-scope: global -- the viewer's own seats, joined to one competition the caller resolved.
  return db
    .select({ id: weeklyParticipants.id, rsn: weeklyParticipants.rsn })
    .from(weeklyParticipants)
    .innerJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(weeklyParticipants.competitionId, competitionId), eq(clanRoster.playerId, playerId), isNull(clanRoster.leftAt), countsTowardLeaderboard()));
}

export { dropWeight };
