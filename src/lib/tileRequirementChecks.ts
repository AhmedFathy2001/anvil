import { readActivityRank } from '@/lib/hiscoresActivities';
import { statKeys, statLabel } from '@/lib/tileKinds';

// The per-player verdicts behind lib/tileRequirements' `check` names — pure, so every wording and
// threshold is tested without a database. lib/tileReadiness loads the viewer's facts and calls these.
//
// A verdict is about the VIEWING player only. 'problem' is shown prominently on the tile ("you
// haven't synced your collection log yet"); 'ok' quietly ticks the requirement; 'unknown' means the
// site can't tell, and is shown muted — never as a warning, because not knowing isn't the player's
// fault.

export type CheckStatus = 'ok' | 'problem' | 'unknown';

export interface CheckVerdict {
  status: CheckStatus;
  text: string;
}

/** A plugin last seen longer ago than this reads as "not seen lately". */
export const PLUGIN_RECENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Numeric version parts ("1.13.3" → [1, 13, 3]); null when it doesn't start with a number. */
export function versionParts(v: string | null | undefined): number[] | null {
  const m = /^\s*(\d+(?:\.\d+)*)/.exec(v ?? '');
  return m ? m[1].split('.').map(Number) : null;
}

/** Negative when a < b, 0 when equal, positive when a > b; missing parts read as 0. Null if unparseable. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number | null {
  const pa = versionParts(a);
  const pb = versionParts(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface SeenPlugin {
  version: string;
  seenAt: string;
}

function daysAgo(iso: string, nowMs: number): number | null {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.max(0, Math.floor((nowMs - at) / DAY_MS)) : null;
}

/** Has the plugin played this character lately? */
export function pluginSeenVerdict(seen: SeenPlugin | null, nowMs: number): CheckVerdict {
  if (!seen) return { status: 'unknown', text: 'We haven’t seen the Anvil plugin on this character yet.' };
  const days = daysAgo(seen.seenAt, nowMs);
  if (days != null && days > PLUGIN_RECENT_DAYS) {
    return { status: 'unknown', text: `The Anvil plugin last checked in ${days} days ago.` };
  }
  return { status: 'ok', text: `Anvil plugin ${seen.version} seen${days === 0 ? ' today' : days === 1 ? ' yesterday' : days != null ? ` ${days} days ago` : ''}.` };
}

/** Is the plugin this character last played on new enough for this tile? */
export function pluginVersionVerdict(seen: SeenPlugin | null, min: string): CheckVerdict {
  if (!seen) return { status: 'unknown', text: 'We haven’t seen the Anvil plugin on this character yet.' };
  const cmp = compareVersions(seen.version, min);
  if (cmp == null) return { status: 'unknown', text: `Can’t tell whether plugin ${seen.version} is new enough.` };
  if (cmp < 0) {
    return {
      status: 'problem',
      text: `Your Anvil plugin (${seen.version}) is too old for this tile. Slots still count, but the tile waits for an uploaded screenshot to complete. ${min} or newer takes the screenshots for you.`,
    };
  }
  return { status: 'ok', text: `Anvil plugin ${seen.version} is new enough.` };
}

/** Has this character synced their collection log (whole-page tiles need it from before the start)? */
export function clogSyncedVerdict(synced: boolean): CheckVerdict {
  if (!synced) return { status: 'problem', text: 'You haven’t synced your collection log yet. Sync it in the plugin before the event starts.' };
  return { status: 'ok', text: 'Collection log synced.' };
}

/**
 * New-slot tiles: how much of the tile's item pool the player already had when the event started.
 * `pool` null = any item counts (nothing to say beyond the rule itself).
 */
export function clogOwnedSlotsVerdict(args: { synced: boolean; pool: ReadonlySet<number> | null; ownedAtStart: ReadonlySet<number> }): CheckVerdict | null {
  if (!args.pool) return null;
  if (!args.synced) return { status: 'unknown', text: 'Sync your collection log in the plugin to see which of these items you already have.' };
  const had = [...args.pool].filter((id) => args.ownedAtStart.has(id)).length;
  const total = args.pool.size;
  if (total === 0) return null;
  if (had >= total) return { status: 'problem', text: 'You already had every item this tile counts, so none can count for you.' };
  if (had === 0) return { status: 'ok', text: `None of the ${total} items were in your log at the start — any of them can count.` };
  return { status: 'ok', text: `You already had ${had} of the ${total} items; the other ${total - had} can still count for you.` };
}

/** Whole-page tiles: pages the player had already finished at the start can't count for them. */
export function clogOwnedPagesVerdict(args: { synced: boolean; groups: { name: string; items: number[] }[]; ownedAtStart: ReadonlySet<number> }): CheckVerdict | null {
  if (args.groups.length === 0) return null;
  if (!args.synced) return { status: 'unknown', text: 'Sync your collection log in the plugin so the site knows what you already have.' };
  const done = args.groups.filter((g) => g.items.length > 0 && g.items.every((id) => args.ownedAtStart.has(id))).map((g) => g.name);
  if (done.length === 0) return { status: 'ok', text: 'None of these pages were already finished in your log.' };
  const names = done.length <= 3 ? done.join(', ') : `${done.length} of these pages`;
  return {
    status: 'problem',
    text: `You’d already finished ${names} before the event, so ${done.length === 1 ? 'it' : 'they'} can’t count for you.`,
  };
}

type Snapshot = { skills?: Record<string, { rank?: number }>; bosses?: Record<string, { rank?: number }> } & Record<string, unknown>;

/** The hiscores rank for one stat key, or null when unranked / not in the snapshot. */
export function rankFor(snapshot: Snapshot, statType: string | null | undefined, key: string): number | null {
  const section = statType === 'skill' ? snapshot.skills : snapshot.bosses;
  const hit = section?.[key]?.rank;
  if (typeof hit === 'number') return hit > 0 ? hit : null;
  // Minigames, clues and the like live off the bosses block (lib/hiscoresActivities paths).
  return readActivityRank(snapshot, key);
}

/** Is this character on the hiscores for the tile's stat(s)? Composite tiles need any one of them. */
export function hiscoresRankedVerdict(args: {
  accountStatus: string | null | undefined;
  snapshot: Snapshot | null;
  statType: string | null | undefined;
  trackedStat: string | null | undefined;
}): CheckVerdict {
  const label = statLabel(args.trackedStat, args.statType) || 'this';
  if (args.accountStatus === 'unranked') {
    return { status: 'problem', text: 'This character isn’t on the hiscores at all, so the tile can’t see your progress.' };
  }
  if (!args.snapshot) return { status: 'unknown', text: 'No hiscores reading for you yet.' };
  const keys = statKeys(args.trackedStat);
  if (keys.length === 0) return { status: 'unknown', text: 'No hiscores reading for you yet.' };
  const ranked = keys.some((k) => rankFor(args.snapshot!, args.statType, k) != null);
  if (!ranked) return { status: 'problem', text: `You’re not ranked on the hiscores for ${label} yet, so your progress there isn’t seen.` };
  return { status: 'ok', text: `Ranked on the hiscores for ${label}.` };
}
