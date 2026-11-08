/**
 * The shared tile-state language (components/board/TileState): Locked / Open / Done / Closed /
 * Expired, for race tiles (lib/raceRoutes) and mission tiles (lib/eventRules) alike. Pure, so the
 * site's components and the plugin panel builders word a tile's state the same way.
 */

export type TileStateKind = 'locked' | 'open' | 'done' | 'closed' | 'expired';

export interface TileStateView {
  kind: TileStateKind;
  /** The chip word: "Next", "Locked", "Done", "Closed", "Expired", "Live". */
  label: string;
  /** One line under it: "2h 10m left", "Expired 2h ago", "by Alice". */
  detail?: string;
}

/** "3h", "2d", "45m". */
export function shortDuration(ms: number): string {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * A race tile, from the viewer team's route state. Unlocked = open now; Locked = not reachable yet,
 * or not on the road the team took (a route tile is never "Closed" — nobody else took it from you).
 */
export function raceTileState(state: 'done' | 'open' | 'ahead' | 'closed' | null | undefined): TileStateView | null {
  if (state === 'open') return { kind: 'open', label: 'Unlocked' };
  if (state === 'done') return { kind: 'done', label: 'Done' };
  if (state === 'ahead') return { kind: 'locked', label: 'Locked' };
  if (state === 'closed') return { kind: 'locked', label: 'Locked', detail: 'Not on your road' };
  return null;
}

const stamp = (s: string) => Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);

/**
 * A mission (or a drawn task). Display only — the rules live in lib/eventRules and the gate.
 *   Locked   — not announced yet (only for missions shown before their drop; a hidden one shows nothing).
 *   Live     — achievable now (with the time left on a timed one).
 *   Done     — finished by the viewer's team.
 *   Closed   — someone else took it on a first-come-first-served mission (lockout / claim cap), so it
 *              is gone for you. Names the taker only when told who (hidden standings: never).
 *   Expired  — ONLY a timed mission whose timer ran out (or a rotating task that rotated out).
 * `closedAt` alone can mean either a claim or a timer: a timed mission that closed at (or after) the
 * end of its timer expired; anything else that closed was taken.
 */
export function missionTileState(
  m: { revealedAt?: string | null; closedAt?: string | null; expiryHours?: number | null },
  opts: {
    done?: boolean;
    doneBy?: string | null;
    /** Who took it — omit (or null) when standings are hidden or unknown. */
    claimedBy?: string | null;
    /** Someone took it, name withheld (hidden standings) — enough to tell Closed from Expired. */
    claimed?: boolean;
    /** A rotating task: it closes on its timer. */
    timed?: boolean;
    now?: number;
  } = {},
): TileStateView {
  const now = opts.now ?? Date.now();
  if (opts.done) return { kind: 'done', label: 'Done', ...(opts.doneBy ? { detail: `by ${opts.doneBy}` } : {}) };
  if (!m.revealedAt) return { kind: 'locked', label: 'Locked', detail: 'Not announced yet' };
  const start = stamp(m.revealedAt);
  const end = m.expiryHours != null && Number.isFinite(start) ? start + m.expiryHours * 3_600_000 : null;
  if (m.closedAt) {
    const closed = stamp(m.closedAt);
    const ranOut = (end != null && Number.isFinite(closed) && closed >= end - 60_000 && !opts.claimedBy && !opts.claimed) || (opts.timed === true && !opts.claimedBy && !opts.claimed);
    if (ranOut) {
      const at = end != null && end <= now ? end : closed;
      return { kind: 'expired', label: 'Expired', ...(Number.isFinite(at) ? { detail: `Expired ${shortDuration(now - at)} ago` } : {}) };
    }
    return { kind: 'closed', label: 'Closed', ...(opts.claimedBy ? { detail: `by ${opts.claimedBy}` } : {}) };
  }
  if (end != null) {
    if (end <= now) return { kind: 'expired', label: 'Expired', detail: `Expired ${shortDuration(now - end)} ago` };
    return { kind: 'open', label: 'Live', detail: `${shortDuration(end - now)} left` };
  }
  return { kind: 'open', label: 'Live' };
}
