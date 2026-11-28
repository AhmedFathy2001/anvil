// Text inside a guide piece: plain text, always. PURE.
//
// A piece's words are shown in three places, and each has its own way of being tricked into markup:
//   - the site, as React text (safe by construction, as long as nobody ever feeds it to
//     dangerouslySetInnerHTML or a markdown renderer — pieces are never markdown);
//   - the RuneLite panel, where a Swing JLabel whose text starts with "<html>" renders it as HTML
//     (images, links, layout), and the game's own chat/overlay markup is "<col=ff0000>", "<img=1>";
//   - Discord, which has markdown and mentions (slice 2 escapes those where it posts).
// So on every write: fold look-alike letters, drop control, zero-width and bidi-override characters
// (the "evil.exe‮fdp" spoof), drop anything shaped like a tag until none is left, break any "<"
// that still sits against a letter, cap stacked combining marks, and cap the length. A string that
// comes out of cleanText can be put in a JLabel, a React node or an overlay as it is.

/** C0/C1 controls (but tab/newline, handled apart), zero-width, bidi embeddings/overrides/isolates, BOM. */
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f­؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ﻿￹-￻]/g;
/** Anything a renderer could take for a tag: <html>, </b>, <img=1>, <col=ff0000>, <!-- -->, <?x>. */
const TAG = /<\/?[a-z!?][^<>]*>/gi;
/** A "<" still touching a letter, slash, "!" or "?" after the tags went ("<html" with no ">"). */
const OPEN_ANGLE = /<(?=[a-z/!?])/gi;
/** Stacked combining marks after the first two on a letter ("zalgo"). */
const ZALGO = /(\p{M}{2})\p{M}+/gu;

export interface TextRule {
  /** Longest it may be after cleaning. */
  max: number;
  /** Keep line breaks (a note); otherwise every run of whitespace is one space. */
  multiline?: boolean;
  /** Empty is allowed (defaults to false: a required field). */
  allowEmpty?: boolean;
}

export type TextResult = { ok: true; text: string } | { ok: false; error: string };

/** The cleaning alone, without the length rule: safe to show anywhere. */
export function cleanText(raw: unknown, multiline = false): string {
  let s = typeof raw === 'string' ? raw : '';
  // A hard ceiling before any work, so a megabyte of zalgo can't make the regexes the cost.
  if (s.length > 20_000) s = s.slice(0, 20_000);
  s = s.normalize('NFKC').replace(/\r\n?/g, '\n').replace(INVISIBLE, '');
  for (let prev = ''; prev !== s; ) {
    prev = s;
    s = s.replace(TAG, '');
  }
  s = s.replace(OPEN_ANGLE, '< ');
  s = s.normalize('NFD').replace(ZALGO, '$1').normalize('NFC');
  if (multiline) {
    s = s
      .split('\n')
      .map((l) => l.replace(/[\t ]+/g, ' ').replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } else {
    s = s.replace(/\s+/g, ' ').trim();
  }
  return s;
}

/** Clean, then hold it to the rule. */
export function checkText(raw: unknown, rule: TextRule, what = 'Text'): TextResult {
  if (raw != null && typeof raw !== 'string') return { ok: false, error: `${what} must be text.` };
  const text = cleanText(raw, rule.multiline);
  if (!text && !rule.allowEmpty) return { ok: false, error: `${what} is empty.` };
  if (text.length > rule.max) return { ok: false, error: `${what} is longer than ${rule.max} characters.` };
  return { ok: true, text };
}

/**
 * Render-time belt to the write-time braces: what the plugin UI builder (and anything else that
 * hands piece text to a renderer that knows markup) should pass piece text through. Stored text has
 * been through cleanText already; this keeps a row written by an older or buggy path harmless too.
 */
export function safeText(stored: unknown, multiline = false): string {
  return cleanText(stored, multiline);
}

// ── Links ────────────────────────────────────────────────────────────────────────────────────
//
// A piece may point somewhere, but only at two kinds of place: a page on Anvil (a path, never a URL,
// so it can't leave the site or carry javascript:) or a Plugin Hub plugin by its internal name (the
// address is built here, never taken from the writer).

export type PieceLink = { to: 'anvil'; path: string; label?: string } | { to: 'hub'; plugin: string; label?: string };

/** An Anvil path: "/guide/vorkath", "/c/my-clan/guides?tier=advanced". No scheme, no "//", no "..". */
const ANVIL_PATH = /^\/(?!\/)[a-z0-9\-_/]*(?:\?[a-z0-9\-_=&.]*)?$/i;
/** A Plugin Hub plugin's internal name, as in its hub URL: "inventory-setups", "tick-counter". */
export const HUB_NAME = /^[a-z0-9][a-z0-9-]{1,49}$/;

export function isAnvilPath(p: unknown): p is string {
  return typeof p === 'string' && p.length <= 200 && ANVIL_PATH.test(p) && !p.split(/[/?]/).includes('..');
}

export function hubUrl(plugin: string): string {
  if (!HUB_NAME.test(plugin)) throw new Error('not a hub plugin name');
  return `https://runelite.net/plugin-hub/show/${plugin}`;
}

/** True when a string looks like it carries an address: a scheme, "www.", a domain, an IP, a webhook. */
export function looksLikeUrl(v: string): boolean {
  const s = cleanText(v).toLowerCase();
  return (
    /[a-z][a-z0-9+.-]*:\/\//.test(s) ||
    /\b(?:javascript|data|vbscript|file|mailto)\s*:/.test(s) ||
    /\bwww\./.test(s) ||
    /\/\//.test(s) ||
    /webhook/.test(s) ||
    /\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(s) ||
    /\b[a-z0-9-]{1,63}\.(?:[a-z0-9-]{1,63}\.)*(?:com|net|org|gg|io|co|me|xyz|ru|cc|tv|ly|to|app|site|shop|store|dev|info|biz|uk|de|fr|nl|link|click|top|live|pw|su|ws|cloud|online|tech)\b/.test(s)
  );
}
