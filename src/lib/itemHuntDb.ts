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
//
// TRUST. A plugin report is the client's word and no hiscores read can confirm a drop, so a report
// alone never ends a hunt and never pays a prize: both wait for staff (recordHuntReports,
// decideHuntDrop, huntPrizeBoard).

import { countsWorld } from '@/lib/competitionGame';
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanRoster, huntDrops, users, weeklyCompetitions, weeklyParticipants, type HuntDropRow } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { dropCounts } from '@/lib/h2hRules';
import {
  type BountyClaim,
  type DropSighting,
  type HuntConfig,
  type HuntDrop,
  type HuntEntrant,
  type HuntRates,
  type HuntRowProgress,
  huntReportItemIdsOf,
  huntBountyClaims,
  unconfirmedBountyDrops,
  huntPets,
  huntRsnKey,
  defaultHuntTitle,
  huntRowProgress,
  type HuntReport,
  type HuntRow,
  BURST_WINDOW_MS,
  bossKeyForSource,
  countedDrops,
  dropFlag,
  dropWeight,
  awaitingConfirmation,
  huntEndsAt,
  huntSettingsFromInput,
  huntEndingWords,
  serverDropKey,
  unconfirmedPrizeDrops,
  huntStat,
  MAX_ITEM_POINTS,
  isRush,
  rushBossKeys,
  isSameDrop,
  manualSourceAllowed,
  matchHuntReport,
  mergeSighting,
  parseHunt,
  rankHunt,
  serializeHunt,
} from '@/lib/itemHunt';
import { huntRates } from '@/lib/huntRates';
import { RUSH_SAME_DEATH_MS, rushFromInput, rushKcStep, rushSynergy, withGroupKills } from '@/lib/bossRushRules';
import { raidKeys } from '@/lib/raidNpcs';
import { log } from '@/lib/logger';
import { newProofKey } from '@/lib/proofAfter';
import { rateLimitByKey } from '@/lib/rate-limit';
import { clogItemIdByName } from '@/lib/moments';
import { computeLeaderboard, countsTowardLeaderboard, getEffectiveParticipants, type LeaderboardEntry } from '@/lib/weekly';
import { weeklyStatus } from '@/lib/weeklyStage';

type Competition = typeof weeklyCompetitions.$inferSelect;
type CompetitionLike = Pick<Competition, 'id' | 'type' | 'startDate' | 'endDate'> & { hunt?: string | null };

const windowOf = (comp: { startDate: string; endDate: string }) => ({ startMs: parseStamp(comp.startDate), endMs: parseStamp(comp.endDate) });

type EntrantSource = { rsn: string; baselineValue: number | null; currentValue: number | null; huntBaseline?: Record<string, number> | null; huntCurrent?: Record<string, number> | null };

/**
 * What rankHunt needs of each entrant: the hunt's one stat gained, and on a v2 hunt their Due over
 * the rows' drop rates (lib/itemHunt huntRowProgress). Every board ranks through this, so the page,
 * the panel, the results post and the prize settle all put the driest in the same order.
 */
function huntEntrants(config: HuntConfig, participants: EntrantSource[], rates: HuntRates, tracked = true, rush: RushCounts | null = null): HuntEntrant[] {
  return participants.map((p) => {
    const statGain = tracked && p.baselineValue != null && p.currentValue != null ? Math.max(0, p.currentValue - p.baselineValue) : null;
    if (isRush(config)) {
      // Kills the plugin saw, or with "every kill counts" the gain the way Boss of the Week reads it.
      const mine = rush?.get(huntRsnKey(p.rsn));
      return { rsn: p.rsn, statGain, rush: { kc: config.rush.kcSource === 'any' ? statGain ?? 0 : mine?.kc ?? 0, deaths: mine?.deaths ?? 0, synergy: mine?.synergy ?? 0 } };
    }
    return { rsn: p.rsn, statGain, ...(config.v === 2 ? { due: huntRowProgress(config, p.huntBaseline, p.huntCurrent, rates).due } : {}) };
  });
}

/** A rush's plugin-seen kills, deaths and Clan Synergy per entrant, by normalised name. */
type RushCounts = Map<string, { kc: number; deaths: number; synergy: number }>;

