import React from 'react';

/**
 * A guide's Discord markdown, rendered for the site.
 *
 * SAFE BY CONSTRUCTION, the same way lib/markdown is: the output is React elements, never an HTML
 * string, so no input becomes markup. Links and images are an allowlist of schemes (http/https, and
 * site-relative paths for images we host).
 *
 * THE DIALECT IS DISCORD'S, and a bigger slice of it than the house-rules renderer needs — a guide is
 * long-form, with images and sections:
 *
 *   # ## ###  headings           -# subtext           > quote   >>> quote-the-rest
 *   - * bullets (indent to nest)  1. numbered          ```lang code fences```
 *   **bold** *italic* _italic_ __underline__ ~~strike~~ ||spoiler|| `code`
 *   [masked](https://link)  <https://link>  https://bare   <t:1700000000:R>  <:emoji:123>
 *   ![alt](image-url) on its own line                  --- on its own line = next Discord message
 *
 * Discord keeps single newlines, so a paragraph's lines stay lines here too.
 */

const SAFE_LINK = /^https?:\/\//i;
const FENCE_RE = /^\s*```(.*)$/;
const IMAGE_LINE_RE = /^\s*!\[([^\]]*)\]\(\s*<?([^\s>)]+)>?(?:\s+"[^"]*")?\s*\)\s*$/;
const BREAK_RE = /^\s*---\s*$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const SUBTEXT_RE = /^-#\s+(.+)$/;
const BULLET_RE = /^(\s*)[-*•]\s+(.*)$/;
const NUMBER_RE = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;

export function safeImageSrc(raw: string): string | null {
  const url = raw.trim();
  if (SAFE_LINK.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return null;
}

/** Same slug rule for heading anchors everywhere (the TOC reads it too). */
export function headingId(text: string): string {
  return (
    text
      .replace(/[*_~`|]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  );
}

// ── Inline ──────────────────────────────────────────────────────────────────────────────────

// Order matters: code first (its contents are literal), then links/tokens, then the delimiters with
// two-character forms before one-character ones so `**x**` is never read as italic.
const INLINE_RE = new RegExp(
  [
    '`[^`\\n]+`',
    '\\[[^\\]\\n]+\\]\\(\\s*<?https?:\\/\\/[^\\s>)]+>?\\s*\\)',
    '<https?:\\/\\/[^\\s>]+>',
    '<t:-?\\d{1,13}(?::[tTdDfFR])?>',
    '<a?:[A-Za-z0-9_]{2,32}:\\d{5,25}>',
    '<(?:@[!&]?|#)\\d{5,25}>',
    'https?:\\/\\/[^\\s<>()]+[^\\s<>().,;:!?\'"]',
    '\\|\\|[^|\\n](?:[^|\\n]|\\|(?!\\|))*\\|\\|',
    '\\*\\*[^\\s*](?:[^*\\n]*[^\\s*])?\\*\\*',
    '__[^\\s_](?:[^_\\n]*[^\\s_])?__',
    '~~[^\\s~](?:[^~\\n]*[^\\s~])?~~',
    '\\*[^\\s*](?:[^*\\n]*[^\\s*])?\\*',
    '\\b_[^\\s_](?:[^_\\n]*[^\\s_])?_\\b',
  ].join('|'),
  'g',
);

function formatTimestamp(secs: number, style: string): string {
  const d = new Date(secs * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  if (style === 't' || style === 'T') return `${time} UTC`;
  if (style === 'd' || style === 'D') return date;
  return `${date}, ${time} UTC`;
}

export function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  const re = new RegExp(INLINE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;
    out.push(renderToken(tok, key));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderToken(tok: string, key: string): React.ReactNode {
  if (tok.startsWith('`')) {
    return (
      <code key={key} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.9em] text-amber-100">
        {tok.slice(1, -1)}
      </code>
    );
  }
  if (tok.startsWith('[')) {
    const mm = /^\[([^\]]+)\]\(\s*<?([^\s>)]+)>?\s*\)$/.exec(tok);
    if (mm && SAFE_LINK.test(mm[2])) {
      return (
        <a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer nofollow" className="text-sky-300 hover:underline">
          {renderInline(mm[1], key)}
        </a>
      );
    }
    return tok;
  }
  if (tok.startsWith('<t:')) {
    const mm = /^<t:(-?\d+)(?::(\w))?>$/.exec(tok);
    const label = mm ? formatTimestamp(Number(mm[1]), mm[2] ?? 'f') : '';
    return label ? (
      <span key={key} className="rounded bg-white/10 px-1">
        {label}
      </span>
    ) : (
      tok
    );
  }
  if (/^<a?:/.test(tok)) {
    const mm = /^<(a?):([A-Za-z0-9_]+):(\d+)>$/.exec(tok);
    if (!mm) return tok;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={key}
        src={`https://cdn.discordapp.com/emojis/${mm[3]}.${mm[1] ? 'gif' : 'webp'}?size=48`}
        alt={`:${mm[2]}:`}
        title={`:${mm[2]}:`}
        className="inline-block h-[1.25em] w-auto align-[-0.2em]"
        loading="lazy"
      />
    );
  }
  if (/^<(@|#)/.test(tok)) {
    const label = tok.startsWith('<#') ? '#channel' : tok.startsWith('<@&') ? '@role' : '@member';
    return (
      <span key={key} className="rounded bg-indigo-500/20 px-1 text-indigo-200">
        {label}
      </span>
    );
  }
  if (tok.startsWith('<http')) {
    const url = tok.slice(1, -1);
    return (
      <a key={key} href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-sky-300 hover:underline">
        {url}
      </a>
    );
  }
  if (/^https?:/i.test(tok)) {
    return (
      <a key={key} href={tok} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sky-300 hover:underline">
        {tok}
      </a>
    );
  }
  if (tok.startsWith('||')) {
    return (
      <span key={key} tabIndex={0} className="guide-spoiler" title="Spoiler">
        {renderInline(tok.slice(2, -2), key)}
      </span>
    );
  }
  if (tok.startsWith('**')) return <strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>;
  if (tok.startsWith('__')) return <u key={key}>{renderInline(tok.slice(2, -2), key)}</u>;
  if (tok.startsWith('~~')) return <s key={key}>{renderInline(tok.slice(2, -2), key)}</s>;
  if (tok.startsWith('*') || tok.startsWith('_')) return <em key={key}>{renderInline(tok.slice(1, -1), key)}</em>;
  return tok;
}

