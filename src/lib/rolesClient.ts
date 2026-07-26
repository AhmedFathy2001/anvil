// Cached client loader for the guild's Discord roles (GET /api/admin/discord/roles), so several
// RoleSelects on one page share a single request instead of each fetching. Mirrors settingsClient.

export interface GuildRole {
  id: string;
  name: string;
  color?: number; // Discord role colour as an int; 0 / undefined = no colour
}

let cache: { roles: GuildRole[]; at: number } | null = null;
let inflight: Promise<GuildRole[]> | null = null;
const TTL_MS = 30000;

/**
 * Load the guild's assignable roles, deduped + briefly cached. Returns [] when the bot isn't
 * configured (no roles to list) or the request fails — callers fall back to manual ID entry.
 */
export async function loadGuildRoles(force = false): Promise<GuildRole[]> {
  if (!force) {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.roles;
    if (inflight) return inflight;
  }
  inflight = (async () => {
    try {
      const res = await fetch('/api/admin/discord/roles');
      const data = res.ok ? await res.json() : {};
      const roles: GuildRole[] = Array.isArray(data.roles)
        ? data.roles.filter((r: unknown): r is GuildRole => !!r && typeof (r as GuildRole).id === 'string')
        : [];
      cache = { roles, at: Date.now() };
      return roles;
    } catch {
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Drop the cache so the next load re-fetches. */
export function invalidateGuildRoles(): void {
  cache = null;
}

/**
 * Create a new Discord role in the connected guild and return it. Invalidates the roles cache so
 * the next `loadGuildRoles` includes it. Throws with a friendly message on failure.
 */
export async function createGuildRole(
  name: string,
  opts: { color?: number; mentionable?: boolean } = {},
): Promise<GuildRole> {
  const res = await fetch('/api/admin/discord/roles/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color: opts.color, mentionable: opts.mentionable }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not create the role');
  invalidateGuildRoles();
  return data.role as GuildRole;
}
