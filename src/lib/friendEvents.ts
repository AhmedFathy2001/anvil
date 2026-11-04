// Friends events — the database half (rules: lib/friendEventRules).
//
// THE HOST. One hidden `clans` row per person, `kind = 'friends'`, made the first time they host
// (ensureFriendsHost): platform-hidden and members-only like the tile-lab clan (lib/lab), so every
// listing, leaderboard, Wrapped, sitemap and Discord card that is already clan-scoped misses it; no
// in-game name, so no roster sync can land in it; guests closed, so nobody gets a clan seat in it.
// Players arrive through an invite link (/f/<token>) as EVENT players of one event (lib/eventPlayers),
// exactly like a creator space's viewers.
//
// THE GATES. Two writes can take a host past its Supporter tier, and both go through here under ONE
// per-host advisory lock, so joins and date changes serialise against each other:
//
//   withHostEventRoom    a sign-up that adds seats   → friendsJoinVerdict (the aggregate peak)
//   withHostEventSlot    create / clone / re-date    → friendsScheduleVerdict (tier, live limit, peak)
//
// Both dispatch: a creator space or a clan goes to lib/creatorPlansDb exactly as before, untouched. An
// event belongs to one host, so it is metered by exactly one of the two, never both.

import crypto from 'node:crypto';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanStaff, clans, eventInvites, eventSignups, events, users } from '@/db/schema';
import { ON_BOARD_STATUSES } from '@/lib/creatorPlans';
import { PlanLimitError, withEventRoom, withLiveEventSlot, type Executor } from '@/lib/creatorPlansDb';
import { canSeeEvent } from '@/lib/eventAccess';
import { eventStage } from '@/lib/eventStage';
import { FEATURES_OFF_SETTING, serializeFeaturesOff } from '@/lib/features';
import {
  FRIENDS_FEATURES_OFF,
  FRIENDS_KIND,
  friendsAllowsPublicPath,
  eventWindow,
  friendsHostName,
  friendsJoinVerdict,
  friendsScheduleVerdict,
  isFriendsHost,
  isInviteToken,
  isLiveFriendsEvent,
  mayHostFriends,
  peakSeats,
  type FriendsEventRow,
  type FriendsVerdict,
} from '@/lib/friendEventRules';
import { setSetting } from '@/lib/settings';
import { supporterForUser, type SupporterTierId } from '@/lib/supporter';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Advisory-lock namespace (pg_advisory_xact_lock(ns, hostId)): one lock per friends host for every
// write that could take it past its tier — joins and date changes alike. Distinct from the creator
// meters' namespaces (lib/creatorPlansDb), which a friends host never takes.
const FRIENDS_HOST_LOCK = 1129336670;

