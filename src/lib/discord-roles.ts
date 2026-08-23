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
import { getSetting } from '@/lib/settings';
import { accounts, clanAuditLog, clanMemberships, clanRoster, detectedAccounts, eventSignups, users, teams, settings } from '@/db/schema';
import { findRosterSeat, personOfOrCreate, UNCLAIMED_ACCOUNT, updateAccountOfSeat } from '@/lib/roster';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
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

/**
 * Discord-aware highest-rank picker. Uses Discord role `position` (higher = above
 * in the role list) when a rank has a matching Discord role — so admins control
 * precedence by just ordering their Discord roles, including custom ones like
 * "marshal" that aren't in the OSRS standard list. Falls back to the static
 * RANK_PRECEDENCE for ranks with no matching Discord role.
 */
function pickHighestRankUsingGuild(
  ranks: (string | null | undefined)[],
  guildRoles: DiscordRole[],
): string | null {
  if (guildRoles.length === 0) return pickHighestRank(ranks);

  const roleByRank = new Map<string, DiscordRole>();
  for (const r of guildRoles) {
    const key = normalizeRankKey(r.name);
    if (key) roleByRank.set(key, r);
  }

  let best: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const rank of ranks) {
    if (!rank) continue;
    const key = normalizeRankKey(rank);
    if (!key) continue;

    let score: number;
    const matched = roleByRank.get(key);
    if (matched) {
      // Discord position: higher number = higher in the role list (closer to top).
      score = matched.position;
    } else {
      const stdIdx = RANK_PRECEDENCE.indexOf(key);
      // Negative because lower index in RANK_PRECEDENCE = higher rank. Shift below
      // Discord positions so any guild-mapped rank outranks an unmapped fallback.
      score = stdIdx === -1 ? Number.NEGATIVE_INFINITY : -1000 - stdIdx;
    }

    if (score > bestScore) {
      bestScore = score;
      best = rank;
    }
  }
  return best;
}

// =============================================================================
// Config (env + settings)
// =============================================================================

interface RoleSyncConfig {
  botToken: string;
  guildId: string;
  // Explicit role-ID config. Survives Discord role renames, so this is preferred
  // when an admin wants stability. All three may be empty — name-based fallback
  // below kicks in.
  rankRoleMap: Record<string, string>; // canonical rank key → Discord role ID
  defaultRoleIds: string[];
  guestRoleIds: string[];
  // Name-based config. Resolved against the live guild roles at sync time. The
  // common path: the admin sets `discord_default_role_names = ["Member", "Imp"]`
  // and `discord_guest_role_names = ["Clan Friend"]`, and leaves rank-role mapping
  // entirely to the auto-match below.
  defaultRoleNames: string[];
  guestRoleNames: string[];
  // Auto-match in-game rank → Discord role whose name matches case-insensitively
  // (with _ ↔ space). Defaults to true. If your guild's role names match the OSRS
  // rank names ("General", "Captain", "Deputy Owner"), zero rank-role config is
  // needed — this just works.
  autoMatchRankByName: boolean;
  // When true, on each sync we set the member's Discord server nickname to their
  // linked RSN(s) — but ONLY if they don't already have a nickname (Discord can't
  // tell us who set an existing one, so "blank" is the safe proxy for "not set by
  // an admin"). Gated by the `discord_nickname_sync_enabled` setting.
  setNicknameOnLink: boolean;
  // When true, nickname sync OVERWRITES an existing nickname too (not just blank ones) — keeps
  // everyone's nick pinned to their RSN(s) so name-matching + readability stay correct even after
  // an in-game rename. Gated by `discord_nickname_overwrite`. Off by default (opt-in).
  overwriteNickname: boolean;
}

/**
 * Where the effective bot token came from — surfaced in the admin UI so a clan can see whether it's
 * on the shared Anvil bot (managed convenience) or its own:
 *   byo      — a token an admin entered in Advanced settings (overrides everything)
 *   own-env  — DISCORD_BOT_TOKEN in the environment (self-host, or a BYO managed container)
 *   shared   — ANVIL_SHARED_BOT_TOKEN, injected by the provisioner for managed clans
 *   none     — no token anywhere; all bot features stay off
 */
export type BotTokenSource = 'byo' | 'own-env' | 'shared' | 'none';

/**
 * Resolve the effective bot token by precedence: an admin-entered BYO token wins, then this
 * instance's own env token, then the shared managed bot. The BYO token lives in the settings table
 * (deliberately kept OUT of the readable settings API — see /api/admin/discord/bot) so a clan can
 * point at its own bot without a redeploy, mirroring how guild ID is settings-first.
 */
/**
 * The SHARED application's token, with no clan involved.
 *
 * The platform-level callers — the app public key, the slash-command sync — describe the one Anvil
 * Discord app rather than any clan's BYO bot, and one of them runs at boot where no clan exists.
 * Separated from resolveBotToken so that "no clan here" is a statement rather than a null argument.
 */
