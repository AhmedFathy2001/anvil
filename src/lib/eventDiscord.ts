/**
 * Event Discord servers for co-hosted events.
 *
 * Two layouts on top of the classic host-server setup (lib/discord-teams, layout 'own'):
 *
 *   joint  — a separate EVENT server. Each team gets a role there, and both team roles unlock one
 *            shared text + voice channel. Each clan's PLANNING (private role + text + voice) lives in
 *            that clan's OWN server, made by that clan's own bot, so being admin of the event server
 *            (or of the other clan's) never shows you the other side's plan.
 *   single — ONE server holds everything: team roles, the shared channels, and private per-team
 *            planning channels. New, or either clan's existing server.
 *
 * Getting people in. The bot cannot add someone to a server by Discord id alone, so:
 *   1. a player who opted in (guilds.join, lib/discordUserTokens) is added with their team role in one
 *      call — nothing is sent to them;
 *   2. everyone else gets ONE fixed-wording DM pointing at their signed-in Anvil event page, where a
 *      single-use invite is created on demand. The DM carries a verification code that the page also
 *      shows; it never carries an invite, so a DM with a discord.gg link is always a fake;
 *   3. there is no gateway connection to see joins, so pending members are re-checked by the cron
 *      (and instantly when the player presses "I've joined").
 *
 * Authority. The event server is driven by the bot of the clan whose admin proved Manage Server on it
 * (events.eventGuildClanId). Planning in a clan's own server is only ever done with THAT clan's bot,
 * by that clan's admins, or automatically when that clan has team sync switched on — the host never
 * drives a co-host's bot.
 */
import { and, eq, inArray, isNotNull, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  events,
  teams,
  eventParticipants,
  clanRoster,
  users,
  teamDiscordResources,
  eventDiscordMembers,
  type TeamDiscordResource,
  type EventDiscordMember,
} from '@/db/schema';
import { getSetting } from '@/lib/settings';
import { log } from '@/lib/logger';
import { discordRest, getBotCredentials, getBotTokenOnly, provenDiscordIdForSeat } from '@/lib/discord-roles';
import { discordUserCanManageGuild } from '@/lib/discord-permissions';
import { acceptedCohostClanIds } from '@/lib/coHost';
import { findRosterSeat } from '@/lib/roster';
import { resolveClanById, originForHost, apexDomain } from '@/lib/clanContext';
import { joinAccessToken, hasJoinGrant, grantStorageAvailable, dropJoinGrant } from '@/lib/discordUserTokens';
import { isDiscordOAuthConfigured } from '@/lib/discord-oauth';
import { cohostBingoRoleReady } from '@/lib/discord-teams';
import {
  buildJoinDm,
  classifyRolePut,
  dueForRecheck,
  generateJoinCode,
  inviteStillUsable,
  isDiscordLayout,
  planTeamPlacement,
  type DiscordLayout,
} from '@/lib/eventDiscordPlan';

// Permission bits. BigInt for the guild-permission maths; overwrites are serialised as strings.
const B = (n: number) => BigInt(1) << BigInt(n);
const P_CREATE_INVITE = B(0);
const P_ADMINISTRATOR = B(3);
const P_MANAGE_CHANNELS = B(4);
const P_VIEW = B(10);
const P_SEND = B(11);
const P_READ_HISTORY = B(16);
const P_CONNECT = B(20);
const P_SPEAK = B(21);
const P_MANAGE_ROLES = B(28);

const CHANNEL_TEXT = 0;
const CHANNEL_VOICE = 2;
const CHANNEL_CATEGORY = 4;
const OVERWRITE_ROLE = 0;
const OVERWRITE_MEMBER = 1;

const TEXT_ALLOW = String(P_VIEW | P_SEND | P_READ_HISTORY);
const VOICE_ALLOW = String(P_VIEW | P_CONNECT | P_SPEAK);
const BOT_ALLOW = String(P_VIEW | P_MANAGE_CHANNELS | P_CREATE_INVITE | P_SEND | P_CONNECT);

const INVITE_MAX_AGE_SECONDS = 24 * 60 * 60;
// Someone who just opened an invite is re-checked every minute; the rest far less often.
const RECHECK_AFTER_INVITE_MS = 60_000;
const RECHECK_IDLE_MS = 15 * 60_000;
const PENDING_SWEEP_LIMIT = 100;

// =============================================================================
// Server contexts
// =============================================================================

interface ServerCtx {
  clanId: number;
  botToken: string;
  guildId: string;
  botUserId: string | null;
}

const botIdCache = new Map<string, string>();
async function botUserId(botToken: string): Promise<string | null> {
  const hit = botIdCache.get(botToken);
  if (hit) return hit;
  const res = await discordRest(botToken, '/users/@me');
  if (!res.ok) return null;
  const me = (await res.json()) as { id: string };
  botIdCache.set(botToken, me.id);
  return me.id;
}

type EventRow = typeof events.$inferSelect;

/** The event server's context, driven by the bot of the clan that bound it. */
async function eventServerCtx(event: EventRow): Promise<ServerCtx | null> {
  if (!event.eventGuildId || event.eventGuildClanId == null) return null;
  const token = await getBotTokenOnly(event.eventGuildClanId);
  if (!token) return null;
  return {
    clanId: event.eventGuildClanId,
    botToken: token.token,
    guildId: event.eventGuildId,
    botUserId: await botUserId(token.token),
  };
}

/** A clan's own verified server, with its own bot. */
async function clanServerCtx(clanId: number): Promise<ServerCtx | null> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return null;
  return { clanId, botToken: creds.botToken, guildId: creds.guildId, botUserId: await botUserId(creds.botToken) };
}

async function discordError(res: Response): Promise<string> {
  let message = '';
  let code: number | undefined;
  try {
    const body = (await res.clone().json()) as { message?: string; code?: number };
    message = body.message ?? '';
    code = body.code;
  } catch {
    /* not JSON */
  }
  const base = `Discord ${res.status}${message ? `: ${message}` : ''}${code ? ` (code ${code})` : ''}`;
  if (res.status === 403 || code === 50013) {
    return `${base} — the bot needs Manage Roles, Manage Channels and Create Invite in that server, and its role must sit above the team roles.`;
  }
  if (res.status === 404 && code === 10004) return `${base} — the bot is not in that server.`;
  return base;
}

async function errorCode(res: Response): Promise<number | undefined> {
  try {
    return ((await res.clone().json()) as { code?: number }).code;
  } catch {
    return undefined;
  }
}

export interface GuildInfo {
  id: string;
  name: string;
  iconUrl: string | null;
}

