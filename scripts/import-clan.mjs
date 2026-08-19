// Move one clan's SQLite database into the shared Postgres one.
//
//   node scripts/import-clan.mjs --source /path/to/anvil.db --slug theafkspot --name "The AFK Spot"
//   node scripts/import-clan.mjs --source ... --slug ... --apply
//
// DRY RUN BY DEFAULT. Without --apply it does the whole thing inside a transaction and rolls back,
// reporting exactly what it would have written — the same convention as prune-player-snapshots.
//
// WHY IT IS TABLE-DRIVEN
//
// The two schemas are nearly identical: same table names, same column names, because the multi-clan
// conversion changed how rows are SCOPED rather than what they say. So the copy is driven off the
// column intersection of the two databases, and only the handful of genuine differences are spelled
// out below. Hand-writing forty table mappings would be forty chances to omit a column silently,
// and the omission would look like data that was never there.
//
// The differences, all of them:
//
//   clan_members   splits into accounts (global, one per OSRS account) + clan_memberships (the seat).
//                  This is the only real transformation.
//   players        is per-event enrollment despite the name, and is event_participants here.
//   federation_*   deleted with the feature; skipped.
//   root tables    gain clan_id, which is the clan being imported.
//
// WHAT MUST SURVIVE VERBATIM
//
// users.pluginToken, plugin_links, plugin_device_codes and event_participants.playerToken. Every
// member's RuneLite client holds one of these; changing one means that person has to re-link by
// hand, and it is the single most user-visible way to get this wrong. They are copied as-is and
// checked afterwards.
//
// A token identifies a PERSON, not a person-on-a-site. Someone in two clans therefore arrives with
// two, issued by two instances that each thought they owned the relationship; both are kept valid
// against the one login they now share.

import { readFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import pg from 'pg';

const require = createRequire(import.meta.url);

// ── arguments ────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const APPLY = argv.includes('--apply');
const SOURCE = arg('source');
const SLUG = arg('slug');
const NAME = arg('name');

if (!SOURCE || !SLUG) {
  console.error('usage: import-clan.mjs --source <anvil.db> --slug <slug> [--name "Display Name"] [--apply]');
  process.exit(2);
}

for (const envFile of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}

const TARGET_URL = process.env.DATABASE_URL;
if (!TARGET_URL) {
  console.error('DATABASE_URL is required (the Postgres this clan is moving into)');
  process.exit(2);
}

// ── the rules ────────────────────────────────────────────────────────────────────────────────

/** Source tables that go nowhere: the feature was deleted, or the table is scratch. */
const SKIP = new Set([
  '__drizzle_migrations',
  'sqlite_sequence',
  'rate_limits', // per-instance throttling state; nothing historical in it
]);

/** Source table -> target table, where the name changed. */
const RENAMED = { players: 'event_participants' };

/**
 * Copy order. FK parents first, so a child's remapped id always has something to point at.
 *
 * clan_members is absent because it is not copied — it is TRANSFORMED, before any of this, into the
 * accounts and clan_memberships the rest of these rows will point at.
 */
const ORDER = [
  'users',
  'settings',
  'feedback',
  'tile_library',
  'event_presets',
  'events',
  'teams',
  'tiles',
  'players',
  'event_signups',
  'signup_fees',
  'payouts',
  'completions',
  'submissions',
  'weekly_competitions',
  'weekly_participants',
  'player_snapshots',
  'player_event_facts',
  'member_daily_stats',
  'member_milestones',
  'member_personal_bests',
  'member_progress',
  'member_clog',
  'member_clog_items',
  'member_clog_kc',
  'moments',
  'clan_audit_log',
  'pending_renames',
  'detected_accounts',
  'verification_attempts',
  'plugin_links',
  'plugin_link_codes',
  'plugin_device_codes',
  'event_editors',
  'team_staff',
  'team_invites',
  'event_start_proofs',
  'survey_questions',
  'survey_responses',
  'draft_shortlists',
  'tile_audit_log',
  'tile_locks',
  'pending_notifications',
];

/**
 * Where each foreign key points, read from the TARGET database rather than listed here.
 *
 * A hand-written list is a list that goes stale: the first version of this missed
 * payouts.paid_by_user_id, which would have written a source id straight into a column pointing at
 * a different row — a silent mis-attribution rather than an error. Postgres already knows every
 * constraint, so it is asked.
 *
 * Keyed by "table.column" so two tables can use the same column name for different parents, which
 * a name-only map cannot express.
 */
async function foreignKeys(client) {
  const { rows } = await client.query(`
    SELECT tc.table_name AS child, kcu.column_name AS col, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  const map = new Map();
  for (const r of rows) map.set(`${r.child}.${r.col}`, r.parent);
  return map;
}

/** Target table name -> the source table its ids came from. */
const SOURCE_OF = { event_participants: 'players', clan_memberships: 'clan_members', accounts: 'clan_members' };

// ── plumbing ─────────────────────────────────────────────────────────────────────────────────

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('better-sqlite3 is needed to read the source database: npm i -D better-sqlite3');
  process.exit(2);
}

const src = new Database(path.resolve(SOURCE), { readonly: true });
const pool = new pg.Pool({ connectionString: TARGET_URL });

const srcTables = new Set(
  src.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name),
);
const srcCols = (t) => src.prepare(`PRAGMA table_info("${t}")`).all().map((r) => r.name);
const srcCount = (t) => src.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n;

/** old id -> new id, per source table. */
const idMap = new Map();
const mapOf = (t) => {
  if (!idMap.has(t)) idMap.set(t, new Map());
  return idMap.get(t);
};

const stats = [];
const warnings = [];

async function targetColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return new Set(rows.map((r) => r.column_name));
}

/**
 * Logins, matched on the Discord id rather than inserted.
 *
 * A Discord account is one person however many clans they are in, so the second import of someone
 * already here must MEET them rather than collide with them. Their login, their person, and every
 * account hanging off it are shared; what is per clan is the seat and the staff grant.
 *
 * Nothing about an existing login is overwritten. The other clan does not get to rename them, and
 * their platform role is not a thing an import decides.
 */
async function importUsers(client) {
  const rows = src.prepare('SELECT * FROM users').all();
  const tCols = await targetColumns(client, 'users');
  const map = mapOf('users');
  let created = 0;
  let matched = 0;
  let parkedTokens = 0;

  for (const u of rows) {
    if (u.discord_id) {
      const { rows: found } = await client.query('SELECT id, plugin_token FROM users WHERE discord_id = $1', [
        u.discord_id,
      ]);
      if (found.length) {
        map.set(u.id, found[0].id);
        matched++;

        // One person, two credentials — because two separate instances each issued this person a
        // token, back when a token belonged to a site. It belongs to the PERSON now, so the second
        // one is not another site's token to preserve: it is another key to the same account, and
        // it is kept working only so nobody's client stops authenticating at the cutover. Both
        // resolve to this one person; the extras are meant to be retired once their client has been
        // handed the canonical one.
        if (u.plugin_token && u.plugin_token !== found[0].plugin_token) {
          await client.query(
            `INSERT INTO plugin_links (user_id, token) VALUES ($1, $2)
             ON CONFLICT (token) DO NOTHING`,
            [found[0].id, u.plugin_token],
          );
          parkedTokens++;
        }
        continue;
      }
    }

    // The person first, so the login has an identity to hang accounts off.
    const { rows: person } = await client.query(
      'INSERT INTO players (display_name) VALUES ($1) RETURNING id',
      [u.display_name ?? u.discord_username ?? null],
    );

    const cols = Object.keys(u).filter((c) => tCols.has(c) && c !== 'id');
    const vals = cols.map((c) => u[c]);
    cols.push('player_id');
    vals.push(person[0].id);

    const { rows: out } = await client.query(
      `INSERT INTO users (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
      vals,
    );
    map.set(u.id, out[0].id);
    created++;
  }

  stats.push({
    table: 'users',
    rows: rows.length,
    note: [
      `${created} new`,
      `${matched} already known (same Discord account)`,
      parkedTokens ? `${parkedTokens} inherited tokens kept working (same person)` : '',
    ].filter(Boolean).join(', '),
  });
}

// ── the identity split ───────────────────────────────────────────────────────────────────────

/**
 * clan_members becomes accounts + clan_memberships, and the people who own them.
 *
 * Accounts are GLOBAL, so this is where a second clan's import meets the first: an RSN already
 * imported keeps its account and simply gains a seat. That is the whole point of the model — the
 * same person in two clans is one person — and it is why account matching happens before anything
 * else is copied.
 */
async function importRoster(client, clanId) {
  const rows = src.prepare('SELECT * FROM clan_members').all();
  // Older sources are missing some of these columns; SQLite returns undefined for them, which
  // becomes NULL, which is the honest answer for a clan that never recorded it.
  const seatMap = mapOf('clan_members');
  let newAccounts = 0;
  let reusedAccounts = 0;

  for (const cm of rows) {
    // Hash first: it survives renames, so it identifies the account when the name no longer does.
    let account = null;
    if (cm.account_hash) {
      const { rows: byHash } = await client.query('SELECT * FROM accounts WHERE account_hash = $1', [cm.account_hash]);
      account = byHash[0] ?? null;
    }
    if (!account) {
      const { rows: byRsn } = await client.query('SELECT * FROM accounts WHERE rsn_normalized = $1', [
        cm.rsn_normalized,
      ]);
      account = byRsn[0] ?? null;
    }

    if (account) {
      reusedAccounts++;
      // Fill in anything this clan knows and the existing row does not, without overwriting.
      await client.query(
        `UPDATE accounts SET
           account_hash = COALESCE(account_hash, $2),
           verified_at = LEAST(COALESCE(verified_at, $3), COALESCE($3, verified_at)),
           claimed_at = LEAST(COALESCE(claimed_at, $4), COALESCE($4, claimed_at)),
           stats_overall_xp = GREATEST(COALESCE(stats_overall_xp, 0), COALESCE($5, 0)),
           previous_rsns = COALESCE(previous_rsns, $6)
         WHERE id = $1`,
        [account.id, cm.account_hash, cm.verified_at, cm.claimed_at, cm.stats_overall_xp, cm.previous_rsns],
      );
    } else {
      // A person for the account. If the seat is claimed, the owner is that login's person; if not,
      // the account gets a person of its own, so a later claim merges people rather than filling a
      // blank.
      const ownerUserId = cm.user_id != null ? mapOf('users').get(cm.user_id) ?? null : null;
      let playerId = null;
      if (ownerUserId != null) {
        const { rows: u } = await client.query('SELECT player_id FROM users WHERE id = $1', [ownerUserId]);
        playerId = u[0]?.player_id ?? null;
      }
      if (playerId == null) {
        const { rows: p } = await client.query(
          'INSERT INTO players (display_name) VALUES ($1) RETURNING id',
          [cm.rsn],
        );
        playerId = p[0].id;
      }

      const { rows: a } = await client.query(
        `INSERT INTO accounts (
           player_id, rsn, rsn_normalized, account_hash, discord_id, status, status_last_checked,
           previous_rsns, is_primary, verified_at, verification_method, provisional, claimed_at,
           live_stats, live_stats_at, live_stat_key_times, stats_overall_xp, stats_miss_streak,
           stats_next_due_at, stats_last_snapshot, stats_activities
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id`,
        [
          playerId, cm.rsn, cm.rsn_normalized, cm.account_hash, cm.discord_id,
          cm.status ?? 'active', cm.status_last_checked, cm.previous_rsns, cm.is_primary ?? 0,
          cm.verified_at, cm.verification_method, cm.provisional ?? 0, cm.claimed_at,
          cm.live_stats, cm.live_stats_at, cm.live_stat_key_times, cm.stats_overall_xp,
          cm.stats_miss_streak ?? 0, cm.stats_next_due_at, cm.stats_last_snapshot, cm.stats_activities,
        ],
      );
      account = { id: a[0].id };
      newAccounts++;
    }

    // The seat. kind carries the rule the flag encoded: only the in-game roster made a member.
    const { rows: seat } = await client.query(
      `INSERT INTO clan_memberships (clan_id, account_id, kind, rank, source, joined_at, left_at,
                                     last_seen_in_clan, notes, pending_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (clan_id, account_id) DO UPDATE SET rank = EXCLUDED.rank
       RETURNING id`,
      [
        clanId, account.id,
        cm.is_guest === 0 ? 'member' : 'guest',
        cm.rank,
        cm.source === 'plugin-roster' ? 'roster' : cm.source === 'manual' ? 'admin' : 'application',
        cm.joined_at, cm.left_at, cm.last_seen_in_clan, cm.notes, cm.pending_role,
      ],
    );
    seatMap.set(cm.id, seat[0].id);
  }

  stats.push({ table: 'clan_members', rows: rows.length, note: `${newAccounts} new accounts, ${reusedAccounts} already known` });
}

/**
 * Authority: the roles that lived on users become grants in this clan.
 *
 * A role on the person would make them staff of every clan on the deployment, which is the bug the
 * whole conversion exists to fix — so it is not carried across as one.
 */
async function importStaff(client, clanId) {
  // Which of these the source even has: a clan that has not been redeployed recently predates some
  // of them, and naming a missing column fails the whole import rather than degrading.
  const has = new Set(srcCols('users'));
  const clauses = [];
  if (has.has('is_owner')) clauses.push('is_owner = 1');
  if (has.has('role')) clauses.push("role <> 'member'");
  if (has.has('can_edit_tiles')) clauses.push('can_edit_tiles = 1');
  if (!clauses.length) return;

  const rows = src.prepare(`SELECT * FROM users WHERE ${clauses.join(' OR ')}`).all();
  let n = 0;
  for (const u of rows) {
    const userId = mapOf('users').get(u.id);
    if (userId == null) continue;
    const srcRole = u.role ?? 'member';
    const role = u.is_owner ? 'owner' : srcRole === 'editor' ? 'member' : srcRole;
    await client.query(
      `INSERT INTO clan_staff (clan_id, user_id, role, can_edit_tiles, editor_scope)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (clan_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [clanId, userId, role, u.can_edit_tiles === 1 || srcRole === 'editor' || srcRole === 'admin', u.editor_scope ?? 'all'],
    );
    n++;
  }
  stats.push({ table: 'clan_staff', rows: n, note: "from the source's users.role" });
}

// ── the generic copy ─────────────────────────────────────────────────────────────────────────

async function copyTable(client, srcTable, clanId, fks) {
  const dest = RENAMED[srcTable] ?? srcTable;
  if (!srcTables.has(srcTable)) return;

  const tCols = await targetColumns(client, dest);
  if (!tCols.size) {
    warnings.push(`${srcTable}: no target table '${dest}' — skipped`);
    return;
  }

  const sCols = srcCols(srcTable);
  const shared = sCols.filter((c) => tCols.has(c) && c !== 'id');
  const dropped = sCols.filter((c) => !tCols.has(c) && c !== 'id');
  const rows = src.prepare(`SELECT * FROM "${srcTable}"`).all();
  if (!rows.length) return;

  const wantsClan = tCols.has('clan_id') && !sCols.includes('clan_id');
  const cols = [...shared, ...(wantsClan ? ['clan_id'] : [])];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  // Not every table has a surrogate id — settings is keyed (clan_id, key) — and asking one for a
  // column it does not have fails the whole import.
  const hasId = tCols.has('id');
  const insert =
    `INSERT INTO "${dest}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${placeholders})` +
    (hasId ? ' RETURNING id' : '');

  const map = mapOf(srcTable);
  let written = 0;
  let orphaned = 0;

  for (const row of rows) {
    const values = [];
    let skip = false;
    for (const c of shared) {
      let v = row[c];
      // The parent this column points at, in TARGET terms, translated back to the source table
      // whose ids were mapped. clan_id is ours, not the source's, so it is never remapped.
      const parent = c === 'clan_id' ? null : fks.get(`${dest}.${c}`);
      const fkTable = parent ? SOURCE_OF[parent] ?? parent : null;
      if (fkTable && v != null) {
        const mapped = mapOf(fkTable).get(v);
        if (mapped == null) {
          // The parent never made it — a row pointing at something deleted, or at a federation
          // table. Dropping it is better than a dangling id, but it must be counted, not silent.
          orphaned++;
          skip = true;
          break;
        }
        v = mapped;
      }
      values.push(v);
    }
    if (skip) continue;
    if (wantsClan) values.push(clanId);

    const { rows: out } = await client.query(insert, values);
    if (hasId && row.id != null && out[0]?.id != null) map.set(row.id, out[0].id);
    written++;
  }

  stats.push({
    table: `${srcTable}${dest !== srcTable ? ` -> ${dest}` : ''}`,
    rows: written,
    note: [
      dropped.length ? `dropped cols: ${dropped.join(',')}` : '',
      orphaned ? `${orphaned} rows skipped (parent missing)` : '',
    ].filter(Boolean).join('; '),
  });
}

// ── verification ─────────────────────────────────────────────────────────────────────────────

/**
 * The checks worth failing the import over.
 *
 * Every member's RuneLite client holds a token. If one changes, that person has to re-link by hand,
 * and they will not know why — so this compares them rather than trusting that a copy copied.
 */
async function verify(client, clanId) {
  const problems = [];

  const srcTokens = src.prepare('SELECT plugin_token FROM users WHERE plugin_token IS NOT NULL').all().map((r) => r.plugin_token);
  if (srcTokens.length) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM (
         SELECT plugin_token AS t FROM users WHERE plugin_token = ANY($1)
         UNION
         SELECT token FROM plugin_links WHERE token = ANY($1) AND revoked_at IS NULL
       ) k`,
      [srcTokens],
    );
    if (rows[0].n !== srcTokens.length) {
      problems.push(`plugin tokens: ${rows[0].n} of ${srcTokens.length} survived`);
    }
  }

  const srcPlayerTokens = src.prepare('SELECT player_token FROM players WHERE player_token IS NOT NULL').all().map((r) => r.player_token);
  if (srcPlayerTokens.length) {
    const { rows } = await client.query(
      'SELECT count(*)::int AS n FROM event_participants WHERE player_token = ANY($1)',
      [srcPlayerTokens],
    );
    if (rows[0].n !== srcPlayerTokens.length) {
      problems.push(`player tokens: ${rows[0].n} of ${srcPlayerTokens.length} survived`);
    }
  }

  // Counts that must match exactly, per clan.
  for (const [srcTable, dest] of [['events', 'events'], ['completions', 'completions'], ['submissions', 'submissions'], ['tiles', 'tiles']]) {
    if (!srcTables.has(srcTable)) continue;
    const want = srcCount(srcTable);
    const q = dest === 'events'
      ? 'SELECT count(*)::int AS n FROM events WHERE clan_id = $1'
      : dest === 'tiles'
        ? 'SELECT count(*)::int AS n FROM tiles t JOIN events e ON e.id = t.event_id WHERE e.clan_id = $1'
        : dest === 'completions'
          ? 'SELECT count(*)::int AS n FROM completions c JOIN tiles t ON t.id = c.tile_id JOIN events e ON e.id = t.event_id WHERE e.clan_id = $1'
          : 'SELECT count(*)::int AS n FROM submissions s JOIN tiles t ON t.id = s.tile_id JOIN events e ON e.id = t.event_id WHERE e.clan_id = $1';
    const { rows } = await client.query(q, [clanId]);
    if (rows[0].n !== want) problems.push(`${dest}: ${rows[0].n} imported, ${want} in source`);
  }

  // Every seat must have an account, and every account a person.
  const { rows: dangling } = await client.query(
    `SELECT
       (SELECT count(*)::int FROM clan_memberships m LEFT JOIN accounts a ON a.id = m.account_id
         WHERE m.clan_id = $1 AND a.id IS NULL) AS seats_without_accounts,
       (SELECT count(*)::int FROM accounts WHERE player_id IS NULL) AS accounts_without_people`,
    [clanId],
  );
  if (dangling[0].seats_without_accounts) problems.push(`${dangling[0].seats_without_accounts} seats with no account`);
  if (dangling[0].accounts_without_people) problems.push(`${dangling[0].accounts_without_people} accounts with no person`);

  return problems;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────

const client = await pool.connect();
let failed = false;
try {
  await client.query('BEGIN');

  const { rows: existing } = await client.query('SELECT id, name FROM clans WHERE slug = $1', [SLUG]);
  let clanId;
  if (existing.length) {
    clanId = existing[0].id;
    console.log(`[import] clan '${SLUG}' already exists (id ${clanId})`);
  } else {
    const { rows } = await client.query(
      'INSERT INTO clans (slug, name) VALUES ($1, $2) RETURNING id',
      [SLUG, NAME || SLUG],
    );
    clanId = rows[0].id;
    console.log(`[import] created clan '${SLUG}' (id ${clanId})`);
  }

  // users first: the roster and the staff grants both resolve through them.
  const fks = await foreignKeys(client);
  await importUsers(client);
  await importRoster(client, clanId);
  await importStaff(client, clanId);

  for (const t of ORDER) {
    if (t === 'users' || SKIP.has(t) || t.startsWith('federation_')) continue;
    await copyTable(client, t, clanId, fks);
  }

  // Anything present in the source that no rule mentions — a table added since this was written.
  const covered = new Set([...ORDER, ...SKIP, 'clan_members']);
  for (const t of srcTables) {
    if (covered.has(t) || t.startsWith('federation_') || t.startsWith('sqlite_')) continue;
    if (srcCount(t) > 0) warnings.push(`${t}: ${srcCount(t)} rows, and no rule for it — NOT imported`);
  }

  const problems = await verify(client, clanId);

  console.log('\n  rows      table');
  for (const s of stats) {
    console.log(`  ${String(s.rows).padStart(6)}    ${s.table}${s.note ? `   (${s.note})` : ''}`);
  }

  if (warnings.length) {
    console.log('\nwarnings:');
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  if (problems.length) {
    failed = true;
    console.log('\nVERIFICATION FAILED:');
    for (const p of problems) console.log(`  x ${p}`);
  } else {
    console.log('\nverification passed: tokens intact, counts match, no dangling identity.');
  }

  if (APPLY && !failed) {
    await client.query('COMMIT');
    console.log('\n[import] committed.');
  } else {
    await client.query('ROLLBACK');
    console.log(failed ? '\n[import] rolled back — verification failed.' : '\n[import] DRY RUN — rolled back. Re-run with --apply to keep it.');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('\n[import] failed, rolled back:', e.message);
  failed = true;
} finally {
  client.release();
  await pool.end();
  src.close();
}

process.exit(failed ? 1 : 0);