export function sharedBotToken(): string | null {
  return process.env.DISCORD_BOT_TOKEN?.trim() || process.env.ANVIL_SHARED_BOT_TOKEN?.trim() || null;
}

async function resolveBotToken(clanId: number): Promise<{ token: string; source: Exclude<BotTokenSource, 'none'> } | null> {
  const byo = (await getSetting(clanId, 'discord_bot_token'))?.trim();
  if (byo) return { token: byo, source: 'byo' };
  const own = process.env.DISCORD_BOT_TOKEN;
  if (own) return { token: own, source: 'own-env' };
  const shared = process.env.ANVIL_SHARED_BOT_TOKEN;
  if (shared) return { token: shared, source: 'shared' };
  return null;
}

/** The source of the effective bot token, for the admin UI. 'none' when nothing is configured. */
export async function getBotTokenSource(clanId: number): Promise<BotTokenSource> {
  return (await resolveBotToken(clanId))?.source ?? 'none';
}

/**
 * The effective bot token WITHOUT requiring a guild ID — for the admin bot-status surface, which
 * must still identify the bot (and build an invite link) before a server has been picked.
 * Feature code should use getBotCredentials(clanId) instead: no guild means nothing to act on.
 */
export async function getBotTokenOnly(clanId: number): Promise<{ token: string; source: Exclude<BotTokenSource, 'none'> } | null> {
  return resolveBotToken(clanId);
}

/** True when a shared managed bot is available to fall back to (provisioner-injected env). */
export function isSharedBotAvailable(): boolean {
  return !!process.env.ANVIL_SHARED_BOT_TOKEN;
}

/**
 * Resolve the bot credentials shared by every bot-driven Discord feature (role sync, nickname sync,
 * team channels, webhook creation, broadcast). Independent of any feature's enabled flag — callers
 * gate on their own setting, then call this for the token + guild. Returns null when no token
 * resolves (see resolveBotToken) or the guild ID is missing, which callers treat as "skip silently".
 *
 * Guild ID is settings-driven (not env) so admins can change/test without redeploying; an env
 * override is allowed for local dev.
 */
