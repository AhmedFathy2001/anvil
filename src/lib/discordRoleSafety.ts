// Discord roles Anvil assigns automatically must never carry server-administration powers. A
// caller can still use these roles in channel overwrites (the ordinary bingo/team-channel use),
// but cannot turn role sync or a co-host fan-out into Administrator / moderation access.

const bit = (position: number) => BigInt(1) << BigInt(position);

// Positions from Discord's permission table (discord.com/developers/docs/topics/permissions).
const DANGEROUS_ROLE_PERMISSIONS =
  bit(1) | // Kick Members
  bit(2) | // Ban Members
  bit(3) | // Administrator
  bit(4) | // Manage Channels
  bit(5) | // Manage Server
  bit(7) | // View Audit Log
  bit(13) | // Manage Messages
  bit(17) | // Mention @everyone / @here / all roles
  bit(22) | // Mute Members
  bit(23) | // Deafen Members
  bit(24) | // Move Members
  bit(27) | // Manage Nicknames
  bit(28) | // Manage Roles
  bit(29) | // Manage Webhooks
  bit(30) | // Manage Expressions (emoji, stickers, soundboard)
  bit(33) | // Manage Events (was listed as 32, which is Request to Speak)
  bit(34) | // Manage Threads
  bit(40); // Moderate Members

export interface AssignableDiscordRole {
  id: string;
  managed?: boolean;
  permissions?: string;
}

export function isSafeAutomatedRole(role: AssignableDiscordRole, guildId: string): boolean {
  if (!role.id || role.id === guildId || role.managed) return false;
  try {
    return (BigInt(role.permissions ?? '0') & DANGEROUS_ROLE_PERMISSIONS) === BigInt(0);
  } catch {
    // An unparseable permission bitfield is not something role automation should guess about.
    return false;
  }
}

// ── Name matches ──────────────────────────────────────────────────────────────────────────────
//
// A Discord nickname that reads the same as a roster name is a GUESS at who someone is. It is what
// lets a clan hand out roles before anybody has signed in, and it is also something any server
// member can type. These two rules decide when the guess is too weak to act on.

/**
 * The per-clan switch for name matching. OFF unless the clan turned it on: with it off, role sync
 * gives roles only to people who signed in to Anvil with Discord (matched by Discord id), because a
 * nickname is something anyone in the server can set to an unlinked member's in-game name.
 */
export const ROLE_MATCH_BY_NICKNAME_KEY = 'discord_role_match_by_nickname';

/** Only an explicit 'true' / '1' turns it on; unset, blank or anything else is off. */
export function nicknameMatchingOn(raw: string | null | undefined): boolean {
  return raw === 'true' || raw === '1';
}

/**
 * What put the Discord id that is STORED on a character there (accounts.discord_id_source).
 *
 *   login / signup / plugin  copied from a source the database can prove (a sign-in with Discord)
 *   admin                    a clan admin linked the member by hand
 *   name                     a nickname match
 *   null                     unknown: stored before the source was recorded. It may be an old hand
 *                            link or an old nickname match, and nothing can tell which.
 */
export type DiscordIdSource = 'admin' | 'name' | 'login' | 'signup' | 'plugin';

const DISCORD_ID_SOURCES: readonly string[] = ['admin', 'name', 'login', 'signup', 'plugin'];

export function isDiscordIdSource(value: unknown): value is DiscordIdSource {
  return typeof value === 'string' && DISCORD_ID_SOURCES.includes(value);
}

/**
 * The stored source as ONE clan may read it. A character is the same row for every clan that seats
 * it, so a hand link counts as 'admin' only in the clan whose admin made it; read from any other
 * clan it is unknown. Otherwise an admin of one clan could decide who earns roles in another's.
 */
export function storedSourceForClan(
  source: string | null | undefined,
  linkedClanId: number | null | undefined,
  clanId: number,
): DiscordIdSource | null {
  if (!isDiscordIdSource(source)) return null;
  if (source === 'admin' && linkedClanId !== clanId) return null;
  return source;
}

/**
 * Where a seat's Discord id can come from. The first three are PROVEN: somebody signed in to Anvil
 * with that Discord account and the database ties their login to this seat. The last is the id
 * stored on the character, with what is recorded about how it got there.
 */
