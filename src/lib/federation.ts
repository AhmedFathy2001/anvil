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
import { settings, federationTokens, federationJti, users, clanMembers } from '@/db/schema';
import { and, desc, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import {
  getAssociationPush,
  getClanDisplayName,
  getBrokerBaseUrl,
  getBrokerTrust,
  getFederationEnabled,
  FEDERATION_BROKER_TRUST_KEY,
} from '@/lib/pluginConfig';
import { brokerRegister } from '@/lib/federationRelay';
import { federationFetch } from '@/lib/federationSecurity';
import { log } from '@/lib/logger';

// --- Settings keys (kept out of the public /api/admin/settings whitelist; the signing key in
// particular must never be readable through an API). ---
export const FEDERATION_INSTANCE_ID_KEY = 'federation_instance_id';
export const FEDERATION_SIGNING_KEY_KEY = 'federation_signing_key';
// The broker hands this out at POST /register; the instance proves domain control by echoing it at
// /.well-known/anvil-federation. Null until a broker registration sets it (WIRE §6).
export const FEDERATION_VERIFICATION_TOKEN_KEY = 'federation_verification_token';

// Capabilities advertised at /meta (WIRE §7, a subset of ['directory','identity-federation']).
// `identity-federation` is advertised now that POST /exchange is live (L2): a client seeing it may
// obtain a broker assertion and exchange it here for a federation token. Instances that predate the
// endpoint (or that trust no broker) still degrade cleanly — the WIRE §7 rule is a capability gate,
// not a promise that any broker is configured.
export const FEDERATION_CAPABILITIES = ['directory', 'identity-federation'] as const;

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
  return getClanDisplayName();
}

// hosted vs self-hosted (WIRE §7). Managed instances are provisioned by Anvil.Admin, which sets this
// env. Deliberately an env signal (not a DB setting) so a self-host can't self-declare "hosted".
export function getInstanceType(): 'hosted' | 'self-hosted' {
  return process.env.ANVIL_FEDERATION_INSTANCE_TYPE === 'hosted' ? 'hosted' : 'self-hosted';
}

// --- Site-relayed federation trust tier (WIRE §10.3) -------------------------------------------
// This site is *trusted/hosted* iff the provisioner injected its derived instance credential
// (FEDERATION_ASSOC_SECRET) — the shared secret the broker trusts an Anvil site by. With it, the
// home site can VOUCH for its authenticated member server-to-server (zero-click). Without it we are a
// *self-host*: the broker won't accept our identity claim, so the member proves identity once via the
// broker's device-code flow. This is the same env the existing association-push already keys on, so
// "has a credential" == "hosted" stays a single source of truth.
export function getInstanceCredential(): string | null {
  return process.env.FEDERATION_ASSOC_SECRET?.trim() || null;
}

export function getFederationTier(): 'hosted' | 'self-host' {
  return getInstanceCredential() ? 'hosted' : 'self-host';
}

// Upsert a plain settings scalar (federation bookkeeping only — the public settings API has its own
// whitelisted upsert). settings.key is the PK, so insert-or-update covers the race.
async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    try {
      await db.insert(settings).values({ key, value });
    } catch {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    }
  }
}

// Add the configured broker to brokerTrust[] if absent (WIRE §7), so THIS instance accepts the
// assertions other home sites relay to our /exchange. `jwksUrl` follows the broker's federation base
// path. Idempotent.
async function ensureBrokerTrusted(brokerBaseUrl: string): Promise<void> {
  const iss = brokerBaseUrl.replace(/\/+$/, '');
  const jwksUrl = `${iss}/api/federation/v1/jwks.json`;
  const current = await getBrokerTrust();
  if (current.some((b) => b.iss === iss)) return;
  const next = [...current, { iss, jwksUrl }];
  await setSetting(FEDERATION_BROKER_TRUST_KEY, JSON.stringify(next));
}