export async function getBotCredentials(clanId: number): Promise<{ botToken: string; guildId: string } | null> {
  const resolved = await resolveBotToken(clanId);
  if (!resolved) return null;
  const guildId = (await getSetting(clanId, 'discord_guild_id')) || process.env.DISCORD_GUILD_ID || '';
  if (!guildId) return null;
  return { botToken: resolved.token, guildId };
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
export async function loadRoleSyncConfig(clanId: number): Promise<RoleSyncConfig | null> {
  const enabled = (await getSetting(clanId, 'discord_role_sync_enabled')) === 'true';
  if (!enabled) return null;

  const creds = await getBotCredentials(clanId);
  if (!creds) return null;

  // Auto-match defaults to true — turn it off by setting the value to literal 'false'.
  const autoMatchRaw = await getSetting(clanId, 'discord_auto_match_rank_by_name');
  const autoMatchRankByName = autoMatchRaw !== 'false';

  return {
    botToken: creds.botToken,
    guildId: creds.guildId,
    rankRoleMap: parseJsonRecord(await getSetting(clanId, 'discord_rank_role_map')),
    defaultRoleIds: parseJsonArray(await getSetting(clanId, 'discord_default_role_ids')),
    guestRoleIds: parseJsonArray(await getSetting(clanId, 'discord_guest_role_ids')),
    defaultRoleNames: parseJsonArray(await getSetting(clanId, 'discord_default_role_names')),
    guestRoleNames: parseJsonArray(await getSetting(clanId, 'discord_guest_role_names')),
    autoMatchRankByName,
    setNicknameOnLink: (await getSetting(clanId, 'discord_nickname_sync_enabled')) === 'true',
    overwriteNickname: (await getSetting(clanId, 'discord_nickname_overwrite')) === 'true',
  };
}

/**
 * Resolve a list of role names to role IDs against the live guild role list.
 * Matching is case-insensitive with whitespace + underscore normalization, so
 * an admin entering "Deputy Owner" matches a Discord role literally named
 * "deputy_owner" or "DEPUTY OWNER". Missing names are silently dropped — a
 * warning is logged so the admin can spot typos.
 */
function resolveRoleNamesToIds(names: string[], guildRoles: DiscordRole[]): string[] {
  const byNormalizedName = new Map<string, string>();
  for (const r of guildRoles) {
    const key = normalizeRankKey(r.name);
    if (key) byNormalizedName.set(key, r.id);
  }
  const ids: string[] = [];
  for (const raw of names) {
    const key = normalizeRankKey(raw);
    if (!key) continue;
    const id = byNormalizedName.get(key);
    if (id) ids.push(id);
    else log.warn('discord-roles.name-not-found', { name: raw, normalized: key });
  }
  return ids;
}

/** Find a guild role whose name matches the given canonical rank key. */
function findRoleIdForRankByName(rankKey: string, guildRoles: DiscordRole[]): string | null {
  for (const r of guildRoles) {
    if (normalizeRankKey(r.name) === rankKey) return r.id;
  }
  return null;
}

// =============================================================================
// Discord REST helpers (with rate-limit retry)
// =============================================================================

const MAX_RETRY_MS = 5000;
// How many times we'll wait-out a 429 before giving up. The bulk role sweep fires a
// members/search per unresolved member and Discord rate-limits that endpoint hard, so a
// single retry isn't enough — a call that keeps getting 429'd would silently fail to resolve
// the member. We retry a few times, honouring retry-after each round.
const MAX_429_RETRIES = 5;

/**
 * Authenticated Discord REST call that waits out 429s (up to MAX_429_RETRIES rounds, honouring
 * retry-after each time). Shared by every bot-driven feature (role sync here, team channels in
 * lib/discord-teams.ts) so the rate-limit handling lives in one place. `path` is appended to
 * the v10 API base.
 */
export async function discordRest(
  botToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${DISCORD_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let res = await fetch(url, { ...init, headers });
  for (let attempt = 1; res.status === 429 && attempt <= MAX_429_RETRIES; attempt++) {
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
    log.warn('discord-roles.rate-limited', { path, retryMs, attempt });
    await new Promise((r) => setTimeout(r, retryMs));
    res = await fetch(url, { ...init, headers });
  }
  return res;
}

function discordFetch(cfg: RoleSyncConfig, path: string, init: RequestInit = {}): Promise<Response> {
  return discordRest(cfg.botToken, path, init);
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

export async function fetchGuildRoles(clanId: number): Promise<DiscordRole[]> {
  // Gated on the BOT being connected (token + guild), NOT on role-sync being enabled — the role
  // pickers (team channels, ping role, assigned roles) must list roles whenever the bot is up,
  // independent of the role-sync toggle.
  const creds = await getBotCredentials(clanId);
  if (!creds) return [];
  const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/roles`);
  if (!res.ok) {
    log.warn('discord-roles.list-roles-fail', { status: res.status });
    return [];
  }
  return (await res.json()) as DiscordRole[];
}

/**
 * Create a new role in the guild (the bot needs Manage Roles). Returns the created role, or null
 * when the bot isn't connected or Discord rejects it. New roles land at the bottom of the list.
 */
export async function createGuildRole(
  clanId: number,
  name: string,
  opts: { color?: number; mentionable?: boolean } = {},
): Promise<DiscordRole | null> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return null;
  const body: Record<string, unknown> = { name };
  if (typeof opts.color === 'number') body.color = opts.color;
  if (typeof opts.mentionable === 'boolean') body.mentionable = opts.mentionable;
  const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/roles`, {
    method: 'POST',
    headers: { 'X-Audit-Log-Reason': 'Created from Anvil admin' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    log.warn('discord-roles.create-role-fail', { status: res.status });
    return null;
  }
  return (await res.json()) as DiscordRole;
}

interface DiscordGuildMember {
  user?: { id: string; username: string; global_name?: string };
  nick?: string | null;
  roles: string[];
}

// Returns the member, or a discriminated miss: `notFound` (a real 404 — they're not in the
// server) vs a transient API failure (rate-limit exhausted, 5xx). The sweep must not label a
// throttled lookup "not in guild" — that's the bug that made linked members look absent.
async function getGuildMember(
  cfg: RoleSyncConfig,
  discordUserId: string,
): Promise<{ member: DiscordGuildMember | null; notFound: boolean }> {
  const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members/${discordUserId}`);
  if (res.status === 404) return { member: null, notFound: true };
  if (!res.ok) {
    log.warn('discord-roles.get-member-fail', { status: res.status, discordUserId });
    return { member: null, notFound: false };
  }
  return { member: (await res.json()) as DiscordGuildMember, notFound: false };
}

// In-memory snapshot of the whole guild for a bulk sweep: id → member, and every
// nick/username/global_name alias (normalized) → id, plus the role list. Lets a large roster
// sync with ONE member fetch instead of one API call per member.
export interface SweepContext {
  byId: Map<string, DiscordGuildMember>;
  byAlias: Map<string, string>;
  guildRoles: DiscordRole[];
}

// Paginate the full guild member list. Requires the privileged "Server Members Intent" on the bot;
// without it Discord returns 403 → we return null and the caller falls back to per-member lookups.
async function fetchAllGuildMembers(cfg: RoleSyncConfig): Promise<DiscordGuildMember[] | null> {
  const all: DiscordGuildMember[] = [];
  let after = '0';
  for (let page = 0; page < 30; page++) {
    const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members?limit=1000&after=${after}`);
    if (res.status === 403) {
      log.warn('discord-roles.list-members-forbidden', { note: 'enable Server Members Intent for bulk sync' });
      return null;
    }
    if (!res.ok) {
      log.warn('discord-roles.list-members-fail', { status: res.status });
      return all.length > 0 ? all : null;
    }
    const batch = (await res.json()) as DiscordGuildMember[];
    all.push(...batch);
    const last = batch[batch.length - 1]?.user?.id;
    if (batch.length < 1000 || !last) break;
    after = last;
  }
  return all;
}

/**
 * Fetch the whole guild once and build the sweep index. Returns null when the bot lacks the
 * Server Members Intent (the caller then syncs per-member, live). Fetching everyone up front means
 * a 600+ roster does ~1 member fetch + in-memory matching instead of hundreds of rate-limited calls.
 */
export async function buildSweepContext(clanId: number): Promise<SweepContext | null> {
  const cfg = await loadRoleSyncConfig(clanId);
  if (!cfg) return null;
  const members = await fetchAllGuildMembers(cfg);
  if (!members) return null;

  const byId = new Map<string, DiscordGuildMember>();
  const byAlias = new Map<string, string>();
  for (const m of members) {
    const id = m.user?.id;
    if (!id) continue;
    byId.set(id, m);
    const aliases = [
      ...splitDisplayAliases(m.nick),
      ...splitDisplayAliases(m.user?.global_name),
      ...splitDisplayAliases(m.user?.username),
    ];
    for (const a of aliases) {
      const key = normalizeRsn(a);
      if (key && !byAlias.has(key)) byAlias.set(key, id);
    }
  }
  return { byId, byAlias, guildRoles: await fetchGuildRoles(clanId) };
}

// Search the guild's members by name (nick / username), for the admin "link this member to a
// Discord user" picker. Returns up to 10 candidates with a display label.
export async function searchGuildMembersByName(
  clanId: number,
  query: string,
): Promise<{ id: string; label: string }[]> {
  const cfg = await loadRoleSyncConfig(clanId);
  if (!cfg || !query.trim()) return [];
  const res = await discordFetch(
    cfg,
    `/guilds/${cfg.guildId}/members/search?query=${encodeURIComponent(query.trim())}&limit=10`,
  );
  if (!res.ok) return [];
  const members = (await res.json()) as DiscordGuildMember[];
  return members
    .filter((m) => m.user)
    .map((m) => {
      const nick = m.nick?.trim();
      const uname = m.user!.global_name || m.user!.username;
      return { id: m.user!.id, label: nick && nick !== uname ? `${nick} (@${uname})` : `@${uname}` };
    });
}

// True when a Discord user id is actually a member of the guild. Used to validate a manual link.
export async function isGuildMember(clanId: number, discordUserId: string): Promise<boolean> {
  const cfg = await loadRoleSyncConfig(clanId);
  if (!cfg) return false;
  const gm = await getGuildMember(cfg, discordUserId);
  return !!gm.member;
}

// Discord server nicknames cap at 32 characters. Join the user's RSNs with " / " (the same alias
// convention splitDisplayAliases reads back), primary first. When the full list overflows the cap,
// greedily keep the primary plus as many of the following names as fit — e.g.
// "Drenvox mdps / Denoverse / GIM Drenvox" trims trailing names rather than dropping to primary-only.
const DISCORD_NICK_MAX = 32;
function buildLinkedNickname(rsns: string[]): string | null {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of rsns) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }
  if (cleaned.length === 0) return null;
  // Primary always in (hard-truncated if it alone exceeds the cap), then pack the rest while they fit.
  let nick = cleaned[0].slice(0, DISCORD_NICK_MAX);
  for (let i = 1; i < cleaned.length; i++) {
    const next = `${nick} / ${cleaned[i]}`;
    if (next.length > DISCORD_NICK_MAX) break;
    nick = next;
  }
  return nick;
}

