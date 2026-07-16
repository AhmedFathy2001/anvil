// Broker JWKS resolution + assertion verification (WIRE §2/§3, FEDERATION_SECURITY.md §1 + §9).
//
// Split out of the /exchange route so the SSRF-guarded JWKS fetch and the strict jwtVerify options are
// (a) the single sanctioned place both live, and (b) unit-testable under `node --test` type-stripping.
// It imports only `jose` (a real package) + the `@/`-free lib/federationSecurity, so no bundler/DB is
// pulled in. `federationFetch` is imported with the explicit `.ts` extension so the test harness and
// the Next build resolve it identically (allowImportingTsExtensions).

import {
  createRemoteJWKSet,
  jwtVerify,
  customFetch,
  type JWTVerifyGetKey,
  type JWTPayload,
} from 'jose';
import { federationFetch } from './federationSecurity.ts';

// WIRE §2 step 6 — the broker mints `exp = iat + 60`. `maxTokenAge` additionally bounds a HELD or
// far-future-`exp` assertion to ≤90s from issuance (`iat`), and `requiredClaims` rejects a token
// missing any of the mandatory claims (so a missing/absent `exp` can't slip through). ≤30s clock skew.
export const ASSERTION_MAX_TOKEN_AGE = '90s';
export const ASSERTION_CLOCK_TOLERANCE = 30;
export const ASSERTION_REQUIRED_CLAIMS = ['exp', 'iat', 'jti', 'aud', 'iss', 'sub'] as const;

// Per-jwksUrl memo of the remote key set. createRemoteJWKSet keeps its OWN fetch cache + cooldown and
// refetches on an unknown `kid` (WIRE §3); reusing one instance per broker preserves that cache across
// requests instead of hammering the broker's /jwks.json on every exchange.
const jwksCache = new Map<string, JWTVerifyGetKey>();

/**
 * §1 SSRF: the `jwksUrl` comes from `brokerTrust[]`, which is ADMIN-EDITABLE config — an untrusted
 * federation-supplied URL. jose's `createRemoteJWKSet` would otherwise dial it with an unguarded global
 * `fetch`. We inject our `guardedFetch` via jose's `[customFetch]` option so the JWKS fetch is HTTPS-
 * only, IP-pinned, redirect-blocked and private-address-rejected exactly like every other federation
 * outbound. No raw fetch to a federation-supplied URL (FEDERATION_SECURITY.md §1).
 */
export function createGuardedRemoteJWKSet(jwksUrl: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl), { [customFetch]: federationFetch });
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

/** Test-only: drop the memoized key sets so a case can rebind a jwksUrl to a fresh guard/mock. */
export function _clearJwksCache(): void {
  jwksCache.clear();
}

/**
 * WIRE §2 steps 2,3,5,6: verify a broker assertion — EdDSA only (alg pinned, blocks alg-confusion +
 * alg:none), all mandatory claims present, bounded token age, ≤30s skew, and the caller-pinned
 * issuer/audience. Throws jose errors (the route maps them to 403/409/422) — never a soft success.
 */
export function verifyBrokerAssertion(
  token: string,
  getKey: JWTVerifyGetKey,
  opts: { issuer: string; audience: string },
): Promise<{ payload: JWTPayload }> {
  return jwtVerify(token, getKey, {
    algorithms: ['EdDSA'],
    requiredClaims: [...ASSERTION_REQUIRED_CLAIMS],
    maxTokenAge: ASSERTION_MAX_TOKEN_AGE,
    clockTolerance: ASSERTION_CLOCK_TOLERANCE,
    issuer: opts.issuer,
    audience: opts.audience,
  });
}
