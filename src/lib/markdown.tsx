import React from 'react';

/**
 * The small slice of Markdown a clan writes its house rules in — and nothing else.
 *
 * SAFE BY CONSTRUCTION, NOT BY FILTERING. This never builds an HTML string and never reaches for
 * `dangerouslySetInnerHTML`; it parses text into REACT ELEMENTS, and React escapes every text node
 * it renders. So there is no parse an author can write — `<script>`, an `onerror` attribute, a
 * `javascript:` URL, a half-closed tag — that becomes markup, because markup is never the output
 * type. Sanitising a rendered HTML string is the other approach, and it is the one that keeps
 * needing security releases: it has to enumerate everything dangerous, forever, and be right every
 * time. This has to enumerate what is ALLOWED, once.
 *
 * (SQL injection is not the exposure here and never was: every write goes through Drizzle's
 * parameter binding, so the rules text is a value, never part of a statement. The risk with
 * user-authored prose is what happens when it is DISPLAYED, which is what this file is about.)
 *
 * THE SUBSET IS DISCORD'S, on purpose. These rules are written to be posted by the bot, and an
 * author who learns one dialect should not find the site rendering a different one — so this
 * supports what Discord supports and quietly ignores the rest:
 *
 *   **bold**   *italic*   __underline__   ~~strike~~   `code`
 *   - bullets (also * and •)     1. numbered
 *   > quote                      # heading
 *   https://links                blank line = new paragraph
 *
 * Anything unrecognised stays literal text, which is the right failure for a rules document: a
 * player reading a stray asterisk is a cosmetic problem, a swallowed line is a rule nobody saw.
 */

/** Links are rendered as anchors, so the scheme is an allowlist rather than a blocklist. */
const SAFE_SCHEME = /^https?:\/\//i;
const URL_RE = /(https?:\/\/[^\s<>()]+)/g;

/**
 * `**bold**`, `*italic*`, `__underline__`, `~~strike~~`, `` `code` ``.
 *
 * A delimiter may not be followed or preceded by whitespace, which is Discord's own rule and the
 * reason "Bring 3 * 5 sharks, and **do not** die" survives: without it the lone `*` pairs with the
 * first asterisk of `**do not**` and swallows the middle of the sentence. In a rules document a
 * swallowed clause is a rule nobody read, so the parser errs towards leaving text alone.
 *
 * Two-character delimiters come first in the alternation, so `**bold**` is never read as an italic
 * containing an asterisk.
 */
const INLINE_RE =
  /(\*\*[^\s*](?:[^*]*[^\s*])?\*\*|__[^\s_](?:[^_]*[^\s_])?__|~~[^\s~](?:[^~]*[^\s~])?~~|\*[^\s*](?:[^*]*[^\s*])?\*|`[^`]+`)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let k = 0;

  for (const chunk of text.split(INLINE_RE)) {
    if (!chunk) continue;
    const key = `${keyPrefix}-${k++}`;

    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      out.push(<strong key={key}>{renderInline(chunk.slice(2, -2), key)}</strong>);
    } else if (chunk.startsWith('__') && chunk.endsWith('__') && chunk.length > 4) {
      out.push(<u key={key}>{renderInline(chunk.slice(2, -2), key)}</u>);
    } else if (chunk.startsWith('~~') && chunk.endsWith('~~') && chunk.length > 4) {
      out.push(<s key={key}>{renderInline(chunk.slice(2, -2), key)}</s>);
    } else if (chunk.startsWith('*') && chunk.endsWith('*') && chunk.length > 2) {
      out.push(<em key={key}>{renderInline(chunk.slice(1, -1), key)}</em>);
    } else if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
      // Code is LITERAL: no nested parsing, so a backtick span is also the escape hatch for anyone
      // who needs to show an asterisk.
      out.push(
        <code key={key} className="rounded bg-brown-dark px-1 py-0.5 text-[0.9em] text-gold">
          {chunk.slice(1, -1)}
        </code>,
      );
    } else {
      // Plain run — autolink inside it. `rel` is not decoration: without noopener the opened page
      // gets a handle on this one through window.opener.
      let j = 0;
      for (const piece of chunk.split(URL_RE)) {
        if (!piece) continue;
        if (SAFE_SCHEME.test(piece)) {
          out.push(
            <a
              key={`${key}-u${j++}`}
              href={piece}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="text-gold underline underline-offset-2 hover:text-gold-light"
            >
              {piece}
            </a>,
          );
        } else {
          out.push(<React.Fragment key={`${key}-t${j++}`}>{piece}</React.Fragment>);
        }
      }
    }
  }
  return out;
}

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_RE = /^\s*(#{1,3})\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

/**
 * Render house-rules text.
 *
 * Block structure is line-based, like Discord's — no indentation rules, no lazy continuation, no
 * tables. A rules document is a list of short statements, and the more grammar this understands the
 * more ways an author has to be surprised by it.
 */
export function renderMarkdown(source: string | null | undefined): React.ReactNode {
  if (!source?.trim()) return null;

  // Normalise line endings so a ruleset pasted from Windows or Discord splits the same way.
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((t, i) => <li key={i}>{renderInline(t, `li${blocks.length}-${i}`)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="my-2 list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="my-2 list-disc space-y-1 pl-5">{items}</ul>
      ),
    );
    list = null;
  };

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join('\n');
    blocks.push(
      <p key={blocks.length} className="my-2 whitespace-pre-wrap leading-relaxed">
        {renderInline(text, `p${blocks.length}`)}
      </p>,
    );
    para = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushList();
      flushPara();
      const level = heading[1].length;
      const size = level === 1 ? 'text-[17px]' : level === 2 ? 'text-[15.5px]' : 'text-[14.5px]';
      blocks.push(
        <p key={blocks.length} className={`mt-4 mb-1 font-semibold ${size}`}>
          {renderInline(heading[2], `h${blocks.length}`)}
        </p>,
      );
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      flushList();
      flushPara();
      blocks.push(
        <p key={blocks.length} className="my-2 border-l-2 border-gold/40 pl-3 text-text-muted">
          {renderInline(quote[1], `q${blocks.length}`)}
        </p>,
      );
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const numbered = NUMBER_RE.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      // A list that switches kind mid-way is two lists, not one confused one.
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    para.push(line);
  }

  flushList();
  flushPara();

  return <>{blocks}</>;
}
