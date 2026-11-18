import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, teams, tiles } from '@/db/schema';
import { nestParts } from '@/lib/combo';
import { eventActivityIsValid } from '@/lib/completionGate';
import { loadEventFirsts, type EventFirst } from '@/lib/eventFirsts';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { HIDDEN_RACE_TILE_LABEL, isRaceHidden } from '@/lib/raceHideAhead';
import { maskRaceTilesForSession } from '@/lib/raceHideAheadDb';
import { raceViewData } from '@/lib/raceSummary';

type FirstsEvent = Parameters<typeof maskRaceTilesForSession>[0] & Parameters<typeof eventActivityIsValid>[0] & {
  id: number;
  startDate: string | null;
  rules: string | null;
  tilesRevealed: boolean | number | null;
};

const RACE_EMOJI: Record<string, string> = { 'off-the-line': '🏁', junction: '⇄', 'road-switch': '↪' };

/**
 * An event's firsts as THIS request may read them, for the Stats page: the board's own firsts, then a
 * tile race's (off the line, first road switch). A first on a tile the viewer cannot see yet says
 * who, not what, and a race's firsts are built from the visible board only. The caller has already
 * decided the standings are not curtained for this viewer.
 */
export async function firstsForViewer(event: FirstsEvent): Promise<EventFirst[]> {
  // Nothing before the board is revealed: a first names a tile.
  if (!event.tilesRevealed) return [];
  const rows = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  const board = await maskRaceTilesForSession(event, nestParts(rows));
  // What this viewer may read: the revealed tiles, minus the ones a race still hides from them.
  const visible = visibleTiles(parseEventRules(event.rules), board);
  const readable = new Set(visible.filter((t) => !isRaceHidden(t)).map((t) => t.label));
  // A first on a tile they cannot see yet says who, not what.
  const firsts = (await loadEventFirsts(event.id, event.startDate)).map((f) => (readable.has(f.tileLabel) ? f : { ...f, tileLabel: HIDDEN_RACE_TILE_LABEL }));
  if (event.format !== 'tilerace' || rows.length === 0) return firsts;

  const [eventTeams, done] = await Promise.all([
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, event.id)),
    db.select({ teamId: completions.teamId, tileId: completions.tileId, completedAt: completions.completedAt }).from(completions).where(inArray(completions.tileId, rows.map((t) => t.id))),
  ]);
  const race = raceViewData({
    visibleBoardTiles: visible,
    teams: eventTeams,
    completions: done.filter((c) => eventActivityIsValid(event, c.completedAt)),
    withFirsts: true,
  });
  for (const f of race.firsts) {
    firsts.push({ key: `race-${f.key}`, emoji: RACE_EMOJI[f.key], title: f.title, blurb: f.title, who: f.team.name, teamName: f.team.name, teamColor: f.team.color, tileLabel: f.detail, at: f.at ?? '' });
  }
  return firsts;
}
