import { db } from '@/db';
import { clanRoster, clans, completions, eventParticipants, events, tiles } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { seatsOwnedByAnywhere } from '@/lib/roster';

// THE CLAN SWITCHER, server side.
//
// One token names one person, and a person now holds seats in as many clans as they like — a member
// here, a guest there for one cross-clan board. Every plugin request that names no clan resolves
// through `resolvePluginClan`, which picks ONE of those seats by a documented heuristic (live event,
// then latest start, then newest seat). That guess is almost always right and completely invisible,
// which is the problem: a member playing two boards has no way to see which one they are filing
// drops into, let alone change it.
//
// So the plugin gets the list and does the choosing. `/api/plugin/config` carries both halves:
//
//   activeClan — the clan THIS request actually resolved to, whatever named it (path, host, token).
//                The plugin echoes this slug back as a `/c/<slug>` prefix on everything it does
//                afterwards, so a write is addressed to a clan rather than re-guessed per request.
//   clans[]    — every clan the person could switch to, with enough to render a dropdown row.
//
// Deliberately part of /config rather than an endpoint of its own: the plugin already polls /config
// on a timer, the answer changes about as often as the rest of it, and a second poll would buy
// nothing but a second thing to keep consistent.

/** How many clans a switcher will show. Far past any real membership; bounds the per-clan work below. */
const MAX_SWITCHABLE_CLANS = 20;

export interface PluginClanLive {
  /**
   * The board's id, so a client can tell two clans showing the SAME board from two boards.
   *
   * Co-hosted events belong to every host, so a person seated in two co-hosting clans sees one
   * event twice — under each clan. Deduping on the name would be a guess ("Summer Bingo" is not a
   * rare name); the id is the answer.
   */
  eventId: number;
  eventName: string;
  tilesComplete: number;
  tilesTotal: number;
  /** Leagues-style points scoring — the tallies above are points, not tile counts. */
  pointsScored: boolean;
}

export interface PluginClanRow {
  slug: string;
  name: string;
  /** 'member' | 'guest' — the seat's standing, so a dropdown can say which is your home. */
  kind: string;
  /** The board running here that this person is on, or null. Drives the dropdown's second line. */
  live: PluginClanLive | null;
}

/**
 * Every clan this person can address, newest seat first, with whatever is live in each.
 *
 * Batched rather than looped: the seats come back in one query, the live enrollments across ALL of
 * them in a second, and the board tallies for the handful of clans that have one in a third. A
 * per-clan loop would have been three queries times however many clans somebody has collected, on
 * an endpoint every client polls on a timer.
 */
export async function pluginClansFor(userId: number | null | undefined): Promise<PluginClanRow[]> {
  if (userId == null) return [];

  const ownedAnywhere = await seatsOwnedByAnywhere(userId);

  const seats = await db
    .select({
      seatId: clanRoster.id,
      clanId: clanRoster.clanId,
      kind: clanRoster.kind,
      joinedAt: clanRoster.joinedAt,
      slug: clans.slug,
      name: clans.name,
      status: clans.status,
    })
    .from(clanRoster)
    .innerJoin(clans, eq(clans.id, clanRoster.clanId))
    .where(and(ownedAnywhere, isNull(clanRoster.leftAt)));

  // A suspended or deleted clan is not somewhere to switch TO — its pages do not answer either, so
  // offering it in a dropdown would hand the member a row that fails when they pick it.
  const usable = seats.filter((s) => s.status === 'active');
  if (usable.length === 0) return [];

  // One row per clan. Somebody can hold several seats in one clan (a main and an alt); the clan is
  // the switchable thing, not the seat, so collapse to the earliest-joined and keep every seat id
  // for the enrollment lookup below.
  const byClan = new Map<number, { row: (typeof usable)[number]; seatIds: number[] }>();
  for (const s of usable) {
    const found = byClan.get(s.clanId);
    if (found) {
      found.seatIds.push(s.seatId);
      // 'member' outranks 'guest' — if either seat is a real membership, this is a home clan.
      if (s.kind === 'member') found.row = { ...found.row, kind: 'member' };
    } else {
      byClan.set(s.clanId, { row: s, seatIds: [s.seatId] });
    }
  }

  const ordered = [...byClan.values()]
    .sort((a, b) => (b.row.joinedAt ?? '').localeCompare(a.row.joinedAt ?? ''))
    .slice(0, MAX_SWITCHABLE_CLANS);

  const allSeatIds = ordered.flatMap((c) => c.seatIds);
  const live = allSeatIds.length > 0 ? await liveBoardsBySeat(allSeatIds) : new Map<number, LiveEnrollment>();

  return ordered.map(({ row, seatIds }) => {
    // The freshest live board in this clan, if any — same "latest start wins" tie-break the clan
    // resolver uses, so what the dropdown shows is what a request to that clan would resolve to.
    const here = seatIds
      .map((id) => live.get(id))
      .filter((e): e is LiveEnrollment => !!e)
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
    const best = here[0];
    return {
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      live: best
        ? {
            eventId: best.eventId,
            eventName: best.eventName,
            tilesComplete: best.tilesComplete,
            tilesTotal: best.tilesTotal,
            pointsScored: best.pointsScored,
          }
        : null,
    };
  });
}

