// The tile lab — test any tile kind, with any constraint, on a real account, without a real bingo.
//
// A LAB SESSION IS AN ORDINARY EVENT, OWNED BY A HIDDEN CLAN. That is the whole isolation story, and
// it is chosen over an `is_lab` flag on purpose. A flag would have to be remembered by every one of
// the ~40 places that list, post, digest, recap or rank an event — the tenant-isolation leak class
// all over again. A separate clan is missed by all of them at once, because they are already
// clan-scoped: the lab clan has no Discord channels or webhooks, is `visibility = 'members'` (so no
// directory, leaderboard, showcase or monthly Wrapped lists it), and has no in-game clan name (so no
// roster sync can land in it). Everything that scores, though — tiles, submissions, completions,
// claims, the stat engine — is the real code, which is the point of testing there.
//
// TWO HOLES ARE DRILLED, BOTH HERE:
//
// 1. The plugin finds the session. A player's events are normally the ones their connected clan
//    hosts or co-hosts (lib/auth pluginParticipantScope, lib/eventScope eventForPluginRequest). A
//    lab participant row carries the ACCOUNT and no seat, and those two also accept a live lab event
//    the logged-in character is entered in. Its fresh start time makes it win the active-event pick.
//
// 2. Everything personal is QUARANTINED. A faked pet line would otherwise post to the player's real
//    clan channel, a faked clog unlock would write their real log, a faked level-up their real XP.
//    While a character has a live session, the routes that reach outside the event (notify, moments,
//    clip, clog, pb, coffer, progress, stats) answer 200 and write the body to `lab_log` instead.
//    The cost is honest: real play on that character during a session is not recorded until the
//    next sync. The lab page says so.