/**
 * Read off the seats themselves, whatever list a caller ranks over: the prize settle and the
 * results post hand in their own narrower lists, which do not carry these columns.
 */
async function rushCounts(config: HuntConfig, competitionId: number): Promise<RushCounts | null> {
  if (!isRush(config)) return null;
  // clan-scope: global -- one competition's seats by its id; the caller settled the owning clan.
  const rows = await db
    .select({ rsn: weeklyParticipants.rsnNormalized, kc: weeklyParticipants.rushKc, deaths: weeklyParticipants.rushDeaths, raids: weeklyParticipants.rushRaids, optedOut: weeklyParticipants.optedOut })
    .from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, competitionId));
  // Grouped over every seat in it, whichever list the caller ranks: a clanmate left off a prize
  // list still raided with the winner.
  const synergy = rushSynergy(config.rush, new Map(rows.filter((r) => !r.optedOut).map((r) => [huntRsnKey(r.rsn), r.raids ?? []])));
  return new Map(rows.map((r) => [huntRsnKey(r.rsn), { kc: r.kc, deaths: r.deaths, synergy: synergy.get(huntRsnKey(r.rsn)) ?? 0 }]));
}

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
    confirmed: r.status === 'counted' && r.decidedAt != null,
    flagReason: r.flagReason,
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

/**
 * Each drop that counts goes to the clan's Discord once (lib/huntDropPosts), after the reply and never
 * in its way: a failed post is logged and the drop counts all the same. Imported here, since that
 * module reads the standings from this one.
 */
function postHuntDrops(ids: number[], what: 'post' | 'retract' = 'post'): void {
  if (ids.length === 0) return;
  void import('@/lib/huntDropPosts')
    .then((m) => m.afterHuntDrops(ids, what))
    .catch((err) => log.warn('hunt.post-failed', { ids }, err));
}

/**
 * One drop's standing as it stood once that drop was in: the drops up to it count, later ones don't,
 * so the post and the edit that adds its screenshot say the same thing.
 */
export async function huntDropStanding(
  comp: CompetitionLike,
  dropId: number,
): Promise<{ config: HuntConfig; drop: HuntDrop; row: HuntRow | null; bounty: BountyClaim | null } | null> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return null;
  const [participants, all, rush] = await Promise.all([getEffectiveParticipants(comp.id), huntDropRows(comp.id), rushCounts(config, comp.id)]);
  const drops = all.map(toHuntDrop);
  const drop = drops.find((d) => d.id === dropId);
  if (!drop) return null;
  const at = parseStamp(drop.occurredAt) ?? 0;
  const upTo = drops.filter((d) => d.id === dropId || (parseStamp(d.occurredAt) ?? 0) <= at);
  const rates = config.v === 2 ? huntRates(config) : {};
  const rows = rankHunt(config, huntEntrants(config, participants, rates, huntStat(config) != null, rush), upTo, windowOf(comp));
  // The bounty place this drop claimed, if any: decided over the same drops, so it is the place it took.
  const bounty = huntBountyClaims(config, upTo, windowOf(comp)).find((c) => c.dropId === dropId) ?? null;
  return { config, drop, row: rows.find((r) => huntRsnKey(r.rsn) === drop.rsnKey) ?? null, bounty };
}

export interface HuntStandings {
  config: HuntConfig;
  rows: HuntRow[];
  /** Counted drops, oldest first. */
  drops: HuntDrop[];
  /** Waiting for staff: members' manual proofs ('pending') and plugin reports held for a look ('review'). */
  pending: HuntDropRow[];
  /** An "after N drops" hunt with enough drops reported: the ones staff still have to confirm before it ends. */
  awaiting: HuntDrop[];
  /** Every row, for the staff page. */
  all: HuntDropRow[];
  participants: Awaited<ReturnType<typeof getEffectiveParticipants>>;
  /** v2: each row's drop rate per stat key (lib/huntRates); empty on v1. */
  rates: HuntRates;
  /** v2: each entrant's progress per row and Due, by rsn. Empty on v1. */
  progress: Map<string, { rows: HuntRowProgress[]; due: number | null }>;
}

