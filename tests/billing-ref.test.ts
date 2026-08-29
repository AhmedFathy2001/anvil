// The checkout half of billing: every clan carries a stable `gumroadRef`, and the checkout URL
// carries it, so a Gumroad ping resolves to the right clan (the strong key ahead of email).
//
// Run: npx tsx --test tests/billing-ref.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('billing-ref');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let ensureClanCheckoutRef: typeof import('../src/lib/billing.ts')['ensureClanCheckoutRef'];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ ensureClanCheckoutRef } = await import('../src/lib/billing.ts'));
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('ensureClanCheckoutRef creates a token once, then returns the same', async () => {
  // A clan with no ref (as a pre-ref clan would be after the migration only touches existing rows).
  const [clan] = await db.insert(s.clans).values({ slug: 'norev', name: 'No Ref', gumroadRef: null }).returning();

  const first = await ensureClanCheckoutRef(clan.id);
  assert.ok(first && first.length > 0, 'a token was made');

  const stored = await db.select({ ref: s.clans.gumroadRef }).from(s.clans).where(eq(s.clans.id, clan.id)).then((r) => r[0]);
  assert.equal(stored.ref, first, 'it was persisted');

  const second = await ensureClanCheckoutRef(clan.id);
  assert.equal(second, first, 'idempotent — same token, not a new one');
});

test('checkoutUrlWithRef appends the ref, respecting existing query params', async () => {
  const { checkoutUrlWithRef, PLANS } = await import('../src/lib/plans.ts');
  // Point the Silver tier's checkout env at a known URL for the test.
  process.env[PLANS.silver.gumroadUrlEnv!] = 'https://anvil.gumroad.com/l/silver';
  try {
    assert.equal(checkoutUrlWithRef(PLANS.silver, 'TOK'), 'https://anvil.gumroad.com/l/silver?ref=TOK');
    process.env[PLANS.silver.gumroadUrlEnv!] = 'https://anvil.gumroad.com/l/silver?x=1';
    assert.equal(checkoutUrlWithRef(PLANS.silver, 'TOK'), 'https://anvil.gumroad.com/l/silver?x=1&ref=TOK');
    // No ref → the bare URL (no dangling ?ref=).
    assert.equal(checkoutUrlWithRef(PLANS.silver, null), 'https://anvil.gumroad.com/l/silver?x=1');
    // A tier with no checkout env → null, not a crash.
    assert.equal(checkoutUrlWithRef(PLANS.free, 'TOK'), null);
  } finally {
    delete process.env[PLANS.silver.gumroadUrlEnv!];
  }
});