async function fetchGuildInfo(ctx: { botToken: string; guildId: string }): Promise<GuildInfo | null> {
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}`);
  if (!res.ok) return null;
  const g = (await res.json()) as { id: string; name: string; icon: string | null };
  return {
    id: g.id,
    name: g.name,
    iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
  };
}

/** Which of the permissions this feature needs the bot is missing in a server. */
async function missingBotPermissions(ctx: ServerCtx): Promise<string[] | null> {
  if (!ctx.botUserId) return null;
  const [memberRes, rolesRes] = await Promise.all([
    discordRest(ctx.botToken, `/guilds/${ctx.guildId}/members/${ctx.botUserId}`),
    discordRest(ctx.botToken, `/guilds/${ctx.guildId}/roles`),
  ]);
  if (!memberRes.ok || !rolesRes.ok) return null;
  const member = (await memberRes.json()) as { roles?: string[] };
  const roles = (await rolesRes.json()) as { id: string; permissions: string }[];
  const held = new Set([ctx.guildId, ...(member.roles ?? [])]);
  let perms = BigInt(0);
  for (const r of roles) if (held.has(r.id)) perms |= BigInt(r.permissions);
  if ((perms & P_ADMINISTRATOR) !== BigInt(0)) return [];
  const need: [bigint, string][] = [
    [P_MANAGE_ROLES, 'Manage Roles'],
    [P_MANAGE_CHANNELS, 'Manage Channels'],
    [P_CREATE_INVITE, 'Create Invite'],
  ];
  return need.filter(([flag]) => (perms & flag) === BigInt(0)).map(([, label]) => label);
}

// =============================================================================
// Discord primitives
// =============================================================================

function hexColor(hex: string | null | undefined): number {
  const m = hex ? /^#?([0-9a-fA-F]{6})$/.exec(hex.trim()) : null;
  return m ? parseInt(m[1], 16) : 0;
}

function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s || 'team').slice(0, 100);
}

async function createRole(ctx: ServerCtx, name: string, color: number): Promise<{ id?: string; error?: string }> {
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}/roles`, {
    method: 'POST',
    // permissions '0': a team role only unlocks channels through overwrites; it grants nothing
    // server-wide, so handing it out can never escalate anybody.
    body: JSON.stringify({ name: name.slice(0, 100), color, permissions: '0', mentionable: true, hoist: true }),
  });
  if (!res.ok) return { error: await discordError(res) };
  return { id: ((await res.json()) as { id: string }).id };
}

async function createChannel(
  ctx: ServerCtx,
  opts: { name: string; type: number; parentId?: string | null; roleIds: string[]; allow: string },
): Promise<{ id?: string; error?: string }> {
  const overwrites: { id: string; type: number; allow?: string; deny?: string }[] = [
    { id: ctx.guildId, type: OVERWRITE_ROLE, deny: String(P_VIEW) },
  ];
  if (ctx.botUserId) overwrites.push({ id: ctx.botUserId, type: OVERWRITE_MEMBER, allow: BOT_ALLOW });
  for (const id of opts.roleIds) overwrites.push({ id, type: OVERWRITE_ROLE, allow: opts.allow });
  const body: Record<string, unknown> = { name: opts.name.slice(0, 100), type: opts.type, permission_overwrites: overwrites };
  if (opts.parentId) body.parent_id = opts.parentId;
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await discordError(res) };
  return { id: ((await res.json()) as { id: string }).id };
}

/** Make sure a role can use an existing shared channel (a team added after provisioning). */
async function allowRoleOnChannel(ctx: ServerCtx, channelId: string, roleId: string, allow: string): Promise<void> {
  const res = await discordRest(ctx.botToken, `/channels/${channelId}/permissions/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify({ type: OVERWRITE_ROLE, allow }),
  });
  if (!res.ok) log.warn('event-discord.overwrite-fail', { status: res.status, channelId, roleId });
}

async function deleteResource(ctx: ServerCtx, path: string): Promise<boolean> {
  const res = await discordRest(ctx.botToken, path, { method: 'DELETE' });
  if (res.ok || res.status === 404) return true;
  log.warn('event-discord.delete-fail', { status: res.status, path });
  return false;
}

async function putRole(ctx: ServerCtx, discordId: string, roleId: string): Promise<'joined' | 'not-member' | 'error'> {
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}/members/${discordId}/roles/${roleId}`, {
    method: 'PUT',
  });
  return classifyRolePut(res.status, res.ok ? undefined : await errorCode(res));
}

async function removeRole(ctx: ServerCtx, discordId: string, roleId: string): Promise<void> {
  await discordRest(ctx.botToken, `/guilds/${ctx.guildId}/members/${discordId}/roles/${roleId}`, { method: 'DELETE' });
}

// =============================================================================
// Configuration
// =============================================================================

export interface ConfigureResult {
  ok: boolean;
  error?: string;
  status?: number;
}

async function eventServerProvisioned(event: EventRow): Promise<boolean> {
  if (event.eventGuildCategoryId || event.eventGuildTextChannelId || event.eventGuildVoiceChannelId) return true;
  if (!event.eventGuildId) return false;
  const eventTeamIds = (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id))).map((t) => t.id);
  if (eventTeamIds.length === 0) return false;
  const row = await db
    .select({ id: teamDiscordResources.id })
    .from(teamDiscordResources)
    .where(
      and(
        inArray(teamDiscordResources.teamId, eventTeamIds),
        eq(teamDiscordResources.guildId, event.eventGuildId),
        eq(teamDiscordResources.purpose, 'event'),
      ),
    )
    .limit(1);
  return row.length > 0;
}

/** Is this clan allowed to act on this event's Discord at all (host or accepted co-host)? */
export async function clanRoleOnEvent(eventId: number, clanId: number): Promise<'host' | 'cohost' | null> {
  // clan-scope: global -- the caller passes its own clan; this answers whether that clan runs the event.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { clanId: true } });
  if (!event) return null;
  if (event.clanId === clanId) return 'host';
  return (await acceptedCohostClanIds(eventId)).includes(clanId) ? 'cohost' : null;
}

/**
 * Choose the layout and (for joint/single) the event server.
 *
 * joint/single need an accepted co-host — a lone clan already has its own server ('own'). Binding a
 * server requires the acting admin to be signed in with a Discord account that owns or has
 * Administrator / Manage Server there, checked with THEIR clan's bot, which is then the bot that drives
 * it. Knowing a server id is never enough. Changing anything once the server has been provisioned
 * needs a teardown first, so no resources are orphaned in a server we've stopped tracking.
 */
export async function configureEventServer(opts: {
  eventId: number;
  actorClanId: number;
  actorUserId: number;
  layout: unknown;
  guildId: unknown;
}): Promise<ConfigureResult> {
  const { eventId, actorClanId, actorUserId } = opts;
  if (!isDiscordLayout(opts.layout)) return { ok: false, error: 'Unknown layout.', status: 400 };
  const layout: DiscordLayout = opts.layout;
  // clan-scope: global -- authority is settled by clanRoleOnEvent below.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, error: 'Event not found.', status: 404 };
  const role = await clanRoleOnEvent(eventId, actorClanId);
  if (!role) return { ok: false, error: 'Only the host or an accepted co-host can set this up.', status: 403 };

  if (await eventServerProvisioned(event)) {
    return {
      ok: false,
      error: 'The event server already has roles and channels. Remove them first, then change the setup.',
      status: 409,
    };
  }
  // Once a server is bound, only the host or the clan that bound it may re-point it.
  if (event.eventGuildClanId != null && role !== 'host' && event.eventGuildClanId !== actorClanId) {
    return { ok: false, error: 'Another clan set up this event server. Ask the host to change it.', status: 403 };
  }

  if (layout === 'own') {
    if (role !== 'host') return { ok: false, error: 'Only the host can switch back to its own server.', status: 403 };
    await db
      .update(events)
      .set({ discordLayout: 'own', eventGuildId: null, eventGuildClanId: null })
      .where(eq(events.id, eventId));
    return { ok: true };
  }

  if ((await acceptedCohostClanIds(eventId)).length === 0) {
    return { ok: false, error: 'A separate event server is only for co-hosted events.', status: 400 };
  }
  const guildId = typeof opts.guildId === 'string' ? opts.guildId.trim() : '';
  if (!/^\d{15,22}$/.test(guildId)) return { ok: false, error: 'Enter a valid numeric Discord server ID.', status: 400 };

  const token = await getBotTokenOnly(actorClanId);
  if (!token) return { ok: false, error: 'Connect your clan’s Discord bot first (Integrations).', status: 400 };
  const actor = await db.query.users.findFirst({ where: eq(users.id, actorUserId), columns: { discordId: true } });
  if (!actor?.discordId) return { ok: false, error: 'Sign in with Discord first.', status: 403 };
  const manage = await discordUserCanManageGuild(token.token, guildId, actor.discordId);
  if (!manage.ok) return { ok: false, error: manage.reason || 'Discord did not confirm you manage that server.', status: 403 };

  const ctx: ServerCtx = { clanId: actorClanId, botToken: token.token, guildId, botUserId: await botUserId(token.token) };
  const missing = await missingBotPermissions(ctx);
  if (missing && missing.length > 0) {
    return { ok: false, error: `The bot is missing ${missing.join(', ')} in that server.`, status: 400 };
  }

  await db
    .update(events)
    .set({ discordLayout: layout, eventGuildId: guildId, eventGuildClanId: actorClanId })
    .where(eq(events.id, eventId));
  return { ok: true };
}

