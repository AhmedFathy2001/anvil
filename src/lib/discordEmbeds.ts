// The house style for every Discord embed Anvil sends — site announcements (lib/discord) and
// plugin-forwarded notifications (deaths, drops, achievements) alike. Before this, the two had
// unrelated looks: plugin embeds were title+fields, site embeds opened with a "━━━━━━" divider,
// and deaths weren't embeds at all. One grammar now covers all of them:
//
//   author      who it's about   — RSN for player events, event · team for board events
//   title       what happened    — one line, emoji-led; links out where a target exists
//   thumbnail   the subject      — item sprite, skill icon, tile icon
//   description one sentence     — plus a flavour line where it fits
//   fields      the numbers      — values in `backticks` so Discord boxes them
//   image       the screenshot   — inside the embed, never a bare attachment
//   footer      the Anvil mark   — stamped centrally, see stampBrand
//
// Nothing here talks to Discord; senders in lib/discord own that.

/** Public brand host. The footer mark links nowhere (Discord renders no markdown in footers), so
 *  this is only used where a URL can actually be clicked — an embed/author link. */
export const ANVIL_SITE_URL = 'https://anvilosrs.com';
/** Footer icon. Served by the Admin control plane's public site, so it's stable for every clan. */
export const ANVIL_LOGO_URL = 'https://anvilosrs.com/logo.png';
export const POWERED_BY = 'Powered by Anvil';

// Semantic palette (Anvil's site tokens). A team colour overrides these when a team owns the post.
export const EMBED_COLOR = {
  /** Brand default: drops, reveals, results, payouts. */
  gold: 0xd4a017,
  /** Starts, levels, completions, approvals. */
  green: 0x2d8544,
  /** Deaths, force-ends, deletions. */
  red: 0xc0392b,
  /** Warnings — a held start, a stalled countdown. */
  amber: 0xf59e0b,
  /** Pets and prestige unlocks. */
  violet: 0xa855f7,
  /** Informational — drafts, roster syncs. */
  blue: 0x2f6f9e,
} as const;

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  /** Makes the title a link. */
  url?: string;
  color?: number;
  author?: { name: string; url?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: DiscordEmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
}

// Discord's own limits. Exceeding any of them fails the whole message with a 400, so the builders
// clamp rather than trusting clan-authored names to be short.
export const LIMIT = { title: 256, description: 4096, fieldName: 256, fieldValue: 1024, author: 256 } as const;

export function clamp(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Wrap a value in backticks so Discord renders it as an inline code box — the "boxed number" look.
 *  Backticks inside the value would break out of the span, so they're stripped. */
export function code(value: string | number): string {
  return `\`${String(value).replace(/`/g, '')}\``;
}

/** A field whose value is prose (a note, a list, a link) — left unboxed. */
export function field(name: string, value: string, inline = true): DiscordEmbedField {
  return { name: clamp(name, LIMIT.fieldName), value: clamp(value, LIMIT.fieldValue), inline };
}

/** A field whose value is a number/short token — boxed via `code`. */
export function statField(name: string, value: string | number, inline = true): DiscordEmbedField {
  return field(name, code(value), inline);
}

