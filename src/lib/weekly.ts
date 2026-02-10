import { db } from '@/db';
import { players, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';

interface HiscoresSnapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

/**
 * Enroll all unique RSNs from the players table into a competition.
 * Uses onConflictDoNothing to skip already-enrolled players.
 */
export async function enrollAllPlayers(competitionId: number) {
  const allPlayers = await db.select({ name: players.name }).from(players);

  // Deduplicate RSNs (case-insensitive)
  const seen = new Set<string>();
  const uniqueRsns: string[] = [];
  for (const p of allPlayers) {
    const lower = p.name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueRsns.push(p.name);
    }
  }

  if (uniqueRsns.length === 0) return 0;

  // Insert in batches
  let enrolled = 0;
  for (const rsn of uniqueRsns) {
    try {
      await db.insert(weeklyParticipants).values({
        competitionId,
        rsn,
      }).onConflictDoNothing();
      enrolled++;
    } catch {
      // Skip on error
    }
  }

  return enrolled;
}

/**
 * Fetch a participant's stat value from OSRS Hiscores.
 * Falls back to WOM API if hiscores fail.
 */
export async function fetchParticipantStat(
  rsn: string,
  type: 'skill' | 'boss',
  metric: string,
): Promise<number | null> {
  // Try OSRS Hiscores first
  try {
    const stats = await getStatsByGamemode(rsn) as HiscoresSnapshot;
    if (type === 'skill') {
      const skill = stats.skills?.[metric];
      return skill?.xp ?? null;
    } else {
      const boss = stats.bosses?.[metric];
      if (!boss || boss.score < 0) return 0;
      return boss.score;
    }
  } catch {
    // Hiscores failed, try WOM fallback
  }

  // WOM fallback
  try {
    const encodedRsn = encodeURIComponent(rsn);
    const res = await fetch(`https://api.wiseoldman.net/v2/players/${encodedRsn}`, {
      headers: { 'User-Agent': 'osrs-bingo-tracker' },
    });
    if (!res.ok) return null;
    const data = await res.json();

    if (type === 'skill') {
      const value = data?.latestSnapshot?.data?.skills?.[metric]?.experience;
      return typeof value === 'number' ? value : null;
    } else {
      const value = data?.latestSnapshot?.data?.bosses?.[metric]?.kills;
      if (typeof value !== 'number' || value < 0) return 0;
      return value;
    }
  } catch {
    return null;
  }
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
