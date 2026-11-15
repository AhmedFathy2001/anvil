// Regressions from the 2026-11-14 audit: the pure half of each fix (no database).
//
//  1. Team invite links: a clan role only makes someone a host when the request's clan owns the event.
//  2. Discord role sync: a nickname match is dropped when two accounts carry the name, or when
//     something proven says the matched account is somebody else.
//  3. Billing: a partial refund is logged, never treated as a refund of the subscription.
//  4. Ladder months: a completion stored in the column-default format on the 1st is in its month.
//  5. Repeating competitions: the successor marker is a claim before it is an id.
//  6. Coffer: an unreadable amount is null (never 0), and totals fold over the whole ledger.
//  7. Fees: a team manager cannot re-mark a host-closed fee.
//
// Run: npx tsx --test tests/security-audit-1114.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isInviteAdmin, mayMintInvite } from '../src/lib/teamInvites.ts';
import { nameMatchAllowed, uniqueAliasIndex } from '../src/lib/discordRoleSafety.ts';
import { parseWebhook } from '../src/lib/gumroad.ts';
import { inWindow, monthKeyWindow } from '../src/lib/monthWindow.ts';
import { CLAIM_STALE_MS, successorClaim, successorMarkerState } from '../src/lib/weeklyRepeatPlan.ts';
import { parseGpInput } from '../src/lib/adminEventsFormat.ts';
import { foldMoneyOut } from '../src/lib/cofferMath.ts';
import { canTeamMarkCollected } from '../src/lib/feeRules.ts';

test('invite host: a moderator of the clan that owns the event', () => {
  for (const role of ['moderator', 'admin', 'owner']) {
    assert.equal(isInviteAdmin({ role, requestClanId: 7, eventClanId: 7 }), true, role);
  }
});

test('invite host: the same role in ANY other clan is a stranger to this team', () => {
  for (const role of ['moderator', 'admin', 'owner']) {
    assert.equal(isInviteAdmin({ role, requestClanId: 8, eventClanId: 7 }), false, role);
  }
  // No clan in the address (the apex) confers nothing either.
  assert.equal(isInviteAdmin({ role: 'owner', requestClanId: null, eventClanId: 7 }), false);
  assert.equal(isInviteAdmin({ role: 'owner', requestClanId: undefined, eventClanId: 7 }), false);
  assert.equal(isInviteAdmin({ role: 'owner', requestClanId: 7, eventClanId: null }), false);
});

test('invite host: treasurer, board editor and member never are, even at home', () => {
  for (const role of ['treasurer', 'editor', 'member', '']) {
    assert.equal(isInviteAdmin({ role, requestClanId: 7, eventClanId: 7 }), false, role);
  }
  // A non-host still mints only as captain or staff, and only when the event allows it.
  assert.equal(mayMintInvite({ isAdmin: false, isCaptain: true, isStaff: false, captainInvites: false }), false);
  assert.equal(mayMintInvite({ isAdmin: false, isCaptain: true, isStaff: false, captainInvites: true }), true);
});

test('discord names: one account per name, and a contested name matches nobody', () => {
  const index = uniqueAliasIndex([
    ['zezima', '100'],
    ['zezima', '100'], // the same account under nick and username: still one owner
    ['woox', '200'],
    ['woox', '999'], // a second account renamed to match
    ['woox', '200'], // and the name stays dead even when the first account shows up again
    ['', '300'],
  ]);
  assert.equal(index.get('zezima'), '100');
  assert.equal(index.has('woox'), false);
  assert.equal(index.size, 1);
});

test('discord names: a match is refused when something proven disagrees', () => {
  const base = { matchedDiscordId: 'D2', seatPlayerId: null, seatOwnerDiscordId: null, matchedPlayerId: null, matchedHoldsOtherSeat: false };
  // Nobody has signed in on either side: the name is all there is, and it is allowed (as before).
  assert.equal(nameMatchAllowed(base), true);
  // The seat's owner signed in with a different Discord account.
  assert.equal(nameMatchAllowed({ ...base, seatPlayerId: 5, seatOwnerDiscordId: 'D1' }), false);
  // The matched account belongs to a different person than the seat's owner.
  assert.equal(nameMatchAllowed({ ...base, seatPlayerId: 5, matchedPlayerId: 6 }), false);
  // It is the owner's own account.
  assert.equal(nameMatchAllowed({ ...base, seatPlayerId: 5, seatOwnerDiscordId: 'D2', matchedPlayerId: 5 }), true);
  // Unclaimed seat, and the matched person is already a different character in this clan: the
  // member who renames themselves to a higher rank's name.
  assert.equal(nameMatchAllowed({ ...base, matchedPlayerId: 6, matchedHoldsOtherSeat: true }), false);
  // Unclaimed seat, matched person signed in but holds no seat here yet: a new member, allowed.
  assert.equal(nameMatchAllowed({ ...base, matchedPlayerId: 6, matchedHoldsOtherSeat: false }), true);
});

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

