import { db } from '@/db';
import { completions, players, teams, tiles } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';

/**
 * The firsts of a board — who started it, who drew first blood, who cleared the first timed run.
 *
 * FIRSTS BELONG TO BOARDS, not to weeks. A completion carries `completedAt`, stamped when the claim
 * actually landed, so "first" is a fact about the event. A weekly's numbers arrive whenever the
 * sweep gets to that member — minutes for a plugin user, hours for everyone else — so a first there
 * would be an award for having the plugin installed. Weeks get shape awards instead
 * (lib/competitionAwards); boards get these.
 *
 * Cheap by construction: one indexed read of the board's completions in claim order, and only the
 * earliest of each kind is kept. Nothing here scans history.
 */

export interface EventFirst {
  key: string;
  emoji: string;
  title: string;
  blurb: string;
  /** The player credited, or the team when no player was. */
  who: string;
  teamName: string | null;
  teamColor: string | null;
  tileLabel: string;
  at: string;
}

/** Tile kinds that make a "first" worth calling out, in the order they're offered. */
const FIRSTS: { key: string; emoji: string; title: string; blurb: string; types: string[] }[] = [
  { key: 'first-blood', emoji: '⚔️', title: 'First blood', blurb: 'First kill credited on the board', types: ['kill'] },
  { key: 'first-drop', emoji: '💎', title: 'First drop', blurb: 'First drop anyone turned in', types: ['drop'] },
  { key: 'first-clear', emoji: '⏱️', title: 'First clear', blurb: 'First timed run inside the target', types: ['timed', 'deathless'] },
  { key: 'first-pk', emoji: '🗡️', title: 'First blood (PvP)', blurb: 'First player kill claimed', types: ['pvp'] },
];

export async function loadEventFirsts(eventId: number): Promise<EventFirst[]> {
  // Claim order, oldest first. The board's own completions only — this never touches other events.
  const rows = await db
    .select({
      completedAt: completions.completedAt,
      teamId: completions.teamId,
      creditPlayerId: completions.creditPlayerId,
      tileLabel: tiles.label,
      tileType: tiles.tileType,
      mission: tiles.mission,
    })
    .from(completions)
    .innerJoin(tiles, eq(completions.tileId, tiles.id))
    .where(eq(tiles.eventId, eventId))
    .orderBy(asc(completions.completedAt));

  if (rows.length === 0) return [];

  const teamRows = await db
    .select({ id: teams.id, name: teams.name, color: teams.color })
    .from(teams)
    .where(eq(teams.eventId, eventId));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  const playerIds = [...new Set(rows.map((r) => r.creditPlayerId).filter((id): id is number => id != null))];
  const playerRows = playerIds.length
    ? await db.select({ id: players.id, name: players.name }).from(players).where(inArray(players.id, playerIds))
    : [];
  const playerById = new Map(playerRows.map((p) => [p.id, p.name]));

  const entryFor = (row: (typeof rows)[number], spec: { key: string; emoji: string; title: string; blurb: string }): EventFirst => {
    const team = row.teamId != null ? teamById.get(row.teamId) : undefined;
    return {
      key: spec.key,
      emoji: spec.emoji,
      title: spec.title,
      blurb: spec.blurb,
      // A tile can be finished by a team without any one player credited — say the team rather than
      // invent a name.
      who: (row.creditPlayerId != null ? playerById.get(row.creditPlayerId) : null) ?? team?.name ?? 'Someone',
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
      tileLabel: row.tileLabel,
      at: row.completedAt,
    };
  };

  const out: EventFirst[] = [];

  // Who got the board moving. A mission is dropped mid-event, so it can't be the thing that started
  // it — the opener has to be a board tile.
  const opener = rows.find((r) => r.mission !== 1);
  if (opener) {
    out.push(
      entryFor(opener, {
        key: 'starter',
        emoji: '🥇',
        title: 'Event starter',
        blurb: 'First tile claimed on the board',
      }),
    );
  }

  for (const spec of FIRSTS) {
    const row = rows.find((r) => spec.types.includes(r.tileType ?? 'standard'));
    // Don't repeat the opener under a second name when it was also the first of its kind.
    if (row && row !== opener) out.push(entryFor(row, spec));
  }

  return out;
}
