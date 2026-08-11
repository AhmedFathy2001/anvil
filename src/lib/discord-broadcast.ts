/**
 * Bot-driven "post a message to a channel" — an admin broadcast tool for long messages
 * like event rules. Unlike the webhook posts elsewhere, this uses the bot REST API so we
 * can (a) target any channel by ID picked from a live list, (b) render a real embed, and
 * (c) optionally ping a role. Independent of every feature flag — it only needs a bot
 * token + guild ID (getBotCredentials); callers surface "not configured" to the admin.
 *
 * Reuses the shared REST helper + credential resolution from lib/discord-roles.ts.
 */
import { log } from '@/lib/logger';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { stampEmbeds } from '@/lib/discordEmbeds';

// Discord channel types (https://discord.com/developers/docs/resources/channel#channel-object-channel-types).
const CHANNEL_TEXT = 0;
const CHANNEL_ANNOUNCEMENT = 5;
const POSTABLE_TYPES = new Set([CHANNEL_TEXT, CHANNEL_ANNOUNCEMENT]);
const CHANNEL_CATEGORY = 4;

// Discord message limits. We stay a little under each to leave headroom.
const EMBED_DESC_MAX = 3900; // hard cap is 4096
const MESSAGE_EMBED_CHARS_MAX = 5500; // hard cap is 6000 across all embeds in a message
const EMBEDS_PER_MESSAGE = 10;
const CONTENT_MAX = 1950; // hard cap is 2000
const TITLE_MAX = 256;

export interface BroadcastChannel {
  id: string;
  name: string;
  parentName: string | null; // owning category, for grouping in the picker
  position: number;
}

export interface BroadcastRole {
  id: string;
  name: string;
  isEveryone: boolean;
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
}

interface RawRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
}

/**
 * List just the channels the bot can post to (no roles call). Shared by the Announce form
 * (via listBroadcastTargets) and the webhook channel picker, which only needs channels.
 * `enabled` is false when the bot isn't configured — the UI shows a setup hint instead of an
 * empty picker. A failing Discord call degrades to an empty list (logged), never throws.
 */
export async function listBotChannels(): Promise<{
  enabled: boolean;
  channels: BroadcastChannel[];
}> {
  const creds = await getBotCredentials();
  if (!creds) return { enabled: false, channels: [] };

  let channels: BroadcastChannel[] = [];
  const chRes = await discordRest(creds.botToken, `/guilds/${creds.guildId}/channels`);
  if (chRes.ok) {
    const raw = (await chRes.json()) as RawChannel[];
    const categoryNames = new Map<string, string>();
    for (const c of raw) if (c.type === CHANNEL_CATEGORY) categoryNames.set(c.id, c.name);
    channels = raw
      .filter((c) => POSTABLE_TYPES.has(c.type))
      .map((c) => ({
        id: c.id,
        name: c.name,
        parentName: c.parent_id ? categoryNames.get(c.parent_id) ?? null : null,
        position: c.position,
      }))
      .sort((a, b) => (a.parentName ?? '').localeCompare(b.parentName ?? '') || a.position - b.position);
  } else {
    log.warn('discord-broadcast.list-channels-fail', { status: chRes.status });
  }

  return { enabled: true, channels };
}

/**
 * List the channels the bot can post to + the roles it could ping, for the Announce form.
 * `enabled` is false when the bot isn't configured — the UI then shows a setup hint instead
 * of an empty picker. Failing Discord calls degrade to empty lists (logged), never throw.
 */
export async function listBroadcastTargets(): Promise<{
  enabled: boolean;
  channels: BroadcastChannel[];
  roles: BroadcastRole[];
}> {
  const { enabled, channels } = await listBotChannels();
  if (!enabled) return { enabled: false, channels: [], roles: [] };

  const creds = await getBotCredentials();
  if (!creds) return { enabled: false, channels: [], roles: [] };

  let roles: BroadcastRole[] = [];
  const rlRes = await discordRest(creds.botToken, `/guilds/${creds.guildId}/roles`);
  if (rlRes.ok) {
    const raw = (await rlRes.json()) as RawRole[];
    roles = raw
      // Managed roles are bot/integration/booster roles that can't be assigned or pinged usefully.
      .filter((r) => !r.managed)
      .map((r) => ({ id: r.id, name: r.name, isEveryone: r.id === creds.guildId }))
      .sort((a, b) => {
        // @everyone first, then by descending Discord position (matches the server list).
        if (a.isEveryone !== b.isEveryone) return a.isEveryone ? -1 : 1;
        const ra = raw.find((x) => x.id === a.id)?.position ?? 0;
        const rb = raw.find((x) => x.id === b.id)?.position ?? 0;
        return rb - ra;
      });
  } else {
    log.warn('discord-broadcast.list-roles-fail', { status: rlRes.status });
  }

  return { enabled: true, channels, roles };
}

export interface SendOpts {
  channelId: string;
  title?: string;
  body: string;
  asEmbed: boolean;
  colorHex?: string; // '#rrggbb' — embed accent colour
  mentionRoleId?: string | null; // ping this role (or @everyone when it equals the guild ID)
}

export interface SendReport {
  ok: boolean;
  reason?: string;
  messagesSent: number;
}

/** '#rrggbb' → the integer Discord wants for an embed colour. Falls back to a gold accent. */
function hexToInt(hex: string | null | undefined): number {
  const DEFAULT = 0xe0b341;
  if (!hex) return DEFAULT;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1], 16) : DEFAULT;
}

