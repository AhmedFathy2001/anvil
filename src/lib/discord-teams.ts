/**
 * Discord team-channel provisioning — turns a bingo event's teams into real Discord
 * infrastructure so each team gets a private voice + text channel, and contestants
 * are given the roles that gate access to them.
 *
 * Three operations, all bot-driven over the REST API (no running bot process):
 *   1. provision  — create a category for the event, then per team: a role + a locked
 *                   text channel + a locked voice channel. Captains also get the captain
 *                   role. Safe to run before the draft ends and re-runnable (idempotent:
 *                   anything already created is reused, not duplicated).
 *   2. assign     — give every rostered contestant the shared "bingo" role + their team's
 *                   role (which unlocks their team channels). Available after a completed draft
 *                   or when every entrant is already on a populated, preconfigured team.
 *   3. teardown   — delete the per-team roles/channels + the event category. Leaves the
 *                   shared bingo/captain roles alone (they're admin-configured, not ours).
 *
 * Feature flag: `discord_team_sync_enabled` setting must be 'true' AND a bot token +
 * guild ID must be resolvable (see getBotCredentials). Either missing → all ops are
 * no-ops, so this is safe to deploy before the bot is provisioned.
 *
 * Reuses the bot REST helper + credential resolution from lib/discord-roles.ts.
 */
import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { events, teams, eventParticipants, clanRoster, users, eventSignups } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq, isNotNull } from 'drizzle-orm';
import { log } from '@/lib/logger';
import { discordRest, getBotCredentials, resolveDiscordIdForMember } from '@/lib/discord-roles';
import { acceptedCohostClanIds } from '@/lib/coHost';
import { areEventRostersFinal } from '@/lib/eventReadiness';
import { isSafeAutomatedRole } from '@/lib/discordRoleSafety';
import { syncEventDiscordFireAndForget, usesEventServer } from '@/lib/eventDiscord';

// Discord permission bits (https://discord.com/developers/docs/topics/permissions).
// All fit comfortably in 32 bits, so plain-number bitwise ops are safe; we serialise the
// combined value to a decimal string (what the API expects) at the overwrite site.
const MANAGE_CHANNELS = 1 << 4;
const VIEW_CHANNEL = 1 << 10;
const SEND_MESSAGES = 1 << 11;
const CONNECT = 1 << 20;
const SPEAK = 1 << 21;

// Channel types.
const CHANNEL_TEXT = 0;
const CHANNEL_VOICE = 2;
const CHANNEL_CATEGORY = 4;

// Permission-overwrite target types.
const OVERWRITE_ROLE = 0;
const OVERWRITE_MEMBER = 1;

interface TeamChannelConfig {
  botToken: string;
  guildId: string;
  // The bot's own user ID, so channels can carry an allow-overwrite for the bot itself.
  // Without it the @everyone VIEW_CHANNEL deny locks the bot out of the private channels
  // it creates (it can create them — a guild-level POST — but never see, rename, or
  // delete them again unless it has Administrator). Null if /users/@me failed.
  botUserId: string | null;
  // The shared role every contestant in the event gets. Admin-configured; not created
  // or deleted by us. Null = skip assigning it.
  bingoRoleId: string | null;
  // The shared role every team captain gets. Admin-configured. Null = skip.
  captainRoleId: string | null;
}

// The bot's user ID is immutable per token — resolve once per process.
const botUserIdCache = new Map<string, string>();

async function getBotUserId(botToken: string): Promise<string | null> {
  const cached = botUserIdCache.get(botToken);
  if (cached) return cached;
  const res = await discordRest(botToken, '/users/@me');
  if (!res.ok) {
    log.warn('discord-teams.bot-identity-fail', { status: res.status });
    return null;
  }
  const me = (await res.json()) as { id: string };
  botUserIdCache.set(botToken, me.id);
  return me.id;
}

async function safeAutomatedRoleIds(botToken: string, guildId: string): Promise<Set<string>> {
  const res = await discordRest(botToken, `/guilds/${guildId}/roles`);
  if (!res.ok) {
    log.warn('discord-teams.role-safety-read-fail', { status: res.status, guildId });
    return new Set();
  }
  const roles = (await res.json()) as { id: string; managed?: boolean; permissions?: string }[];
  return new Set(roles.filter((role) => isSafeAutomatedRole(role, guildId)).map((role) => role.id));
}

/**
 * Resolve live config. Returns null when the feature is disabled OR the bot
 * credentials are missing — callers treat that as "skip silently".
 */
export async function loadTeamChannelConfig(clanId: number): Promise<TeamChannelConfig | null> {
  const enabled = (await getSetting(clanId, 'discord_team_sync_enabled')) === 'true';
  if (!enabled) return null;
  const creds = await getBotCredentials(clanId);
  if (!creds) return null;
  const [botUserId, bingoRoleId, captainRoleId, safeRoleIds] = await Promise.all([
    getBotUserId(creds.botToken),
    getSetting(clanId, 'discord_bingo_role_id'),
    getSetting(clanId, 'discord_captain_role_id'),
    safeAutomatedRoleIds(creds.botToken, creds.guildId),
  ]);
  return {
    botToken: creds.botToken,
    guildId: creds.guildId,
    botUserId,
    bingoRoleId: bingoRoleId && safeRoleIds.has(bingoRoleId) ? bingoRoleId : null,
    captainRoleId: captainRoleId && safeRoleIds.has(captainRoleId) ? captainRoleId : null,
  };
}

