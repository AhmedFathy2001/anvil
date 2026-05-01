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
  console.log('[recent plugin_link_codes]');
  const codes = await client.execute(`
    SELECT plc.id, plc.code, plc.user_id, plc.expires_at, plc.consumed_at, plc.created_at, u.username, u.discord_username, u.role
    FROM plugin_link_codes plc
    LEFT JOIN users u ON u.id = plc.user_id
    ORDER BY plc.created_at DESC
    LIMIT 10
  `);
  if (codes.rows.length === 0) {
    console.log('  (none) — no codes have ever been generated against this DB');
  } else {
    const now = Date.now();
    for (const r of codes.rows) {
      const expired = new Date(String(r.expires_at)).getTime() <= now;
      const consumed = !!r.consumed_at;
      const status = consumed ? 'CONSUMED' : expired ? 'EXPIRED' : 'VALID';
      const who = r.discord_username ? `@${r.discord_username}` : (r.username || `user#${r.user_id}`);
      console.log(`  ${r.code}  ${status.padEnd(8)}  user=${who} role=${r.role}  created=${r.created_at}  expires=${r.expires_at}${consumed ? `  consumed=${r.consumed_at}` : ''}`);
    }
  }

  console.log('\n[plugin_links — long-lived admin tokens]');
  const links = await client.execute(`
    SELECT pl.id, pl.user_id, pl.rsn, pl.created_at, pl.last_used_at, pl.revoked_at, u.username, u.discord_username, u.role
    FROM plugin_links pl
    LEFT JOIN users u ON u.id = pl.user_id
    ORDER BY pl.created_at DESC
    LIMIT 10
  `);
  if (links.rows.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of links.rows) {
      const who = r.discord_username ? `@${r.discord_username}` : (r.username || `user#${r.user_id}`);
      const status = r.revoked_at ? `REVOKED at ${r.revoked_at}` : 'ACTIVE';
      console.log(`  rsn=${r.rsn}  user=${who} role=${r.role}  ${status}  created=${r.created_at}  lastUsed=${r.last_used_at ?? '—'}`);
    }
  }

  client.close();
}
main();
