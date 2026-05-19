import { db } from '@/db';
import { clanMembers, settings, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { log } from '@/lib/logger';

interface HiscoresSnapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

// Setting key for the "include guests in weekly auto-enrollment" toggle.
// Default off — guests are typically not part of the clan-wide weekly comp.
// Admins can flip this from the settings UI for events where guests should be tracked.
const WEEKLY_TRACK_GUESTS_KEY = 'weekly_track_guests';

async function shouldTrackGuests(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, WEEKLY_TRACK_GUESTS_KEY) });
  return row?.value === 'true' || row?.value === '1';
}

/**
 * Enroll every active clan member into a competition. The pool comes from the
 * plugin-synced clan roster (`clan_members` with `left_at IS NULL`). Discord
 * login is NOT required — weekly comps are clan-wide by design.
 *
 * Guests (`is_guest = 1`) are excluded by default. Set the `weekly_track_guests`
 * setting to "true" to also enroll them, or use the per-event participants
 * endpoint to manually add specific guests for one comp.
 */
export async function enrollAllPlayers(competitionId: number) {
  const trackGuests = await shouldTrackGuests();
  // Skip unranked/banned/archived members — re-enrolling them just re-creates rows the
  // cron will immediately quarantine. They become eligible again when a re-probe job
  // (or manual mod action) flips status back to 'active'.
  const baseClause = and(isNull(clanMembers.leftAt), eq(clanMembers.status, 'active'));
  const whereClause = trackGuests
    ? baseClause
    : and(baseClause, eq(clanMembers.isGuest, 0));

  const activeMembers = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn })
    .from(clanMembers)
    .where(whereClause);

  // Count only rows actually inserted (not conflicts that hit the unique index) so
  // callers can tell "did anyone new join this comp on this run". .returning() yields
  // an empty array when onConflictDoNothing suppresses the insert.
  let enrolled = 0;
  for (const m of activeMembers) {
    try {
      const inserted = await db
        .insert(weeklyParticipants)
        .values({
          competitionId,
          clanMemberId: m.id,
          rsn: m.rsn,
          rsnNormalized: normalizeRsn(m.rsn),
        })
        .onConflictDoNothing()
        .returning({ id: weeklyParticipants.id });
      if (inserted.length > 0) enrolled++;
    } catch {
      // Skip on conflict/error — keep counting what we could add
    }
  }
  return enrolled;
}

const HISCORES_TIMEOUT_MS = 8000;
const HISCORES_RETRY_DELAY_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${tag} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function fetchHiscoresOnce(rsn: string): Promise<HiscoresSnapshot> {
  // Strip any non-ASCII whitespace before handing to the lib — its validateRSN regex
  // rejects U+00A0 outright. Defense in depth; we also clean on write, but legacy
  // rows still in the table need this until they're backfilled.
  const cleanRsn = sanitizeRsn(rsn);
  return (await withTimeout(
    getStatsByGamemode(cleanRsn) as Promise<HiscoresSnapshot>,
    HISCORES_TIMEOUT_MS,
    `hiscores(${cleanRsn})`,
  ));
}

/**
 * Light-weight reachability probe — used by the cron's re-probe pass to lift
 * `unranked` members back to `active` when they reappear on hiscores. Reuses the
 * full snapshot fetch (osrs-json-hiscores doesn't expose a HEAD-like check) but
 * doesn't read any metric, so callers can ignore the parsed payload.
 */
export async function probeRsnReachable(rsn: string): Promise<'reachable' | 'unranked' | 'transient'> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await fetchHiscoresOnce(rsn);
      return 'reachable';
    } catch (err) {
      const classification = classifyError(err);
      if (classification === 'unranked') return 'unranked';
      if (attempt === 2) return 'transient';
      await new Promise((r) => setTimeout(r, HISCORES_RETRY_DELAY_MS));
    }
  }
  return 'transient';
}

/**
 * Tagged result for a hiscores fetch. WOM-style separation so the caller can react
 * differently to "the account isn't on hiscores" (terminal — flip status to unranked,
 * stop wasting future cron slots) vs "the call broke transiently" (retry next tick).
 */
export type FetchResult =
  | { kind: 'value'; value: number }
  | { kind: 'unranked' }            // 404 from hiscores OR validator rejected the RSN string outright
  | { kind: 'transient' };          // network / timeout / parse error — try again later

function classifyError(err: unknown): 'unranked' | 'transient' {
  const msg = err instanceof Error ? err.message : String(err);
  // osrs-json-hiscores throws "Player not found" on 404 and "RSN contains invalid character"
  // / "RSN must be between..." for client-side validator rejections. All of those mean
  // "do not keep polling this RSN" — flip to unranked and have a human / re-probe fix it.
  if (/not found|invalid character|must be between|must be a string/i.test(msg)) return 'unranked';
  return 'transient';
}

