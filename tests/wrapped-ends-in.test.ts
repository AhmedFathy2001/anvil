import test from 'node:test';
import assert from 'node:assert/strict';
import { endsInLabel } from '../src/app/events/[eventId]/wrapped/endsIn';

const now = Date.UTC(2026, 10, 15, 12, 0, 0);
test('endsInLabel words the time left', () => {
  assert.equal(endsInLabel(now - 1, now), null);
  assert.equal(endsInLabel(now + 10_000, now), 'soon');
  assert.equal(endsInLabel(now + 61 * 60_000, now), 'in 1 hour');
  assert.equal(endsInLabel(now + 30 * 60_000, now), 'in 30 minutes');
  assert.equal(endsInLabel(now + 5 * 3_600_000, now), 'in 5 hours');
  assert.equal(endsInLabel(now + 3 * 86_400_000, now), 'in 3 days');
  assert.equal(endsInLabel(NaN, now), null);
});
