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
import { clanRoster, clans, eventParticipants, events, teams } from '@/db/schema';
import { buildEnrolledConfig } from '@/lib/pluginConfigEnrolled';
import { isEventSeat } from '@/lib/seatKinds';
import { resolveClanById } from '@/lib/clanContext';
import { clansRunningEvents } from '@/lib/coHost';
import { pickActivePluginEvent } from '@/lib/pluginEventPick';
import { teamBoardScore } from '@/lib/pluginHomeBoard';
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
    });
  }
  out.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || b.eventId - a.eventId);
  return out;
}

/** Each board's team standing for Home — the same fraction its own card shows; 0/0 until the tiles are revealed. */
export async function summarizeBoards(boards: LiveBoard[]): Promise<BoardSummary[]> {
  if (boards.length === 0) return [];
  // clan-scope: global -- these boards came from liveBoardsForCharacter, which settled each clan.
  const meta = await db
    .select({ id: events.id, scoringMode: events.scoringMode, rules: events.rules, tilesRevealed: events.tilesRevealed })
    .from(events)
    .where(inArray(events.id, boards.map((b) => b.eventId)));
  const byId = new Map(meta.map((m) => [m.id, m]));
  return Promise.all(
    boards.map(async (b) => {
      const m = byId.get(b.eventId);
      const score = m?.tilesRevealed ? await teamBoardScore({ eventId: b.eventId, scoringMode: m.scoringMode, rules: m.rules }, b.teamId) : null;
      return summaryOf(b, score ? { tilesComplete: score.boardScore, tilesTotal: score.total, pointsScored: score.unit === 'pts' } : null);
    }),
  );
}

export function summaryOf(
  b: Pick<LiveBoard, 'eventId' | 'name' | 'clan' | 'clanName' | 'teamId' | 'teamName'>,
  tally: { tilesComplete: number; tilesTotal: number; pointsScored: boolean } | null | undefined,
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
    summaries.push(summaryOf(b, (built.body as { board?: { tilesComplete: number; tilesTotal: number; pointsScored: boolean } }).board));
  }
  body.boards = summaries;
}
