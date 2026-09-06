// WHERE a slash command was typed, and WHOSE board it should answer about.
//
// A Discord command carries less context than a web request does. There's no session, no host
// header, no page you were already on — just a guild id, a channel id and a user id. Three things
// have to be re-established before any command can answer safely:
//
//   1. WHICH CLAN. Managed clans share one Anvil bot application, so the same bot is in many
//      servers at once and the guild id is the only thing distinguishing them. The control plane
//      routes on it (Admin /api/discord/interactions) and this module re-checks it here, because a
//      routing bug that served clan A's board into clan B's Discord would leak a private board to
//      the wrong clan. Belt and braces: the site knows its own guild id and refuses anything else.
//
//   2. WHICH EVENT. "the board" means the one running right now; failing that the next one
//      scheduled; failing that the one that just ended. Anything else and a command answers about
//      a board nobody is playing.
//
//   3. WHO ELSE IS IN IT. An Anvil event is not always one clan's — federation lets members of
//      other clans join as guests, so a leaderboard can contain teams built out of visiting
//      players. A reader in one clan's Discord needs to see that, or they'll read a cross-clan
//      board as if it were their own.
//
// Everything here is read-only and cheap; commands compose it and never re-derive it.

import { db } from '@/db';
import { clanRoster, clans, eventParticipants, events, players, settings, teams, users } from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { configuredOrigin } from '@/lib/request-origin';
import { eventStage } from '@/lib/eventStage';
import {
  checkGuild,
  contextLine,
  type ClanContext,
  type CrossClanContext,
  type EventContext,
  type EventPhase,
} from '@/lib/discordScope';

// Re-exported so every importer keeps its single import of this module; the definitions live in
// lib/discordScope, which is free of `@/db`.
export { checkGuild, contextLine };
export type { ClanContext, CrossClanContext, EventContext, EventPhase };

/**
 * The clan a Discord interaction belongs to, found BY GUILD.
 *
 * One Anvil app serves every clan, so "which clan is this?" cannot be read from a global setting
 * any more — it is whichever clan claimed this server. The guild id is stored per clan, so the
 * lookup is by VALUE rather than by key, and a guild nobody claimed resolves to nothing rather than
 * to whichever row happened to come back first.
 *
 * Null means: the bot is in a server no clan on this platform has bound. Refusing is the only safe
 * answer — being installed somewhere is not the same as being that clan.
 */
export async function getClanContext(guildId: string | null): Promise<ClanContext | null> {
  const wanted = guildId?.trim() || '';
  if (!wanted) return null;

  // clan-scope: global -- a Discord guild maps to exactly one clan, and this lookup IS that mapping.
  const guildRow = await db.query.settings.findFirst({
    where: and(eq(settings.key, 'discord_guild_id'), eq(settings.value, wanted)),
  });
  if (!guildRow) return null;

  const [name, languageRow] = await Promise.all([
    getClanDisplayName(guildRow.clanId),
    db.query.settings.findFirst({
      where: and(eq(settings.clanId, guildRow.clanId), eq(settings.key, 'discord_language')),
    }),
  ]);
  return {
    clanId: guildRow.clanId,
    name,
    origin: configuredOrigin(),
    guildId: wanted,
    // Federation was removed; clans live in one app now.
    language: languageRow?.value?.trim() || null,
  };
}

function phaseOf(e: typeof events.$inferSelect, at: number): EventPhase {
  const stage = eventStage(e, at);
  if (stage === 'run') return 'running';
  if (stage === 'wrap') return 'ended';
  return e.startDate ? 'upcoming' : 'draft';
}