interface SharedBingoRoleTarget {
  clanId: number;
  cfg: TeamChannelConfig;
}

/**
 * Accepted co-hosts that explicitly allow this event to touch their contestant role. Each target
 * resolves its own bot, guild and pre-selected role; the host never supplies any of those IDs.
 * This intentionally does not create team roles/channels in co-host servers, whose resource IDs
 * would need a separate per-guild mapping rather than the host-only columns on `teams`.
 */
async function cohostBingoRoleTarget(eventId: number, clanId: number): Promise<SharedBingoRoleTarget | null> {
  const clanIds = await acceptedCohostClanIds(eventId).catch(() => [] as number[]);
  if (!clanIds.includes(clanId)) return null;
  if ((await getSetting(clanId, 'discord_cohost_role_sync_enabled')) !== 'true') return null;
  const [creds, bingoRoleId] = await Promise.all([
    getBotCredentials(clanId),
    getSetting(clanId, 'discord_bingo_role_id'),
  ]);
  if (!creds || !bingoRoleId?.trim()) return null;
  const safeRoleIds = await safeAutomatedRoleIds(creds.botToken, creds.guildId);
  if (!safeRoleIds.has(bingoRoleId.trim())) return null;
  return {
    clanId,
    cfg: {
      botToken: creds.botToken,
      guildId: creds.guildId,
      botUserId: null,
      bingoRoleId: bingoRoleId.trim(),
      captainRoleId: null,
    },
  };
}

/** A co-host can inspect only whether its own explicitly selected contestant role is ready. */
export async function cohostBingoRoleReady(eventId: number, clanId: number): Promise<boolean> {
  return (await cohostBingoRoleTarget(eventId, clanId)) !== null;
}

// =============================================================================
// Discord helpers
// =============================================================================

/** '#rrggbb' (or 'rrggbb') → the integer Discord wants for a role colour. 0 on parse fail. */
function hexColorToInt(hex: string | null | undefined): number {
  if (!hex) return 0;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1], 16) : 0;
}

// Text channel names must be lowercase, no spaces. Collapse to a kebab slug and trim to
// Discord's 100-char channel-name cap (a slug that long is already pathological).
function channelSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'team').slice(0, 100);
}

// Turn a failed Discord response into a human string that names the actual cause. Discord
// errors are JSON `{ message, code }` (e.g. 403 "Missing Permissions" code 50013, 401
// "401: Unauthorized", 404 "Unknown Guild" code 10004). For the common permission/token/guild
// mistakes we append a plain-English hint, since the raw message alone ("Missing Permissions")
// doesn't say WHICH permission or that it's the bot at fault.
async function describeDiscordError(res: Response): Promise<string> {
  let message = '';
  let code: number | undefined;
  try {
    const body = (await res.clone().json()) as { message?: string; code?: number };
    message = body.message ?? '';
    code = body.code;
  } catch {
    /* body not JSON */
  }
  const base = `Discord ${res.status}${message ? `: ${message}` : ''}${code ? ` (code ${code})` : ''}`;
  if (res.status === 401) return `${base} — the bot token is invalid or was reset. Re-check DISCORD_BOT_TOKEN.`;
  if (res.status === 403 || code === 50013) {
    return `${base} — the bot is missing the "Manage Channels" and/or "Manage Roles" permission, or its role sits too low in the server's role list. Give the bot those permissions (Server Settings → Roles) and drag its role above the team roles.`;
  }
  if (res.status === 404 || code === 10004) {
    return `${base} — the bot isn't in this server or the server ID is wrong. Re-invite the bot and check the Server ID under Integrations.`;
  }
  return base;
}

// A caller-supplied sink so a failed create can hand back the diagnostic without changing the
// happy-path return type (still string | null, so `if (id)` checks are unchanged).
type ErrSink = { detail?: string };

async function createRole(
  cfg: TeamChannelConfig,
  name: string,
  color: number,
  err?: ErrSink,
): Promise<string | null> {
  const res = await discordRest(cfg.botToken, `/guilds/${cfg.guildId}/roles`, {
    method: 'POST',
    // permissions '0': a team role only opens its channels through overwrites. Without it Discord
    // copies @everyone's permissions, handing every contestant whatever extras @everyone has.
    body: JSON.stringify({ name: name.slice(0, 100), color, permissions: '0', mentionable: true, hoist: false }),
  });
  if (!res.ok) {
    const detail = await describeDiscordError(res);
    log.warn('discord-teams.create-role-fail', { status: res.status, name, detail });
    if (err) err.detail = detail;
    return null;
  }
  const role = (await res.json()) as { id: string };
  return role.id;
}

