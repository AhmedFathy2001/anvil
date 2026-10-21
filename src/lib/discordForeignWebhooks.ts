/**
 * The bot's view of a clan's Discord webhooks, for clans moving off Dink: which webhooks in the
 * server are someone else's (listed, optionally removed), and where Anvil's own routing points.
 *
 * Needs Manage Webhooks at the server level (GET /guilds/{id}/webhooks). Pure rules live in
 * lib/discordQuickSetup so they can be tested without a database.
 */
import { or, like } from 'drizzle-orm';
import { db } from '@/db';
import { eventWebhooks, settings, userWebhooks } from '@/db/schema';
import { discordRest } from '@/lib/discord-roles';
import { getSettingMap } from '@/lib/settings';
import {
  QUICK_SETUP_KEYS,
  isForeignWebhook,
  webhookIdsInText,
  type RawGuildWebhook,
} from '@/lib/discordQuickSetup';

export interface ForeignWebhook {
  id: string;
  name: string;
  channelId: string;
  channelName: string;
}

export interface RouteNow {
  settingKey: string;
  channelId: string | null;
  channelName: string | null;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

export type GuildWebhookRead =
  | { ok: true; webhooks: RawGuildWebhook[]; channels: GuildChannel[]; botIds: Set<string> }
  | { ok: false; error: string; status: number };

// The bot's user id and application id are fixed per token; resolve once per process.
const botIdCache = new Map<string, Set<string>>();

async function botIdentity(botToken: string): Promise<Set<string> | null> {
  const cached = botIdCache.get(botToken);
  if (cached) return cached;
  const ids = new Set<string>();
  const me = await discordRest(botToken, '/users/@me');
  if (!me.ok) return null;
  const user = (await me.json()) as { id?: string };
  if (user.id) ids.add(user.id);
  // Usually the same id; an old application can differ. Best effort — the user id is enough.
  const app = await discordRest(botToken, '/applications/@me');
  if (app.ok) {
    const a = (await app.json()) as { id?: string };
    if (a.id) ids.add(a.id);
  }
  if (ids.size === 0) return null;
  botIdCache.set(botToken, ids);
  return ids;
}

/** Read the guild's webhooks + channels + the bot's own ids. Never throws. */
export async function readGuildWebhooks(botToken: string, guildId: string): Promise<GuildWebhookRead> {
  const botIds = await botIdentity(botToken);
  if (!botIds) return { ok: false, status: 502, error: 'Could not check who the bot is. Is the bot token still valid?' };

  const [whRes, chRes] = await Promise.all([
    discordRest(botToken, `/guilds/${guildId}/webhooks`),
    discordRest(botToken, `/guilds/${guildId}/channels`),
  ]);
  if (whRes.status === 403) {
    return {
      ok: false,
      status: 403,
      error: 'The bot can’t see your server’s webhooks. Give its role “Manage Webhooks” in Server Settings → Roles.',
    };
  }
  if (!whRes.ok) return { ok: false, status: 502, error: `Discord ${whRes.status} listing webhooks.` };
  const webhooks = (await whRes.json()) as RawGuildWebhook[];
  const channels = chRes.ok ? ((await chRes.json()) as GuildChannel[]) : [];
  return { ok: true, webhooks, channels, botIds };
}

/**
 * Webhook ids Anvil uses anywhere — a clan setting (any clan: two clans may share a server), an
 * event destination or a member's personal destination. A webhook a person made and pasted into
 * Anvil is ours, and removing it would silently stop those posts. Only ids from `candidates` (this
 * server's list) are looked up, so nothing about other servers is read.
 */
async function idsUsedByAnvil(candidates: string[]): Promise<Set<string>> {
  const ids = candidates.filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) return new Set();
  const pattern = (id: string) => `%/webhooks/${id}/%`;
  const [s, e, u] = await Promise.all([
    // clan-scope: global -- protective read only: an id from THIS server that any clan sharing it posts through is kept off the removable list; nothing read is returned
    db.select({ v: settings.value }).from(settings).where(or(...ids.map((id) => like(settings.value, pattern(id))))),
    db.select({ v: eventWebhooks.url }).from(eventWebhooks).where(or(...ids.map((id) => like(eventWebhooks.url, pattern(id))))),
    db.select({ v: userWebhooks.url }).from(userWebhooks).where(or(...ids.map((id) => like(userWebhooks.url, pattern(id))))),
  ]);
  const used = new Set<string>();
  for (const row of [...s, ...e, ...u]) for (const id of webhookIdsInText(row.v)) used.add(id);
  return used;
}

/** The server's webhooks that aren't Anvil's, with channel names, from a fresh read. */
export async function foreignWebhooksOf(read: Extract<GuildWebhookRead, { ok: true }>): Promise<ForeignWebhook[]> {
  const used = await idsUsedByAnvil(read.webhooks.map((w) => w.id));
  const names = new Map(read.channels.map((c) => [c.id, c.name]));
  return read.webhooks
    .filter((w) => isForeignWebhook(w, read.botIds, used))
    .map((w) => ({
      id: w.id,
      name: w.name || 'Unnamed webhook',
      channelId: w.channel_id ?? '',
      channelName: (w.channel_id && names.get(w.channel_id)) || 'unknown-channel',
    }))
    .sort((a, b) => a.channelName.localeCompare(b.channelName) || a.name.localeCompare(b.name));
}

/** Where this clan's plugin routing settings point now, as channels (null when not in this server). */
export async function currentRouting(
  clanId: number,
  read: Extract<GuildWebhookRead, { ok: true }>,
): Promise<RouteNow[]> {
  const map = await getSettingMap(clanId, [...QUICK_SETUP_KEYS]);
  const channelOf = new Map(read.webhooks.map((w) => [w.id, w.channel_id ?? null]));
  const names = new Map(read.channels.map((c) => [c.id, c.name]));
  const out: RouteNow[] = [];
  for (const key of QUICK_SETUP_KEYS) {
    const value = map.get(key);
    if (!value?.trim()) continue;
    const id = webhookIdsInText(value)[0];
    const channelId = (id && channelOf.get(id)) || null;
    out.push({ settingKey: key, channelId, channelName: channelId ? names.get(channelId) ?? null : null });
  }
  return out;
}
