import { getStatsByGamemode } from 'osrs-json-hiscores';
import { log } from '@/lib/logger';

export interface HiscoresSnapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

const HISCORES_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${tag} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// Fetches a player's full Hiscores snapshot. Returns null on failure (404, timeout,
// rate-limit) so callers can decide whether to retry, fail soft, or surface to the user.
export async function fetchHiscoresSnapshot(rsn: string): Promise<HiscoresSnapshot | null> {
  try {
    return await withTimeout(
      getStatsByGamemode(rsn) as Promise<HiscoresSnapshot>,
      HISCORES_TIMEOUT_MS,
      `hiscores(${rsn})`,
    );
  } catch (err) {
    log.warn('hiscores.fail', { rsn }, err);
    return null;
  }
}

// Reduces a snapshot to {skillName: xp} for delta comparison. Strips bosses and ranks.
export function snapshotXpMap(snapshot: HiscoresSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [skill, data] of Object.entries(snapshot.skills || {})) {
    if (data && typeof data.xp === 'number' && data.xp >= 0) {
      out[skill] = data.xp;
    }
  }
  return out;
}

// Returns the largest XP gain in any single skill between two snapshots, with the skill name.
// Used by stat-delta verification: any single skill gaining ≥minDelta proves account control.
export function bestSkillDelta(
  baseline: Record<string, number>,
  current: Record<string, number>,
): { skill: string; delta: number } | null {
  let best: { skill: string; delta: number } | null = null;
  for (const [skill, currentXp] of Object.entries(current)) {
    const baseXp = baseline[skill];
    if (typeof baseXp !== 'number') continue;
    const delta = currentXp - baseXp;
    if (delta > 0 && (!best || delta > best.delta)) {
      best = { skill, delta };
    }
  }
  return best;
}
