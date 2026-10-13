// The clan hall's bridge from a Discord name to the roster, for people whose Discord name is not
// their RSN.
//
// Discord's widget lists names but withholds user ids, so the hall can only match by name. We do
// know the Discord id behind many roster accounts — the owner signed in with Discord
// (users.discordId), or role sync cached one (accounts.discordId) — and the names that id goes by,
// from two places:
//
//   saved   the username and display name Discord gave us at the owner's last login. Free, and
//           there from the first view.
//   server  what the bot reads off the server: also the server NICKNAME, which login never sees and
//           which the widget shows whenever somebody has one. Costs Discord calls, so it is read in
//           the background and cached; a page view never waits for it.

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, users } from '@/db/schema';
import { indexDiscordNames } from '@/lib/clanHallMerge';
import { discordRest, fetchAllGuildMembers, getBotCredentials, type DiscordGuildMember } from '@/lib/discord-roles';
import { log } from '@/lib/logger';

const TTL = 15 * 60_000;
/** Without the Server Members Intent each id is its own call; past this many, the rest wait for the next read. */
const PER_ID_CAP = 200;

const serverCache = new Map<number, { at: number; members: DiscordGuildMember[]; reading: boolean }>();

/** normRsn(name) → the accounts of the Discord user who goes by it, best first (lib/clanHallMerge). */
export async function hallDiscordNames(clanId: number): Promise<Map<string, number[]>> {
  const rows = await db
    .select({
      accountId: clanRoster.accountId,
      isPrimary: clanRoster.isPrimary,
      cachedId: clanRoster.discordId,
      ownerId: users.discordId,
      username: users.discordUsername,
      globalName: users.discordGlobalName,
    })
    .from(clanRoster)
    .leftJoin(users, eq(users.playerId, clanRoster.playerId))
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt)));

  // Discord id → its accounts, primary first. The owner's login outranks role sync's cached guess:
  // when both exist and differ, the account goes with the login only.
  const accountsById = new Map<string, number[]>();
  const saved = new Map<string, DiscordGuildMember>();
  for (const r of [...rows].sort((a, b) => b.isPrimary - a.isPrimary)) {
    const id = r.ownerId ?? r.cachedId;
    if (!id) continue;
    const list = accountsById.get(id) ?? [];
    if (!list.includes(r.accountId)) list.push(r.accountId);
    accountsById.set(id, list);
    if (r.ownerId && r.username) saved.set(id, { user: { id, username: r.username, global_name: r.globalName ?? undefined }, nick: null, roles: [] });
  }
  if (!accountsById.size) return new Map();

  return indexDiscordNames([...saved.values(), ...serverMembers(clanId, [...accountsById.keys()])], accountsById);
}

/** The server's member records as last read (empty until the first read lands); a stale read is redone behind it. */
function serverMembers(clanId: number, ids: string[]): DiscordGuildMember[] {
  const hit = serverCache.get(clanId);
  if (!hit || (Date.now() - hit.at > TTL && !hit.reading)) {
    const entry = hit ?? { at: 0, members: [], reading: false };
    entry.reading = true;
    serverCache.set(clanId, entry);
    readServer(clanId, ids)
      .then((members) => {
        entry.members = members;
      })
      .catch((err) => log.warn('clan-hall.discord-names-fail', { clanId, err: String(err) }))
      .finally(() => {
        // A failed read waits out the TTL too, rather than retrying on every page view.
        entry.at = Date.now();
        entry.reading = false;
      });
  }
  return serverCache.get(clanId)!.members;
}

/** One listing when the bot may list the server, else one call per known id. */
async function readServer(clanId: number, ids: string[]): Promise<DiscordGuildMember[]> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return [];
  const all = await fetchAllGuildMembers(creds);
  if (all) return all;
  const out: DiscordGuildMember[] = [];
  for (const id of ids.slice(0, PER_ID_CAP)) {
    const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/members/${id}`);
    if (res.ok) out.push((await res.json()) as DiscordGuildMember);
  }
  return out;
}
