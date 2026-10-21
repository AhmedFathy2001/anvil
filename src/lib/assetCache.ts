// Read-through cache for the game art we serve at /img/wiki/* and /img/item/*.
//
//   memory  a small byte-capped LRU, so a hot icon costs nothing at all
//   store   the media bucket (S3/R2, `asset-cache/…` keys) when one is configured; otherwise a local
//           directory — ASSET_CACHE_DIR, else /data/asset-cache (the volume that survives redeploys),
//           else .cache/assets under the working directory, else a private temp dir
//   origin  the OSRS wiki or RuneLite's static host, fetched once per key: 5s timeout, a descriptive
//           User-Agent, redirects followed by hand and only onto those two hosts, and the bytes must
//           be a real raster image (header AND magic number) before anything is stored
//
// A failure is never written to the store — it is the caller's to answer with a placeholder and a
// short cache life, so the next request after it tries again. Concurrent misses for one key share a
// single fetch. Every storage error degrades to "fetch from origin"; nothing here throws.

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assetCacheKey, parseAssetPath, upstreamUrl, UPSTREAM_HOSTS, type AssetRef } from '@/lib/assetUrls';
import { log } from '@/lib/logger';
import { getObject, put, s3Enabled } from '@/lib/storage';

export interface CachedAsset {
  bytes: Buffer;
  contentType: string;
}

const USER_AGENT = 'AnvilOSRS-asset-cache (+https://anvilosrs.com)';
const UPSTREAM_TIMEOUT_MS = 5_000;
const MAX_BYTES = 8 * 1024 * 1024;

// ── Image sniffing ──

/** The image type the bytes actually are, from their magic number; null for anything else. */
export function sniffImageType(b: Uint8Array): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (
    b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'image/webp';
  return null;
}

// ── Memory LRU ──

const MEMORY_CAP_BYTES = 32 * 1024 * 1024;
const memory = new Map<string, CachedAsset>();
let memoryBytes = 0;

function memoryGet(key: string): CachedAsset | null {
  const hit = memory.get(key);
  if (!hit) return null;
  memory.delete(key);
  memory.set(key, hit);
  return hit;
}

function memorySet(key: string, asset: CachedAsset): void {
  if (asset.bytes.byteLength > MEMORY_CAP_BYTES / 8) return;
  const old = memory.get(key);
  if (old) {
    memoryBytes -= old.bytes.byteLength;
    memory.delete(key);
  }
  memory.set(key, asset);
  memoryBytes += asset.bytes.byteLength;
  for (const [k, v] of memory) {
    if (memoryBytes <= MEMORY_CAP_BYTES) break;
    memory.delete(k);
    memoryBytes -= v.bytes.byteLength;
  }
}

// ── Disk store (no bucket configured) ──

let diskDirPromise: Promise<string | null> | null = null;

function diskDir(): Promise<string | null> {
  diskDirPromise ??= (async () => {
    const candidates = [
      process.env.ASSET_CACHE_DIR,
      path.join('/data', 'asset-cache'),
      path.join(process.cwd(), '.cache', 'assets'),
    ].filter((d): d is string => !!d);
    for (const dir of candidates) {
      try {
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await writeFile(path.join(dir, '.probe'), '');
        return dir;
      } catch {
        // Not writable here; try the next one.
      }
    }
    try {
      return await mkdtemp(path.join(os.tmpdir(), 'anvil-asset-cache-'));
    } catch {
      return null;
    }
  })();
  return diskDirPromise;
}

async function diskGet(key: string): Promise<CachedAsset | null> {
  const dir = await diskDir();
  if (!dir) return null;
  try {
    const bytes = await readFile(path.join(dir, key));
    const contentType = sniffImageType(bytes);
    return contentType ? { bytes, contentType } : null;
  } catch {
    return null;
  }
}

async function diskPut(key: string, bytes: Buffer): Promise<void> {
  const dir = await diskDir();
  if (!dir) return;
  const file = path.join(dir, key);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(tmp, bytes);
    await rename(tmp, file);
  } catch {
    // A cache that can't write is just a slower cache.
  }
}

// ── Store (bucket or disk) ──