interface CreateChannelOpts {
  name: string;
  type: number;
  parentId?: string | null;
  // Role IDs that may see/use the channel. Everyone else (@everyone) is denied view.
  allowRoleIds: string[];
  // Permission bits to grant the allowed roles (on top of VIEW_CHANNEL).
  allowBits: number;
}

async function createChannel(
  cfg: TeamChannelConfig,
  opts: CreateChannelOpts,
  err?: ErrSink,
): Promise<string | null> {
  const overwrites: { id: string; type: number; allow?: string; deny?: string }[] = [
    // @everyone (role id == guild id) can't even see the channel.
    { id: cfg.guildId, type: OVERWRITE_ROLE, deny: String(VIEW_CHANNEL) },
  ];
  // The @everyone deny applies to the bot too (channel overwrites beat guild-level
  // permissions unless the bot is Administrator), so grant the bot access explicitly —
  // otherwise it creates a channel it can never rename or delete again.
  if (cfg.botUserId) {
    overwrites.push({
      id: cfg.botUserId,
      type: OVERWRITE_MEMBER,
      allow: String(VIEW_CHANNEL | MANAGE_CHANNELS),
    });
  }
  for (const roleId of opts.allowRoleIds) {
    overwrites.push({
      id: roleId,
      type: OVERWRITE_ROLE,
      allow: String(VIEW_CHANNEL | opts.allowBits),
    });
  }
  const body: Record<string, unknown> = {
    name: opts.name.slice(0, 100),
    type: opts.type,
    permission_overwrites: overwrites,
  };
  if (opts.parentId) body.parent_id = opts.parentId;

  const res = await discordRest(cfg.botToken, `/guilds/${cfg.guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await describeDiscordError(res);
    log.warn('discord-teams.create-channel-fail', { status: res.status, name: opts.name, detail });
    if (err) err.detail = detail;
    return null;
  }
  const channel = (await res.json()) as { id: string };
  return channel.id;
}

async function addRole(cfg: TeamChannelConfig, discordUserId: string, roleId: string): Promise<boolean> {
  const res = await discordRest(
    cfg.botToken,
    `/guilds/${cfg.guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: 'PUT' },
  );
  if (!res.ok) {
    log.warn('discord-teams.add-role-fail', { status: res.status, discordUserId, roleId });
    return false;
  }
  return true;
}

// Strip a role from a member. 404 (member left the guild, or never had the role) is a no-op,
// not a failure — this is used for cleanup where "already gone" is the desired end state.
async function removeRole(cfg: TeamChannelConfig, discordUserId: string, roleId: string): Promise<boolean> {
  const res = await discordRest(
    cfg.botToken,
    `/guilds/${cfg.guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    log.warn('discord-teams.remove-role-fail', { status: res.status, discordUserId, roleId });
    return false;
  }
  return true;
}

// DELETE a role or channel; 404 (already gone) is treated as success. Returns ok:false only
// on a real error so teardown can keep the DB column populated for a retry, with a
// human-readable detail for the report.
async function deleteResource(
  cfg: TeamChannelConfig,
  path: string,
): Promise<{ ok: boolean; detail?: string }> {
  const res = await discordRest(cfg.botToken, path, { method: 'DELETE' });
  if (res.ok || res.status === 404) return { ok: true };
  let detail = await describeDiscordError(res);
  // 403 on a /channels delete is almost always the bot locked out of its own private
  // channel (created before we started granting the bot an overwrite) — the generic
  // "give it Manage Channels" hint doesn't fix that, so say what actually does.
  if (res.status === 403 && path.startsWith('/channels/')) {
    detail = `${detail} If the bot already has those permissions, it can't see this private channel (created before the bot granted itself access): delete the channels by hand in Discord and re-run this — or temporarily give the bot Administrator, re-run, then remove it.`;
  }
  log.warn('discord-teams.delete-fail', { status: res.status, path });
  return { ok: false, detail };
}

// =============================================================================
// Discord-id resolution
// =============================================================================

async function discordIdForUserId(userId: number | null | undefined): Promise<string | null> {
  if (userId == null) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return u?.discordId ?? null;
}

/**
 * Resolve a Discord user ID for a player. Uses the shared resolver so team/bingo role assignment
 * gets the SAME priority chain as rank sync:
 *   1) clan_members.userId → users.discordId  (OAuth-linked — the reliable path)
 *   2) clan_members.discordId  (cached from a prior match)
 *   3) guild-member search by RSN, splitting "name1 / name2" nicknames  (best-effort, cached)
 * Returns null only when none match — caller skips that player. Previously this stopped at (2),
 * which silently skipped anyone whose Discord nickname didn't equal their RSN.
 */
async function discordIdForPlayerClanMember(clanMemberId: number | null): Promise<string | null> {
  if (clanMemberId == null) return null;
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const cm = await findRosterSeat(eq(clanRoster.id, clanMemberId));
  if (!cm) return null;
  return resolveDiscordIdForMember(cm.clanId, { id: cm.id, rsn: cm.rsn, playerId: cm.playerId, discordId: cm.discordId });
}

