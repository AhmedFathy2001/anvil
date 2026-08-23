// Discord Interactions — the INBOUND half of the bot.
//
// Everything else under lib/discord* talks TO Discord (post a message, make a channel, sync a role).
// This is the one path where Discord talks to US: a member types `/bingo board` in the clan's server
// and Discord POSTs the interaction to an endpoint we register on the application.
//
// Why HTTP interactions and not a gateway bot:
//   - A gateway bot is a persistent WebSocket process. Anvil runs one container PER CLAN, so a
//     gateway would mean N connections to Discord (or a new always-on daemon that then has to fan
//     back into every clan). An HTTP endpoint is just another route in the app that already exists.
//   - Reading `!bingo` out of ordinary chat needs the MESSAGE CONTENT privileged intent, which
//     Discord gates behind review once an app passes 100 servers — and "read every message" is the
//     exact pattern slash commands were introduced to replace. Slash commands need no intent at all.
//
// This module owns the PROTOCOL only — signature verification, payload types, response shapes.
// What the commands actually answer lives in lib/discordCommands.ts.
//
// SECURITY: Discord signs every request with Ed25519 over (timestamp + rawBody). An endpoint that
// skips verification is world-writable — anyone can POST a fake interaction claiming to be any user
// in any guild. Verification is NOT optional and must run against the RAW body bytes, before any
// JSON parsing. Discord also probes a newly-saved endpoint URL with deliberately-invalid signatures
// and refuses to accept the URL unless those get a 401.

import { stampEmbeds } from '@/lib/discordEmbeds';

/** Interaction payload types Discord sends (docs: Interaction Object → Interaction Type). */
export const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

/** Response types we use (docs: Interaction Response Object → Callback Type). */
export const CALLBACK_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  /** "Anvil is thinking…" — buys 15 minutes to PATCH the real answer in. */
  DEFERRED_CHANNEL_MESSAGE: 5,
} as const;

/** Message flags. EPHEMERAL = only the person who ran the command sees it. */
export const MESSAGE_FLAGS = { EPHEMERAL: 1 << 6 } as const;

/** Component types (docs: Message Components). A button must sit inside an action row. */
export const COMPONENT_TYPE = { ACTION_ROW: 1, BUTTON: 2 } as const;

/** Button styles. SECONDARY is the grey one — a share button shouldn't shout. */
export const BUTTON_STYLE = { PRIMARY: 1, SECONDARY: 2 } as const;

/** Option types we declare (docs: Application Command Option Type). */
export const OPTION_TYPE = {
  SUB_COMMAND: 1,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
} as const;

export interface InteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: InteractionOption[];
}

export interface InteractionUser {
  id: string;
  username?: string;
  global_name?: string | null;
}

/**
 * The subset of the interaction payload the commands read. Discord sends a great deal more; typing
 * only what we use keeps the handler honest about what it depends on.
 *
 * `member` is present for guild interactions and `user` for DMs — never both. The invoking Discord
 * user id is the whole authentication story for a command: Discord vouched for it, and
 * `users.discord_id` is already Anvil's identity column, so a member who has never opened the
 * website still resolves to their roster row.
 */
export interface Interaction {
  id: string;
  type: number;
  application_id: string;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: { user: InteractionUser; nick?: string | null };
  user?: InteractionUser;
  /** The invoking member's own client language, e.g. `da`, `pt-BR`. Absent on some payloads. */
  locale?: string;
  /** The server's configured language. What a message the whole channel reads should speak. */
  guild_locale?: string;
  data?: {
    id: string;
    name?: string;
    options?: InteractionOption[];
    /** Present on MESSAGE_COMPONENT: the id we put on the button when we sent it. */
    custom_id?: string;
    component_type?: number;
  };
}

/** The invoking Discord user id, wherever Discord put it. */
export function invokerId(interaction: Interaction): string | null {
  return interaction.member?.user?.id ?? interaction.user?.id ?? null;
}

/** Their best display name, for embed prose. */
export function invokerName(interaction: Interaction): string {
  const user = interaction.member?.user ?? interaction.user;
  return interaction.member?.nick || user?.global_name || user?.username || 'you';
}

/**
 * Flatten `/bingo team name:Reds` into { sub: 'team', options: { name: 'Reds' } }.
 *
 * Every Anvil command is one top-level command with subcommands, so the shape is always
 * data.options[0] = the subcommand, whose own options are the arguments.
 */
export function readSubcommand(interaction: Interaction): {
  sub: string | null;
  options: Record<string, string | number | boolean>;
} {
  const top = interaction.data?.options?.[0];
  if (!top || top.type !== OPTION_TYPE.SUB_COMMAND) {
    // A command declared with no subcommands — read its arguments directly.
    const options: Record<string, string | number | boolean> = {};
    for (const o of interaction.data?.options ?? []) if (o.value !== undefined) options[o.name] = o.value;
    return { sub: null, options };
  }
  const options: Record<string, string | number | boolean> = {};
  for (const o of top.options ?? []) if (o.value !== undefined) options[o.name] = o.value;
  return { sub: top.name, options };
}

// ── Signature verification ──────────────────────────────────────────────────────────────────────

const hexCache = new Map<string, CryptoKey>();

