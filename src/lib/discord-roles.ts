/**
 * Discord role sync — gives each linked clan member the Discord roles that
 * correspond to their in-game clan rank, plus a default set every member gets.
 *
 * Architecture: no running bot process. We hold a Bot token in env and hit the
 * Discord REST API for reads (member lookup, guild roles) and writes (PUT /
 * DELETE role on a member). Fire-and-forget from plugin/clan-sync change events.
 *
 * Feature flag: `discord_role_sync_enabled` setting must be 'true' AND
 * DISCORD_BOT_TOKEN env must be set. Either missing → all sync calls become
 * no-ops, so this module is safe to deploy before the token is provisioned.
 */
import { db } from '@/db';
import { clanMembers, settings, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { log } from '@/lib/logger';
import { normalizeRsn } from '@/lib/auth';

const DISCORD_API = 'https://discord.com/api/v10';

/**
 * Canonical form for rank keys. RuneLite emits ranks in mixed conventions
 * ("deputy_owner" vs "Deputy Owner"), Discord role names use spaces, and admins
 * enter map keys however they want — collapse all of those to one canonical
 * lowercase-with-spaces form so lookups are stable.
 */
function normalizeRankKey(rank: string | null | undefined): string | null {
  if (typeof rank !== 'string') return null;
  const v = rank.trim().toLowerCase().replace(/[_\s]+/g, ' ');
  return v.length > 0 ? v : null;
}

// Standard OSRS clan rank precedence (highest → lowest), in canonical form. Custom
// ranks (e.g. "marshal", "imp") that aren't in this list are treated as "lowest" —
// they still get default roles but won't pick up a rank-specific role unless the
// admin adds an entry to the rankRoleMap.
const RANK_PRECEDENCE = [
  'owner',
  'deputy owner',
  'coordinator',
  'overseer',
  'general',
  'captain',
  'lieutenant',
  'sergeant',
  'corporal',
  'recruit',
  // 'friend' is the OSRS guest rank; treated separately (guests don't get the
  // member-tier auto-roles by default).
];

/** Lower index = higher rank. Unknown / nullable → +Infinity (lowest). */
function rankIndex(rank: string | null | undefined): number {
  const key = normalizeRankKey(rank);
  if (!key) return Number.POSITIVE_INFINITY;
  const idx = RANK_PRECEDENCE.indexOf(key);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

function pickHighestRank(ranks: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const r of ranks) {
    if (!r) continue;
    if (best === null || rankIndex(r) < rankIndex(best)) best = r;
  }
  return best;
}

// =============================================================================
// Config (env + settings)
// =============================================================================

interface RoleSyncConfig {
  botToken: string;
  guildId: string;
  rankRoleMap: Record<string, string>; // lowercased OSRS rank → Discord role ID
  defaultRoleIds: string[];            // always applied to active non-guest members
  guestRoleIds: string[];              // applied to active guests (when sync is triggered for one)
}

async function readSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

function parseJsonRecord(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) {
        if (typeof val !== 'string') continue;
        // Normalize the rank key so admins can write "Deputy Owner", "deputy_owner",
        // or "DEPUTY OWNER" interchangeably — all hash to "deputy owner".
        const key = normalizeRankKey(k);
        if (key) out[key] = val;
      }
      return out;
    }
  } catch {
    // ignore — surfaces as empty map; admin will fix the JSON
  }
  return {};
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string');
  } catch {
    // ignore
  }
  return [];
}

/**
 * Resolve the live config. Returns null when the feature is disabled OR essential
 * credentials are missing — callers should treat that as "skip silently".
 */
export async function loadRoleSyncConfig(): Promise<RoleSyncConfig | null> {
  const enabled = (await readSetting('discord_role_sync_enabled')) === 'true';
  if (!enabled) return null;

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return null;

  // Guild ID is settings-driven (not env) so admins can change/test without
  // redeploying. Env override is allowed for local dev.
  const guildId = (await readSetting('discord_guild_id')) || process.env.DISCORD_GUILD_ID || '';
  if (!guildId) return null;

  return {
    botToken,
    guildId,
    rankRoleMap: parseJsonRecord(await readSetting('discord_rank_role_map')),
    defaultRoleIds: parseJsonArray(await readSetting('discord_default_role_ids')),
    guestRoleIds: parseJsonArray(await readSetting('discord_guest_role_ids')),
  };
}

// =============================================================================
// Discord REST helpers (with rate-limit retry)
// =============================================================================

const MAX_RETRY_MS = 5000;

