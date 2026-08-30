import { getOfficialStats, parseJsonStats } from 'osrs-json-hiscores';
import { sanitizeRsn } from '@/lib/auth';
import { log } from '@/lib/logger';

export interface HiscoresSnapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

// Bosses that are LIVE on the official hiscores but missing from the pinned
// osrs-json-hiscores release — its parser silently drops activities it doesn't know,
// which zeroes BOTW/boss-tile tracking for them. Keyed by the exact hiscores activity
// name → our BOSSES key. Prune entries once a lib bump ships them; harmless in the
// meantime (the lib's own mapping wins when both know the boss).
const EXTRA_HISCORE_BOSSES: Record<string, string> = {
  'Maggot King': 'maggotKing',
  'Mad Angel': 'madAngel',
};

/**
 * Drop-in replacement for the lib's getStatsByGamemode(rsn) ('main' mode): one fetch of
 * the official JSON endpoint, the lib's own parser, plus a by-name merge of activities
 * this lib release doesn't map yet. Every hiscores read in the app goes through here so
 * a new boss is one EXTRA_HISCORE_BOSSES line away from tracking.
 */
export async function getHiscoresStats(rsn: string): Promise<HiscoresSnapshot> {
  const raw = await getOfficialStats(rsn);
  const parsed = parseJsonStats(raw) as unknown as HiscoresSnapshot;
  const activities = (raw as unknown as { activities?: { name: string; rank: number; score: number }[] }).activities ?? [];
  for (const act of activities) {
    const key = EXTRA_HISCORE_BOSSES[act?.name ?? ''];
    if (key && parsed.bosses && !(key in parsed.bosses)) {
      parsed.bosses[key] = { rank: act.rank, score: act.score };
    }
  }
  return parsed;
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

/**
 * One timeout-bounded hiscores fetch. Strips non-ASCII whitespace first — osrs-json-hiscores'
 * validateRSN regex rejects U+00A0 outright, and legacy rows in the DB still carry it. Throws on
 * failure; callers that want the tagged result use `fetchSnapshotWithRetry`.
 */
export async function fetchHiscoresOnce(rsn: string): Promise<HiscoresSnapshot> {
  const cleanRsn = sanitizeRsn(rsn);
  return await withTimeout(getHiscoresStats(cleanRsn), HISCORES_TIMEOUT_MS, `hiscores(${cleanRsn})`);
}

/**
 * Classify a hiscores fetch failure so callers can react differently to a terminal miss vs a blip.
 * osrs-json-hiscores throws "Player not found" on a 404 and "RSN contains invalid character" /
 * "RSN must be between…" for client-side validator rejections — all of which mean "stop polling this
 * RSN" (flip to unranked, let a re-probe/human fix it). Everything else is transient (retry later).
 */
export function classifyHiscoresError(err: unknown): 'unranked' | 'transient' {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found|invalid character|must be between|must be a string/i.test(msg)) return 'unranked';
  return 'transient';
}

/**
 * Tagged snapshot fetch: one retry with a short backoff, terminal `unranked` short-circuits
 * (a second attempt fails identically inside 1.5 s). The shared fetch primitive for the unified stat
 * sweep and weekly's per-metric wrapper — one hiscores read serves bingo tiles AND weekly.
 */
export type SnapshotFetch =
  | { kind: 'value'; snapshot: HiscoresSnapshot }
  | { kind: 'unranked' }   // 404 from hiscores OR validator rejected the RSN string outright
  | { kind: 'transient' }; // network / timeout / parse error — try again later

export async function fetchSnapshotWithRetry(rsn: string): Promise<SnapshotFetch> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return { kind: 'value', snapshot: await fetchHiscoresOnce(rsn) };
    } catch (err) {
      const classification = classifyHiscoresError(err);
      if (classification === 'unranked') {
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
  return { kind: 'transient' };
}

// Fetches a player's full Hiscores snapshot. Returns null on failure (404, timeout,
// rate-limit) so callers can decide whether to retry, fail soft, or surface to the user.
export async function fetchHiscoresSnapshot(rsn: string): Promise<HiscoresSnapshot | null> {
  try {
    return await withTimeout(
      getHiscoresStats(rsn),
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