import { and, desc, eq, gt, inArray, isNull, lte, ne, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import {
  accounts,
  clans,
  clanStaff,
  completions,
  eventDaySnapshots,
  eventHourSnapshots,
  eventParticipants,
  eventStartProofs,
  events,
  labLog,
  moments,
  pendingNotifications,
  playerEventFacts,
  statTileProgress,
  submissions,
  teams,
  tileClaims,
  tiles,
} from '@/db/schema';
import { log } from '@/lib/logger';
import { personOf } from '@/lib/roster';

/** The lab clan's address. Reserved in lib/clanNames so nobody can found a clan there. */
export const LAB_CLAN_SLUG = 'anvil-lab';

let labClanIdMemo: number | null = null;

/** The lab clan's id, or null if no lab session was ever created on this database. */
export async function labClanId(): Promise<number | null> {
  if (labClanIdMemo != null) return labClanIdMemo;
  // clan-scope: global -- resolving the lab clan itself, by its reserved slug.
  const [row] = await db.select({ id: clans.id }).from(clans).where(eq(clans.slug, LAB_CLAN_SLUG)).limit(1);
  if (row) labClanIdMemo = row.id;
  return row?.id ?? null;
}

/**
 * The lab clan, created on first use, with `actorUserId` holding admin in it — so the ordinary
 * admin pages (tile editor, teams, everything) work on lab boards without a second editor.
 */
export async function ensureLabClan(actorUserId: number): Promise<number> {
  let id = await labClanId();
  if (id == null) {
    const [created] = await db
      .insert(clans)
      .values({
        slug: LAB_CLAN_SLUG,
        name: 'Anvil Tile Lab',
        // No in-game name: roster sync matches on it, and nothing may ever sync into the lab.
        inGameName: null,
        plan: 'free',
        status: 'active',
        // Closed to strangers, which is also what keeps it off every listing (lib/clanListing).
        visibility: 'members',
        // And hidden by the platform, so no listing or Discord card can ever name it.
        platformHidden: true,
        tagline: 'Platform test bench. Not a real clan.',
      })
      .onConflictDoNothing()
      .returning({ id: clans.id });
    id = created?.id ?? (await labClanId());
    if (id == null) throw new Error('lab clan could not be created');
    labClanIdMemo = id;
  }
  await db
    .insert(clanStaff)
    .values({ clanId: id, userId: actorUserId, role: 'admin', canEditTiles: true })
    .onConflictDoNothing();
  return id;
}

/** Whether `clanId` is the lab clan. Cheap after the first call. */
export async function isLabClan(clanId: number | null | undefined): Promise<boolean> {
  if (clanId == null) return false;
  return (await labClanId()) === clanId;
}

/**
 * WHERE fragment: this events.clan_id column is NOT the lab clan. For the few cross-clan reads keyed
 * on the account rather than a clan (yearly Wrapped), which would otherwise count lab boards.
 */
export function notLabClan(clanIdColumn: SQLWrapper): SQL {
  return sql`${clanIdColumn} is distinct from (select "id" from "clans" where "slug" = ${LAB_CLAN_SLUG})`;
}

/** The live-event condition, as SQL. Mirrors lib/pluginEventPick. */
function liveNow(nowIso: string): SQL {
  return and(
    isNull(events.forceEndedAt),
    lte(events.startDate, nowIso),
    or(isNull(events.endDate), gt(events.endDate, nowIso)),
  )!;
}

/**
 * The scope lib/auth adds for the plugin: a live lab event this account is entered in. Undefined
 * when no lab exists, so a database that never used the lab pays one memoised lookup and nothing
 * more.
 */
export async function labParticipantScope(accountId: number): Promise<SQL | undefined> {
  const labId = await labClanId();
  if (labId == null) return undefined;
  return and(eq(events.clanId, labId), eq(eventParticipants.accountId, accountId))!;
}

// A character's live session, memoised briefly: the quarantine check runs on every notify, clog and
// stats push, and a session changes a few times an hour at most.
const SESSION_TTL_MS = 15_000;
const sessionMemo = new Map<number, { at: number; eventId: number | null }>();

/** The live lab session this account is in, or null. */
export async function labSessionFor(accountId: number): Promise<number | null> {
  const hit = sessionMemo.get(accountId);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.eventId;
  const labId = await labClanId();
  let eventId: number | null = null;
  if (labId != null) {
    const [row] = await db
      .select({ id: events.id })
      .from(eventParticipants)
      .innerJoin(events, eq(events.id, eventParticipants.eventId))
      .where(and(eq(events.clanId, labId), eq(eventParticipants.accountId, accountId), liveNow(new Date().toISOString())))
      .orderBy(desc(events.startDate))
      .limit(1);
    eventId = row?.id ?? null;
  }
  sessionMemo.set(accountId, { at: Date.now(), eventId });
  return eventId;
}

/** Forget memoised sessions after the lab page changes one, so it takes effect on the next push. */
export function forgetLabSessions(accountIds?: number[]): void {
  if (!accountIds) sessionMemo.clear();
  else for (const id of accountIds) sessionMemo.delete(id);
}

const MAX_LOGGED_BYTES = 16_000;

/** Sent by the plugin's test harness while a replayed scenario is playing (its value is the name). */
export const SCENARIO_HEADER = 'x-anvil-scenario';

/**
 * Divert a push from a character in a live lab session. Returns the response the route should send
 * (a 200 the plugin treats as delivered), or null when the character is not in a session and the
 * route carries on as normal.
 */
export async function labQuarantine(
  request: Request,
  /** The pushing character's account, or a resolver for routes that only hold the token's user. */
  account: number | null | undefined | (() => Promise<number | null | undefined>),
  endpoint: string,
  payload: unknown,
): Promise<NextResponse | null> {
  // The dev client's replay harness stamps every request while a scenario plays (and briefly after).
  // Whatever that push claims happened did not, so it never reaches anything real — session or not.
  const scenario = request.headers.get(SCENARIO_HEADER)?.trim().slice(0, 64) || null;
  // No lab on this database and no replay: nothing to look up, and a resolver is never called.
  if (!scenario && (await labClanId()) == null) return null;
  const accountId = typeof account === 'function' ? await account() : account;
  const eventId = accountId == null ? null : await labSessionFor(accountId);
  if (eventId == null) {
    if (!scenario) return null;
    // A replay with no session to file it under: drop it, and say so to the harness.
    return NextResponse.json({ ok: true, lab: true, dropped: endpoint, scenario });
  }
  let stored: unknown = payload ?? null;
  try {
    const text = JSON.stringify(stored);
    if (text && text.length > MAX_LOGGED_BYTES) stored = { truncated: true, head: text.slice(0, MAX_LOGGED_BYTES) };
  } catch {
    stored = { unserializable: true };
  }
  try {
    await db.insert(labLog).values({ eventId, accountId, endpoint: scenario ? `${endpoint} · ${scenario}` : endpoint, payload: stored });
  } catch (e) {
    log.warn('lab.log-fail', { eventId, endpoint }, e);
  }
  return NextResponse.json({ ok: true, lab: true, quarantined: endpoint });
}

// ── Session management (the /staff/lab page) ─────────────────────────────────────────────────

/**
 * The caller's own characters, main first. A session quarantines its characters' real pushes, so it
 * may only ever hold the staffer's own — never a member's.
 */
export async function ownLabCharacters(userId: number): Promise<{ id: number; rsn: string }[]> {
  const person = await personOf(userId);
  if (person == null) return [];
  return db
    .select({ id: accounts.id, rsn: accounts.rsn })
    .from(accounts)
    .where(and(eq(accounts.playerId, person), ne(accounts.status, 'ignored')))
    .orderBy(desc(accounts.isPrimary), accounts.id);
}

/**
 * "Test in lab" from a real tile: a fresh one-tile session on the caller's main character, the tile
 * copied whole. Mission and reveal state are dropped — the lab tests what the tile tracks, so it is
 * visible and open from the first poll. Null when the caller has no character.
 */
/** What a lab copy of a tile leaves behind: its identity, place, and mission/reveal state. */
const NOT_COPIED = ['id', 'eventId', 'position', 'updatedAt', 'revealAt', 'revealedAt', 'closedAt', 'revealStats', 'mission'] as const;

export async function labSessionFromTile(actorUserId: number, source: typeof tiles.$inferSelect): Promise<number | null> {
  const [main] = await ownLabCharacters(actorUserId);
  if (!main) return null;
  const eventId = await createLabSession(actorUserId, {
    name: `Lab: ${source.label}`.slice(0, 80),
    hours: 2,
    boardSize: 1,
    accounts: [{ accountId: main.id, name: main.rsn }],
  });
  const copy: Partial<typeof tiles.$inferInsert> = { ...source };
  for (const k of NOT_COPIED) delete copy[k];
  await db.update(tiles).set(copy).where(and(eq(tiles.eventId, eventId), eq(tiles.position, 0)));
  return eventId;
}

export interface LabSessionInput {
  name: string;
  /** How long the session runs from now. Capped so a forgotten session cannot quarantine for days. */
  hours: number;
  boardSize: number;
  accounts: { accountId: number; name: string }[];
}

export const MAX_LAB_HOURS = 24;

/** Create a running lab board with one team holding every given account. Returns the event id. */
export async function createLabSession(actorUserId: number, input: LabSessionInput): Promise<number> {
  const clanId = await ensureLabClan(actorUserId);
  const now = new Date();
  const hours = Math.min(Math.max(input.hours, 0.25), MAX_LAB_HOURS);
  const end = new Date(now.getTime() + hours * 3_600_000);
  const size = Math.min(Math.max(Math.round(input.boardSize), 1), 7);

  const eventId = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        clanId,
        name: input.name.trim() || 'Lab session',
        boardSize: size,
        // A minute in the past, so the plugin's "has it started" never races the first poll.
        startDate: new Date(now.getTime() - 60_000).toISOString(),
        endDate: end.toISOString(),
        // Tiles visible from the first poll: the lab tests the tiles, not the reveal.
        tilesRevealed: 1,
        draftStatus: 'complete',
        // Nothing to announce, and nothing that may announce it: latch every lifecycle post as done.
        startNotified: 1,
        startHoldNotified: 1,
        halfwayNotified: true,
        draftNotified: 1,
        draftStartNotified: 1,
      })
      .returning({ id: events.id });
    await tx.insert(tiles).values(
      Array.from({ length: size * size }, (_, i) => ({ eventId: event.id, position: i, label: `Lab tile ${i + 1}` })),
    );
    const [team] = await tx
      .insert(teams)
      .values({ eventId: event.id, name: 'Lab', color: '#d4a84b' })
      .returning({ id: teams.id });
    const seen = new Set<number>();
    for (const a of input.accounts) {
      if (seen.has(a.accountId)) continue;
      seen.add(a.accountId);
      // No seat: the account is the identity (lib/auth labParticipantScope matches on it).
      await tx.insert(eventParticipants).values({ eventId: event.id, accountId: a.accountId, name: a.name, teamId: team.id });
    }
    return event.id;
  });
  forgetLabSessions(input.accounts.map((a) => a.accountId));
  return eventId;
}