/**
 * Fetch a participant's stat value from OSRS Hiscores. Bounded with a timeout and one
 * retry — distinguishes terminal (`unranked`) from transient failures so the cron can
 * stop chasing dead RSNs.
 */
export async function fetchParticipantStat(
  rsn: string,
  type: 'skill' | 'boss',
  metric: string,
): Promise<FetchResult> {
  let stats: HiscoresSnapshot | null = null;
  let lastClassification: 'unranked' | 'transient' = 'transient';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      stats = await fetchHiscoresOnce(rsn);
      break;
    } catch (err) {
      lastClassification = classifyError(err);
      // Don't retry an unranked / invalid RSN — the second attempt will fail identically
      // because nothing about the input or hiscores presence changes inside 1.5 s.
      if (lastClassification === 'unranked') {
        log.warn('hiscores.unranked', { rsn });
        return { kind: 'unranked' };
      }
      if (attempt === 2) {
        log.warn('hiscores.fail', { rsn, attempt }, err);
        return { kind: 'transient' };
      }
      await new Promise((r) => setTimeout(r, HISCORES_RETRY_DELAY_MS));
    }
  }
  if (!stats) return { kind: 'transient' };

  if (type === 'skill') {
    const xp = stats.skills?.[metric]?.xp;
    if (typeof xp !== 'number') return { kind: 'transient' };
    return { kind: 'value', value: xp };
  }
  const boss = stats.bosses?.[metric];
  // boss.score < 0 means the player is on hiscores but unranked for this boss — that's
  // a real "0 KC" value, not a fetch failure.
  if (!boss || boss.score < 0) return { kind: 'value', value: 0 };
  return { kind: 'value', value: boss.score };
}

export interface LeaderboardEntry {
  rsn: string;
  baselineValue: number | null;
  currentValue: number | null;
  gained: number;
}

/**
 * Propagate an in-game rename into active weekly_participants. Without this, an old RSN
 * stays enrolled (and the hiscores lookup 404s forever), while the next plugin enroll under
 * the new RSN inserts a second row — leaving the clan_member tracked twice with neither
 * row accumulating progress.
 *
 * If both old and new rows exist in a comp, the new row wins; any baseline from the old
 * row is transferred only when the new row hasn't fetched yet. The old row is then deleted.
 * If only the old row exists, we rename it in place.
 */
export async function applyRenameToActiveWeeklyParticipants(
  clanMemberId: number,
  oldRsn: string,
  newRsn: string,
): Promise<void> {
  const oldNorm = normalizeRsn(oldRsn);
  const newNorm = normalizeRsn(newRsn);
  if (oldNorm === newNorm) return;

  const activeComps = await db
    .select({ id: weeklyCompetitions.id })
    .from(weeklyCompetitions)
    .where(eq(weeklyCompetitions.status, 'active'));

  for (const comp of activeComps) {
    const oldRow = await db.query.weeklyParticipants.findFirst({
      where: and(
        eq(weeklyParticipants.competitionId, comp.id),
        eq(weeklyParticipants.rsnNormalized, oldNorm),
      ),
    });
    if (!oldRow) continue;

    const newRow = await db.query.weeklyParticipants.findFirst({
      where: and(
        eq(weeklyParticipants.competitionId, comp.id),
        eq(weeklyParticipants.rsnNormalized, newNorm),
      ),
    });

    if (newRow) {
      if (newRow.baselineValue === null && oldRow.baselineValue !== null) {
        await db
          .update(weeklyParticipants)
          .set({
            baselineValue: oldRow.baselineValue,
            currentValue: oldRow.currentValue,
            lastUpdated: oldRow.lastUpdated,
            clanMemberId,
          })
          .where(eq(weeklyParticipants.id, newRow.id));
      } else if (newRow.clanMemberId !== clanMemberId) {
        await db
          .update(weeklyParticipants)
          .set({ clanMemberId })
          .where(eq(weeklyParticipants.id, newRow.id));
      }
      await db.delete(weeklyParticipants).where(eq(weeklyParticipants.id, oldRow.id));
    } else {
      await db
        .update(weeklyParticipants)
        .set({ rsn: newRsn, rsnNormalized: newNorm, clanMemberId })
        .where(eq(weeklyParticipants.id, oldRow.id));
    }
  }
}

/**
 * Compute a sorted leaderboard from participants.
 */
export function computeLeaderboard(
  participants: { rsn: string; baselineValue: number | null; currentValue: number | null }[],
): LeaderboardEntry[] {
  return participants
    .map((p) => ({
      rsn: p.rsn,
      baselineValue: p.baselineValue,
      currentValue: p.currentValue,
      gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0),
    }))
    .sort((a, b) => b.gained - a.gained);
}
