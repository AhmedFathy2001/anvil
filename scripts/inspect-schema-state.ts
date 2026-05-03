/**
 * Read-only audit of which Phase 1 / pluginToken bits actually exist in prod.
 * Run: npx tsx scripts/inspect-schema-state.ts
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

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url: url!, authToken });

async function tableExists(name: string) {
  const r = await client.execute({
    sql: `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
    args: [name],
  });
  return r.rows.length > 0;
}

async function columnExists(table: string, col: string) {
  const r = await client.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === col);
}

async function main() {
  console.log('# 0022 (sign-up tables/columns)');
  console.log(`event_signups table:        ${await tableExists('event_signups')}`);
  console.log(`signup_fees table:          ${await tableExists('signup_fees')}`);
  console.log(`events.signup_fee:          ${await columnExists('events', 'signup_fee')}`);
  console.log(`events.signup_opens_at:     ${await columnExists('events', 'signup_opens_at')}`);
  console.log(`events.signup_deadline:     ${await columnExists('events', 'signup_deadline')}`);
  console.log(`events.captain_selection_deadline: ${await columnExists('events', 'captain_selection_deadline')}`);

  console.log('\n# 0023 (plugin_token)');
  console.log(`users.plugin_token:         ${await columnExists('users', 'plugin_token')}`);

  console.log('\n# Orphan column status');
  console.log(`weekly_competitions.wom_competition_id: ${await columnExists('weekly_competitions', 'wom_competition_id')}`);

  console.log('\n# Migration journal');
  const m = await client.execute('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id');
  console.log(`Rows: ${m.rows.length}`);
  for (const r of m.rows) {
    console.log(`  id=${r.id}  hash=${String(r.hash).slice(0, 12)}…  created_at=${r.created_at}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => client.close());
