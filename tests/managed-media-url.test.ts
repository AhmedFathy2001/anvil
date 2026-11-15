import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isManagedMediaUrl, isClanMediaUrl } from '../src/lib/storage';

const saved = { base: process.env.S3_PUBLIC_BASE_URL, legacy: process.env.LEGACY_BLOB_HOST };
afterEach(() => {
  if (saved.base === undefined) delete process.env.S3_PUBLIC_BASE_URL; else process.env.S3_PUBLIC_BASE_URL = saved.base;
  if (saved.legacy === undefined) delete process.env.LEGACY_BLOB_HOST; else process.env.LEGACY_BLOB_HOST = saved.legacy;
});

test('an https media base accepts only https links on its host', () => {
  process.env.S3_PUBLIC_BASE_URL = 'https://media.example.com';
  assert.equal(isManagedMediaUrl('https://media.example.com/c/ironforge/submissions/a.webp'), true);
  assert.equal(isManagedMediaUrl('http://media.example.com/c/ironforge/submissions/a.webp'), false);
  assert.equal(isManagedMediaUrl('https://evil.example.com/c/ironforge/submissions/a.webp'), false);
  assert.equal(isManagedMediaUrl('not a url'), false);
});

test('a local http store is accepted once it is the configured base, port included', () => {
  process.env.S3_PUBLIC_BASE_URL = 'http://127.0.0.1:9100/anvil-dev';
  const url = 'http://127.0.0.1:9100/anvil-dev/c/ironforge/submissions/a.webp';
  assert.equal(isManagedMediaUrl(url), true);
  assert.equal(isManagedMediaUrl('http://127.0.0.1:9999/anvil-dev/c/ironforge/submissions/a.webp'), false);
  assert.equal(isClanMediaUrl(url, 'ironforge'), true);
  assert.equal(isClanMediaUrl(url, 'second-wind'), false);
});

test('with no base configured nothing is ours, and the legacy host stays https-only', () => {
  delete process.env.S3_PUBLIC_BASE_URL;
  assert.equal(isManagedMediaUrl('http://localhost:9000/anvil-dev/a.webp'), false);
  process.env.LEGACY_BLOB_HOST = 'old.example.com';
  assert.equal(isManagedMediaUrl('https://old.example.com/a.png'), true);
  assert.equal(isManagedMediaUrl('http://old.example.com/a.png'), false);
});