async function lockFriendsHost(tx: Executor, hostId: number): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${FRIENDS_HOST_LOCK}, ${hostId})`);
}


export interface FriendsHost {
  id: number;
  slug: string;
  name: string;
}

/** This person's friends host, if they ever hosted. */
export async function friendsHostOf(userId: number): Promise<FriendsHost | null> {
  // clan-scope: this clan -- the person's own hidden host, by its owner column.
  const row = await db.query.clans.findFirst({
    where: and(eq(clans.friendsOwnerUserId, userId), eq(clans.kind, FRIENDS_KIND)),
    columns: { id: true, slug: true, name: true },
  });
  return row ?? null;
}

/** The Supporter tier in force for this login, or null (lib/friendEventRules header: what counts). */
export async function hostingTierOf(userId: number | null | undefined): Promise<SupporterTierId | null> {
  if (userId == null) return null;
  const s = await supporterForUser(userId).catch(() => null);
  return s?.tier.id ?? null;
}

/** The tier that caps this friends host right now: its owner's. Null when it has no owner any more. */
export async function tierOfFriendsHost(hostId: number, tx: Executor = db): Promise<SupporterTierId | null> {
  // clan-scope: this clan -- the host's own owner column.
  const [row] = await tx.select({ owner: clans.friendsOwnerUserId }).from(clans).where(eq(clans.id, hostId)).limit(1);
  return hostingTierOf(row?.owner ?? null);
}

function newHostSlug(): string {
  // Unguessable and never shown as an address anybody is meant to type: the host has no public page.
  return `f-${crypto.randomBytes(6).toString('hex')}`;
}

export type EnsureHostResult = { ok: true; host: FriendsHost; created: boolean } | { ok: false; error: string; reason: 'not-supporter' };

/**
 * The person's friends host, made on first use. Making one needs a Supporter tier in force; somebody
 * whose tier lapsed keeps theirs (and its events), they just cannot start new ones.
 */
export async function ensureFriendsHost(userId: number): Promise<EnsureHostResult> {
  const existing = await friendsHostOf(userId);
  if (existing) return { ok: true, host: existing, created: false };
  const may = mayHostFriends(await hostingTierOf(userId));
  if (!may.ok) return { ok: false, error: may.error, reason: 'not-supporter' };

  // clan-scope: global -- the owner's display name, for the host's private label.
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true, discordUsername: true } });
  const name = friendsHostName(user?.displayName || user?.discordUsername);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clans)
      .values({
        slug: newHostSlug(),
        name,
        kind: FRIENDS_KIND,
        friendsOwnerUserId: userId,
        // Never a roster: roster sync matches on this, and nothing may sync into a friends host.
        inGameName: null,
        // A clan-ladder id, as `clans_plan_matches_kind` asks of anything that is not a creator space.
        // Never read: a friends host is capped by its owner's Supporter tier (lib/friendEventRules).
        plan: 'free',
        status: 'active',
        // Nobody gets a clan seat here: players are event players of one event each.
        guestPolicy: 'closed',
        // Closed to strangers and hidden by the platform — what keeps it off every listing (lib/clanListing).
        visibility: 'members',
        platformHidden: true,
        highlightsAutoClip: false,
      })
      // The partial unique index on the owner: two tabs pressing "Host for friends" make one host.
      .onConflictDoNothing()
      .returning({ id: clans.id, slug: clans.slug, name: clans.name });
    if (!row) return null;
    await tx.insert(clanStaff).values({ clanId: row.id, userId, role: 'owner', canEditTiles: true });
    await tx.insert(clanAuditLog).values({
      clanId: row.id,
      eventType: 'clan_created',
      actorUserId: userId,
      newValue: JSON.stringify({ kind: FRIENDS_KIND, plan: 'free' }),
    });
    return row;
  });
  if (!created) {
    const raced = await friendsHostOf(userId);
    if (raced) return { ok: true, host: raced, created: false };
    throw new Error('friends host could not be created');
  }
  await setSetting(created.id, FEATURES_OFF_SETTING, serializeFeaturesOff(FRIENDS_FEATURES_OFF));
  return { ok: true, host: created, created: true };
}

// ── The host's events, for the gates ────────────────────────────────────────────────────────────

/** Every event of this host with its seats on the board (pending + approved sign-ups). */
export async function friendsEventRows(hostId: number, tx: Executor = db): Promise<FriendsEventRow[]> {
  // clan-scope: this clan -- the host's own events and their sign-up counts.
  const rows = await tx
    .select({
      id: events.id,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      seats: count(eventSignups.id),
    })
    .from(events)
    .leftJoin(eventSignups, and(eq(eventSignups.eventId, events.id), inArray(eventSignups.status, [...ON_BOARD_STATUSES])))
    .where(eq(events.clanId, hostId))
    .groupBy(events.id, events.startDate, events.endDate, events.forceEndedAt);
  return rows.map((r) => ({ ...r, seats: Number(r.seats) }));
}

/** The friends host behind this event, or null when its host is anything else. */
export async function friendsHostOfEvent(eventId: number, tx: Executor = db): Promise<number | null> {
  // clan-scope: global -- the event by its own id; its host is read back from it.
  const [row] = await tx
    .select({ clanId: events.clanId, kind: clans.kind })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(eq(events.id, eventId))
    .limit(1);
  return row && isFriendsHost(row) ? row.clanId : null;
}

/**
 * Would `adding` more seats on this friends event push the host's peak over its tier? Null when the
 * event is not a friends event (the caller's creator/clan rules apply). The cheap early check; the
 * one that holds under a rush is withHostEventRoom's.
 */
export async function friendsJoinCheck(eventId: number, adding: number, tx: Executor = db): Promise<FriendsVerdict | null> {
  const hostId = await friendsHostOfEvent(eventId, tx);
  if (hostId == null) return null;
  const [rows, tier] = await Promise.all([friendsEventRows(hostId, tx), tierOfFriendsHost(hostId, tx)]);
  const target = rows.find((r) => r.id === eventId);
  if (!target) return { ok: true };
  const loads = rows.map((r) => ({ id: r.id, window: eventWindow(r), seats: r.seats }));
  return friendsJoinVerdict({
    tier,
    target: loads.find((l) => l.id === eventId)!,
    others: loads.filter((l) => l.id !== eventId),
    adding,
  });
}

/**
 * lib/creatorPlansDb withEventRoom, for any host: a friends event runs the write under the host's
 * lock and re-checks the aggregate peak with the write in it (rolling back with a PlanLimitError, so
 * the routes' existing catch answers it); anything else is withEventRoom unchanged.
 */
export async function withHostEventRoom<T>(
  opts: { eventId: number; clanPlan: string | null; adding: number },
  write: (tx: Tx) => Promise<T>,
): Promise<T> {
  const hostId = await friendsHostOfEvent(opts.eventId);
  if (hostId == null) return withEventRoom(opts, write);
  return db.transaction(async (tx) => {
    const metered = opts.adding > 0;
    if (metered) await lockFriendsHost(tx, hostId);
    const out = await write(tx);
    if (metered) {
      const rows = await friendsEventRows(hostId, tx);
      const loads = rows.map((r) => ({ id: r.id, window: eventWindow(r), seats: r.seats - (r.id === opts.eventId ? opts.adding : 0) }));
      const target = loads.find((l) => l.id === opts.eventId);
      if (target) {
        const v = friendsJoinVerdict({ tier: await tierOfFriendsHost(hostId, tx), target, others: loads.filter((l) => l !== target), adding: opts.adding });
        if (!v.ok) throw new PlanLimitError(v.error);
      }
    }
    return out;
  });
}

/**
 * lib/creatorPlansDb withLiveEventSlot, for any host. A friends host: under its lock, snapshot its
 * events, run the write, snapshot again and judge every event the write changed
 * (friendsScheduleVerdict — a tier to create, the live limit, the aggregate peak), rolling back with
 * a PlanLimitError. Always checked for a friends host, whatever `clanPlan` says (that is the creator
 * meter's switch). Anything else: withLiveEventSlot unchanged.
 */
export async function withHostEventSlot<T>(
  host: { id: number; kind?: string | null },
  opts: { clanId: number; clanPlan: string | null; exceptEventId?: number },
  write: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!isFriendsHost(host)) return withLiveEventSlot(opts, write);
  return db.transaction(async (tx) => {
    await lockFriendsHost(tx, host.id);
    const before = await friendsEventRows(host.id, tx);
    const out = await write(tx);
    const after = await friendsEventRows(host.id, tx);
    const v = friendsScheduleVerdict({ tier: await tierOfFriendsHost(host.id, tx), before, after });
    if (!v.ok) throw new PlanLimitError(v.error);
    return out;
  });
}

// ── The invite link ──────────────────────────────────────────────────────────────────────────────

/** A fresh invite token: 18 random bytes, base64url (24 characters, lib/friendEventRules). */
export function newInviteToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

/** This friends event's token, minting one if it has none (an event made before the link existed). */
export async function ensureInviteToken(eventId: number): Promise<string | null> {
  if ((await friendsHostOfEvent(eventId)) == null) return null;
  // clan-scope: global -- the event by id, just checked to be a friends event.
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { inviteToken: true } });
  if (ev?.inviteToken) return ev.inviteToken;
  const token = newInviteToken();
  await db.update(events).set({ inviteToken: token }).where(and(eq(events.id, eventId), sql`${events.inviteToken} is null`));
  // clan-scope: global -- the same friends event, read back after the write.
  const again = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { inviteToken: true } });
  return again?.inviteToken ?? null;
}

/** A new link for this event: the old one stops working (somebody shared it wider than meant). */
export async function rotateInviteToken(eventId: number): Promise<string | null> {
  if ((await friendsHostOfEvent(eventId)) == null) return null;
  const token = newInviteToken();
  // clan-scope: global -- the event by id, just checked to be a friends event.
  await db.update(events).set({ inviteToken: token }).where(eq(events.id, eventId));
  return token;
}

export interface InviteTarget {
  eventId: number;
  eventName: string;
  hostSlug: string;
  hostName: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
}

/** What an invite link opens, or null for a token that is not one (or not a friends event's). */
export async function inviteTarget(token: string): Promise<InviteTarget | null> {
  if (!isInviteToken(token)) return null;
  // clan-scope: global -- an invite link names its event by token; the host is checked to be a friends host.
  const [row] = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      hostSlug: clans.slug,
      hostName: clans.name,
      hostKind: clans.kind,
      hostStatus: clans.status,
      ownerName: users.displayName,
    })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .leftJoin(users, eq(users.id, clans.friendsOwnerUserId))
    .where(eq(events.inviteToken, token))
    .limit(1);
  if (!row || !isFriendsHost({ kind: row.hostKind }) || row.hostStatus !== 'active') return null;
  return {
    eventId: row.eventId,
    eventName: row.eventName,
    hostSlug: row.hostSlug,
    hostName: row.hostName,
    ownerName: row.ownerName,
    startDate: row.startDate,
    endDate: row.endDate,
    forceEndedAt: row.forceEndedAt,
  };
}

/**
 * Press the link: the person is invited to this one event (an ordinary event_invites row), which is
 * what lets them see the `invited` board and enter it through the usual join (lib/eventEntry). No
 * seat and no sign-up yet — the cap is checked when they sign up, like everywhere else.
 */
export async function acceptInvite(opts: { token: string; playerId: number; userId: number }): Promise<InviteTarget | null> {
  const target = await inviteTarget(opts.token);
  if (!target) return null;
  await db
    .insert(eventInvites)
    .values({ eventId: target.eventId, playerId: opts.playerId, invitedByUserId: null, note: 'friends invite link' })
    .onConflictDoNothing();
  return target;
}

// ── The host's own list ─────────────────────────────────────────────────────────────────────────

export interface FriendsEventSummary {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  seats: number;
  live: boolean;
  inviteToken: string | null;
}

/** The person's friends events, newest first, for /host/friends and the sidebar. */
export async function friendsEventsFor(userId: number): Promise<{ host: FriendsHost | null; events: FriendsEventSummary[] }> {
  const host = await friendsHostOf(userId);
  if (!host) return { host: null, events: [] };
  const rows = await friendsEventRows(host.id);
  const seats = new Map(rows.map((r) => [r.id, r.seats]));
  // clan-scope: this clan -- the person's own friends host.
  const list = await db
    .select({ id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate, forceEndedAt: events.forceEndedAt, inviteToken: events.inviteToken })
    .from(events)
    .where(eq(events.clanId, host.id))
    .orderBy(desc(events.createdAt));
  const now = Date.now();
  return {
    host,
    events: list.map((e) => ({ ...e, seats: seats.get(e.id) ?? 0, live: isLiveFriendsEvent(e, now) })),
  };
}

/** The host's meter: the most seats its events hold at once from now on (live and upcoming). */
export function friendsPeakNow(rows: readonly FriendsEventRow[], now = Date.now()): number {
  return peakSeats(
    rows.map((r) => ({ id: r.id, window: eventWindow(r), seats: r.seats })),
    { start: now, end: Infinity },
  );
}

/** The apex sidebar's "Friends events" group (components/PlatformRail), or null to leave it out. */
export interface FriendsRailEntry {
  /** The ones running now, linked straight to their boards. */
  live: { id: number; name: string; href: string }[];
  total: number;
}

/**
 * Shown to somebody who has a friends host (even after a lapse — their events are still there) or
 * who could make one now (a tier in force). Everyone else: null.
 */
export async function friendsRailEntry(userId: number): Promise<FriendsRailEntry | null> {
  const { host, events: list } = await friendsEventsFor(userId);
  if (!host) return (await hostingTierOf(userId)) ? { live: [], total: 0 } : null;
  return {
    total: list.length,
    // Running now only: an upcoming event counts toward the live limit, but is not "on" yet.
    live: list
      .filter((e) => eventStage(e) === 'run')
      .slice(0, 4)
      .map((e) => ({ id: e.id, name: e.name, href: `/c/${host.slug}/events/${e.id}` })),
  };
}

/**
 * May this visitor read this page of a friends host (app/layout)? Its staff: any page. Anybody else:
 * an event's own pages (/events/<id>…) when they may see that event — invited through its link, or
 * holding its seat (lib/eventAccess canSeeEvent). Nothing else of the host is anybody's to read.
 */
export async function friendsPageReadable(opts: {
  clanId: number;
  pathname: string;
  playerId: number | null;
  userId: number | null;
}): Promise<boolean> {
  if (opts.userId != null) {
    // clan-scope: this clan -- a staff grant in the friends host being rendered.
    const [grant] = await db
      .select({ id: clanStaff.id })
      .from(clanStaff)
      .where(and(eq(clanStaff.clanId, opts.clanId), eq(clanStaff.userId, opts.userId)))
      .limit(1);
    if (grant) return true;
  }
  if (!friendsAllowsPublicPath(opts.pathname)) return false;
  const eventId = Number(opts.pathname.split('/')[2]);
  if (!Number.isInteger(eventId)) return false;
  // clan-scope: this clan -- the event must be this host's own.
  const [ev] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.clanId, opts.clanId))).limit(1);
  if (!ev) return false;
  return canSeeEvent({ eventId, playerId: opts.playerId });
}

// ── The one gate for every other way onto a board ───────────────────────────────────────────────
//
// The self-serve sign-up writes inside withHostEventRoom's transaction. Every OTHER path that puts a
// seat on a friends board — an admin signing somebody up on their behalf, approving a rejected or
// withdrawn sign-up, adding players by hand (with their sign-up backfill), seating a captain — writes
// through `db` itself, so it goes through here instead: under the SAME per-host lock, check the
// aggregate peak with `adding` more seats, then run the write while the lock is still held. Every
// gated writer serialises on that lock, so check-then-write cannot be raced past the cap. Not a
// friends event, or nothing added: the write runs as it always did (the creator meter is #334's).

/** Seats a status change adds to the board: 1 when it goes from off (none/withdrawn/rejected) to on (pending/approved). */
export function seatsAdded(prior: string | null | undefined, next: string): number {
  const on = (s: string | null | undefined) => s === 'pending' || s === 'approved';
  return on(next) && !on(prior) ? 1 : 0;
}

/** How many of these seats have no on-board sign-up on this event yet: the places writing one for each would take. */
export async function seatsWithoutSignup(eventId: number, clanMemberIds: number[]): Promise<number> {
  if (clanMemberIds.length === 0) return 0;
  // clan-scope: global -- one event's sign-ups for seats the caller already scoped to it.
  const rows = await db
    .select({ seat: eventSignups.clanMemberId })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), inArray(eventSignups.clanMemberId, clanMemberIds), inArray(eventSignups.status, [...ON_BOARD_STATUSES])));
  const onBoard = new Set(rows.map((r) => r.seat));
  return new Set(clanMemberIds.filter((id) => !onBoard.has(id))).size;
}

/**
 * Run `write`, which may put `adding` more seats on this event's board. On a friends event it runs
 * under the host's lock after the aggregate check, and a refusal throws a PlanLimitError before
 * anything is written. Anything else: `write()` exactly as before.
 */
export async function guardFriendsSeats<T>(eventId: number, adding: number, write: () => Promise<T>): Promise<T> {
  if (adding <= 0) return write();
  const hostId = await friendsHostOfEvent(eventId);
  if (hostId == null) return write();
  return db.transaction(async (tx) => {
    await lockFriendsHost(tx, hostId);
    const verdict = await friendsJoinCheck(eventId, adding, tx);
    if (verdict && !verdict.ok) throw new PlanLimitError(verdict.error);
    // The write runs on its own connection and commits before the lock is released (end of this tx).
    return write();
  });
}
