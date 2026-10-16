// Does the plugin's account of an event add up?
//
// Every kill credit on a bingo board is the client's word: the plugin saw a kill and said so, and a
// forged client can say so too. Nothing in a submission can prove otherwise, but two things outside
// it can catch a lie after the fact:
//
//   1. THE HISCORES. Boss KC is on Jagex's hiscores, which the stats sweep reads on its own. A player
//      credited with more kills of a boss than their hiscores KC rose by since the event started
//      claimed kills that did not happen. (Plugin pushes never write the hiscores snapshot — see
//      lib/roster saveStatSnapshot — so this compares against Jagex alone.)
//   2. THE CLOCK. A boss has a fastest realistic kill time (data/balanceRates.json). More kills in an
//      hour than that allows, by a wide margin, is not a good hour — it is a script.
//
// Both FLAG, never refuse. The hiscores lag (a session in progress has not posted yet), a rate table is
// a rough guide, and either can be wrong about one honest player — so this hands staff a short list of
// who to look at, with the numbers, and the decision stays theirs.
//
// Pure: no database. The route loads the rows; this decides what is suspicious.

import { bossKeyForName } from '@/lib/pluginStats';
import { parseStamp } from '@/lib/dbTime';
import rates from '@/data/balanceRates.json';

/** A credited submission: who claimed it, on which tile, how many, when. */
export interface CreditRow {
  playerId: number;
  tileId: number;
  amount: number;
  createdAt: string;
}

export interface KillTile {
  id: number;
  title: string;
  /** JSON array of NPC names (tiles.target_npcs). */
  targetNpcs: string | null;
}

export interface PlayerStats {
  playerId: number;
  rsn: string;
  /** Hiscores read at the event start (event_participants.stats_snapshot). */
  baseline: string | null;
  /** Latest hiscores read (account_stat_snapshots), and when it was polled. */
  current: string | null;
  polledAt: string | null;
}

export interface IntegrityFlag {
  kind: 'hiscores' | 'rate';
  playerId: number;
  rsn: string;
  tileId: number;
  tileTitle: string;
  /** Kills the plugin credited (in the window the check covers). */
  credited: number;
  /** What the outside evidence allows: the hiscores gain, or the most an hour could hold. */
  allowed: number;
  detail: string;
}

/** Kills the hiscores have not had time to show: a session in progress, the sweep's own interval. */
const HISCORES_LAG_MS = 60 * 60_000;
/** Below this many surplus kills a mismatch is noise (a death mid-kill, a raid counted twice). */
const MIN_SURPLUS = 3;
/** And as a share of what was credited. */
const MIN_SURPLUS_FRACTION = 0.2;
/** How much faster than the table's FAST kill time we tolerate before calling it impossible. */
const RATE_HEADROOM = 2;
const HOUR_MS = 60 * 60_000;

/** Hiscores boss keys for every NPC on the tile, or null when any NPC is not a hiscores boss. */
export function bossKeysOf(tile: KillTile): string[] | null {
  let npcs: unknown;
  try {
    npcs = tile.targetNpcs ? JSON.parse(tile.targetNpcs) : null;
  } catch {
    return null;
  }
  if (!Array.isArray(npcs) || npcs.length === 0) return null;
  const keys = new Set<string>();
  for (const n of npcs) {
    if (typeof n !== 'string') return null;
    const key = bossKeyForName(n);
    if (!key) return null; // a chicken is not on the hiscores, and neither is a mixed tile's total
    keys.add(key);
  }
  return [...keys];
}

/** Summed boss KC for these keys in one hiscores read, or null when the read lacks any of them. */
export function kcOf(snapshotJson: string | null, keys: string[]): number | null {
  if (!snapshotJson) return null;
  let snap: { bosses?: Record<string, { score?: number }> };
  try {
    snap = JSON.parse(snapshotJson);
  } catch {
    return null;
  }
  let total = 0;
  for (const k of keys) {
    const score = snap.bosses?.[k]?.score;
    // Absent, or -1 (unranked: under the hiscores threshold, KC unknown) — no honest comparison.
    if (typeof score !== 'number' || score < 0) return null;
    total += score;
  }
  return total;
}

