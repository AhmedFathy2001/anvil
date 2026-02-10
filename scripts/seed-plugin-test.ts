/**
 * Seeds a test event for plugin development.
 * Run: npx tsx scripts/seed-plugin-test.ts
 *
 * Creates:
 * - Event: "Plugin Test Bingo"
 * - Team: "Test Team"
 * - Player: "TestPlayer" with a playerToken
 * - Drop tile: "Bones" tracking item ID 526 (regular bones)
 *
 * After running, copy the playerToken into the RuneLite plugin config.
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { events, tiles, teams, players } from '../src/db/schema';
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
  // Create event (active now, ends in 7 days)
  const now = new Date();
  const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // started 1hr ago
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // ends in 7 days

  const [event] = await db.insert(events).values({
    name: 'Plugin Test Bingo',
    boardSize: 3,
    startDate,
    endDate,
  }).returning();

  console.log(`Created event: id=${event.id}, name="${event.name}"`);

  // Create team
  const [team] = await db.insert(teams).values({
    eventId: event.id,
    name: 'Test Team',
    color: '#e74c3c',
    captainPassword: 'test123',
  }).returning();

  console.log(`Created team: id=${team.id}, name="${team.name}"`);

  // Create player with token
  const playerToken = randomUUID();
  const [player] = await db.insert(players).values({
    eventId: event.id,
    name: 'TestPlayer',
    teamId: team.id,
    playerToken,
  }).returning();

  console.log(`Created player: id=${player.id}, name="${player.name}"`);

  // Create drop tile: Bones (item ID 526)
  const [bonesTile] = await db.insert(tiles).values({
    eventId: event.id,
    position: 0,
    label: 'Bones',
    tileType: 'drop',
    requiredAmount: 1,
    trackedItemIds: JSON.stringify([526]),
  }).returning();

  console.log(`Created tile: id=${bonesTile.id}, label="${bonesTile.label}", itemIds=[526]`);

  console.log('\n========================================');
  console.log('Plugin test data created successfully!');
  console.log('========================================');
  console.log(`\nSite URL: http://localhost:3000`);
  console.log(`Player Token: ${playerToken}`);
  console.log('\nPaste these into the OSRS Bingo plugin settings in RuneLite.');
  console.log('Then kill any NPC that drops bones to trigger the auto-submit.\n');
}

seed().catch(console.error);
