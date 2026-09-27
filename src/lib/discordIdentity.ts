// Who the bot looks like in a clan's Discord server.
//
// One Anvil bot serves every managed clan, and Discord lets a bot hold a DIFFERENT nickname and
// avatar in each server (PATCH /guilds/{id}/members/@me). So a clan can have the bot show up as
// "The AFK Spot" with its own crest in its own server, while it stays "Anvil" everywhere else.
// Webhook posts carry a name and icon per message, so they follow the same choice.
//
// Three modes, in settings:
//   anvil  — the default: Anvil's name and logo (the bot's global profile; nothing is set per server)
//   clan   — the clan's display name and logo (its generated crest when it has none)
//   custom — a name and image the clan picks
//
// "Powered by Anvil" on every embed stays whatever the mode (lib/discordEmbeds stampBrand).

import sharp from 'sharp';

import { getSettingMap, setSetting } from '@/lib/settings';
import { resolveClanById } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { crestImage } from '@/lib/crestImage';
import { configuredOrigin } from '@/lib/request-origin';
import { log } from '@/lib/logger';

export type IdentityMode = 'anvil' | 'clan' | 'custom';

export const IDENTITY_KEYS = {
  mode: 'discord_bot_identity',
  name: 'discord_bot_nick',
  avatar: 'discord_bot_avatar_url',
} as const;

export interface BotIdentity {
  mode: IdentityMode;
  /** Null in 'anvil' mode: nothing overrides the bot's own profile. */
  name: string | null;
  /** A public URL, for webhook avatar_url. Null in 'anvil' mode. */
  avatarUrl: string | null;
}

const cache = new Map<number, { at: number; value: BotIdentity }>();
const TTL = 60_000;

export async function getBotIdentity(clanId: number): Promise<BotIdentity> {
  const hit = cache.get(clanId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const s = await getSettingMap(clanId, Object.values(IDENTITY_KEYS));
  const mode = (s.get(IDENTITY_KEYS.mode) as IdentityMode) || 'anvil';
  let value: BotIdentity = { mode: 'anvil', name: null, avatarUrl: null };
  if (mode === 'clan' || mode === 'custom') {
    const clan = await resolveClanById(clanId);
    const clanName = clan ? await getClanDisplayName(clanId, clan.name) : 'Anvil';
    const origin = configuredOrigin();
    const crest = clan && origin ? `${origin}/api/og/crest/${clan.slug}` : null;
    value =
      mode === 'clan'
        ? { mode, name: clanName, avatarUrl: clan?.logoUrl ?? crest }
        : { mode, name: s.get(IDENTITY_KEYS.name)?.trim() || clanName, avatarUrl: s.get(IDENTITY_KEYS.avatar) || clan?.logoUrl || crest };
  }
  cache.set(clanId, { at: Date.now(), value });
  return value;
}

/** Webhook fields for a clan's posts: `{}` in Anvil mode, so the webhook's own name/avatar stand. */
export async function webhookIdentity(clanId: number): Promise<{ username?: string; avatar_url?: string }> {
  try {
    const id = await getBotIdentity(clanId);
    if (id.mode === 'anvil') return {};
    return {
      // Discord refuses webhook names containing "discord" and caps them at 80 characters.
      ...(id.name ? { username: id.name.replace(/discord/gi, 'Dc').slice(0, 80) } : {}),
      ...(id.avatarUrl ? { avatar_url: id.avatarUrl } : {}),
    };
  } catch {
    return {};
  }
}

/** An image as the data URI Discord's avatar field wants: a 256px PNG, whatever came in. */
async function avatarDataUri(clanId: number, url: string | null): Promise<string> {
  let bytes: Buffer;
  if (url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Couldn't load the image (${res.status}).`);
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    // No logo and no public origin to fetch the crest from: render it here.
    const clan = await resolveClanById(clanId);
    const name = clan ? await getClanDisplayName(clanId, clan.name) : 'Anvil';
    bytes = Buffer.from(await crestImage(name).arrayBuffer());
  }
  const png = await sharp(bytes).resize(256, 256, { fit: 'cover' }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
}

/**
 * Make the bot's profile in this clan's server match the setting. Anvil mode clears the per-server
 * nickname and avatar, so the bot's global profile shows again.
 */
export async function applyBotIdentity(clanId: number): Promise<ApplyResult> {
  cache.delete(clanId);
  const creds = await getBotCredentials(clanId);
  if (!creds) return { ok: false, error: 'The Discord bot is not connected for this clan.' };
  const id = await getBotIdentity(clanId);
  let body: Record<string, unknown>;
  try {
    body =
      id.mode === 'anvil'
        ? { nick: null, avatar: null }
        : { nick: (id.name ?? '').slice(0, 32) || null, avatar: await avatarDataUri(clanId, id.avatarUrl) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/members/@me`, { method: 'PATCH', body: JSON.stringify(body) });
  if (res.ok) return { ok: true };
  let message = '';
  try {
    message = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    /* not json */
  }
  log.warn('discord.identity-fail', { clanId, status: res.status, message });
  if (res.status === 403) return { ok: false, error: 'The bot needs the "Change Nickname" permission in your server.' };
  if (res.status === 404) return { ok: false, error: "The bot isn't in your Discord server." };
  if (res.status === 429) return { ok: false, error: 'Discord limits how often a bot can change its avatar — try again in a few minutes.' };
  return { ok: false, error: `Discord ${res.status}${message ? `: ${message}` : ''}` };
}

export interface IdentityInput {
  mode: IdentityMode;
  name?: string | null;
  avatarUrl?: string | null;
}

export async function saveBotIdentity(clanId: number, input: IdentityInput): Promise<ApplyResult> {
  if (!['anvil', 'clan', 'custom'].includes(input.mode)) return { ok: false, error: 'Unknown mode.' };
  const name = (input.name ?? '').trim().slice(0, 32);
  const avatar = (input.avatarUrl ?? '').trim();
  if (input.mode === 'custom' && avatar && !/^https:\/\//i.test(avatar)) return { ok: false, error: 'The icon must be an https:// image.' };
  await setSetting(clanId, IDENTITY_KEYS.mode, input.mode);
  await setSetting(clanId, IDENTITY_KEYS.name, input.mode === 'custom' ? name || null : null);
  await setSetting(clanId, IDENTITY_KEYS.avatar, input.mode === 'custom' ? avatar || null : null);
  return applyBotIdentity(clanId);
}

/** After a clan changes its name or logo: follow it, if the bot is set to look like the clan. */
export async function refreshBotIdentityIfClan(clanId: number): Promise<void> {
  cache.delete(clanId);
  const id = await getBotIdentity(clanId).catch(() => null);
  if (id && id.mode !== 'anvil') await applyBotIdentity(clanId).catch(() => {});
}