interface LiveEnrollment extends PluginClanLive {
  startDate: string | null;
}

/**
 * For each of these seats, the live board it is playing — team progress included.
 *
 * "Live" is the same three conditions the rest of the app uses: drafted onto a team, not force-ended,
 * and inside its start/end window. An event with no start date has not started, so it does not count;
 * that is the same rule `evaluateCompletionGate` applies, and a board that scores nothing should not
 * be reported as the one you are playing.
 */
async function liveBoardsBySeat(seatIds: number[]): Promise<Map<number, LiveEnrollment>> {
  const rows = await db
    .select({
      seatId: eventParticipants.clanMemberId,
      teamId: eventParticipants.teamId,
      eventId: events.id,
      eventName: events.name,
      scoringMode: events.scoringMode,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .where(inArray(eventParticipants.clanMemberId, seatIds));

  const now = Date.now();
  const playing = rows.filter(
    (r) =>
      r.seatId != null &&
      r.teamId != null &&
      !r.forceEndedAt &&
      r.startDate != null &&
      r.endDate != null &&
      Date.parse(r.startDate) <= now &&
      now <= Date.parse(r.endDate),
  );
  if (playing.length === 0) return new Map();

  const eventIds = [...new Set(playing.map((r) => r.eventId))];
  const teamIds = [...new Set(playing.map((r) => r.teamId as number))];

  const [tileRows, doneRows] = await Promise.all([
    db
      .select({ id: tiles.id, eventId: tiles.eventId, points: tiles.points, optional: tiles.optional })
      .from(tiles)
      .where(inArray(tiles.eventId, eventIds)),
    db
      .select({ teamId: completions.teamId, tileId: completions.tileId })
      .from(completions)
      .where(inArray(completions.teamId, teamIds)),
  ]);

  // Optional tiles are bonus — out of both tallies, matching the website's scoredTiles filter and
  // the plugin's own logged-in summary. A board where the two disagreed would read as a bug.
  const scoredByEvent = new Map<number, { id: number; points: number | null }[]>();
  for (const t of tileRows) {
    if (t.optional) continue;
    const list = scoredByEvent.get(t.eventId) ?? [];
    list.push({ id: t.id, points: t.points });
    scoredByEvent.set(t.eventId, list);
  }
  const doneByTeam = new Map<number, Set<number>>();
  for (const c of doneRows) {
    const set = doneByTeam.get(c.teamId) ?? new Set<number>();
    set.add(c.tileId);
    doneByTeam.set(c.teamId, set);
  }

  const out = new Map<number, LiveEnrollment>();
  for (const r of playing) {
    const scored = scoredByEvent.get(r.eventId) ?? [];
    const done = doneByTeam.get(r.teamId as number) ?? new Set<number>();
    const totalPoints = scored.reduce((sum, t) => sum + (t.points ?? 1), 0);
    const pointsScored = r.scoringMode === 'points' && totalPoints > 0;
    const entry: LiveEnrollment = {
      eventId: r.eventId,
      eventName: r.eventName,
      startDate: r.startDate,
      pointsScored,
      tilesTotal: pointsScored ? totalPoints : scored.length,
      tilesComplete: pointsScored
        ? scored.filter((t) => done.has(t.id)).reduce((sum, t) => sum + (t.points ?? 1), 0)
        : scored.filter((t) => done.has(t.id)).length,
    };
    const seatId = r.seatId as number;
    const existing = out.get(seatId);
    // One seat, two live boards: latest start wins, as everywhere else.
    if (!existing || (entry.startDate ?? '').localeCompare(existing.startDate ?? '') > 0) {
      out.set(seatId, entry);
    }
  }
  return out;
}
