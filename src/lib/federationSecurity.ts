// Federation security hardening — the ONE place every cross-clan outbound call, every federated
// payload, and every cached token is guarded. See docs/FEDERATION_SECURITY.md (normative threat model).
//
// DESIGN: like lib/federationRelay this module is deliberately free of any `@/` import (no DB, Next, or
// config) — it uses only node builtins (dns/net/https/crypto). That keeps it (a) importable by the pure
// relay without dragging the app runtime in, and (b) unit-testable under Node's native TS type-stripping
// (`node --test`) with no bundler. Callers that need config/env (the encryption key, settings) resolve
// it themselves and pass it in.
//
// Covers: §1 SSRF (guardedFetch — HTTPS-only, resolve-once + socket-pin, private-IP reject, no redirect,
// timeout, size cap, content-type), §2/§9 validate+cap+escape of federated data, §4 token encryption at
// rest, §8 verificationUrl pinning.

import dns from 'dns/promises';
import net from 'net';
import https from 'https';
import crypto from 'crypto';

export class FederationSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FederationSecurityError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 SSRF — address classification (mirrors Anvil.Admin's guardedGet).
// ─────────────────────────────────────────────────────────────────────────────

/** True for any address we must never let a server-side federation fetch reach (RFC 1918 + specials). */
export function isPrivateIp(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return isPrivateIpv4(ip);
  if (fam === 6) {
    const a = ip.toLowerCase();
    if (a === '::1' || a === '::') return true; // loopback / unspecified
    // IPv4-mapped (::ffff:1.2.3.4 / normalized ::ffff:a00:1) and IPv4-compatible (::1.2.3.4) forms are
    // a reject CATEGORY (§1) — an SSRF bypass vector regardless of the embedded v4. Node normalizes the
    // mapped tail to hex, so match the prefix / any embedded dotted-quad rather than parsing the v4.
    if (a.startsWith('::ffff:') || a.startsWith('::ffff.') || a.includes('.')) return true;
    if (a.startsWith('fc') || a.startsWith('fd')) return true; // fc00::/7 unique-local
    if (a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb')) return true; // fe80::/10 link-local
    if (a.startsWith('ff')) return true; // ff00::/8 multicast
    return false;
  }
  return true; // not a parseable IP → treat as unsafe
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                              // 0.0.0.0/8
  if (a === 10) return true;                             // 10/8
  if (a === 100 && b >= 64 && b <= 127) return true;     // 100.64/10 CGNAT
  if (a === 127) return true;                            // loopback
  if (a === 169 && b === 254) return true;               // link-local + 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16/12
  if (a === 192 && b === 0) return true;                 // 192.0.0/24 + 192.0.2/24 (test-net-1)
  if (a === 192 && b === 168) return true;               // 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true;  // 198.18/15 benchmarking
  if (a === 198 && b === 51) return true;                // 198.51.100/24 test-net-2
  if (a === 203 && b === 0) return true;                 // 203.0.113/24 test-net-3
  if (a >= 224) return true;                             // 224/4 multicast + 240/4 reserved + broadcast
  return false;
}

// Only standard HTTPS ports are allowed — a federation clan is a domain served over 443 (Caddy TLS in
// the hosted/self-host deploys). A non-standard port is refused per FEDERATION_SECURITY.md §1.
const ALLOWED_PORTS = new Set(['', '443']);

export interface ValidatedTarget {
  host: string;
  addresses: { address: string; family: number }[];
}

/**
 * §1 URL guard: parse + validate a federation-supplied URL and resolve it to a set of PUBLIC addresses.
 * HTTPS-only, no embedded credentials, standard port only. Resolves the host EXACTLY ONCE and rejects if
 * ANY resolved A/AAAA is private/loopback/link-local/CGNAT/metadata/mapped-v6. Throws on any violation;
 * returns the validated addresses (which guardedFetch then PINS the socket to — no re-resolution).
 */
export async function assertSafeFederationUrl(rawUrl: string | URL): Promise<ValidatedTarget> {
  let u: URL;
  try {
    u = typeof rawUrl === 'string' ? new URL(rawUrl) : rawUrl;
  } catch {
    throw new FederationSecurityError('federation: malformed URL');
  }
  if (u.protocol !== 'https:') throw new FederationSecurityError('federation: HTTPS required');
  if (u.username || u.password) throw new FederationSecurityError('federation: credentials in URL forbidden');
  if (!ALLOWED_PORTS.has(u.port)) throw new FederationSecurityError('federation: non-standard port forbidden');

  // URL.hostname keeps the brackets on an IPv6 literal ([::1]) — strip them so net.isIP / dns.lookup
  // see the bare address (else a bracketed v6 literal would fall through to a doomed DNS lookup).
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addresses: { address: string; family: number }[];
  const ipFam = net.isIP(host);
  if (ipFam) {
    addresses = [{ address: host, family: ipFam }];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((r) => ({ address: r.address, family: r.family }));
    } catch {
      throw new FederationSecurityError('federation: DNS resolution failed');
    }
  }
  if (addresses.length === 0) throw new FederationSecurityError('federation: no addresses');
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new FederationSecurityError('federation: target resolves to a private/blocked address');
  }
  return { host, addresses };
}