// =============================================================================
// Provision
// =============================================================================

export interface ProvisionReport {
  ok: boolean;
  reason?: string;
  categoryId?: string;
  // Per-team summary of what now exists (created this run or already present).
  teams: { teamId: number; name: string; roleId?: string; textChannelId?: string; voiceChannelId?: string }[];
  captainsAssigned: number;
}

export type DiscordProvisionScope = 'all-teams' | 'own-clan';

function teamsInScope<T extends { clanId: number | null }>(
  eventTeams: T[],
  hostClanId: number,
  scope: DiscordProvisionScope,
): T[] {
  return scope === 'own-clan' ? eventTeams.filter((team) => team.clanId === hostClanId) : eventTeams;
}

/**
 * Create (or reuse) the Discord category + per-team role + locked text/voice channels for
 * an event, and give each team captain the captain role + their team role. Idempotent —
 * anything already recorded on the row is left as-is. Persists new IDs as it goes so a
 * partial failure (rate limit, perms) leaves a resumable state.
 */
export async function provisionTeamDiscord(
  eventId: number,
  scope: DiscordProvisionScope = 'all-teams',
): Promise<ProvisionReport> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', teams: [], captainsAssigned: 0 };
  const cfg = await loadTeamChannelConfig(event.clanId);
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', teams: [], captainsAssigned: 0 };

  if (!event) return { ok: false, reason: 'event not found', teams: [], captainsAssigned: 0 };

  const eventTeams = teamsInScope(
    await db.select().from(teams).where(eq(teams.eventId, eventId)),
    event.clanId,
    scope,
  );
  if (eventTeams.length === 0) {
    return {
      ok: false,
      reason: scope === 'own-clan' ? 'this clan does not have its own team on the event' : 'no teams to provision',
      teams: [],
      captainsAssigned: 0,
    };
  }

  // 1) Category (one per event). The very first Discord write, so a misconfigured bot
  // (bad token / wrong guild / missing Manage Channels) trips here — surface the exact reason.
  let categoryId = event.discordCategoryId;
  if (!categoryId) {
    const err: ErrSink = {};
    categoryId = await createChannel(cfg, {
      name: event.name,
      type: CHANNEL_CATEGORY,
      allowRoleIds: [],
      allowBits: 0,
    }, err);
    if (!categoryId) {
      return {
        ok: false,
        reason: err.detail ? `Could not create the Discord category. ${err.detail}` : 'could not create category',
        teams: [],
        captainsAssigned: 0,
      };
    }
    await db.update(events).set({ discordCategoryId: categoryId }).where(eq(events.id, eventId));
  }

  // 2) Per-team role + channels.
  const teamReports: ProvisionReport['teams'] = [];
  let captainsAssigned = 0;
  // First per-team failure detail (e.g. Manage Roles missing) — surfaced in the reason so a
  // run that created the category but couldn't make roles/channels isn't silently "ok".
  let firstTeamError: string | undefined;

  for (const team of eventTeams) {
    let roleId = team.discordRoleId;
    if (!roleId) {
      const err: ErrSink = {};
      roleId = await createRole(cfg, team.name, hexColorToInt(team.color), err);
      if (roleId) await db.update(teams).set({ discordRoleId: roleId }).where(eq(teams.id, team.id));
      else if (err.detail && !firstTeamError) firstTeamError = err.detail;
    }

    let textChannelId = team.discordTextChannelId;
    if (!textChannelId && roleId) {
      const err: ErrSink = {};
      textChannelId = await createChannel(cfg, {
        name: channelSlug(team.name),
        type: CHANNEL_TEXT,
        parentId: categoryId,
        allowRoleIds: [roleId],
        allowBits: SEND_MESSAGES,
      }, err);
      if (textChannelId) {
        await db.update(teams).set({ discordTextChannelId: textChannelId }).where(eq(teams.id, team.id));
      } else if (err.detail && !firstTeamError) firstTeamError = err.detail;
    }

    let voiceChannelId = team.discordVoiceChannelId;
    if (!voiceChannelId && roleId) {
      const err: ErrSink = {};
      voiceChannelId = await createChannel(cfg, {
        name: team.name,
        type: CHANNEL_VOICE,
        parentId: categoryId,
        allowRoleIds: [roleId],
        allowBits: CONNECT | SPEAK,
      }, err);
      if (voiceChannelId) {
        await db.update(teams).set({ discordVoiceChannelId: voiceChannelId }).where(eq(teams.id, team.id));
      } else if (err.detail && !firstTeamError) firstTeamError = err.detail;
    }

    // Captain: give them the captain role + their team role (so they can see the channels
    // before the draft even ends). Resolved off the Discord-linked captain user.
    if (roleId && team.captainUserId != null) {
      const captainDiscordId = await discordIdForUserId(team.captainUserId);
      if (captainDiscordId) {
        if (cfg.captainRoleId) await addRole(cfg, captainDiscordId, cfg.captainRoleId);
        await addRole(cfg, captainDiscordId, roleId);
        if (cfg.bingoRoleId) await addRole(cfg, captainDiscordId, cfg.bingoRoleId);
        captainsAssigned++;
      }
    }

    teamReports.push({
      teamId: team.id,
      name: team.name,
      roleId: roleId ?? undefined,
      textChannelId: textChannelId ?? undefined,
      voiceChannelId: voiceChannelId ?? undefined,
    });
  }

  // The category exists, but if any role/channel create failed (typically Manage Roles
  // missing or the bot's role too low), report it — provisioning is idempotent, so the admin
  // fixes perms and re-runs to fill in what's missing rather than getting a false "success".
  if (firstTeamError) {
    return {
      ok: false,
      reason: `Category created, but a team role or channel failed. ${firstTeamError}`,
      categoryId,
      teams: teamReports,
      captainsAssigned,
    };
  }

  return { ok: true, categoryId, teams: teamReports, captainsAssigned };
}

