// The Discord messages a clan broadcast becomes (lib/discord-broadcast sends them). Pure, so the
// mention rules are testable without a bot.

const EMBED_DESC_MAX = 3900; // hard cap is 4096
const MESSAGE_EMBED_CHARS_MAX = 5500; // hard cap is 6000 across all embeds in a message
const EMBEDS_PER_MESSAGE = 10;
const CONTENT_MAX = 1950; // hard cap is 2000
const TITLE_MAX = 256;

const NO_PINGS = { parse: [] as string[] };

export interface BroadcastMessageOpts {
  title?: string;
  body: string;
  asEmbed: boolean;
  colorHex?: string;
  mentionRoleId?: string | null;
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

/** The Discord messages one broadcast becomes: long text split across embeds or messages. */
export function buildMessages(opts: BroadcastMessageOpts, guildId: string): Record<string, unknown>[] {
  const body = (opts.body ?? '').trim();

  // Mention content + allowed_mentions ride on the FIRST message only. @everyone (role id ==
  // guild id) needs the `everyone` parse flag; a normal role needs its id allow-listed, else
  // Discord renders the mention without actually pinging.
  // EVERY message says what may ping, so nothing typed in the body ever does: `@everyone`, `@here`,
  // `<@&role>` or `<@user>` in the text renders but notifies nobody (Discord's default with no
  // allowed_mentions is to parse them all — through the bot's own Mention Everyone permission).
  // Only the role picked in the form pings, once, on the first message.
  let mentionContent = '';
  let allowedMentions: Record<string, unknown> = NO_PINGS;
  if (opts.mentionRoleId && /^\d{5,25}$/.test(opts.mentionRoleId)) {
    if (opts.mentionRoleId === guildId) {
      mentionContent = '@everyone';
      allowedMentions = { parse: ['everyone'] };
    } else {
      mentionContent = `<@&${opts.mentionRoleId}>`;
      allowedMentions = { parse: [], roles: [opts.mentionRoleId] };
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
    if (mentionContent && messages.length) messages[0].content = mentionContent;
    messages.forEach((m, i) => (m.allowed_mentions = i === 0 ? allowedMentions : NO_PINGS));
  } else {
    // Plain text: fold the mention into the first chunk so it pings once, up top.
    const full = mentionContent ? `${mentionContent}\n\n${body}` : body;
    chunkText(full, CONTENT_MAX).forEach((content, i) => {
      messages.push({
        content,
        allowed_mentions: i === 0 ? allowedMentions : NO_PINGS,
      });
    });
  }
  return messages;
}
