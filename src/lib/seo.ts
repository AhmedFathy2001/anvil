// Absolute URLs, canonicals and the shared social-card vocabulary.
//
// PURE — no `@/db` — so it can be imported by a metadata builder, a sitemap, an OG route and a test
// alike. It leans on `lib/apexHost`, which was split out of `lib/clanContext` for exactly this.
//
// THE ONE RULE: every absolute URL this file produces is built from the APEX, never from the request's
// Host. That is not a style preference, it is what makes a canonical worth emitting. A clan is
// reachable at three addresses — `/c/<slug>` on the apex (canonical), `<slug>.anvilosrs.com` (the
// legacy per-clan host every installed plugin still has), and a custom domain — and middleware already
// 301s the second of those to the first for page requests. Pointing rel=canonical at whatever host
// answered would re-create the duplicate the redirect exists to collapse.

import type { Metadata } from 'next';

import { apexDomain, originForHost } from '@/lib/apexHost';

export const SITE_NAME = 'Anvil';

/** The one-line pitch, used wherever a page has nothing more specific to say about itself. */
export const DEFAULT_DESCRIPTION =
  "Where your clan's bingos, SotW/BotW, and roster all come together. Built for Old School RuneScape clans.";

/** `https://anvilosrs.com` — or `http://localhost` in development, per `originForHost`. */
export function apexOrigin(): string {
  return originForHost(apexDomain());
}

/** An apex-absolute URL for a site-root path. `/clans` → `https://anvilosrs.com/clans`. */
export function absoluteUrl(path: string): string {
  return `${apexOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** A clan's canonical PATH. `/c/theafkspot/events/5`. The address every link should carry. */
export function clanCanonicalPath(slug: string, inner = '/'): string {
  const rest = !inner || inner === '/' ? '' : inner.startsWith('/') ? inner : `/${inner}`;
  return `/c/${slug}${rest}`;
}

/**
 * The canonical path for the request being rendered.
 *
 * `prefix` is what middleware resolved (`/c/<slug>`, or '' on the apex and on a legacy clan host);
 * `pathname` is the INNER path the framework routed, which is the same value in both addressing
 * schemes. Joining them here is what lets a page rendered on `theafkspot.anvilosrs.com/events/5`
 * declare itself as `anvilosrs.com/c/theafkspot/events/5` — the address it will be redirected to
 * anyway, and the only one that should ever be indexed.
 *
 * A clan-hosted request has a clan but NO prefix, so the caller passes the clan's slug as a
 * fallback; without it the canonical would silently drop the clan and claim to be an apex page.
 */
export function canonicalPathFor(opts: {
  prefix: string;
  pathname: string;
  clanSlug?: string | null;
}): string {
  const inner = opts.pathname || '/';
  if (opts.prefix) return `${opts.prefix}${inner === '/' ? '' : inner}`;
  if (opts.clanSlug) return clanCanonicalPath(opts.clanSlug, inner);
  return inner;
}

/**
 * Paths a crawler has no business in, checked against the INNER path so the answer is the same
 * under a clan prefix as without one.
 *
 * Two different kinds of harm, both real. The gated surfaces (`/admin`, `/team`, `/captain`) bounce
 * to /login, so every crawl of them spends budget to index a login page — dozens of URLs per clan,
 * all identical. The personal ones (`/profile`, `/u`, `/p`) are a named human's game history, which
 * should be reachable by someone who was given the link and not by someone searching for the name.
 */
export const NOINDEX_ROOTS = [
  '/admin',
  '/staff',
  '/team',
  '/captain',
  '/player',
  '/profile',
  '/login',
  '/logout',
  '/link-device',
  '/welcome',
  '/portal',
  '/feedback',
  '/u',
  '/p',
  '/api',
];

export function isNoIndexPath(pathname: string): boolean {
  return NOINDEX_ROOTS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * The whole social block for one page, built once so a page cannot supply half of it.
 *
 * Next merges page metadata over layout metadata FIELD BY FIELD, not deeply: a page that sets
 * `openGraph.title` replaces the layout's entire `openGraph`, silently dropping the site name, the
 * card image and the url along with it. So anything overriding the title has to restate all of it,
 * and restating it by hand at each call site is how three pages end up with three different cards.
 */
export function socialMetadata(opts: {
  title: string;
  description: string;
  /** Site-root path, already carrying any `/c/<slug>` prefix. See `canonicalPathFor`. */
  canonical: string;
  /** Path to the card image. Defaults to the platform's own. */
  image?: string;
  /** Omitted entirely when indexable, which is what tells Next to leave the layout's value alone. */
  noIndex?: boolean;
  /** hreflang map, for a page that exists in several languages. See the guide metadata builder. */
  languages?: Record<string, string>;
}): Metadata {
  const image = opts.image ?? '/api/og/site';
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.canonical, ...(opts.languages ? { languages: opts.languages } : {}) },
    ...(opts.noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      url: opts.canonical,
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description, images: [image] },
  };
}
