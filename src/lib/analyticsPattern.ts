// Turning a URL into something safe to count.
//
// PURE — no `@/db` — because both halves of the page-view path run it: the browser derives the
// pattern before sending, and the collector runs `scrubPattern` again on whatever arrived, since a
// beacon is a request anybody can forge.
//
// THE RULE: what is stored is the ROUTE (`/c/[clan]/members/[rsn]`), never the URL. A raw path names
// people — an RSN, a profile, an event id that says which clan someone was looking at — and a table of
// those is a browsing history we have no business keeping. The route is also the more useful number:
// "the member profile was opened 4,000 times" is a feature signal, "Zezima's profile was opened 3
// times" is not.

/** Matches the `/c/<slug>` prefix the proxy matches on (middleware.ts). */
const CLAN_PREFIX = /^\/c\/([a-z0-9-]{2,32})(?=\/|$)/;

const MAX_PATTERN = 200;

/** The clan slug a browser path names, if any. Used only as a lookup key, never stored. */
export function clanSlugOf(pathname: string): string | null {
  return CLAN_PREFIX.exec(pathname)?.[1] ?? null;
}

/**
 * The route pattern for a browser path, given the route params Next resolved for it.
 *
 * Next has no public "which route is this" hook, but `useParams()` hands back exactly the dynamic
 * segments' values, so every path segment equal to one of them is put back as its `[name]`. The clan
 * prefix is NOT a param — the proxy rewrites `/c/<slug>/…` onto the plain route — so it is folded to
 * `/c/[clan]` here.
 *
 * Whatever is left over goes through `scrubPattern`, so a param the map missed still cannot leak an
 * id.
 */
export function routePattern(
  pathname: string,
  params: Record<string, string | string[] | undefined> | null | undefined,
): string {
  const path = (pathname || '/').split(/[?#]/)[0];
  const segments = path.split('/').filter(Boolean);
  const out: string[] = [];
  let i = 0;
  if (segments[0] === 'c' && segments[1] && CLAN_PREFIX.test(`/c/${segments[1]}`)) {
    out.push('c', '[clan]');
    i = 2;
  }

  const single = new Map<string, string>();
  const catchAll: { name: string; values: string[] }[] = [];
  for (const [name, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      if (value.length > 0) catchAll.push({ name, values: value.map(safeDecode) });
    } else if (typeof value === 'string' && value) {
      single.set(safeDecode(value), name);
    }
  }

  outer: for (; i < segments.length; i++) {
    const seg = safeDecode(segments[i]);
    for (const { name, values } of catchAll) {
      const run = segments.slice(i, i + values.length).map(safeDecode);
      if (run.length === values.length && run.every((v, k) => v === values[k])) {
        out.push(`[...${name}]`);
        i += values.length - 1;
        continue outer;
      }
    }
    const name = single.get(seg);
    out.push(name ? `[${name}]` : segments[i]);
  }
  return scrubPattern(`/${out.join('/')}`) ?? '/';
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Make a pattern safe to store, or null when it is not a pattern at all.
 *
 * The collector runs this on input it cannot trust: a static segment can only be lower-case words, so
 * anything with a digit, an upper-case letter or a space is a value somebody typed or an id, and is
 * replaced rather than kept. A literal route like `/staff/errors` survives untouched; `/members/Zezima`
 * becomes `/members/[value]`.
 */
export function scrubPattern(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const path = raw.split(/[?#]/)[0];
  if (!path.startsWith('/') || path.length > MAX_PATTERN * 2) return null;
  const parts = path.split('/').filter(Boolean).map((seg) => {
    if (/^\[(?:\.\.\.)?[A-Za-z][A-Za-z0-9_]*\]$/.test(seg)) return seg;
    if (/^\d+$/.test(seg)) return '[id]';
    if (/^[a-z][a-z-]*$/.test(seg) && seg.length <= 40) return seg;
    return '[value]';
  });
  const out = `/${parts.join('/')}`;
  return out.length > MAX_PATTERN ? out.slice(0, MAX_PATTERN) : out;
}

/**
 * Crawlers, link unfurlers and headless browsers. They are not visitors, and Discord's unfurler alone
 * fetches every link pasted into every clan's server.
 */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return /bot|crawl|spider|slurp|preview|unfurl|embed|facebookexternalhit|headless|lighthouse|python-requests|curl|wget|httpclient|java\//i.test(
    ua,
  );
}

/** A tab's random session id: what the browser mints, and all the collector will accept. */
export function isSessionId(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(raw);
}

export type AnalyticsProps = Record<string, string | number | boolean | null>;

/**
 * Bound a props object: at most 12 keys, short keys, primitive values, strings capped. Props are for
 * counts and flags ("rows: 49", "format: classic"), and this is what keeps them that way however a
 * caller is written.
 */
export function boundProps(props: Record<string, unknown> | null | undefined): AnalyticsProps | null {
  if (!props) return null;
  const out: AnalyticsProps = {};
  let n = 0;
  for (const [key, value] of Object.entries(props)) {
    if (n >= 12) break;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key)) continue;
    if (value === null || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === 'string') out[key] = value.slice(0, 64);
    else continue;
    n++;
  }
  return n > 0 ? out : null;
}
