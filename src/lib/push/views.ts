import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { events, teams, tiles } from '@/db/schema';
import { buildBoard } from '@/app/api/plugin/board/route';
import { resolveClanById } from '@/lib/clanContext';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { buildEnrolledConfig } from '@/lib/pluginConfigEnrolled';
import { tileProgressView } from '@/lib/tileTrackerView';
import { parseViewKey } from '@/lib/push/hub';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// What the live push sends (push/server.ts asks api/internal/push/view for one key at a time):
//
//   team:<event>:<team>  everything on the side panel and in tracking that the whole team shares — the
//                        config route's own reading built with no caller (lib/pluginConfigEnrolled),
//                        each member's own numbers in `members`, and the board. Team 0 = a viewer
//                        with no team on that board: the board only.
//   tile:<event>:<tile>  one tile's tracker numbers for every team (lib/tileTrackerView).
//
// One answer per key, sent to everyone subscribed to it; each plugin marks itself.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Config fields that are the team's, not the caller's. The rest stays on /api/plugin/config. */
const TEAM_FIELDS = [
  'event', 'team', 'board', 'completedTiles',
  'trackedStats', 'trackedKcNames', 'trackedSkillNames', 'trackedActivityKeys',
  'trackedDrops', 'trackedKills', 'trackedPvp', 'trackedDiaries', 'trackedCombatTasks',
  'trackedTimed', 'trackedLms', 'trackedValues', 'trackedGains', 'trackedDeathless',
] as const;

/** Ranked for one caller (their place on a ladder), so never in a view shared by a team. */
const CALLER_EVENT_FIELDS = ['standings', 'monthlyStandings'];

export async function pushView(key: string): Promise<Record<string, unknown> | null> {
  const k = parseViewKey(key);
  if (!k) return null;
  // clan-scope: global -- the push server's internal read by id; who may hear a view was settled by the
  // site when it signed the listener's ticket (api/plugin/push/ticket), the same resolution as config.
  const event = await db.query.events.findFirst({ where: eq(events.id, k.eventId) });
  if (!event) return null;
  return k.kind === 'team' ? teamView(event, k.id) : tileView(event, k.id);
}

async function teamView(event: typeof events.$inferSelect, teamId: number) {
  if (teamId === 0) return { t: 'team', eventId: event.id, teamId: 0, board: await buildBoard(event, null, null) };
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, event.id)) });
  if (!team) return null;
  // The team's own clan: a co-host's team plays from its home clan, which is the clan its members'
  // plugins are connected to.
  const clan = await resolveClanById(team.clanId ?? event.clanId);
  if (!clan) return null;
  const [built, board] = await Promise.all([
    buildEnrolledConfig({ eventId: event.id, teamId, clan, viewer: null }),
    buildBoard(event, teamId, null),
  ]);
  if (!built.ok) return null;
  const body = built.body as Record<string, unknown> & { panel: { tiles: unknown; activeNow: unknown } };
  const config: Record<string, unknown> = {};
  for (const f of TEAM_FIELDS) if (body[f] !== undefined) config[f] = body[f];
  const ev = { ...(body.event as Record<string, unknown>) };
  for (const f of CALLER_EVENT_FIELDS) delete ev[f];
  config.event = ev;
  config.panel = { tiles: body.panel.tiles, activeNow: body.panel.activeNow };
  return { t: 'team', eventId: event.id, teamId, config, members: built.members, board };
}

async function tileView(event: typeof events.$inferSelect, tileId: number) {
  const tile = event.tilesRevealed
    ? await db.query.tiles.findFirst({ where: and(eq(tiles.id, tileId), eq(tiles.eventId, event.id)) })
    : undefined;
  // The same gates the tracker route applies: nothing about an unrevealed tile leaves the server.
  if (!tile || !isTileRevealed(parseEventRules(event.rules), tile)) return null;
  return { t: 'tile', eventId: event.id, tileId, progress: await tileProgressView(event, tile, null) };
}