async function discordFetch(
  cfg: RoleSyncConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${DISCORD_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bot ${cfg.botToken}`,
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let res = await fetch(url, { ...init, headers });
  if (res.status === 429) {
    const headerVal = res.headers.get('retry-after');
    let retryMs = headerVal ? Number(headerVal) * 1000 : 0;
    if (!retryMs) {
      try {
        const body = (await res.clone().json()) as { retry_after?: number };
        if (typeof body.retry_after === 'number') retryMs = body.retry_after * 1000;
      } catch {
        // body not JSON
      }
    }
    retryMs = Math.max(250, Math.min(retryMs || 1000, MAX_RETRY_MS));
    log.warn('discord-roles.rate-limited', { path, retryMs });
    await new Promise((r) => setTimeout(r, retryMs));
    res = await fetch(url, { ...init, headers });
  }
  return res;
}

// =============================================================================
// Read APIs (for admin UI and matching)
// =============================================================================

export interface DiscordRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
}

export async function fetchGuildRoles(): Promise<DiscordRole[]> {
  const cfg = await loadRoleSyncConfig();
  if (!cfg) return [];
  const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/roles`);
  if (!res.ok) {
    log.warn('discord-roles.list-roles-fail', { status: res.status });
    return [];
  }
  return (await res.json()) as DiscordRole[];
}

interface DiscordGuildMember {
  user?: { id: string; username: string; global_name?: string };
  nick?: string | null;
  roles: string[];
}

async function getGuildMember(
  cfg: RoleSyncConfig,
  discordUserId: string,
): Promise<DiscordGuildMember | null> {
  const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members/${discordUserId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    log.warn('discord-roles.get-member-fail', { status: res.status, discordUserId });
    return null;
  }
  return (await res.json()) as DiscordGuildMember;
}

