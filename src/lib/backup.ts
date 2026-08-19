// Off-box database backup — a gzipped, point-in-time-consistent dump of the database uploaded to a
// PRIVATE object-storage bucket, so a dead box, a corrupt volume, or a bad migration is recoverable.
// Driven daily by cron via /api/cron/backup.
//
// ONE DUMP, EVERY CLAN. This used to be one database per clan, so a dump was a clan. It is now the
// whole deployment in a single file, which is the thing to know before a restore: there is no
// per-clan dump to reach for, and loading one of these replaces every clan at once. Recovering a
// single clan means restoring into a scratch database and copying the rows out by clan_id.
//
// This is deliberately NOT part of lib/storage.ts (clan media): media lives in a *public* bucket, and
// a full database dump must never be publicly reachable. Backups go to a dedicated private bucket
// (S3_BACKUP_BUCKET) in the same account, keyed under S3_KEY_PREFIX, pruned to the newest N.
// If that bucket isn't configured the feature is simply off — we never fall back to the media bucket.
//
// Restore: pull the object (aws/rclone), `gunzip`, then `psql -d <target> -f anvil-<ts>.sql`. The
// dump is schema+data with --no-owner/--no-acl so it loads into a differently-owned database; the
// boot migrator applies anything newer on next start.

import https from 'node:https';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  prefix: string; // deployment namespace, no leading/trailing slash — not a clan, see the header
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

/** Where pg_dump writes its temporary output before it is gzipped and uploaded. */
const DUMP_TMP_DIR = process.env.BACKUP_TMP_DIR || '/tmp';

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
 * Dump the database, gzip it, and upload it to the private backup bucket; then prune to the newest
 * RETAIN copies. No-op (ok:true, skipped) when the backup bucket isn't configured. Never throws for
 * expected conditions — returns a result object.
 *
 * pg_dump runs a single consistent snapshot transaction, so the dump is point-in-time consistent
 * without pausing writes. It is invoked with execFile (argv, no shell), so the connection string —
 * which carries a password — never goes through a shell and cannot be word-split.
 */
export async function backupDatabase(): Promise<BackupResult> {
  const cfg = backupConfig();
  if (!cfg) return { ok: true, skipped: 'S3_BACKUP_BUCKET not configured' };
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: true, skipped: 'DATABASE_URL not set' };

  const tmp = `${DUMP_TMP_DIR}/anvil-backup-${process.pid}-${Date.now()}.sql`;
  try {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
    execFileSync('pg_dump', ['--no-owner', '--no-acl', '--file', tmp, url], { stdio: 'pipe' });
    const gz = gzipSync(readFileSync(tmp));

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = cfg.prefix ? `${cfg.prefix}/backups` : 'backups';
    const key = `${dir}/anvil-${ts}.sql.gz`;
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
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
}
