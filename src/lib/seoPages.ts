// Metadata for a page inside a clan.
//
// WHOSE PAGE IS THIS? That is the whole question, and the answer changes the shape of everything.
// The root layout gave every page in every clan one title — "The AFK Spot — Anvil" — and one
// description, "Bingos, competitions and the roster for The AFK Spot." So a clan's roster, its
// competitions, its Skill of the Week and its coffer were four pages that described themselves
// identically, which is a duplicate-content signal and, more simply, four search results a person
// cannot tell apart.
//
// ON A CLAN PAGE THE CLAN IS THE BRAND, not the platform. "Members — The AFK Spot" is what someone
// scanning tabs or search results is looking for; "The AFK Spot — Anvil" buries the useful half and
// spends the rest naming software they have not heard of. The apex keeps the platform title,
// because there the page really is the platform's.

import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { clanPrefix, currentClan } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { canonicalPathFor, socialMetadata } from '@/lib/seo';

/**
 * Title, description, canonical and card for one section of one clan.
 *
 * `section` is the human name of the sub-page ("Members", "Competitions") and leads the title.
 * Omit it for the clan's own home, where the clan's name leads instead.
 *
 * Falls back to an empty object off-clan rather than inventing a title — on the apex the layout's
 * platform metadata is already the right answer, and returning nothing is how a page says so.
 */
export async function clanSectionMetadata(opts: {
  section?: string | null;
  /** Overrides the derived title entirely, for a page named after its content (an event, a member). */
  title?: string;
  description: string;
  /** Defaults to the clan's own card. */
  image?: string;
  /** The inner path, when it is not the one being rendered (a nested route naming its parent). */
  pathname?: string;
  noIndex?: boolean;
}): Promise<Metadata> {
  const clan = await currentClan();
  if (!clan) return {};

  const [prefix, h, name] = await Promise.all([
    clanPrefix(),
    headers(),
    getClanDisplayName(clan.id, clan.name),
  ]);
  const clanName = name || clan.name;
  const pathname = opts.pathname ?? h.get('x-anvil-pathname') ?? '/';

  return socialMetadata({
    // The clan home says what KIND of thing it is, because the clan's name alone does not: "The AFK
    // Spot" in a list of search results could be anything, and the two words that make it findable
    // by somebody looking for a clan are the two the name will never contain. Sub-pages need no
    // qualifier — "Members — The AFK Spot" is already unambiguous once you are reading it.
    title: opts.title ?? (opts.section ? `${opts.section} — ${clanName}` : `${clanName} — OSRS Clan`),
    description: opts.description,
    canonical: canonicalPathFor({ prefix, pathname, clanSlug: clan.slug }),
    image: opts.image ?? `/api/og/clan/${clan.slug}`,
    noIndex: opts.noIndex,
  });
}

/**
 * The breadcrumb trail above a clan sub-page, as plain values for lib/jsonLd.
 *
 * Always rooted at the clan rather than at the platform: a person arriving from search wants to know
 * which clan this is, and "Anvil › The AFK Spot › Events" spends the first and most-read position on
 * the one word that does not help them.
 */
export function clanTrail(
  clan: { slug: string; name: string },
  rest: { name: string; path: string }[] = [],
): { name: string; path: string }[] {
  return [{ name: clan.name, path: `/c/${clan.slug}` }, ...rest];
}
