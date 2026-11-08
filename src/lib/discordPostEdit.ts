/**
 * How a board post reads once an admin has removed what it announced (lib/discordPosts). Pure, so it
 * is tested on its own: the title struck through, "Removed by an admin: <reason>" leading the
 * description, the image and everything else kept, and the colour dimmed.
 */

export interface PostEmbed {
  title?: string;
  description?: string;
  color?: number;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  [key: string]: unknown;
}

const TITLE_MAX = 256;
const DESC_MAX = 4096;
const REMOVED_COLOR = 0x5c5c5c;

/** `~~title~~`, once (an already struck title isn't struck twice), within Discord's limit. */
export function strike(title: string): string {
  const t = title.trim();
  if (t.startsWith('~~') && t.endsWith('~~')) return t;
  const room = TITLE_MAX - 4;
  return `~~${t.length > room ? `${t.slice(0, room - 1)}…` : t}~~`;
}

/** The note an edited post carries: "Removed by an admin: <reason>" (or "Rolled back by an admin"). */
export function removalNote(kind: 'removed' | 'rolledBack', reason?: string | null): string {
  const lead = kind === 'rolledBack' ? 'Rolled back by an admin' : 'Removed by an admin';
  const r = reason?.trim();
  return r ? `${lead}: ${r}` : lead;
}

/**
 * One embed, marked removed. Idempotent: marking a marked embed again changes nothing. `partial`: the
 * post carried several submissions and only some went — the note leads, but the title stands.
 */
export function removedEmbed(embed: PostEmbed, note: string, partial = false): PostEmbed {
  const line = `**${note}**`;
  const desc = embed.description ?? '';
  const already = desc.startsWith(line);
  const description = already ? desc : `${line}${desc ? `\n\n${desc}` : ''}`;
  return {
    ...embed,
    ...(embed.title && !partial ? { title: strike(embed.title) } : {}),
    description: description.length > DESC_MAX ? `${description.slice(0, DESC_MAX - 1)}…` : description,
    ...(partial ? {} : { color: REMOVED_COLOR }),
  };
}

/** The PATCH body for a message: every embed marked, the content (a ping) dropped so it can't re-ping. */
export function removedMessage(message: { embeds?: PostEmbed[]; content?: string | null }, note: string, partial = false): { embeds: PostEmbed[]; content: string; allowed_mentions: { parse: never[] } } {
  const embeds = (message.embeds ?? []).map((e) => removedEmbed(e, note, partial));
  return {
    embeds: embeds.length ? embeds : [{ description: `**${note}**`, color: REMOVED_COLOR }],
    content: '',
    allowed_mentions: { parse: [] },
  };
}
