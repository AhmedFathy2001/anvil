import { and, asc, eq, gt, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanMemberships,
  clans,
  eventSignups,
  events,
  memberDailyStats,
  players,
  settings,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';
import { inAcceptedCohostClan, invitedToEvent } from '@/lib/eventAccess';
import { visibilityOf } from '@/lib/eventVisibility';
import { clansOfPerson, type MyClan } from '@/lib/myClans';

export interface ClanCard extends MyClan {
  /** What is running there now — the only thing a person opening this page wants first. */
  live: { kind: 'event' | 'weekly'; id: number; name: string }[];
}

/** An event across your clans that is taking entries and hasn't got yours. */
export interface OpenSignup {
  eventId: number;
  name: string;
  format: string;
  clanSlug: string;
  clanName: string;
  /** ISO, or null for "no deadline". */
  deadline: string | null;
  startDate: string | null;
}

/** One of the person's OSRS accounts, with the week behind it. */
export interface Character {
  id: number;
  rsn: string;
  xpThisWeek: number;
  /** Where its member seat is, if it has one. An account belongs to at most one clan. */
  clanName: string | null;
}

/** A public board in a clan the person is not in — the "Open to everyone" feed. */
export interface DiscoverEvent {
  eventId: number;
  name: string;
  clanSlug: string;
  clanName: string;
  clanLogoUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Running now, rather than starting later. */
  live: boolean;
  /** Its sign-up window is open — somebody from outside can ask in. */
  takingEntries: boolean;
}

export interface ApexHomeView {
  /**
   * Public boards from clans they are not in, or NULL when the person has turned the feed off — the
   * page then offers to turn it back on rather than showing nothing and explaining nothing.
   */
  discover: DiscoverEvent[] | null;
  clans: ClanCard[];
  /** Events across their clans that are taking entries and have not got theirs. */
  openSignups: OpenSignup[];
  /** Every character they play, best week first. */
  characters: Character[];
}

/**
 * You, across your clans — the apex home for somebody signed in.
 *
 * A different page from the signed-out landing, on purpose. Signed in, "the platform" is not a pitch
 * and not a directory: it is the three clans you are actually in and which of them wants something
 * from you. Nothing here is about a clan you do not belong to, because that was the thing nobody had
 * a reason to read.
 *
 * Two queries for the live sets rather than one per clan: a person in eight clans should not cost
 * eight round trips, and the shape is the same one lib/apexDirectory learned the hard way.
 */
export async function apexHomeView(
  playerId: number | null | undefined,
  userId: number | null | undefined,
): Promise<ApexHomeView> {
  const clans = await clansOfPerson(playerId, userId);
  const discover = await discoverEvents(playerId, clans.map((c) => c.id));
  if (clans.length === 0) {
    // Still worth listing their characters: somebody can play, be tracked, and belong nowhere.
    return { discover, clans: [], openSignups: [], characters: await characterList(playerId) };
  }

  const ids = clans.map((c) => c.id);
  const nowIso = new Date().toISOString();

  // A GUEST SEAT IS NOT BELONGING. Somebody who took a seat in a clan to play one event holds a row
  // on its roster, so reading "your clans" as "every clan with a row" put that clan's own boards —
  // members-only ones included — on their home page, and offered them its sign-ups as if they were
  // one of its members. In a clan where the person only guests, surface what an outsider may be
  // shown: public boards, boards they were invited to (or their clan co-hosts), and whatever they
  // actually entered.
  const guestOnly = new Set(clans.filter((c) => c.seat === 'guest' && !c.staff).map((c) => c.id));

  const [liveEventsRaw, liveWeekliesRaw, signupsRaw, chars] = await Promise.all([
    db
      .select({ clanId: events.clanId, id: events.id, name: events.name, visibility: events.visibility })
      .from(events)
      .where(
        and(
          inArray(events.clanId, ids),
          isNull(events.forceEndedAt),
          sql`${events.startDate} is not null and ${events.startDate} <= ${nowIso}`,
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
    db
      .select({ clanId: weeklyCompetitions.clanId, id: weeklyCompetitions.id, name: weeklyCompetitions.title })
      .from(weeklyCompetitions)
      .where(
        and(
          inArray(weeklyCompetitions.clanId, ids),
          eq(weeklyCompetitions.status, 'active'),
        ),
      ),
    openSignups(playerId, ids),
    characterList(playerId),
  ]);

  const [liveEvents, liveWeeklies, signups] = guestOnly.size
    ? await Promise.all([
        filterGuestEvents(playerId, liveEventsRaw, guestOnly, true),
        filterGuestWeeklies(playerId, liveWeekliesRaw, guestOnly),
        filterGuestEvents(
          playerId,
          signupsRaw.map((r) => ({ ...r, id: r.eventId })),
          guestOnly,
          false,
        ),
      ])
    : [liveEventsRaw, liveWeekliesRaw, signupsRaw];

  const byClan = new Map<number, ClanCard['live']>();
  for (const e of liveEvents) {
    const list = byClan.get(e.clanId) ?? [];
    list.push({ kind: 'event', id: e.id, name: e.name });
    byClan.set(e.clanId, list);
  }
  for (const w of liveWeeklies) {
    const list = byClan.get(w.clanId) ?? [];
    list.push({ kind: 'weekly', id: w.id, name: w.name });
    byClan.set(w.clanId, list);
  }

  return {
    discover,
    clans: clans.map((c) => ({ ...c, live: byClan.get(c.id) ?? [] })),
    openSignups: signups.map(({ eventId, name, format, clanSlug, clanName, deadline, startDate }) => ({
      eventId, name, format, clanSlug, clanName, deadline, startDate,
    })),
    characters: chars,
  };
}

/** Event ids this person has entered on any of their seats (withdrawn entries excluded). */
async function enteredEventIds(playerId: number, eventIds: number[]): Promise<Set<number>> {
  if (eventIds.length === 0) return new Set();
  // clan-scope: global -- the entry sits on whichever of the person's seats they used; the events
  // asked about are already bounded to their clans by the caller.
  const rows = await db
    .select({ eventId: eventSignups.eventId })
    .from(eventSignups)
    .innerJoin(clanMemberships, eq(clanMemberships.id, eventSignups.clanMemberId))
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(accounts.playerId, playerId),
        inArray(eventSignups.eventId, eventIds),
        ne(eventSignups.status, 'withdrawn'),
      ),
    );
  return new Set(rows.map((r) => r.eventId));
}

/**
 * Drops, from clans where the person only guests, the events an outsider would not be shown. Events
 * in their own clans pass untouched. `allowEntered` keeps a live board they are playing in.
 */
async function filterGuestEvents<T extends { id: number; clanId: number; visibility: string | null }>(
  playerId: number | null | undefined,
  rows: T[],
  guestOnly: Set<number>,
  allowEntered: boolean,
): Promise<T[]> {
  const guestRows = rows.filter((r) => guestOnly.has(r.clanId));
  if (guestRows.length === 0 || playerId == null) return rows;

  const entered = allowEntered ? await enteredEventIds(playerId, guestRows.map((r) => r.id)) : new Set<number>();
  const keep = new Set<number>();
  for (const r of guestRows) {
    if (visibilityOf(r.visibility) === 'public' || entered.has(r.id)) keep.add(r.id);
    else if ((await invitedToEvent(r.id, playerId)) || (await inAcceptedCohostClan(r.id, playerId))) keep.add(r.id);
  }
  return rows.filter((r) => !guestOnly.has(r.clanId) || keep.has(r.id));
}

/** A clan's weekly is its roster's; a guest sees one only when they are actually in it. */
async function filterGuestWeeklies<T extends { id: number; clanId: number }>(
  playerId: number | null | undefined,
  rows: T[],
  guestOnly: Set<number>,
): Promise<T[]> {
  const guestRows = rows.filter((r) => guestOnly.has(r.clanId));
  if (guestRows.length === 0 || playerId == null) return rows.filter((r) => !guestOnly.has(r.clanId));
  // clan-scope: global -- the person's own participation, across their seats; the competitions are
  // already bounded to their clans by the caller.
  const mine = await db
    .select({ competitionId: weeklyParticipants.competitionId })
    .from(weeklyParticipants)
    .innerJoin(clanMemberships, eq(clanMemberships.id, weeklyParticipants.clanMemberId))
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(accounts.playerId, playerId),
        inArray(weeklyParticipants.competitionId, guestRows.map((r) => r.id)),
      ),
    );
  const inIt = new Set(mine.map((m) => m.competitionId));
  return rows.filter((r) => !guestOnly.has(r.clanId) || inIt.has(r.id));
}