/** The hunt's standings, ranked by its rule. Null when the competition is not a readable hunt. */
export async function huntStandings(comp: CompetitionLike): Promise<HuntStandings | null> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return null;
  const [participants, all, rush] = await Promise.all([getEffectiveParticipants(comp.id), huntDropRows(comp.id), rushCounts(config, comp.id)]);
  const tracked = huntStat(config) != null;
  const drops = all.map(toHuntDrop);
  const rates = config.v === 2 ? huntRates(config) : {};
  const rows = rankHunt(config, huntEntrants(config, participants, rates, tracked, rush), drops, windowOf(comp));
  const progress = new Map(config.v === 2 ? participants.map((p) => [p.rsn, huntRowProgress(config, p.huntBaseline, p.huntCurrent, rates)] as const) : []);
  return {
    config,
    rows,
    drops: countedDrops(drops, windowOf(comp)),
    pending: all.filter((d) => d.status === 'pending' || d.status === 'review'),
    awaiting: awaitingConfirmation(config, drops, windowOf(comp)),
    all,
    participants,
    rates,
    progress,
  };
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
  participants: EntrantSource[],
): Promise<LeaderboardEntry[]> {
  const config = comp.type === 'hunt' ? parseHunt(comp.hunt) : null;
  if (comp.type !== 'hunt') return computeLeaderboard(participants);
  if (!config) return participants.map((p) => ({ rsn: p.rsn, baselineValue: 0, currentValue: 0, gained: 0 }));
  const rush = await rushCounts(config, comp.id);
  const rows = rankHunt(config, huntEntrants(config, participants, config.v === 2 ? huntRates(config) : {}, true, rush), (await huntDropRows(comp.id)).map(toHuntDrop), windowOf(comp));
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
  return [...new Set(hunts.flatMap((h) => huntReportItemIdsOf(h.config)))];
}

/** One running hunt's target, for the plugin's drop popup (lib/pluginFacts/rules huntDropRules). */
export interface HuntTarget {
  competitionId: number;
  hunt: string;
  itemId: number;
  name: string;
  /** Where it has to come from; empty for a pet or an any-source item. */
  sources: string[];
}

/**
 * The targets of the clan's running hunts this character is entered in, so their plugin can show the
 * drop popup and line the moment one lands. Only a popup: the drop report still decides what counts.
 */
export async function huntTargetsFor(clanId: number, rsn: string | null | undefined, nowMs: number = Date.now()): Promise<HuntTarget[]> {
  if (!rsn) return [];
  const me = huntRsnKey(rsn);
  const out: HuntTarget[] = [];
  for (const { comp, config } of await activeHunts(clanId, nowMs)) {
    const entered = (await getEffectiveParticipants(comp.id)).some((p) => huntRsnKey(p.rsn) === me);
    if (!entered) continue;
    const hunt = (comp.title || defaultHuntTitle(config)).slice(0, 60);
    const rows =
      config.target === 'pets' && config.v !== 2
        ? huntPets(config).map((p) => ({ id: p.id, name: p.name, sources: [] as string[] }))
        : config.items.map((it) => ({ id: it.id, name: it.name, sources: it.pet ? [] : it.sources }));
    for (const r of rows) out.push({ competitionId: comp.id, hunt, itemId: r.id, name: r.name, sources: r.sources });
  }
  return out;
}

function sightingOf(row: HuntDropRow): DropSighting {
  // The stored key is "<kind>|..." as serverDropKey built it, so the kind reads back off it.
  const kind = row.dedupKey.split('|')[0] || 'drop';
  return { kind, itemId: row.itemId, itemName: row.itemName, source: row.source, kc: row.kc, quantity: row.quantity, atMs: parseStamp(row.occurredAt) ?? 0, dedupKey: row.dedupKey };
}

/** A plugin drop's screenshot key, by the item it is for: the moments reply hands these to the plugin. */
export interface HuntProofKey {
  itemId: number;
  key: string;
}

export interface HuntReportsResult {
  /** New rows filed. */
  stored: number;
  /** One key per new row: where its screenshot goes (POST /api/plugin/facts/proof). */
  proofs: HuntProofKey[];
}