// =============================================================================
// Assign rosters
// =============================================================================

/**
 * A draft is only one way to finalize rosters. Clan-v-clan and sign-up-selected teams arrive fully
 * assigned without ever starting one; requiring draftStatus=completed made those admins run an
 * empty draft purely to unlock Discord. For a no-draft event, be deliberately strict: every
 * entrant must be assigned and every configured team must contain somebody.
 */
export async function eventRostersReadyForAssignment(eventId: number, knownDraftStatus?: string): Promise<boolean> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope.
  const [event, eventTeams, participants] = await Promise.all([
    knownDraftStatus == null
      ? db.query.events.findFirst({ where: eq(events.id, eventId), columns: { draftStatus: true } })
      : Promise.resolve({ draftStatus: knownDraftStatus }),
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId)),
    db
      .select({ teamId: eventParticipants.teamId })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId)),
  ]);
  if (!event) return false;
  return areEventRostersFinal(
    event.draftStatus,
    eventTeams.map((team) => team.id),
    participants.map((player) => player.teamId),
  );
}

export interface AssignReport {
  ok: boolean;
  reason?: string;
  assigned: number;
  skipped: number;
  /** Bingo-role operations per Discord server. Co-host failures never block the host assignment. */
  roleServers?: { clanId: number; guildId: string; assigned: number; failed: number }[];
}

/**
 * Give every rostered contestant the shared bingo role + their team's role. Rosters may be final
 * through a completed draft or through fully populated direct assignment. Teams must be
 * provisioned (each team must have a discordRoleId). Unresolvable Discord accounts are skipped.
 */
export async function assignTeamRoles(
  eventId: number,
  scope: DiscordProvisionScope = 'all-teams',
): Promise<AssignReport> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', assigned: 0, skipped: 0 };
  const cfg = await loadTeamChannelConfig(event.clanId);
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', assigned: 0, skipped: 0 };
  if (!(await eventRostersReadyForAssignment(eventId, event.draftStatus))) {
    return { ok: false, reason: 'rosters are not fully assigned', assigned: 0, skipped: 0 };
  }

  const eventTeams = teamsInScope(
    await db.select().from(teams).where(eq(teams.eventId, eventId)),
    event.clanId,
    scope,
  );
  const roleByTeam = new Map<number, string>();
  for (const t of eventTeams) if (t.discordRoleId) roleByTeam.set(t.id, t.discordRoleId);
  if (roleByTeam.size === 0) {
    return { ok: false, reason: 'teams not provisioned — run provision first', assigned: 0, skipped: 0 };
  }

  // Only drafted players (teamId set).
  const drafted = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.teamId)));

  const roleServers: NonNullable<AssignReport['roleServers']> = [];
  if (cfg.bingoRoleId) roleServers.push({ clanId: event.clanId, guildId: cfg.guildId, assigned: 0, failed: 0 });

  let assigned = 0;
  let skipped = 0;
  for (const player of drafted) {
    const teamRoleId = player.teamId != null ? roleByTeam.get(player.teamId) : undefined;
    if (!teamRoleId) {
      skipped++;
      continue;
    }
    const discordId = await discordIdForPlayerClanMember(player.clanMemberId);
    if (!discordId) {
      skipped++;
      continue;
    }
    if (cfg.bingoRoleId) {
      const ok = await addRole(cfg, discordId, cfg.bingoRoleId);
      const report = roleServers.find((r) => r.clanId === event.clanId);
      if (report) {
        if (ok) report.assigned++;
        else report.failed++;
      }
    }
    await addRole(cfg, discordId, teamRoleId);
    assigned++;
  }

  return { ok: true, assigned, skipped, roleServers };
}

// =============================================================================
// Assign the shared bingo role (pre-draft)
// =============================================================================

/**
 * Give the shared bingo role to every *approved* sign-up for an event. Unlike
 * assignTeamRoles this does NOT require the draft (or even teams) — it's meant to be run
 * as soon as sign-ups are approved, so contestants can see the bingo channel / be pinged
 * with the rules before the draft happens. Requires `discord_bingo_role_id` to be set.
 * Sign-ups whose Discord account can't be resolved are skipped.
 */
