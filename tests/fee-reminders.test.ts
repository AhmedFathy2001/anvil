// "Remind unpaid" on Admin → Fees: who gets a DM, what it says, and the once-per-12h cooldown.
//
// Run: npx tsx --test tests/fee-reminders.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEE_REMIND_COOLDOWN_MS,
  cooldownRemainingMs,
  feeReminderEmbed,
  formatWait,
  groupFeeRecipients,
  parseAuditTime,
} from '../src/lib/feeReminderText.ts';

test('one recipient per person, fees added up; unlinked sign-ups are unreachable', () => {
  const { recipients, unreachable } = groupFeeRecipients([
    { userId: 1, discordId: 'a', amount: 1_000_000 },
    { userId: 1, discordId: 'a', amount: 500_000 },
    { userId: 2, discordId: 'b', amount: 1_000_000 },
    { userId: null, discordId: null, amount: 1_000_000 },
    { userId: 3, discordId: null, amount: 1_000_000 },
  ]);
  assert.equal(unreachable, 2);
  assert.deepEqual(
    recipients.sort((x, y) => x.userId - y.userId),
    [
      { userId: 1, discordId: 'a', amount: 1_500_000, fees: 2 },
      { userId: 2, discordId: 'b', amount: 1_000_000, fees: 1 },
    ],
  );
});

test('audit times parse in both stored formats, as UTC', () => {
  const ms = Date.parse('2026-11-02T10:00:00Z');
  assert.equal(parseAuditTime('2026-11-02 10:00:00'), ms);
  assert.equal(parseAuditTime('2026-11-02T10:00:00.000Z'), ms);
});

test('cooldown: blocked for 12h after a reminder, open after', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  assert.equal(cooldownRemainingMs(null, now), 0);
  assert.equal(cooldownRemainingMs('2026-11-02 10:00:00', now), FEE_REMIND_COOLDOWN_MS - 2 * 3_600_000);
  assert.equal(cooldownRemainingMs('2026-11-01 23:59:00', now), 0);
  assert.equal(cooldownRemainingMs('garbage', now), 0);
});

test('wait is human-sized', () => {
  assert.equal(formatWait(10 * 3_600_000 + 5 * 60_000), '10h 5m');
  assert.equal(formatWait(2 * 3_600_000), '2h');
  assert.equal(formatWait(30_000), '1m');
});

test('the DM names the event, the amount and links the sign-up', () => {
  const e = feeReminderEmbed({ clanName: 'Embervale', eventName: 'Bingo #7', amount: 1_500_000, fees: 2, url: 'https://x/c/e/events/7/signup' });
  const d = String(e.description);
  assert.match(String(e.title), /Bingo #7/);
  assert.match(d, /1,500,000 gp \(for 2 accounts\)/);
  assert.match(d, /https:\/\/x\/c\/e\/events\/7\/signup/);
  const one = String(feeReminderEmbed({ clanName: 'E', eventName: 'B', amount: 1000, fees: 1, url: 'u' }).description);
  assert.doesNotMatch(one, /accounts/);
});