/** Build the public EventContext (with team/player counts) from a raw events row. */
async function toEventContext(row: typeof events.$inferSelect, now: Date): Promise<EventContext> {
  const [teamRows, playerRows] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, row.id)),
    db.select({ id: players.id }).from(eventParticipants).where(eq(eventParticipants.eventId, row.id)),
  ]);
  return {
    id: row.id,
    name: row.name,
    phase: phaseOf(row, now.getTime()),
    format: row.format,
    scoringMode: row.scoringMode,
    boardSize: row.boardSize,
    rules: row.rules,
    startDate: row.startDate,
    endDate: row.endDate,
    tilesRevealed: row.tilesRevealed === 1,
    teamCount: teamRows.length,
    playerCount: playerRows.length,
  };
}

/**
 * The event a command should answer about: running first, then the soonest upcoming, then the most
 * recently ended. Drafts (no dates at all) are deliberately last — an unscheduled board is a work
 * in progress, not something to report standings for.
 *
 * SCOPED BY CLAN. One Anvil app serves every clan now (events carries clan_id), so an unscoped scan
 * would let clan A's `/bingo board` resolve clan B's event as "the board". The clanId is the whole
 * point of resolving the guild first.
 */
export async function pickEvent(clanId: number, now: Date = new Date()): Promise<EventContext | null> {
  const rows = await db.select().from(events).where(eq(events.clanId, clanId));
  if (rows.length === 0) return null;

  const at = now.getTime();
  const rank: Record<EventPhase, number> = { running: 0, upcoming: 1, ended: 2, draft: 3 };
  const sorted = [...rows].sort((a, b) => {
    const pa = phaseOf(a, at);
    const pb = phaseOf(b, at);
    if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb];
    // Within a phase: soonest-starting for upcoming, most-recent for everything else.
    if (pa === 'upcoming') return Date.parse(a.startDate ?? '') - Date.parse(b.startDate ?? '');
    return Date.parse(b.endDate ?? b.startDate ?? b.createdAt) - Date.parse(a.endDate ?? a.startDate ?? a.createdAt);
  });

  return toEventContext(sorted[0], now);
}

/**
 * Every board this clan has RUNNING right now, most-recently-started first — the multi-board answer.
 * A clan can run several bingos at once, and picking one silently is how a member reads the wrong
 * board's standings. Empty when nothing is live; the caller falls back to {@link pickEvent} then.
 */
export async function listLiveEvents(clanId: number, now: Date = new Date()): Promise<EventContext[]> {
  const rows = await db.select().from(events).where(eq(events.clanId, clanId));
  const at = now.getTime();
  const live = rows
    .filter((e) => eventStage(e, at) === 'run')
    .sort((a, b) => Date.parse(b.startDate ?? b.createdAt) - Date.parse(a.startDate ?? a.createdAt));
  return Promise.all(live.map((r) => toEventContext(r, now)));
}

/**
 * Load one event by id — but only if it belongs to THIS clan. The clanId check is what stops a
 * shared button or a stale id from reaching across into another clan's board.
 */
export async function loadEvent(eventId: number, clanId: number, now: Date = new Date()): Promise<EventContext | null> {
  const row = await db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.clanId, clanId)) });
  if (!row) return null;
  return toEventContext(row, now);
}