/** What one character may add to a hunt through the plugin: far above real play, well below a loop. */
const HUNT_DROP_LIMIT = { limit: 30, windowMs: 10 * 60_000 };

/**
 * File a member's plugin reports against the clan's running hunts.
 *
 * A report is the client's word, so this is deliberately narrow about what one can do:
 *
 *   - it counts only for a character entered in the hunt (and not opted out), for a target from an
 *     accepted source, inside the hunt's window;
 *   - the row's key is built here (lib/itemHunt serverDropKey), and the same drop reported twice
 *     (two loot events, the collection-log line, the pet line) is one row (isSameDrop);
 *   - a report that looks wrong (lib/itemHunt dropFlag) is held for staff with the reason and does
 *     not count until they confirm it;
 *   - by default a report never ends a hunt or pays a prize: an "after N drops" ending waits for
 *     staff to confirm the drops it rests on (decideHuntDrop), and prizes wait for the winners'
 *     drops to be confirmed (lib/weeklyPrizeSettle). A clan can choose "count plugin drops
 *     automatically" instead; a held report still waits for staff even then;
 *   - inserts are rate limited per character.
 */
export async function recordHuntReports(
  member: { clanMemberId: number; rsn: string },
  clanId: number,
  reports: HuntReport[],
  now: Date = new Date(),
  /** The game mode the drops came from (lib/worldModes key); null = the main game. */
  modeKey: string | null = null,
): Promise<HuntReportsResult> {
  const none = { stored: 0, proofs: [] };
  if (reports.length === 0) return none;
  // Only the hunts that count this world: the main game, or the mode a hunt is set to (lib/competitionGame).
  const hunts = (await activeHunts(clanId, now.getTime())).filter((h) => countsWorld(h.comp.countsOn, modeKey));
  if (hunts.length === 0) return none;
  // clan-scope: this clan -- the member's own seat in this clan's running hunts.
  const seats = await db
    .select()
    .from(weeklyParticipants)
    .where(
      and(
        inArray(weeklyParticipants.competitionId, hunts.map((h) => h.comp.id)),
        eq(weeklyParticipants.clanMemberId, member.clanMemberId),
        eq(weeklyParticipants.optedOut, false),
        // A Hardcore Worlds character that died mid-hunt keeps what it found and finds nothing more.
        isNull(weeklyParticipants.stoppedAt),
      ),
    );
  let stored = 0;
  const proofs: HuntProofKey[] = [];
  const counted: number[] = [];
  for (const { comp, config } of hunts) {
    const seat = seats.find((s) => s.competitionId === comp.id);
    if (!seat) continue;
    const window = windowOf(comp);
    const stat = huntStat(config);
    for (const report of reports) {
      if (report.kind === 'death') {
        if (isRush(config)) await recordRushDeath(config, seat.id, report, window);
        continue;
      }
      // A log line or a pet line names the item only; the log's own id lets it meet the loot report.
      const withId = report.itemId == null && report.itemName ? { ...report, itemId: clogItemIdByName(report.itemName) } : report;
      const hit = matchHuntReport(config, withId);
      const atMs = parseStamp(report.occurredAt);
      if (!hit || atMs == null || !dropCounts(atMs, window.startMs, window.endMs)) continue;
      const dedupKey = serverDropKey({ kind: report.kind, itemId: hit.itemId, itemName: hit.itemId == null ? null : hit.itemName, source: hit.source }, atMs);
      const sighting: DropSighting = { kind: report.kind, itemId: hit.itemId, itemName: hit.itemName, source: hit.source, kc: report.kc ?? null, quantity: hit.quantity, atMs, dedupKey };

      // This character's plugin rows in this hunt: a handful, read whole and compared in code.
      // clan-scope: global -- this character's own rows in one competition the caller resolved.
      const mine = await db
        .select()
        .from(huntDrops)
        .where(and(eq(huntDrops.competitionId, comp.id), eq(huntDrops.rsnNormalized, seat.rsnNormalized), eq(huntDrops.origin, 'plugin')));
      const same = mine.find((row) => isSameDrop(sightingOf(row), sighting));
      if (same) {
        // A second sighting only fills in what the first lacked. It never revives a turned-down row.
        // A kill count the site filled in itself gives way to the plugin's own, once a sighting has it.
        const stored = same.statBasis === 'reported' ? sightingOf(same) : { ...sightingOf(same), kc: null };
        const patch = mergeSighting(stored, sighting);
        if (patch) {
          await db
            .update(huntDrops)
            .set({ ...patch, itemName: patch.itemName ?? same.itemName, ...(patch.kc != null ? { statBasis: 'reported' } : {}) })
            .where(eq(huntDrops.id, same.id));
        }
        continue;
      }

      const cap = await rateLimitByKey('hunt-drops', String(member.clanMemberId), HUNT_DROP_LIMIT);
      if (!cap.ok) {
        log.warn('hunt.rate-limited', { competitionId: comp.id, clanMemberId: member.clanMemberId });
        postHuntDrops(counted);
        return { stored, proofs };
      }

      // Kill-count checks need one boss to compare against: the hunt shows kills for exactly one
      // hiscores key, and this drop came from that boss.
      const singleBoss = stat?.type === 'boss' && !stat.metric.includes(',') && !!hit.source && bossKeyForSource(hit.source) === stat.metric;
      const recentSameItem = mine.filter(
        (row) => row.status !== 'rejected' && row.itemId === hit.itemId && Math.abs((parseStamp(row.occurredAt) ?? 0) - atMs) <= BURST_WINDOW_MS,
      ).length;
      const flagReason = dropFlag({ reportedKc: report.kc ?? null, singleBoss, baseline: seat.baselineValue, current: seat.currentValue, recentSameItem });

      // The number the drop landed at. The plugin's own kill count when the report carries one;
      // otherwise the site's reading for this character right now (the live plugin push, else the
      // last hiscores read), marked as such.
      const kc = report.kc ?? (stat?.type === 'boss' ? seat.currentValue : null);
      const xp = stat?.type === 'skill' ? seat.currentValue : null;
      // The screenshot the plugin takes of it comes up under this key (lib/huntDropPosts). Held reports
      // get one too, for the staff who look at them; an older plugin never uses it, and nothing waits.
      const proofKey = newProofKey();
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
          siteKc: stat?.type === 'boss' ? seat.currentValue : null,
          siteXp: stat?.type === 'skill' ? seat.currentValue : null,
          occurredAt: new Date(atMs).toISOString(),
          origin: 'plugin',
          status: flagReason ? 'review' : 'counted',
          flagReason,
          dedupKey,
          proofKey,
        })
        .onConflictDoNothing()
        .returning({ id: huntDrops.id });
      if (inserted.length > 0) {
        stored++;
        if (hit.itemId != null) proofs.push({ itemId: hit.itemId, key: proofKey });
        if (!flagReason) counted.push(inserted[0].id);
        // Only a clan that chose "count plugin drops automatically" lets a report end its hunt, and
        // a held report is not counted, so it cannot be the one that does.
        if (config.confirm === 'auto' && !flagReason) await closeIfDue(comp, config);
      }
    }
  }
  postHuntDrops(counted);
  return { stored, proofs };
}

