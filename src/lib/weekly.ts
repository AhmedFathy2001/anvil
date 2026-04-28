import { db } from '@/db';
import { clanMembers, players, weeklyParticipants } from '@/db/schema';
import { isNull } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';
import { findOrCreateClanMember } from '@/lib/clan';
import { normalizeRsn } from '@/lib/auth';
import { log } from '@/lib/logger';

interface HiscoresSnapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

/**
 * Enroll every active clan member into a competition.
 * Skips members who have left the clan. Also pulls in any player names from
 * historical events that don't yet have a clan_members row, auto-registering them
 * (as guests).
 */
export async function enrollAllPlayers(competitionId: number) {
  // Source of truth: active clan members
  const activeMembers = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn })
    .from(clanMembers)
    .where(isNull(clanMembers.leftAt));

  const participantPayload = activeMembers.map((m) => ({
    competitionId,
    clanMemberId: m.id,
    rsn: m.rsn,
    rsnNormalized: normalizeRsn(m.rsn),
  }));

  // Fallback: pull any legacy player names not yet in clan_members, create guest rows.
  const orphanPlayers = await db
    .select({ name: players.name })
    .from(players)
    .where(isNull(players.clanMemberId));

  const seen = new Set(activeMembers.map((m) => normalizeRsn(m.rsn)));
  for (const p of orphanPlayers) {
    const normalized = normalizeRsn(p.name);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const memberId = await findOrCreateClanMember(p.name);
    participantPayload.push({
      competitionId,
      clanMemberId: memberId,
      rsn: p.name,
      rsnNormalized: normalized,
    });
  }

  let enrolled = 0;
  for (const row of participantPayload) {
    try {
      await db.insert(weeklyParticipants).values(row).onConflictDoNothing();
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
