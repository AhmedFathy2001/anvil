#!/usr/bin/env node
// Carry billing and entitlement out of the control plane and onto the clan rows.
//
// The clan importer moved rosters, events and history; it did not move the SUBSCRIPTION, because
// that lived in Anvil.Admin's own database rather than in any clan's. So every imported clan landed
// on `free` with no cap — including one that pays for Silver. Nobody would notice until a paid limit
// bit, which is the worst way to find out.
//
// Matches on SLUG, the one identifier both sides agree on.
//
// Dry-run by default, like every other script here:
//   node scripts/import-billing.mjs --source /path/to/anvil-admin.db
//   node scripts/import-billing.mjs --source /path/to/anvil-admin.db --apply

import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const APPLY = args.includes('--apply');
const SOURCE = arg('source');
const TARGET = process.env.DATABASE_URL;

if (!SOURCE) {
  console.error('usage: import-billing.mjs --source <anvil-admin.db> [--apply]');
  process.exit(2);
}
if (!TARGET) {
  console.error('DATABASE_URL must point at the site database');
  process.exit(2);
}

// The control plane's internal tier ids were never the customer-facing names; the site stores the
// customer-facing name because there is no provisioning code left that a rename would churn.
const TIER_TO_PLAN = {
  starter: 'bronze',
  standard: 'silver',
  pro: 'gold',
  custom: 'custom',
  free: 'free',
};

const CAPS = { free: 50, bronze: 150, silver: 300, gold: 600, custom: null };

const src = new DatabaseSync(SOURCE, { readOnly: true });
const client = new pg.Client({ connectionString: TARGET });
await client.connect();

const rows = src
  .prepare(
    `SELECT slug, tier, member_cap, status, contact_email,
            gumroad_sale_id, gumroad_subscription_id, gumroad_product_id,
            gumroad_product_permalink, gumroad_ref,
            trial_ends_at, current_period_end, cancel_at_period_end
       FROM clans`,
  )
  .all();

let matched = 0;
let paid = 0;
const skipped = [];

for (const r of rows) {
  const target = await client.query('SELECT id, slug, plan FROM clans WHERE slug = $1', [r.slug]);
  if (target.rowCount === 0) {
    // Expected for rows that never became a real clan — a reservation that was never paid for, or a
    // shadow row awaiting a subdomain. Listed rather than silently dropped.
    skipped.push(`${r.slug} (${r.status}) — no clan on the site`);
    continue;
  }
  matched++;

  const plan = TIER_TO_PLAN[r.tier] ?? 'free';
  // The control plane's cap wins when it has one: an operator may have negotiated something other
  // than the tier default, and overwriting that with the default would quietly take it away.
  const cap = r.member_cap ?? CAPS[plan] ?? null;
  const subscribed = !!r.gumroad_subscription_id;
  if (subscribed) paid++;

  console.log(
    `${r.slug}: ${target.rows[0].plan} -> ${plan}  cap=${cap ?? 'none'}` +
      (subscribed ? `  sub=${r.gumroad_subscription_id}` : '  (no subscription)'),
  );

  if (!APPLY) continue;

  await client.query(
    `UPDATE clans SET
       plan = $1, member_cap = $2, contact_email = $3,
       gumroad_sale_id = $4, gumroad_subscription_id = $5, gumroad_product_id = $6,
       gumroad_product_permalink = $7, gumroad_ref = $8,
       trial_ends_at = $9, current_period_end = $10, cancel_at_period_end = $11
     WHERE slug = $12`,
    [
      plan,
      cap,
      r.contact_email ?? null,
      r.gumroad_sale_id ?? null,
      r.gumroad_subscription_id ?? null,
      r.gumroad_product_id ?? null,
      r.gumroad_product_permalink ?? null,
      r.gumroad_ref ?? null,
      r.trial_ends_at ?? null,
      r.current_period_end ?? null,
      !!r.cancel_at_period_end,
      r.slug,
    ],
  );
}

console.log(`\n${matched} clan(s) matched, ${paid} with a live subscription.`);
if (skipped.length) {
  console.log('Not on the site (nothing to update):');
  for (const s of skipped) console.log(`  - ${s}`);
}
if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with --apply.');

await client.end();
src.close();
