// The pure decision-making behind the clan-wide Discord commands: the coffer's amount parser and
// authority gate (which move real gp and must not be loose), and the Share round-trip for the new
// commands (which must survive a redeploy and must never let a button trigger a write).
//
// Run: npx tsx --test tests/discord-clan-commands.test.ts   (tsx for the `@/` alias)
//
// No DATABASE_URL needed. The helpers are pure, but their modules read a connection string at load,
// so a placeholder is set — nothing here opens a connection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClanGrant } from '../src/lib/clanGrants.ts';

// The modules read a connection string at load, so the placeholder must be set BEFORE they are
// imported. Static imports are hoisted above ordinary statements, and tsx compiles this file as CJS
// (no top-level await), so the DB-touching modules come in through a dynamic import inside the tests
// — by which point the env is set. Nothing here dials the connection.
process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:5432/unused';

const load = () =>
  Promise.all([import('../src/lib/discordClanCommands.ts'), import('../src/lib/discordCommands.ts')]).then(
    ([clan, cmds]) => ({ ...clan, ...cmds }),
  );

// ── /coffer amount parsing ────────────────────────────────────────────────────────────────────────

test('parseGpAmount: suffixes, plain numbers, and rubbish', async () => {
  const { parseGpAmount } = await load();
  assert.equal(parseGpAmount('5m'), 5_000_000);
  assert.equal(parseGpAmount('2.5b'), 2_500_000_000);
  assert.equal(parseGpAmount('500k'), 500_000);
  assert.equal(parseGpAmount('1000000'), 1_000_000);
  assert.equal(parseGpAmount('2,500,000'), 2_500_000);
  assert.equal(parseGpAmount('10M'), 10_000_000);
  assert.equal(parseGpAmount('7gp'), 7);
  assert.equal(parseGpAmount(1_000_000), 1_000_000);

  // Not a number, or a shape we won't guess at.
  assert.equal(parseGpAmount('abc'), null);
  assert.equal(parseGpAmount('5m5'), null);
  assert.equal(parseGpAmount(''), null);
  assert.equal(parseGpAmount(undefined), null);
  // Zero parses, but the handler rejects it as ≤ 0 — a no-op adjustment is not a movement.
  assert.equal(parseGpAmount('0'), 0);
});

// ── /coffer authority (mirrors verifyFeeCollector) ──────────────────────────────────────────────────

function grant(role: ClanGrant['role'], treasurerScope: 'all' | 'assigned' = 'all'): ClanGrant {
  return {
    clanId: 1,
    userId: 1,
    role,
    canEditTiles: false,
    editorScope: 'all',
    treasurerScope,
    isOwner: role === 'owner',
  };
}

test('canManageCoffer: treasurer/admin/owner yes, others no', async () => {
  const { canManageCoffer } = await load();
  assert.equal(canManageCoffer(grant('owner')), true);
  assert.equal(canManageCoffer(grant('admin')), true);
  assert.equal(canManageCoffer(grant('treasurer')), true);
  // Rank alone isn't it — collecting money is the treasurer's job.
  assert.equal(canManageCoffer(grant('moderator')), false);
  assert.equal(canManageCoffer(grant('member')), false);
  // A board-scoped treasurer's reach is one event, not the whole clan's coffer.
  assert.equal(canManageCoffer(grant('treasurer', 'assigned')), false);
  // No grant at all — a stranger, or a member with no clan_staff row.
  assert.equal(canManageCoffer(null), false);
});

// ── Clan-command Share round-trip ───────────────────────────────────────────────────────────────────

test('clan share ids round-trip name, sub and options', async () => {
  const { encodeClanShare, decodeClanShare } = await load();
  assert.deepEqual(decodeClanShare(encodeClanShare('sotw', null, {})), { n: 'sotw', s: null, o: {} });
  assert.deepEqual(decodeClanShare(encodeClanShare('eff', null, { metric: 'ehb' })), {
    n: 'eff',
    s: null,
    o: { metric: 'ehb' },
  });
  assert.deepEqual(decodeClanShare(encodeClanShare('coffer', 'balance', {})), { n: 'coffer', s: 'balance', o: {} });

  // Anything that isn't one of ours is refused rather than guessed at — the /bingo path takes over.
  assert.equal(decodeClanShare('share:board'), null);
  assert.equal(decodeClanShare('cx:not-base64!!'), null);
});

test('a clan share id fits inside the 100 characters Discord allows on a custom_id', async () => {
  const { encodeClanShare } = await load();
  const id = encodeClanShare('coffer', 'balance', { member: '123456789012345678' });
  assert.ok(id.length <= 100, `custom_id is ${id.length} chars`);
  assert.ok(id.startsWith('cx:'));
});