// =============================================================================
// Provisioning
// =============================================================================

export interface ProvisionResult {
  ok: boolean;
  error?: string;
  rolesCreated: number;
  channelsCreated: number;
  failures: string[];
}

async function resourceRow(teamId: number, clanId: number, guildId: string, purpose: 'event' | 'planning'): Promise<TeamDiscordResource> {
  const existing = await db.query.teamDiscordResources.findFirst({
    where: and(
      eq(teamDiscordResources.teamId, teamId),
      eq(teamDiscordResources.guildId, guildId),
      eq(teamDiscordResources.purpose, purpose),
    ),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(teamDiscordResources)
    .values({ teamId, clanId, guildId, purpose })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  return (await db.query.teamDiscordResources.findFirst({
    where: and(
      eq(teamDiscordResources.teamId, teamId),
      eq(teamDiscordResources.guildId, guildId),
      eq(teamDiscordResources.purpose, purpose),
    ),
  }))!;
}

/** Role + (optionally) private text/voice for one team in one server. Idempotent. */
async function ensureTeamResources(
  ctx: ServerCtx,
  team: { id: number; name: string; color: string },
  purpose: 'event' | 'planning',
  privateChannels: boolean,
  categoryId: string | null,
  result: ProvisionResult,
): Promise<TeamDiscordResource> {
  let row = await resourceRow(team.id, ctx.clanId, ctx.guildId, purpose);
  // Re-running over existing resources also brings their names up to date (a rename made while this
  // clan's bot wasn't allowed to follow it automatically).
  if (row.roleId || row.textChannelId || row.voiceChannelId) {
    if (await applyTeamIdentity(ctx, row, team)) result.failures.push(`Could not rename ${team.name}’s Discord role or channels.`);
  }
  const patch: Partial<TeamDiscordResource> = {};
  let roleId = row.roleId;
  if (!roleId) {
    const r = await createRole(ctx, teamResourceNames(team.name).role, hexColor(team.color));
    if (r.id) {
      roleId = patch.roleId = r.id;
      result.rolesCreated++;
    } else if (r.error) result.failures.push(r.error);
  }
  if (privateChannels && roleId) {
    if (categoryId && row.categoryId !== categoryId) patch.categoryId = categoryId;
    if (!row.textChannelId) {
      const c = await createChannel(ctx, {
        name: teamResourceNames(team.name).text,
        type: CHANNEL_TEXT,
        parentId: categoryId,
        roleIds: [roleId],
        allow: TEXT_ALLOW,
      });
      if (c.id) {
        patch.textChannelId = c.id;
        result.channelsCreated++;
      } else if (c.error) result.failures.push(c.error);
    }
    if (!row.voiceChannelId) {
      const c = await createChannel(ctx, {
        name: teamResourceNames(team.name).voice,
        type: CHANNEL_VOICE,
        parentId: categoryId,
        roleIds: [roleId],
        allow: VOICE_ALLOW,
      });
      if (c.id) {
        patch.voiceChannelId = c.id;
        result.channelsCreated++;
      } else if (c.error) result.failures.push(c.error);
    }
  }
  if (Object.keys(patch).length > 0) {
    await db.update(teamDiscordResources).set(patch).where(eq(teamDiscordResources.id, row.id));
    row = { ...row, ...patch };
  }
  return row;
}

/**
 * The event server: a category, one role per team, the shared text + voice both team roles can use,
 * and (single layout, or a drafted team in joint) each team's private planning channels.
 */
export async function provisionEventServer(eventId: number): Promise<ProvisionResult> {
  const result: ProvisionResult = { ok: false, rolesCreated: 0, channelsCreated: 0, failures: [] };
  // clan-scope: global -- callers have settled authority (host / binding clan / draft hook).
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ...result, error: 'Event not found.' };
  const layout = event.discordLayout as DiscordLayout;
  if (layout === 'own') return { ...result, error: 'This event uses the host’s own server.' };
  const ctx = await eventServerCtx(event);
  if (!ctx) return { ...result, error: 'The event server or its bot is not set up.' };

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
  if (eventTeams.length === 0) return { ...result, error: 'Create the teams first.' };

  let categoryId = event.eventGuildCategoryId;
  if (!categoryId) {
    const c = await createChannel(ctx, { name: event.name, type: CHANNEL_CATEGORY, roleIds: [], allow: '0' });
    if (!c.id) return { ...result, error: `Could not create the category. ${c.error ?? ''}`.trim() };
    categoryId = c.id;
    result.channelsCreated++;
    await db.update(events).set({ eventGuildCategoryId: categoryId }).where(eq(events.id, eventId));
  }

  const teamRoleIds: string[] = [];
  for (const team of eventTeams) {
    const placement = planTeamPlacement(layout, team).find((p) => p.server === 'event');
    if (!placement) continue;
    const row = await ensureTeamResources(ctx, team, 'event', placement.privateChannels, categoryId, result);
    if (row.roleId) teamRoleIds.push(row.roleId);
  }

  // Shared channels, visible to every team role and nobody else.
  const shared: { col: 'eventGuildTextChannelId' | 'eventGuildVoiceChannelId'; type: number; name: string; allow: string }[] = [
    { col: 'eventGuildTextChannelId', type: CHANNEL_TEXT, name: slug(event.name), allow: TEXT_ALLOW },
    { col: 'eventGuildVoiceChannelId', type: CHANNEL_VOICE, name: event.name, allow: VOICE_ALLOW },
  ];
  for (const s of shared) {
    const existing = event[s.col];
    if (existing) {
      for (const roleId of teamRoleIds) await allowRoleOnChannel(ctx, existing, roleId, s.allow);
      continue;
    }
    const c = await createChannel(ctx, { name: s.name, type: s.type, parentId: categoryId, roleIds: teamRoleIds, allow: s.allow });
    if (c.id) {
      result.channelsCreated++;
      await db.update(events).set({ [s.col]: c.id }).where(eq(events.id, eventId));
    } else if (c.error) result.failures.push(c.error);
  }

  result.ok = result.failures.length === 0;
  if (!result.ok) result.error = result.failures[0];
  return result;
}

export interface PlanningResult extends ProvisionResult {
  membersAssigned: number;
  membersNotInServer: number;
}

/**
 * One clan's private planning channels in ITS OWN server (joint layout), made with its own bot, and
 * its own team members given the planning role there. Players not in that server are counted, not
 * invited — this is their own clan's server.
 */
export async function provisionClanPlanning(eventId: number, clanId: number): Promise<PlanningResult> {
  const result: PlanningResult = { ok: false, rolesCreated: 0, channelsCreated: 0, failures: [], membersAssigned: 0, membersNotInServer: 0 };
  // clan-scope: global -- clanId is the acting clan, checked by the caller via clanRoleOnEvent.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ...result, error: 'Event not found.' };
  if (event.discordLayout !== 'joint') return { ...result, error: 'Planning in your own server is only for the joint layout.' };
  const ctx = await clanServerCtx(clanId);
  if (!ctx) return { ...result, error: 'Connect your clan’s Discord bot and server first (Integrations).' };

  const ownTeams = (await db.select().from(teams).where(eq(teams.eventId, eventId))).filter((t) =>
    planTeamPlacement('joint', t).some((p) => p.server === 'clan' && p.clanId === clanId),
  );
  if (ownTeams.length === 0) return { ...result, error: 'Your clan has no team of its own on this event.' };

  // One category per event in this server, shared by this clan's teams.
  const existingCat = await db.query.teamDiscordResources.findFirst({
    where: and(
      inArray(teamDiscordResources.teamId, ownTeams.map((t) => t.id)),
      eq(teamDiscordResources.guildId, ctx.guildId),
      eq(teamDiscordResources.purpose, 'planning'),
      isNotNull(teamDiscordResources.categoryId),
    ),
  });
  let categoryId = existingCat?.categoryId ?? null;
  if (!categoryId) {
    const c = await createChannel(ctx, { name: `${event.name} planning`, type: CHANNEL_CATEGORY, roleIds: [], allow: '0' });
    if (!c.id) return { ...result, error: `Could not create the category. ${c.error ?? ''}`.trim() };
    categoryId = c.id;
    result.channelsCreated++;
  }

  for (const team of ownTeams) {
    const row = await ensureTeamResources(ctx, team, 'planning', true, categoryId, result);
    if (!row.roleId) continue;
    for (const discordId of await teamDiscordIds(team.id)) {
      const r = await putRole(ctx, discordId, row.roleId);
      if (r === 'joined') result.membersAssigned++;
      else if (r === 'not-member') result.membersNotInServer++;
    }
  }
  result.ok = result.failures.length === 0;
  if (!result.ok) result.error = result.failures[0];
  return result;
}

// =============================================================================
// Members
// =============================================================================

interface RosteredPlayer {
  participantId: number;
  name: string;
  teamId: number;
  discordId: string | null;
  seatClanId: number | null;
}

async function rosteredPlayers(eventId: number): Promise<RosteredPlayer[]> {
  const rows = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.teamId)));
  const out: RosteredPlayer[] = [];
  for (const p of rows) {
    // clan-scope: global -- the seat behind a participant of an event the caller already settled.
    const seat = p.clanMemberId == null ? undefined : await findRosterSeat(eq(clanRoster.id, p.clanMemberId));
    const discordId = seat ? await provenDiscordIdForSeat({ id: seat.id, playerId: seat.playerId }) : null;
    out.push({ participantId: p.id, name: p.name, teamId: p.teamId!, discordId, seatClanId: seat?.clanId ?? null });
  }
  return out;
}

