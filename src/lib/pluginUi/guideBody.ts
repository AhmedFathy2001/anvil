// A guide's written body as the plugin panel shows it: sections (a heading and what follows), each a
// list of plain-text blocks. PURE. The body is Discord markdown (lib/guideMarkdown); the panel draws
// text only, so every mark is stripped here, links keep their words, and a YouTube link or a picture
// becomes a block the panel turns into a link to the guide on the site.

import { splitSegments, type TierKey } from '@/lib/guideTiers';
import { parseYouTube } from '@/lib/youtube';

export type BodyBlock =
  | { k: 'p'; s: string }
  | { k: 'li'; s: string }
  | { k: 'step'; n: number; s: string }
  | { k: 'img'; alt: string }
  | { k: 'video' };

export interface BodySection {
  /** The heading, or null for the text before the first one. */
  title: string | null;
  /** The `-#` subtext lines under it ("Around 60–70 Magic, Priest in Peril done"): what it asks of you. */
  note: string | null;
  blocks: BodyBlock[];
}

const FENCE_RE = /^\s*```/;
const HEADING_RE = /^\s*#{1,3}\s+(.+)$/;
const SUBTEXT_RE = /^\s*-#\s+(.+)$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const IMAGE_RE = /^\s*!\[([^\]]*)\]\([^)]*\)\s*$/;
const QUOTE_RE = /^\s*>{1,3}\s?(.*)$/;
const BREAK_RE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;

/** One line of Discord markdown as plain text: marks gone, links as their words, bare URLs dropped. */
export function plainLine(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((?:<)?https?:\/\/[^)\s]+(?:>)?\)/g, '$1')
    .replace(/<?https?:\/\/[^\s>]+>?/g, '')
    .replace(/<t:\d+(?::[a-zA-Z])?>/g, '')
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/\|\|(.+?)\|\|/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,:;!?]|$)/g, '$1$2')
    .replace(/(^|[\s(])_(?!\s)(.+?)_(?=[\s).,:;!?]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A body's text as sections, in order. Code fences are left out; empty sections are dropped. */
export function bodySections(text: string): BodySection[] {
  const out: BodySection[] = [];
  let cur: BodySection = { title: null, note: null, blocks: [] };
  let inFence = false;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) cur.blocks.push({ k: 'p', s: para.join(' ') });
    para = [];
  };
  const flush = () => {
    flushPara();
    if (cur.title || cur.note || cur.blocks.length) out.push(cur);
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE_RE.test(raw)) {
      inFence = !inFence;
      flushPara();
      continue;
    }
    if (inFence) continue;
    if (!raw.trim() || BREAK_RE.test(raw)) {
      flushPara();
      continue;
    }
    const h = HEADING_RE.exec(raw);
    if (h) {
      const title = plainLine(h[1]);
      if (!title) continue;
      flush();
      cur = { title, note: null, blocks: [] };
      continue;
    }
    const sub = SUBTEXT_RE.exec(raw);
    if (sub) {
      flushPara();
      const s = plainLine(sub[1]);
      if (s) cur.note = cur.note ? `${cur.note}, ${s}` : s;
      continue;
    }
    const img = IMAGE_RE.exec(raw);
    if (img) {
      flushPara();
      cur.blocks.push({ k: 'img', alt: plainLine(img[1]) });
      continue;
    }
    const line = raw.trim().replace(/^<|>$/g, '');
    if (!line.includes(' ') && parseYouTube(line)) {
      flushPara();
      cur.blocks.push({ k: 'video' });
      continue;
    }
    const b = BULLET_RE.exec(raw);
    const n = b ? null : NUMBER_RE.exec(raw);
    const q = b || n ? null : QUOTE_RE.exec(raw);
    const s = plainLine(b ? b[1] : n ? n[2] : q ? q[1] : raw);
    if (!s) continue;
    if (b) {
      flushPara();
      cur.blocks.push({ k: 'li', s });
    } else if (n) {
      flushPara();
      cur.blocks.push({ k: 'step', n: Number(n[1]), s });
    } else para.push(s);
  }
  flush();
  return out;
}

/** The sections a reader at `tier` sees: the shared text and that level's, in the body's order. */
export function sectionsForTier(body: string, tier: TierKey | null): BodySection[] {
  const text = splitSegments(body)
    .filter((x) => x.kind === 'text' && (x.tier === null || x.tier === tier))
    .map((x) => x.text)
    .join('\n\n');
  return bodySections(text);
}

/** The levels the body's text is written for (its ::: markers), in order. */
export function textTiers(body: string): TierKey[] {
  const seen = new Set<TierKey>();
  for (const x of splitSegments(body)) if (x.kind === 'text' && x.tier) seen.add(x.tier);
  return (['beginner', 'intermediate', 'advanced'] as TierKey[]).filter((t) => seen.has(t));
}
