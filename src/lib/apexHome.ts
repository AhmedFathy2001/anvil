import { and, asc, desc, eq, gt, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanMemberships,
  clans,
  eventSignups,
  events,
  memberDailyStats,
  weeklyCompetitions,
} from '@/db/schema';
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

export interface ApexHomeView {
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
  if (clans.length === 0) {
    // Still worth listing their characters: somebody can play, be tracked, and belong nowhere.
    return { clans: [], openSignups: [], characters: await characterList(playerId) };
  }

  const ids = clans.map((c) => c.id);
  const nowIso = new Date().toISOString();

  const [liveEvents, liveWeeklies, signups, chars] = await Promise.all([
    db
      .select({ clanId: events.clanId, id: events.id, name: events.name })
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
    clans: clans.map((c) => ({ ...c, live: byClan.get(c.id) ?? [] })),
    openSignups: signups,
    characters: chars,
  };
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
 */
export async function openSignups(
  playerId: number | null | undefined,
  clanIds: number[],
): Promise<OpenSignup[]> {
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
    })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(
      and(
        inArray(events.clanId, clanIds),
        isNull(events.forceEndedAt),
        // The window: opened (or always open) and not yet shut.
        or(isNull(events.signupOpensAt), lte(events.signupOpensAt, nowIso)),
        or(isNull(events.signupDeadline), gt(events.signupDeadline, nowIso)),
        // Still worth entering — an event that has already ended is not.
        or(isNull(events.endDate), gt(events.endDate, nowIso)),
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

  // clan-scope: global -- a person's characters are theirs. The clan column below is derived from
  // each account's own member seat, not from a clan filter on the query.
  const rows = await db
    .select({
      id: accounts.id,
      rsn: accounts.rsn,
      xpThisWeek: sql<number>`coalesce((
        select sum(${memberDailyStats.xpGained}) from ${memberDailyStats}
        where ${memberDailyStats.accountId} = ${accounts.id} and ${memberDailyStats.day} >= ${weekAgo}
      ), 0)`,
      clanName: sql<string | null>`(
        select ${clans.name} from ${clanMemberships}
        join ${clans} on ${clans.id} = ${clanMemberships.clanId}
        where ${clanMemberships.accountId} = ${accounts.id}
          and ${clanMemberships.kind} = 'member' and ${clanMemberships.leftAt} is null
        limit 1
      )`,
    })
    .from(accounts)
    .where(eq(accounts.playerId, playerId))
    .orderBy(desc(sql`coalesce((
      select sum(${memberDailyStats.xpGained}) from ${memberDailyStats}
      where ${memberDailyStats.accountId} = ${accounts.id} and ${memberDailyStats.day} >= ${weekAgo}
    ), 0)`));

  return rows.map((r) => ({ ...r, xpThisWeek: Number(r.xpThisWeek ?? 0) }));
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