// Display names sometimes pack multiple RSNs separated by /, |, or comma. We split
// and trim so a nickname like "Drenvox / Drenvox mdps / Drenvox alt" matches each
// of the three RSNs independently.
function splitDisplayAliases(name: string | null | undefined): string[] {
  if (!name) return [];
  return name
    .split(/[\/|,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Find a Discord user ID for an RSN by guild-member name match. Uses the search
 * endpoint (no privileged intent required) to scope the candidate set, then
 * applies the alias-split match client-side. Returns null when no match — that's
 * fine, the role-sync caller just skips this member.
 */
export async function findDiscordIdByRsn(rsn: string): Promise<string | null> {
  const cfg = await loadRoleSyncConfig();
  if (!cfg) return null;
  const target = normalizeRsn(rsn);
  if (!target) return null;

  // Discord's search is prefix-only. The common case (Discord nickname starts
  // with the RSN) gets caught here cheaply. For "name1 / name2" patterns we need
  // the second-or-later alias which search won't find on its own — those rely
  // on the user eventually linking their account via OAuth instead.
  const q = encodeURIComponent(rsn);
  const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members/search?query=${q}&limit=10`);
  if (!res.ok) {
    log.warn('discord-roles.search-fail', { status: res.status, rsn });
    return null;
  }
  const candidates = (await res.json()) as DiscordGuildMember[];
  for (const m of candidates) {
    if (!m.user) continue;
    const aliases = [
      ...splitDisplayAliases(m.nick),
      ...splitDisplayAliases(m.user.global_name),
      ...splitDisplayAliases(m.user.username),
    ];
    if (aliases.some((alias) => normalizeRsn(alias) === target)) return m.user.id;
  }
  return null;
}

// =============================================================================
// Discord-id resolution for a clan_member row
// =============================================================================

interface MinimalClanMember {
  id: number;
  rsn: string;
  userId: number | null;
  discordId: string | null;
}

/**
 * Resolve a Discord user ID for a clan member. Priority:
 *   1) clan_members.userId → users.discordId  (canonical OAuth-linked)
 *   2) clan_members.discordId  (legacy column, or previously-cached name match)
 *   3) Guild member search by RSN prefix + alias split  (best-effort)
 *
 * Returns null when none of those produce a match. Callers should treat null
 * as "skip — this member can't be synced until they link or rename themselves
 * on Discord".
 */
export async function resolveDiscordIdForMember(
  member: MinimalClanMember,
): Promise<string | null> {
  if (member.userId != null) {
    const u = await db.query.users.findFirst({ where: eq(users.id, member.userId) });
    if (u?.discordId) return u.discordId;
  }
  if (member.discordId) return member.discordId;
  return findDiscordIdByRsn(member.rsn);
}

// =============================================================================
// Sync logic
// =============================================================================

interface SyncReport {
  ok: boolean;
  reason?: string;
  discordUserId?: string;
  added: string[];
  removed: string[];
}

/**
 * Compute and apply the target Discord roles for a clan member. Handles alts by
 * gathering all active clan_members owned by the same Discord user and picking
 * the highest in-game rank across them. A guest with no non-guest siblings is
 * synced to the guest-role set; otherwise we treat them as a full member.
 *
 * Fire-and-forget friendly: catches errors and logs them as warnings. Returns
 * a report so admin endpoints can surface what happened.
 */
export async function syncRolesForClanMember(memberId: number): Promise<SyncReport> {
  const cfg = await loadRoleSyncConfig();
  if (!cfg) return { ok: false, reason: 'sync disabled or unconfigured', added: [], removed: [] };

  const member = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, memberId) });
  if (!member) return { ok: false, reason: 'member not found', added: [], removed: [] };
  if (member.leftAt) return { ok: false, reason: 'member has left', added: [], removed: [] };

  const discordUserId = await resolveDiscordIdForMember(member);
  if (!discordUserId) {
    return { ok: false, reason: 'no Discord id linkable to this RSN', added: [], removed: [] };
  }

  // Collect every active clan_member that belongs to this Discord user. The OAuth
  // link (users.discord_id) is the strongest signal — we always pull those. The
  // legacy clan_members.discord_id covers ghost/auto-discovered linkages.
  const ownedRows: { rank: string | null; isGuest: number }[] = [];

  const viaOauth = await db
    .select({ rank: clanMembers.rank, isGuest: clanMembers.isGuest })
    .from(clanMembers)
    .innerJoin(users, eq(clanMembers.userId, users.id))
    .where(
      and(
        eq(users.discordId, discordUserId),
        isNull(clanMembers.leftAt),
        eq(clanMembers.status, 'active'),
      ),
    );
  ownedRows.push(...viaOauth);

  const viaLegacy = await db
    .select({ rank: clanMembers.rank, isGuest: clanMembers.isGuest })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.discordId, discordUserId),
        isNull(clanMembers.leftAt),
        eq(clanMembers.status, 'active'),
      ),
    );
  ownedRows.push(...viaLegacy);

  // The current member always counts — important when this is a brand-new join
  // with no Discord linkage yet (we'd resolved via name match above).
  if (member.status === 'active') {
    ownedRows.push({ rank: member.rank, isGuest: member.isGuest });
  }

  if (ownedRows.length === 0) {
    return { ok: false, reason: 'no active clan_members for this Discord user', added: [], removed: [], discordUserId };
  }

  const allGuests = ownedRows.every((r) => r.isGuest === 1);
  const highestRank = pickHighestRank(ownedRows.filter((r) => r.isGuest === 0).map((r) => r.rank));

  // Target role set
  const target = new Set<string>();
  if (allGuests) {
    cfg.guestRoleIds.forEach((id) => target.add(id));
  } else {
    cfg.defaultRoleIds.forEach((id) => target.add(id));
    const rankKey = normalizeRankKey(highestRank);
    if (rankKey) {
      const roleId = cfg.rankRoleMap[rankKey];
      if (roleId) target.add(roleId);
    }
  }

  // The set of roles we're allowed to touch on this user. Any role not in this set
  // is left alone — it might be a moderator role assigned manually, a server-booster
  // role, the @everyone role, etc.
  const managed = new Set<string>([
    ...cfg.defaultRoleIds,
    ...cfg.guestRoleIds,
    ...Object.values(cfg.rankRoleMap),
  ]);

  const currentMember = await getGuildMember(cfg, discordUserId);
  if (!currentMember) {
    return { ok: false, reason: 'user not in guild', added: [], removed: [], discordUserId };
  }
  const current = new Set(currentMember.roles);

  const added: string[] = [];
  const removed: string[] = [];
  for (const roleId of target) {
    if (!current.has(roleId)) added.push(roleId);
  }
  for (const roleId of current) {
    if (managed.has(roleId) && !target.has(roleId)) removed.push(roleId);
  }

  // Apply. PUT/DELETE are independent buckets per (guild, role) so back-to-back
  // calls don't generally trip 429s, but discordFetch retries when they do.
  for (const roleId of added) {
    const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members/${discordUserId}/roles/${roleId}`, { method: 'PUT' });
    if (!res.ok) log.warn('discord-roles.add-fail', { roleId, status: res.status, discordUserId });
  }
  for (const roleId of removed) {
    const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members/${discordUserId}/roles/${roleId}`, { method: 'DELETE' });
    if (!res.ok) log.warn('discord-roles.remove-fail', { roleId, status: res.status, discordUserId });
  }

  if ((added.length > 0 || removed.length > 0) && !member.discordId && discordUserId) {
    // Cache the resolved Discord id on the clan_member so we don't rerun the
    // expensive name-match every time. Doesn't conflict with the OAuth path — if
    // the user later logs in via Discord, users.discord_id becomes the source of
    // truth and we'd still pick it first.
    await db
      .update(clanMembers)
      .set({ discordId: discordUserId })
      .where(eq(clanMembers.id, member.id));
  }

  return { ok: true, discordUserId, added, removed };
}

/**
 * Fire-and-forget wrapper for use from clan-sync change handlers. Errors are
 * swallowed into the log so a Discord-side outage can't fail a roster sync.
 */
export function syncRolesForClanMemberFireAndForget(memberId: number): void {
  syncRolesForClanMember(memberId).catch((err) => {
    log.warn('discord-roles.sync-throw', { memberId }, err);
  });
}