export interface SeatDiscordSources {
  /** The character's owner signed in with Discord (their users.discordId). */
  ownerDiscordId: string | null;
  /** A signed-in user signed up for an event as this seat. */
  signupDiscordId: string | null;
  /** A signed-in user's plugin reported playing this character. */
  pluginDiscordId: string | null;
  /** accounts.discordId: the id stored on the character. */
  cachedDiscordId: string | null;
  /** How the stored id got there, as this clan may read it (storedSourceForClan). Absent = unknown. */
  cachedSource?: DiscordIdSource | null;
}

/** The ids a sign-in proves for a seat, strongest first, no repeats. Never the stored id on its own. */
function provenDiscordIds(src: SeatDiscordSources): string[] {
  const out: string[] = [];
  for (const id of [src.ownerDiscordId, src.signupDiscordId, src.pluginDiscordId]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Does the stored id stand as an admin's hand link? Only when this clan's admin made it, and the
 * character's owner has not since signed in with a DIFFERENT Discord account: a person's own
 * sign-in always beats what a clan said about them.
 */
export function adminLinkStands(src: SeatDiscordSources): boolean {
  if (!src.cachedDiscordId || src.cachedSource !== 'admin') return false;
  return !src.ownerDiscordId || src.ownerDiscordId === src.cachedDiscordId;
}

/**
 * The Discord ids role sync may try for a seat, strongest first, no repeats.
 *
 * Nickname matching OFF: proven ids, then a hand link this clan's admin made. A stored id of any
 * other source ('name', or unknown) is ignored (not deleted), including one that disagrees with the
 * owner's own sign-in, so a past nickname match cannot keep earning roles after the clan said names
 * are not enough.
 * Nickname matching ON: as before, the stored id is tried last whatever its source.
 */
export function trustedDiscordIds(src: SeatDiscordSources, matchByNickname: boolean): string[] {
  const out = provenDiscordIds(src);
  if ((matchByNickname || adminLinkStands(src)) && src.cachedDiscordId && !out.includes(src.cachedDiscordId)) {
    out.push(src.cachedDiscordId);
  }
  return out;
}

/** Is this Discord id one a sign-in proves for the seat? A stored-only id is not, hand link or not. */
export function isProvenDiscordId(discordId: string | null | undefined, src: SeatDiscordSources): boolean {
  return !!discordId && provenDiscordIds(src).includes(discordId);
}

/** Which proven source gives this id for the seat (the strongest), or null when none does. */
export function provenSourceOf(discordId: string | null | undefined, src: SeatDiscordSources): 'login' | 'signup' | 'plugin' | null {
  if (!discordId) return null;
  if (src.ownerDiscordId === discordId) return 'login';
  if (src.signupDiscordId === discordId) return 'signup';
  if (src.pluginDiscordId === discordId) return 'plugin';
  return null;
}

/**
 * How many seats role sync cannot reach with nickname matching off: nobody signed in with Discord
 * for them and no admin of this clan linked them by hand. They get no roles then, even when an id
 * of unknown source is stored on the character; with matching on they are the ones reached by that
 * stored id or a nickname only.
 */
export function countSeatsNotLinked(seats: Iterable<SeatDiscordSources>): number {
  let n = 0;
  for (const s of seats) if (trustedDiscordIds(s, false).length === 0) n++;
  return n;
}

/**
 * How many seats carry a stored Discord id that earns nothing with nickname matching off: its
 * source is unknown (stored before sources were recorded) or a nickname match, and no sign-in
 * backs it. An admin confirms one by linking the member again; the member confirms it by signing in.
 */
export function countUnconfirmedStoredLinks(seats: Iterable<SeatDiscordSources>): number {
  let n = 0;
  for (const s of seats) if (s.cachedDiscordId && !trustedDiscordIds(s, false).includes(s.cachedDiscordId)) n++;
  return n;
}

/**
 * May an admin point this seat at this Discord account by hand? Null = yes, else why not.
 *
 * A hand link gives the Discord account the seat's rank roles, so it must not be a way to hand one
 * person another's standing: an account a sign-in already ties to a DIFFERENT member of this clan
 * is refused. That person claims the character themselves, the way anyone adds a second one.
 */
export function handLinkRefusal(f: {
  /** The seat's character already belongs to a player. */
  seatClaimed: boolean;
  /** A sign-in proves the Discord account belongs to somebody who holds another live seat in this clan. */
  provenForOtherSeat: boolean;
}): string | null {
  if (f.seatClaimed) return 'This character belongs to a player, so their Discord comes from their own login. Report it to Anvil if it is wrong.';
  if (f.provenForOtherSeat) {
    return 'That Discord account already belongs to a different member of this clan, who signed in with it. They can add this character themselves from their profile.';
  }
  return null;
}

/** The five columns every write of a character's stored Discord id sets together. */
export interface StoredDiscordLink {
  discordId: string | null;
  discordIdSource: DiscordIdSource | null;
  discordIdLinkedByUserId: number | null;
  discordIdLinkedAt: string | null;
  discordIdLinkedClanId: number | null;
}

/**
 * What to write when a character's stored Discord id changes, so the id never changes without its
 * source. No id = everything cleared. `by` (who, which clan, when) is kept only for a hand link;
 * 'admin' without it is not a hand link anybody can stand behind, and is stored as unknown.
 */
export function storedDiscordLink(
  discordId: string | null | undefined,
  source: DiscordIdSource | null,
  by?: { userId: number; clanId: number; at: string } | null,
): StoredDiscordLink {
  const id = discordId?.trim() || null;
  const admin = !!id && source === 'admin' && !!by;
  return {
    discordId: id,
    discordIdSource: !id ? null : source === 'admin' && !by ? null : source,
    discordIdLinkedByUserId: admin ? by!.userId : null,
    discordIdLinkedAt: admin ? by!.at : null,
    discordIdLinkedClanId: admin ? by!.clanId : null,
  };
}

/** Only an admin or the owner links by hand. A moderator does not. */
export function mayHandLink(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * One Discord account per name, or none.
 *
 * `entries` are (normalised name, Discord id) pairs in the order the guild listed them. The first
 * account to carry a name used to win, so a second account renamed to match a member took that
 * member's roles whenever it sorted first. Two different accounts under one name is exactly the case
 * a name cannot settle, so the name then matches nobody and the real owner has to link instead.
 */
export function uniqueAliasIndex(entries: Iterable<readonly [string, string]>): Map<string, string> {
  const index = new Map<string, string>();
  const contested = new Set<string>();
  for (const [name, id] of entries) {
    if (!name || !id || contested.has(name)) continue;
    const held = index.get(name);
    if (held === undefined) index.set(name, id);
    else if (held !== id) {
      index.delete(name);
      contested.add(name);
    }
  }
  return index;
}

/**
 * May a name match stand in for a link on this seat? False whenever something PROVEN says the
 * matched Discord account is somebody else.
 */
export function nameMatchAllowed(m: {
  /** The clan turned "match by Discord nickname" on (nicknameMatchingOn). Off = no name match at all. */
  matchByNickname: boolean;
  /** The Discord account whose name matched. */
  matchedDiscordId: string;
  /** The person who owns the seat's character, or null while nobody has claimed it. */
  seatPlayerId: number | null;
  /** The Discord account the seat's owner signed in with, when they have. */
  seatOwnerDiscordId: string | null;
  /** The person who signed in with the matched Discord account, or null when nobody has. */
  matchedPlayerId: number | null;
  /** That person already holds a different live seat in this clan. */
  matchedHoldsOtherSeat: boolean;
}): boolean {
  // The clan has not opted in: roles go only to people who signed in to Anvil with Discord.
  if (!m.matchByNickname) return false;
  // The owner has a Discord account on record and this is not it.
  if (m.seatOwnerDiscordId && m.seatOwnerDiscordId !== m.matchedDiscordId) return false;
  if (m.matchedPlayerId != null) {
    // The seat is claimed: only its own owner may be matched to it.
    if (m.seatPlayerId != null) return m.matchedPlayerId === m.seatPlayerId;
    // Unclaimed, and the match is someone this clan already knows as a different character. A name
    // is not enough to add a second character's rank to them: they claim it like any other.
    if (m.matchedHoldsOtherSeat) return false;
  }
  return true;
}