/** Fastest believable seconds per kill for a tile's NPCs (the table's FAST value, else generic). */
export function fastestKillSeconds(tile: KillTile): number {
  const activities = rates.activities as Record<string, { killSeconds?: number[] }>;
  let npcs: string[] = [];
  try {
    npcs = tile.targetNpcs ? (JSON.parse(tile.targetNpcs) as string[]) : [];
  } catch {
    /* fall through to generic */
  }
  const known = npcs
    .map((n) => activities[String(n).toLowerCase()]?.killSeconds?.[0])
    .filter((s): s is number => typeof s === 'number' && s > 0);
  // A tile of several NPCs is as fast as its fastest.
  return known.length > 0 ? Math.min(...known) : rates.generic.bossKillSeconds[0];
}

/** Most kills inside any 60-minute window. */
export function busiestHour(rows: { amount: number; at: number }[]): number {
  const sorted = [...rows].sort((a, b) => a.at - b.at);
  let best = 0;
  let sum = 0;
  let lo = 0;
  for (let hi = 0; hi < sorted.length; hi++) {
    sum += sorted[hi].amount;
    while (sorted[hi].at - sorted[lo].at >= HOUR_MS) sum -= sorted[lo++].amount;
    best = Math.max(best, sum);
  }
  return best;
}

export function checkCreditIntegrity(opts: {
  tiles: KillTile[];
  credits: CreditRow[];
  players: PlayerStats[];
}): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];
  const byPlayer = new Map(opts.players.map((p) => [p.playerId, p]));

  for (const tile of opts.tiles) {
    const keys = bossKeysOf(tile);
    if (!keys) continue; // only boss tiles: the hiscores and the rate table both speak for bosses

    const perPlayer = new Map<number, { amount: number; at: number }[]>();
    for (const c of opts.credits) {
      if (c.tileId !== tile.id) continue;
      const at = parseStamp(c.createdAt);
      if (at == null) continue;
      const list = perPlayer.get(c.playerId) ?? [];
      list.push({ amount: c.amount, at });
      perPlayer.set(c.playerId, list);
    }

    for (const [playerId, rows] of perPlayer) {
      const player = byPlayer.get(playerId);
      const rsn = player?.rsn ?? `#${playerId}`;

      // 1. The hiscores: only kills old enough that the last poll should have seen them.
      const polled = parseStamp(player?.polledAt ?? null);
      const before = kcOf(player?.baseline ?? null, keys);
      const after = kcOf(player?.current ?? null, keys);
      if (polled != null && before != null && after != null) {
        const settled = rows.filter((r) => r.at <= polled - HISCORES_LAG_MS).reduce((s, r) => s + r.amount, 0);
        const gained = Math.max(0, after - before);
        const surplus = settled - gained;
        if (surplus >= MIN_SURPLUS && surplus >= settled * MIN_SURPLUS_FRACTION) {
          flags.push({
            kind: 'hiscores',
            playerId,
            rsn,
            tileId: tile.id,
            tileTitle: tile.title,
            credited: settled,
            allowed: gained,
            detail: `Credited ${settled} kills; their hiscores KC rose by ${gained} since the start.`,
          });
        }
      }

      // 2. The clock.
      const perHourCap = Math.floor((3600 / fastestKillSeconds(tile)) * RATE_HEADROOM);
      const peak = busiestHour(rows);
      if (peak > perHourCap) {
        flags.push({
          kind: 'rate',
          playerId,
          rsn,
          tileId: tile.id,
          tileTitle: tile.title,
          credited: peak,
          allowed: perHourCap,
          detail: `${peak} kills inside one hour; even a fast player manages about ${Math.floor(perHourCap / RATE_HEADROOM)}.`,
        });
      }
    }
  }
  return flags;
}
