/**
 * Backfills clan_members from existing players + weekly_participants, then links
 * those rows to the new clan_member_id FK.
 *
 * Safe to run repeatedly — upserts by normalized RSN.
 *
 * Run:  npx tsx scripts/backfill-clan-members.ts
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { clanMembers, players, weeklyParticipants } from '../src/db/schema';
import { eq, isNull } from 'drizzle-orm';
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
const db = drizzle(client, { schema: { clanMembers, players, weeklyParticipants } });

function normalizeRsn(rsn: string): string {
  return rsn.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function findOrCreateMember(rsn: string, discord: string | null): Promise<number> {
  const normalized = normalizeRsn(rsn);
  const existing = await db
    .select()
    .from(clanMembers)
    .where(eq(clanMembers.rsnNormalized, normalized))
    .limit(1);

  if (existing[0]) {
    // Opportunistically backfill discordId if missing
    if (discord && !existing[0].discordId) {
      await db
        .update(clanMembers)
        .set({ discordId: discord })
        .where(eq(clanMembers.id, existing[0].id));
    }
    return existing[0].id;
  }

  const [row] = await db
    .insert(clanMembers)
    .values({
      rsn,
      rsnNormalized: normalized,
      discordId: discord,
      source: 'manual',
      isGuest: 0,
    })
    .returning();
  return row.id;
}

async function run() {
  console.log('Backfilling clan_members from players...');
  const unlinkedPlayers = await db.select().from(players).where(isNull(players.clanMemberId));
  console.log(`  ${unlinkedPlayers.length} player rows to link`);

  for (const p of unlinkedPlayers) {
    const memberId = await findOrCreateMember(p.name, p.discord);
    await db.update(players).set({ clanMemberId: memberId }).where(eq(players.id, p.id));
  }

  console.log('Backfilling clan_members from weekly_participants...');
  const unlinkedParticipants = await db
    .select()
    .from(weeklyParticipants)
    .where(isNull(weeklyParticipants.clanMemberId));
  console.log(`  ${unlinkedParticipants.length} weekly participant rows to link`);

  for (const p of unlinkedParticipants) {
    const memberId = await findOrCreateMember(p.rsn, null);
    await db
      .update(weeklyParticipants)
      .set({ clanMemberId: memberId })
      .where(eq(weeklyParticipants.id, p.id));
  }

  const totalMembers = await db.select().from(clanMembers);
  console.log(`\nDone. clan_members now has ${totalMembers.length} rows.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
