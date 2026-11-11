// Looking a tenant up by slug, now that a slug is unique per NAMESPACE rather than globally.
//
// Clans (and friends hosts) live at /c/<slug>, creator spaces at /s/<slug>, and the two may hold the
// same slug (clans_namespace_slug_unique, drizzle/0260). So `eq(clans.slug, x)` alone can match two
// rows; every lookup says which namespace it means, or asks for both and decides.

import { and, eq, ne, sql, type SQL } from 'drizzle-orm';
import { clans } from '@/db/schema';
import type { AddressKind } from '@/lib/clanScopedPaths';

/** The WHERE fragment for one namespace. 'clan' covers every non-space kind (clan, friends). */
export function inNamespace(kind: AddressKind): SQL {
  return kind === 'creator' ? eq(clans.kind, 'creator') : ne(clans.kind, 'creator');
}

/** `slug = x` inside one namespace. */
export function slugIn(slug: string, kind: AddressKind): SQL {
  return and(eq(clans.slug, slug), inNamespace(kind))!;
}

/** The namespace a clans row's kind belongs to. */
export function namespaceOf(kind: string | null | undefined): AddressKind {
  return kind === 'creator' ? 'creator' : 'clan';
}

/**
 * A slug somebody TYPED (a co-host invite, a block, a staff notice), in any of the shapes people
 * paste: `drenvox`, `/c/drenvox`, `/s/drenvox`, or a full `https://…/s/drenvox/events/4` link.
 *
 * `kind` is null when the input did not say — the caller then prefers the clan and falls back to the
 * space, since a bare slug has always meant a clan.
 */
export function parseTypedSlug(raw: string | null | undefined): { slug: string; kind: AddressKind | null } | null {
  let s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;
  try {
    if (/^https?:\/\//.test(s)) s = new URL(s).pathname;
  } catch {
    return null;
  }
  const prefixed = /^\/?([cs])\/([a-z0-9-]{2,32})(?=\/|$)/.exec(s);
  if (prefixed) return { slug: prefixed[2], kind: prefixed[1] === 's' ? 'creator' : 'clan' };
  const bare = /^\/?([a-z0-9-]{2,32})$/.exec(s);
  return bare ? { slug: bare[1], kind: null } : null;
}

/**
 * `slug = x`, in the namespace the caller knows or — when a person typed a bare slug — in both,
 * paired with {@link clanBeforeSpace} so the clan wins when two rows share it.
 */
export function slugWhere(slug: string, kind: AddressKind | null): SQL {
  return kind ? slugIn(slug, kind) : eq(clans.slug, slug);
}

/** ORDER BY that puts a clan ahead of a same-slug space: a bare slug has always meant a clan. */
export const clanBeforeSpace = sql`(${clans.kind} = 'creator')`;
