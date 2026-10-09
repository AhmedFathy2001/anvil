// Team-private tile claims: "I'm planning to go for this one", so teammates don't all chase the same
// tile while another sits untouched.
//
// PRIVATE TO THE TEAM. Every read is filtered to one team, by a caller that has already proved the
// viewer belongs to it (lib/teamStaff resolveTeamManagement). Nothing public reads this table — not
// the scoreboard, not the unauthenticated pulse, not the plugin's anonymous board — because even a
// count of claims would tell the other teams where this one is heading.
//
// Hidden tiles stay hidden: a claim can only be made on a tile members can currently see, and reads
// drop claims on tiles that aren't visible (a board re-hidden after claims were made).

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { completions, eventParticipants, events, tileClaims, tiles, users } from '@/db/schema';
import { isEventEnded } from '@/lib/survey';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';

export { NOTE_MAX, cleanNote, type TeamClaim } from '@/lib/tileClaimsView';
import type { TeamClaim } from '@/lib/tileClaimsView';

/** The ids of an event's tiles that members can see right now. */
async function visibleTileIds(eventId: number): Promise<Set<number>> {
  // clan-scope: global -- one event by id; the caller proved team membership on it.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { tilesRevealed: true, rules: true } });
  if (!event?.tilesRevealed) return new Set();
  const rules = parseEventRules(event.rules);
  const rows = await db.select().from(tiles).where(eq(tiles.eventId, eventId));
  return new Set(rows.filter((t) => isTileRevealed(rules, t)).map((t) => t.id));
}

/** This team's live claims: visible tiles only, and not on tiles the team has already completed. */
export async function listTeamClaims(eventId: number, teamId: number, viewerUserId: number): Promise<TeamClaim[]> {
  const rows = await db
    .select({ claim: tileClaims, participantName: eventParticipants.name, displayName: users.displayName })
    .from(tileClaims)
    .leftJoin(eventParticipants, eq(eventParticipants.id, tileClaims.participantId))
    .leftJoin(users, eq(users.id, tileClaims.userId))
    .where(and(eq(tileClaims.eventId, eventId), eq(tileClaims.teamId, teamId)));
  if (rows.length === 0) return [];
  const [visible, done] = await Promise.all([
    visibleTileIds(eventId),
    db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId)),
  ]);
  const completed = new Set(done.map((d) => d.tileId));
  return rows
    .filter((r) => visible.has(r.claim.tileId) && !completed.has(r.claim.tileId))
    .map((r) => ({
      tileId: r.claim.tileId,
      userId: r.claim.userId,
      name: r.participantName || r.displayName || 'A teammate',
      note: r.claim.note,
      createdAt: r.claim.createdAt,
      mine: r.claim.userId === viewerUserId,
    }));
}

export type ClaimResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Claim a tile for this person on this team (or update their note on an existing claim). The caller
 * proved they play on the team; this checks the tile is the event's, visible, still open to the team.
 */
export async function claimTile(opts: {
  eventId: number;
  teamId: number;
  tileId: number;
  userId: number;
  participantId: number | null;
  note: string | null;
}): Promise<ClaimResult> {
  // clan-scope: global -- the event of a team the caller proved membership on.
  const event = await db.query.events.findFirst({ where: eq(events.id, opts.eventId) });
  if (!event) return { ok: false, error: 'Event not found.', status: 404 };
  if (isEventEnded(event)) return { ok: false, error: 'This event has ended.', status: 409 };
  const tile = await db.query.tiles.findFirst({ where: and(eq(tiles.id, opts.tileId), eq(tiles.eventId, opts.eventId)) });
  // Same answer for "no such tile" and "not visible yet", so a claim can't probe a hidden board.
  if (!tile || !event.tilesRevealed || !isTileRevealed(parseEventRules(event.rules), tile)) {
    return { ok: false, error: 'Tile not found.', status: 404 };
  }
  const done = await db.query.completions.findFirst({
    where: and(eq(completions.teamId, opts.teamId), eq(completions.tileId, opts.tileId)),
    columns: { id: true },
  });
  if (done) return { ok: false, error: 'Your team already completed this tile.', status: 409 };

  await db
    .insert(tileClaims)
    .values({
      eventId: opts.eventId,
      teamId: opts.teamId,
      tileId: opts.tileId,
      userId: opts.userId,
      participantId: opts.participantId,
      note: opts.note,
    })
    .onConflictDoUpdate({
      target: [tileClaims.teamId, tileClaims.tileId, tileClaims.userId],
      set: { note: opts.note, participantId: opts.participantId },
    });
  return { ok: true };
}

/** Drop one person's claim on a tile (their own; a captain or team staff may clear a stale one). */
export async function unclaimTile(teamId: number, tileId: number, userId: number): Promise<void> {
  await db
    .delete(tileClaims)
    .where(and(eq(tileClaims.teamId, teamId), eq(tileClaims.tileId, tileId), eq(tileClaims.userId, userId)));
}
