import { inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accountPluginSeen } from '@/db/schema';
import { log } from '@/lib/logger';

// Which Anvil plugin build last played each character (account_plugin_seen).
//
// The plugin sends `X-Anvil-Plugin-Version` on every authed call. Until this, only coffer events kept
// it, so the site could not tell a player "your plugin is too old for this tile". Recorded off the
// plugin-member resolution every plugin route goes through (lib/auth resolvePluginMember), throttled
// in-process like lib/integrityNetwork noteNetwork: one upsert per (account, version) every few
// hours, never one per 30-second poll.

const NOTE_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_SEEN = 20_000;
const seen = new Map<string, number>();

/** The header's version, trimmed and bounded; null when absent or not version-shaped. */
export function pluginVersionHeader(request: Request): string | null {
  const raw = request.headers.get('X-Anvil-Plugin-Version')?.trim();
  if (!raw || raw.length > 40 || !/^\d+(\.\d+){0,3}([-+][\w.-]+)?$/.test(raw)) return null;
  return raw;
}

/** Fire-and-forget: remember this character's plugin build. Never throws, never blocks auth. */
export function notePluginVersion(request: Request, accountId: number | null): void {
  try {
    if (!accountId) return;
    const version = pluginVersionHeader(request);
    if (!version) return;
    const key = `${accountId}:${version}`;
    const now = Date.now();
    if (now - (seen.get(key) ?? 0) < NOTE_EVERY_MS) return;
    if (seen.size > MAX_SEEN) seen.clear();
    seen.set(key, now);
    const seenAt = new Date(now).toISOString();
    void db
      .insert(accountPluginSeen)
      .values({ accountId, pluginVersion: version, seenAt })
      .onConflictDoUpdate({ target: accountPluginSeen.accountId, set: { pluginVersion: version, seenAt } })
      .catch((err) => log.warn('plugin-seen.failed', {}, err));
  } catch (err) {
    log.warn('plugin-seen.failed', {}, err);
  }
}

export interface PluginSeen {
  version: string;
  seenAt: string;
}

/** The last plugin build seen per account. Accounts never seen are absent. */
export async function pluginSeenFor(accountIds: number[]): Promise<Map<number, PluginSeen>> {
  const out = new Map<number, PluginSeen>();
  if (accountIds.length === 0) return out;
  // clan-scope: global -- a fact about the character's own client, read only for the viewer's own accounts.
  const rows = await db.select().from(accountPluginSeen).where(inArray(accountPluginSeen.accountId, accountIds));
  for (const r of rows) out.set(r.accountId, { version: r.pluginVersion, seenAt: r.seenAt });
  return out;
}
