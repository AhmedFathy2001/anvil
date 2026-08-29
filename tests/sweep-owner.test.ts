// Which process is allowed to fetch the hiscores.
//
// Both sweeping means both polling Jagex, and that is the one budget here that cannot be bought
// back: exceed what they tolerate and the box's IP is blocked, which stops tracking for every clan
// at once. The two failure directions are not symmetric — both-off is loud and both-on is silent —
// so this suite is mostly about the silent one.
//
// Run: npx tsx --test tests/sweep-owner.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideSweep } from '../src/lib/sweepOwner.ts';

const now = new Date('2026-08-29T12:00:00Z');
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);

test('with no Forge anywhere, this app sweeps', async () => {
  // The default, and every deployment that has never heard of Forge. Failing this way round would
  // stop tracking on sites that have done nothing wrong.
  const d = decideSweep('site', null, now);
  assert.equal(d.run, true);
  assert.equal(d.reason, 'site-owns');
});

test('a declared handover to an active Forge stands this app down', async () => {
  const d = decideSweep('forge', minutesAgo(1), now);
  assert.equal(d.run, false);
  assert.equal(d.reason, 'declared-forge');
});

// ── The silent failure this module exists for ─────────────────────────────────────────────────

test('an ACTIVE Forge stands this app down even when the config says otherwise', async () => {
  // The ordinary way two services end up both sweeping: Forge is turned on and the Site's env var is
  // forgotten. Nothing looks wrong from the outside — right up until Jagex stops answering.
  const d = decideSweep('site', minutesAgo(2), now);
  assert.equal(d.run, false, 'observed activity beats the declaration');
  assert.equal(d.reason, 'forge-active');
  assert.match(d.detail, /STATS_SWEEP_OWNER=forge/, 'and it says how to make it intentional');
});

test('a long-stale Forge does not silently hold the sweep hostage', async () => {
  // Forge recorded a run once and then stopped. The declaration still says site, so this app takes
  // it — the backstop is about avoiding OVERLAP, not about ceding the sweep to a corpse.
  const d = decideSweep('site', minutesAgo(120), now);
  assert.equal(d.run, true);
  assert.equal(d.reason, 'site-owns');
});

test('a declared handover to a DEAD Forge stops, loudly, rather than failing over', async () => {
  // Deliberately does not resume. A silent failover means two sweeps the instant Forge recovers,
  // which is the exact outcome being guarded against — so this stops and says so instead.
  const d = decideSweep('forge', minutesAgo(90), now);
  assert.equal(d.run, false, 'no automatic failover');
  assert.equal(d.reason, 'forge-stale');
  assert.match(d.detail, /NOTHING IS BEING TRACKED/, 'and the log says so in as many words');
  assert.match(d.detail, /STATS_SWEEP_OWNER=site/, 'with the way to take it back');
});

test('declared-forge but Forge never ran at all is the same loud stop', async () => {
  const d = decideSweep('forge', null, now);
  assert.equal(d.run, false);
  assert.equal(d.reason, 'forge-stale');
  assert.match(d.detail, /never recorded a run/);
});

// ── The property that matters more than any individual case ───────────────────────────────────

test('no combination of inputs ever lets both sweep', async () => {
  // Exhaustive over the decision space: for every declaration and every plausible Forge age, if
  // Forge is currently active then this app must not be.
  const ages = [0, 1, 5, 15, 29, 30, 31, 60, 120, 1440];
  for (const declared of ['site', 'forge'] as const) {
    for (const age of ages) {
      const forgeActive = age <= 30;
      const d = decideSweep(declared, minutesAgo(age), now);
      if (forgeActive) {
        assert.equal(
          d.run,
          false,
          `declared=${declared} forgeAge=${age}m: Forge is sweeping and this app would too`,
        );
      }
    }
  }
});
