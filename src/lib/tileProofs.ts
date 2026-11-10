import { loadRaceVeil, raceHideOn } from '@/lib/raceHideAheadDb';
import { raceSeenFor, raceTileHidden } from '@/lib/raceHideAhead';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

import { db } from '@/db';
import { eventParticipants, submissions, teams, tiles, users } from '@/db/schema';
import { clanGrant } from '@/lib/clanGrants';
import { parseStamp } from '@/lib/dbTime';
import { eventEditLocked, type LockableEvent } from '@/lib/eventLock';
import { canDeleteProof, isProofModerator, proofDeleterRole, type HostGrant, type ProofDeleteCheck } from '@/lib/proofAccess';
import { isManagedMediaUrl } from '@/lib/storage';
import { removeSubmission } from '@/lib/submissionRemoval';
import { teamManagerIds } from '@/lib/teamStaff';

// A tile's proofs for the plugin's side panel (lib/pluginUi proofsUi) and removing one from there.
//
// WHOSE proofs: the viewer's own team's. Host-clan moderators and up see every team's — they can
// remove any of them on the web already, and they are standings staff, so a hidden scoreboard hides
// nothing from them. Anybody else (a spectator with no team) sees none.
//
// Who may remove one is lib/proofAccess — the web's own rule.

export interface ProofViewer {
  userId: number | null;
  /** The viewer's player row on this event (the character the token plays), when they have one. */
  playerId: number | null;
  teamId: number | null;
}

export interface TileProof {
  id: number;
  teamId: number;
  teamName: string | null;
  who: string | null;
  credit: string | null;
  /** ISO. */
  at: string;
  amount: number;
  imageUrl: string | null;
  canDelete: boolean;
}

type EventRow = LockableEvent & { id: number; clanId: number; format?: string | null; rules?: string | null };

async function viewerGrant(event: EventRow, userId: number | null): Promise<HostGrant | null> {
  return userId == null ? null : clanGrant(event.clanId, userId);
}

/** The tile, when it is on this event, and the parts of a combo (whose proofs are the combo's). */
async function tileIds(eventId: number, tileId: number): Promise<{ tile: typeof tiles.$inferSelect; ids: number[] } | null> {
  // clan-scope: global -- the event was resolved for this caller already; the tile must be on it.
  const rows = await db.select().from(tiles).where(and(eq(tiles.eventId, eventId), or(eq(tiles.id, tileId), eq(tiles.parentTileId, tileId))));
  const tile = rows.find((t) => t.id === tileId);
  return tile ? { tile, ids: rows.map((t) => t.id) } : null;
}

/**
 * The newest `limit` proofs on a tile the viewer may see, newest first, plus whether there are more.
 * Each says whether this viewer may remove it.
 */