/**
 * A death at one of a rush's bosses, as the plugin named its killer (lib/deathSource has already
 * settled a guessed one to a boss or nothing), or inside a rush raid (any of its monsters, lib/raidNpcs). Counted on the seat in one statement, and only when
 * the seat's last death is more than RUSH_SAME_DEATH_MS before it: one death sent twice counts once.
 * A death with no killer named, or a killer that is not a rush boss, costs nothing.
 */
async function recordRushDeath(config: HuntConfig, seatId: number, report: HuntReport, window: { startMs: number | null; endMs: number | null }): Promise<void> {
  if (!isRush(config) || !config.rush.deaths) return;
  const atMs = parseStamp(report.occurredAt);
  const keys = rushBossKeys(config);
  const boss = report.source ? bossKeyForSource(report.source) : null;
  // In a raid the killer is one of its monsters, never the raid: that raid's death, in any mode.
  const atRush = (boss != null && keys.includes(boss)) || raidKeys(report.raid).some((k) => keys.includes(k));
  if (atMs == null || !dropCounts(atMs, window.startMs, window.endMs) || !atRush) return;
  const at = new Date(atMs).toISOString();
  const before = new Date(atMs - RUSH_SAME_DEATH_MS).toISOString();
  // clan-scope: global -- the member's own seat, found through this clan's running hunts.
  await db
    .update(weeklyParticipants)
    .set({ rushDeaths: sql`${weeklyParticipants.rushDeaths} + 1`, rushDeathAt: at })
    .where(and(eq(weeklyParticipants.id, seatId), or(isNull(weeklyParticipants.rushDeathAt), lt(weeklyParticipants.rushDeathAt, before))));
}

