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

function prefixedKey(cfg: S3Config, key: string): string {
  const clean = key.replace(/^\/+/, '');
  return cfg.keyPrefix ? `${cfg.keyPrefix}/${clean}` : clean;
}

async function s3Put(key: string, body: StorageBody, contentType?: string): Promise<PutResult> {
  const cfg = s3Config();
  const objectKey = prefixedKey(cfg, key);
  const target = `${cfg.endpoint}/${cfg.bucket}/${objectKey}`;
  // Always send a fixed-length body (Uint8Array). Passing a File/Blob streams it without a
  // Content-Length header, which R2 rejects with 411 MissingContentLength. Buffers are already
  // length-known. Convert a File to bytes here so both the submissions (Buffer) and fee-proof
  // (File) callers work. Default the content-type from the File when the caller didn't pass one.
  const ct = contentType ?? (body instanceof File ? body.type : undefined);
  const payload = body instanceof File ? new Uint8Array(await body.arrayBuffer()) : new Uint8Array(body);
  const res = await cfg.client.fetch(target, {
    method: 'PUT',
    body: payload,
    headers: ct ? { 'content-type': ct } : {},
  });
  if (!res.ok) {
    throw new Error(`S3 put failed (${res.status}) for ${objectKey}: ${await res.text().catch(() => '')}`);
  }
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
  if (resolveDriver() === 's3') return s3Put(key, body, contentType);
  const { url } = await blobPut(key, body, { access: 'public', contentType });
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
