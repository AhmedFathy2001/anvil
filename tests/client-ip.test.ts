// Client-IP resolution for per-IP rate limiting.
//
// Run: node --experimental-strip-types --test tests/client-ip.test.ts
// (lib/clientIp imports nothing from `@/`, so Node's native TS type-stripping runs it directly with
//  no bundler, DB, or Next runtime.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getClientIp } from '../src/lib/clientIp.ts';

// ── getClientIp trusts the PROXY-APPENDED value (x-real-ip / last XFF), never the leftmost ──
test('getClientIp uses the appended IP, never the spoofable leftmost XFF entry', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
  // A spoofed leftmost + the real appended rightmost → we take the RIGHTMOST (what our proxy added).
  assert.equal(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' })), '9.9.9.9');
  // x-real-ip (Caddy) wins over XFF entirely.
  assert.equal(getClientIp(req({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 8.8.8.8' })), '9.9.9.9');
  // Single-entry XFF → that entry (the proxy added it).
  assert.equal(getClientIp(req({ 'x-forwarded-for': '5.5.5.5' })), '5.5.5.5');
  // Whitespace + trailing commas tolerated; still rightmost.
  assert.equal(getClientIp(req({ 'x-forwarded-for': 'aa , bb , cc ' })), 'cc');
  // No proxy header → a single shared 'unknown' bucket (a direct/local call), never a spoofed value.
  assert.equal(getClientIp(req({})), 'unknown');
  // An empty/whitespace x-real-ip must fall through to XFF rather than becoming the bucket key.
  assert.equal(getClientIp(req({ 'x-real-ip': '  ', 'x-forwarded-for': '7.7.7.7' })), '7.7.7.7');
});
