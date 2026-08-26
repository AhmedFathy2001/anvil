// Object storage adapter — the single choke point for media (drop-proof screenshots,
// fee proofs). Two drivers so the same code self-hosts and runs on Vercel:
//
//   - 's3'          → any S3-compatible store. Recommended: Cloudflare R2 (free egress).
//                     Used by hosted/self-hosted Docker instances.
//   - 'vercel-blob' → @vercel/blob. The zero-config default for the open-source Vercel path.
//
// Driver selection (STORAGE_DRIVER overrides; otherwise auto): S3 when S3_BUCKET is set,
// else Vercel Blob. Call sites only see put()/del() and a public URL string — they never
// know which backend stored the bytes.

import https from 'node:https';
import { put as blobPut, del as blobDel } from '@vercel/blob';
import { AwsClient } from 'aws4fetch';
import { requireSecret } from './env';

export type StorageBody = Buffer | File;

export interface PutResult {
  /** Public URL the object is served from; persisted in the DB. */
  url: string;
}

type Driver = 's3' | 'vercel-blob';

function resolveDriver(): Driver {
  const explicit = process.env.STORAGE_DRIVER?.toLowerCase();
  if (explicit === 's3' || explicit === 'r2') return 's3';
  if (explicit === 'vercel-blob' || explicit === 'blob') return 'vercel-blob';
  // Auto: a configured bucket means S3 is the intended backend.
  return process.env.S3_BUCKET ? 's3' : 'vercel-blob';
}

// ─── S3 / R2 driver ──────────────────────────────────────────────────────────

interface S3Config {
  client: AwsClient;
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com (no trailing slash)
  bucket: string;
  publicBase: string; // e.g. https://media.anvil.gg (no trailing slash)
  keyPrefix: string; // optional per-clan prefix, e.g. "myclan" — no leading/trailing slash
}

let s3Cache: S3Config | null = null;

function s3Config(): S3Config {
  if (s3Cache) return s3Cache;
  const endpoint = requireSecret('S3_ENDPOINT', 'http://localhost:9000').replace(/\/+$/, '');
  const bucket = requireSecret('S3_BUCKET', 'anvil-dev');
  const accessKeyId = requireSecret('S3_ACCESS_KEY_ID', 'dev');
  const secretAccessKey = requireSecret('S3_SECRET_ACCESS_KEY', 'devsecret');
  const region = process.env.S3_REGION || 'auto';
  // Where objects are served from publicly. Defaults to the API endpoint/bucket (works for
  // dev/MinIO); in prod set S3_PUBLIC_BASE_URL to your media domain (R2 custom domain or r2.dev).
  const publicBase = (process.env.S3_PUBLIC_BASE_URL || `${endpoint}/${bucket}`).replace(/\/+$/, '');
  const keyPrefix = (process.env.S3_KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');

  const client = new AwsClient({ accessKeyId, secretAccessKey, region, service: 's3' });
  s3Cache = { client, endpoint, bucket, publicBase, keyPrefix };
  return s3Cache;
}

/**
 * A per-clan object key. On the shared platform one deployment serves every clan, so the single
 * S3_KEY_PREFIX env cannot separate one clan's media from another's — every new upload would land
 * under one prefix. Namespacing the key by clan slug (`c/<slug>/…`) restores that separation.
 *
 * Existing media is untouched and needs no migration: submissions store ABSOLUTE URLs, so objects
 * uploaded before this keep resolving exactly where they are. Only NEW keys gain the clan segment.
 * The env prefix, if set, still applies on top (deployment-level); on the merged app it is empty.
 */
export function clanMediaKey(clanSlug: string | null | undefined, key: string): string {
  const clean = key.replace(/^\/+/, '');
  return clanSlug ? `c/${clanSlug}/${clean}` : clean;
}

function prefixedKey(cfg: S3Config, key: string): string {
  const clean = key.replace(/^\/+/, '');
  return cfg.keyPrefix ? `${cfg.keyPrefix}/${clean}` : clean;
}

// Derive a safe stored content-type from the object key's extension. We deliberately never fall
// back to a File's client-declared `.type`: that MIME is attacker-controlled at upload time and a
// value like text/html or image/svg+xml would make the stored bytes execute when opened from the
// media host (stored XSS). Unknown extensions store as a non-executable octet-stream download.
const KEY_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};
function contentTypeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return KEY_CONTENT_TYPE[ext] ?? 'application/octet-stream';
}