/**
 * Split text into <= `size` chunks, preferring paragraph, then line, then word boundaries
 * so a long message breaks cleanly rather than mid-sentence. Falls back to a hard cut only
 * when a single run has no whitespace.
 */
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    const window = rest.slice(0, size);
    let cut = window.lastIndexOf('\n\n');
    if (cut < size * 0.5) cut = window.lastIndexOf('\n');
    if (cut < size * 0.5) cut = window.lastIndexOf(' ');
    if (cut < size * 0.5) cut = size; // no good boundary — hard cut
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

// Human-readable reason for a failed message POST, naming the likely fix.
async function describeSendError(res: Response): Promise<string> {
  let message = '';
  let code: number | undefined;
  try {
    const body = (await res.clone().json()) as { message?: string; code?: number };
    message = body.message ?? '';
    code = body.code;
  } catch {
    /* body not JSON */
  }
  const base = `Discord ${res.status}${message ? `: ${message}` : ''}${code ? ` (code ${code})` : ''}`;
  if (res.status === 401) return `${base} — the bot token is invalid or was reset. Re-check DISCORD_BOT_TOKEN.`;
  if (res.status === 403 || code === 50013) {
    return `${base} — the bot can't post here. Give it "View Channel" + "Send Messages" (and "Mention Everyone" if pinging) on that channel.`;
  }
  if (res.status === 404 || code === 10003) {
    return `${base} — that channel no longer exists. Reload the channel list and pick again.`;
  }
  return base;
}

/**
 * Post a message to a channel as the bot, splitting long text across multiple embeds /
 * messages so there's no length cap the admin has to worry about. Returns how many Discord
 * messages were sent, or a human reason on the first failure.
 */
export async function sendBotMessage(opts: SendOpts): Promise<SendReport> {
  const creds = await getBotCredentials();
  if (!creds) {
    return {
      ok: false,
      reason: 'Discord bot is not configured. Set DISCORD_BOT_TOKEN and the server ID under Integrations.',
      messagesSent: 0,
    };
  }

  const body = (opts.body ?? '').trim();
  if (!opts.channelId) return { ok: false, reason: 'No channel selected.', messagesSent: 0 };
  if (!body) return { ok: false, reason: 'The message is empty.', messagesSent: 0 };

  // Mention content + allowed_mentions ride on the FIRST message only. @everyone (role id ==
  // guild id) needs the `everyone` parse flag; a normal role needs its id allow-listed, else
  // Discord renders the mention without actually pinging.
  let mentionContent = '';
  let allowedMentions: Record<string, unknown> | undefined;
  if (opts.mentionRoleId) {
    if (opts.mentionRoleId === creds.guildId) {
      mentionContent = '@everyone';
      allowedMentions = { parse: ['everyone'] };
    } else {
      mentionContent = `<@&${opts.mentionRoleId}>`;
      allowedMentions = { roles: [opts.mentionRoleId] };
    }
  }

  const color = hexToInt(opts.colorHex);
  const messages: Record<string, unknown>[] = [];

  if (opts.asEmbed) {
    type Embed = { title?: string; description: string; color: number };
    const embeds: Embed[] = chunkText(body, EMBED_DESC_MAX).map((desc, i) => ({
      ...(i === 0 && opts.title ? { title: opts.title.slice(0, TITLE_MAX) } : {}),
      description: desc,
      color,
    }));
    // Pack embeds into messages under Discord's per-message caps.
    let cur: Embed[] = [];
    let curChars = 0;
    for (const e of embeds) {
      const len = e.description.length + (e.title?.length ?? 0);
      if (cur.length >= EMBEDS_PER_MESSAGE || (cur.length > 0 && curChars + len > MESSAGE_EMBED_CHARS_MAX)) {
        messages.push({ embeds: cur });
        cur = [];
        curChars = 0;
      }
      cur.push(e);
      curChars += len;
    }
    if (cur.length) messages.push({ embeds: cur });
    if (mentionContent && messages.length) {
      messages[0].content = mentionContent;
      messages[0].allowed_mentions = allowedMentions;
    }
  } else {
    // Plain text: fold the mention into the first chunk so it pings once, up top.
    const full = mentionContent ? `${mentionContent}\n\n${body}` : body;
    chunkText(full, CONTENT_MAX).forEach((content, i) => {
      messages.push({
        content,
        ...(i === 0 && allowedMentions ? { allowed_mentions: allowedMentions } : {}),
      });
    });
  }

  let sent = 0;
  for (const msg of messages) {
    const res = await discordRest(creds.botToken, `/channels/${opts.channelId}/messages`, {
      method: 'POST',
      // Same brand footer as every webhook post — this is the bot API's exit, so it stamps here.
      // Plain-text broadcasts carry no embed and pass through untouched.
      body: JSON.stringify(stampEmbeds(msg)),
    });
    if (!res.ok) {
      const detail = await describeSendError(res);
      log.warn('discord-broadcast.send-fail', { status: res.status, channelId: opts.channelId, detail });
      return {
        ok: false,
        reason: sent > 0 ? `Sent ${sent} message(s), then failed — ${detail}` : detail,
        messagesSent: sent,
      };
    }
    sent++;
  }

  return { ok: true, messagesSent: sent };
}
