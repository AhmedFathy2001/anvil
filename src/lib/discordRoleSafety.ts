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
 * How many seats role sync cannot reach by Discord id: the character's owner has not signed in with
 * Discord and no Discord account was linked to the seat. With nickname matching off these get no
 * roles; with it on they are the ones matched by nickname only.
 */
export function countSeatsNotLinked(seats: Iterable<{ ownerDiscordId: string | null; linkedDiscordId: string | null }>): number {
  let n = 0;
  for (const s of seats) if (!s.ownerDiscordId && !s.linkedDiscordId) n++;
  return n;
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
