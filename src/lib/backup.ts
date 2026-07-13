// Off-box database backup — a gzipped, point-in-time-consistent copy of a clan's SQLite DB uploaded
// to a PRIVATE object-storage bucket, so a dead box, a corrupt volume, or a bad migration is
// recoverable. Driven daily (staggered) by the control-plane cron dispatcher via /api/cron/backup.
//
// This is deliberately NOT part of lib/storage.ts (clan media): media lives in a *public* bucket, and
// a full database dump must never be publicly reachable. Backups go to a dedicated private bucket
// (S3_BACKUP_BUCKET) in the same account, keyed under the clan's slug prefix, pruned to the newest N.
// If that bucket isn't configured the feature is simply off — we never fall back to the media bucket.
//
// Restore: pull the object (aws/rclone), `gunzip`, drop it in at /data/anvil.db (stop the container
// first). It's a standalone SQLite file — the boot migrator applies anything newer on next start.

import https from 'node:https';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { AwsClient } from 'aws4fetch';

export interface BackupResult {
  ok: boolean;
  /** Set (with ok:true) when the backup was intentionally not taken — e.g. remote DB / not configured. */
  skipped?: string;
  key?: string;
  bytes?: number;
  pruned?: number;
  error?: string;
}

interface BackupConfig {
  client: AwsClient;
  endpoint: string; // no trailing slash
  bucket: string;
  prefix: string; // per-clan namespace (slug), no leading/trailing slash
}

function backupConfig(): BackupConfig | null {
  const bucket = process.env.S3_BACKUP_BUCKET;
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, '');
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  // Backups require a DEDICATED private bucket + creds. If any is missing we do NOT fall back to the
  // public media bucket (S3_BUCKET) — that would expose the whole database. Missing config = off.
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  const region = process.env.S3_REGION || 'auto';
  const prefix = (process.env.S3_KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const client = new AwsClient({ accessKeyId, secretAccessKey, region, service: 's3' });
  return { client, endpoint, bucket, prefix };
}

export function isBackupConfigured(): boolean {
  return backupConfig() !== null;
}

const RETAIN = Number(process.env.BACKUP_RETAIN || 14);

/** Resolve the local SQLite file path from DATABASE_URL, or null for a non-file (remote) DB. */
function localDbPath(): string | null {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || '';
  if (!url.startsWith('file:')) return null;
  return url.slice('file:'.length).replace(/^\/\//, '/'); // file:/data/anvil.db -> /data/anvil.db
}

/**
 * Signed S3/R2 PUT over node:https (not global fetch): Next's patched fetch doesn't reliably emit
 * Content-Length for a binary body, which R2 rejects with 411 — the same reason lib/storage.ts uses
 * node:https for media. aws4fetch signs from the exact bytes we send, so the signature stays valid.
 */
async function s3Put(cfg: BackupConfig, key: string, bytes: Buffer, contentType: string): Promise<void> {
  const target = `${cfg.endpoint}/${cfg.bucket}/${key}`;
  // Sign over a Uint8Array view (BodyInit); the identical bytes are sent below over node:https, so the
  // x-amz-content-sha256 aws4fetch computes stays valid.
  const signed = await cfg.client.sign(target, {
    method: 'PUT',
    body: new Uint8Array(bytes),
    headers: { 'content-type': contentType },
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
          else reject(new Error(`backup put failed (${status}) for ${key}: ${Buffer.concat(chunks).toString()}`));
        });
      },
    );
    req.on('error', reject);
    req.end(bytes);
  });
}

/** List existing backup object keys under a prefix (ListObjectsV2), oldest-sortable order. */
async function s3ListKeys(cfg: BackupConfig, keyPrefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const qs = new URLSearchParams({ 'list-type': '2', prefix: keyPrefix });
    if (token) qs.set('continuation-token', token);
    const res = await cfg.client.fetch(`${cfg.endpoint}/${cfg.bucket}?${qs}`, { method: 'GET' });
    if (!res.ok) throw new Error(`backup list failed (${res.status})`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    const tok = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = tok ? tok[1] : undefined;
  } while (token);
  return keys;
}

async function s3Delete(cfg: BackupConfig, key: string): Promise<void> {
  await cfg.client.fetch(`${cfg.endpoint}/${cfg.bucket}/${key}`, { method: 'DELETE' }).catch(() => {});
}

/**
 * Take a consistent snapshot of the local SQLite DB, gzip it, and upload it to the private backup
 * bucket; then prune to the newest RETAIN copies. No-op (ok:true, skipped) for a remote DB or when
 * the backup bucket isn't configured. Never throws for expected conditions — returns a result object.
 */
export async function backupDatabase(): Promise<BackupResult> {
  const cfg = backupConfig();
  if (!cfg) return { ok: true, skipped: 'S3_BACKUP_BUCKET not configured' };
  const dbPath = localDbPath();
  if (!dbPath) return { ok: true, skipped: 'remote DB (no local file to snapshot)' };
  if (!existsSync(dbPath) || statSync(dbPath).size === 0) return { ok: true, skipped: 'empty DB' };

  const tmp = `${dbPath}.bak-tmp-${process.pid}-${Date.now()}`;
  const client = createClient({ url: `file:${dbPath}` });
  try {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
    // VACUUM INTO -> a fully consistent standalone copy (safe under WAL). Target must not pre-exist;
    // the pid+ts name guarantees that. Path is process-controlled; escape quotes defensively since
    // VACUUM takes no bound parameter.
    await client.execute(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const gz = gzipSync(readFileSync(tmp));

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = cfg.prefix ? `${cfg.prefix}/backups` : 'backups';
    const key = `${dir}/anvil-${ts}.db.gz`;
    await s3Put(cfg, key, gz, 'application/gzip');

    // Prune: keep the newest RETAIN. Keys are ISO-timestamped, so a lexical sort is chronological.
    let pruned = 0;
    try {
      const existing = (await s3ListKeys(cfg, `${dir}/`)).sort();
      for (const old of existing.slice(0, Math.max(0, existing.length - RETAIN))) {
        await s3Delete(cfg, old);
        pruned++;
      }
    } catch {
      /* pruning is best-effort; a failed list/delete must not fail the backup itself */
    }

    return { ok: true, key, bytes: gz.byteLength, pruned };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    client.close();
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
}