async function teamDiscordIds(teamId: number): Promise<string[]> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId), columns: { eventId: true } });
  if (!team) return [];
  const players = await rosteredPlayers(team.eventId);
  return [...new Set(players.filter((p) => p.teamId === teamId && p.discordId).map((p) => p.discordId!))];
}

async function userIdForDiscord(discordId: string): Promise<number | null> {
  const u = await db.query.users.findFirst({ where: eq(users.discordId, discordId), columns: { id: true } });
  return u?.id ?? null;
}

/** Event-server role for each team (purpose 'event'). */
async function eventRoleByTeam(event: EventRow): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!event.eventGuildId) return map;
  const teamIds = (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id))).map((t) => t.id);
  if (teamIds.length === 0) return map;
  const rows = await db
    .select()
    .from(teamDiscordResources)
    .where(
      and(
        inArray(teamDiscordResources.teamId, teamIds),
        eq(teamDiscordResources.guildId, event.eventGuildId),
        eq(teamDiscordResources.purpose, 'event'),
      ),
    );
  for (const r of rows) if (r.roleId) map.set(r.teamId, r.roleId);
  return map;
}

/**
 * The site a player should be sent to: their own clan's, when that clan runs this event (a co-host's
 * members recognise their own clan's address), else the host's.
 */
async function eventPageUrl(event: EventRow, player: { teamId: number; seatClanId: number | null }): Promise<string> {
  const running = new Set([event.clanId, ...(await acceptedCohostClanIds(event.id))]);
  const team = await db.query.teams.findFirst({ where: eq(teams.id, player.teamId), columns: { clanId: true } });
  const home =
    (team?.clanId != null && running.has(team.clanId) && team.clanId) ||
    (player.seatClanId != null && running.has(player.seatClanId) && player.seatClanId) ||
    event.clanId;
  const clan = await resolveClanById(home);
  const origin = originForHost(clan ? clan.host : apexDomain());
  return `${origin}/events/${event.id}/discord`;
}

async function sendJoinDm(ctx: ServerCtx, discordId: string, body: Record<string, unknown>): Promise<boolean> {
  const dm = await discordRest(ctx.botToken, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!dm.ok) return false;
  const channel = (await dm.json()) as { id: string };
  const res = await discordRest(ctx.botToken, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** Discord's nickname limit. */
const NICK_MAX = 32;

/** The nickname a player gets in the event server: the name they're enrolled under. */
function enrolledNick(name: string | null | undefined): string | null {
  const nick = name?.trim().slice(0, NICK_MAX);
  return nick ? nick : null;
}

/**
 * Set a member's nickname in the event server. Best-effort: Discord refuses for the server owner and
 * for anyone whose top role sits above the bot's, and neither should stop them getting their role.
 */
async function setNickname(ctx: ServerCtx, discordId: string, nick: string): Promise<string | null> {
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}/members/${discordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ nick }),
  });
  if (res.ok) return null;
  log.warn('event-discord.nick-fail', { status: res.status, guildId: ctx.guildId });
  if (res.status !== 403) return `Couldn’t set their nickname (Discord ${res.status}).`;
  // The two ways Discord says no, told apart so the admin knows which one they can fix.
  if ((await guildOwnerId(ctx)) === discordId) {
    return 'Not renamed: Discord never lets a bot rename the server owner.';
  }
  return 'Not renamed: one of their roles sits above the bot’s. Drag the Anvil role to the top of Server Settings → Roles, then re-check.';
}

