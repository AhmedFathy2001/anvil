// The website Feed & chat page's pass onto the push socket (api/events/[id]/live/ticket → push/server).
// Pure: the route reads the viewer's chatAccess and the board, this decides what the ticket grants.
//
// WHAT A WEB TICKET HEARS (lib/push/hub, rows-only): panel rows for its user by name, its board's room,
// and the team rooms listed here. Team chat lines travel by name (lib/eventChat channelTarget: the
// team's players and the host's staff who read every team, never a staff member who chose "Only my
// team's chat"), so they reach the page through its user. Team ROOMS carry the Feed rows a board
// behind its curtain keeps to one team — and the page's Feed behind the curtain shows staff only their
// own team (lib/liveData liveFeed), so other teams' rooms are granted only on an open board: the
// socket never hears a team the page itself wouldn't show.

import type { ChatAccess } from '@/lib/eventChat';
import type { PushScope } from '@/lib/push/ticket';

export type LiveTicketAccess = Pick<ChatAccess, 'eventId' | 'member' | 'staff' | 'ownTeamOnly' | 'solo' | 'teamId'>;

/** The ticket's scope for this viewer, or null when they may not read the board at all. */
export function liveTicketScope(access: LiveTicketAccess | null, userId: number, board: { teamIds: number[]; hidden: boolean }): PushScope | null {
  if (!access?.member) return null;
  // The same "every team" chatPaneState uses for the team chips, narrowed by the curtain (see above).
  const everyTeam = access.staff && !access.ownTeamOnly && !access.solo && !board.hidden;
  const teamIds = everyTeam ? board.teamIds.filter((t) => t !== access.teamId) : [];
  return {
    userId,
    eventIds: [access.eventId],
    teamId: access.teamId,
    rows: true,
    web: true,
    ...(teamIds.length ? { teamIds } : {}),
  };
}
