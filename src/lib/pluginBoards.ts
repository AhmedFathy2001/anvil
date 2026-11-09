// Every live board one CHARACTER is seated on, across clans — so one drop credits all of them.
//
// The plugin used to track a single board: verifyPluginToken picks one live enrollment (latest start
// wins) and /api/plugin/config handed out only that board's tiles. Somebody on two boards at once —
// their own clan's and a clan-vs-clan they were invited to — had the second one silently miss every
// drop. This finds the rest, so the config can fold their tracked tiles in (tagged with the board they
// belong to, X-Anvil-Boards) and the panel's Home can list them.
//
// THE CHARACTER, NOT THE PERSON, for the same reason verifyPluginToken keys on it: an alt's drop is
// not the main's, so a board only the main is on never shows up while the alt is logged in.

import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clans, completions, eventParticipants, events, teams } from '@/db/schema';
import { buildEnrolledConfig } from '@/lib/pluginConfigEnrolled';
import { isEventSeat } from '@/lib/seatKinds';
import { resolveClanById } from '@/lib/clanContext';
import { clansRunningEvents } from '@/lib/coHost';
import { pickActivePluginEvent } from '@/lib/pluginEventPick';
import { teamBoardScore } from '@/lib/pluginHomeBoard';
import { boardPointsPool, scoreTeams } from '@/lib/boardScoring';
import { eventBoardTiles } from '@/lib/comboSql';
import { parseEventRules } from '@/lib/eventRules';
import { standingsScopeForPlugin } from '@/lib/standingsAccess';
import { ttlMemo } from '@/lib/ttlMemo';
import { visibleClan } from '@/lib/pluginUi/load';
import { appendBoardTiles } from '@/lib/pluginBoardTiles';

export { appendBoardTiles, TRACKED_TILE_LISTS } from '@/lib/pluginBoardTiles';

/** The request header a multi-board plugin sends; without it /config is exactly what it always was. */
export const MULTI_BOARD_HEADER = 'x-anvil-boards';

export const wantsAllBoards = (request: Request) => request.headers.get(MULTI_BOARD_HEADER)?.trim() === '1';

export interface LiveBoard {
  eventId: number;
  name: string;
  /** The clan to address the board through (`/c/<clan>/api/events/<id>/...`): one that runs it and the viewer may see. */
  clan: string;
  clanId: number;
  clanName: string;
  teamId: number;
  teamName: string;
  /** This character's participant row on the board. */
  playerId: number;
  rsn: string;
  startDate: string | null;
  endDate?: string | null;
}

/** The `boards` summary row /config sends and Home draws. */
export interface BoardSummary {
  eventId: number;
  name: string;
  clan: string;
  clanName: string;
  teamId: number;
  teamName: string;
  tilesComplete: number;
  tilesTotal: number;
  pointsScored: boolean;
  /** When the board ends (the event's own date), for "Live · ends in …". */
  endDate?: string | null;
  /** The team's place (1 = first) among the board's teams; null when the standings are hidden from this viewer or it isn't a scored table. */
  rank?: number | null;
  /** How many teams the rank is out of; 0 when there is no rank. */
  of?: number;
}

/**
 * Every live board (a team, started, not ended, not force-ended) this character sits on, in clans
 * that are not suspended and that the viewer may see (visibleClan, the panel's own rule). Latest
 * start first. `except` leaves out the board the caller already has.
 *
 * `preferClanId` is the clan the plugin is addressing: a board it hosts or co-hosts is reported
 * through it, so the write lands on the clan the player is already talking to.
 */
