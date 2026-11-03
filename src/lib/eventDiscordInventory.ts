// What Anvil made in a clan's Discord for one event, as the event's Discord tab shows it. Pure: the
// Discord reads and writes live in lib/discord-teams (inspectTeamDiscord / createMissingTeamDiscord),
// this only decides what a response means and what a stored id is now worth.
//
// Only ids Anvil STORED are ever listed or acted on (teams.discord_* and events.discord_category_id).
// Anything else in the server is the clan's, and invisible here by design.

/**
 *   none      — nothing stored: Anvil has not made it (or already cleaned it up)
 *   exists    — stored, and Discord has it
 *   missing   — stored, but Discord says it is gone (deleted by hand) — safe to forget and remake
 *   no-access — stored, Discord has it, but the bot cannot see it (a private channel made before the
 *               bot granted itself access). Never forgotten: it is still there.
 *   unknown   — Discord did not answer usefully (outage, rate limit) — treat as "leave alone"
 */
export type InventoryStatus = 'none' | 'exists' | 'missing' | 'no-access' | 'unknown';

export interface InventoryItem {
  id: string | null;
  name: string | null;
  status: InventoryStatus;
}

export interface TeamInventory {
  teamId: number;
  name: string;
  color: string | null;
  /** Players on the team in Anvil (not benched). Discord's own role member count is not cheap to read. */
  players: number;
  role: InventoryItem;
  text: InventoryItem;
  voice: InventoryItem;
}

export type PlayerRoleStatus = 'not-set' | 'exists' | 'missing' | 'unsafe' | 'unknown';

export interface EventDiscordInventory {
  connected: boolean;
  /** 'own' = team channels in the clan's server (this inventory); anything else is an event server. */
  layout: string;
  teamChannels: boolean;
  playerRoleTiming: 'approve' | 'draft' | 'never';
  rostersReady: boolean;
  category: InventoryItem;
  playerRole: { id: string | null; name: string | null; status: PlayerRoleStatus };
  teams: TeamInventory[];
}

/** A GET /channels/{id} answer, as a status. */
export function channelStatusFromHttp(httpStatus: number): Exclude<InventoryStatus, 'none'> {
  if (httpStatus >= 200 && httpStatus < 300) return 'exists';
  if (httpStatus === 404) return 'missing';
  if (httpStatus === 403) return 'no-access';
  return 'unknown';
}

/** A stored role id against the guild's role list (null = the list could not be read). */
export function roleStatus(id: string | null, guildRoleIds: ReadonlySet<string> | null): InventoryStatus {
  if (!id) return 'none';
  if (!guildRoleIds) return 'unknown';
  return guildRoleIds.has(id) ? 'exists' : 'missing';
}

/**
 * The clan's shared player role. It is the clan's setting, not per event: `unsafe` means the role is
 * there but carries powers role automation refuses to hand out (lib/discordRoleSafety).
 */
export function playerRoleStatus(
  id: string | null,
  guildRoleIds: ReadonlySet<string> | null,
  safeRoleIds: ReadonlySet<string> | null,
): PlayerRoleStatus {
  if (!id) return 'not-set';
  if (!guildRoleIds || !safeRoleIds) return 'unknown';
  if (!guildRoleIds.has(id)) return 'missing';
  return safeRoleIds.has(id) ? 'exists' : 'unsafe';
}

export type TeamColumn = 'discordRoleId' | 'discordTextChannelId' | 'discordVoiceChannelId';

/**
 * Stored ids Discord has confirmed are gone, so "Create missing" can forget them and let the normal
 * provisioning make fresh ones (it only creates where nothing is stored). Only a confirmed `missing`
 * counts: an unknown or unreadable item is still somebody's channel.
 */
export function staleTeamColumns(team: Pick<TeamInventory, 'role' | 'text' | 'voice'>): TeamColumn[] {
  const out: TeamColumn[] = [];
  if (team.role.status === 'missing') out.push('discordRoleId');
  if (team.text.status === 'missing') out.push('discordTextChannelId');
  if (team.voice.status === 'missing') out.push('discordVoiceChannelId');
  return out;
}

/** How many things "Create missing" would make: absent or confirmed gone. */
export function missingCount(inv: Pick<EventDiscordInventory, 'teams' | 'teamChannels' | 'playerRole' | 'playerRoleTiming'>): number {
  let n = 0;
  if (inv.teamChannels) {
    for (const t of inv.teams) {
      for (const item of [t.role, t.text, t.voice]) if (item.status === 'none' || item.status === 'missing') n++;
    }
  }
  if (inv.playerRoleTiming !== 'never' && (inv.playerRole.status === 'not-set' || inv.playerRole.status === 'missing')) n++;
  return n;
}

/** Anything Anvil stored that is still worth deleting (everything but nothing-stored). */
export function storedCount(inv: Pick<EventDiscordInventory, 'teams' | 'category'>): number {
  let n = inv.category.id ? 1 : 0;
  for (const t of inv.teams) for (const item of [t.role, t.text, t.voice]) if (item.id) n++;
  return n;
}