export async function listTileProofs(
  event: EventRow,
  tileId: number,
  viewer: ProofViewer,
  limit: number,
): Promise<{ proofs: TileProof[]; more: boolean; allTeams: boolean }> {
  const grant = await viewerGrant(event, viewer.userId);
  const allTeams = isProofModerator(grant);
  const none = { proofs: [], more: false, allTeams };
  if (!allTeams && viewer.teamId == null) return none;
  const found = await tileIds(event.id, tileId);
  if (!found) return none;
  // A race tile this viewer only sees as a locked "?" (lib/raceHideAhead) has no proofs to show:
  // a screenshot says what the tile is. Proof moderators see through while only players are hidden from.
  const raceEvent = { ...event, format: event.format ?? null, rules: event.rules ?? null };
  if (raceHideOn(raceEvent)) {
    const veil = await loadRaceVeil(raceEvent);
    const seen = allTeams && veil?.mode === 'players'
      ? null
      : raceSeenFor(veil, viewer.teamId != null ? { teamIds: [viewer.teamId] } : allTeams ? 'staff' : { teamIds: [] });
    if (raceTileHidden(veil, seen, { id: tileId })) return none;
  }

  const where = [inArray(submissions.tileId, found.ids)];
  if (!allTeams) where.push(eq(submissions.teamId, viewer.teamId!));
  const rows = await db
    .select()
    .from(submissions)
    .where(and(...where))
    // Newest first by id: created_at holds two text formats (lib/dbTime) that don't sort together.
    .orderBy(desc(submissions.id))
    .limit(limit + 1);
  const shown = rows.slice(0, limit);

  const people = [...new Set(shown.flatMap((r) => [r.playerId, r.creditPlayerId]).filter((x): x is number => x != null))];
  const teamIds = [...new Set(shown.map((r) => r.teamId))];
  const [names, teamRows, managers] = await Promise.all([
    people.length
      ? db.select({ id: eventParticipants.id, name: eventParticipants.name }).from(eventParticipants).where(inArray(eventParticipants.id, people))
      : Promise.resolve([]),
    teamIds.length ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds)) : Promise.resolve([]),
    Promise.all(teamIds.map(async (t) => [t, await teamManagerIds(t)] as const)).then((m) => new Map(m)),
  ]);
  const name = new Map(names.map((n) => [n.id, n.name]));
  const teamName = new Map(teamRows.map((t) => [t.id, t.name]));
  const locked = eventEditLocked(event);

  return {
    allTeams,
    more: rows.length > limit,
    proofs: shown.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      teamName: teamName.get(r.teamId) ?? null,
      who: r.playerId != null ? name.get(r.playerId) ?? null : null,
      credit: r.creditPlayerId != null && r.creditPlayerId !== r.playerId ? name.get(r.creditPlayerId) ?? null : null,
      at: new Date(parseStamp(r.createdAt) ?? Date.now()).toISOString(),
      amount: r.amount,
      imageUrl: r.imageUrl && isManagedMediaUrl(r.imageUrl) ? r.imageUrl : null,
      canDelete:
        !locked &&
        canDeleteProof({
          userId: viewer.userId,
          playerIds: viewer.playerId != null ? [viewer.playerId] : [],
          managers: managers.get(r.teamId) ?? new Set(),
          grant,
          submission: r,
        }),
    })),
  };
}

/**
 * Remove a proof from the panel. The rule is checked here against the database, whatever the panel
 * drew: a client can name any id. Null on success, else what to tell the member.
 */
export async function deleteTileProof(event: EventRow, submissionId: number, viewer: ProofViewer, reason: string): Promise<string | null> {
  if (eventEditLocked(event)) return 'This event has finished — proofs can’t be removed any more.';
  // clan-scope: global -- matched to this event's tiles just below.
  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  const tile = submission ? await db.query.tiles.findFirst({ where: and(eq(tiles.id, submission.tileId), eq(tiles.eventId, event.id)) }) : null;
  if (!submission || !tile) return 'That proof is already gone.';

  const [grant, managers, team] = await Promise.all([
    viewerGrant(event, viewer.userId),
    teamManagerIds(submission.teamId),
    db.query.teams.findFirst({ where: eq(teams.id, submission.teamId), columns: { name: true, captainUserId: true } }),
  ]);
  const check: ProofDeleteCheck = {
    userId: viewer.userId,
    playerIds: viewer.playerId != null ? [viewer.playerId] : [],
    managers,
    grant,
    submission,
  };
  if (!canDeleteProof(check)) return 'You can only remove your own proofs.';

  const role = proofDeleterRole(check, team ?? null);
  let by: string;
  if (role === 'admin') {
    // clan-scope: global -- the caller's own login, for the audit line.
    const u = viewer.userId != null ? await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { displayName: true, discordUsername: true } }) : null;
    by = u?.displayName || u?.discordUsername || 'Admin';
  } else if (role === 'player') {
    const p = await db.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, viewer.playerId!), columns: { name: true } });
    by = p?.name || 'Player';
  } else {
    const seat = role === 'captain' ? 'Captain' : 'Staff';
    by = team?.name ? `${team.name} ${seat}` : seat;
  }
  await removeSubmission({ submission, tile, clanId: event.clanId, deletedBy: by, deletedByRole: role, reason });
  return null;
}