export async function liveBoardsForCharacter(
  request: Request,
  accountId: number,
  opts: { except?: number | null; preferClanId?: number | null } = {},
): Promise<LiveBoard[]> {
  // clan-scope: global -- one character's own seats in every clan; the boards are filtered below.
  const seats = await db
    .select({ id: clanRoster.id, clanId: clanRoster.clanId, kind: clanRoster.kind, eventId: clanRoster.eventId })
    .from(clanRoster)
    .where(and(eq(clanRoster.accountId, accountId), isNull(clanRoster.leftAt)));
  const seatIds = seats.map((s) => s.id);
  // An event player's seat opens only the event it names: a row on any other board through it is dropped.
  const eventSeatOf = new Map(seats.filter((s) => isEventSeat(s)).map((s) => [s.id, s.eventId]));
  const eventSeatClan = new Map(seats.filter((s) => isEventSeat(s)).map((s) => [s.id, s.clanId]));
  // clan-scope: global -- the character's own entries across clans; each board's clan is checked below.
  const rows = await db
    .select({
      id: eventParticipants.id,
      name: eventParticipants.name,
      clanMemberId: eventParticipants.clanMemberId,
      teamId: eventParticipants.teamId,
      teamName: teams.name,
      eventId: events.id,
      eventName: events.name,
      hostClanId: events.clanId,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .innerJoin(teams, eq(teams.id, eventParticipants.teamId))
    .where(
      and(
        isNotNull(eventParticipants.teamId),
        seatIds.length > 0
          ? or(eq(eventParticipants.accountId, accountId), inArray(eventParticipants.clanMemberId, seatIds))
          : eq(eventParticipants.accountId, accountId),
      ),
    );

  // Live by the very rule the single pick uses, one row at a time; one entry per board.
  const nowIso = new Date().toISOString();
  const byEvent = new Map<number, (typeof rows)[number]>();
  for (const r of rows) {
    if (r.eventId === opts.except || byEvent.has(r.eventId)) continue;
    if (r.clanMemberId != null && eventSeatOf.has(r.clanMemberId) && eventSeatOf.get(r.clanMemberId) !== r.eventId) continue;
    if (pickActivePluginEvent([r], nowIso)) byEvent.set(r.eventId, r);
  }
  if (byEvent.size === 0) return [];

  const running = await clansRunningEvents([...byEvent.keys()]);
  const clanIds = [...new Set([...running.values()].flatMap((s) => [...s]))];
  // clan-scope: global -- naming the clans that run these boards is the question.
  const clanRows = await db.select({ id: clans.id, slug: clans.slug, name: clans.name, status: clans.status }).from(clans).where(inArray(clans.id, clanIds));
  const clanById = new Map(clanRows.map((c) => [c.id, c]));

  const out: LiveBoard[] = [];
  for (const r of byEvent.values()) {
    const host = clanById.get(r.hostClanId);
    // A suspended host's board is off, whoever else runs it.
    if (!host || host.status === 'suspended') continue;
    const runners = [...(running.get(r.eventId) ?? [])];
    const order = [
      ...(opts.preferClanId != null && runners.includes(opts.preferClanId) ? [opts.preferClanId] : []),
      r.hostClanId,
      ...runners.filter((id) => id !== r.hostClanId && id !== opts.preferClanId),
    ];
    // Its own event seat's clan addresses the board even where visibleClan (clan seats only) would not.
    const ownSeatClan = r.clanMemberId != null && eventSeatOf.get(r.clanMemberId) === r.eventId ? eventSeatClan.get(r.clanMemberId) : undefined;
    let via: { id: number; slug: string; name: string } | null = null;
    for (const id of order) {
      const c = clanById.get(id);
      if (c && (id === ownSeatClan || (await visibleClan(request, c.slug)))) {
        via = c;
        break;
      }
    }
    if (!via) continue;
    out.push({
      eventId: r.eventId,
      name: r.eventName,
      clan: via.slug,
      clanId: via.id,
      clanName: via.name,
      teamId: r.teamId!,
      teamName: r.teamName,
      playerId: r.id,
      rsn: r.name,
      startDate: r.startDate,
      endDate: r.endDate,
    });
  }
  out.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || b.eventId - a.eventId);
  return out;
}

/** Each board's team standing for Home — the same fraction its own card shows; 0/0 until the tiles are revealed. */
export async function summarizeBoards(boards: LiveBoard[], viewer: { userId: number | null } = { userId: null }): Promise<BoardSummary[]> {
  if (boards.length === 0) return [];
  // clan-scope: global -- these boards came from liveBoardsForCharacter, which settled each clan.
  const meta = await db
    .select()
    .from(events)
    .where(inArray(events.id, boards.map((b) => b.eventId)));
  const byId = new Map(meta.map((m) => [m.id, m]));
  return Promise.all(
    boards.map(async (b) => {
      const m = byId.get(b.eventId);
      const score = m?.tilesRevealed ? await teamBoardScore({ eventId: b.eventId, scoringMode: m.scoringMode, rules: m.rules }, b.teamId) : null;
      const place = m?.tilesRevealed ? await boardPlace(m, b.teamId, viewer.userId).catch(() => null) : null;
      return summaryOf({ ...b, endDate: b.endDate ?? m?.endDate ?? null }, score ? { tilesComplete: score.boardScore, tilesTotal: score.total, pointsScored: score.unit === 'pts' } : null, place);
    }),
  );
}

/** Every team's rank on a board, by score (ties share a place); a few seconds stale at most, the same for every viewer. */
async function boardRanks(m: { id: number; scoringMode: string | null; rules: string | null }): Promise<Map<number, number>> {
  return ttlMemo(`board-ranks:${m.id}`, async () => {
    const [tileRows, teamRows, doneRows] = await Promise.all([
      db.query.tiles.findMany({ where: eventBoardTiles(m.id) }),
      db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, m.id)),
      db.select({ teamId: completions.teamId, tileId: completions.tileId, awardedPoints: completions.awardedPoints }).from(completions).innerJoin(teams, eq(teams.id, completions.teamId)).where(eq(teams.eventId, m.id)),
    ]);
    const scores = scoreTeams({ scoringMode: m.scoringMode, rules: parseEventRules(m.rules), tiles: tileRows, completions: doneRows, teams: teamRows, boardPointsTotal: boardPointsPool(m.scoringMode, tileRows) });
    const sorted = [...scores].sort((x, y) => y.score - x.score);
    const out = new Map<number, number>();
    sorted.forEach((sc, i) => out.set(sc.teamId, i > 0 && sorted[i - 1].score === sc.score ? out.get(sorted[i - 1].teamId)! : i + 1));
    return out;
  }, 10_000);
}