export async function assignBingoRoleToApprovedSignups(
  eventId: number,
  scope: DiscordProvisionScope = 'all-teams',
): Promise<AssignReport> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', assigned: 0, skipped: 0 };
  const cfg = await loadTeamChannelConfig(event.clanId);
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', assigned: 0, skipped: 0 };
  if (!cfg.bingoRoleId) {
    return {
      ok: false,
      reason: 'No bingo role is set. Add the bingo role ID under Integrations → Discord team channels.',
      assigned: 0,
      skipped: 0,
    };
  }

  const approved = await db
    .select()
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.status, 'approved')));

  const roleServers: NonNullable<AssignReport['roleServers']> = [
    { clanId: event.clanId, guildId: cfg.guildId, assigned: 0, failed: 0 },
  ];

  let assigned = 0;
  let skipped = 0;
  for (const signup of approved) {
    if (scope === 'own-clan') {
      // clan-scope: this clan -- looked up by seat id, then skipped unless seat.clanId matches the clan (checked just below).
      const seat = signup.clanMemberId == null
        ? null
        : await findRosterSeat(eq(clanRoster.id, signup.clanMemberId));
      if (!seat || seat.clanId !== event.clanId) continue;
    }
    // Prefer the OAuth-linked user; fall back to the chosen clan member's cached Discord id.
    const discordId =
      (await discordIdForUserId(signup.userId)) ??
      (await discordIdForPlayerClanMember(signup.clanMemberId));
    if (!discordId) {
      skipped++;
      continue;
    }
    const hostOk = await addRole(cfg, discordId, cfg.bingoRoleId);
    if (hostOk) roleServers[0].assigned++;
    else roleServers[0].failed++;
    assigned++;
  }

  return { ok: true, assigned, skipped, roleServers };
}

export interface CohostRoleReport {
  ok: boolean;
  reason?: string;
  changed: number;
  failed: number;
  skipped: number;
}

/**
 * Give a co-host's own contestant role from that co-host's admin surface. The event host cannot
 * call this on the co-host's behalf: the route supplies the viewing clan id after authenticating
 * one of that clan's admins.
 */
export async function assignCohostBingoRoleToApprovedSignups(
  eventId: number,
  clanId: number,
): Promise<CohostRoleReport> {
  const target = await cohostBingoRoleTarget(eventId, clanId);
  if (!target?.cfg.bingoRoleId) {
    return {
      ok: false,
      reason: 'Enable co-hosted event role tools and select your contestant role under Integrations first.',
      changed: 0,
      failed: 0,
      skipped: 0,
    };
  }
  const approved = await db
    .select()
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.status, 'approved')));
  let changed = 0;
  let failed = 0;
  let skipped = 0;
  for (const signup of approved) {
    // clan-scope: this clan -- looked up by seat id, then skipped unless seat.clanId matches the clan (checked just below).
    const seat = signup.clanMemberId == null
      ? null
      : await findRosterSeat(eq(clanRoster.id, signup.clanMemberId));
    if (!seat || seat.clanId !== clanId) continue;
    const discordId =
      (await discordIdForUserId(signup.userId)) ??
      (await discordIdForPlayerClanMember(signup.clanMemberId));
    if (!discordId) {
      skipped++;
      continue;
    }
    if (await addRole(target.cfg, discordId, target.cfg.bingoRoleId)) changed++;
    else failed++;
  }
  return { ok: true, changed, failed, skipped };
}