/**
 * Events taking entries across your clans that you have not entered.
 *
 * THE THING ONLY THE APEX CAN TELL YOU. Inside a clan you already know what it is running; the
 * sign-up you miss is the one in the clan you guest in and rarely open. A person guesting in ten
 * clans has ten sign-up windows they would otherwise have to go and look for, which is precisely
 * the failure a platform is supposed to remove.
 *
 * "Not entered" is per PERSON, not per seat, and the difference matters: entering with your alt
 * counts. `event_signups` is keyed to a seat, so the exclusion is over every seat this person holds
 * — a check on one account would keep offering an event they are already playing.
 *
 * Withdrawn sign-ups deliberately come back: withdrawing is not the same as declining forever, and
 * while the window is open they can change their mind.
 *
 * NO VISIBILITY FILTER HERE, for the person's own clans: `canSeeEvent` grants a clan's own people
 * sight of every event it runs. A clan where they only hold a GUEST seat is not theirs in that
 * sense, and apexHomeView filters those rows afterwards (filterGuestEvents) — visibility, invites
 * and co-hosting decide there, the way they would for any outsider.
 */
export async function openSignups(
  playerId: number | null | undefined,
  clanIds: number[],
): Promise<(OpenSignup & { clanId: number; visibility: string | null })[]> {
  if (playerId == null || clanIds.length === 0) return [];
  const nowIso = new Date().toISOString();

  // Every seat this person holds, anywhere. Their entry could sit on any of them, so narrowing this
  // to one clan would offer them events they are already signed up for through another seat.
  // clan-scope: global -- "have I entered this?" is a question about the PERSON, and their entry
  // lives on whichever of their seats they used. The clan filter is on the events query below.
  const seats = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt)));
  const seatIds = seats.map((s) => s.id);

  const entered = seatIds.length
    ? db
        .select({ eventId: eventSignups.eventId })
        .from(eventSignups)
        .where(
          and(inArray(eventSignups.clanMemberId, seatIds), ne(eventSignups.status, 'withdrawn')),
        )
    : null;

  const rows = await db
    .select({
      eventId: events.id,
      name: events.name,
      format: events.format,
      clanSlug: clans.slug,
      clanName: clans.name,
      deadline: events.signupDeadline,
      startDate: events.startDate,
      clanId: events.clanId,
      visibility: events.visibility,
    })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(
      and(
        inArray(events.clanId, clanIds),
        isNull(events.forceEndedAt),
        // THE WINDOW IS `signupWindowState`, TRANSLATED — not a rule invented here. That helper is
        // what the sign-up form itself obeys, and the first cut of this query diverged from it in a
        // way that mattered: it closed on `endDate`, so an event that had already STARTED but not
        // finished was offered with a "Sign up" button that lands on a locked form.
        //
        // Closes on START, not end — and a board with NO start is a draft, which is not open at all.
        // This clause used to admit a null start, so the one surface that lists sign-ups across
        // every clan was also the only place an unfinished board could be found and entered.
        gt(events.startDate, nowIso),
        or(isNull(events.signupDeadline), gt(events.signupDeadline, nowIso)),
        or(isNull(events.signupOpensAt), lte(events.signupOpensAt, nowIso)),
        entered ? notInArray(events.id, entered) : sql`true`,
      ),
    )
    .orderBy(asc(sql`coalesce(${events.signupDeadline}, ${events.startDate})`))
    .limit(8);

  return rows;
}