async function storeGet(key: string): Promise<CachedAsset | null> {
  if (!s3Enabled()) return diskGet(key);
  try {
    const obj = await getObject(key);
    if (!obj) return null;
    const contentType = sniffImageType(obj.bytes);
    return contentType ? { bytes: obj.bytes, contentType } : null;
  } catch (err) {
    warnOnce(`store-get:${key}`, 'asset-cache.store-get-failed', { key }, err);
    return null;
  }
}

async function storePut(key: string, asset: CachedAsset): Promise<void> {
  if (!s3Enabled()) return diskPut(key, asset.bytes);
  try {
    await put(key, asset.bytes, asset.contentType);
  } catch (err) {
    warnOnce(`store-put:${key}`, 'asset-cache.store-put-failed', { key }, err);
  }
}

// ── Origin ──

const warned = new Set<string>();

function warnOnce(id: string, event: string, meta: Record<string, unknown>, err?: unknown): void {
  if (warned.has(id)) return;
  if (warned.size > 5_000) warned.clear();
  warned.add(id);
  log.warn(event, meta, err);
}

function allowedUpstream(raw: string, base?: URL): URL | null {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    return u.protocol === 'https:' && UPSTREAM_HOSTS.has(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

/** Fetch from origin and verify. Null (and one warning per key) on any failure. */
async function fetchUpstream(ref: AssetRef, key: string): Promise<CachedAsset | null> {
  const first = upstreamUrl(ref);
  let target = allowedUpstream(first);
  let reason = 'redirect-not-allowed';
  try {
    for (let hop = 0; target && hop <= 2; hop++) {
      const res = await fetch(target, {
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location');
        target = next ? allowedUpstream(next, target) : null;
        continue;
      }
      if (res.status !== 200) {
        reason = `status-${res.status}`;
        break;
      }
      const declared = (res.headers.get('content-type') ?? '').toLowerCase();
      if (!declared.startsWith('image/')) {
        reason = `content-type-${declared || 'missing'}`;
        break;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
        reason = `size-${bytes.byteLength}`;
        break;
      }
      const contentType = sniffImageType(bytes);
      if (!contentType) {
        reason = 'not-a-raster-image';
        break;
      }
      return { bytes, contentType };
    }
  } catch (err) {
    reason = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'timeout' : `error-${String(err)}`;
  }
  warnOnce(`upstream:${key}`, 'asset-cache.upstream-failed', { key, url: first, reason });
  return null;
}

// ── Public API ──

const inFlight = new Map<string, Promise<CachedAsset | null>>();

/**
 * The bytes for a cached asset — memory, then the store, then origin (stored on success). Null when
 * origin could not supply a valid image; that outcome is NOT cached anywhere, so it is retried.
 */
export function getAsset(ref: AssetRef): Promise<CachedAsset | null> {
  const key = assetCacheKey(ref);
  const hot = memoryGet(key);
  if (hot) return Promise.resolve(hot);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async () => {
    const stored = await storeGet(key);
    if (stored) {
      memorySet(key, stored);
      return stored;
    }
    const fresh = await fetchUpstream(ref, key);
    if (!fresh) return null;
    memorySet(key, fresh);
    await storePut(key, fresh);
    return fresh;
  })()
    .catch(() => null)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** As {@link getAsset}, from one of our `/img/…` paths. Null for a path that names nothing valid. */
export async function getAssetByPath(urlPath: string): Promise<CachedAsset | null> {
  const ref = parseAssetPath(urlPath);
  return ref ? getAsset(ref) : null;
}

// ── HTTP responses ──

/** 1×1 transparent PNG: what a broken upstream image looks like here — nothing, briefly. */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export function assetResponse(asset: CachedAsset): Response {
  const etag = `"${createHash('sha1').update(asset.bytes).digest('base64url').slice(0, 27)}"`;
  return new Response(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      'Content-Type': asset.contentType,
      'Content-Length': String(asset.bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** The placeholder, cached for five minutes so a recovered upstream shows up soon after. */
export function placeholderResponse(status = 200): Response {
  return new Response(new Uint8Array(PLACEHOLDER_PNG), {
    status,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(PLACEHOLDER_PNG.byteLength),
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
