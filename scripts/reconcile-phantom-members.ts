/**
 * Finds "phantom" clan members: rows marked as real members (isGuest=0) that were
 * created by a verification flow (plugin / stat_delta / manual review) but have NOT
 * been seen in the in-game roster since the last clan-sync.
 *
 * Background: verifying an account proves ownership, not clan membership. Older code
 * created verified rows with isGuest=0, and the stat_delta/manual paths also wrote
 * source='manual' — which clan-sync's mark-left step deliberately skips. So those rows
 * inflate the member count forever and no roster sync corrects them. This script
 * reconciles them against the roster: anyone verified but absent from the most recent
 * roster push (lastSeenInClan < last_clan_sync.at) is demoted back to guest.
 *
 * Detection is conservative: it only flags rows whose last sighting predates a roster
 * sync that ran AFTER them (i.e. a sync happened and did not include them). Pure admin
 * adds (verificationMethod = null) are never touched.
 *
 * Dry-run by default — prints the candidates and exits. Pass --apply to demote them
 * (sets isGuest=1) and write a 'demoted' audit-log entry for each.
 *
 * Run:  npx tsx scripts/reconcile-phantom-members.ts          (dry run)
 *       npx tsx scripts/reconcile-phantom-members.ts --apply  (demote to guest)
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { clanMembers, clanAuditLog, settings } from '../src/db/schema';
import { and, eq, isNull, isNotNull } from 'drizzle-orm';
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
const db = drizzle(client, { schema: { clanMembers, clanAuditLog, settings } });

const APPLY = process.argv.includes('--apply');

async function run() {
  // 1) When did the roster last sync? Without a sync we can't prove anyone is absent.
  const syncRow = await db.query.settings.findFirst({ where: eq(settings.key, 'last_clan_sync') });
  let lastSyncAt: number | null = null;
  if (syncRow?.value) {
    try {
      const parsed = JSON.parse(syncRow.value) as { at?: string };
      if (parsed.at) lastSyncAt = new Date(parsed.at).getTime();
    } catch {}
  }
  if (!lastSyncAt || Number.isNaN(lastSyncAt)) {
    console.error(
      'No clan-sync on record (settings.last_clan_sync missing). Run a roster sync from\n' +
        'the admin plugin first, then re-run this script so absence can be proven.',
    );
    process.exit(1);
  }
  console.log(`Last roster sync: ${new Date(lastSyncAt).toISOString()}\n`);

  // 2) Verified, active, real-member rows — the superset to reconcile.
  const candidates = await db
    .select()
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.isGuest, 0),
        isNull(clanMembers.leftAt),
        isNotNull(clanMembers.verificationMethod),
      ),
    );

  // 3) Phantom = last seen in the roster BEFORE the last sync (or never seen at all).
  const phantoms = candidates.filter((m) => {
    if (!m.lastSeenInClan) return true;
    const seen = new Date(m.lastSeenInClan).getTime();
    if (Number.isNaN(seen)) return true;
    return seen < lastSyncAt!;
  });

  if (phantoms.length === 0) {
    console.log('No phantom members found — every verified member was in the last roster.');
    return;
  }

  console.log(`Found ${phantoms.length} phantom member(s) (verified but absent from last roster):\n`);
  for (const m of phantoms) {
    console.log(
      `  #${m.id}  ${m.rsn.padEnd(14)}  via ${String(m.verificationMethod).padEnd(10)} ` +
        `source=${m.source.padEnd(12)} lastSeen=${m.lastSeenInClan ?? 'never'}`,
    );
  }

  if (!APPLY) {
    console.log('\nDry run — no changes made. Re-run with --apply to demote these to guest.');
    return;
  }

  console.log('\nApplying: demoting to guest (isGuest=1) + writing audit entries...');
  for (const m of phantoms) {
    await db.update(clanMembers).set({ isGuest: 1 }).where(eq(clanMembers.id, m.id));
    await db.insert(clanAuditLog).values({
      clanMemberId: m.id,
      eventType: 'demoted',
      oldValue: JSON.stringify({ isGuest: 0 }),
      newValue: JSON.stringify({ isGuest: 1 }),
      notes: 'Reconciliation: verified account absent from in-game roster since last sync',
    });
  }
  console.log(`Done. Demoted ${phantoms.length} phantom member(s) to guest.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
