import React from 'react';
import ClanLink from '@/components/ClanLink';

// Inline markup for translated guide copy.
//
// The guides used to hold their prose directly in JSX, which meant a translation was a fork of the
// page: same layout, same images, same conditionals, duplicated per language and free to drift.
// Instead the pages keep the structure and the string tables keep the words, which only works if a
// translator can still bold a menu name or link a word without writing React. Hence this: four
// markers, chosen so a .ts string stays readable to someone who has never seen the app.
//
//   **bold**            a UI label — a menu item, a button, a field name
//   _emphasis_          ordinary emphasis
//   `code`              something typed or pasted verbatim
//   [label](/href)      a link; internal paths get next/link, anything else opens in a new tab
//   {name}              a value the page supplies (site URL, clan name). Unknown names stay literal,
//                       so a chat line like `{name}` documents itself instead of vanishing.
//
// Markup is parsed before interpolation so `{origin}` inside a code span still renders as code, and
// a value that is itself a node (a Discord invite link) can be dropped into a sentence.

export type Vars = Record<string, React.ReactNode>;

/** One pass, so a marker inside another marker's text is left alone rather than half-parsed. */
const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(_[^_\s][^_]*_)|(\[[^\]]+\]\([^)]+\))/g;

const VAR = /\{(\w+)\}/g;

/** Split a leaf run of text on {placeholders}, leaving unknown ones as written. */
function interpolate(text: string, vars: Vars, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(VAR)) {
    const at = m.index!;
    if (at > last) out.push(text.slice(last, at));
    const value = vars[m[1]];
    out.push(value === undefined ? m[0] : <React.Fragment key={`${keyBase}v${i++}`}>{value}</React.Fragment>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Placeholders inside a link's href.
 *
 * Separate from `interpolate` because an href has to end up a string: the guide links between its
 * own pages, and which page that is depends on the locale ({pluginGuide} → /guide/da/plugin). Only
 * string-valued vars can stand in; anything else leaves the placeholder alone rather than rendering
 * "[object Object]" into a URL.
 */
function interpolateHref(href: string, vars: Vars): string {
  return href.replace(VAR, (whole, name) => {
    const value = vars[name];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : whole;
  });
}

function anchor(href: string, children: React.ReactNode, key: string) {
  const cls = 'text-gold hover:text-gold-light';
  if (href.startsWith('/') || href.startsWith('#')) {
    return (
      <ClanLink key={key} href={href} className={cls}>
        {children}
      </ClanLink>
    );
  }
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  );
}

/**
 * Render one string of guide copy.
 *
 * Returns a fragment so it drops into JSX anywhere a string would have gone.
 */
export function rt(text: string | undefined, vars: Vars = {}): React.ReactNode {
  if (!text) return null;
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;

  for (const m of text.matchAll(TOKEN)) {
    const at = m.index!;
    if (at > last) out.push(...interpolate(text.slice(last, at), vars, `t${i}`));
    const key = `m${i++}`;
    const [raw] = m;

    if (m[1]) {
      out.push(
        <code key={key} className="font-mono text-gold/90 break-words">
          {interpolate(raw.slice(1, -1), vars, key)}
        </code>,
      );
    } else if (m[2]) {
      out.push(
        <span key={key} className="text-foreground font-medium">
          {interpolate(raw.slice(2, -2), vars, key)}
        </span>,
      );
    } else if (m[3]) {
      out.push(<em key={key}>{interpolate(raw.slice(1, -1), vars, key)}</em>);
    } else {
      const split = raw.indexOf('](');
      const label = raw.slice(1, split);
      const href = interpolateHref(raw.slice(split + 2, -1), vars);
      out.push(anchor(href, interpolate(label, vars, key), key));
    }
    last = at + raw.length;
  }

  if (last < text.length) out.push(...interpolate(text.slice(last), vars, `t${i}`));
  return <>{out}</>;
}

/** Every paragraph of a block, each in its own <p>. Blocks are string[] in the dictionaries. */
export function paragraphs(
  lines: readonly string[] | undefined,
  vars: Vars = {},
  className = 'text-text-muted',
): React.ReactNode {
  if (!lines) return null;
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={className}>
          {rt(line, vars)}
        </p>
      ))}
    </>
  );
}

/** Dictionary legend entries → what <Figure> wants. The number is the position, so it can't drift. */
export function legend(
  items: readonly { label: string; body: string }[] | undefined,
  vars: Vars = {},
): { n: number; label: string; body: React.ReactNode }[] {
  return (items ?? []).map((item, i) => ({ n: i + 1, label: item.label, body: rt(item.body, vars) }));
}

/** Dictionary term/body pairs → what <Rows> wants. */
export function rows(
  items: readonly { term: string; body: string }[] | undefined,
  vars: Vars = {},
): { term: React.ReactNode; body: React.ReactNode }[] {
  return (items ?? []).map((r) => ({ term: rt(r.term, vars), body: rt(r.body, vars) }));
}

/** A bullet or numbered list straight from a string[]. */
export function items(lines: readonly string[] | undefined, vars: Vars = {}): React.ReactNode {
  return (lines ?? []).map((line, i) => <li key={i}>{rt(line, vars)}</li>);
}

type ChatTone = 'plain' | 'gold' | 'green' | 'muted';
const TONES: ChatTone[] = ['plain', 'gold', 'green', 'muted'];

/**
 * Dictionary chat lines → what <Chat> wants.
 *
 * Tone is presentation, not language, but it rides along in the dictionary so a translator can see
 * which line is the highlighted one. A locale that mistypes it falls back to plain rather than
 * failing the build.
 */
export function chat(
  lines: readonly { text: string; tone?: string }[] | undefined,
): { text: string; tone: ChatTone }[] {
  return (lines ?? []).map((l) => ({
    text: l.text,
    tone: TONES.includes(l.tone as ChatTone) ? (l.tone as ChatTone) : 'plain',
  }));
}