/** Team hex ("#3b82f6") → Discord's decimal colour. Falls back to Anvil gold. */
export function teamColorToDecimal(hexColor: string | null | undefined): number {
  const hex = (hexColor ?? '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return EMBED_COLOR.gold;
  return parseInt(hex, 16);
}

/**
 * Stamp the Anvil mark on an embed: the footer (logo + "Powered by Anvil") and a timestamp when the
 * builder didn't set one. Applied centrally at the send choke points — sendToWebhook,
 * forwardPluginNotification, sendBotMessage — so EVERY embed carries it, including ones the plugin
 * composed and anything added later without touching this file.
 *
 * The footer deliberately carries no URL text: Discord renders no markdown in footers, so
 * "anvilosrs.com" there would be dead text. Posts that want a clickable link put it on the title
 * or author instead.
 *
 * Returns a copy — callers may hold a shared/literal object.
 */
export function stampBrand<T extends Record<string, unknown>>(
  embed: T,
): T & { footer: { text: string; icon_url: string }; timestamp: string } {
  return {
    ...embed,
    footer: { text: POWERED_BY, icon_url: ANVIL_LOGO_URL },
    timestamp: typeof embed.timestamp === 'string' ? embed.timestamp : new Date().toISOString(),
  };
}

/**
 * Wrap a plugin notification that arrived as plain text + a screenshot into a proper embed.
 *
 * Deaths and PvP kills are the two the plugin still posts as a bare message with the PNG dangling
 * underneath — the only Anvil posts with no colour, no structure and no branding. Composing the
 * embed HERE rather than in the plugin means every client already in the wild gets the new look on
 * deploy, with no hub release in the loop; a future plugin build that sends its own embed (with
 * killer / location / value lost) simply skips this path.
 *
 * `message` is the plugin's own wording — a clan-configurable death line plus its taunt — so it's
 * carried verbatim into the description rather than re-worded here.
 */
export function playerEventEmbed(opts: {
  kind: 'death' | 'pvp_kill';
  rsn: string | null;
  message: string;
  /** Screenshot filename in the same multipart body; referenced as attachment://<name>. */
  imageFilename?: string | null;
}): DiscordEmbed {
  const { kind, rsn, message, imageFilename } = opts;
  const death = kind === 'death';

  const embed: DiscordEmbed = {
    title: death ? '💀 Death' : '⚔️ PvP kill',
    description: clamp(message.trim(), LIMIT.description),
    color: death ? EMBED_COLOR.red : EMBED_COLOR.gold,
  };
  if (rsn) embed.author = { name: clamp(rsn, LIMIT.author) };
  if (imageFilename) embed.image = { url: `attachment://${imageFilename}` };
  return embed;
}

/**
 * A saved OBS clip, posted to the clan's clips channel.
 *
 * The plugin used to post these itself as bare text — "<rsn> saved a clip 🎬" — which told nobody
 * what they were about to watch. `moment` is the plugin's own summary of what happened inside the
 * clip's capture window (the drop, kill, completion or death it caught); when it has nothing to
 * report the embed falls back to naming the event, which still beats the bare line.
 *
 * The video rides in the same multipart body as an ordinary attachment. Discord renders a player
 * for it under the embed — an embed cannot host a video the way it hosts an image — so the embed
 * carries the words and the attachment carries the picture.
 */
export function clipEmbed(opts: {
  rsn: string | null;
  /** What the clip caught, in the plugin's words. Null when it saw nothing notable. */
  moment?: string | null;
  /** Event this was clipped during, for context when the moment is thin. */
  eventName?: string | null;
  /** Seconds of footage, from the capture buffer length. */
  seconds?: number | null;
}): DiscordEmbed {
  const { rsn, moment, eventName, seconds } = opts;
  const embed: DiscordEmbed = {
    title: '🎬 Clip saved',
    color: EMBED_COLOR.violet,
  };
  if (moment && moment.trim()) {
    embed.description = clamp(moment.trim(), LIMIT.description);
  } else if (eventName) {
    embed.description = `Clipped during ${clamp(eventName, 200)}.`;
  }
  if (rsn) embed.author = { name: clamp(rsn, LIMIT.author) };
  const fields: DiscordEmbedField[] = [];
  if (eventName && moment) fields.push(field('Event', clamp(eventName, LIMIT.fieldValue)));
  if (seconds && seconds > 0) fields.push(statField('Length', `${seconds}s`));
  if (fields.length) embed.fields = fields;
  return embed;
}

/** stampBrand across a payload's `embeds` array, leaving a payload with no embeds untouched. */
export function stampEmbeds<T extends { embeds?: unknown }>(payload: T): T {
  if (!Array.isArray(payload.embeds) || payload.embeds.length === 0) return payload;
  return {
    ...payload,
    embeds: payload.embeds.map((e) =>
      e && typeof e === 'object' ? stampBrand(e as Record<string, unknown>) : e,
    ),
  };
}
