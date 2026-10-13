// A Join link for the clan hall when the clan never gave one.
//
// The card's button needs an invite, and most clans have neither set one in Anvil nor picked an
// invite channel in Discord's widget settings — so the card showed who was around with no way in.
// The bot is already in the server, so it makes one: permanent, unlimited uses, into the server's
// welcome (system) channel, else its rules channel, else the first text channel it may invite to.
//
// Made once and kept in a setting. Checked against Discord at most once a day, because somebody
// tidying up invites in Server Settings can delete it; a dead one is replaced on the next view.

import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { inviteCode } from '@/lib/discordWidget';
import { getSetting, setSetting } from '@/lib/settings';
import { log } from '@/lib/logger';

const KEY = 'discord_widget_invite';
const RECHECK_MS = 24 * 60 * 60_000;
// A failed attempt (no Create Invite permission, say) is not retried on every page view.
const RETRY_AFTER_FAIL_MS = 60 * 60_000;

interface Stored {
  code?: string;
  /** Where the bot made it — its channel's invite list is where Discord reports `uses`. */
  channelId?: string;
  checkedAt?: number;
  failedAt?: number;
}

function read(raw: string | null): Stored {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? (v as Stored) : {};
  } catch {
    return {};
  }
}

const url = (code: string) => `https://discord.gg/${code}`;

export async function botMadeInviteUrl(clanId: number): Promise<string | null> {
  const stored = read(await getSetting(clanId, KEY));
  const now = Date.now();

  if (stored.code) {
    if (now - (stored.checkedAt ?? 0) < RECHECK_MS) return url(stored.code);
    // Public endpoint, no token: does the invite still exist?
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(stored.code)}`, {
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    if (res?.ok) {
      await setSetting(clanId, KEY, JSON.stringify({ ...stored, checkedAt: now }));
      return url(stored.code);
    }
    // Discord down is not the invite deleted: keep serving it and ask again next time.
    if (!res || res.status !== 404) return url(stored.code);
  } else if (stored.failedAt && now - stored.failedAt < RETRY_AFTER_FAIL_MS) {
    return null;
  }

  const made = await createInvite(clanId);
  await setSetting(clanId, KEY, JSON.stringify(made ? { ...made, checkedAt: now } : { failedAt: now }));
  return made ? url(made.code) : null;
}

async function createInvite(clanId: number): Promise<{ code: string; channelId: string } | null> {
  // Verified binding only: a guild id the clan merely typed in is not one we act in.
  const creds = await getBotCredentials(clanId);
  if (!creds) return null;
  const { botToken, guildId } = creds;

  const candidates: string[] = [];
  const guildRes = await discordRest(botToken, `/guilds/${guildId}`);
  if (guildRes.ok) {
    const g = (await guildRes.json()) as { system_channel_id?: string | null; rules_channel_id?: string | null };
    if (g.system_channel_id) candidates.push(g.system_channel_id);
    if (g.rules_channel_id) candidates.push(g.rules_channel_id);
  }
  const chRes = await discordRest(botToken, `/guilds/${guildId}/channels`);
  if (chRes.ok) {
    const chans = (await chRes.json()) as { id: string; type: number; position: number }[];
    for (const c of chans.filter((c) => c.type === 0).sort((a, b) => a.position - b.position)) {
      if (!candidates.includes(c.id)) candidates.push(c.id);
    }
  }

  // A few tries: the bot may lack Create Invite on the first channels and have it further down.
  for (const channelId of candidates.slice(0, 4)) {
    const res = await discordRest(botToken, `/channels/${channelId}/invites`, {
      method: 'POST',
      // unique:false hands back the same invite to repeat calls, so two page views racing here
      // don't leave a pile of invites in the server's list.
      body: JSON.stringify({ max_age: 0, max_uses: 0, unique: false, temporary: false }),
    });
    if (res.ok) {
      const invite = (await res.json()) as { code?: string };
      if (invite.code) return { code: invite.code, channelId };
    }
  }
  log.warn('discord-widget.invite-fail', { clanId, tried: Math.min(candidates.length, 4) });
  return null;
}

/**
 * How many people joined through the invites the Join button uses — Discord's own `uses` count, so
 * it is joins rather than clicks. The guild's invite list needs Manage Server; without it, the
 * bot-made invite's channel list (Manage Channels) still answers for that one. Empty when neither.
 */
export async function inviteJoinCounts(
  clanId: number,
  clanInviteUrl: string | null,
): Promise<{ code: string; uses: number; madeByAnvil: boolean }[]> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return [];
  const stored = read(await getSetting(clanId, KEY));
  const wanted = new Map<string, boolean>();
  const own = inviteCode(clanInviteUrl);
  if (own) wanted.set(own, false);
  if (stored.code) wanted.set(stored.code, true);
  if (wanted.size === 0) return [];

  let list: { code: string; uses?: number }[] | null = null;
  const all = await discordRest(creds.botToken, `/guilds/${creds.guildId}/invites`).catch(() => null);
  if (all?.ok) list = (await all.json()) as { code: string; uses?: number }[];
  else if (stored.channelId) {
    const ch = await discordRest(creds.botToken, `/channels/${stored.channelId}/invites`).catch(() => null);
    if (ch?.ok) list = (await ch.json()) as { code: string; uses?: number }[];
  }
  if (!list) return [];
  return list
    .filter((i) => wanted.has(i.code))
    .map((i) => ({ code: i.code, uses: i.uses ?? 0, madeByAnvil: wanted.get(i.code)! }));
}
