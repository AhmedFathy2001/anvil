/**
 * Recomputes clan_members.rsn_normalized after normalizeRsn() changed to treat '_'
 * and ' ' as the same character (OSRS does). Without this, a row stored as
 * "gim_nisbro" never matches an incoming "GIM Nisbro" and the sync keeps reporting
 * one left + one joined for the same person.
 *
 * Collision-safe: if recomputing would collide with another row's normalized value
 * (e.g. both "gim_nisbro" and "gim nisbro" exist as separate rows), it leaves the
 * row untouched and prints the pair so an admin can merge them from the audit page.
 *
 * Safe to run repeatedly.
 *
 * Run:  npx tsx scripts/backfill-rsn-normalized.ts
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { clanMembers } from '../src/db/schema';
import { eq } from 'drizzle-orm';
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
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
});
const db = drizzle(client, { schema: { clanMembers } });

// Must match src/lib/auth.ts normalizeRsn.
function normalizeRsn(rsn: string): string {
  return rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');
}

async function main() {
  const rows = await db.select().from(clanMembers);

  // Map of desired normalized value → the row id that will own it. Seed with rows
  // that already match so we can detect collisions against them too.
  const owner = new Map<string, number>();
  for (const r of rows) {
    const desired = normalizeRsn(r.rsn);
    if (desired === r.rsnNormalized) owner.set(desired, r.id);
  }

  let updated = 0;
  const collisions: { id: number; rsn: string; desired: string; heldBy: number }[] = [];

  for (const r of rows) {
    const desired = normalizeRsn(r.rsn);
    if (desired === r.rsnNormalized) continue;

    const heldBy = owner.get(desired);
    if (heldBy != null && heldBy !== r.id) {
      collisions.push({ id: r.id, rsn: r.rsn, desired, heldBy });
      continue;
    }

    await db.update(clanMembers).set({ rsnNormalized: desired }).where(eq(clanMembers.id, r.id));
    owner.set(desired, r.id);
    updated++;
    console.log(`  #${r.id} "${r.rsn}": ${r.rsnNormalized} → ${desired}`);
  }

  console.log(`\nUpdated ${updated} clan_members row(s).`);
  if (collisions.length > 0) {
    console.log(`\n${collisions.length} collision(s) left untouched — merge these manually:`);
    for (const c of collisions) {
      console.log(`  #${c.id} "${c.rsn}" wants "${c.desired}" but it's already held by member #${c.heldBy}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
