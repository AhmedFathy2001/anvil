// Bring a drifted DB up to current schema, idempotently. Adds missing columns,
// creates missing tables, creates missing indexes, and relaxes NOT NULL where
// the schema now allows null. Doesn't drop anything.
//
// Run:  npx tsx scripts/sync-schema.ts
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

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runSql(sql: string, label?: string) {
  try {
    await client.execute(sql);
    if (label) console.log(`  ok ${label}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already exists|duplicate column/i.test(msg)) {
      if (label) console.log(`  -- ${label} (already present)`);
    } else {
      console.error(`  !! ${label ?? sql}: ${msg}`);
      throw e;
    }
  }
}

async function tableExists(name: string): Promise<boolean> {
  const r = await client.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function columnExists(table: string, col: string): Promise<boolean> {
  const r = await client.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === col);
}

async function addColumnIfMissing(table: string, column: string, def: string) {
  if (await columnExists(table, column)) {
    console.log(`  -- ${table}.${column} (already present)`);
    return;
  }
  await runSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`, `${table}.${column}`);
}

async function main() {
  console.log('--- users ---');
  await addColumnIfMissing('users', 'discord_id', 'TEXT');
  await addColumnIfMissing('users', 'discord_username', 'TEXT');
  await addColumnIfMissing('users', 'discord_avatar', 'TEXT');
  await addColumnIfMissing('users', 'email', 'TEXT');
  await addColumnIfMissing('users', 'last_login_at', 'TEXT');
  await runSql(
    'ALTER TABLE users ALTER COLUMN "username" TO "username" text',
    'users.username -> nullable',
  );
  await runSql(
    'ALTER TABLE users ALTER COLUMN "password_hash" TO "password_hash" text',
    'users.password_hash -> nullable',
  );

  console.log('--- events ---');
  if (!(await columnExists('events', 'tiles_revealed'))) {
    await runSql('ALTER TABLE events ADD COLUMN tiles_revealed INTEGER NOT NULL DEFAULT 0', 'events.tiles_revealed');
    // One-time backfill: every event that already exists keeps its current (visible)
    // behavior. Only events created from now on start hidden-until-revealed. Guarded by
    // the column-not-exists check so re-running this sync never re-reveals an event an
    // admin has since chosen to hide.
    await runSql('UPDATE events SET tiles_revealed = 1', 'events.tiles_revealed backfill');
  } else {
    console.log('  -- events.tiles_revealed (already present)');
  }

  console.log('--- players ---');
  await addColumnIfMissing('players', 'clan_member_id', 'INTEGER REFERENCES clan_members(id)');

  console.log('--- weekly_participants ---');
  await addColumnIfMissing('weekly_participants', 'clan_member_id', 'INTEGER REFERENCES clan_members(id)');
  await addColumnIfMissing('weekly_participants', 'rsn_normalized', "TEXT NOT NULL DEFAULT ''");

  console.log('--- teams ---');
  await addColumnIfMissing('teams', 'captain_user_id', 'INTEGER REFERENCES users(id)');

  console.log('--- new tables ---');

  if (!(await tableExists('clan_members'))) {
    await runSql(
      `CREATE TABLE clan_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rsn TEXT NOT NULL,
        rsn_normalized TEXT NOT NULL,
        discord_id TEXT,
        rank TEXT,
        is_guest INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'manual',
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        left_at TEXT,
        last_seen_in_clan TEXT,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        account_hash TEXT,
        previous_rsns TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        verified_at TEXT,
        verification_method TEXT,
        verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        provisional INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT
      )`,
      'CREATE TABLE clan_members',
    );
  } else {
    for (const [c, def] of [
      ['user_id', 'INTEGER REFERENCES users(id)'],
      ['account_hash', 'TEXT'],
      ['previous_rsns', 'TEXT'],
      ['is_primary', 'INTEGER NOT NULL DEFAULT 0'],
      ['verified_at', 'TEXT'],
      ['verification_method', 'TEXT'],
      ['verified_by_user_id', 'INTEGER REFERENCES users(id)'],
      ['provisional', 'INTEGER NOT NULL DEFAULT 0'],
      ['claimed_at', 'TEXT'],
    ] as const) {
      await addColumnIfMissing('clan_members', c, def);
    }
  }

  await runSql(
    `CREATE TABLE IF NOT EXISTS clan_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan_member_id INTEGER REFERENCES clan_members(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    'CREATE TABLE clan_audit_log',
  );

  await runSql(
    `CREATE TABLE IF NOT EXISTS verification_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rsn TEXT NOT NULL,
      rsn_normalized TEXT NOT NULL,
      baseline_snapshot TEXT NOT NULL,
      min_delta INTEGER NOT NULL DEFAULT 1000,
      expires_at TEXT NOT NULL,
      completed_at TEXT,
      succeeded INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    'CREATE TABLE verification_attempts',
  );

  await runSql(
    `CREATE TABLE IF NOT EXISTS plugin_link_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    'CREATE TABLE plugin_link_codes',
  );

  await runSql(
    `CREATE TABLE IF NOT EXISTS plugin_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rsn TEXT NOT NULL,
      rsn_normalized TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked_at TEXT
    )`,
    'CREATE TABLE plugin_links',
  );

  await runSql(
    `CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT NOT NULL
    )`,
    'CREATE TABLE rate_limits',
  );

  console.log('--- indexes ---');
  const indexes: [string, string][] = [
    ['users_username_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username)'],
    ['users_discord_id_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS users_discord_id_unique ON users(discord_id)'],
    ['players_event_id_idx', 'CREATE INDEX IF NOT EXISTS players_event_id_idx ON players(event_id)'],
    ['players_event_team_idx', 'CREATE INDEX IF NOT EXISTS players_event_team_idx ON players(event_id, team_id)'],
    ['players_clan_member_id_idx', 'CREATE INDEX IF NOT EXISTS players_clan_member_id_idx ON players(clan_member_id)'],
    ['player_token_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS player_token_unique ON players(player_token)'],
    ['teams_event_id_idx', 'CREATE INDEX IF NOT EXISTS teams_event_id_idx ON teams(event_id)'],
    ['teams_captain_user_id_idx', 'CREATE INDEX IF NOT EXISTS teams_captain_user_id_idx ON teams(captain_user_id)'],
    ['tiles_event_id_idx', 'CREATE INDEX IF NOT EXISTS tiles_event_id_idx ON tiles(event_id)'],
    ['team_tile_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS team_tile_unique ON completions(team_id, tile_id)'],
    ['completions_team_id_idx', 'CREATE INDEX IF NOT EXISTS completions_team_id_idx ON completions(team_id)'],
    ['completions_tile_id_idx', 'CREATE INDEX IF NOT EXISTS completions_tile_id_idx ON completions(tile_id)'],
    ['submissions_tile_id_idx', 'CREATE INDEX IF NOT EXISTS submissions_tile_id_idx ON submissions(tile_id)'],
    ['submissions_team_id_idx', 'CREATE INDEX IF NOT EXISTS submissions_team_id_idx ON submissions(team_id)'],
    ['submissions_tile_team_idx', 'CREATE INDEX IF NOT EXISTS submissions_tile_team_idx ON submissions(tile_id, team_id)'],
    ['weekly_participant_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS weekly_participant_unique ON weekly_participants(competition_id, rsn_normalized)'],
    ['weekly_participants_comp_id_idx', 'CREATE INDEX IF NOT EXISTS weekly_participants_comp_id_idx ON weekly_participants(competition_id)'],
    ['weekly_participants_clan_member_id_idx', 'CREATE INDEX IF NOT EXISTS weekly_participants_clan_member_id_idx ON weekly_participants(clan_member_id)'],
    ['clan_members_rsn_normalized_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS clan_members_rsn_normalized_unique ON clan_members(rsn_normalized)'],
    ['clan_members_account_hash_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS clan_members_account_hash_unique ON clan_members(account_hash)'],
    ['clan_members_left_at_idx', 'CREATE INDEX IF NOT EXISTS clan_members_left_at_idx ON clan_members(left_at)'],
    ['clan_members_user_id_idx', 'CREATE INDEX IF NOT EXISTS clan_members_user_id_idx ON clan_members(user_id)'],
    ['clan_members_provisional_idx', 'CREATE INDEX IF NOT EXISTS clan_members_provisional_idx ON clan_members(provisional)'],
    ['clan_audit_log_member_id_idx', 'CREATE INDEX IF NOT EXISTS clan_audit_log_member_id_idx ON clan_audit_log(clan_member_id)'],
    ['clan_audit_log_occurred_at_idx', 'CREATE INDEX IF NOT EXISTS clan_audit_log_occurred_at_idx ON clan_audit_log(occurred_at)'],
    ['clan_audit_log_event_type_idx', 'CREATE INDEX IF NOT EXISTS clan_audit_log_event_type_idx ON clan_audit_log(event_type)'],
    ['verification_attempts_user_id_idx', 'CREATE INDEX IF NOT EXISTS verification_attempts_user_id_idx ON verification_attempts(user_id)'],
    ['verification_attempts_rsn_normalized_idx', 'CREATE INDEX IF NOT EXISTS verification_attempts_rsn_normalized_idx ON verification_attempts(rsn_normalized)'],
    ['verification_attempts_expires_at_idx', 'CREATE INDEX IF NOT EXISTS verification_attempts_expires_at_idx ON verification_attempts(expires_at)'],
    ['plugin_link_codes_code_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS plugin_link_codes_code_unique ON plugin_link_codes(code)'],
    ['plugin_link_codes_user_id_idx', 'CREATE INDEX IF NOT EXISTS plugin_link_codes_user_id_idx ON plugin_link_codes(user_id)'],
    ['plugin_links_token_unique', 'CREATE UNIQUE INDEX IF NOT EXISTS plugin_links_token_unique ON plugin_links(token)'],
    ['plugin_links_user_id_idx', 'CREATE INDEX IF NOT EXISTS plugin_links_user_id_idx ON plugin_links(user_id)'],
    ['rate_limits_expires_at_idx', 'CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits(expires_at)'],
  ];
  for (const [name, sql] of indexes) {
    await runSql(sql, name);
  }

  console.log('\nDone. Now run: npx tsx scripts/bootstrap-migrations-table.ts --mark-all');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