/** Remove only the viewing co-host's own contestant role from everybody tied to this event. */
export async function unassignCohostBingoRole(
  eventId: number,
  clanId: number,
): Promise<CohostRoleReport> {
  const target = await cohostBingoRoleTarget(eventId, clanId);
  if (!target?.cfg.bingoRoleId) {
    return {
      ok: false,
      reason: 'Your co-hosted event contestant role is not configured.',
      changed: 0,
      failed: 0,
      skipped: 0,
    };
  }
  const [signups, players] = await Promise.all([
    db.select().from(eventSignups).where(eq(eventSignups.eventId, eventId)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
  ]);
  const discordIds = new Set<string>();
  let skipped = 0;
  for (const signup of signups) {
    // clan-scope: this clan -- looked up by seat id, then skipped unless seat.clanId matches the clan (checked just below).
    const seat = signup.clanMemberId == null
      ? null
      : await findRosterSeat(eq(clanRoster.id, signup.clanMemberId));
    if (!seat || seat.clanId !== clanId) continue;
    const discordId =
      (await discordIdForUserId(signup.userId)) ??
      (await discordIdForPlayerClanMember(signup.clanMemberId));
    if (discordId) discordIds.add(discordId);
    else skipped++;
  }
  for (const player of players) {
    // clan-scope: this clan -- looked up by seat id, then skipped unless seat.clanId matches the clan (checked just below).
    const seat = player.clanMemberId == null
      ? null
      : await findRosterSeat(eq(clanRoster.id, player.clanMemberId));
    if (!seat || seat.clanId !== clanId) continue;
    const discordId = await discordIdForPlayerClanMember(player.clanMemberId);
    if (discordId) discordIds.add(discordId);
    else skipped++;
  }
  let changed = 0;
  let failed = 0;
  for (const discordId of discordIds) {
    if (await removeRole(target.cfg, discordId, target.cfg.bingoRoleId)) changed++;
    else failed++;
  }
  return { ok: true, changed, failed, skipped };
}

// =============================================================================
// Un-assign the shared roles (cleanup)
// =============================================================================

export interface UnassignReport {
  ok: boolean;
  reason?: string;
  bingoRemoved: number;
  captainRemoved: number;
  roleServers?: { clanId: number; guildId: string; removed: number; failed: number }[];
}

/**
 * Take the shared bingo role off everyone tied to this event, and the captain role off its
 * team captains. The roles themselves are NOT deleted (they're admin-owned and reused across
 * events) — this only revokes them from members. Complements teardownTeamDiscord, which
 * deletes the per-team roles/channels (and thereby strips the team roles) but deliberately
 * leaves these shared roles alone.
 *
 * Caveat: the bingo/captain roles are shared, so if a member is ALSO in another still-active
 * event this will strip their role there too. Fine for the normal sequential-event flow;
 * callers should warn the admin.
 */
export async function unassignSharedRoles(
  eventId: number,
  scope: DiscordProvisionScope = 'all-teams',
): Promise<UnassignReport> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', bingoRemoved: 0, captainRemoved: 0 };
  const cfg = await loadTeamChannelConfig(event.clanId);
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', bingoRemoved: 0, captainRemoved: 0 };
  if (!cfg.bingoRoleId && !cfg.captainRoleId) {
    return { ok: false, reason: 'No bingo or captain role is configured to remove.', bingoRemoved: 0, captainRemoved: 0 };
  }

  // Everyone who could hold the bingo role for this event: team captains, drafted players, and
  // sign-ups. Captains are also the only holders of the captain role. Members with no linked
  // Discord resolve to null and are skipped. Sets dedupe people who appear in several lists.
  const bingoIds = new Set<string>();
  const captainIds = new Set<string>();

  const eventTeams = teamsInScope(
    await db.select().from(teams).where(eq(teams.eventId, eventId)),
    event.clanId,
    scope,
  );
  const scopedTeamIds = new Set(eventTeams.map((team) => team.id));
  for (const t of eventTeams) {
    if (t.captainUserId == null) continue;
    const did = await discordIdForUserId(t.captainUserId);
    if (did) {
      bingoIds.add(did);
      captainIds.add(did);
    }
  }

  const signups = await db.select().from(eventSignups).where(eq(eventSignups.eventId, eventId));
  for (const s of signups) {
    if (scope === 'own-clan') {
      // clan-scope: this clan -- looked up by seat id, then skipped unless seat.clanId matches the clan (checked just below).
      const seat = s.clanMemberId == null ? null : await findRosterSeat(eq(clanRoster.id, s.clanMemberId));
      if (!seat || seat.clanId !== event.clanId) continue;
    }
    const did = (await discordIdForUserId(s.userId)) ?? (await discordIdForPlayerClanMember(s.clanMemberId));
    if (did) bingoIds.add(did);
  }

  const eventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
  for (const p of eventPlayers) {
    if (scope === 'own-clan' && (p.teamId == null || !scopedTeamIds.has(p.teamId))) continue;
    const did = await discordIdForPlayerClanMember(p.clanMemberId);
    if (did) bingoIds.add(did);
  }

  let bingoRemoved = 0;
  let captainRemoved = 0;
  const roleServers: NonNullable<UnassignReport['roleServers']> = [];
  if (cfg.bingoRoleId) {
    const hostReport = { clanId: event.clanId, guildId: cfg.guildId, removed: 0, failed: 0 };
    roleServers.push(hostReport);
    for (const did of bingoIds) {
      const ok = await removeRole(cfg, did, cfg.bingoRoleId);
      if (ok) hostReport.removed++;
      else hostReport.failed++;
      bingoRemoved++;
    }
  }
  if (cfg.captainRoleId) {
    for (const did of captainIds) {
      await removeRole(cfg, did, cfg.captainRoleId);
      captainRemoved++;
    }
  }

  return { ok: true, bingoRemoved, captainRemoved, roleServers };
}

// =============================================================================
// Teardown
// =============================================================================

export interface TeardownReport {
  ok: boolean;
  reason?: string;
  rolesDeleted: number;
  channelsDeleted: number;
  categoryDeleted: boolean;
  // Deletes Discord refused (the IDs stay in the DB so a re-run can retry them).
  rolesFailed: number;
  channelsFailed: number;
  categoryFailed: boolean;
  // Human-readable cause of the first failed delete, for the admin UI.
  failDetail?: string;
}

/**
 * Mirror a team rebrand onto Discord: role name + color, text channel slug, voice
 * channel name. No-ops silently when team sync is unconfigured or the team has no
 * provisioned Discord resources yet (they'll be created with the new identity anyway).
 */
