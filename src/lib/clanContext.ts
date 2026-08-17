import { cache } from 'react';
import { headers } from 'next/headers';
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
 * The clan for the current request, or a thrown error.
 *
 * For everything that cannot meaningfully proceed without one — which is most writes. Callers that
 * legitimately work clanless (the directory, a global profile, /staff) use `currentClan` and handle
 * the null instead of reaching for this.
 */
export async function requireClan(): Promise<ClanContext> {
  const clan = await currentClan();
  if (!clan) throw new Error('No clan for this host');
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