export async function getCrossClanContext(eventId: number): Promise<CrossClanContext> {
  // clan-scope: global -- the event being described, by its own id; its clanId is what every row
  // below is compared against.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { clanId: true },
  });
  if (!event) {
    return { shared: false, visitingPlayers: 0, visitingTeamIds: new Set(), visitingTeamNames: [] };
  }

  // clan-scope: global -- a Discord guild maps to exactly one clan, and this lookup IS that mapping.
  const rows = await db
    .select({
      playerId: players.id,
      teamId: eventParticipants.teamId,
      seatClanId: clanRoster.clanId,
    })
    .from(eventParticipants)
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(eq(eventParticipants.eventId, eventId));

  // Seated somewhere else. A row with no seat at all is not evidence of anything, so it is not
  // counted either way.
  const isVisiting = (r: (typeof rows)[number]) => r.seatClanId != null && r.seatClanId !== event.clanId;

  const visitingTeamIds = new Set<number>();
  const perTeam = new Map<number, { total: number; visiting: number }>();
  let visitingPlayers = 0;

  for (const r of rows) {
    if (isVisiting(r)) visitingPlayers++;
    if (r.teamId == null) continue;
    const bucket = perTeam.get(r.teamId) ?? { total: 0, visiting: 0 };
    bucket.total++;
    if (isVisiting(r)) {
      bucket.visiting++;
      visitingTeamIds.add(r.teamId);
    }
    perTeam.set(r.teamId, bucket);
  }

  const wholeVisitingTeamIds = [...perTeam.entries()]
    .filter(([, b]) => b.total > 0 && b.visiting === b.total)
    .map(([id]) => id);

  // The CLAN's name where the team is a co-host's, falling back to the team's own. A board whose
  // visiting side is "LFL" reads better than one whose visiting side is "Team 2", and the tag is
  // exactly what makes it knowable.
  const visitingTeamNames = wholeVisitingTeamIds.length
    ? (
        await db
          .select({ name: teams.name, clanName: clans.name })
          .from(teams)
          .leftJoin(clans, eq(clans.id, teams.clanId))
          .where(inArray(teams.id, wholeVisitingTeamIds))
      ).map((t) => t.clanName ?? t.name)
    : [];

  return {
    shared: visitingPlayers > 0,
    visitingPlayers,
    visitingTeamIds,
    visitingTeamNames,
  };
}

/** Resolve the Discord user who typed the command to their roster rows IN THIS CLAN. */
export interface InvokerIdentity {
  /** Their site-user id, when they've signed in on the web. Null for a roster-only member. The key
   *  a write command (e.g. /coffer add) checks authority against. */
  userId: number | null;
  displayName: string | null;
  /** Their seats on THIS clan's roster (clan_roster ids). Empty = not on this roster. */
  memberIds: number[];
  /** The ACCOUNTS behind those seats — the key clog/luck/stat history is stored under. */
  accountIds: number[];
  /** The account behind their primary seat, for the single-account commands. */
  primaryAccountId: number | null;
  /** Primary RSN for prose, when they have one. */
  rsn: string | null;
}

/**
 * Resolve the invoker WITHIN a clan. Every roster read is filtered by clanId: the same person can
 * hold a seat in several clans, and a command answering in clan A must never surface their clan B
 * accounts. `clanId` comes from the guild the command was typed in (see {@link getClanContext}).
 */
export async function resolveInvoker(discordId: string, clanId: number): Promise<InvokerIdentity> {
  const user = await db.query.users.findFirst({ where: eq(users.discordId, discordId) });
  if (!user) {
    // Not a site user — they may still be a roster row linked only by the legacy discord_id column.
    const legacy = await db
      .select({ id: clanRoster.id, accountId: clanRoster.accountId, rsn: clanRoster.rsn, isPrimary: clanRoster.isPrimary })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.discordId, discordId), isNull(clanRoster.leftAt)));
    const primaryLegacy = legacy.find((m) => m.isPrimary === 1) ?? legacy[0];
    return {
      userId: null,
      displayName: null,
      memberIds: legacy.map((m) => m.id),
      accountIds: [...new Set(legacy.map((m) => m.accountId))],
      primaryAccountId: primaryLegacy?.accountId ?? null,
      rsn: primaryLegacy?.rsn ?? null,
    };
  }
  const members = await db
    .select({ id: clanRoster.id, accountId: clanRoster.accountId, rsn: clanRoster.rsn, isPrimary: clanRoster.isPrimary })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.playerId, user.id), isNull(clanRoster.leftAt)));
  const primary = members.find((m) => m.isPrimary === 1) ?? members[0];
  return {
    userId: user.id,
    displayName: user.displayName,
    memberIds: members.map((m) => m.id),
    accountIds: [...new Set(members.map((m) => m.accountId))],
    primaryAccountId: primary?.accountId ?? null,
    rsn: primary?.rsn ?? null,
  };
}