// PATCH the member's server nickname. Returns false (and logs) on failure — notably
// 403 when the target is the guild owner or outranks the bot, which we just skip.
async function setGuildMemberNick(
  cfg: RoleSyncConfig,
  discordUserId: string,
  nick: string,
): Promise<boolean> {
  const res = await discordFetch(cfg, `/guilds/${cfg.guildId}/members/${discordUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ nick }),
  });
  if (!res.ok) {
    log.warn('discord-roles.set-nick-fail', { status: res.status, discordUserId });
    return false;
  }
  return true;
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
export async function findDiscordIdByRsn(clanId: number, rsn: string): Promise<string | null> {
  const cfg = await loadRoleSyncConfig(clanId);
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
  /** The person who owns the account in this seat, or null while nobody has claimed it. */
  playerId: number | null;
  discordId: string | null;
}

/** Cache a resolved Discord id onto the clan member so future syncs skip the lookup entirely. */
async function cacheDiscordId(memberId: number, discordId: string): Promise<void> {
  await updateAccountOfSeat(memberId, { discordId }).catch(() => {});
  // Persist the Discord↔account link at the USER level: if a site user owns this Discord login and
  // the member isn't linked to anyone yet, bind it. That's what makes "this Discord = these X
  // accounts" durable — every alt then resolves via the OAuth path, gets roles in any event, and
  // contributes to the primary-first nickname. Only fills a NULL userId, so it never hijacks.
  const user = await db.query.users.findFirst({ where: eq(users.discordId, discordId), columns: { id: true } });
  if (user) {
    await db
      .update(accounts)
      .set({ playerId: await personOfOrCreate(user.id) })
      // Only fills an unclaimed account, so it never hijacks — and the guard has to sit on the
      // ACCOUNT, since ownership is not something a single clan's seat can speak for.
      .where(
        and(
          eq(
            accounts.id,
            db.select({ id: clanMemberships.accountId }).from(clanMemberships).where(eq(clanMemberships.id, memberId)),
          ),
          UNCLAIMED_ACCOUNT,
        ),
      )
      .catch(() => {});
  }
}

/** users.discordId for a user id, or null. */
async function discordIdForUser(userId: number): Promise<string | null> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return u?.discordId ?? null;
}

/**
 * users.discordId for a PERSON, or null.
 *
 * A seat names the person who owns its account, not the login they sign in with — separate id
 * sequences, so looking the person's id up in `users.id` would find an unrelated login.
 */
async function discordIdForPerson(playerId: number): Promise<string | null> {
  const u = await db.query.users.findFirst({ where: eq(users.playerId, playerId) });
  return u?.discordId ?? null;
}

/**
 * Resolve a Discord user ID for a clan member. Priority (strongest → weakest):
 *   1) the account's player → users.discordId          (canonical OAuth-linked)
 *   2) accounts.discordId                              (cached from a prior resolve)
 *   3) an event sign-up ties this account to a user    (they signed up playing it)
 *   4) a plugin self-report / detected account maps    (they played it through the plugin)
 *      this RSN to a user
 *   5) guild member search by RSN prefix + alias split (best-effort name match)
 *
 * Sources 3–5 write the result back onto accounts.discordId so it's resolved once, not
 * every sweep — this also slashes the rate-limited guild searches. Returns null only when a
 * member genuinely has no Discord link anywhere (the correct "skip until they link" case).
 */
export async function resolveDiscordIdForMember(
  clanId: number,
  member: MinimalClanMember,
): Promise<string | null> {
  const cfg = await loadRoleSyncConfig(clanId);
  if (!cfg) return null;
  // Try every candidate against the guild and return the first that's ACTUALLY a member — the same
  // rule the role sweep uses, so team/bingo assignment can't hand a role to a stale id. Cached on hit.
  const candidates = await gatherDiscordIdCandidates(member);
  for (const c of candidates) {
    const gm = await getGuildMember(cfg, c);
    if (gm.member) {
      if (c !== member.discordId) await cacheDiscordId(member.id, c);
      return c;
    }
  }
  const searched = await findDiscordIdByRsn(clanId, member.rsn);
  if (searched) {
    const gm = await getGuildMember(cfg, searched);
    if (gm.member) {
      await cacheDiscordId(member.id, searched);
      return searched;
    }
  }
  return null;
}

/**
 * Every plausible Discord id for a member, from the DB only (no live API), strongest first and
 * deduped:
 *   1) the clan member's linked user (OAuth login)     — their current, real id
 *   2) a user who signed up playing this account
 *   3) a user whose plugin self-report matched this RSN
 *   4) the cached clan_members.discordId               — can be a STALE legacy value, so it's LAST
 * The role sweep tries each against the guild and uses the first that's actually a member, so a
 * dead cached id can no longer shadow a live link, and no nickname/RSN needs to change.
 */
async function gatherDiscordIdCandidates(member: MinimalClanMember): Promise<string[]> {
  const out: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !out.includes(id)) out.push(id);
  };

  if (member.playerId != null) add(await discordIdForPerson(member.playerId));

  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.clanMemberId, member.id), isNotNull(eventSignups.userId)),
  });
  if (signup?.userId != null) add(await discordIdForUser(signup.userId));

  const norm = normalizeRsn(member.rsn);
  if (norm) {
    const detected = await db.query.detectedAccounts.findFirst({
      where: eq(detectedAccounts.rsnNormalized, norm),
    });
    if (detected?.userId != null) add(await discordIdForUser(detected.userId));
  }

  add(member.discordId); // cached last — may be a stale legacy id
  return out;
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
  // The nickname we set on this sync (RSN(s)), or undefined if we left it alone.
  nickSet?: string;
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
export async function syncRolesForClanMember(
  memberId: number,
  ctx?: SweepContext,
  skipNickname = false,
): Promise<SyncReport> {
  // The member knows its clan; deriving it here means a caller can't pass one that disagrees.
  const member = await findRosterSeat(eq(clanRoster.id, memberId));
  if (!member) return { ok: false, reason: 'member not found', added: [], removed: [] };
  const cfg = await loadRoleSyncConfig(member.clanId);
  if (!cfg) return { ok: false, reason: 'sync disabled or unconfigured', added: [], removed: [] };
  if (member.leftAt) return { ok: false, reason: 'member has left', added: [], removed: [] };

  // Resolve the member to a Discord account that is ACTUALLY in the guild. Try every DB-known id
  // first (linked user, sign-up, self-report, cache); only if none are in the guild do we pay for
  // the rate-limited name search (which matches nick / username / global_name, so no rename is
  // needed). The first candidate that's a live guild member wins and is cached — so a stale legacy
  // id can't win, and "user not in guild" only fires when NONE of their ids are really present.
  const candidates = await gatherDiscordIdCandidates(member);
  let discordUserId: string | null = null;
  let currentMember: DiscordGuildMember | null = null;
  let sawTransient = false;
  if (ctx) {
    // Bulk path — everything's in memory, zero API calls: check each candidate id, then match the
    // RSN against the pre-built nick/username/global_name alias index.
    for (const cand of candidates) {
      const m = ctx.byId.get(cand);
      if (m) {
        discordUserId = cand;
        currentMember = m;
        break;
      }
    }
    if (!currentMember) {
      const norm = normalizeRsn(member.rsn);
      const id = norm ? ctx.byAlias.get(norm) : undefined;
      const m = id ? ctx.byId.get(id) : undefined;
      if (id && m) {
        discordUserId = id;
        currentMember = m;
      }
    }
  } else {
    // Live path (single-member sync): one API call per candidate until one's in the guild.
    for (const cand of candidates) {
      const gm = await getGuildMember(cfg, cand);
      if (gm.member) {
        discordUserId = cand;
        currentMember = gm.member;
        break;
      }
      if (!gm.notFound) sawTransient = true;
    }
    if (!currentMember) {
      const searched = await findDiscordIdByRsn(member.clanId, member.rsn);
      if (searched && !candidates.includes(searched)) {
        const gm = await getGuildMember(cfg, searched);
        if (gm.member) {
          discordUserId = searched;
          currentMember = gm.member;
        } else if (!gm.notFound) {
          sawTransient = true;
        }
      }
    }
  }
  if (!currentMember || !discordUserId) {
    const anyId = discordUserId ?? candidates[0];
    return {
      ok: false,
      reason: !anyId
        ? 'no Discord id linkable to this RSN'
        : sawTransient
          ? 'Discord API error (rate-limited?) — re-run'
          : 'user not in guild',
      added: [],
      removed: [],
      ...(anyId ? { discordUserId: anyId } : {}),
    };
  }
  if (discordUserId !== member.discordId) await cacheDiscordId(member.id, discordUserId);

  // Collect every active clan_member that belongs to this Discord user. The OAuth
  // link (users.discord_id) is the strongest signal — we always pull those. The
  // legacy clan_members.discord_id covers ghost/auto-discovered linkages.
  const ownedRows: { rank: string | null; kind: string }[] = [];

  // NB: we gather by membership (not left), NOT by hiscores `status`. A clan role reflects
  // membership, not whether their XP is trackable — an 'unranked' member (RSN 404s on the
  // hiscores: mobile-only, freshly renamed, name-lag) is still a real member who should get
  // their role. Gating on status='active' here is exactly what silently skipped members whose
  // account isn't on the hiscores.
  const viaOauth = await db
    .select({ rank: clanRoster.rank, kind: clanRoster.kind })
    .from(clanRoster)
    .innerJoin(users, eq(clanRoster.playerId, users.id))
    .where(
      and(
        eq(clanRoster.clanId, member.clanId),
        eq(users.discordId, discordUserId),
        isNull(clanRoster.leftAt),
      ),
    );
  ownedRows.push(...viaOauth);

  const viaLegacy = await db
    .select({ rank: clanRoster.rank, kind: clanRoster.kind })
    .from(clanRoster)
    // This clan's seats: the roles being computed belong to one guild, and someone's rank in
    // another clan says nothing about what they should hold in this one.
    .where(
      and(
        eq(clanRoster.clanId, member.clanId),
        eq(clanRoster.discordId, discordUserId),
        isNull(clanRoster.leftAt),
      ),
    );
  ownedRows.push(...viaLegacy);

  // The current member always counts (already guarded against leftAt above).
  ownedRows.push({ rank: member.rank, kind: member.kind });

  if (ownedRows.length === 0) {
    return { ok: false, reason: 'no active clan_members for this Discord user', added: [], removed: [], discordUserId };
  }

  const allGuests = ownedRows.every((r) => r.kind === 'guest');

  // If any part of the config is name-based or auto-matching is on, we need the
  // live guild role list. Fetched at most once per sync. When all config is
  // strictly ID-based and auto-match is off, we skip the GET entirely.
  const needGuildRoles =
    cfg.autoMatchRankByName ||
    cfg.defaultRoleNames.length > 0 ||
    cfg.guestRoleNames.length > 0;
  let guildRoles: DiscordRole[] = ctx?.guildRoles ?? [];
  if (needGuildRoles && !ctx) {
    const rolesRes = await discordFetch(cfg, `/guilds/${cfg.guildId}/roles`);
    if (rolesRes.ok) {
      guildRoles = (await rolesRes.json()) as DiscordRole[];
    } else {
      log.warn('discord-roles.list-roles-fail', { status: rolesRes.status, ctx: 'syncRolesForClanMember' });
    }
  }

  // Pick highest rank using Discord role positions when available — that lets the
  // admin's Discord role ordering dictate clan rank precedence (including custom
  // ranks like "marshal" that the static RANK_PRECEDENCE doesn't know).
  const highestRank = pickHighestRankUsingGuild(
    ownedRows.filter((r) => r.kind === 'member').map((r) => r.rank),
    guildRoles,
  );

  // Merge ID-based config with name-resolved fallbacks. Explicit IDs win; names
  // only add roles that the ID list didn't already cover, so an admin can keep a
  // partial override without losing the auto-match path for the rest.
  const resolvedDefaults = new Set<string>([
    ...cfg.defaultRoleIds,
    ...resolveRoleNamesToIds(cfg.defaultRoleNames, guildRoles),
  ]);
  const resolvedGuests = new Set<string>([
    ...cfg.guestRoleIds,
    ...resolveRoleNamesToIds(cfg.guestRoleNames, guildRoles),
  ]);

  // All rank-role IDs we manage — explicit map + auto-matched per-rank IDs.
  const managedRankRoleIds = new Set<string>(Object.values(cfg.rankRoleMap));
  if (cfg.autoMatchRankByName) {
    // Pre-walk every rank we know about so a demotion to a previously-unseen rank
    // still removes the old rank role. Three sources unioned:
    //   1) RANK_PRECEDENCE — standard OSRS clan ranks (handles fresh clans)
    //   2) Currently held ranks across the active roster (handles custom ranks
    //      that anyone presently holds — e.g. "marshal", "admiral")
    //   3) Every rank that's ever been seen in a rank_changed audit log entry
    //      (handles the case where a user just got demoted away from a custom
    //      rank that nobody else currently holds — without (3), the old role
    //      would remain stuck on them)
    const knownRanks = new Set<string>(RANK_PRECEDENCE);
    const currentRanks = await db
      .selectDistinct({ rank: clanRoster.rank })
      .from(clanRoster)
      // The rank names this clan actually uses. Pulling every clan's would invent roles to manage
      // that nobody here holds.
      .where(eq(clanRoster.clanId, member.clanId));
    for (const row of currentRanks) {
      const k = normalizeRankKey(row.rank);
      if (k) knownRanks.add(k);
    }
    const auditRanks = await db
      .select({ oldValue: clanAuditLog.oldValue, newValue: clanAuditLog.newValue })
      .from(clanAuditLog)
      .where(eq(clanAuditLog.eventType, 'rank_changed'));
    for (const row of auditRanks) {
      for (const raw of [row.oldValue, row.newValue]) {
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { rank?: unknown };
          if (typeof parsed.rank === 'string') {
            const k = normalizeRankKey(parsed.rank);
            if (k) knownRanks.add(k);
          }
        } catch {
          // ignore malformed legacy rows
        }
      }
    }
    for (const rankKey of knownRanks) {
      const id = findRoleIdForRankByName(rankKey, guildRoles);
      if (id) managedRankRoleIds.add(id);
    }
  }

  // Target role set
  const target = new Set<string>();
  if (allGuests) {
    resolvedGuests.forEach((id) => target.add(id));
  } else {
    resolvedDefaults.forEach((id) => target.add(id));
    const rankKey = normalizeRankKey(highestRank);
    if (rankKey) {
      // 1) Explicit map override wins
      let roleId: string | null = cfg.rankRoleMap[rankKey] ?? null;
      // 2) Auto-match against guild role name
      if (!roleId && cfg.autoMatchRankByName) roleId = findRoleIdForRankByName(rankKey, guildRoles);
      if (roleId) {
        target.add(roleId);
        // For custom rank names that aren't in RANK_PRECEDENCE (e.g. "marshal"),
        // the role wasn't pre-walked above. Record it so a future downgrade can
        // still remove it.
        managedRankRoleIds.add(roleId);
      }
    }
  }

  // The set of roles we're allowed to touch on this user. Anything outside this
  // set (moderator role assigned manually, server-booster role, @everyone, …) is
  // left untouched.
  const managed = new Set<string>([
    ...resolvedDefaults,
    ...resolvedGuests,
    ...managedRankRoleIds,
  ]);

  // currentMember was already fetched (and verified in-guild) during resolution above.
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
    // Cache the resolved Discord id on the ACCOUNT so we don't rerun the expensive name-match every
    // time — and so a match made in one clan counts in every clan that account plays in. Doesn't
    // conflict with the OAuth path: if the user later logs in via Discord, users.discord_id becomes
    // the source of truth and we'd still pick it first.
    await updateAccountOfSeat(member.id, { discordId: discordUserId });
  }

  // Nickname sync — set the member's nick to their verified RSN(s). By default only fills a BLANK
  // nick (we can't tell who set an existing one, so blank is the safe "not admin-set" proxy). With
  // `discord_nickname_overwrite` on, it also replaces a non-blank nick, keeping everyone pinned to
  // their RSN(s) after renames. Only PATCHes when the value actually changes. Skips silently on any
  // Discord error (e.g. guild owner / outranked bot).
  let nickSet: string | undefined;
  const currentNick = currentMember.nick?.trim() || '';
  if (!skipNickname && cfg.setNicknameOnLink && (cfg.overwriteNickname || !currentNick)) {
    const accounts = await db
      .select({ rsn: clanRoster.rsn, isPrimary: clanRoster.isPrimary })
      .from(clanRoster)
      .innerJoin(users, eq(clanRoster.playerId, users.id))
      .where(
        and(
          eq(users.discordId, discordUserId),
          isNull(clanRoster.leftAt),
          isNotNull(clanRoster.verifiedAt),
        ),
      )
      .orderBy(desc(clanRoster.isPrimary));
    const rsns = accounts.map((a) => a.rsn);
    if (rsns.length === 0 && member.rsn) rsns.push(member.rsn);
    const desired = buildLinkedNickname(rsns);
    if (desired && desired !== currentNick && (await setGuildMemberNick(cfg, discordUserId, desired))) {
      nickSet = desired;
    }
  }

  return { ok: true, discordUserId, added, removed, nickSet };
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

/**
 * The Discord APPLICATION's Ed25519 verify key — what inbound interactions are signed with.
 *
 * Nobody should have to type this. It's on the application object, so the first time an interaction
 * arrives we ask Discord for it with the bot token we already hold and cache it in settings. An env
 * var still wins for a self-host that would rather pin it, and the cache is keyed on the app id so
 * swapping to a different bot token re-fetches instead of verifying against the old app's key.
 *
 * Returns null when no bot token is configured (nothing can be verified, so the endpoint 401s).
 */
const APP_PUBLIC_KEY_SETTING = 'discord_app_public_key';

export async function getAppPublicKey(): Promise<string | null> {
  const fromEnv = process.env.DISCORD_PUBLIC_KEY?.trim();
  if (fromEnv) return fromEnv;

  const cached = (await readSetting(APP_PUBLIC_KEY_SETTING))?.trim();
  if (cached) {
    const [appId, key] = cached.split(':');
    if (appId && key) {
      const token = sharedBotToken();
      // Only reuse the cache while it belongs to the app the current token authenticates as.
      if (token && appId === applicationIdFromToken(token)) return key;
    }
  }

  const resolved = sharedBotToken();
  if (!resolved) return null;
  const res = await discordRest(resolved, '/applications/@me');
  if (!res.ok) return null;
  const app = (await res.json().catch(() => null)) as { id?: string; verify_key?: string } | null;
  if (!app?.verify_key || !app.id) return null;
  await upsertAppPublicKey(`${app.id}:${app.verify_key}`);
  return app.verify_key;
}

/** A bot token's first dot-segment is the base64url application id — no API call needed. */
function applicationIdFromToken(token: string): string | null {
  const head = token.split('.')[0];
  if (!head) return null;
  try {
    return Buffer.from(head, 'base64url').toString('utf8') || null;
  } catch {
    return null;
  }
}

/**
 * PLATFORM-LEVEL CACHE, deliberately not the settings table.
 *
 * `settings` is keyed (clan_id, key) — every row belongs to a clan. These values do not: they
 * describe the SHARED Discord application that serves every clan, and instrumentation.ts reads one
 * at boot where there is no clan to name. Storing them under some clan's id would make one clan's
 * row silently authoritative for all of them.
 *
 * A process cache is honest about that. Both values derive from env (the bot token), so a cold
 * process re-derives rather than losing anything, and the real fix — a platform_settings table —
 * belongs with the rest of the platform surface rather than inside a merge.
 */
const platformCache = new Map<string, string | null>();

async function upsertAppPublicKey(value: string): Promise<void> {
  platformCache.set(APP_PUBLIC_KEY_SETTING, value);
}

async function readSetting(key: string): Promise<string | null> {
  return platformCache.get(key) ?? null;
}