/**
 * Kills the plugin saw at a rush's bosses, from one live stats push (POST /api/plugin/stats), for a
 * rush that counts plugin kills only (lib/bossRushRules rushKcStep). Measured from what this seat's
 * last push said, else from its starting counts. Pushes from one client come one at a time (15s
 * apart), so the read-then-write here does not race itself.
 */
export async function creditRushPush(input: {
  comp: { id: number; startDate: string; endDate: string; hunt: string | null };
  seat: { id: number; rushSeen: Record<string, [number, number]> | null; rushRaids: [string, number][] | null; baselineParts: Record<string, number> | null; baselineValue: number | null };
  pushed: Record<string, number>;
  nowMs: number;
}): Promise<number> {
  const config = parseHunt(input.comp.hunt);
  if (!isRush(config)) return 0;
  const window = windowOf(input.comp);
  if (!dropCounts(input.nowMs, window.startMs, window.endMs)) return 0;
  const keys = rushBossKeys(config);
  // One boss: its starting count is the seat's baseline; several: the split behind the sum.
  const start = input.seat.baselineParts ?? (keys.length === 1 && input.seat.baselineValue != null ? { [keys[0]]: input.seat.baselineValue } : null);
  const step = rushKcStep({ pushed: input.pushed, bossKeys: keys, seen: input.seat.rushSeen, start, startMs: window.startMs ?? input.nowMs, nowMs: input.nowMs });
  if (JSON.stringify(step.seen) === JSON.stringify(input.seat.rushSeen ?? {}) && step.credit === 0) return 0;
  // clan-scope: global -- the member's own seat, found through this clan's running competitions.
  await db
    .update(weeklyParticipants)
    .set({
      rushSeen: step.seen,
      ...(step.credit > 0 ? { rushKc: sql`${weeklyParticipants.rushKc} + ${step.credit}` } : {}),
      // A kill at a group boss: Clan Synergy pairs it with clanmates' kills of it at the same moment.
      ...(() => {
        const raids = withGroupKills(input.seat.rushRaids, step.credited, input.nowMs);
        return raids ? { rushRaids: raids } : {};
      })(),
    })
    .where(eq(weeklyParticipants.id, input.seat.id));
  return step.credit;
}

/**
 * An "after N drops" (or "when a player has all of them") hunt that has reached its ending: pull the end back to the deciding drop and
 * finish it (lib/weeklyFinish: results post, prizes, exactly once). Does nothing while the hunt is
 * still running, which with staff confirming includes "enough reported, not yet confirmed".
 */
async function closeIfDue(comp: Competition, config: HuntConfig): Promise<boolean> {
  const drops = (await huntDropRows(comp.id)).map(toHuntDrop);
  const at = huntEndsAt(config, drops, windowOf(comp));
  if (!at) return false;
  return endHuntAt(comp, config, Date.parse(at));
}

/** Move the end to `atMs` (never later than it already is) and finish. Shared by every early ending. */
async function endHuntAt(comp: Competition, config: HuntConfig, atMs: number): Promise<boolean> {
  const endMs = parseStamp(comp.endDate);
  if (endMs == null || endMs > atMs) {
    // plannedEnd: a repeating hunt starts its next run from the end this one was meant to have.
    await db
      .update(weeklyCompetitions)
      .set({ endDate: new Date(atMs).toISOString(), hunt: serializeHunt({ ...config, plannedEnd: config.plannedEnd ?? comp.endDate }) })
      .where(and(eq(weeklyCompetitions.id, comp.id), eq(weeklyCompetitions.type, 'hunt'), ne(weeklyCompetitions.status, 'completed')));
  }
  // Imported here: lib/weeklyFinish reads the board from this module.
  const { finishCompetition } = await import('@/lib/weeklyFinish');
  const finished = await finishCompetition(comp.id);
  if (finished) log.info('hunt.ended-early', { competitionId: comp.id, at: new Date(atMs).toISOString() });
  return finished;
}

