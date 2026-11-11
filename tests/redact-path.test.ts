// Run: npx tsx --test tests/redact-path.test.ts (pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPathQuery } from '../src/lib/redactPath.ts';

test('the Gumroad webhook secret never reaches the error log', () => {
  assert.equal(redactPathQuery('/api/webhooks/gumroad?key=s3cret'), '/api/webhooks/gumroad?key=REDACTED');
  assert.equal(redactPathQuery('/api/auth/callback?code=abc&state=xyz&next=%2Fadmin'), '/api/auth/callback?code=REDACTED&state=REDACTED&next=%2Fadmin');
  assert.equal(redactPathQuery('/admin/events?tab=teams'), '/admin/events?tab=teams');
  assert.equal(redactPathQuery('/events/5'), '/events/5');
});