test('billing: a partial refund is not a refund', () => {
  // Ping (no resource_name).
  assert.equal(parseWebhook(form({ sale_id: 's1', partially_refunded: 'true' })).kind, 'other');
  assert.equal(parseWebhook(form({ sale_id: 's1', refunded: 'true' })).kind, 'refund');
  assert.equal(parseWebhook(form({ sale_id: 's1', refunded: 'true', partially_refunded: 'true' })).kind, 'refund');
  // Resource subscription.
  assert.equal(parseWebhook(form({ resource_name: 'refund', sale_id: 's1', partially_refunded: 'true' })).kind, 'other');
  assert.equal(parseWebhook(form({ resource_name: 'refund', sale_id: 's1', refunded: 'true' })).kind, 'refund');
  assert.equal(parseWebhook(form({ resource_name: 'refund', sale_id: 's1' })).kind, 'refund');
  // A dispute or an ended subscription still wins over a partial refund flag.
  assert.equal(parseWebhook(form({ sale_id: 's1', partially_refunded: 'true', disputed: 'true' })).kind, 'dispute');
  // An ordinary sale is still a sale.
  assert.equal(parseWebhook(form({ sale_id: 's1' })).kind, 'sale');
});

test('ladder month: a column-default timestamp on the 1st is inside its month', () => {
  const august = monthKeyWindow('2026-08');
  // The bug: space sorts below T, so this compared as before the start.
  assert.equal(inWindow('2026-08-01 00:00:00', august), true);
  assert.equal(inWindow('2026-08-01 09:30:00', august), true);
  assert.equal(inWindow('2026-08-31 23:59:59', august), true);
  // And the next month's 1st used to leak in.
  assert.equal(inWindow('2026-09-01 00:00:00', august), false);
  assert.equal(inWindow('2026-09-01 08:00:00', august), false);
  assert.equal(inWindow('2026-07-31 23:59:59', august), false);
  // ISO rows behave the same.
  assert.equal(inWindow('2026-08-01T00:00:00.000Z', august), true);
  assert.equal(inWindow('2026-09-01T00:00:00.000Z', august), false);
});

test('ladder month: open-sided windows, and unreadable stamps are in none', () => {
  assert.equal(inWindow('2026-08-01 09:30:00', {}), true);
  assert.equal(inWindow('2026-08-01 09:30:00', { start: '2026-08-01T00:00:00.000Z' }), true);
  assert.equal(inWindow('2026-08-01 09:30:00', { end: '2026-08-01T00:00:00.000Z' }), false);
  assert.equal(inWindow(null, {}), false);
  assert.equal(inWindow('not a date', {}), false);
  assert.equal(inWindow('2026-08-01 09:30:00', { start: 'nonsense' }), false);
});

test('weekly repeat: the successor marker', () => {
  const now = 1_800_000_000_000;
  assert.equal(successorMarkerState(null, now), 'free');
  assert.equal(successorMarkerState('', now), 'free');
  // An id: the successor exists.
  assert.equal(successorMarkerState('412', now), 'taken');
  // A fresh claim: another tick is making it right now.
  assert.equal(successorMarkerState(successorClaim(now), now), 'taken');
  assert.equal(successorMarkerState(successorClaim(now - CLAIM_STALE_MS), now), 'taken');
  // A claim nobody finished: taken over rather than ending the series.
  assert.equal(successorMarkerState(successorClaim(now - CLAIM_STALE_MS - 1), now), 'stale');
  assert.equal(successorMarkerState('claim:garbage', now), 'stale');
});

test('coffer pool: an unreadable amount is null, which the card refuses to save', () => {
  assert.equal(parseGpInput('5oo'), null);
  assert.equal(parseGpInput(''), null);
  assert.equal(parseGpInput('500m'), 500_000_000);
  assert.equal(parseGpInput('0'), 0);
});

test('coffer totals: folded from grouped rows of the whole ledger', () => {
  const out = foldMoneyOut([
    { kind: 'award', status: 'reserved', total: 30_000_000, count: 2 },
    { kind: 'pool', status: 'planned', total: 10_000_000, count: 1 },
    { kind: 'award', status: 'unfunded', total: 5_000_000, count: 1 },
    { kind: 'award', status: 'paid', total: 100_000_000, count: 4 },
    { kind: 'pool', status: 'cancelled', total: 7_000_000, count: 1 },
    { kind: 'adjustment', status: 'approved', total: 2_000_000, count: 1 },
    // Not money out: never counted, whatever reaches the fold.
    { kind: 'donation', status: 'approved', total: 999, count: 9 },
  ]);
  assert.deepEqual(out, { stillOwed: 45_000_000, paidOut: 102_000_000, count: 10 });
  assert.deepEqual(foldMoneyOut([]), { stillOwed: 0, paidOut: 0, count: 0 });
});

test('fees: a team manager may not re-mark a settled or host-closed fee', () => {
  assert.deepEqual(canTeamMarkCollected('confirmed'), { ok: false, reason: 'settled' });
  assert.deepEqual(canTeamMarkCollected('closed'), { ok: false, reason: 'closed' });
  for (const status of ['owed', 'pending', 'reported', 'collected', 'disputed']) {
    assert.deepEqual(canTeamMarkCollected(status), { ok: true }, status);
  }
});
