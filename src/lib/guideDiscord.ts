// A guide, as the Discord messages it is posted as.
//
// PURE — no `@/` imports — so the tests can run it without a database, and so the editor's live
// preview (a client component) renders exactly what the bot will send rather than a second
// approximation of it.
//
// THE AUTHOR WRITES DISCORD'S OWN MARKDOWN, so almost nothing here translates text. Discord already
// renders `# headings`, `-# subtext`, lists, quotes, spoilers and masked links in a plain message, and
// a plain message reads far better for a long guide than a stack of embeds does: full width, real
// headings, no coloured bar down the side of every paragraph. What this file decides is SHAPE:
//
//   - where one message ends and the next begins (`---` on its own line, or 2000 characters)
//   - where images go (an image line becomes an image under the text it follows, in order)
//   - the header (title + summary, and the cover as its own message) and the footer line
//
// Images are embeds with only an image — Discord draws those as a bare picture — and consecutive
// images sharing an embed `url` collapse into one gallery grid of up to four.

/** Discord's hard cap is 2000; a little headroom for the footer line and fence repair. */
export const CONTENT_MAX = 1990;
/** Discord's hard cap on embeds per message. */
const EMBEDS_PER_MESSAGE = 10;
/** Discord merges up to four same-url image embeds into one gallery. */
const GALLERY_SIZE = 4;

/** A line holding only `---` starts a new Discord message. */
export const MESSAGE_BREAK_RE = /^\s*---\s*$/;
/** An image on a line of its own: `![alt](https://…)`, optionally with a "title". */
export const IMAGE_LINE_RE = /^\s*!\[([^\]]*)\]\(\s*<?([^\s>)]+)>?(?:\s+"[^"]*")?\s*\)\s*$/;
const FENCE_RE = /^\s*```/;

export interface GuideForDiscord {
  title: string;
  summary?: string | null;
  body: string;
  coverUrl?: string | null;
  /** Where the guide reads on the site; linked from the footer. Null leaves the link out. */
  siteUrl?: string | null;
  /** ISO — rendered as a Discord relative timestamp in the footer. */
  updatedAt?: string | null;
  /** Shown in the footer ("from the Anvil library" / the clan's name). */
  byline?: string | null;
}

export interface DiscordImageEmbed {
  url: string;
  image: { url: string };
  color?: number;
}

export interface DiscordGuideMessage {
  content: string;
  embeds: DiscordImageEmbed[];
}

/** Make an image URL absolute and refuse anything that is not http(s). Null means drop it. */
export function absoluteImageUrl(raw: string, origin: string | null | undefined): string | null {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//') && origin) return `${origin.replace(/\/+$/, '')}${url}`;
  return null;
}

interface Block {
  text: string;
  images: string[];
}

/**
 * Cut the body into message-sized blocks: `---` separates sections, and inside a section each run of
 * text owns the images that follow it. Text after an image starts a new block — Discord draws embeds
 * UNDER a message's text, so an image can only sit between two paragraphs if they are two messages.
 */
export function splitBlocks(body: string, origin?: string | null): Block[] {
  const blocks: Block[] = [];
  let cur: Block = { text: '', images: [] };
  let lines: string[] = [];
  let inFence = false;

  const flushText = () => {
    const text = lines.join('\n').replace(/^\n+|\s+$/g, '');
    lines = [];
    if (text) cur.text = cur.text ? `${cur.text}\n\n${text}` : text;
  };
  const closeBlock = () => {
    flushText();
    if (cur.text || cur.images.length) blocks.push(cur);
    cur = { text: '', images: [] };
  };

  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    if (!inFence && MESSAGE_BREAK_RE.test(line)) {
      closeBlock();
      continue;
    }
    const img = !inFence ? IMAGE_LINE_RE.exec(line) : null;
    if (img) {
      const url = absoluteImageUrl(img[2], origin);
      if (!url) continue;
      flushText();
      cur.images.push(url);
      continue;
    }
    // Text after images: those images belonged to the text before them. New block.
    if (cur.images.length && line.trim()) {
      closeBlock();
    }
    lines.push(line);
  }
  closeBlock();
  return blocks;
}

/**
 * Split text into ≤ `max` chunks at the kindest boundary available — a blank line, then a line,
 * then a space — and never leave a code fence open across a cut: a fence split in two would turn the
 * rest of the next message into code.
 */
export function chunkContent(text: string, max = CONTENT_MAX): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = window.lastIndexOf('\n\n');
    if (cut < max * 0.4) cut = window.lastIndexOf('\n');
    if (cut < max * 0.4) cut = window.lastIndexOf(' ');
    if (cut < max * 0.4) cut = max;
    let head = rest.slice(0, cut).trimEnd();
    let tail = rest.slice(cut).replace(/^\n+/, '').trimStart();
    // An odd number of fences in the head means we cut inside a code block: close it here and
    // reopen it, with the same language tag, at the top of the next message.
    const fences = head.split('\n').filter((l) => FENCE_RE.test(l));
    if (fences.length % 2 === 1) {
      const opener = fences[fences.length - 1].trim();
      // Room for the closing fence, which may push us over — trim the head back a line if needed.
      if (head.length + 4 > max) {
        const nl = head.lastIndexOf('\n');
        tail = `${head.slice(nl + 1)}\n${tail}`;
        head = head.slice(0, nl);
      }
      head = `${head}\n\`\`\``;
      tail = `${opener}\n${tail}`;
    }
    if (head) out.push(head);
    rest = tail;
  }
  if (rest) out.push(rest);
  return out;
}