// Views are allocated over an explicit ArrayBuffer so they satisfy WebCrypto's BufferSource: a
// plain `new Uint8Array(n)` is typed over ArrayBufferLike, which TS won't accept there.
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null;
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** UTF-8 bytes over a plain ArrayBuffer — same BufferSource reason as above. */
function utf8(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  out.set(encoded);
  return out;
}

/**
 * Import (and cache) an application's `verify_key` — the hex Ed25519 public key from the Discord
 * developer portal, also returned by GET /applications/@me so no admin ever has to type it.
 */
async function importVerifyKey(publicKeyHex: string): Promise<CryptoKey | null> {
  const cached = hexCache.get(publicKeyHex);
  if (cached) return cached;
  const raw = hexToBytes(publicKeyHex.trim());
  if (!raw || raw.length !== 32) return null;
  try {
    const key = await crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
    hexCache.set(publicKeyHex, key);
    return key;
  } catch {
    return null;
  }
}

/**
 * Verify Discord's Ed25519 signature over (timestamp + rawBody).
 *
 * `rawBody` must be the exact bytes Discord sent — re-serializing the parsed JSON changes key order
 * and whitespace and will never verify. Returns false (never throws) on any malformed input, so a
 * caller can answer 401 uniformly.
 */
export async function verifyDiscordSignature(opts: {
  publicKeyHex: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}): Promise<boolean> {
  const { publicKeyHex, signature, timestamp, rawBody } = opts;
  if (!signature || !timestamp) return false;
  const sig = hexToBytes(signature.trim());
  if (!sig || sig.length !== 64) return false;
  const key = await importVerifyKey(publicKeyHex);
  if (!key) return false;
  try {
    return await crypto.subtle.verify('Ed25519', key, sig, utf8(timestamp + rawBody));
  } catch {
    return false;
  }
}

// ── Response builders ───────────────────────────────────────────────────────────────────────────

export interface ActionRow {
  type: number;
  components: {
    type: number;
    style: number;
    label: string;
    custom_id: string;
    emoji?: { name: string };
  }[];
}

export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: unknown[];
    flags?: number;
    components?: ActionRow[];
  };
}

/**
 * The one-button row that turns a private answer into a channel post.
 *
 * Discord has no valueless command option — every option carries a value, which is why the old
 * `share: true` existed and why nobody used it. A button is the only shape where "share" is one
 * click, and it has the side benefit of being visible: people who never knew the option existed
 * can see the button.
 *
 * `customId` must round-trip enough to rebuild the answer (see lib/discordCommands) and Discord
 * caps it at 100 characters.
 */
export function shareRow(label: string, customId: string): ActionRow {
  return {
    type: COMPONENT_TYPE.ACTION_ROW,
    components: [
      {
        type: COMPONENT_TYPE.BUTTON,
        style: BUTTON_STYLE.SECONDARY,
        label,
        custom_id: customId.slice(0, 100),
        emoji: { name: '\u{1F4E2}' },
      },
    ],
  };
}

/** The mandatory reply to Discord's PING (both the endpoint-URL check and periodic health probes). */
export function pong(): InteractionResponse {
  return { type: CALLBACK_TYPE.PONG };
}

/**
 * An embed reply, and the choke point where the Anvil footer is stamped — same contract as
 * sendToWebhook / sendBotMessage in lib/discord, so a command's answer is branded like every other
 * Anvil post without any builder remembering to do it.
 *
 * Ephemeral by default: a `/bingo me` answer is for the person who asked, and a bot
 * that dumps a leaderboard into general every time someone is curious gets muted. Commands opt into
 * a public post explicitly.
 */
export function embedReply(
  embeds: unknown[],
  opts: { ephemeral?: boolean; components?: ActionRow[] } = {},
): InteractionResponse {
  return {
    type: CALLBACK_TYPE.CHANNEL_MESSAGE,
    data: {
      ...stampEmbeds({ embeds, flags: opts.ephemeral === false ? undefined : MESSAGE_FLAGS.EPHEMERAL }),
      ...(opts.components ? { components: opts.components } : {}),
    },
  };
}

/** A plain-text reply — used for errors, where an embed would be ceremony around one sentence. */
export function textReply(content: string, opts: { ephemeral?: boolean } = {}): InteractionResponse {
  return {
    type: CALLBACK_TYPE.CHANNEL_MESSAGE,
    data: { content, flags: opts.ephemeral === false ? undefined : MESSAGE_FLAGS.EPHEMERAL },
  };
}

/** "Anvil is thinking…" — the 3-second ack when the real answer needs longer. */
export function deferred(opts: { ephemeral?: boolean } = {}): InteractionResponse {
  return {
    type: CALLBACK_TYPE.DEFERRED_CHANNEL_MESSAGE,
    data: { flags: opts.ephemeral === false ? undefined : MESSAGE_FLAGS.EPHEMERAL },
  };
}

/**
 * Replace a deferred placeholder with the real answer. Valid for 15 minutes after the interaction
 * and needs no bot token — the interaction token IS the credential.
 */
export async function editDeferred(
  applicationId: string,
  interactionToken: string,
  body: { content?: string; embeds?: unknown[] },
): Promise<boolean> {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => null);
  return !!res?.ok;
}
