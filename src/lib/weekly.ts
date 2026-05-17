import { db } from '@/db';
import { clanMembers, settings, weeklyParticipants } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';
import { normalizeRsn } from '@/lib/auth';
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
  const whereClause = trackGuests
    ? isNull(clanMembers.leftAt)
    : and(isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0));

  const activeMembers = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn })
    .from(clanMembers)
    .where(whereClause);

  let enrolled = 0;
  for (const m of activeMembers) {
    try {
      await db
        .insert(weeklyParticipants)
        .values({
          competitionId,
          clanMemberId: m.id,
          rsn: m.rsn,
          rsnNormalized: normalizeRsn(m.rsn),
        })
        .onConflictDoNothing();
      enrolled++;
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
  return (await withTimeout(
    getStatsByGamemode(rsn) as Promise<HiscoresSnapshot>,
    HISCORES_TIMEOUT_MS,
    `hiscores(${rsn})`,
  ));
}

/**
 * Fetch a participant's stat value from OSRS Hiscores. Bounded with a timeout
 * and one retry — on persistent failure returns null so the cron tick moves on
 * and picks the participant back up on its next pass.
 */
export async function fetchParticipantStat(
  rsn: string,
  type: 'skill' | 'boss',
  metric: string,
): Promise<number | null> {
  let stats: HiscoresSnapshot | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      stats = await fetchHiscoresOnce(rsn);
      break;
    } catch (err) {
      if (attempt === 2) {
        log.warn('hiscores.fail', { rsn, attempt }, err);
        return null;
      }
      await new Promise((r) => setTimeout(r, HISCORES_RETRY_DELAY_MS));
    }
  }
  if (!stats) return null;

  if (type === 'skill') {
    const skill = stats.skills?.[metric];
    return skill?.xp ?? null;
  }
  const boss = stats.bosses?.[metric];
  if (!boss || boss.score < 0) return 0;
  return boss.score;
}

export interface LeaderboardEntry {
  rsn: string;
  baselineValue: number | null;
  currentValue: number | null;
  gained: number;
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
