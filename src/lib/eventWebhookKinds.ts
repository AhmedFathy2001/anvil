// What an event webhook can subscribe to. Pure (no db), so the admin panel and the tests read the
// same list the fan-out filters on (lib/eventWebhooks).
//
// TEAM kinds are about one team — a drop, a tile, a win — and a team-scoped hook only gets its own
// team's. EVENT kinds are about the whole board (it started, a mission dropped) and reach every hook
// that asked for them, team hooks included, so a team channel can still hear "the event has begun".

export const EVENT_POST_KINDS = [
  { key: 'drops', team: true, label: 'Drops & progress', help: 'Every tracked drop, kill or count as it’s submitted (and when one is removed).' },
  { key: 'completions', team: true, label: 'Tile completions', help: 'A team finishing a tile.' },
  { key: 'win', team: true, label: 'Board win', help: 'A team clearing the whole board.' },
  { key: 'announcements', team: false, label: 'Reveals & missions', help: 'Tiles revealed, missions announced or claimed, mission prizes, the board being revealed.' },
  { key: 'draft', team: false, label: 'Draft', help: 'The draft starting, and the final rosters.' },
  { key: 'lifecycle', team: false, label: 'Start & end', help: 'The event starting (with the starting shot), ending, or being ended early.' },
] as const;

export type EventPostKind = (typeof EVENT_POST_KINDS)[number]['key'];

const KEYS = new Set<string>(EVENT_POST_KINDS.map((k) => k.key));
const TEAM_KINDS = new Set<string>(EVENT_POST_KINDS.filter((k) => k.team).map((k) => k.key));

export function isEventPostKind(v: unknown): v is EventPostKind {
  return typeof v === 'string' && KEYS.has(v);
}

/** A stored kinds cell → the kinds it names (unknown ones dropped). */
export function parseEventPostKinds(raw: string | null | undefined): EventPostKind[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter(isEventPostKind) : [];
  } catch {
    return [];
  }
}

/**
 * Does a hook get this post? It must have asked for the kind; a team-scoped hook additionally gets a
 * TEAM kind only for its own team. A team post that doesn't say which team (shouldn't happen) goes
 * to whole-event hooks only.
 */
export function hookWants(
  hook: { teamId: number | null; kinds: EventPostKind[] },
  post: { kind: EventPostKind; teamId?: number | null },
): boolean {
  if (!hook.kinds.includes(post.kind)) return false;
  if (hook.teamId == null || !TEAM_KINDS.has(post.kind)) return true;
  return post.teamId != null && post.teamId === hook.teamId;
}