// Register this instance with the broker on federation-enable (WIRE §6/§10.1). Hosted presents its
// derived credential and the broker reconciles (we own the domain → implicitly verified); self-host
// registers self-service and gets a verificationToken we persist for /.well-known/anvil-federation to
// echo (the broker then fetches it to verify domain control). Also trusts the broker for inbound
// relayed exchanges. Best-effort: a broker being down must never fail the admin's settings save — the
// plugin's /connect retries the whole path anyway.
export async function ensureRegisteredWithBroker(
  baseUrl: string,
  participation: 'on' | 'off' = 'on',
): Promise<void> {
  const brokerBaseUrl = await getBrokerBaseUrl();
  if (!brokerBaseUrl) {
    log.warn('federation.register.no-broker-url', {});
    return;
  }
  // Opting OUT must not (re-)trust the broker as an assertion issuer — only the join path does that.
  if (participation === 'on') {
    await ensureBrokerTrusted(brokerBaseUrl).catch(() => {});
  }

  const [instanceId, name] = await Promise.all([getInstanceId(), getInstanceName()]);
  const tier = getFederationTier();
  try {
    const res = await brokerRegister(
      brokerBaseUrl,
      { instanceId, baseUrl, name, type: tier, participation },
      getInstanceCredential(),
      federationFetch, // §1 SSRF guard on the broker outbound
    );
    if (res?.verificationToken) {
      await setSetting(FEDERATION_VERIFICATION_TOKEN_KEY, res.verificationToken);
    }
    log.info('federation.register.ok', { instanceId, tier, participation, state: res?.state ?? null });
  } catch (err) {
    log.warn('federation.register.fail', { instanceId, tier, participation }, err);
  }
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

// --- Shared token-mint (WIRE §4). The ONE place that inserts a federation_tokens row, so /token
// (own issuance) and /exchange (broker assertion) mint the identical opaque, hashed, revocable
// shape. Returns the raw token exactly once — the caller must surface it and never persist it. ---
// Label stamped on every /exchange-minted token. Distinguishes the machine-rotated relay credential
// (re-minted by the member's home on every ~5-min /state sync) from a real device connection in both
// the "Connected plugins" UI and pruneExchangeTokens's match below.
export const EXCHANGE_TOKEN_LABEL = 'Federation relay';

// How many relay tokens to keep per discord identity. Each of the member's HOME clans holds exactly
// one live token here (replaceConnectionsForUser keeps newest-per-instance), so this is really
// "how many homes can relay for one member without thrashing". 3 is generous; a 4-home member's
// oldest home just re-exchanges on its next sync (and the relay serves its stale cache meanwhile).
const EXCHANGE_TOKENS_KEPT = 3;

/**
 * Delete superseded /exchange-minted relay tokens for one discord identity, keeping the newest
 * {@link EXCHANGE_TOKENS_KEPT}. Called after every exchange mint: each re-mint supersedes that home's
 * previous token, and with no pruning they pile up ~12/hour of plugin-open time into the profile's
 * "Connected plugins" list (and the DB) forever. Hard-delete, not revoke — these are machine-rotated
 * credentials with no audit value, and revoked rows would accumulate at the same rate.
 *
 * Unlabeled rows are matched too: /exchange minted with no label before EXCHANGE_TOKEN_LABEL existed,
 * so the first post-deploy exchange sweeps a member's whole backlog. Accepted risk: /token CAN mint an
 * unlabeled discordId-bearing row, but no client does today (the plugin's device sign-in issues
 * users.pluginToken) — and worst case such a credential is rotated out and its holder re-links.
 */
export async function pruneExchangeTokens(discordId: string): Promise<number> {
  const isRelayToken = and(
    eq(federationTokens.discordId, discordId),
    or(eq(federationTokens.label, EXCHANGE_TOKEN_LABEL), isNull(federationTokens.label)),
  );
  // Keep slots go to LIVE tokens only — a manually-revoked row must not displace another home's
  // working token — and everything else (older live rows AND the whole revoked backlog) is deleted.
  const kept = await db
    .select({ id: federationTokens.id })
    .from(federationTokens)
    .where(and(isRelayToken, isNull(federationTokens.revokedAt)))
    .orderBy(desc(federationTokens.createdAt), desc(federationTokens.id))
    .limit(EXCHANGE_TOKENS_KEPT);
  if (kept.length === 0) return 0; // can't happen right after a mint; guards notInArray([])
  const result = await db
    .delete(federationTokens)
    .where(and(isRelayToken, notInArray(federationTokens.id, kept.map((r) => r.id))));
  return (result as { rowsAffected?: number }).rowsAffected ?? 0;
}

export async function mintFederationToken(opts: {
  userId?: number | null;
  discordId?: string | null;
  memberId?: number | null;
  scopes: FederationScope[];
  label?: string | null;
}): Promise<{ token: string; tokenId: string; scopes: FederationScope[]; label: string | null }> {
  const token = generateFederationToken();
  const tokenId = generateFederationTokenId();
  const label = opts.label ?? null;
  await db.insert(federationTokens).values({
    tokenId,
    tokenHash: hashFederationToken(token),
    userId: opts.userId ?? null,
    discordId: opts.discordId ?? null,
    memberId: opts.memberId ?? null,
    scopes: JSON.stringify(opts.scopes),
    label,
  });
  return { token, tokenId, scopes: opts.scopes, label };
}

// --- Single-use assertion replay guard (WIRE §2 step 7). ---
// Records a `jti` on FIRST sight and returns true; a second call with the same jti returns false
// (→ 409 replay). Atomic: the PRIMARY-KEY collision on a replayed jti makes the INSERT a no-op
// (0 rows returned) with no read-then-write race. `expiresAt` mirrors the assertion `exp`; the row
// is disposable after that, so we opportunistically GC expired rows (1-in-20 writes, like rate-limit).
export async function recordFederationJti(jti: string, expiresAt: Date): Promise<boolean> {
  if (Math.random() < 0.05) {
    db.delete(federationJti)
      .where(lt(federationJti.expiresAt, new Date().toISOString()))
      .catch(() => {});
  }
  const rows = await db
    .insert(federationJti)
    .values({ jti, expiresAt: expiresAt.toISOString() })
    .onConflictDoNothing()
    .returning({ jti: federationJti.jti });
  return rows.length > 0;
}

// --- Outbound association push (decision 2, WIRE §5 / FEDERATION.md "Association push"). ---
// After a successful /exchange or /token link, tell the broker "this discord_id is a member here"
// so the plugin's "your clans" can auto-populate. Carries ONLY (discordId, instanceId) — never board
// or game data. Gated on the per-instance `associationPush` setting (default off for self-host, on
// for hosted). Authenticated with the derived clan secret the Admin control-plane injects into hosted
// containers as FEDERATION_ASSOC_SECRET.
//
// Best-effort / fire-and-forget: a broker being down must never fail the exchange that the player is
// waiting on. TODO(federation/self-host): self-hosted instances have no FEDERATION_ASSOC_SECRET, so
// this no-ops for them — a self-host association-push story (broker-issued push credential at
// /register) is a later track.
export async function pushAssociation(
  discordId: string | null | undefined,
  brokerIss: string,
): Promise<void> {
  if (!discordId) return;
  if (!(await getAssociationPush())) return;
  const secret = process.env.FEDERATION_ASSOC_SECRET;
  if (!secret) return; // self-host / unprovisioned: no credential to present — silently skip.
  let instanceId: string;
  try {
    instanceId = await getInstanceId();
  } catch {
    return;
  }
  const base = brokerIss.replace(/\/+$/, '');
  try {
    // §1 SSRF guard on the broker outbound (HTTPS-only, IP-pinned, no redirect). Fire-and-forget.
    await federationFetch(`${base}/api/federation/v1/assoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ discordId, instanceId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // fire-and-forget — swallow network/timeout/guard errors.
  }
}

// Rejoin/backfill push: when the clan (re-)enables federation, advertise the WHOLE existing roster
// instead of waiting for each member's next login — without this, a clan that left the network (which
// retracts its associations, by design) rejoins to an empty member list and every sidebar stays blank
// until people happen to log in again. Sequential on purpose: all hosted clans egress one box IP and
// share the broker's /assoc rate bucket, so a parallel burst from a big roster could starve siblings.
// Fire-and-forget from the settings save; capped as a sanity bound.
const ASSOC_BACKFILL_CAP = 500;
export async function pushAllMemberAssociations(): Promise<void> {
  try {
    if (!(await getFederationEnabled())) return;
    if (!(await getAssociationPush())) return;
    const rows = await db
      .selectDistinct({ discordId: users.discordId })
      .from(users)
      .innerJoin(clanMembers, eq(clanMembers.userId, users.id))
      .where(isNull(clanMembers.leftAt))
      .limit(ASSOC_BACKFILL_CAP);
    const targets = new Set((await getBrokerTrust()).map((b) => b.iss));
    const base = await getBrokerBaseUrl();
    if (base) targets.add(base);
    for (const r of rows) {
      if (!r.discordId) continue;
      for (const iss of targets) {
        await pushAssociation(r.discordId, iss);
      }
    }
    log.info('federation.assoc.backfill', { members: rows.length });
  } catch (err) {
    log.warn('federation.assoc.backfill-fail', {}, err);
  }
}

// Login-time association push: a rostered member's Discord login is a "member here" signal, so the
// whole roster becomes discoverable in /me/instances as people log in — not only the few who mint a
// federation token or complete a device connect. Pushes to every trusted broker plus the configured
// relay broker (deduped). Gated on the federation master switch here and on the associationPush
// consent + provisioned secret inside pushAssociation; only fires for users with a linked, active
// clan_members row (a bare login on a public site is NOT a membership signal). Fire-and-forget.
export async function pushMemberAssociations(userId: number): Promise<void> {
  try {
    if (!(await getFederationEnabled())) return;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { discordId: true },
    });
    if (!user?.discordId) return;
    const member = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.userId, userId), isNull(clanMembers.leftAt)),
      columns: { id: true },
    });
    if (!member) return;
    const targets = new Set((await getBrokerTrust()).map((b) => b.iss));
    const base = await getBrokerBaseUrl();
    if (base) targets.add(base);
    for (const iss of targets) void pushAssociation(user.discordId, iss);
  } catch (err) {
    log.warn('federation.assoc.login-push-fail', { userId }, err);
  }
}
