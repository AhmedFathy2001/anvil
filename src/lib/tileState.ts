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

/** A race tile, from the viewer team's route state. */
export function raceTileState(state: 'done' | 'open' | 'ahead' | 'closed' | null | undefined): TileStateView | null {
  if (state === 'open') return { kind: 'open', label: 'Next' };
  if (state === 'done') return { kind: 'done', label: 'Done' };
  if (state === 'ahead') return { kind: 'locked', label: 'Locked' };
  if (state === 'closed') return { kind: 'closed', label: 'Closed' };
  return null;
}

/**
 * A mission tile. Display only — the mission rules themselves live in lib/eventRules and the
 * completion gate. Locked = not announced; Open = live (time left when it expires); Done = finished
 * by the viewer's team (or claimed, when another team's claim closed it); Expired = closed unclaimed.
 */
export function missionTileState(
  m: { revealedAt?: string | null; closedAt?: string | null; expiryHours?: number | null },
  opts: { done?: boolean; doneBy?: string | null; claimedBy?: string | null; now?: number } = {},
): TileStateView {
  const now = opts.now ?? Date.now();
  if (opts.done) return { kind: 'done', label: 'Done', ...(opts.doneBy ? { detail: `by ${opts.doneBy}` } : {}) };
  if (!m.revealedAt) return { kind: 'locked', label: 'Locked', detail: 'Not announced yet' };
  if (m.closedAt) {
    if (opts.claimedBy) return { kind: 'closed', label: 'Claimed', detail: `by ${opts.claimedBy}` };
    const at = Date.parse(m.closedAt.includes('T') ? m.closedAt : `${m.closedAt.replace(' ', 'T')}Z`);
    return { kind: 'expired', label: 'Expired', ...(Number.isFinite(at) ? { detail: `Expired ${shortDuration(now - at)} ago` } : {}) };
  }
  if (m.expiryHours != null) {
    const start = Date.parse(m.revealedAt.includes('T') ? m.revealedAt : `${m.revealedAt.replace(' ', 'T')}Z`);
    const end = start + m.expiryHours * 3_600_000;
    if (Number.isFinite(end)) {
      if (end <= now) return { kind: 'expired', label: 'Expired', detail: `Expired ${shortDuration(now - end)} ago` };
      return { kind: 'open', label: 'Live', detail: `${shortDuration(end - now)} left` };
    }
  }
  return { kind: 'open', label: 'Live' };
}