const ownerCache = new Map<string, { id: string | null; at: number }>();
async function guildOwnerId(ctx: ServerCtx): Promise<string | null> {
  const hit = ownerCache.get(ctx.guildId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.id;
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}`);
  const id = res.ok ? ((await res.json()) as { owner_id?: string }).owner_id ?? null : null;
  ownerCache.set(ctx.guildId, { id, at: Date.now() });
  return id;
}

/** Discord id → enrolled name, for one event's rostered players. */
async function enrolledNames(eventId: number): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const p of await rosteredPlayers(eventId)) if (p.discordId) map.set(p.discordId, p.name);
  return map;
}

/** Add with a player's guilds.join access token. 201 = added, 204 = already in. */
async function joinWithToken(
  ctx: ServerCtx,
  discordId: string,
  roleId: string,
  accessToken: string,
  nick?: string | null,
): Promise<'joined' | 'rejected' | 'error'> {
  const res = await discordRest(ctx.botToken, `/guilds/${ctx.guildId}/members/${discordId}`, {
    method: 'PUT',
    // Added already named after their enrolled name; Manage Nicknames covers it.
    body: JSON.stringify({ access_token: accessToken, roles: [roleId], ...(nick ? { nick } : {}) }),
  });
  if (res.status === 201) return 'joined';
  if (res.status === 204) {
    // Already a member: Discord ignores `roles` and `nick` then, so hand both over separately.
    if ((await putRole(ctx, discordId, roleId)) !== 'joined') return 'error';
    if (nick) await setNickname(ctx, discordId, nick);
    return 'joined';
  }
  log.warn('event-discord.auto-join-fail', { status: res.status, discordId });
  return res.status === 401 || res.status === 403 ? 'rejected' : 'error';
}

/** Add with the player's STORED grant (needs DISCORD_TOKEN_KEY). */
async function autoJoin(ctx: ServerCtx, userId: number, discordId: string, roleId: string, nick?: string | null): Promise<'joined' | 'no-grant' | 'error'> {
  const accessToken = await joinAccessToken(userId);
  if (!accessToken) return 'no-grant';
  const r = await joinWithToken(ctx, discordId, roleId, accessToken, nick);
  // Revoked, or belongs to another account. Stop using it.
  if (r === 'rejected') await dropJoinGrant(userId).catch(() => {});
  return r === 'joined' ? 'joined' : 'error';
}

/**
 * The moment a player allows auto-join (OAuth callback): add them, with the fresh token, to every
 * event server they're still waiting on. Works with no DISCORD_TOKEN_KEY at all — the token is used
 * here and never stored unless the key exists.
 */
export async function joinPendingEventServersNow(discordId: string, accessToken: string): Promise<number> {
  const pending = await db
    .select()
    .from(eventDiscordMembers)
    .where(and(eq(eventDiscordMembers.discordId, discordId), eq(eventDiscordMembers.status, 'pending')));
  let joined = 0;
  for (const row of pending) {
    // clan-scope: global -- the signed-in player's own pending rows, whatever clan hosts them.
    const event = await db.query.events.findFirst({ where: eq(events.id, row.eventId) });
    if (!event || event.discordLayout === 'own') continue;
    const ctx = await eventServerCtx(event);
    if (!ctx || ctx.guildId !== row.guildId) continue;
    const roleId = row.teamId != null ? (await eventRoleByTeam(event)).get(row.teamId) : undefined;
    if (!roleId) continue;
    const stamp = new Date().toISOString();
    const nick = enrolledNick((await enrolledNames(event.id)).get(discordId));
    if ((await joinWithToken(ctx, discordId, roleId, accessToken, nick)) === 'joined') {
      joined++;
      await db
        .update(eventDiscordMembers)
        .set({ status: 'joined', method: 'auto', joinedAt: stamp, lastCheckedAt: stamp, lastError: null })
        .where(eq(eventDiscordMembers.id, row.id));
    }
  }
  return joined;
}

export interface MemberSyncResult {
  ok: boolean;
  error?: string;
  joined: number;
  autoJoined: number;
  dmSent: number;
  dmFailed: number;
  pending: number;
  noDiscord: number;
}

/** Try to settle one member row: role if already in, auto-join if granted. Returns the new status. */
async function settleMember(
  ctx: ServerCtx,
  row: EventDiscordMember,
  roleId: string,
  name?: string | null,
): Promise<{ status: 'joined' | 'pending'; method?: 'auto' | 'invite' | 'existing'; error?: string }> {
  const nick = enrolledNick(name);
  const put = await putRole(ctx, row.discordId, roleId);
  if (put === 'joined') {
    // Re-applied on every pass, so a renamed enrolment (or a nickname changed by hand) follows. A
    // refusal doesn't undo the join; it's kept as the row's note so the admin panel can say why.
    const nickError = nick ? await setNickname(ctx, row.discordId, nick) : null;
    return { status: 'joined', method: row.inviteCode ? 'invite' : 'existing', ...(nickError ? { error: nickError } : {}) };
  }
  if (put === 'error') return { status: 'pending', error: 'Discord refused the team role (check the bot’s role position).' };
  const userId = row.userId ?? (await userIdForDiscord(row.discordId));
  if (userId != null) {
    const auto = await autoJoin(ctx, userId, row.discordId, roleId, nick);
    if (auto === 'joined') return { status: 'joined', method: 'auto' };
  }
  return { status: 'pending' };
}

/**
 * Bring every rostered player into the event server: already-in members get their team role, opted-in
 * players are added directly, and the rest get the one DM (once) pointing at their event page.
 * Idempotent; safe to re-run after roster changes (moves swap the team role).
 */
export async function syncEventServerMembers(eventId: number): Promise<MemberSyncResult> {
  const result: MemberSyncResult = { ok: false, joined: 0, autoJoined: 0, dmSent: 0, dmFailed: 0, pending: 0, noDiscord: 0 };
  // clan-scope: global -- callers have settled authority.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ...result, error: 'Event not found.' };
  if (event.discordLayout === 'own') return { ...result, error: 'This event uses the host’s own server.' };
  const ctx = await eventServerCtx(event);
  if (!ctx) return { ...result, error: 'The event server or its bot is not set up.' };
  const roleByTeam = await eventRoleByTeam(event);
  if (roleByTeam.size === 0) return { ...result, error: 'Create the event server roles first.' };
  const teamNames = new Map(
    (await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, eventId))).map((t) => [t.id, t.name]),
  );

  for (const player of await rosteredPlayers(eventId)) {
    if (!player.discordId) {
      result.noDiscord++;
      continue;
    }
    const roleId = roleByTeam.get(player.teamId);
    if (!roleId) continue;

    let row = await db.query.eventDiscordMembers.findFirst({
      where: and(
        eq(eventDiscordMembers.eventId, eventId),
        eq(eventDiscordMembers.guildId, ctx.guildId),
        eq(eventDiscordMembers.discordId, player.discordId),
      ),
    });
    const userId = await userIdForDiscord(player.discordId);
    if (!row) {
      [row] = await db
        .insert(eventDiscordMembers)
        .values({
          eventId,
          teamId: player.teamId,
          guildId: ctx.guildId,
          discordId: player.discordId,
          userId,
          joinCode: generateJoinCode(),
        })
        .onConflictDoNothing()
        .returning();
      if (!row) continue;
    }

    // Moved team: swap the role if they're already in.
    if (row.teamId !== player.teamId) {
      const oldRole = row.teamId != null ? roleByTeam.get(row.teamId) : undefined;
      if (row.status === 'joined' && oldRole && oldRole !== roleId) await removeRole(ctx, row.discordId, oldRole);
      await db.update(eventDiscordMembers).set({ teamId: player.teamId }).where(eq(eventDiscordMembers.id, row.id));
      row = { ...row, teamId: player.teamId };
    }

    const settled = await settleMember(ctx, row, roleId, player.name);
    const stamp = new Date().toISOString();
    if (settled.status === 'joined') {
      await db
        .update(eventDiscordMembers)
        .set({ status: 'joined', method: settled.method, joinedAt: row.joinedAt ?? stamp, lastCheckedAt: stamp, lastError: settled.error ?? null, userId })
        .where(eq(eventDiscordMembers.id, row.id));
      result.joined++;
      if (settled.method === 'auto') result.autoJoined++;
      continue;
    }

    const patch: Partial<EventDiscordMember> = { status: 'pending', lastCheckedAt: stamp, lastError: settled.error ?? null, userId };
    if (row.dmStatus === 'none') {
      const dm = buildJoinDm({
        eventName: event.name,
        teamName: teamNames.get(player.teamId) ?? 'your team',
        pageUrl: await eventPageUrl(event, player),
        code: row.joinCode,
      });
      const sent = await sendJoinDm(ctx, row.discordId, dm);
      patch.dmStatus = sent ? 'sent' : 'failed';
      if (sent) result.dmSent++;
      else result.dmFailed++;
    }
    await db.update(eventDiscordMembers).set(patch).where(eq(eventDiscordMembers.id, row.id));
    result.pending++;
  }
  result.ok = true;
  return result;
}

/**
 * Cron backstop: re-check pending members (there is no gateway to tell us when someone joins). Rows
 * that recently opened an invite are checked every minute; the rest every 15. Recent rows only.
 */
export async function recheckPendingEventServerMembers(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 45 * 24 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
  const pending = await db
    .select()
    .from(eventDiscordMembers)
    .where(and(eq(eventDiscordMembers.status, 'pending'), gte(eventDiscordMembers.createdAt, since)))
    .limit(PENDING_SWEEP_LIMIT * 5);
  const due = pending
    .filter((r) => dueForRecheck(r.lastCheckedAt, now, r.inviteCode ? RECHECK_AFTER_INVITE_MS : RECHECK_IDLE_MS))
    .slice(0, PENDING_SWEEP_LIMIT);
  if (due.length === 0) return 0;

  let joined = 0;
  const byEvent = new Map<number, EventDiscordMember[]>();
  for (const r of due) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
  for (const [eventId, rows] of byEvent) {
    // clan-scope: global -- system sweep over rows this module created.
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!event || event.discordLayout === 'own') continue;
    const ctx = await eventServerCtx(event);
    if (!ctx) continue;
    const roleByTeam = await eventRoleByTeam(event);
    const names = await enrolledNames(eventId);
    for (const row of rows) {
      if (row.guildId !== ctx.guildId) continue;
      const roleId = row.teamId != null ? roleByTeam.get(row.teamId) : undefined;
      if (!roleId) continue;
      const settled = await settleMember(ctx, row, roleId, names.get(row.discordId));
      const stamp = now.toISOString();
      if (settled.status === 'joined') {
        joined++;
        await db
          .update(eventDiscordMembers)
          .set({ status: 'joined', method: settled.method, joinedAt: stamp, lastCheckedAt: stamp, lastError: settled.error ?? null })
          .where(eq(eventDiscordMembers.id, row.id));
      } else {
        await db
          .update(eventDiscordMembers)
          .set({ lastCheckedAt: stamp, lastError: settled.error ?? null })
          .where(eq(eventDiscordMembers.id, row.id));
      }
    }
  }
  return joined;
}

// =============================================================================
// Player view
// =============================================================================

export interface PlayerJoinView {
  available: boolean;
  reason?: string;
  server?: GuildInfo | null;
  teamName?: string | null;
  code?: string;
  status?: 'pending' | 'joined';
  dmStatus?: string;
  hasAutoJoinGrant?: boolean;
  autoJoinAvailable?: boolean;
  hostNames?: string[];
}

async function playerRow(eventId: number, userId: number): Promise<{ event: EventRow; row: EventDiscordMember; ctx: ServerCtx } | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { discordId: true } });
  if (!user?.discordId) return null;
  // clan-scope: global -- only ever answers about the signed-in player's own row.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.discordLayout === 'own' || !event.eventGuildId) return null;
  const row = await db.query.eventDiscordMembers.findFirst({
    where: and(
      eq(eventDiscordMembers.eventId, eventId),
      eq(eventDiscordMembers.guildId, event.eventGuildId),
      eq(eventDiscordMembers.discordId, user.discordId),
    ),
  });
  if (!row) return null;
  const ctx = await eventServerCtx(event);
  if (!ctx) return null;
  return { event, row, ctx };
}

export async function playerJoinView(eventId: number, userId: number): Promise<PlayerJoinView> {
  const found = await playerRow(eventId, userId);
  if (!found) {
    return {
      available: false,
      reason: 'You’ll see your event server here once you’re on a team and the hosts have set it up.',
    };
  }
  const { event, row, ctx } = found;
  const [server, team, grant, hostIds] = await Promise.all([
    fetchGuildInfo(ctx),
    row.teamId != null ? db.query.teams.findFirst({ where: eq(teams.id, row.teamId), columns: { name: true } }) : null,
    hasJoinGrant(userId),
    acceptedCohostClanIds(eventId),
  ]);
  const hostNames: string[] = [];
  for (const id of [event.clanId, ...hostIds]) {
    const c = await resolveClanById(id);
    if (c) hostNames.push(c.name);
  }
  return {
    available: true,
    server,
    teamName: team?.name ?? null,
    code: row.joinCode,
    status: row.status === 'joined' ? 'joined' : 'pending',
    dmStatus: row.dmStatus,
    hasAutoJoinGrant: grant,
    autoJoinAvailable: isDiscordOAuthConfigured(),
    hostNames,
  };
}

/** A single-use, 24h invite to the shared text channel — only ever returned to its own player. */
export async function playerInvite(eventId: number, userId: number): Promise<{ ok: boolean; url?: string; error?: string }> {
  const found = await playerRow(eventId, userId);
  if (!found) return { ok: false, error: 'Nothing to join yet.' };
  const { event, row, ctx } = found;
  if (row.status === 'joined') return { ok: false, error: 'You’re already in.' };
  const now = new Date();
  if (row.inviteCode && inviteStillUsable(row.inviteExpiresAt, now)) {
    return { ok: true, url: `https://discord.gg/${row.inviteCode}` };
  }
  const channelId = event.eventGuildTextChannelId;
  if (!channelId) return { ok: false, error: 'The event server isn’t ready yet.' };
  const res = await discordRest(ctx.botToken, `/channels/${channelId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ max_age: INVITE_MAX_AGE_SECONDS, max_uses: 1, unique: true, temporary: false }),
  });
  if (!res.ok) {
    log.warn('event-discord.invite-fail', { status: res.status, eventId });
    return { ok: false, error: 'Couldn’t create your invite. Ask a host to check the bot has Create Invite.' };
  }
  const invite = (await res.json()) as { code: string; expires_at?: string | null };
  const expiresAt = invite.expires_at ?? new Date(now.getTime() + INVITE_MAX_AGE_SECONDS * 1000).toISOString();
  await db
    .update(eventDiscordMembers)
    // lastCheckedAt cleared so the cron re-checks this row on its next minute.
    .set({ inviteCode: invite.code, inviteExpiresAt: expiresAt, lastCheckedAt: null })
    .where(eq(eventDiscordMembers.id, row.id));
  return { ok: true, url: `https://discord.gg/${invite.code}` };
}