/** Lines of one paragraph, joined with <br/> the way Discord shows them. */
function lines(ls: string[], key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  ls.forEach((l, i) => {
    if (i > 0) out.push(<br key={`${key}-br${i}`} />);
    out.push(...renderInline(l, `${key}-${i}`));
  });
  return out;
}

// ── Blocks ──────────────────────────────────────────────────────────────────────────────────

export interface GuideHeading {
  level: 1 | 2 | 3;
  text: string;
  id: string;
}

type ListItem = { depth: number; text: string };

function renderList(items: ListItem[], ordered: boolean, start: number, key: string): React.ReactNode {
  // Two levels, like Discord: anything indented under an item nests one deep.
  const top: { text: string; children: string[] }[] = [];
  for (const it of items) {
    if (it.depth > 0 && top.length) top[top.length - 1].children.push(it.text);
    else top.push({ text: it.text, children: [] });
  }
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag
      key={key}
      start={ordered ? start : undefined}
      className={`my-2 space-y-1 pl-6 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-gold/70`}
    >
      {top.map((it, i) => (
        <li key={`${key}-${i}`}>
          {renderInline(it.text, `${key}-${i}`)}
          {it.children.length > 0 && (
            <ul className="mt-1 list-[circle] space-y-1 pl-5">
              {it.children.map((c, j) => (
                <li key={`${key}-${i}-${j}`}>{renderInline(c, `${key}-${i}-${j}`)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </Tag>
  );
}

export interface GuideRenderOptions {
  /** Render `---` as a visible message divider (the editor preview) instead of a quiet gap. */
  showBreaks?: boolean;
  /** 'discord' draws headings/quotes the way the Discord client does, for the editor's preview. */
  theme?: 'site' | 'discord';
}

const THEMES = {
  site: {
    h1: 'mt-6 mb-2 text-2xl font-bold text-gold',
    h2: 'mt-6 mb-2 flex items-center gap-2 text-xl font-bold text-gray-100',
    h3: 'mt-4 mb-1 text-base font-bold text-gray-100',
    bar: true,
    sub: 'my-1 text-xs text-text-muted',
    quote: 'my-3 border-l-4 border-gold/50 pl-3 text-gray-200',
  },
  discord: {
    h1: 'mt-2 mb-1 text-[1.5rem] font-bold leading-tight text-[#f2f3f5]',
    h2: 'mt-2 mb-1 text-[1.25rem] font-bold leading-tight text-[#f2f3f5]',
    h3: 'mt-2 mb-1 text-[1rem] font-bold leading-tight text-[#f2f3f5]',
    bar: false,
    sub: 'text-[0.75rem] text-[#949ba4]',
    quote: 'my-1 border-l-4 border-[#4e5058] pl-3',
  },
} as const;

/** The headings, for a table of contents. Same ids the renderer puts on them. */
export function guideHeadings(source: string): GuideHeading[] {
  const out: GuideHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    if (inFence || line.startsWith('>')) continue;
    const h = HEADING_RE.exec(line.trim());
    if (!h) continue;
    const text = h[2].trim();
    const base = headingId(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ level: h[1].length as 1 | 2 | 3, text: text.replace(/[*_~`|]/g, ''), id: n ? `${base}-${n}` : base });
  }
  return out;
}

export function renderGuide(source: string | null | undefined, opts: GuideRenderOptions = {}): React.ReactNode {
  if (!source) return null;
  const theme = THEMES[opts.theme ?? 'site'];
  const src = source.replace(/\r\n?/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  const headingIds = guideHeadings(source);
  let headingIdx = 0;
  let k = 0;
  let para: string[] = [];
  let list: { ordered: boolean; start: number; items: ListItem[] } | null = null;
  let quote: string[] | null = null;
  let images: { alt: string; src: string }[] = [];

  const flushPara = () => {
    if (para.length) {
      const key = `p${k++}`;
      out.push(
        <p key={key} className="my-2 leading-relaxed">
          {lines(para, key)}
        </p>,
      );
    }
    para = [];
  };
  const flushList = () => {
    if (list) out.push(renderList(list.items, list.ordered, list.start, `l${k++}`));
    list = null;
  };
  const flushQuote = () => {
    if (quote) {
      const key = `q${k++}`;
      // A quote may hold its own formatting and lists — render it as a small guide of its own.
      out.push(
        <blockquote key={key} className={theme.quote}>
          {renderGuide(quote.join('\n'), { theme: opts.theme })}
        </blockquote>,
      );
    }
    quote = null;
  };
  const flushImages = () => {
    if (!images.length) return;
    const key = `i${k++}`;
    const imgs = images;
    out.push(
      <div key={key} className={`my-3 grid gap-2 ${imgs.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {imgs.map((im, i) => (
          <a key={`${key}-${i}`} href={im.src} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={im.src}
              alt={im.alt}
              loading="lazy"
              className="max-h-[520px] w-auto max-w-full rounded-lg border border-card-border bg-black/30"
            />
          </a>
        ))}
      </div>,
    );
    images = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
    flushImages();
  };

  for (let i = 0; i < src.length; i++) {
    const raw = src[i];
    const line = raw.trimEnd();

    // Code fence: everything to the closing fence is literal.
    const fence = FENCE_RE.exec(line);
    if (fence) {
      flushAll();
      const body: string[] = [];
      i++;
      while (i < src.length && !FENCE_RE.test(src[i])) body.push(src[i++]);
      out.push(
        <pre key={`c${k++}`} className="my-3 overflow-x-auto rounded-lg border border-card-border bg-black/40 p-3 text-[13px] leading-snug">
          <code className="font-mono text-gray-200">{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // `>>> ` quotes everything that follows in this message section.
    if (/^>>>\s?/.test(line)) {
      flushAll();
      const rest = [line.replace(/^>>>\s?/, '')];
      while (i + 1 < src.length && !BREAK_RE.test(src[i + 1])) rest.push(src[++i]);
      quote = rest;
      flushQuote();
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      flushImages();
      (quote ??= []).push(line.replace(/^>\s?/, ''));
      continue;
    }
    if (quote) flushQuote();

    if (BREAK_RE.test(line)) {
      flushAll();
      out.push(
        opts.showBreaks ? (
          <div key={`b${k++}`} className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-gold/60">
            <span className="h-px flex-1 bg-gold/25" />
            new message
            <span className="h-px flex-1 bg-gold/25" />
          </div>
        ) : (
          <div key={`b${k++}`} className="my-5" aria-hidden />
        ),
      );
      continue;
    }

    const img = IMAGE_LINE_RE.exec(line);
    if (img) {
      flushPara();
      flushList();
      const src2 = safeImageSrc(img[2]);
      if (src2) images.push({ alt: img[1], src: src2 });
      continue;
    }
    if (images.length && line.trim()) flushImages();

    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }

    const h = HEADING_RE.exec(line.trim());
    if (h) {
      flushAll();
      const level = h[1].length;
      const id = headingIds[headingIdx++]?.id ?? headingId(h[2]);
      const cls = level === 1 ? theme.h1 : level === 2 ? theme.h2 : theme.h3;
      const Tag = (`h${level + 1}` as 'h2' | 'h3' | 'h4');
      out.push(
        <Tag key={`h${k++}`} id={id} className={`${cls} scroll-mt-24`}>
          {level === 2 && theme.bar && <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />}
          <span>{renderInline(h[2].trim(), `h${k}`)}</span>
        </Tag>,
      );
      continue;
    }

    const sub = SUBTEXT_RE.exec(line.trim());
    if (sub) {
      flushAll();
      out.push(
        <p key={`s${k++}`} className={theme.sub}>
          {renderInline(sub[1], `s${k}`)}
        </p>,
      );
      continue;
    }

    const b = BULLET_RE.exec(line);
    const n = b ? null : NUMBER_RE.exec(line);
    if (b || n) {
      flushPara();
      const ordered = !!n;
      const depth = ((b ? b[1] : n![1]) ?? '').length >= 2 ? 1 : 0;
      const text = b ? b[2] : n![3];
      if (!list || (list.ordered !== ordered && depth === 0)) {
        flushList();
        list = { ordered, start: n ? Number(n[2]) : 1, items: [] };
      }
      list.items.push({ depth, text });
      continue;
    }

    // A non-list line straight after a list item continues it (Discord wraps it under the bullet).
    if (list && /^\s{2,}\S/.test(raw)) {
      const items: ListItem[] = list.items;
      items[items.length - 1].text += ` ${line.trim()}`;
      continue;
    }
    flushList();
    para.push(line);
  }
  flushAll();
  return <>{out}</>;
}
