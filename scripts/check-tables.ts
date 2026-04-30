import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

for (const envFile of ['.env', '.env.local']) {
  try {
    const content = readFileSync(envFile, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2];
    }
  } catch {}
}

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  for (const t of ['weekly_competitions', 'weekly_participants', 'teams']) {
    console.log(`\n[${t}]`);
    const r = await client.execute(`PRAGMA table_info(${t})`);
    for (const row of r.rows) {
      console.log(`  ${row.name} ${row.type}${row.notnull ? ' NOT NULL' : ''}${row.dflt_value ? ` DEFAULT ${row.dflt_value}` : ''}`);
    }
  }
  client.close();
}
main();
