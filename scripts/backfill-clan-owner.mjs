// One-time backfill: give every clan an OWNER seat.
//
// WHY THIS EXISTS. Ownership lives in exactly one place — a `clan_staff` row with role 'owner' —
// and everything hangs off it: the /portal billing dashboard counts clans you own by that role, the
// admin surface shows you as "Owner", and the "Make owner" transfer action only appears when the
// VIEWER holds it. `clanCreate` always mints that seat in the same transaction as the clan. But a
// clan brought in through the IMPORT path (import-clan.mjs) got its staff seeded as 'admin' and no
// owner at all — so its founder reads as a plain admin, /portal says "you don't own a clan", and
// ownership can never be transferred because nobody holds it to hand off.
//
// This finds every clan with no owner and promotes ONE admin to owner — the earliest-granted admin
// (the founder, seeded first), unless you override the choice per clan. Owner is undemotable except
// through transfer, so the pick matters: DRY-RUN IS THE DEFAULT. Read the plan, then re-run with
// --apply.
//
// Usage:
//   DATABASE_URL=postgres://…  node scripts/backfill-clan-owner.mjs                 # dry run
//   DATABASE_URL=postgres://…  node scripts/backfill-clan-owner.mjs --apply         # do it
//   …  node scripts/backfill-clan-owner.mjs --set the-afk-spot=<discordId> --apply  # pick the person
//
// --set <slug>=<discordId> overrides the founder heuristic for that clan; the named person must
// already hold an admin grant there (you don't crown someone who was never staff). Repeatable.

import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[owner-backfill] DATABASE_URL is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
// --set slug=discordId (repeatable) → Map<slug, discordId>. Accepts `--set slug=id` and `--set=slug=id`.
const overrides = new Map();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  let pair = null;
  if (a === '--set') pair = args[i + 1];
  else if (a.startsWith('--set=')) pair = a.slice('--set='.length);
  if (!pair) continue;
  const [slug, id] = pair.split('=');
  if (slug && id) overrides.set(slug.trim().toLowerCase(), id.trim());
}

const pool = new pg.Pool({ connectionString: url, max: 1 });

async function main() {
  // Clans with no owner seat.
  const ownerless = (
    await pool.query(
      `SELECT c.id, c.slug, c.name
         FROM clans c
        WHERE NOT EXISTS (
                SELECT 1 FROM clan_staff s
                 WHERE s.clan_id = c.id AND s.role = 'owner'
              )
        ORDER BY c.id`,
    )
  ).rows;

  if (ownerless.length === 0) {
    console.log('[owner-backfill] Every clan already has an owner. Nothing to do.');
    return;
  }

  console.log(`[owner-backfill] ${ownerless.length} clan(s) without an owner:\n`);

  const plan = [];
  for (const clan of ownerless) {
    // The admins of this clan, earliest grant first — the founder was seeded first.
    const admins = (
      await pool.query(
        `SELECT s.user_id, u.display_name, u.discord_id, u.discord_username, s.created_at
           FROM clan_staff s
           JOIN users u ON u.id = s.user_id
          WHERE s.clan_id = $1 AND s.role = 'admin'
          ORDER BY s.created_at ASC, s.id ASC`,
        [clan.id],
      )
    ).rows;

    if (admins.length === 0) {
      console.log(`  • ${clan.name} (${clan.slug}) — NO ADMIN to promote. Skipped; grant someone admin first.`);
      continue;
    }

    let chosen;
    const override = overrides.get(clan.slug.toLowerCase());
    if (override) {
      chosen = admins.find((a) => a.discord_id === override);
      if (!chosen) {
        console.log(
          `  • ${clan.name} (${clan.slug}) — --set names discord id ${override}, but they hold no admin grant here. Skipped.`,
        );
        continue;
      }
    } else {
      chosen = admins[0];
    }

    const others = admins.filter((a) => a.user_id !== chosen.user_id);
    console.log(
      `  • ${clan.name} (${clan.slug}) → OWNER: ${chosen.display_name} (@${chosen.discord_username ?? chosen.discord_id})` +
        (others.length
          ? `\n      other admins (stay admin): ${others.map((a) => a.display_name).join(', ')}`
          : ''),
    );
    plan.push({ clan, chosen });
  }

  if (plan.length === 0) {
    console.log('\n[owner-backfill] Nothing to apply.');
    return;
  }

  if (!apply) {
    console.log(`\n[owner-backfill] DRY RUN — no changes written. Re-run with --apply to promote the ${plan.length} owner(s) above.`);
    return;
  }

  console.log('');
  for (const { clan, chosen } of plan) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Promote only from 'admin', and only while the clan still has no owner — so a concurrent run
      // or a manual grant in between can't produce two owners.
      const res = await client.query(
        `UPDATE clan_staff
            SET role = 'owner'
          WHERE clan_id = $1 AND user_id = $2 AND role = 'admin'
            AND NOT EXISTS (
                  SELECT 1 FROM clan_staff s2 WHERE s2.clan_id = $1 AND s2.role = 'owner'
                )
        RETURNING id`,
        [clan.id, chosen.user_id],
      );
      if (res.rowCount !== 1) {
        await client.query('ROLLBACK');
        console.log(`  ! ${clan.name} (${clan.slug}) — skipped (owner appeared, or admin grant gone).`);
        continue;
      }
      await client.query(
        `INSERT INTO clan_audit_log (clan_id, event_type, actor_user_id, old_value, new_value, notes)
         VALUES ($1, 'ownership_backfilled', $2, $3, $4, $5)`,
        [
          clan.id,
          chosen.user_id,
          JSON.stringify({ role: 'admin' }),
          JSON.stringify({ role: 'owner', userId: chosen.user_id }),
          'Owner seat backfilled for an imported clan (scripts/backfill-clan-owner.mjs)',
        ],
      );
      await client.query('COMMIT');
      console.log(`  ✓ ${clan.name} (${clan.slug}) → ${chosen.display_name} is now owner.`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  ✗ ${clan.name} (${clan.slug}) — failed:`, e.message);
    } finally {
      client.release();
    }
  }
  console.log('\n[owner-backfill] Done.');
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error('[owner-backfill] fatal:', e);
    pool.end();
    process.exit(1);
  });
