import { db } from '@/db';
import { clanRoster, clans, completions, eventParticipants, events, tiles, weeklyCompetitions } from '@/db/schema';
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
   * Which kind of thing is running — and half of the identity of it.
   *
   * A bingo id and a weekly id come from different tables and collide freely, so a client deduping
   * across clans has to key on the PAIR. Without this, board 5 and Skill of the Week 5 read as the
   * same thing and one of them silently disappears from a merged list.
   */
  kind: 'bingo' | 'weekly';
  /**
   * The id, so a client can tell two clans showing the SAME thing from two things.
   *
   * Co-hosted events belong to every host, so a person seated in two co-hosting clans sees one
   * event twice — under each clan. Deduping on the name would be a guess ("Summer Bingo" is not a
   * rare name); the id is the answer.
   */
  eventId: number;
  eventName: string;
  /** Zero on a weekly: a competition has a leaderboard, not a board to fill. */
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
  /** The most relevant thing running here, or null. Drives the dropdown's second line. */
  live: PluginClanLive | null;
  /**
   * How many things are running here in total — boards this person is on, plus the competition.
   *
   * `live` is one line in a dropdown, so it names ONE of them. Without this a clan running five
   * boards looks exactly like a clan running one, and the one named is an arbitrary pick presented
   * as the whole answer. A client can say "and four more" instead of quietly lying by omission.
   */
  liveCount: number;
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
  const [live, weeklies] = await Promise.all([
    allSeatIds.length > 0 ? liveBoardsBySeat(allSeatIds) : Promise.resolve(new Map<number, LiveEnrollment[]>()),
    activeWeeklyByClan(ordered.map((c) => c.row.clanId)),
  ]);

  return ordered.map(({ row, seatIds }) => {
    // Every live board in this clan, deduped: a person with a main and an alt both drafted onto the
    // same board holds it twice, and that is one board, not two.
    const seen = new Set<number>();
    const here = seatIds
      .flatMap((id) => live.get(id) ?? [])
      .filter((e) => (seen.has(e.eventId) ? false : (seen.add(e.eventId), true)))
      // Same "latest start wins" tie-break the clan resolver uses, so the one named here is the one a
      // request to that clan would actually resolve to.
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
    const best = here[0];
    // A board first, because that is what "playing" most strongly means and it is the richer thing
    // to show — but a clan running only a SOTW/BOTW is not idle, and reporting it as "nothing live"
    // was simply wrong. Competitions live in their own table, so they are their own kind.
    const weekly = weeklies.get(row.clanId) ?? null;
    return {
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      liveCount: here.length + (weekly ? 1 : 0),
      live: best
        ? {
            kind: 'bingo' as const,
            eventId: best.eventId,
            eventName: best.eventName,
            tilesComplete: best.tilesComplete,
            tilesTotal: best.tilesTotal,
            pointsScored: best.pointsScored,
          }
        : weekly
          ? {
              kind: 'weekly' as const,
              eventId: weekly.id,
              eventName: weekly.title,
              // A competition is a leaderboard, not a board to fill. Zeroes here rather than a
              // fabricated fraction, so a client renders standing instead of a progress bar.
              tilesComplete: 0,
              tilesTotal: 0,
              pointsScored: false,
            }
          : null,
    };
  });
}

interface LiveEnrollment extends PluginClanLive {
  startDate: string | null;
}

/**
 * The running SOTW/BOTW in each of these clans, keyed by clan.
 *
 * Clan-wide rather than per-seat, matching what `/config` already reports for the clan the plugin is
 * addressing: a weekly sweeps the roster in, so "is one running here" is the question, not "is this
 * person enrolled". One query for every clan rather than one per clan — this runs on an endpoint
 * every client polls on a timer.
 */
async function activeWeeklyByClan(clanIds: number[]): Promise<Map<number, { id: number; title: string }>> {
  const out = new Map<number, { id: number; title: string }>();
  if (clanIds.length === 0) return out;
  const rows = await db
    .select({ id: weeklyCompetitions.id, clanId: weeklyCompetitions.clanId, title: weeklyCompetitions.title })
    .from(weeklyCompetitions)
    .where(and(inArray(weeklyCompetitions.clanId, clanIds), eq(weeklyCompetitions.status, 'active')));
  for (const r of rows) {
    // A clan should have one active competition at a time; if it somehow has two, the first is as
    // good an answer as any and the dropdown row only has space for one.
    if (!out.has(r.clanId)) out.set(r.clanId, { id: r.id, title: r.title });
  }
  return out;
}

/**
 * For each of these seats, the live board it is playing — team progress included.
 *
 * "Live" is the same three conditions the rest of the app uses: drafted onto a team, not force-ended,
 * and inside its start/end window. An event with no start date has not started, so it does not count;
 * that is the same rule `evaluateCompletionGate` applies, and a board that scores nothing should not
 * be reported as the one you are playing.
 */
async function liveBoardsBySeat(seatIds: number[]): Promise<Map<number, LiveEnrollment[]>> {
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
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

  const out = new Map<number, LiveEnrollment[]>();
  for (const r of playing) {
    const scored = scoredByEvent.get(r.eventId) ?? [];
    const done = doneByTeam.get(r.teamId as number) ?? new Set<number>();
    const totalPoints = scored.reduce((sum, t) => sum + (t.points ?? 1), 0);
    const pointsScored = r.scoringMode === 'points' && totalPoints > 0;
    const entry: LiveEnrollment = {
      kind: 'bingo',
      eventId: r.eventId,
      eventName: r.eventName,
      startDate: r.startDate,
      pointsScored,
      tilesTotal: pointsScored ? totalPoints : scored.length,
      tilesComplete: pointsScored
        ? scored.filter((t) => done.has(t.id)).reduce((sum, t) => sum + (t.points ?? 1), 0)
        : scored.filter((t) => done.has(t.id)).length,
    };
    // EVERY live board this seat is on, not just the freshest. Which one to NAME is a choice the
    // caller makes; how many there are is a fact it cannot recover once we have thrown the rest away.
    const seatId = r.seatId as number;
    const list = out.get(seatId) ?? [];
    list.push(entry);
    out.set(seatId, list);
  }
  return out;
}