/**
 * The person's accounts, and what each did this week.
 *
 * The apex is the only surface where this is even askable. A clan sees the accounts that hold a seat
 * with it (lib/accountVisibility); only here does "you" mean the player rather than one character,
 * which is the whole three-level model — person, account, seat — made visible in one list.
 */
export async function characterList(playerId: number | null | undefined): Promise<Character[]> {
  if (playerId == null) return [];
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  // clan-scope: global -- a person's characters are theirs. The clan named per account below comes
  // from that account's OWN member seat, not from a clan filter over the query.
  const rows = await db
    .select({ id: accounts.id, rsn: accounts.rsn })
    .from(accounts)
    .where(eq(accounts.playerId, playerId));
  if (rows.length === 0) return [];

  // THREE PLAIN QUERIES, not one clever correlated select. The first attempt put the week's total
  // and the clan name in `sql` templates inside the select list, and Drizzle emitted the interpolated
  // columns UNQUALIFIED there — `where "account_id" = "id"` — which is ambiguous against the outer
  // row and simply fails. A join in JavaScript over a handful of accounts costs nothing and is
  // readable, which the subquery version was not.
  const ids = rows.map((r) => r.id);

  const [weeks, seats] = await Promise.all([
    db
      .select({ accountId: memberDailyStats.accountId, n: sql<number>`sum(${memberDailyStats.xpGained})` })
      .from(memberDailyStats)
      .where(and(inArray(memberDailyStats.accountId, ids), sql`${memberDailyStats.day} >= ${weekAgo}`))
      .groupBy(memberDailyStats.accountId),
    db
      .select({ accountId: clanMemberships.accountId, name: clans.name })
      .from(clanMemberships)
      .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
      .where(
        and(
          inArray(clanMemberships.accountId, ids),
          // A MEMBER seat only. Guesting in a clan is playing there, not belonging to it, and an
          // account holds at most one member seat — which is what makes this single-valued.
          eq(clanMemberships.kind, 'member'),
          isNull(clanMemberships.leftAt),
        ),
      ),
  ]);

  const xpBy = new Map(weeks.map((w) => [w.accountId, Number(w.n ?? 0)]));
  const clanBy = new Map(seats.map((c) => [c.accountId, c.name]));

  return rows
    .map((r) => ({
      id: r.id,
      rsn: r.rsn,
      xpThisWeek: xpBy.get(r.id) ?? 0,
      clanName: clanBy.get(r.id) ?? null,
    }))
    .sort((a, b) => b.xpThisWeek - a.xpThisWeek || a.rsn.localeCompare(b.rsn));
}

