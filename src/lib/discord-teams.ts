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
 *   2. assign     — give every drafted contestant the shared "bingo" role + their team's
 *                   role (which unlocks their team channels). Gated on draftStatus
 *                   === 'completed' since rosters aren't final until then.
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
import { events, teams, players, clanMembers, users, settings, eventSignups } from '@/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { log } from '@/lib/logger';
import { discordRest, getBotCredentials, resolveDiscordIdForMember } from '@/lib/discord-roles';

// Discord permission bits (https://discord.com/developers/docs/topics/permissions).
// All fit comfortably in 32 bits, so plain-number bitwise ops are safe; we serialise the
// combined value to a decimal string (what the API expects) at the overwrite site.
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

interface TeamChannelConfig {
  botToken: string;
  guildId: string;
  // The shared role every contestant in the event gets. Admin-configured; not created
  // or deleted by us. Null = skip assigning it.
  bingoRoleId: string | null;
  // The shared role every team captain gets. Admin-configured. Null = skip.
  captainRoleId: string | null;
}

async function readSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

/**
 * Resolve live config. Returns null when the feature is disabled OR the bot
 * credentials are missing — callers treat that as "skip silently".
 */
export async function loadTeamChannelConfig(): Promise<TeamChannelConfig | null> {
  const enabled = (await readSetting('discord_team_sync_enabled')) === 'true';
  if (!enabled) return null;
  const creds = await getBotCredentials();
  if (!creds) return null;
  return {
    botToken: creds.botToken,
    guildId: creds.guildId,
    bingoRoleId: (await readSetting('discord_bingo_role_id')) || null,
    captainRoleId: (await readSetting('discord_captain_role_id')) || null,
  };
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
    body: JSON.stringify({ name: name.slice(0, 100), color, mentionable: true, hoist: false }),
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

async function addRole(cfg: TeamChannelConfig, discordUserId: string, roleId: string): Promise<void> {
  const res = await discordRest(
    cfg.botToken,
    `/guilds/${cfg.guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: 'PUT' },
  );
  if (!res.ok) {
    log.warn('discord-teams.add-role-fail', { status: res.status, discordUserId, roleId });
  }
}

// Strip a role from a member. 404 (member left the guild, or never had the role) is a no-op,
// not a failure — this is used for cleanup where "already gone" is the desired end state.
async function removeRole(cfg: TeamChannelConfig, discordUserId: string, roleId: string): Promise<void> {
  const res = await discordRest(
    cfg.botToken,
    `/guilds/${cfg.guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    log.warn('discord-teams.remove-role-fail', { status: res.status, discordUserId, roleId });
  }
}

// DELETE a role or channel; 404 (already gone) is treated as success. Returns false only
// on a real error so teardown can keep the DB column populated for a retry.
async function deleteResource(cfg: TeamChannelConfig, path: string): Promise<boolean> {
  const res = await discordRest(cfg.botToken, path, { method: 'DELETE' });
  if (res.ok || res.status === 404) return true;
  log.warn('discord-teams.delete-fail', { status: res.status, path });
  return false;
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
  const cm = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, clanMemberId) });
  if (!cm) return null;
  return resolveDiscordIdForMember({ id: cm.id, rsn: cm.rsn, userId: cm.userId, discordId: cm.discordId });
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

/**
 * Create (or reuse) the Discord category + per-team role + locked text/voice channels for
 * an event, and give each team captain the captain role + their team role. Idempotent —
 * anything already recorded on the row is left as-is. Persists new IDs as it goes so a
 * partial failure (rate limit, perms) leaves a resumable state.
 */
export async function provisionTeamDiscord(eventId: number): Promise<ProvisionReport> {
  const cfg = await loadTeamChannelConfig();
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', teams: [], captainsAssigned: 0 };

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', teams: [], captainsAssigned: 0 };

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
  if (eventTeams.length === 0) {
    return { ok: false, reason: 'no teams to provision', teams: [], captainsAssigned: 0 };
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

export interface AssignReport {
  ok: boolean;
  reason?: string;
  assigned: number;
  skipped: number;
}

/**
 * Give every drafted contestant the shared bingo role + their team's role. Requires the
 * draft to be completed (rosters are final) and the teams to be provisioned (each team
 * must have a discordRoleId). Players whose Discord account can't be resolved are skipped.
 */
export async function assignTeamRoles(eventId: number): Promise<AssignReport> {
  const cfg = await loadTeamChannelConfig();
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', assigned: 0, skipped: 0 };

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', assigned: 0, skipped: 0 };
  if (event.draftStatus !== 'completed') {
    return { ok: false, reason: 'draft is not completed', assigned: 0, skipped: 0 };
  }

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
  const roleByTeam = new Map<number, string>();
  for (const t of eventTeams) if (t.discordRoleId) roleByTeam.set(t.id, t.discordRoleId);
  if (roleByTeam.size === 0) {
    return { ok: false, reason: 'teams not provisioned — run provision first', assigned: 0, skipped: 0 };
  }

  // Only drafted players (teamId set).
  const drafted = await db
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), isNotNull(players.teamId)));

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
    if (cfg.bingoRoleId) await addRole(cfg, discordId, cfg.bingoRoleId);
    await addRole(cfg, discordId, teamRoleId);
    assigned++;
  }

  return { ok: true, assigned, skipped };
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
export async function assignBingoRoleToApprovedSignups(eventId: number): Promise<AssignReport> {
  const cfg = await loadTeamChannelConfig();
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', assigned: 0, skipped: 0 };
  if (!cfg.bingoRoleId) {
    return {
      ok: false,
      reason: 'No bingo role is set. Add the bingo role ID under Integrations → Discord team channels.',
      assigned: 0,
      skipped: 0,
    };
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', assigned: 0, skipped: 0 };

  const approved = await db
    .select()
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.status, 'approved')));

  let assigned = 0;
  let skipped = 0;
  for (const signup of approved) {
    // Prefer the OAuth-linked user; fall back to the chosen clan member's cached Discord id.
    const discordId =
      (await discordIdForUserId(signup.userId)) ??
      (await discordIdForPlayerClanMember(signup.clanMemberId));
    if (!discordId) {
      skipped++;
      continue;
    }
    await addRole(cfg, discordId, cfg.bingoRoleId);
    assigned++;
  }

  return { ok: true, assigned, skipped };
}

