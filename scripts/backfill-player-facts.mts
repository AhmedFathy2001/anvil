/**
 * Materializes player_event_facts for every ENDED event that has no rows yet (pass --all to
 * re-materialize everything, e.g. after attribution fixes). New events write their facts at the
 * end-of-event lifecycle tick; this backfills history so the player profile starts warm.
 *
 * Safe to run repeatedly — the writer is an idempotent delete+insert per event.
 *
 * Run:  npx tsx scripts/backfill-player-facts.mts [--all]
 */
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

// Import AFTER the env is loaded — @/db reads DATABASE_URL at module init.
const { db } = await import('../src/db');
const { events, playerEventFacts } = await import('../src/db/schema');
const { writePlayerEventFacts } = await import('../src/lib/playerEventFacts');
const { isEventEnded } = await import('../src/lib/survey');

const all = process.argv.includes('--all');
const allEvents = await db.select().from(events);
const existing = new Set((await db.select({ eventId: playerEventFacts.eventId }).from(playerEventFacts)).map((r) => r.eventId));

let wrote = 0;
for (const event of allEvents) {
  if (!isEventEnded(event)) continue;
  if (!all && existing.has(event.id)) {
    console.log(`skip  "${event.name}" (#${event.id}) — facts already materialized`);
    continue;
  }
  const rows = await writePlayerEventFacts(event.id, { force: true });
  console.log(`wrote "${event.name}" (#${event.id}) — ${rows} person-facts row(s)`);
  wrote += 1;

  // Echo a compact validation summary: top contributors + the reliability tail.
  const { eq: eqOp, desc } = await import('drizzle-orm');
  const written = await db
    .select()
    .from(playerEventFacts)
    .where(eqOp(playerEventFacts.eventId, event.id))
    .orderBy(desc(playerEventFacts.points));
  for (const r of written.slice(0, 5)) {
    console.log(
      `    ${Math.round(r.points).toLocaleString().padStart(7)} pts  ${r.rsn.padEnd(16)}` +
        ` team #${r.teamRank}/${r.teamsTotal}, active ${r.activeDays}d` +
        `${r.lastActiveDay != null && r.eventDays != null ? ` (last d${r.lastActiveDay}/${r.eventDays})` : ''}`,
    );
  }
  const ghosts = written.filter((r) => r.points <= 0);
  if (ghosts.length) {
    console.log(`    0 pts × ${ghosts.length}: ${ghosts.map((r) => r.rsn + (r.subbedOut ? ' (subbed)' : '')).join(', ')}`);
  }
}
console.log(`Done: ${wrote} event(s) materialized.`);
process.exit(0);