/** "I've joined" / "add me" — settle now rather than waiting for the cron. */
export async function playerSettle(eventId: number, userId: number): Promise<{ ok: boolean; status: 'joined' | 'pending'; needsGrant?: boolean; error?: string }> {
  const found = await playerRow(eventId, userId);
  if (!found) return { ok: false, status: 'pending', error: 'Nothing to join yet.' };
  const { event, row, ctx } = found;
  if (row.status === 'joined') return { ok: true, status: 'joined' };
  const roleId = row.teamId != null ? (await eventRoleByTeam(event)).get(row.teamId) : undefined;
  if (!roleId) return { ok: false, status: 'pending', error: 'Your team role isn’t set up yet.' };
  const settled = await settleMember(ctx, { ...row, userId }, roleId, (await enrolledNames(eventId)).get(row.discordId));
  const stamp = new Date().toISOString();
  if (settled.status === 'joined') {
    await db
      .update(eventDiscordMembers)
      .set({ status: 'joined', method: settled.method, joinedAt: stamp, lastCheckedAt: stamp, lastError: settled.error ?? null, userId })
      .where(eq(eventDiscordMembers.id, row.id));
    return { ok: true, status: 'joined' };
  }
  await db.update(eventDiscordMembers).set({ lastCheckedAt: stamp, userId }).where(eq(eventDiscordMembers.id, row.id));
  return { ok: true, status: 'pending', needsGrant: !(await hasJoinGrant(userId)), error: settled.error };
}