// =============================================================================
// Un-assign the shared roles (cleanup)
// =============================================================================

export interface UnassignReport {
  ok: boolean;
  reason?: string;
  bingoRemoved: number;
  captainRemoved: number;
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
export async function unassignSharedRoles(eventId: number): Promise<UnassignReport> {
  const cfg = await loadTeamChannelConfig();
  if (!cfg) return { ok: false, reason: 'team sync disabled or unconfigured', bingoRemoved: 0, captainRemoved: 0 };
  if (!cfg.bingoRoleId && !cfg.captainRoleId) {
    return { ok: false, reason: 'No bingo or captain role is configured to remove.', bingoRemoved: 0, captainRemoved: 0 };
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', bingoRemoved: 0, captainRemoved: 0 };

  // Everyone who could hold the bingo role for this event: team captains, drafted players, and
  // sign-ups. Captains are also the only holders of the captain role. Members with no linked
  // Discord resolve to null and are skipped. Sets dedupe people who appear in several lists.
  const bingoIds = new Set<string>();
  const captainIds = new Set<string>();

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
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
    const did = (await discordIdForUserId(s.userId)) ?? (await discordIdForPlayerClanMember(s.clanMemberId));
    if (did) bingoIds.add(did);
  }

  const eventPlayers = await db.select().from(players).where(eq(players.eventId, eventId));
  for (const p of eventPlayers) {
    const did = await discordIdForPlayerClanMember(p.clanMemberId);
    if (did) bingoIds.add(did);
  }

  let bingoRemoved = 0;
  let captainRemoved = 0;
  if (cfg.bingoRoleId) {
    for (const did of bingoIds) {
      await removeRole(cfg, did, cfg.bingoRoleId);
      bingoRemoved++;
    }
  }
  if (cfg.captainRoleId) {
    for (const did of captainIds) {
      await removeRole(cfg, did, cfg.captainRoleId);
      captainRemoved++;
    }
  }

  return { ok: true, bingoRemoved, captainRemoved };
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
}

/**
 * Mirror a team rebrand onto Discord: role name + color, text channel slug, voice
 * channel name. No-ops silently when team sync is unconfigured or the team has no
 * provisioned Discord resources yet (they'll be created with the new identity anyway).
 */
export async function updateTeamDiscordIdentity(teamId: number): Promise<void> {
  const cfg = await loadTeamChannelConfig();
  if (!cfg) return;
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return;

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
  const cfg = await loadTeamChannelConfig();
  if (!cfg) {
    return { ok: false, reason: 'team sync disabled or unconfigured', rolesDeleted: 0, channelsDeleted: 0, categoryDeleted: false };
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, reason: 'event not found', rolesDeleted: 0, channelsDeleted: 0, categoryDeleted: false };

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));

  let rolesDeleted = 0;
  let channelsDeleted = 0;

  for (const team of eventTeams) {
    const cleared: Partial<typeof teams.$inferInsert> = {};
    if (team.discordTextChannelId) {
      if (await deleteResource(cfg, `/channels/${team.discordTextChannelId}`)) {
        channelsDeleted++;
        cleared.discordTextChannelId = null;
      }
    }
    if (team.discordVoiceChannelId) {
      if (await deleteResource(cfg, `/channels/${team.discordVoiceChannelId}`)) {
        channelsDeleted++;
        cleared.discordVoiceChannelId = null;
      }
    }
    if (team.discordRoleId) {
      if (await deleteResource(cfg, `/guilds/${cfg.guildId}/roles/${team.discordRoleId}`)) {
        rolesDeleted++;
        cleared.discordRoleId = null;
      }
    }
    if (Object.keys(cleared).length > 0) {
      await db.update(teams).set(cleared).where(eq(teams.id, team.id));
    }
  }

  let categoryDeleted = false;
  if (event.discordCategoryId) {
    if (await deleteResource(cfg, `/channels/${event.discordCategoryId}`)) {
      categoryDeleted = true;
      await db.update(events).set({ discordCategoryId: null }).where(eq(events.id, eventId));
    }
  }

  return { ok: true, rolesDeleted, channelsDeleted, categoryDeleted };
}

/**
 * Fire-and-forget: provision then assign, for use from the draft-complete handler. Errors
 * are swallowed into the log so a Discord-side outage can't fail ending the draft. No-op
 * when the feature is disabled (loadTeamChannelConfig returns null inside each call).
 */
export function syncTeamDiscordOnDraftCompleteFireAndForget(eventId: number): void {
  (async () => {
    const cfg = await loadTeamChannelConfig();
    if (!cfg) return; // feature off — skip entirely
    await provisionTeamDiscord(eventId);
    await assignTeamRoles(eventId);
  })().catch((err) => {
    log.warn('discord-teams.draft-complete-sync-throw', { eventId }, err);
  });
}