function imageEmbeds(images: string[], galleryKey: string, color: number | undefined): DiscordImageEmbed[] {
  return images.map((url, i) => ({
    // Consecutive embeds sharing a url become one gallery; every four starts a new grid.
    url: `${galleryKey}-${Math.floor(i / GALLERY_SIZE)}`,
    image: { url },
    ...(color != null ? { color } : {}),
  }));
}

/** `<t:…:R>` for an ISO time, or null when it does not parse. */
export function discordTimestamp(iso: string | null | undefined, style: 'R' | 'f' | 'D' = 'R'): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:${style}>` : null;
}

function footerLine(g: GuideForDiscord): string {
  const bits: string[] = [];
  // <…> around the url keeps Discord from unfurling a preview card of our own page under the guide.
  if (g.siteUrl) bits.push(`📖 [Read on the site](<${g.siteUrl}>)`);
  const ts = discordTimestamp(g.updatedAt);
  if (ts) bits.push(`Updated ${ts}`);
  if (g.byline) bits.push(g.byline);
  bits.push('Powered by Anvil');
  return `-# ${bits.join(' · ')}`;
}

/**
 * The whole guide as an ordered list of Discord messages.
 *
 * `origin` makes site-relative image paths absolute (Discord cannot fetch `/uploads/x.png`); `color`
 * tints the image embeds' edge, which Discord shows only when an image is narrower than the frame.
 */
export function renderGuideForDiscord(
  g: GuideForDiscord,
  opts: { origin?: string | null; color?: number } = {},
): DiscordGuideMessage[] {
  const origin = opts.origin ?? null;
  const galleryBase = (g.siteUrl || origin || 'https://anvilosrs.com').replace(/#.*$/, '');
  const messages: DiscordGuideMessage[] = [];

  const header = [`# ${g.title.trim() || 'Untitled guide'}`];
  const summary = (g.summary ?? '').trim().replace(/\s*\n+\s*/g, ' ');
  if (summary) header.push(`-# ${summary}`);
  const headerText = header.join('\n');

  const cover = g.coverUrl ? absoluteImageUrl(g.coverUrl, origin) : null;
  if (cover) {
    // The cover goes on the header message, so the post opens with the picture under the title.
    messages.push({ content: headerText, embeds: imageEmbeds([cover], `${galleryBase}#cover`, opts.color) });
  }

  const blocks = splitBlocks(g.body, origin);
  blocks.forEach((block, bi) => {
    const chunks = block.text ? chunkContent(block.text) : [''];
    chunks.forEach((chunk, ci) => {
      const last = ci === chunks.length - 1;
      const images = last ? block.images : [];
      // Ten embeds per message; a longer run of images spills into image-only messages.
      for (let i = 0; i === 0 || i < images.length; i += EMBEDS_PER_MESSAGE) {
        messages.push({
          content: i === 0 ? chunk : '',
          embeds: imageEmbeds(images.slice(i, i + EMBEDS_PER_MESSAGE), `${galleryBase}#b${bi}-${ci}-${i}`, opts.color),
        });
        if (images.length === 0) break;
      }
    });
  });

  // No cover: the title rides on top of the first body message when it fits, rather than being a
  // lonely one-line message of its own.
  if (!cover) {
    const first = messages[0];
    if (first && first.content && first.content.length + headerText.length + 2 <= CONTENT_MAX) {
      first.content = `${headerText}\n\n${first.content}`;
    } else if (first && !first.content) {
      first.content = headerText;
    } else {
      messages.unshift({ content: headerText, embeds: [] });
    }
  }

  const footer = footerLine(g);
  const tail = messages[messages.length - 1];
  // Under the last message's text — but a message that ends in images would put the footer ABOVE
  // them, so then it gets a line of its own.
  if (tail && tail.embeds.length === 0 && tail.content.length + footer.length + 2 <= CONTENT_MAX) {
    tail.content = tail.content ? `${tail.content}\n\n${footer}` : footer;
  } else {
    messages.push({ content: footer, embeds: [] });
  }

  return messages;
}

/** Characters left before Discord refuses a message — for the editor's per-message counter. */
export function messageBudget(m: DiscordGuideMessage): number {
  return 2000 - m.content.length;
}
