// Anvil Federation — crypto + token + instance-identity foundation (Layer 0/1).
// See docs/FEDERATION.md (instance contract) and docs/FEDERATION_WIRE.md (canonical wire contract).
//
// This module owns everything the federation endpoints under /api/federation/v1 need that isn't a
// plain settings scalar (those live in lib/pluginConfig.ts): the stable instance id, the Ed25519
// signing keypair, and the opaque federation-token primitives (mint / hash / resolve).
//
// SECURITY: the private JWK (it carries `d`) NEVER leaves this module — only getPublicJwk() is
// exported for /meta. Raw federation tokens are shown once at mint time; only their SHA-256 hash is
// persisted (WIRE §4), so a DB leak can't be replayed as a bearer credential.

import crypto from 'crypto';
import { exportJWK, generateKeyPair, calculateJwkThumbprint, type JWK } from 'jose';
import { db } from '@/db';
import { settings, federationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

// --- Settings keys (kept out of the public /api/admin/settings whitelist; the signing key in
// particular must never be readable through an API). ---
export const FEDERATION_INSTANCE_ID_KEY = 'federation_instance_id';
export const FEDERATION_SIGNING_KEY_KEY = 'federation_signing_key';
// The broker hands this out at POST /register; the instance proves domain control by echoing it at
// /.well-known/anvil-federation. Null until a broker registration sets it (WIRE §6).
export const FEDERATION_VERIFICATION_TOKEN_KEY = 'federation_verification_token';

// Capabilities advertised at /meta (WIRE §7, a subset of ['directory','identity-federation']).
// This slice implements L0/L1 only: the instance is directory-registerable (it serves /meta and
// /.well-known). L2 identity-federation (POST /exchange) is a later track — DO NOT advertise it
// until that endpoint exists, or clients will attempt a broker exchange against a missing route
// (WIRE §7 degrade rule: "no identity-federation ⇒ L0/L1 only").
// TODO(federation-L2): add 'identity-federation' here once POST /exchange ships.
export const FEDERATION_CAPABILITIES = ['directory'] as const;

// Token scopes (WIRE §4). events:write is minted now but only enforced once POST /events lands.
export const FEDERATION_SCOPES = ['board:read', 'events:write'] as const;
export type FederationScope = (typeof FEDERATION_SCOPES)[number];

// --- Small settings get-or-create. settings.key is the PRIMARY KEY, so a concurrent first-boot
// insert throws a uniqueness error; we catch it and re-read the winner's value, keeping the id/key
// stable across a race. ---
async function getOrCreateSetting(key: string, factory: () => string | Promise<string>): Promise<string> {
  const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (existing?.value) return existing.value;
  const value = await factory();
  try {
    await db.insert(settings).values({ key, value });
    return value;
  } catch {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
    return row?.value ?? value;
  }
}

// Stable instance id: a self-generated UUIDv4, persisted once on first boot so Layer 0 works with no
// broker (WIRE §1). The broker only *records* this at /register; it never invents it.
export async function getInstanceId(): Promise<string> {
  return getOrCreateSetting(FEDERATION_INSTANCE_ID_KEY, () => crypto.randomUUID());
}

interface SigningKeyBundle {
  kid: string;
  privateJwk: JWK; // carries `d` — never leaves this module
  publicJwk: JWK;
}

// Generate (once) and persist the instance's Ed25519 signing keypair. Stored as a single JSON
// settings row; the `kid` is the RFC-7638 JWK thumbprint of the public key (stable, collision-free).
async function loadOrCreateSigningKey(): Promise<SigningKeyBundle> {
  const raw = await getOrCreateSetting(FEDERATION_SIGNING_KEY_KEY, async () => {
    const { publicKey, privateKey } = await generateKeyPair('Ed25519', { extractable: true });
    const privateJwk = await exportJWK(privateKey);
    const publicJwk = await exportJWK(publicKey);
    const kid = await calculateJwkThumbprint(publicJwk);
    const bundle: SigningKeyBundle = {
      kid,
      privateJwk: { ...privateJwk, alg: 'EdDSA', kid, use: 'sig' },
      publicJwk: { ...publicJwk, alg: 'EdDSA', kid, use: 'sig' },
    };
    return JSON.stringify(bundle);
  });
  return JSON.parse(raw) as SigningKeyBundle;
}

// Public JWK ONLY (OKP/Ed25519, alg EdDSA, with kid) — the shape /meta exposes as `publicKey`.
// The private half is deliberately not reachable from here.
export async function getPublicJwk(): Promise<JWK> {
  const { publicJwk } = await loadOrCreateSigningKey();
  return publicJwk;
}

// The instance private signing key. Intentionally NOT used by this slice — /exchange verifies the
// BROKER's JWKS, not ours (WIRE §2/§3). Exposed only as a module helper for future instance-signed
// payloads (e.g. association-push), never through any API surface.
// TODO(federation-L2): association-push signing (if adopted) reads the private key from here.
export async function getSigningPrivateKey(): Promise<{ kid: string; privateJwk: JWK }> {
  const { kid, privateJwk } = await loadOrCreateSigningKey();
  return { kid, privateJwk };
}

// Verification token echoed at /.well-known/anvil-federation. Null until a broker /register sets it.
export async function getVerificationToken(): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, FEDERATION_VERIFICATION_TOKEN_KEY),
  });
  return row?.value?.trim() || null;
}

