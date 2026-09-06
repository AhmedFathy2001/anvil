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

/**
 * The event a command should answer about: running first, then the soonest upcoming, then the most
 * recently ended. Drafts (no dates at all) are deliberately last — an unscheduled board is a work
 * in progress, not something to report standings for.
 */
export async function pickEvent(now: Date = new Date()): Promise<EventContext | null> {
  // clan-scope: global -- a Discord guild maps to exactly one clan, and this lookup IS that mapping.
  const rows = await db.select().from(events);
  if (rows.length === 0) return null;

  const at = now.getTime();
  const phaseOf = (e: (typeof rows)[number]): EventPhase => {
    const stage = eventStage(e, at);
    if (stage === 'run') return 'running';
    if (stage === 'wrap') return 'ended';
    return e.startDate ? 'upcoming' : 'draft';
  };

  const rank: Record<EventPhase, number> = { running: 0, upcoming: 1, ended: 2, draft: 3 };
  const sorted = [...rows].sort((a, b) => {
    const pa = phaseOf(a);
    const pb = phaseOf(b);
    if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb];
    // Within a phase: soonest-starting for upcoming, most-recent for everything else.
    if (pa === 'upcoming') return Date.parse(a.startDate ?? '') - Date.parse(b.startDate ?? '');
    return Date.parse(b.endDate ?? b.startDate ?? b.createdAt) - Date.parse(a.endDate ?? a.startDate ?? a.createdAt);
  });

  const chosen = sorted[0];
  const [teamRows, playerRows] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, chosen.id)),
    db.select({ id: players.id }).from(eventParticipants).where(eq(eventParticipants.eventId, chosen.id)),
  ]);

  return {
    id: chosen.id,
    name: chosen.name,
    phase: phaseOf(chosen),
    format: chosen.format,
    scoringMode: chosen.scoringMode,
    boardSize: chosen.boardSize,
    rules: chosen.rules,
    startDate: chosen.startDate,
    endDate: chosen.endDate,
    tilesRevealed: chosen.tilesRevealed === 1,
    teamCount: teamRows.length,
    playerCount: playerRows.length,
  };
}

/** Load one event by id, in the same shape pickEvent returns. */
export async function loadEvent(eventId: number, now: Date = new Date()): Promise<EventContext | null> {
  // clan-scope: global -- a Discord guild maps to exactly one clan, and this lookup IS that mapping.
  const row = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!row) return null;
  const stage = eventStage(row, now.getTime());
  const [teamRows, playerRows] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, row.id)),
    db.select({ id: players.id }).from(eventParticipants).where(eq(eventParticipants.eventId, row.id)),
  ]);
  return {
    id: row.id,
    name: row.name,
    phase: stage === 'run' ? 'running' : stage === 'wrap' ? 'ended' : row.startDate ? 'upcoming' : 'draft',
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

/** Resolve the Discord user who typed the command to their roster rows on this instance. */
export interface InvokerIdentity {
  userId: number | null;
  displayName: string | null;
  /** Their linked accounts (clan_members ids), newest link last. Empty = not on the roster. */
  memberIds: number[];
  /** Primary RSN for prose, when they have one. */
  rsn: string | null;
}

export async function resolveInvoker(discordId: string): Promise<InvokerIdentity> {
  const user = await db.query.users.findFirst({ where: eq(users.discordId, discordId) });
  if (!user) {
    // Not a site user — they may still be a roster row linked only by the legacy discord_id column.
    // clan-scope: global -- a Discord guild maps to exactly one clan, and this lookup IS that mapping.
    const legacy = await db
      .select({ id: clanRoster.id, rsn: clanRoster.rsn })
      .from(clanRoster)
      .where(and(eq(clanRoster.discordId, discordId), isNull(clanRoster.leftAt)));
    return {
      userId: null,
      displayName: null,
      memberIds: legacy.map((m) => m.id),
      rsn: legacy[0]?.rsn ?? null,
    };
  }
  // clan-scope: global -- a Discord guild maps to exactly one clan, and this lookup IS that mapping.
  const members = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, isPrimary: clanRoster.isPrimary })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.id), isNull(clanRoster.leftAt)));
  const primary = members.find((m) => m.isPrimary === 1) ?? members[0];
  return {
    userId: user.id,
    displayName: user.displayName,
    memberIds: members.map((m) => m.id),
    rsn: primary?.rsn ?? null,
  };
}
