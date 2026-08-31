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
import { en, plural, type DiscordDict } from '@/lib/discordI18n';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getClanDisplayName } from '@/lib/pluginConfig';
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
  /** Which clan this is. The whole point of resolving by guild. */
  clanId: number;
  /**
   * The clan's chosen bot language, or null for "follow whoever is asking".
   *
   * Set, it wins over Discord's own locale detection — a clan that picks a language has said
   * something detection cannot know, and for Arabic it is the only route in at all because Discord
   * has no Arabic client language to detect.
   */
  language: string | null;
}

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
  const wanted = guildId?.trim() || process.env.DISCORD_GUILD_ID?.trim() || '';
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

/**
 * Who from OUTSIDE this clan is playing in this event.
 *
 * A visiting player is one whose SEAT belongs to another clan. That is a precise signal and, on this
 * platform, a real one: a co-host fills its side of a board from its own roster, so its players are
 * seated in its own clan while playing on somebody else's event.
 *
 * It used to key on `source: 'federation'` — a row written by the federation exchange route, which
 * was deleted with federation itself. Nothing has written that value since, and no row in any
 * imported clan carries it, so this whole feature reported "0 visiting" on every board forever while
 * fifteen languages carried translations for a sentence that could not be produced.
 *
 * Still specifically NOT `isGuest`: a guest is anyone who is not a full member of this clan, which on
 * a normal roster is mostly friends and alts. Counting those would fire on almost every board and say
 * something untrue. Somebody who entered a public event as a guest is seated HERE and so is not
 * counted, which is the same conservative call as before.
 *
 * And the thing the old comment said needed a new column: the visiting clan can now be NAMED, because
 * a co-host's team carries `teams.clanId`.
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