// =============================================================================
// Admin status + teardown
// =============================================================================

export interface AdminStatus {
  role: 'host' | 'cohost';
  layout: DiscordLayout;
  cohosted: boolean;
  server: GuildInfo | null;
  boundByThisClan: boolean;
  canManageEventServer: boolean;
  provisioned: boolean;
  sharedText: boolean;
  sharedVoice: boolean;
  /**
   * A co-host's own contestant role in its own server (lib/discord-teams). Null for the host, whose
   * shared roles are on the Teams tab. `ready` = co-host role tools are switched on and a safe role
   * is selected under Integrations.
   */
  cohostRole: { ready: boolean } | null;
  /** DISCORD_TOKEN_KEY set: players who allowed auto-join earlier are added later too. */
  autoJoinStoresGrants: boolean;
  ownServerConnected: boolean;
  ownTeamSyncEnabled: boolean;
  teams: { id: number; name: string; clanId: number | null; eventRole: boolean; eventPrivate: boolean; planning: boolean | null }[];
  members: { name: string; teamName: string | null; status: 'joined' | 'pending' | 'no-discord'; dmStatus: string | null; method: string | null; lastError: string | null }[];
}

export async function adminStatus(eventId: number, clanId: number): Promise<AdminStatus | null> {
  const role = await clanRoleOnEvent(eventId, clanId);
  if (!role) return null;
  // clan-scope: global -- clanRoleOnEvent above settled that this clan runs the event.
  const event = (await db.query.events.findFirst({ where: eq(events.id, eventId) }))!;
  const layout = (isDiscordLayout(event.discordLayout) ? event.discordLayout : 'own') as DiscordLayout;
  const [cohosts, ctx, ownCreds, teamSync, eventTeams] = await Promise.all([
    acceptedCohostClanIds(eventId),
    eventServerCtx(event),
    getBotCredentials(clanId),
    getSetting(clanId, 'discord_team_sync_enabled'),
    db.select().from(teams).where(eq(teams.eventId, eventId)),
  ]);
  const teamIds = eventTeams.map((t) => t.id);
  const resources = teamIds.length
    ? await db.select().from(teamDiscordResources).where(inArray(teamDiscordResources.teamId, teamIds))
    : [];
  const server = ctx ? await fetchGuildInfo(ctx) : null;

  const teamName = new Map(eventTeams.map((t) => [t.id, t.name]));
  const memberRows = event.eventGuildId
    ? await db
        .select()
        .from(eventDiscordMembers)
        .where(and(eq(eventDiscordMembers.eventId, eventId), eq(eventDiscordMembers.guildId, event.eventGuildId)))
    : [];
  const byDiscord = new Map(memberRows.map((m) => [m.discordId, m]));
  const members: AdminStatus['members'] = [];
  if (layout !== 'own') {
    for (const p of await rosteredPlayers(eventId)) {
      const m = p.discordId ? byDiscord.get(p.discordId) : undefined;
      members.push({
        name: p.name,
        teamName: teamName.get(p.teamId) ?? null,
        status: !p.discordId ? 'no-discord' : m?.status === 'joined' ? 'joined' : 'pending',
        dmStatus: m?.dmStatus ?? null,
        method: m?.method ?? null,
        lastError: m?.lastError ?? null,
      });
    }
  }

  return {
    role,
    layout,
    cohosted: cohosts.length > 0,
    server,
    boundByThisClan: event.eventGuildClanId === clanId,
    canManageEventServer: role === 'host' || event.eventGuildClanId === clanId,
    provisioned: await eventServerProvisioned(event),
    sharedText: !!event.eventGuildTextChannelId,
    sharedVoice: !!event.eventGuildVoiceChannelId,
    cohostRole: role === 'cohost' ? { ready: await cohostBingoRoleReady(eventId, clanId) } : null,
    autoJoinStoresGrants: grantStorageAvailable(),
    ownServerConnected: !!ownCreds,
    ownTeamSyncEnabled: teamSync === 'true',
    teams: eventTeams.map((t) => {
      const ev = resources.find((r) => r.teamId === t.id && r.purpose === 'event' && r.guildId === event.eventGuildId);
      const plan = resources.find((r) => r.teamId === t.id && r.purpose === 'planning');
      const planned = planTeamPlacement(layout, t).some((p) => p.server === 'clan');
      return {
        id: t.id,
        name: t.name,
        clanId: t.clanId,
        eventRole: !!ev?.roleId,
        eventPrivate: !!(ev?.textChannelId && ev?.voiceChannelId),
        planning: planned ? !!(plan?.roleId && plan?.textChannelId && plan?.voiceChannelId) : null,
      };
    }),
    members,
  };
}