/**
 * "End now and post results": staff end a hunt by hand, whatever its ending is set to. The results
 * post and the prize settle are the same ones every other ending uses, and only one caller gets to
 * run them, so a double click posts once. Returns whether this call was the one that ended it.
 */
export async function endHuntNow(comp: Competition, by: { userId: number }): Promise<{ ok: true; ended: boolean } | { ok: false; error: string }> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return { ok: false, error: 'This competition is not an item hunt.' };
  if (comp.status === 'completed') return { ok: true, ended: false };
  const startMs = parseStamp(comp.startDate);
  if (startMs != null && startMs > Date.now()) return { ok: false, error: 'It has not started yet. Delete it or change its dates instead.' };
  const ended = await endHuntAt(comp, config, Date.now());
  if (ended) await audit(comp, null, 'hunt_ended_by_staff', by.userId, { endedAt: new Date().toISOString(), plannedEnd: comp.endDate });
  return { ok: true, ended };
}

/**
 * Change "How it ends" or "Who confirms drops". Audit-logged with the before and after. Switching
 * to automatic confirms nothing after the fact: held reports stay held and the drops already in the
 * standings stay as unconfirmed as they were. It only changes what the next ending needs.
 */
export async function updateHuntSettings(
  comp: Competition,
  input: Record<string, unknown>,
  by: { userId: number },
): Promise<{ ok: true; config: HuntConfig } | { ok: false; error: string }> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return { ok: false, error: 'This competition is not an item hunt.' };
  if (comp.status === 'completed') return { ok: false, error: 'This hunt has finished.' };
  const next: HuntConfig = { ...config, ...huntSettingsFromInput({ ends: input.ends ?? config.ends, confirm: input.confirm ?? config.confirm }) };
  if (isRush(config)) {
    // A rush runs to its date. Its scoring and each drop's points are the host's to change while it
    // runs: every score is worked out from them when read, so a change rescores everyone at once.
    next.ends = { kind: 'date' };
    if (input.rush !== undefined) next.rush = rushFromInput(input.rush);
    const pts = input.points && typeof input.points === 'object' ? (input.points as Record<string, unknown>) : null;
    if (pts) {
      next.items = config.items.map((it) => {
        const v = pts[String(it.id)];
        return typeof v === 'number' && Number.isFinite(v) ? { ...it, points: Math.min(MAX_ITEM_POINTS, Math.max(0, Math.round(v))) } : it;
      });
    }
  }
  if (serializeHunt(next) === serializeHunt(config)) return { ok: true, config };
  await db.update(weeklyCompetitions).set({ hunt: serializeHunt(next) }).where(eq(weeklyCompetitions.id, comp.id));
  await db.insert(clanAuditLog).values({
    clanId: comp.clanId,
    eventType: 'hunt_settings_changed',
    actorUserId: by.userId > 0 ? by.userId : null,
    oldValue: JSON.stringify({ competitionId: comp.id, ends: huntEndingWords(config.ends), confirm: config.confirm, ...(isRush(config) ? { rush: config.rush, points: rushPoints(config) } : {}) }),
    newValue: JSON.stringify({ competitionId: comp.id, ends: huntEndingWords(next.ends), confirm: next.confirm, ...(isRush(next) ? { rush: next.rush, points: rushPoints(next) } : {}) }),
    notes: `Item hunt "${comp.title}"`,
  });
  // The new ending may already be met (N lowered to what has landed): end it now if so.
  await closeIfDue({ ...comp, hunt: serializeHunt(next) }, next);
  return { ok: true, config: next };
}

/** A rush's drop points by item id, for the audit log. */
const rushPoints = (config: HuntConfig) => Object.fromEntries(config.items.map((it) => [it.id, it.points ?? 0]));