/** The lab event with this id, or null if it is not one. Every lab route starts here. */
export async function labEvent(eventId: number) {
  const labId = await labClanId();
  if (labId == null || !Number.isInteger(eventId)) return null;
  const [row] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.clanId, labId))).limit(1);
  return row ?? null;
}

/** End now (or extend) a session. */
export async function setLabSessionEnd(eventId: number, endIso: string | null): Promise<void> {
  const ended = endIso == null;
  await db
    .update(events)
    .set(ended ? { forceEndedAt: new Date().toISOString(), endNotified: 1 } : { endDate: endIso, forceEndedAt: null })
    .where(eq(events.id, eventId));
  forgetLabSessions();
}

/**
 * Wipe every trace of play on a lab board — completions, submissions, claims, stat progress, starting
 * shots, recap counters, moments, the log — keeping the tiles and who is entered, so the same test
 * can run again from nothing.
 */
export async function resetLabSession(eventId: number, opts: { keepLog?: boolean } = {}): Promise<void> {
  await db.transaction(async (tx) => {
    const teamIds = (await tx.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
    if (teamIds.length) {
      await tx.delete(completions).where(inArray(completions.teamId, teamIds));
      await tx.delete(submissions).where(inArray(submissions.teamId, teamIds));
      await tx.delete(statTileProgress).where(inArray(statTileProgress.teamId, teamIds));
    }
    await tx.delete(tileClaims).where(eq(tileClaims.eventId, eventId));
    await tx.delete(eventStartProofs).where(eq(eventStartProofs.eventId, eventId));
    await tx.delete(playerEventFacts).where(eq(playerEventFacts.eventId, eventId));
    await tx.delete(eventDaySnapshots).where(eq(eventDaySnapshots.eventId, eventId));
    await tx.delete(eventHourSnapshots).where(eq(eventHourSnapshots.eventId, eventId));
    await tx.delete(moments).where(eq(moments.eventId, eventId));
    await tx.delete(pendingNotifications).where(eq(pendingNotifications.eventId, eventId));
    if (!opts.keepLog) await tx.delete(labLog).where(eq(labLog.eventId, eventId));
    await tx
      .update(eventParticipants)
      .set({
        statsSnapshot: null,
        snapshotAt: null,
        cachedStats: null,
        pluginStats: null,
        frozenAt: null,
        frozenStats: null,
        deaths: 0,
        lootGpGained: 0,
        pvpKills: 0,
        biggestHit: 0,
        minutesPlayed: 0,
        caTasks: 0,
      })
      .where(eq(eventParticipants.eventId, eventId));
  });
}

/**
 * A replayed scenario (SCENARIO_HEADER) aimed at a board that is NOT a lab board: answered 200 and
 * dropped. A faked pet must never credit a real bingo, whichever site the dev client points at.
 * Null when the request is not a replay, or the event is a lab board and the credit may go ahead.
 */
export async function replayOutsideLab(request: Request, eventId: number | null | undefined): Promise<NextResponse | null> {
  const scenario = request.headers.get(SCENARIO_HEADER)?.trim().slice(0, 64);
  if (!scenario) return null;
  if (eventId != null && (await labEvent(eventId))) return null;
  return NextResponse.json({ ok: true, lab: true, dropped: 'not a lab board', scenario });
}
