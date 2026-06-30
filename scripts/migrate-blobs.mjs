// Copy existing media off Vercel Blob onto R2 and emit the DB URL rewrites.
//
// Input: a TSV of `table<TAB>id<TAB>url` rows (one per Vercel-Blob image). For each row it fetches
// the (public) Vercel blob, PUTs it to R2 under `${S3_KEY_PREFIX}/<original pathname>`, and records
// an UPDATE. Writes updates.sql to apply against the clan DB afterwards. Idempotent-ish: re-running
// just re-uploads + re-emits the same statements.
//
// Usage: S3_* env set; node scripts/migrate-blobs.mjs rows.tsv
import { AwsClient } from 'aws4fetch';
import { readFileSync, writeFileSync } from 'fs';

const {
  S3_ENDPOINT, S3_REGION = 'auto', S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
  S3_BUCKET, S3_PUBLIC_BASE_URL, S3_KEY_PREFIX = '',
} = process.env;
if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET || !S3_PUBLIC_BASE_URL) {
  console.error('Missing S3_* env');
  process.exit(1);
}

const aws = new AwsClient({ accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, region: S3_REGION, service: 's3' });
const ep = S3_ENDPOINT.replace(/\/+$/, '');
const pub = S3_PUBLIC_BASE_URL.replace(/\/+$/, '');
const prefix = S3_KEY_PREFIX ? `${S3_KEY_PREFIX.replace(/\/+$/, '')}/` : '';
const colFor = (t) => (t === 'submissions' ? 'image_url' : 'proof_blob_url');

const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
console.log(`migrating ${rows.length} blobs → R2 …`);

const updates = [];
let ok = 0, fail = 0;
for (const [table, id, url] of rows) {
  try {
    const key = prefix + new URL(url).pathname.replace(/^\/+/, '');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const ct = res.headers.get('content-type') || 'application/octet-stream';
    const bytes = new Uint8Array(await res.arrayBuffer());
    const put = await aws.fetch(`${ep}/${S3_BUCKET}/${key}`, { method: 'PUT', body: bytes, headers: { 'content-type': ct } });
    if (!put.ok) throw new Error(`put ${put.status}: ${await put.text().catch(() => '')}`);
    const newUrl = `${pub}/${key}`;
    updates.push(`UPDATE ${table} SET ${colFor(table)}='${newUrl.replace(/'/g, "''")}' WHERE id=${Number(id)};`);
    ok++;
    if (ok % 20 === 0) process.stdout.write(` ${ok}`);
    else process.stdout.write('.');
  } catch (e) {
    fail++;
    console.error(`\nFAIL ${table}#${id}: ${e.message}`);
  }
}

writeFileSync('updates.sql', updates.join('\n') + '\n');
console.log(`\nmigrated ${ok}, failed ${fail}. wrote updates.sql (${updates.length} statements).`);
if (fail > 0) process.exitCode = 1;