/**
 * A hunt ranked over exactly the entrants handed in, for the prize settle (lib/weeklyPrizeSettle).
 *
 * The coffer pays a narrower list than the public board shows (no event seats, guests only when
 * the clan includes them), so "who is in a paying place" and "is their drop confirmed" have to be
 * asked of that list and no other. `holds` are the unconfirmed drops behind the first `prizePlaces`
 * of THESE rows: empty means the paying places rest only on drops staff have confirmed.
 */
export async function huntPrizeBoard(
  comp: Competition,
  entrants: EntrantSource[],
  prizePlaces: number,
): Promise<{ rows: HuntRow[]; holds: HuntDrop[]; bounties: BountyClaim[] } | null> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return null;
  const [drops, rush] = await Promise.all([huntDropRows(comp.id).then((r) => r.map(toHuntDrop)), rushCounts(config, comp.id)]);
  const rows = rankHunt(config, huntEntrants(config, entrants, config.v === 2 ? huntRates(config) : {}, true, rush), drops, windowOf(comp));
  // Bounties over the same list: only these entrants' drops claim one, and the drops behind a claim
  // wait for staff exactly as a paying place's do.
  const bounties = huntBountyClaims(config, drops, windowOf(comp), new Set(entrants.map((e) => huntRsnKey(e.rsn))));
  const holds = [...unconfirmedPrizeDrops(config, rows, prizePlaces), ...unconfirmedBountyDrops(config, bounties, drops)];
  return { rows, holds: holds.filter((d, i) => holds.findIndex((x) => x.id === d.id) === i), bounties };
}

/** Every bounty claimed so far on a hunt, over its whole board (the page, the posts). */
export async function huntBounties(comp: CompetitionLike): Promise<{ config: HuntConfig; claims: BountyClaim[] } | null> {
  const config = parseHunt(comp.hunt);
  if (comp.type !== 'hunt' || !config) return null;
  return { config, claims: huntBountyClaims(config, (await huntDropRows(comp.id)).map(toHuntDrop), windowOf(comp)) };
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
  if (!/^https?:\/\/\S+$/i.test(input.screenshotUrl ?? '')) return { ok: false, error: 'Add a screenshot of the drop.' };
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
    postHuntDrops([row.id]);
    await closeIfDue(comp, config);
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

/**
 * Staff decide a drop.
 *
 *   confirm  a member's proof or a held plugin report starts counting; a plugin drop already in the
 *            standings is marked as looked at. On an "after N drops" hunt, confirming the last
 *            drop the result rests on is what ends the hunt, at the deciding drop's time.
 *   reject   it leaves the standings (or never enters them). The hunt carries on.
 *
 * Both are written to the clan's audit log.
 */
export async function decideHuntDrop(
  comp: Competition,
  dropId: number,
  decision: 'confirm' | 'reject',
  by: { userId: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = parseHunt(comp.hunt);
  const all = await huntDropRows(comp.id);
  const row = all.find((r) => r.id === dropId);
  if (!row || !config) return { ok: false, error: 'That drop is not on this hunt.' };
  if (row.status === 'rejected') return { ok: false, error: 'That drop has already been turned down.' };
  if (decision === 'confirm' && row.status === 'counted' && row.decidedAt) return { ok: false, error: 'That drop is already confirmed.' };
  const name = await staffName(by.userId);
  await db
    .update(huntDrops)
    .set({
      status: decision === 'confirm' ? 'counted' : 'rejected',
      decidedByUserId: by.userId > 0 ? by.userId : null,
      decidedByName: name,
      decidedAt: new Date().toISOString(),
    })
    .where(eq(huntDrops.id, row.id));
  await audit(
    comp,
    row.clanMemberId,
    decision === 'confirm' ? 'hunt_drop_confirmed' : 'hunt_drop_rejected',
    by.userId,
    { dropId: row.id, rsn: row.rsn, item: row.itemName, source: row.source, kc: row.kc, xp: row.xp, origin: row.origin, was: row.status, flag: row.flagReason, at: row.occurredAt },
  );
  // A drop that starts counting now goes to Discord (a plugin drop already counted went when it came);
  // one turned down after it went out is taken down.
  postHuntDrops([row.id], decision === 'confirm' ? 'post' : 'retract');
  // Either answer can be the last one an "after N drops" ending was waiting for.
  await closeIfDue(comp, config);
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
