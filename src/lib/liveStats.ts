import { db } from '@/db';
import { clanRoster, eventParticipants } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { parsePluginStats } from '@/lib/pluginStats';
import { effectiveSnapshotJson } from '@/lib/statTracking';

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
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const rows = await db
    .select({ id: clanRoster.id, liveStats: clanRoster.liveStats })
    .from(clanRoster)
    .where(inArray(clanRoster.id, ids));
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

/**
 * Each event player's CURRENT stats as one hiscores-shaped JSON: the stored hiscores read raised by
 * the member's live plugin overlay (statTracking.effectiveSnapshotJson), or the pinned `frozenStats`
 * for a benched player. Stats posts and the stats page diff against this rather than `cachedStats`
 * alone — a plugin user's hiscores copy is only reconciled every few hours, so reading it directly
 * would leave their XP and KC flat between sweeps while their tiles moved.
 */
export async function effectiveStatsForPlayers(
  players: Array<Pick<typeof eventParticipants.$inferSelect, 'id' | 'clanMemberId' | 'statsSnapshot' | 'cachedStats' | 'frozenAt' | 'frozenStats'>>,
): Promise<Map<number, string | null>> {
  const live = await liveStatsForMembers(players.map((p) => p.clanMemberId));
  const out = new Map<number, string | null>();
  for (const p of players) {
    if (p.frozenAt) {
      out.set(p.id, p.frozenStats ?? p.cachedStats);
      continue;
    }
    const overlay = (p.clanMemberId != null && live.get(p.clanMemberId)) || {};
    out.set(p.id, effectiveSnapshotJson(p.cachedStats, p.statsSnapshot, overlay) ?? p.cachedStats);
  }
  return out;
}
