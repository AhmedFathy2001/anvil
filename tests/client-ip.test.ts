// Client-IP resolution for per-IP rate limiting.
//
// Run: node --experimental-strip-types --test tests/client-ip.test.ts
// (lib/clientIp imports nothing from `@/`, so Node's native TS type-stripping runs it directly with
//  no bundler, DB, or Next runtime.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getClientIp } from '../src/lib/clientIp.ts';

// ── getClientIp trusts Cloudflare's header, then the proxy-appended XFF hop, never a client value ──
test('getClientIp prefers CF-Connecting-IP, which Cloudflare overwrites', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
  assert.equal(getClientIp(req({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 172.18.0.5' })), '9.9.9.9');
  // Whitespace-only falls through rather than becoming the bucket key.
  assert.equal(getClientIp(req({ 'cf-connecting-ip': '  ', 'x-forwarded-for': '7.7.7.7' })), '7.7.7.7');
});

test('getClientIp ignores a client-sent X-Real-IP (nothing in front of us sets it)', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
  assert.equal(getClientIp(req({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '8.8.8.8' })), '8.8.8.8');
  assert.equal(getClientIp(req({ 'x-real-ip': '6.6.6.6' })), 'unknown');
});

test('getClientIp falls back to the appended XFF hop, never the spoofable leftmost entry', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
  assert.equal(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' })), '9.9.9.9');
  assert.equal(getClientIp(req({ 'x-forwarded-for': '5.5.5.5' })), '5.5.5.5');
  assert.equal(getClientIp(req({ 'x-forwarded-for': 'aa , bb , cc ' })), 'cc');
  assert.equal(getClientIp(req({})), 'unknown');
});
