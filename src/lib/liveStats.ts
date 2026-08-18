import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { parsePluginStats } from '@/lib/pluginStats';

/**
 * The member-scoped real-time overlay — the plugin's absolute boss-KC / skill-XP pushes, stored on
 * `clan_members.live_stats` as a flat {hiscoresKey: absoluteValue} map. It's read as
 * max(hiscores, live) by BOTH bingo stat tiles and weekly SOTW/BOTW, and pruned by the unified stat
 * sweep as hiscores catch up. Keyed on the member (not a per-event player row) so it survives renames
 * and works with no active bingo event. Replaces the per-event `eventParticipants.plugin_stats`.
 */

/**
 * Load the live overlay for a set of clan members as {clanMemberId -> {key: absVal}}. The single
 * place `clan_members.live_stats` is read from. Members absent from the result (null clanMemberId,
 * guests, or no push yet) simply have no overlay — callers default to {}.
 */
export async function liveStatsForMembers(
  clanMemberIds: Array<number | null | undefined>,
): Promise<Map<number, Record<string, number>>> {
  const ids = Array.from(new Set(clanMemberIds.filter((x): x is number => typeof x === 'number')));
  const out = new Map<number, Record<string, number>>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: clanMembers.id, liveStats: clanMembers.liveStats })
    .from(clanMembers)
    .where(inArray(clanMembers.id, ids));
  for (const r of rows) out.set(r.id, parsePluginStats(r.liveStats));
  return out;
}

/**
 * Parse `clan_members.live_stat_key_times` — a {hiscoresKey -> ISO timestamp} map stamped by the live
 * push ONLY when a key's value rose. Used by "Active now" to tell that a member is grinding a SPECIFIC
 * stat tile right now (its key rose within the window), not every tile they've ever progressed. Tolerant:
 * a null/garbage blob yields {}.
 */
export function parseStatKeyTimes(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