/** The team's "Nth of N" on a board, or null where the standings are hidden from this viewer. */
export async function boardPlace(m: typeof events.$inferSelect, teamId: number, userId: number | null): Promise<{ rank: number | null; of: number } | null> {
  const scope = await standingsScopeForPlugin(m, { userId, teamId });
  if (scope.hidden) return { rank: null, of: 0 };
  const ranks = await boardRanks(m);
  const rank = ranks.get(teamId);
  return rank == null ? { rank: null, of: 0 } : { rank, of: ranks.size };
}

/** The row /config sends for one board. */
export function summaryOf(
  b: Pick<LiveBoard, 'eventId' | 'name' | 'clan' | 'clanName' | 'teamId' | 'teamName'> & { endDate?: string | null },
  tally: { tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null | undefined,
  place?: { rank: number | null; of: number } | null,
): BoardSummary {
  return {
    eventId: b.eventId,
    name: b.name,
    clan: b.clan,
    clanName: b.clanName,
    teamId: b.teamId,
    teamName: b.teamName,
    tilesComplete: tally?.tilesComplete ?? 0,
    tilesTotal: tally?.tilesTotal ?? 0,
    pointsScored: tally?.pointsScored ?? false,
    endDate: ('endDate' in b ? b.endDate : null) ?? null,
    rank: place?.rank ?? null,
    of: place?.of ?? 0,
  };
}

/**
 * Fold every OTHER live board this character is on into a /config body (X-Anvil-Boards only): their
 * tracked tiles appended and tagged, and `boards` listing them all, `active` first when there is one.
 * Each board's lists come from buildEnrolledConfig for that board's own seat, so the matching rules
 * are the ones the board would give if it were the active one.
 */
export async function foldOtherBoards(
  request: Request,
  body: Record<string, unknown>,
  args: { accountId: number; userId: number | null; addressedClanId: number; active: BoardSummary | null },
): Promise<void> {
  const others = await liveBoardsForCharacter(request, args.accountId, { except: args.active?.eventId ?? null, preferClanId: args.addressedClanId });
  const summaries: BoardSummary[] = args.active ? [args.active] : [];
  for (const b of others) {
    const clan = await resolveClanById(b.clanId);
    if (!clan) continue;
    const built = await buildEnrolledConfig({
      eventId: b.eventId,
      teamId: b.teamId,
      clan,
      viewer: { playerId: b.playerId, userId: args.userId, rsn: b.rsn, request },
      trackedOnly: true,
    });
    if (!built.ok) continue;
    appendBoardTiles(body, built.body as unknown as Record<string, unknown>, b);
    const ev = await db.query.events.findFirst({ where: eq(events.id, b.eventId) });
    const place = ev?.tilesRevealed ? await boardPlace(ev, b.teamId, args.userId).catch(() => null) : null;
    summaries.push(summaryOf({ ...b, endDate: b.endDate ?? ev?.endDate ?? null }, (built.body as { board?: { tilesComplete: number; tilesTotal: number; pointsScored: boolean } }).board, place));
  }
  body.boards = summaries;
}
