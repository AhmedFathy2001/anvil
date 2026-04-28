/**
 * Seeds a test event for plugin development.
 * Run: npx tsx scripts/seed-plugin-test.ts
 *
 * Cleans up any previous "Plugin Test Bingo" events first.
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { events, tiles, teams, players, submissions } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

// Load env files manually
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

const db = drizzle(client);

async function seed() {
  // Clean up old test events
  const oldEvents = await db.select().from(events);
  for (const evt of oldEvents) {
    if (evt.name === 'Plugin Test Bingo') {
      console.log(`Deleting old test event: id=${evt.id}`);
      // Cascade deletes tiles, teams, players, submissions via FK
      await db.delete(events).where(eq(events.id, evt.id));
    }
  }

  // Create event with precise dates
  // Starts now, ends Feb 17 2026 at 23:59:59 UTC
  const startDate = '2026-02-10T19:00:00.000Z';
  const endDate = '2026-02-17T23:59:59.000Z';

  const [event] = await db.insert(events).values({
    name: 'Plugin Test Bingo',
    boardSize: 3,
    startDate,
    endDate,
  }).returning();

  console.log(`Created event: id=${event.id}, name="${event.name}"`);
  console.log(`  Start: ${startDate}`);
  console.log(`  End:   ${endDate}`);

  // Create Team 1
  const [team1] = await db.insert(teams).values({
    eventId: event.id,
    name: 'Test Team',
    color: '#e74c3c',
    captainPassword: 'test123',
  }).returning();

  console.log(`Created team: id=${team1.id}, name="${team1.name}"`);

  // Create Team 2
  const [team2] = await db.insert(teams).values({
    eventId: event.id,
    name: 'Rival Team',
    color: '#3498db',
    captainPassword: 'test456',
  }).returning();

  console.log(`Created team: id=${team2.id}, name="${team2.name}"`);

  // Player 1 on Team 1
  const playerToken1 = randomUUID();
  const [player1] = await db.insert(players).values({
    eventId: event.id,
    name: 'TestPlayer1',
    teamId: team1.id,
    playerToken: playerToken1,
  }).returning();

  console.log(`Created player: id=${player1.id}, name="${player1.name}" (Team 1)`);

  // Player 2 on Team 1
  const playerToken2 = randomUUID();
  const [player2] = await db.insert(players).values({
    eventId: event.id,
    name: 'TestPlayer2',
    teamId: team1.id,
    playerToken: playerToken2,
  }).returning();

  console.log(`Created player: id=${player2.id}, name="${player2.name}" (Team 1)`);

  // Player 3 on Team 2
  const playerToken3 = randomUUID();
  const [player3] = await db.insert(players).values({
    eventId: event.id,
    name: 'RivalPlayer',
    teamId: team2.id,
    playerToken: playerToken3,
  }).returning();

  console.log(`Created player: id=${player3.id}, name="${player3.name}" (Team 2)`);

  // Create drop tiles with common NPC drops for easy testing
  const dropTiles = [
    { position: 0, label: 'Bones',        itemIds: [526],  required: 1 },
    { position: 1, label: 'Cowhide',      itemIds: [1739], required: 2 },
    { position: 2, label: 'Raw Chicken',   itemIds: [2138], required: 1 },
    { position: 3, label: 'Bronze Arrows', itemIds: [882],  required: 5 },
  ];

  for (const t of dropTiles) {
    const [tile] = await db.insert(tiles).values({
      eventId: event.id,
      position: t.position,
      label: t.label,
      tileType: 'drop',
      requiredAmount: t.required,
      trackedItemIds: JSON.stringify(t.itemIds),
    }).returning();

    console.log(`Created tile: id=${tile.id}, label="${tile.label}", itemIds=${JSON.stringify(t.itemIds)}, required=${t.required}`);
  }

  console.log('\n========================================');
  console.log('Plugin test data created successfully!');
  console.log('========================================');
  console.log('\nPlayer Tokens:');
  console.log(`  Team 1 - TestPlayer1:  ${playerToken1}`);
  console.log(`  Team 1 - TestPlayer2:  ${playerToken2}`);
  console.log(`  Team 2 - RivalPlayer:  ${playerToken3}`);
  console.log('\nPaste a token into the Anvil plugin settings in RuneLite.');
  console.log('Then kill any NPC that drops bones to trigger the auto-submit.\n');
}

seed().catch(console.error);
