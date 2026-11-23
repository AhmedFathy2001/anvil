// Who may pay for a clan's plan (lib/planPayerRules), and what the payer and owner are told when the
// payer stops while their membership still runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPayerRole, mayPayForPlan, payerStoppedText, removePayerConfirm } from '../src/lib/planPayerRules.ts';
import { withPayer } from '../src/lib/billingInterval.ts';
import { redirectFor } from '../src/lib/adminAccess.ts';

test('the owner always pays; admins, treasurers and mods only when let', () => {
  assert.equal(mayPayForPlan({ role: 'owner' }), true);
  assert.equal(mayPayForPlan({ role: 'admin', isOwner: true }), true);
  for (const role of ['admin', 'treasurer', 'moderator']) {
    assert.equal(mayPayForPlan({ role, canPayPlan: false }), false, role);
    assert.equal(mayPayForPlan({ role, canPayPlan: true }), true, role);
  }
  // A member, or a role that dropped below moderator, never — whatever the flag says.
  assert.equal(mayPayForPlan({ role: 'member', canPayPlan: true }), false);
  assert.equal(mayPayForPlan({ role: 'editor', canPayPlan: true }), false);
  assert.equal(mayPayForPlan(null), false);
  assert.equal(isPayerRole('member'), false);
});

test('the payer ref rides the checkout after the clan ref', () => {
  assert.equal(withPayer('https://x.gumroad.com/l/silver?ref=abc', 'p q'), 'https://x.gumroad.com/l/silver?ref=abc&payer=p%20q');
  assert.equal(withPayer('https://x.gumroad.com/l/silver', 'p'), 'https://x.gumroad.com/l/silver?payer=p');
  assert.equal(withPayer('https://x.gumroad.com/l/silver?ref=abc', null), 'https://x.gumroad.com/l/silver?ref=abc');
  assert.equal(withPayer(null, 'p'), null);
});

test('a stopped payer is told it keeps charging; a cancelled one that it just ends', () => {
  const live = payerStoppedText({ clanName: 'The AFK Spot', payerName: 'Kaiser724', renews: '12 Dec 2026', cancelled: false });
  assert.match(live.payer.title, /no longer pay for The AFK Spot's plan/);
  assert.match(live.payer.body, /keep charging you on 12 Dec 2026 unless you cancel/);
  assert.match(live.owner, /Kaiser724 can no longer pay.*until 12 Dec 2026.*Choose who pays next/);
  const done = payerStoppedText({ clanName: 'X', payerName: 'K', renews: null, cancelled: true });
  assert.match(done.payer.body, /already cancelled/);
  assert.doesNotMatch(done.payer.body, /until/);
});

test('the owner is asked before stopping the person paying now', () => {
  const c = removePayerConfirm({ payerName: 'Kaiser724', renews: '12 Dec 2026' });
  assert.equal(c.title, 'Stop Kaiser724 paying for the plan?');
  assert.match(c.body, /only they can cancel it/);
});

test('moderators and treasurers reach the plan page (read-only unless let pay)', () => {
  const mod = { role: 'moderator', canEditTiles: false, editorScope: 'all' };
  const tre = { role: 'treasurer', canEditTiles: false, editorScope: 'all' };
  assert.equal(redirectFor('/admin/plan', mod), null);
  assert.equal(redirectFor('/admin/plan', tre), null);
  assert.equal(redirectFor('/admin/plan', { role: 'member', canEditTiles: false, editorScope: 'all' }), '/');
});
