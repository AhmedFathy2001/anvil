// Structured data — the half of SEO that a title tag cannot do.
//
// A crawler reading a clan page sees a heading and some numbers and has to guess what kind of thing
// it is looking at. These say it outright: this is an organisation, this is an event with these
// dates, this page sits under that one. That is what a rich result is built from — an event with a
// date on it can appear in search as an event rather than as a blue link, and a breadcrumb trail
// replaces the raw URL under the title.
//
// PURE — no `@/db`. Builders take plain values, so the pages that already loaded a clan or an event
// pass what they have rather than this module fetching anything of its own.
//
// EVERY VALUE HERE IS ALREADY PUBLIC. These blocks are emitted only on pages a stranger may read
// (lib/clanListing decides that), and they carry nothing the page does not already show. Structured
// data is machine-readable, not private: putting something here that is not on the page is both a
// guidelines violation and a leak.

import { parseStamp } from '@/lib/dbTime';
import { SITE_NAME, absoluteUrl } from '@/lib/seo';

/**
 * A stored timestamp as strict ISO-8601, or null.
 *
 * These columns hold two formats — Postgres' space-separated form and JS's ISO form, in the same
 * column (see lib/dbTime) — and schema.org accepts only the second. A date field is the one thing a
 * search engine renders verbatim from this markup, so a half-parsed one is worse than an absent one.
 */
function isoOrNull(value: string | null | undefined): string | null {
  const ms = parseStamp(value);
  return ms == null ? null : new Date(ms).toISOString();
}

/** A JSON-LD block. `<script>` with a JSON string is the only supported way to ship this. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own database rows, never from a URL or a form field, and
      // JSON.stringify escapes what it contains. `</script>` inside a string value would still end
      // the tag early, so the one sequence that can do that is neutralised.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

/** The platform itself. Emitted once, on the apex home. */
export function websiteLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description:
      'Competitive events for Old School RuneScape clans — bingo boards, Skill and Boss of the Week, and a cross-clan leaderboard.',
  };
}

/**
 * A clan, as an organisation.
 *
 * `Organization` rather than `SportsTeam`: the latter expects a sport, a league and a season, and
 * inventing those to satisfy a vocabulary produces markup that describes something that does not
 * exist. A clan is a group of people with a name and a members count, which is what this says.
 */
export function clanLd(opts: {
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  discordInvite: string | null;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: opts.name,
    url: absoluteUrl(`/c/${opts.slug}`),
    description: opts.description,
    ...(opts.memberCount > 0
      ? { numberOfEmployees: { '@type': 'QuantitativeValue', value: opts.memberCount, unitText: 'members' } }
      : {}),
    // The clan's own Discord, when it publishes one — the only off-site identity a clan here has.
    ...(opts.discordInvite ? { sameAs: [opts.discordInvite] } : {}),
    parentOrganization: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
  };
}

/**
 * A board or competition, as an event.
 *
 * Online and free, both stated rather than left to be inferred — a search result that says "online"
 * is the difference between a clan in another timezone clicking and not. `endDate` is optional
 * because a rolling ladder genuinely has none, and a fabricated one would be wrong on the one field
 * a search engine renders.
 */
export function eventLd(opts: {
  name: string;
  url: string;
  /** Raw stored values — the two formats are normalised here, not by the caller. */
  startDate: string | null;
  endDate: string | null;
  clanName: string;
  clanSlug: string;
}): object {
  const startDate = isoOrNull(opts.startDate);
  const endDate = isoOrNull(opts.endDate);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: opts.name,
    url: absoluteUrl(opts.url),
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    // There is no "finished" status in the vocabulary and inventing one would be wrong: a board that
    // has ended is simply an event whose endDate has passed, which the date already says.
    eventStatus: 'https://schema.org/EventScheduled',
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    location: {
      '@type': 'VirtualLocation',
      name: 'Old School RuneScape',
      url: absoluteUrl(opts.url),
    },
    organizer: {
      '@type': 'Organization',
      name: opts.clanName,
      url: absoluteUrl(`/c/${opts.clanSlug}`),
    },
    isAccessibleForFree: true,
  };
}

/**
 * The trail above a page.
 *
 * Replaces the raw URL under a search result with "The AFK Spot › Events › Summer Bingo", which is
 * both more readable and the only place a clan's name appears in a result for one of its boards.
 */
export function breadcrumbLd(trail: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

/**
 * The leaderboard, as a ranked list.
 *
 * The apex's one genuinely competitive artefact, and the only page here whose whole content is an
 * ordering. Saying so is what lets it be read as a ranking rather than as a table of links.
 */
export function leaderboardLd(rows: { name: string; slug: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Old School RuneScape clans ranked by weekly experience',
    numberOfItems: rows.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: rows.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.name,
      url: absoluteUrl(`/c/${r.slug}`),
    })),
  };
}
