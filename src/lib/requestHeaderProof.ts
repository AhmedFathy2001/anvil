// ── The headers middleware hands inward, and the proof that middleware set them ─────────────────
//
// Middleware tells the rest of the app two things the route can't work out on its own: which clan a
// `/c/<slug>/…` request is for (it rewrites the prefix away), and which path the person actually asked
// for (layouts don't get the URL). Both travel as request headers, and a client can send any header it
// likes. Middleware strips the caller's copies, but only on requests it RUNS for — and a path its
// matcher skips (`/admin/events/5.png` routes to admin/events/[eventId] and parseInt reads 5) arrived
// with whatever the caller wrote. So no reader may trust these headers bare: each value is HMAC-signed
// by middleware, and the readers below return it only when the proof checks out. A request
// middleware never saw has no valid proof, and reads as "unknown" — which every caller treats as
// the cautious answer.
//
// WebCrypto only and no db import: middleware runs on the edge runtime and imports this module.
//
// The clan proof's message (`anvil-clan-header:<slug>`) and key (ADMIN_SESSION_SECRET) must stay
// byte-for-byte what middleware signed before this module existed. During a blue/green swap the old
// slot's proofs reach the new slot's handlers and vice versa; a changed format would drop every
// clan-prefixed request's clan for the length of the swap. A creator space (`/s/<slug>`) signs
// `anvil-clan-header:creator:<slug>` instead: the kind is inside the proof, because `/c/x` and `/s/x`
// can be two tenants, and a slug cannot contain `:` so the two messages never collide.

import { requireSecret } from '@/lib/env';
import { clanBasePath, type AddressKind } from '@/lib/clanScopedPaths';

export const CLAN_SLUG_HEADER = 'x-anvil-clan-slug';
export const CLAN_PREFIX_HEADER = 'x-anvil-clan-prefix';
export const CLAN_PROOF_HEADER = 'x-anvil-clan-proof';
/** 'creator' for a `/s/<slug>` request; absent (a clan) otherwise. Covered by CLAN_PROOF_HEADER. */
export const CLAN_KIND_HEADER = 'x-anvil-clan-kind';
export const PATHNAME_HEADER = 'x-anvil-pathname';
export const SEARCH_HEADER = 'x-anvil-search';
export const PATH_PROOF_HEADER = 'x-anvil-path-proof';

/** Every header this module owns: middleware deletes each of them off the incoming request. */
export const PATH_HEADERS = [PATHNAME_HEADER, SEARCH_HEADER, PATH_PROOF_HEADER] as const;

// Read at call time, not import time, so tests can set it before the first sign.
function secret(): string {
  return requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret');
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  let out = '';
  for (const b of sig) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Length-guarded constant-time compare. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The proof that middleware set this clan slug (and kind). Domain-separated from session tokens. */
export function clanHeaderProof(slug: string, kind: AddressKind = 'clan'): Promise<string> {
  return hmacHex(kind === 'creator' ? `anvil-clan-header:creator:${slug}` : `anvil-clan-header:${slug}`);
}

/** The proof that middleware set this path + query. The newline keeps the two fields apart. */
export function pathHeaderProof(pathname: string, search: string): Promise<string> {
  return hmacHex(`anvil-path-header:${pathname}\n${search}`);
}

type HeaderBag = { get(name: string): string | null };

/** The tenant middleware put on this request — slug and namespace — or null when none or unproven. */
export async function provenClan(headers: HeaderBag): Promise<{ slug: string; kind: AddressKind } | null> {
  const slug = headers.get(CLAN_SLUG_HEADER);
  const proof = headers.get(CLAN_PROOF_HEADER);
  if (!slug || !proof) return null;
  const kind: AddressKind = headers.get(CLAN_KIND_HEADER) === 'creator' ? 'creator' : 'clan';
  return constantTimeEqual(proof, await clanHeaderProof(slug, kind)) ? { slug, kind } : null;
}

/** The clan slug middleware put on this request, or null when there is none or it is unproven. */
export async function provenClanSlug(headers: HeaderBag): Promise<string | null> {
  return (await provenClan(headers))?.slug ?? null;
}

/**
 * The path (and query) middleware saw for this request, or null when it is missing or unproven.
 *
 * Null means "middleware did not run for this request, or someone else wrote the header". Callers
 * must treat it as unknown — never substitute a default path that grants more than the real one
 * might.
 */
export async function provenPath(headers: HeaderBag): Promise<{ pathname: string; search: string } | null> {
  const pathname = headers.get(PATHNAME_HEADER);
  const proof = headers.get(PATH_PROOF_HEADER);
  if (pathname == null || !proof) return null;
  const search = headers.get(SEARCH_HEADER) ?? '';
  return constantTimeEqual(proof, await pathHeaderProof(pathname, search)) ? { pathname, search } : null;
}

/** Sets a proven tenant (and the prefix derived from it) on headers being forwarded inward. */
export async function setProvenClan(headers: Headers, slug: string, kind: AddressKind = 'clan'): Promise<void> {
  headers.set(CLAN_SLUG_HEADER, slug);
  if (kind === 'creator') headers.set(CLAN_KIND_HEADER, 'creator');
  else headers.delete(CLAN_KIND_HEADER);
  headers.set(CLAN_PREFIX_HEADER, clanBasePath({ slug, kind }));
  headers.set(CLAN_PROOF_HEADER, await clanHeaderProof(slug, kind));
}