// Human-readable instance name for /meta — mirrors how the profile page resolves the clan name.
export async function getInstanceName(): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'clan_name') });
  return row?.value?.trim() || process.env.CLAN_NAME?.trim() || 'Anvil';
}

// hosted vs self-hosted (WIRE §7). Managed instances are provisioned by Anvil.Admin, which sets this
// env. Deliberately an env signal (not a DB setting) so a self-host can't self-declare "hosted".
export function getInstanceType(): 'hosted' | 'self-hosted' {
  return process.env.ANVIL_FEDERATION_INSTANCE_TYPE === 'hosted' ? 'hosted' : 'self-hosted';
}

// --- Federation token primitives (WIRE §4). ---

// Opaque random 256-bit token, base64url — NOT a JWT.
export function generateFederationToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// SHA-256 (hex) — what we persist, and what resolveFederationToken() looks up by.
export function hashFederationToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Public token id (used by /token/revoke + the "Connected plugins" UI). Never the secret.
export function generateFederationTokenId(): string {
  return crypto.randomUUID();
}

// Coerce arbitrary input into a valid, deduped scope subset; defaults to ['board:read'].
export function sanitizeScopes(input: unknown): FederationScope[] {
  if (!Array.isArray(input)) return ['board:read'];
  const out = new Set<FederationScope>();
  for (const s of input) {
    if (typeof s === 'string' && (FEDERATION_SCOPES as readonly string[]).includes(s)) {
      out.add(s as FederationScope);
    }
  }
  return out.size ? [...out] : ['board:read'];
}

function parseScopesColumn(json: string | null): FederationScope[] {
  if (!json) return ['board:read'];
  try {
    return sanitizeScopes(JSON.parse(json));
  } catch {
    return ['board:read'];
  }
}

export interface FederationTokenCtx {
  id: number;
  tokenId: string;
  userId: number | null;
  discordId: string | null;
  memberId: number | null;
  scopes: FederationScope[];
}

// Resolve a `Authorization: Bearer <token>` federation credential. Returns null for a
// missing/invalid/revoked token (the caller maps that to 401 per WIRE §8). A valid-but-wrong-scope
// token still resolves here — the route decides 403 by inspecting `scopes` — so error codes stay
// distinct (401 = bad token, 403 = insufficient scope). Bumps lastUsedAt fire-and-forget.
export async function resolveFederationToken(request: Request): Promise<FederationTokenCtx | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;

  const tokenHash = hashFederationToken(raw);
  const row = await db.query.federationTokens.findFirst({
    where: eq(federationTokens.tokenHash, tokenHash),
  });
  if (!row || row.revokedAt) return null;

  // Fire-and-forget freshness bump — a race is harmless.
  db.update(federationTokens)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(federationTokens.id, row.id))
    .catch(() => {});

  return {
    id: row.id,
    tokenId: row.tokenId,
    userId: row.userId,
    discordId: row.discordId,
    memberId: row.memberId,
    scopes: parseScopesColumn(row.scopes),
  };
}
