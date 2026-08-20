// In-game clan ranks. Pure — no database import.
//
// Split out for the same reason lib/clanRoles is split from lib/clanGrants: asking whether "Recruit"
// counts as owning a clan is string arithmetic and should not open a connection, least of all in a
// test.

/**
 * Ranks that count as owning a clan.
 *
 * THE KNOWN WEAKNESS, stated here rather than discovered later: this matches the rank TITLE, and
 * OSRS lets a clan rename its ranks. A clan whose owner tier is called "Emperor" cannot self-verify
 * and has to go through /staff. The numeric `ClanRank` is what this should read; the plugin sends
 * only the display title today, and changing that is a plugin release.
 *
 * Deputy owner is included deliberately. Clans routinely run day to day through one, and excluding
 * it would push most real verifications into the manual queue for no security gain — a deputy can
 * already do everything an owner can, in game.
 */
const OWNER_TIER = new Set(['owner', 'deputy owner', 'deputy-owner', 'deputyowner']);

export function isOwnerTierRank(rank: string | null | undefined): boolean {
  if (!rank) return false;
  return OWNER_TIER.has(rank.trim().toLowerCase());
}
