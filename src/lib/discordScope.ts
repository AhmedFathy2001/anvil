// The SHAPES a Discord command answers in, and the two pure calls over them.
//
// Split out of lib/discordContext, which reads these out of the database and so imports `@/db`.
// Nothing here touches a row: `checkGuild` compares two ids and `contextLine` formats a string, so
// testing them should not need a connection string. Same split lib/cofferMath makes from lib/coffer.
//
// lib/discordContext re-exports all of it, so importers do not need to know this file exists.

import { en, plural, type DiscordDict } from '@/lib/discordI18n';

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