/** Remove the event server's roles + channels (host or binding clan). Keeps the binding itself. */
export async function teardownEventServer(eventId: number): Promise<{ ok: boolean; error?: string; deleted: number; failed: number }> {
  // clan-scope: global -- caller settled authority.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, error: 'Event not found.', deleted: 0, failed: 0 };
  const ctx = await eventServerCtx(event);
  if (!ctx) return { ok: false, error: 'The event server or its bot is not set up.', deleted: 0, failed: 0 };
  let deleted = 0;
  let failed = 0;
  const tally = (ok: boolean) => (ok ? deleted++ : failed++);

  const teamIds = (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
  const rows = teamIds.length
    ? await db
        .select()
        .from(teamDiscordResources)
        .where(and(inArray(teamDiscordResources.teamId, teamIds), eq(teamDiscordResources.guildId, ctx.guildId), eq(teamDiscordResources.purpose, 'event')))
    : [];
  for (const r of rows) {
    let ok = true;
    for (const ch of [r.textChannelId, r.voiceChannelId]) if (ch) ok = (await deleteResource(ctx, `/channels/${ch}`)) && ok;
    if (r.roleId) ok = (await deleteResource(ctx, `/guilds/${ctx.guildId}/roles/${r.roleId}`)) && ok;
    tally(ok);
    if (ok) await db.delete(teamDiscordResources).where(eq(teamDiscordResources.id, r.id));
  }
  const cleared: Partial<EventRow> = {};
  for (const col of ['eventGuildTextChannelId', 'eventGuildVoiceChannelId', 'eventGuildCategoryId'] as const) {
    const id = event[col];
    if (!id) continue;
    const ok = await deleteResource(ctx, `/channels/${id}`);
    tally(ok);
    if (ok) cleared[col] = null;
  }
  if (Object.keys(cleared).length > 0) await db.update(events).set(cleared).where(eq(events.id, eventId));
  // Join tracking is about this server's roles, which are gone.
  await db.delete(eventDiscordMembers).where(and(eq(eventDiscordMembers.eventId, eventId), eq(eventDiscordMembers.guildId, ctx.guildId)));
  return { ok: failed === 0, deleted, failed, error: failed ? 'Some roles or channels could not be deleted; delete them by hand and retry.' : undefined };
}

/** Remove one clan's planning channels from its own server. */
export async function teardownClanPlanning(eventId: number, clanId: number): Promise<{ ok: boolean; error?: string; deleted: number; failed: number }> {
  const ctx = await clanServerCtx(clanId);
  if (!ctx) return { ok: false, error: 'Your clan’s bot or server is not connected.', deleted: 0, failed: 0 };
  const teamIds = (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
  const rows = teamIds.length
    ? await db
        .select()
        .from(teamDiscordResources)
        .where(and(inArray(teamDiscordResources.teamId, teamIds), eq(teamDiscordResources.clanId, clanId), eq(teamDiscordResources.purpose, 'planning')))
    : [];
  let deleted = 0;
  let failed = 0;
  const categories = new Set<string>();
  for (const r of rows) {
    if (r.guildId !== ctx.guildId) {
      failed++;
      continue;
    }
    let ok = true;
    for (const ch of [r.textChannelId, r.voiceChannelId]) if (ch) ok = (await deleteResource(ctx, `/channels/${ch}`)) && ok;
    if (r.roleId) ok = (await deleteResource(ctx, `/guilds/${ctx.guildId}/roles/${r.roleId}`)) && ok;
    if (r.categoryId) categories.add(r.categoryId);
    if (ok) {
      deleted++;
      await db.delete(teamDiscordResources).where(eq(teamDiscordResources.id, r.id));
    } else failed++;
  }
  for (const cat of categories) if (!(await deleteResource(ctx, `/channels/${cat}`))) failed++;
  return { ok: failed === 0, deleted, failed, error: failed ? 'Some planning channels could not be deleted.' : undefined };
}

/**
 * Draft complete / rosters final: build the event server and bring everyone in. Each clan's planning
 * runs only where that clan switched team sync on (its own consent to automatic changes in its own
 * server). Fire-and-forget; never fails the caller.
 */
export function syncEventDiscordFireAndForget(eventId: number): void {
  (async () => {
    // clan-scope: global -- system hook after a roster change on this event.
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { discordLayout: true, clanId: true } });
    if (!event || event.discordLayout === 'own') return;
    // Members are synced even after a partial provision: whichever team roles exist can be handed out.
    await provisionEventServer(eventId);
    await syncEventServerMembers(eventId);
    if (event.discordLayout === 'joint') {
      for (const clanId of [event.clanId, ...(await acceptedCohostClanIds(eventId))]) {
        if ((await getSetting(clanId, 'discord_team_sync_enabled')) === 'true') await provisionClanPlanning(eventId, clanId);
      }
    }
  })().catch((err) => log.warn('event-discord.sync-throw', { eventId }, err));
}

// =============================================================================
// Team rename / recolour
// =============================================================================

// The names provisioning gives a team's resources — kept in one place so a rename lands on exactly
// what ensureTeamResources would have created.
function teamResourceNames(teamName: string) {
  return { role: teamName.slice(0, 100), text: `${slug(teamName)}-planning`, voice: `${teamName} planning`.slice(0, 100) };
}

/** PATCH one resource row's role + channels to the team's current name and colour. */
async function applyTeamIdentity(ctx: ServerCtx, row: TeamDiscordResource, team: { name: string; color: string }): Promise<number> {
  const names = teamResourceNames(team.name);
  let failed = 0;
  const patch = async (path: string, body: Record<string, unknown>) => {
    const res = await discordRest(ctx.botToken, path, { method: 'PATCH', body: JSON.stringify(body) });
    // 404: deleted by hand in Discord — nothing to rename, and not worth failing the rest over.
    if (!res.ok && res.status !== 404) {
      failed++;
      log.warn('event-discord.rename-fail', { status: res.status, path });
    }
  };
  if (row.roleId) await patch(`/guilds/${ctx.guildId}/roles/${row.roleId}`, { name: names.role, color: hexColor(team.color) });
  if (row.textChannelId) await patch(`/channels/${row.textChannelId}`, { name: names.text });
  if (row.voiceChannelId) await patch(`/channels/${row.voiceChannelId}`, { name: names.voice });
  return failed;
}

/**
 * Mirror a team's rename / recolour onto every server it has resources in: its role (and private
 * channels) in the event server, and its planning role + channels in its clan's own server.
 *
 * Each server is changed only with the bot that owns it. A planning row in ANOTHER clan's server is
 * only touched when that clan switched team sync on — the same consent automatic planning needs — so
 * one clan renaming a team can't push text into the other's server unasked. That clan's own admins
 * pick the new name up with "Create / update my planning channels".
 */
export async function updateTeamEventDiscordIdentity(teamId: number, actingClanId?: number): Promise<{ updated: number; skipped: number; failed: number }> {
  const out = { updated: 0, skipped: 0, failed: 0 };
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return out;
  const rows = await db.select().from(teamDiscordResources).where(eq(teamDiscordResources.teamId, teamId));
  if (rows.length === 0) return out;
  // clan-scope: global -- the event of a team whose rename the caller already authorised.
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) return out;

  for (const row of rows) {
    let ctx: ServerCtx | null = null;
    if (row.purpose === 'event') {
      ctx = await eventServerCtx(event);
    } else if (row.clanId === actingClanId || (await getSetting(row.clanId, 'discord_team_sync_enabled')) === 'true') {
      ctx = await clanServerCtx(row.clanId);
    }
    // The bot must still be driving the very server the row was made in.
    if (!ctx || ctx.guildId !== row.guildId) {
      out.skipped++;
      continue;
    }
    const failed = await applyTeamIdentity(ctx, row, team);
    if (failed) out.failed++;
    else out.updated++;
  }
  return out;
}

/** True when this event's Discord lives in a separate event server (lib/discord-teams must stand down). */
export async function usesEventServer(eventId: number): Promise<boolean> {
  // clan-scope: global -- reads one column of an event the caller already holds.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { discordLayout: true } });
  return !!event && event.discordLayout !== 'own';
}
