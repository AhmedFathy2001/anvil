import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { clans } from '@/db/schema';

// Which clan is this request for?
//
// Resolved from the Host header — but the header is never TRUSTED, only ever used as a lookup key
// against a closed set. That distinction is the whole security argument, and it is worth spelling out
// because lib/request-origin refuses to read Host at all, for good reasons:
//
//   Host-header injection / open redirect happen when a header VALUE flows into a URL the server
//   builds or a decision it makes. Here an attacker-supplied Host either matches a row in `clans` or
//   it does not. If it matches, the attacker named a real clan and got that clan's public site — no
//   more than typing the address. If it does not, resolution returns null and the caller 404s. There
//   is no fallback, no "first clan", no wildcard. And every absolute URL is built from the RESOLVED
//   ROW's stored host, never from the header, so the original property still holds.
//
// The apex host has no clan. It serves the directory, global player profiles and /staff, so a null
// resolution is a legitimate state there, not an error.
//
// Runs as a server-side helper rather than in middleware because middleware is edge and cannot reach
// the database. React's `cache` makes it once-per-request, so the dozens of call sites that need the
// clan share one query.

export interface ClanContext {
  id: number;
  slug: string;
  name: string;
  inGameName: string | null;
  status: string;
  plan: string;
  memberCap: number | null;
  customDomain: string | null;
  /** The clan's canonical host, for building absolute URLs. Custom domain wins when set. */
  host: string;
}

/**
 * The apex domain everything hangs off. A clan lives at `<slug>.<APEX>`; the apex itself is clanless.
 *
 * Env rather than hardcoded so local development and staging resolve too — but note it is only used
 * to STRIP a suffix and recognise the apex, never to decide what a host is allowed to be. That is
 * always the database's answer.
 */
export function apexDomain(): string {
  return (process.env.ANVIL_APEX_DOMAIN || 'anvilosrs.com').toLowerCase();
}

/**
 * Hosts that ARE the apex — the clanless surface serving the directory and platform pages.
 *
 * A list rather than a single value so a preview or staging apex can exist alongside the real one.
 * It is deliberately explicit: an unrecognised host is still nothing, so a spoofed Host gets a 404
 * rather than quietly landing on a real page.
 */
export function apexHosts(): string[] {
  const apex = apexDomain();
  const extra = (process.env.ANVIL_APEX_ALIASES || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [apex, `www.${apex}`, ...extra];
}

export function isApexHost(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost);
  return host != null && apexHosts().includes(host);
}

/** Strip the port and lowercase; hosts are compared case-insensitively and port-blind. */
function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase().split(':')[0];
  return host || null;
}

/**
 * The subdomain label for a host under the apex, or null when the host IS the apex (or unrelated).
 *
 * `www` is treated as the apex, not a clan, so nobody can register a clan that shadows it.
 */
export function slugFromHost(rawHost: string | null | undefined): string | null {
  const host = normalizeHost(rawHost);
  if (!host) return null;
  const apex = apexDomain();
  if (host === apex || host === `www.${apex}`) return null;
  if (!host.endsWith(`.${apex}`)) return null;
  const label = host.slice(0, -(apex.length + 1));
  // Only a single label is a clan address; `a.b.apex` is not clan `a.b`.
  if (!label || label.includes('.') || label === 'www') return null;
  return label;
}

/**
 * Look a host up in the clan table. Null when nothing matches — callers 404 rather than guessing.
 *
 * Matches a full custom domain OR a subdomain label, in one query, so a clan is reachable both ways
 * without the caller needing to know which it is.
 */
export const resolveClanByHost = cache(async (rawHost: string | null | undefined): Promise<ClanContext | null> => {
  const host = normalizeHost(rawHost);
  if (!host) return null;
  const slug = slugFromHost(host);

  const row = await db.query.clans.findFirst({
    where: slug ? or(eq(clans.customDomain, host), eq(clans.slug, slug)) : eq(clans.customDomain, host),
  });
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    inGameName: row.inGameName,
    status: row.status,
    plan: row.plan,
    memberCap: row.memberCap,
    customDomain: row.customDomain,
    host: row.customDomain || `${row.slug}.${apexDomain()}`,
  };
});

/**
 * The clan for the CURRENT request, from its Host header. Null on the apex or an unknown host.
 *
 * For server components and route handlers that don't already hold a Request.
 */
export const currentClan = cache(async (): Promise<ClanContext | null> => {
  const h = await headers();
  return resolveClanByHost(h.get('host'));
});

/**
 * The clan for the current request, or a 404.
 *
 * For everything that cannot meaningfully proceed without one — which is most of the app. Callers
 * that legitimately work clanless (the directory, /staff) use `currentClan` and handle the null.
 *
 * notFound() rather than a thrown Error: a clan page requested on the apex is not a server fault,
 * it is a page that does not exist there. Throwing produced "Something went wrong" with a digest,
 * which is both alarming and wrong — the apex has no /profile because profiles belong to clans.
 */
export async function requireClan(): Promise<ClanContext> {
  const clan = await currentClan();
  if (!clan) notFound();
  return clan;
}

/**
 * The clan for a request you already hold, without going through next/headers.
 *
 * For helpers handed a Request — the plugin auth resolvers, notably. Reading the header off the
 * object in hand is clearer than reaching for ambient request state, and it works in contexts where
 * the async-local store isn't available.
 */
export async function resolveClanFromRequest(request: Request): Promise<ClanContext | null> {
  return resolveClanByHost(request.headers.get('host'));
}

/** As above, but throws when the host names no clan. */
export async function requireClanFromRequest(request: Request): Promise<ClanContext> {
  const clan = await resolveClanFromRequest(request);
  if (!clan) throw new Error('No clan for this host');
  return clan;
}

// ── Apex-hosted login ────────────────────────────────────────────────────────────────────────
//
// One deployment means ONE Discord app with ONE registered redirect URI, so the OAuth round trip
// cannot happen on a clan's own host — Discord rejects every callback that is not the single
// allowlisted one. Login therefore runs on the apex and hands back to the clan afterwards.
//
// That works only because clans are CHILDREN of the apex: a session cookie scoped to the apex domain
// is readable by every clan beneath it, and by nothing else. If clans sat on sibling hosts, the
// nearest shared parent would be the whole registrable domain, and a preview login would set a
// cookie the live clans could read.

/**
 * Domain for the session cookie: the apex, so every clan beneath it can read it.
 *
 * Null for a host with no dot (localhost), where browsers reject a domain attribute and a host-only
 * cookie is what you want anyway.
 */
export function sessionCookieDomain(): string | null {
  const apex = apexDomain();
  if (!apex.includes('.')) return null;
  return `.${apex}`;
}

/** Absolute origin for a host WE resolved. Never built from a raw header. */
export function originForHost(host: string): string {
  const scheme = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${scheme}://${host}`;
}

/**
 * Validate a "send me back here after login" host.
 *
 * Returns the clan's CANONICAL host from its row rather than the string passed in, so what ends up
 * in a redirect is a value the database produced. An unknown host returns null and the caller falls
 * back to the apex. Without this the flow would be an open redirect, since the host arrives as a
 * query parameter.
 */
export async function resolveReturnHost(rawHost: string | null | undefined): Promise<string | null> {
  const clan = await resolveClanByHost(rawHost);
  return clan?.host ?? null;
}
