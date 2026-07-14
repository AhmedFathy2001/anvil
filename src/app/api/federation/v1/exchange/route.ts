import { NextResponse } from 'next/server';
import {
  jwtVerify,
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  errors as joseErrors,
  type JWTVerifyGetKey,
} from 'jose';
import { db } from '@/db';
import { users, clanMembers, federationBans, clanAuditLog } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { getBrokerTrust, getExchangePolicy } from '@/lib/pluginConfig';
import {
  getInstanceId,
  mintFederationToken,
  pushAssociation,
  recordFederationJti,
  type FederationScope,
} from '@/lib/federation';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// POST /api/federation/v1/exchange — the L2 identity-federation door (WIRE §2, FEDERATION.md L2).
//
// A plugin presents a short-lived, single-use broker assertion (an EdDSA JWT the broker minted at
// /assert, pinned to THIS instanceId). We validate it strictly against the trusted broker's JWKS,
// then map the asserted `discord_id` (`sub`) onto local membership and mint the SAME opaque, hashed,
// revocable federation token /token issues. A broker — even a compromised one — can only *assert
// identity*; this instance still enforces its own membership + policy, so it can never grant a
// non-member more than the exchangePolicy allows.
//
// Body: { assertion: "<jwt>" }.

// Per-jwksUrl memo of the remote key set. createRemoteJWKSet keeps its own fetch cache + cooldown and
// refetches on an unknown `kid` (WIRE §3); reusing one instance per broker preserves that cache
// across requests instead of hammering the broker's /jwks.json on every exchange.
const jwksCache = new Map<string, JWTVerifyGetKey>();
function brokerJwks(jwksUrl: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

// Synthetic, clearly-non-game display name for an exchange-created guest. rsn is NOT NULL and
// rsn_normalized is UNIQUE, and an assertion carries only the discord_id (no RSN), so we key the
// guest on the discord_id. `guest:` prefix keeps it out of the RSN namespace (colons never appear
// in an OSRS name) and makes it obvious in the roster that this is a federated placeholder.
function guestRsnFor(discordId: string): string {
  return `guest:${discordId}`;
}

// Find-or-create the INERT federation guest for a discord_id (decision 4 / FEDERATION.md guardrail 1).
// INERTNESS GUARANTEE: this only ever writes a clan_members row (isGuest=1) — it NEVER touches
// `players`, teams, or the draft, so an exchange-created guest is structurally unable to be on a team,
// credit a tile, or submit. It stays read-only (board:read-scoped token, board preview only) until an
// admin explicitly drafts/promotes it. Idempotent: a repeat exchange reuses the existing guest row.
async function ensureFederationGuest(
  discordId: string,
  ownerUserId: number | null,
): Promise<{ id: number; created: boolean }> {
  const rsn = guestRsnFor(discordId);
  const rsnNormalized = normalizeRsn(rsn);

  const existing = await db.query.clanMembers.findFirst({
    where: and(eq(clanMembers.rsnNormalized, rsnNormalized), isNull(clanMembers.leftAt)),
    columns: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  // onConflictDoNothing guards the concurrent-first-exchange race on the unique rsn_normalized index;
  // if another request won, re-read the winner's row so we return a stable id.
  const inserted = await db
    .insert(clanMembers)
    .values({
      rsn,
      rsnNormalized,
      discordId,
      userId: ownerUserId,
      isGuest: 1,
      source: 'federation',
      notes: 'Auto-created via federation /exchange (inert guest — not on any team).',
      lastSeenInClan: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning({ id: clanMembers.id });

  if (inserted[0]) return { id: inserted[0].id, created: true };

  const winner = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
    columns: { id: true },
  });
  return { id: winner!.id, created: false };
}

export async function POST(request: Request) {
  // Rate-limit the door itself (WIRE §8). A separate, tighter budget gates guest CREATION below.
  const rl = await rateLimit(request, 'federation-exchange', { limit: 30, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: { assertion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const assertion = typeof body.assertion === 'string' ? body.assertion.trim() : '';
  if (!assertion) {
    return NextResponse.json({ error: 'assertion (broker JWT) required' }, { status: 422 });
  }

  // ── WIRE §2 step 1: pin alg === "EdDSA". Reject a header-derived alg / alg:none up front so an
  // alg-confusion or unsigned token never reaches key resolution. (jose re-enforces via `algorithms`
  // below; this is the explicit first gate the spec mandates.) ──────────────────────────────────
  let alg: string | undefined;
  try {
    ({ alg } = decodeProtectedHeader(assertion));
  } catch {
    return NextResponse.json({ error: 'Malformed assertion header' }, { status: 422 });
  }
  if (alg !== 'EdDSA') {
    return NextResponse.json({ error: 'Assertion alg must be EdDSA' }, { status: 422 });
  }

  // Decode (UNVERIFIED) only to read `iss` — we need it to select which broker's JWKS validates the
  // signature. The value is re-bound cryptographically by jwtVerify(issuer) below, so trusting it for
  // key selection is safe; if `iss` isn't trusted we 403 before touching any crypto or the network.
  let unverified: ReturnType<typeof decodeJwt>;
  try {
    unverified = decodeJwt(assertion);
  } catch {
    return NextResponse.json({ error: 'Malformed assertion' }, { status: 422 });
  }
  const iss = typeof unverified.iss === 'string' ? unverified.iss : '';

  // ── WIRE §2 step 4 (also the key-selection gate): iss ∈ brokerTrust[]. ──────────────────────────
  const broker = (await getBrokerTrust()).find((b) => b.iss === iss);
  if (!broker) {
    return NextResponse.json({ error: 'Assertion issuer is not a trusted broker' }, { status: 403 });
  }

  const instanceId = await getInstanceId();

  // ── WIRE §2 steps 2,3,5,6: resolve kid against the broker JWKS, verify the signature (alg pinned
  // to EdDSA), then jose validates claims in spec order — iss (4, re-checked), aud (5), exp (6, ≤30s
  // skew). A tampered/forged/expired token, an unknown kid, or a wrong audience all fail here. ─────
  let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
  try {
    ({ payload } = await jwtVerify(assertion, brokerJwks(broker.jwksUrl), {
      algorithms: ['EdDSA'],
      issuer: iss,
      audience: instanceId,
      clockTolerance: 30, // ≤30s clock skew (WIRE §2 step 6)
    }));
  } catch (err) {
    // aud mismatch → 403 (WIRE §8); everything else (bad signature, unknown kid, expired, wrong alg,
    // other malformed claims) → 422. iss can't mismatch here (we passed the trusted value).
    if (err instanceof joseErrors.JWTClaimValidationFailed && err.claim === 'aud') {
      return NextResponse.json({ error: 'Assertion audience is not this instance' }, { status: 403 });
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed && err.claim === 'iss') {
      return NextResponse.json({ error: 'Assertion issuer is not a trusted broker' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Assertion failed validation' }, { status: 422 });
  }

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const jti = typeof payload.jti === 'string' ? payload.jti.trim() : '';
  if (!sub || !jti) {
    return NextResponse.json({ error: 'Assertion missing sub or jti' }, { status: 422 });
  }

  // ── WIRE §2 step 7: single-use jti. Record until exp; a replay is a 409. exp is validated above, so
  // fall back to a short TTL only if it were somehow absent. ──────────────────────────────────────
  const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 90_000;
  const fresh = await recordFederationJti(jti, new Date(expMs));
  if (!fresh) {
    return NextResponse.json({ error: 'Assertion has already been used' }, { status: 409 });
  }

  // ── WIRE §2 step 8 begins: sticky federation ban (decision 4), keyed on discord_id. Blocks
  // re-exchange even after an admin Removed the guest row. ────────────────────────────────────────
  const ban = await db.query.federationBans.findFirst({ where: eq(federationBans.discordId, sub) });
  if (ban) {
    log.info('federation.exchange.banned', { instanceId, iss, sub });
    return NextResponse.json({ error: 'This identity is banned from federating here' }, { status: 403 });
  }

  // Map sub → local identity. A pre-existing site user for this discord_id anchors ownership; a
  // site-banned user is refused (mirrors /token and the OAuth door), independent of the federation ban.
  const existingUser = await db.query.users.findFirst({
    where: eq(users.discordId, sub),
    columns: { id: true, banned: true },
  });
  if (existingUser?.banned) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  // Membership = an active, non-guest clan_member owned by that user (roster is the source of truth).
  const memberRows = existingUser
    ? await db
        .select({ id: clanMembers.id, isPrimary: clanMembers.isPrimary })
        .from(clanMembers)
        .where(
          and(
            eq(clanMembers.userId, existingUser.id),
            eq(clanMembers.isGuest, 0),
            isNull(clanMembers.leftAt),
          ),
        )
    : [];

  if (memberRows.length > 0) {
    // Existing member → full plugin token (board:read + events:write). Pin to their primary member.
    const primary = memberRows.find((m) => m.isPrimary === 1) ?? memberRows[0];
    const scopes: FederationScope[] = ['board:read', 'events:write'];
    const { token, tokenId } = await mintFederationToken({
      userId: existingUser!.id,
      discordId: sub,
      memberId: primary.id,
      scopes,
    });

    // Association push (decision 2): confirm "member here" to the asserting broker. Fire-and-forget.
    void pushAssociation(sub, broker.iss);

    db.insert(clanAuditLog)
      .values({
        clanMemberId: primary.id,
        eventType: 'federation_exchange',
        actorUserId: existingUser!.id,
        newValue: JSON.stringify({ via: 'exchange', iss, tokenId, guest: false }),
        notes: 'Broker assertion exchanged for a federation token',
      })
      .catch(() => {});

    log.info('federation.exchange.member', { instanceId, iss, memberId: primary.id, tokenId });
    return NextResponse.json(
      { token, tokenId, scopes, instanceId, guest: false, memberId: primary.id },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // ── Non-member: apply exchangePolicy (decision 4, default auto-guest). ──────────────────────────
  const policy = await getExchangePolicy();

  if (policy === 'reject') {
    return NextResponse.json({ error: 'Not a member of this clan' }, { status: 403 });
  }

  if (policy === 'request-to-join') {
    // No token, no guest row: the identity is held pending an admin decision. The approval mechanism
    // (surfacing pending requests, promoting to member) is a later admin track; we intentionally
    // create no orphan state here. The plugin should treat this as "pending, retry later".
    log.info('federation.exchange.request-to-join', { instanceId, iss, sub });
    return NextResponse.json(
      { status: 'request-to-join', guest: false, instanceId },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // policy === 'auto-guest'. Separately rate-limit guest CREATION (WIRE §8): a spammed clan can flip
  // exchangePolicy off on its own site, but this caps the blast radius in the meantime.
  const grl = await rateLimit(request, 'federation-guest', { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!grl.ok) {
    return NextResponse.json({ error: 'Too many guest creations' }, { status: 429, headers: rateLimitHeaders(grl) });
  }

  const guest = await ensureFederationGuest(sub, existingUser?.id ?? null);

  // Inert = read-only. A guest token is board:read ONLY — never events:write — so even a bug that
  // put it on a team couldn't credit a tile. Belt to the "never on a team" structural guarantee.
  const scopes: FederationScope[] = ['board:read'];
  const { token, tokenId } = await mintFederationToken({
    userId: existingUser?.id ?? null,
    discordId: sub,
    memberId: guest.id,
    scopes,
  });

  void pushAssociation(sub, broker.iss);

  if (guest.created) {
    db.insert(clanAuditLog)
      .values({
        clanMemberId: guest.id,
        eventType: 'federation_guest_created',
        newValue: JSON.stringify({ via: 'exchange', iss, discordId: sub, tokenId }),
        notes: 'Auto-guest created from broker assertion (inert — not on any team)',
      })
      .catch(() => {});
  }

  log.info('federation.exchange.guest', { instanceId, iss, memberId: guest.id, created: guest.created, tokenId });
  return NextResponse.json(
    { token, tokenId, scopes, instanceId, guest: true, memberId: guest.id },
    { headers: rateLimitHeaders(rl) },
  );
}