/** Live seats a clan has, for the "x of y playing" line. Cheap enough to ask per view. */
export async function rosterSize(clanId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'member')));
  return Number(row?.n ?? 0);
}

/**
 * Which of these clans has something running — ids only.
 *
 * The shell's rail wants one dot per clan and nothing else, and asking `apexHomeView` for that would
 * drag names, XP and character counts onto every apex render. Two id-only selects instead, both
 * bounded by the person's own clan list, which is short.
 */
export async function clansWithSomethingLive(clanIds: number[]): Promise<Set<number>> {
  if (clanIds.length === 0) return new Set();
  const nowIso = new Date().toISOString();

  const [ev, wk] = await Promise.all([
    db
      .selectDistinct({ clanId: events.clanId })
      .from(events)
      .where(
        and(
          inArray(events.clanId, clanIds),
          isNull(events.forceEndedAt),
          sql`${events.startDate} is not null and ${events.startDate} <= ${nowIso}`,
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
    db
      .selectDistinct({ clanId: weeklyCompetitions.clanId })
      .from(weeklyCompetitions)
      .where(and(inArray(weeklyCompetitions.clanId, clanIds), eq(weeklyCompetitions.status, 'active'))),
  ]);

  return new Set([...ev, ...wk].map((r) => r.clanId));
}

/**
 * Public boards across the platform, from clans this person is NOT in — "Open to everyone".
 *
 * THE HOST'S CONSENTS, ALL REQUIRED. The board is `public` (anyone may look), the host ticked
 * `advertised` (point strangers at it — readable by link is not the same as asking for traffic), and
 * its clan is LISTED (public, and not opted out of the showcase — lib/clanListing). And the person's
 * own switch, `players.discover_events`: on by default, null here when off.
 *
 * Their own clans are excluded — including ones they only guest in — because those already have
 * their own sections above; this is for finding something new. Live and upcoming only, never a
 * draft, never one they have already entered.
 */
export async function discoverEvents(
  playerId: number | null | undefined,
  ownClanIds: number[],
  limit = 6,
): Promise<DiscoverEvent[] | null> {
  if (playerId != null) {
    const me = await db.query.players.findFirst({ where: eq(players.id, playerId), columns: { discoverEvents: true } });
    if (me && !me.discoverEvents) return null;
  }
  const nowIso = new Date().toISOString();

  // clan-scope: global -- the platform-wide feed of advertised boards; both consents are in the WHERE.
  const rows = await db
    .select({
      eventId: events.id,
      name: events.name,
      clanSlug: clans.slug,
      clanName: clans.name,
      clanLogoUrl: clans.logoUrl,
      startDate: events.startDate,
      endDate: events.endDate,
      signupDeadline: events.signupDeadline,
      signupOpensAt: events.signupOpensAt,
    })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .leftJoin(settings, showcaseJoinOn())
    .where(
      and(
        listedClanWhere(),
        eq(events.visibility, 'public'),
        eq(events.advertised, true),
        isNull(events.forceEndedAt),
        // A board with no start is a draft; one whose end has passed is over.
        sql`${events.startDate} is not null`,
        or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ownClanIds.length ? notInArray(events.clanId, ownClanIds) : sql`true`,
      ),
    )
    .orderBy(asc(events.startDate))
    .limit(limit * 3);

  const entered = playerId != null ? await enteredEventIds(playerId, rows.map((r) => r.eventId)) : new Set<number>();
  return rows
    .filter((r) => !entered.has(r.eventId))
    .map((r) => {
      const live = !!r.startDate && r.startDate <= nowIso;
      return {
        eventId: r.eventId,
        name: r.name,
        clanSlug: r.clanSlug,
        clanName: r.clanName,
        clanLogoUrl: r.clanLogoUrl,
        startDate: r.startDate,
        endDate: r.endDate,
        live,
        // Same window as openSignups: closes on start, respects deadline and opening time.
        takingEntries:
          !live &&
          (!r.signupDeadline || r.signupDeadline > nowIso) &&
          (!r.signupOpensAt || r.signupOpensAt <= nowIso),
      };
    })
    // Taking entries first — that is the one a player can act on — then soonest.
    .sort((a, b) => Number(b.takingEntries) - Number(a.takingEntries))
    .slice(0, limit);
}