/** A 3xx that is a redirect (NOT a 304 conditional-GET response) is treated as failure (§1 "no redirects"). */
export function isDisallowedRedirect(status: number): boolean {
  return status >= 300 && status < 400 && status !== 304;
}

export interface GuardOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

const DEFAULT_GUARD_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 256 * 1024; // §1 response size cap (board/activity)

function toHeaderObject(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((v, k) => (out[k] = v));
  } else if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v;
  } else {
    for (const [k, v] of Object.entries(headers)) out[k] = String(v);
  }
  return out;
}

/**
 * §1 The one guarded outbound. A `fetch`-compatible function every home→clan / home→broker call routes
 * through: HTTPS-only, resolve-once + PIN the socket to the validated IP (closes DNS-rebind TOCTOU),
 * reject private/loopback/metadata addresses, NO redirects (3xx≠304 → throw), 5s timeout, 256 KB body
 * cap, and an `application/json` Content-Type check. Returns a real `Response` built from the buffered
 * (capped) body so callers use `res.status`/`res.ok`/`res.headers.get`/`res.json()` unchanged. Throws a
 * FederationSecurityError on any guard failure (the relay isolates per-clan, so one bad clan can't sink
 * the rest).
 */
export async function guardedFetch(
  input: string | URL,
  init: RequestInit = {},
  opts: GuardOptions = {},
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const { host, addresses } = await assertSafeFederationUrl(url);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_GUARD_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  // Pin the socket to the already-validated address(es): the lookup hook returns them verbatim and
  // NEVER re-resolves, so the name cannot resolve to a public IP for the check and a private IP for the
  // connect. TLS still verifies against the hostname (SNI + cert via `servername`).
  const pinnedLookup = ((_h: string, options: { all?: boolean } | undefined, cb: (...a: unknown[]) => void) => {
    if (options && options.all) return cb(null, addresses);
    return cb(null, addresses[0].address, addresses[0].family);
  }) as unknown as https.RequestOptions['lookup'];

  const method = (init.method ?? 'GET').toUpperCase();
  const headers = toHeaderObject(init.headers);
  const body =
    init.body == null ? undefined : typeof init.body === 'string' ? init.body : String(init.body);

  return await new Promise<Response>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const req = https.request(
      url,
      { method, headers, lookup: pinnedLookup, servername: host, timeout: timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        // No redirects: https never auto-follows, so surface any redirect (3xx≠304) as a hard failure.
        if (isDisallowedRedirect(status)) {
          res.destroy();
          return done(() => reject(new FederationSecurityError(`federation: redirect not allowed (${status})`)));
        }
        // 304 (conditional GET) carries no body — pass it straight through for the ETag cache.
        if (status === 304) {
          res.resume();
          const etag = res.headers['etag'];
          return done(() =>
            resolve(new Response(null, { status: 304, headers: etag ? { ETag: String(etag) } : {} })),
          );
        }
        const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (d: Buffer) => {
          total += d.byteLength; // enforce the size cap while streaming, regardless of content-type
          if (total > maxBytes) {
            res.destroy();
            return done(() => reject(new FederationSecurityError('federation: response exceeds size cap')));
          }
          chunks.push(d);
        });
        res.on('end', () =>
          done(() => {
            // An empty 2xx (e.g. 204 from a fire-and-forget assoc push) is fine. A NON-empty body must
            // be application/json — never let HTML/other content-confusion through.
            if (total > 0 && !contentType.includes('application/json')) {
              return reject(new FederationSecurityError('federation: non-JSON response'));
            }
            resolve(
              new Response(total > 0 ? Buffer.concat(chunks).toString('utf8') : null, {
                status,
                headers: total > 0 ? { 'Content-Type': 'application/json' } : {},
              }),
            );
          }),
        );
        res.on('error', () => done(() => reject(new FederationSecurityError('federation: response stream error'))));
      },
    );

    req.on('timeout', () => {
      req.destroy();
      done(() => reject(new FederationSecurityError('federation: request timed out')));
    });
    req.on('error', (err) => done(() => reject(err instanceof Error ? err : new FederationSecurityError('federation: request failed'))));

    if (init.signal) {
      const signal = init.signal as AbortSignal;
      if (signal.aborted) req.destroy(new FederationSecurityError('federation: aborted'));
      else signal.addEventListener('abort', () => req.destroy(new FederationSecurityError('federation: aborted')), { once: true });
    }
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// The `fetch`-typed alias the DI relay accepts as `fetchImpl`. Production injects THIS at every
// federation outbound call site so §1 is enforced everywhere; the relay's own bare-`fetch` default is
// reached only by the loopback unit tests.
export const federationFetch = guardedFetch as unknown as typeof fetch;

