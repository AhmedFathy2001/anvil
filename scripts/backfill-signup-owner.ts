/**
 * Backfills event_signups.user_id for GUEST sign-ups whose character (clan_member) has since
 * been linked to a site user.
 *
 * A sign-up snapshots its owner (user_id) at sign-up time. If the character was still a guest
 * then, the row is written with user_id = NULL and NOTHING ever backfilled it when the character
 * was later attached to a person. Such rows keep showing as "guest · no Discord" in the admin
 * Sign-ups panel even though the People view shows the character owned, and the owner can't manage
 * the sign-up from their own account (self-serve finds rows by user_id). This adopts every such
 * orphan to its character's current owner.
 *
 * Safe: the only unique index on event_signups is (event_id, clan_member_id) — one sign-up per
 * (event, character) — so setting user_id can never collide with a sibling row. Idempotent; only
 * touches rows where the sign-up is unowned but its character is owned. Safe to run repeatedly.
 *
 * Run (locally, or inside a clan container with DATABASE_URL set):
 *   npx tsx scripts/backfill-signup-owner.ts
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

for (const envFile of ['.env', '.env.local']) {
  try {
    const content = readFileSync(envFile, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2];
      }
    }
  } catch {}
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./anvil.db',
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
});

async function main() {
  // Preview what will change.
  const preview = await client.execute(`
    SELECT es.id AS signup_id, es.event_id, cm.rsn, cm.user_id AS owner_id, u.discord_username
    FROM event_signups es
    JOIN clan_members cm ON cm.id = es.clan_member_id
    LEFT JOIN users u ON u.id = cm.user_id
    WHERE es.user_id IS NULL AND cm.user_id IS NOT NULL
    ORDER BY es.event_id, cm.rsn
  `);

  if (preview.rows.length === 0) {
    console.log('Nothing to backfill — no guest sign-ups whose character is now owned.');
    return;
  }

  console.log(`Adopting ${preview.rows.length} orphaned guest sign-up(s):`);
  for (const r of preview.rows) {
    console.log(`  event ${r.event_id}  ${r.rsn} → user ${r.owner_id} (@${r.discord_username ?? '?'})`);
  }

  const res = await client.execute(`
    UPDATE event_signups
    SET user_id = (SELECT cm.user_id FROM clan_members cm WHERE cm.id = event_signups.clan_member_id)
    WHERE user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM clan_members cm
        WHERE cm.id = event_signups.clan_member_id AND cm.user_id IS NOT NULL
      )
  `);

  console.log(`Done — updated ${res.rowsAffected} row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
