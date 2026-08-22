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
import { events, players, teams, clanMembers, settings, users } from '@/db/schema';
import { en, plural, type DiscordDict } from '@/lib/discordI18n';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getClanDisplayName, getFederationEnabled } from '@/lib/pluginConfig';
import { configuredOrigin } from '@/lib/request-origin';
import { eventStage } from '@/lib/eventStage';

/** The clan whose Discord this is. */
export interface ClanContext {
  /** Display name — the author line on every embed, so no answer is ambiguous about its source. */
  name: string;
  /** Public base URL, for links out of the embed. Null on a self-host that never set APP_URL. */
  origin: string | null;
  /** The Discord server this instance is bound to. Empty when the clan never connected one. */
  guildId: string;
  /** Whether this clan participates in federation at all. */
  federated: boolean;
  /**
   * The clan's chosen bot language, or null for "follow whoever is asking".
   *
   * Set, it wins over Discord's own locale detection — a clan that picks a language has said
   * something detection cannot know, and for Arabic it is the only route in at all because Discord
   * has no Arabic client language to detect.
   */
  language: string | null;
}

export async function getClanContext(): Promise<ClanContext> {
  const [name, guildRow, federated, languageRow] = await Promise.all([
    getClanDisplayName(),
    db.query.settings.findFirst({ where: eq(settings.key, 'discord_guild_id') }),
    getFederationEnabled(),
    db.query.settings.findFirst({ where: eq(settings.key, 'discord_language') }),
  ]);
  return {
    name,
    origin: configuredOrigin(),
    guildId: guildRow?.value?.trim() || process.env.DISCORD_GUILD_ID?.trim() || '',
    federated,
    language: languageRow?.value?.trim() || null,
  };
}

/**
 * Does this interaction belong to this clan's server?
 *
 * 'ok'        — the guild matches (or the clan has no guild configured, so there's nothing to
 *               contradict; a self-host that never set one still gets working commands).
 * 'dm'        — no guild at all. Commands need a clan context, and a DM has none.
 * 'wrong-guild' — the bot is in a server this instance isn't bound to. Refuse rather than serve:
 *               being installed somewhere is not the same as being that clan.
 */
export function checkGuild(clan: ClanContext, guildId: string | undefined): 'ok' | 'dm' | 'wrong-guild' {
  if (!guildId) return 'dm';
  if (!clan.guildId) return 'ok';
  return guildId === clan.guildId ? 'ok' : 'wrong-guild';
}

/** Where an event sits in its life — reused for prose ("running", "starts in…", "ended"). */
export type EventPhase = 'running' | 'upcoming' | 'ended' | 'draft';

export interface EventContext {
  id: number;
  name: string;
  phase: EventPhase;
  format: string;
  scoringMode: string;
  boardSize: number;
  /** Raw rules JSON — needed for the shape badge, which names reveal modes. */
  rules: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Tiles hidden from members until an admin reveals them. */
  tilesRevealed: boolean;
  teamCount: number;
  playerCount: number;
}

/**
 * The event a command should answer about: running first, then the soonest upcoming, then the most
 * recently ended. Drafts (no dates at all) are deliberately last — an unscheduled board is a work
 * in progress, not something to report standings for.
 */
export async function pickEvent(now: Date = new Date()): Promise<EventContext | null> {
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
    db.select({ id: players.id }).from(players).where(eq(players.eventId, chosen.id)),
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
  const row = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!row) return null;
  const stage = eventStage(row, now.getTime());
  const [teamRows, playerRows] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, row.id)),
    db.select({ id: players.id }).from(players).where(eq(players.eventId, row.id)),
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

/**
 * Who from OUTSIDE this clan is playing in this event.
 *
 * A visiting player is a roster row with `source: 'federation'` — one created when another Anvil
 * clan's member exchanged in (see the /federation/v1/exchange route's inserts). That is the ONLY
 * precise signal, and specifically NOT `isGuest`: a guest is anyone who isn't a full member of this
 * clan, which on a normal roster is mostly friends and alts. Counting those as "visiting from other
 * clans" would fire on almost every board and say something untrue.
 *
 * Their HOME clan is not recorded anywhere — the exchange stores only that they arrived through
 * federation — so this reports HOW MANY are visiting and WHICH TEAMS they're on, but never which
 * clan they came from. Naming the clans needs a home-instance column on clan_members; it is worth
 * adding and deliberately not guessed at here.
 */
export interface CrossClanContext {
  /** Any visiting players in this event at all. */
  shared: boolean;
  /** How many of the event's players are visitors. */
  visitingPlayers: number;
  /** Team ids carrying at least one visiting player. */
  visitingTeamIds: Set<number>;
  /** Teams made ENTIRELY of visitors — a whole other clan's side in a cross-clan match. */
  visitingTeamNames: string[];
}

export async function getCrossClanContext(eventId: number): Promise<CrossClanContext> {
  const rows = await db
    .select({
      playerId: players.id,
      teamId: players.teamId,
      source: clanMembers.source,
    })
    .from(players)
    .leftJoin(clanMembers, eq(players.clanMemberId, clanMembers.id))
    .where(eq(players.eventId, eventId));

  const isVisiting = (r: (typeof rows)[number]) => r.source === 'federation';

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

  const visitingTeamNames = wholeVisitingTeamIds.length
    ? (
        await db
          .select({ name: teams.name })
          .from(teams)
          .where(inArray(teams.id, wholeVisitingTeamIds))
      ).map((t) => t.name)
    : [];

  return {
    shared: visitingPlayers > 0,
    visitingPlayers,
    visitingTeamIds,
    visitingTeamNames,
  };
}

/**
 * The one-line provenance stamp every command's embed carries as Discord subtext: which clan
 * answered, which board, and whether other clans are in it. This is the line that stops a
 * screenshot of a leaderboard from being ambiguous about whose leaderboard it is.
 */
export function contextLine(
  clan: ClanContext,
  event: EventContext | null,
  cross?: CrossClanContext,
  t: DiscordDict = en,
): string {
  const parts: string[] = [clan.name];
  if (event) {
    parts.push(event.name);
    parts.push(
      event.phase === 'running'
        ? t.common.phaseRunning
        : event.phase === 'upcoming'
          ? t.common.phaseUpcoming
          : event.phase === 'ended'
            ? t.common.phaseEnded
            : t.common.phaseDraft,
    );
  }
  if (cross?.shared) {
    parts.push(
      cross.visitingTeamNames.length
        ? plural(
            cross.visitingTeamNames.length,
            t.common.contextVisitingTeamsOne,
            t.common.contextVisitingTeamsMany,
          )
        : plural(cross.visitingPlayers, t.common.contextVisitingPlayersOne, t.common.contextVisitingPlayersMany),
    );
  }
  return `-# ${parts.join(' · ')}`;
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
    const legacy = await db
      .select({ id: clanMembers.id, rsn: clanMembers.rsn })
      .from(clanMembers)
      .where(and(eq(clanMembers.discordId, discordId), isNull(clanMembers.leftAt)));
    return {
      userId: null,
      displayName: null,
      memberIds: legacy.map((m) => m.id),
      rsn: legacy[0]?.rsn ?? null,
    };
  }
  const members = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn, isPrimary: clanMembers.isPrimary })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, user.id), isNull(clanMembers.leftAt)));
  const primary = members.find((m) => m.isPrimary === 1) ?? members[0];
  return {
    userId: user.id,
    displayName: user.displayName,
    memberIds: members.map((m) => m.id),
    rsn: primary?.rsn ?? null,
  };
}
