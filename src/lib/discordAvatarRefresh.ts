import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { avatarUrl } from '@/lib/discord-oauth';
import { sharedBotToken } from '@/lib/discord-roles';
import { log } from '@/lib/logger';

// Discord avatars are stored as the hash seen at a person's last login, and every page builds the
// CDN link from it. Change your avatar on Discord and that link 404s until you next log in here, so
// staff lists and profiles show a broken picture. Once a day a batch of stored avatars is checked
// (oldest check first); one that no longer loads is asked of Discord through the bot (GET /users/:id,
// any user the bot can see by id) and the new hash stored, or cleared when they went back to the
// default. Nothing is fetched for avatars that still load.

/** How many avatars one run checks, and how often each comes round again. */
const BATCH = 400;
const RECHECK_MS = 20 * 60 * 60 * 1000;
const GAP_MS = 60;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Does this CDN link still answer? A network error counts as yes: never clear on a blip. */
async function stillLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.status !== 404;
  } catch {
    return true;
  }
}

/** The avatar hash Discord has for this user now: a hash, null for the default, undefined when unknown. */
async function currentHash(discordId: string, token: string): Promise<string | null | undefined> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${encodeURIComponent(discordId)}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { avatar?: string | null };
    return data.avatar ?? null;
  } catch {
    return undefined;
  }
}

export async function refreshStaleAvatars(now = Date.now()): Promise<{ checked: number; updated: number }> {
  const token = sharedBotToken();
  const out = { checked: 0, updated: 0 };
  if (!token) return out;
  const due = new Date(now - RECHECK_MS).toISOString();
  // clan-scope: global -- a person's own Discord identity, not any clan's data.
  const rows = await db
    .select({ id: users.id, discordId: users.discordId, avatar: users.discordAvatar })
    .from(users)
    .where(and(isNotNull(users.discordId), isNotNull(users.discordAvatar), or(isNull(users.discordAvatarCheckedAt), lt(users.discordAvatarCheckedAt, due))))
    .orderBy(sql`${users.discordAvatarCheckedAt} asc nulls first`)
    .limit(BATCH);
  for (const r of rows) {
    if (!r.discordId) continue;
    out.checked++;
    const url = avatarUrl(r.discordId, r.avatar);
    const stamp = new Date().toISOString();
    if (url && !(await stillLoads(url))) {
      const hash = await currentHash(r.discordId, token);
      if (hash !== undefined && hash !== r.avatar) {
        await db.update(users).set({ discordAvatar: hash, discordAvatarCheckedAt: stamp }).where(eq(users.id, r.id));
        out.updated++;
        await delay(GAP_MS);
        continue;
      }
    }
    await db.update(users).set({ discordAvatarCheckedAt: stamp }).where(eq(users.id, r.id));
    await delay(GAP_MS);
  }
  log.info('discord-avatars.refreshed', out);
  return out;
}
