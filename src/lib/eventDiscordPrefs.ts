// Reads and writes the three layers lib/discordPostPolicy decides from: the clan's defaults (a
// setting), the event's own choices (events.discord_prefs) and each co-host's (event_cohosts.discord_prefs).
//
// Reads on the send path are memoised for a few seconds — a busy board posts a submission every
// few seconds and each post asks the same question. A save clears its own entry, so a change made
// on this process applies at once; another process sees it within the TTL.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventCohosts, events } from '@/db/schema';
import {
  parseClanEventRoleDefaults,
  resolveEventRoles,
  type ClanEventRoleDefaults,
  type EventRoleSettings,
  parseClanPostDefaults,
  parseEventDiscordPrefs,
  parsePartnerDiscordPrefs,
  type ClanPostDefaults,
  type EventDiscordPrefs,
  type PartnerDiscordPrefs,
} from '@/lib/discordPostPolicy';
import { getSetting, setSetting } from '@/lib/settings';

export const CLAN_POST_DEFAULTS_KEY = 'discord_event_posts';
export const CLAN_ROLE_DEFAULTS_KEY = 'discord_event_roles';

const TTL_MS = 10_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function memo<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load().catch(() => {
    cache.delete(key);
    return fallback;
  });
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) for (const [k, v] of cache) if (Date.now() - v.at >= TTL_MS) cache.delete(k);
  return value;
}

export async function loadClanPostDefaults(clanId: number): Promise<ClanPostDefaults> {
  return parseClanPostDefaults(await getSetting(clanId, CLAN_POST_DEFAULTS_KEY).catch(() => null));
}

export async function saveClanPostDefaults(clanId: number, defaults: ClanPostDefaults): Promise<ClanPostDefaults> {
  const clean = parseClanPostDefaults(defaults);
  await setSetting(clanId, CLAN_POST_DEFAULTS_KEY, JSON.stringify(clean));
  return clean;
}

/** Uncached — for the admin page, which must show what was just saved. */
export async function readEventDiscordPrefs(eventId: number): Promise<EventDiscordPrefs> {
  // clan-scope: global -- callers have already resolved that the viewer may see this event.
  const [row] = await db.select({ p: events.discordPrefs }).from(events).where(eq(events.id, eventId)).limit(1);
  return parseEventDiscordPrefs(row?.p ?? {});
}

/** Cached — for the send path. */
export function loadEventDiscordPrefs(eventId: number): Promise<EventDiscordPrefs> {
  return memo<EventDiscordPrefs>(`e:${eventId}`, () => readEventDiscordPrefs(eventId), {});
}

export async function saveEventDiscordPrefs(eventId: number, prefs: unknown): Promise<EventDiscordPrefs> {
  const clean = parseEventDiscordPrefs(prefs);
  await db.update(events).set({ discordPrefs: clean as Record<string, unknown> }).where(eq(events.id, eventId));
  cache.delete(`e:${eventId}`);
  return clean;
}

export async function readPartnerDiscordPrefs(eventId: number, clanId: number): Promise<PartnerDiscordPrefs> {
  const [row] = await db
    .select({ p: eventCohosts.discordPrefs })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.clanId, clanId)))
    .limit(1);
  return parsePartnerDiscordPrefs(row?.p ?? {});
}

export function loadPartnerDiscordPrefs(eventId: number, clanId: number): Promise<PartnerDiscordPrefs> {
  return memo<PartnerDiscordPrefs>(`p:${eventId}:${clanId}`, () => readPartnerDiscordPrefs(eventId, clanId), {});
}

export async function savePartnerDiscordPrefs(eventId: number, clanId: number, prefs: unknown): Promise<PartnerDiscordPrefs> {
  const clean = parsePartnerDiscordPrefs(prefs);
  await db
    .update(eventCohosts)
    .set({ discordPrefs: clean as Record<string, unknown> })
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.clanId, clanId)));
  cache.delete(`p:${eventId}:${clanId}`);
  return clean;
}

export async function loadClanEventRoleDefaults(clanId: number): Promise<ClanEventRoleDefaults> {
  return parseClanEventRoleDefaults(await getSetting(clanId, CLAN_ROLE_DEFAULTS_KEY).catch(() => null));
}

export async function saveClanEventRoleDefaults(clanId: number, defaults: unknown): Promise<ClanEventRoleDefaults> {
  const clean = parseClanEventRoleDefaults(defaults);
  await setSetting(clanId, CLAN_ROLE_DEFAULTS_KEY, JSON.stringify(clean));
  return clean;
}

/** One event's roles and team-channel behaviour, resolved against its host clan. */
export async function loadEventRoleSettings(eventId: number, hostClanId: number): Promise<EventRoleSettings> {
  const [clan, prefs, teamSync] = await Promise.all([
    loadClanEventRoleDefaults(hostClanId),
    readEventDiscordPrefs(eventId),
    getSetting(hostClanId, 'discord_team_sync_enabled').catch(() => null),
  ]);
  return resolveEventRoles(clan, prefs, teamSync === 'true');
}