async function s3Put(key: string, body: StorageBody, contentType?: string): Promise<PutResult> {
  const cfg = s3Config();
  const objectKey = prefixedKey(cfg, key);
  const target = `${cfg.endpoint}/${cfg.bucket}/${objectKey}`;
  const ct = contentType ?? contentTypeFromKey(key);
  const bytes = body instanceof File ? Buffer.from(await body.arrayBuffer()) : Buffer.from(body);

  // Sign with aws4fetch, then send the PUT over node:https — NOT global fetch. Next.js's patched
  // fetch doesn't reliably emit Content-Length for a binary body, so R2 rejects it with 411
  // MissingContentLength (plain-Node undici does emit it, which is why the migrate/CDN scripts
  // worked but the app route didn't). node:https lets us set Content-Length explicitly and is
  // immune to whatever the framework does to fetch. aws4fetch computes x-amz-content-sha256 from the
  // same bytes we send, so the signature stays valid.
  const signed = await cfg.client.sign(target, {
    method: 'PUT',
    body: bytes,
    headers: ct ? { 'content-type': ct } : {},
  });
  const headers: Record<string, string> = {};
  signed.headers.forEach((v, k) => { headers[k] = v; });
  headers['content-length'] = String(bytes.byteLength);

  const u = new URL(target);
  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      { hostname: u.hostname, port: 443, path: `${u.pathname}${u.search}`, method: 'PUT', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) resolve();
          else reject(new Error(`S3 put failed (${status}) for ${objectKey}: ${Buffer.concat(chunks).toString()}`));
        });
      },
    );
    req.on('error', reject);
    req.end(bytes);
  });
  return { url: `${cfg.publicBase}/${objectKey}` };
}

/** Recover the object key from a stored public URL so we can address it for deletion. */
function s3KeyFromUrl(cfg: S3Config, url: string): string | null {
  if (url.startsWith(`${cfg.publicBase}/`)) return url.slice(cfg.publicBase.length + 1);
  // Fall back to the raw endpoint/bucket form in case publicBase was changed after upload.
  const raw = `${cfg.endpoint}/${cfg.bucket}/`;
  if (url.startsWith(raw)) return url.slice(raw.length);
  return null;
}

async function s3Del(urls: string[]): Promise<void> {
  const cfg = s3Config();
  await Promise.all(
    urls.map(async (url) => {
      const key = s3KeyFromUrl(cfg, url);
      if (!key) return; // foreign URL (e.g. a manually pasted image) — leave it alone
      const target = `${cfg.endpoint}/${cfg.bucket}/${key}`;
      await cfg.client.fetch(target, { method: 'DELETE' }).catch(() => {});
    }),
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Store an object and return its public URL. `key` is the object path (e.g.
 * `submissions/<uuid>.webp`); the active driver decides where the bytes land.
 */
export async function put(key: string, body: StorageBody, contentType?: string): Promise<PutResult> {
  const safeContentType = contentType ?? contentTypeFromKey(key);
  if (resolveDriver() === 's3') return s3Put(key, body, safeContentType);
  const { url } = await blobPut(key, body, { access: 'public', contentType: safeContentType });
  return { url };
}

/**
 * Is this URL one we serve media from? Used to reject arbitrary/phishy image hosts on submission.
 * Accepts the configured S3/R2 public base (current uploads) and Vercel Blob hosts (the previous
 * driver — keeps already-stored proof URLs valid after a migration to R2).
 */
export function isManagedMediaUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.hostname.endsWith('.blob.vercel-storage.com')) return true;
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) {
    try {
      if (u.host === new URL(base).host) return true;
    } catch {
      /* ignore a malformed base */
    }
  }
  return false;
}

/** Best-effort delete of one or more previously stored objects, addressed by public URL. */
export async function del(urls: string | string[]): Promise<void> {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (list.length === 0) return;
  if (resolveDriver() === 's3') return s3Del(list);
  await blobDel(list);
}