export async function updateTeamDiscordIdentity(teamId: number): Promise<void> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return;
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) return;
  const cfg = await loadTeamChannelConfig(event.clanId);
  if (!cfg) return;

  if (team.discordRoleId) {
    const res = await discordRest(cfg.botToken, `/guilds/${cfg.guildId}/roles/${team.discordRoleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: team.name.slice(0, 100), color: hexColorToInt(team.color) }),
    });
    if (!res.ok) log.warn('discord-teams.update-role-fail', { status: res.status, teamId });
  }
  if (team.discordTextChannelId) {
    const res = await discordRest(cfg.botToken, `/channels/${team.discordTextChannelId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: channelSlug(team.name) }),
    });
    if (!res.ok) log.warn('discord-teams.update-text-channel-fail', { status: res.status, teamId });
  }
  if (team.discordVoiceChannelId) {
    const res = await discordRest(cfg.botToken, `/channels/${team.discordVoiceChannelId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: team.name.slice(0, 100) }),
    });
    if (!res.ok) log.warn('discord-teams.update-voice-channel-fail', { status: res.status, teamId });
  }
}

/**
 * Delete the per-team roles + channels and the event category, clearing the stored IDs.
 * Leaves the shared bingo/captain roles untouched (admin-owned). Deleting a role
 * auto-strips it from members, so contestants lose channel access cleanly.
 */
export async function teardownTeamDiscord(eventId: number): Promise<TeardownReport> {
  const empty = { rolesDeleted: 0, channelsDeleted: 0, categoryDeleted: false, rolesFailed: 0, channelsFailed: 0, categoryFailed: false };

  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', ...empty };
  const cfg = await loadTeamChannelConfig(event.clanId);
  if (!cfg) {
    return { ok: false, reason: 'team sync disabled or unconfigured', ...empty };
  }

  if (!event) return { ok: false, reason: 'event not found', ...empty };

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));

  let rolesDeleted = 0;
  let channelsDeleted = 0;
  let rolesFailed = 0;
  let channelsFailed = 0;
  let failDetail: string | undefined;

  const noteFail = (kind: 'role' | 'channel', detail?: string) => {
    if (kind === 'role') rolesFailed++;
    else channelsFailed++;
    if (!failDetail && detail) failDetail = detail;
  };

  for (const team of eventTeams) {
    const cleared: Partial<typeof teams.$inferInsert> = {};
    if (team.discordTextChannelId) {
      const r = await deleteResource(cfg, `/channels/${team.discordTextChannelId}`);
      if (r.ok) {
        channelsDeleted++;
        cleared.discordTextChannelId = null;
      } else noteFail('channel', r.detail);
    }
    if (team.discordVoiceChannelId) {
      const r = await deleteResource(cfg, `/channels/${team.discordVoiceChannelId}`);
      if (r.ok) {
        channelsDeleted++;
        cleared.discordVoiceChannelId = null;
      } else noteFail('channel', r.detail);
    }
    if (team.discordRoleId) {
      const r = await deleteResource(cfg, `/guilds/${cfg.guildId}/roles/${team.discordRoleId}`);
      if (r.ok) {
        rolesDeleted++;
        cleared.discordRoleId = null;
      } else noteFail('role', r.detail);
    }
    if (Object.keys(cleared).length > 0) {
      await db.update(teams).set(cleared).where(eq(teams.id, team.id));
    }
  }

  let categoryDeleted = false;
  let categoryFailed = false;
  if (event.discordCategoryId) {
    const r = await deleteResource(cfg, `/channels/${event.discordCategoryId}`);
    if (r.ok) {
      categoryDeleted = true;
      await db.update(events).set({ discordCategoryId: null }).where(eq(events.id, eventId));
    } else {
      categoryFailed = true;
      if (!failDetail && r.detail) failDetail = r.detail;
    }
  }

  return { ok: true, rolesDeleted, channelsDeleted, categoryDeleted, rolesFailed, channelsFailed, categoryFailed, failDetail };
}

/**
 * Fire-and-forget: provision then assign, for use from the draft-complete handler. Errors
 * are swallowed into the log so a Discord-side outage can't fail ending the draft. No-op
 * when the feature is disabled (loadTeamChannelConfig returns null inside each call).
 */
export function syncTeamDiscordOnDraftCompleteFireAndForget(eventId: number): void {
  (async () => {
    // A co-hosted event with its own event server (joint/single) is handled entirely by
    // lib/eventDiscord; building host-server channels as well would duplicate every team.
    if (await usesEventServer(eventId)) {
      syncEventDiscordFireAndForget(eventId);
      return;
    }
    // Both calls resolve the clan from the event and no-op when the feature is off, so this is just
    // the ordering — provision the roles/channels, then hand them out.
    await provisionTeamDiscord(eventId);
    await assignTeamRoles(eventId);
  })().catch((err) => {
    log.warn('discord-teams.draft-complete-sync-throw', { eventId }, err);
  });
}