// ─────────────────────────────────────────────────────────────────────────────
// §8 verificationUrl pinning — the self-host device-login URL the broker returns.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §8 Validate a broker-returned `verification_url` before it is ever handed to the plugin to open: it
 * MUST be HTTPS and on the SAME host as the configured broker. A rogue/compromised broker response
 * pointing the member's browser at a phishing Discord login is refused here (belt-and-braces with the
 * plugin's own pin). Returns the URL if safe, else null.
 */
export function safeVerificationUrl(rawUrl: string | undefined | null, brokerBaseUrl: string): string | null {
  if (!rawUrl) return null;
  let u: URL;
  let broker: URL;
  try {
    u = new URL(rawUrl);
    broker = new URL(brokerBaseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.hostname.toLowerCase() !== broker.hostname.toLowerCase()) return null;
  return u.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 Token encryption at rest — cached remote-clan tokens (federation_connections.token).
// ─────────────────────────────────────────────────────────────────────────────

const ENC_PREFIX = 'fde1:'; // fed-encryption v1

/** Derive a stable 32-byte AES key from arbitrary key material (env secret). */
function deriveKey(keyMaterial: string): Buffer {
  return crypto.createHash('sha256').update(keyMaterial, 'utf8').digest();
}

/**
 * §4 Encrypt a cached secret (AES-256-GCM) for storage. Output: `fde1:<iv>:<tag>:<ct>` (base64url).
 * The caller supplies the key material (an env secret) so this module stays config-free.
 */
export function encryptSecret(plaintext: string, keyMaterial: string): string {
  const key = deriveKey(keyMaterial);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ct.toString('base64url')}`;
}

/**
 * §4 Decrypt a stored secret. A value WITHOUT the `fde1:` prefix is treated as legacy plaintext and
 * returned as-is (additive rollout — pre-encryption rows keep working; they re-encrypt on next connect).
 * A malformed/forged ciphertext throws.
 */
export function decryptSecret(stored: string, keyMaterial: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext passthrough
  const rest = stored.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, ctB64] = rest.split(':');
  if (!ivB64 || !tagB64 || !ctB64) throw new FederationSecurityError('federation: malformed encrypted token');
  const key = deriveKey(keyMaterial);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// §2/§9 Validate + cap + escape federated data before it is cached/relayed/shown.
// ─────────────────────────────────────────────────────────────────────────────

// Caps (FEDERATION_SECURITY.md §2). Names ≤64, labels ≤128; arrays bounded so a hostile clan can't
// balloon the /state payload the plugin renders.
export const CAP_NAME = 64;
export const CAP_LABEL = 128;
export const CAP_NOTE = 500;
export const CAP_TILES = 500;
export const CAP_ACTIVITY = 200;
const CAP_JSON_DEPTH = 12;

/** Clamp arbitrary input to a plain string of at most `max` chars (non-strings → ''). */
export function clampString(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.length > max ? v.slice(0, max) : v;
}

function clampInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/** §9 depth guard: reject a payload nested deeper than CAP_JSON_DEPTH (parser-DoS / JSON-bomb shape). */
export function jsonDepthOk(value: unknown, max = CAP_JSON_DEPTH, depth = 0): boolean {
  if (depth > max) return false;
  if (Array.isArray(value)) return value.every((v) => jsonDepthOk(v, max, depth + 1));
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((v) => jsonDepthOk(v, max, depth + 1));
  }
  return true;
}

export interface SafeBoardTile {
  tileId: number;
  label: string;
  points?: number;
  requiredAmount?: number;
  status?: string;
  category?: string;
}
export interface SafeBoard {
  eventId: number | null;
  name: string;
  boardSize: number | null;
  tiles: SafeBoardTile[];
}

/**
 * §2/§9 Schema-validate + clamp a remote clan's `/board` response. Drops unknown fields, clamps every
 * string (name/label) and the tiles array, coerces ids to ints, and enforces the depth guard. A wholly
 * malformed / oversuspicious payload collapses to a minimal safe object (empty board) rather than
 * throwing, so one bad clan shows empty in the sidebar instead of breaking /state.
 */
export function sanitizeFederatedBoard(raw: unknown): SafeBoard {
  const empty: SafeBoard = { eventId: null, name: '', boardSize: null, tiles: [] };
  if (!raw || typeof raw !== 'object' || !jsonDepthOk(raw)) return empty;
  const o = raw as Record<string, unknown>;
  const tilesRaw = Array.isArray(o.tiles) ? o.tiles.slice(0, CAP_TILES) : [];
  const tiles: SafeBoardTile[] = [];
  for (const t of tilesRaw) {
    if (!t || typeof t !== 'object') continue;
    const to = t as Record<string, unknown>;
    const tileId = clampInt(to.tileId);
    if (tileId == null) continue;
    const tile: SafeBoardTile = { tileId, label: clampString(to.label, CAP_LABEL) };
    const points = clampInt(to.points);
    if (points != null) tile.points = points;
    const req = clampInt(to.requiredAmount);
    if (req != null) tile.requiredAmount = req;
    if (typeof to.status === 'string') tile.status = clampString(to.status, CAP_NAME);
    if (typeof to.category === 'string') tile.category = clampString(to.category, CAP_NAME);
    tiles.push(tile);
  }
  return {
    eventId: clampInt(o.eventId),
    name: clampString(o.name, CAP_NAME),
    boardSize: clampInt(o.boardSize),
    tiles,
  };
}

export interface SafeActivityItem {
  tileId: number;
  label: string;
  points?: number;
  completedAt?: string;
}
export interface SafeActivity {
  eventId: number | null;
  teamId: number | null;
  teamName: string;
  items: SafeActivityItem[];
}

/** §2/§9 Schema-validate + clamp a remote clan's `/activity` response (same discipline as the board). */
export function sanitizeFederatedActivity(raw: unknown): SafeActivity {
  const empty: SafeActivity = { eventId: null, teamId: null, teamName: '', items: [] };
  if (!raw || typeof raw !== 'object' || !jsonDepthOk(raw)) return empty;
  const o = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items.slice(0, CAP_ACTIVITY) : [];
  const items: SafeActivityItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== 'object') continue;
    const io = it as Record<string, unknown>;
    const tileId = clampInt(io.tileId);
    if (tileId == null) continue;
    const item: SafeActivityItem = { tileId, label: clampString(io.label, CAP_LABEL) };
    const points = clampInt(io.points);
    if (points != null) item.points = points;
    if (typeof io.completedAt === 'string') item.completedAt = clampString(io.completedAt, CAP_NAME);
    items.push(item);
  }
  return {
    eventId: clampInt(o.eventId),
    teamId: clampInt(o.teamId),
    teamName: clampString(o.teamName, CAP_NAME),
    items,
  };
}

/**
 * §2 Neutralize a federated string destined for a Discord message: strip Discord markdown control
 * characters and defang mentions (`@everyone`/`@here`/`<@…>`/`<@&…>`) so a rogue clan's text can never
 * make our bot ping. (Provided for the notification path; federated text is not posted to Discord in
 * this slice, but the helper is the single sanctioned sink for when it is.)
 */
export function neutralizeDiscordText(input: string, max = CAP_NAME): string {
  return clampString(input, max)
    .replace(/@(everyone|here)/gi, '@​$1')
    .replace(/<(@[!&]?|#)(\d+)>/g, '[mention]')
    .replace(/[`*_~|\\]/g, '');
}
