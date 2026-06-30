// Verify the R2/S3 config end-to-end: PUT a tiny object with the API creds, GET it back via the
// public base URL, then delete it. Run with the S3_* env vars set. Exits non-zero on any failure.
import { AwsClient } from 'aws4fetch';

const {
  S3_ENDPOINT, S3_REGION = 'auto', S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
  S3_BUCKET, S3_PUBLIC_BASE_URL, S3_KEY_PREFIX = '',
} = process.env;

if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET || !S3_PUBLIC_BASE_URL) {
  console.error('Missing S3_* env vars');
  process.exit(1);
}

const ep = S3_ENDPOINT.replace(/\/+$/, '');
const pub = S3_PUBLIC_BASE_URL.replace(/\/+$/, '');
const prefix = S3_KEY_PREFIX ? `${S3_KEY_PREFIX}/` : '';
const key = `${prefix}_r2check/test-${process.argv[2] || 'x'}.txt`;
const body = 'anvil r2 connectivity check';

const aws = new AwsClient({ accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, region: S3_REGION, service: 's3' });

const put = await aws.fetch(`${ep}/${S3_BUCKET}/${key}`, {
  method: 'PUT', body, headers: { 'content-type': 'text/plain' },
});
console.log('PUT   ->', put.status, put.ok ? 'ok' : await put.text());

const pubUrl = `${pub}/${key}`;
const get = await fetch(pubUrl);
const text = get.ok ? await get.text() : '';
console.log('GET   ->', get.status, `(${pubUrl})`);
console.log('match ->', text === body);

await aws.fetch(`${ep}/${S3_BUCKET}/${key}`, { method: 'DELETE' }).catch(() => {});

if (!put.ok || !get.ok || text !== body) {
  console.error('R2 check FAILED');
  process.exit(1);
}
console.log('R2 OK: write + public read working.');
