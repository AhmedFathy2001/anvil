// The list of everything Anvil holds about a person (src/lib/personData.ts) against the schema.
//
// Deleting an account and exporting its data both walk that one list. This is what keeps the list
// honest: a table added later that points at `users`, `players` or `accounts` and is not in it would
// either be cascade-deleted without anybody deciding that, or keep personal data after a deletion,
// and nothing would error. Here it fails.
//
// Pure: reads the Drizzle table definitions, never a database.
//
// Run: npm run test:erase

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

import * as schema from '../src/db/schema.ts';
import { PERSON_DATA, PERSON_VALUE_COLUMNS, neverExported, type PersonKey } from '../src/lib/personData.ts';

interface Col {
  notNull: boolean;
  /** Referenced table and ON DELETE action, when the column is a foreign key. */
  ref?: { table: string; onDelete: string };
}

const TABLES = new Map<string, Map<string, Col>>();
for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const cfg = getTableConfig(value as PgTable);
  const cols = new Map<string, Col>();
  for (const c of cfg.columns) cols.set(c.name, { notNull: c.notNull });
  for (const fk of cfg.foreignKeys) {
    const r = fk.reference();
    for (const c of r.columns) cols.get(c.name)!.ref = { table: getTableConfig(r.foreignTable).name, onDelete: fk.onDelete ?? 'no action' };
  }
  TABLES.set(cfg.name, cols);
}

const PERSON_TABLES = new Set(['users', 'players', 'accounts']);
const KEY_TABLE: Record<PersonKey, string> = {
  user: 'users',
  player: 'players',
  account: 'accounts',
  seat: 'clan_memberships',
  participant: 'event_participants',
};
const listed = new Set(PERSON_DATA.map((p) => `${p.table}.${p.column}`));

test('every column that points at a login, a person or a character is in the list', () => {
  const missing: string[] = [];
  for (const [table, cols] of TABLES) {
    for (const [column, col] of cols) {
      if (col.ref && PERSON_TABLES.has(col.ref.table) && !listed.has(`${table}.${column}`)) {
        missing.push(`${table}.${column} -> ${col.ref.table} (on delete ${col.ref.onDelete})`);
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    'These columns name a person and src/lib/personData.ts does not say what happens to them when an account is deleted. Add each to PERSON_DATA as delete, detach or keep.',
  );
});

test('the schema really has foreign keys to users / players / accounts (the check above is not vacuous)', () => {
  let n = 0;
  for (const cols of TABLES.values()) for (const col of cols.values()) if (col.ref && PERSON_TABLES.has(col.ref.table)) n++;
  assert.ok(n > 150, `expected well over 150 person-pointing columns, found ${n}`);
});

test('every entry names a real table and column, once', () => {
  const seen = new Set<string>();
  for (const p of PERSON_DATA) {
    const cols = TABLES.get(p.table);
    assert.ok(cols, `no table ${p.table}`);
    assert.ok(cols.has(p.column), `no column ${p.table}.${p.column}`);
    const id = `${p.table}.${p.column}`;
    assert.ok(!seen.has(id), `${id} is listed twice`);
    seen.add(id);
    for (const c of [...(p.scrub ?? []), ...(p.export?.columns ?? [])]) assert.ok(cols.has(c), `no column ${p.table}.${c}`);
  }
  for (const v of PERSON_VALUE_COLUMNS) assert.ok(TABLES.get(v.table)?.has(v.column), `no column ${v.table}.${v.column}`);
});

test('a foreign key is found by the kind of id it points at', () => {
  for (const p of PERSON_DATA) {
    const col = TABLES.get(p.table)!.get(p.column)!;
    if (!col.ref) continue;
    assert.equal(col.ref.table, KEY_TABLE[p.key], `${p.table}.${p.column} points at ${col.ref.table} but is keyed "${p.key}"`);
  }
});

test('an entry left to the schema matches what the schema does', () => {
  for (const p of PERSON_DATA) {
    if (p.via !== 'fk') continue;
    const col = TABLES.get(p.table)!.get(p.column)!;
    assert.ok(col.ref, `${p.table}.${p.column} is "fk" but has no foreign key`);
    assert.ok(p.key === 'user' || p.key === 'player', `${p.table}.${p.column}: only the login and the person are deleted, so only they can leave work to the schema`);
    const want = p.handling === 'delete' ? 'cascade' : p.handling === 'detach' ? 'set null' : null;
    assert.ok(want, `${p.table}.${p.column}: "keep" cannot be left to the schema`);
    assert.equal(col.ref.onDelete, want, `${p.table}.${p.column} is listed as ${p.handling} but the schema says ON DELETE ${col.ref.onDelete}`);
  }
});

test('a plain detach only clears columns that can be empty', () => {
  for (const p of PERSON_DATA) {
    if (p.via !== 'sql') continue;
    assert.notEqual(p.handling, 'keep', `${p.table}.${p.column}: keep writes nothing`);
    if (p.handling !== 'detach') continue;
    for (const c of [p.column, ...(p.scrub ?? [])]) {
      assert.equal(TABLES.get(p.table)!.get(c)!.notNull, false, `${p.table}.${c} is NOT NULL and cannot be cleared`);
    }
  }
});

test('keep never writes, and only delete / detach do', () => {
  for (const p of PERSON_DATA) {
    if (p.via === 'none') assert.equal(p.handling, 'keep', `${p.table}.${p.column}`);
    if (p.handling === 'keep') assert.ok(p.via === 'none' || p.via === 'custom', `${p.table}.${p.column}`);
  }
});

test('the seat itself is kept: a clan’s roster row and event history never go with the person', () => {
  const seat = PERSON_DATA.find((p) => p.table === 'clan_memberships' && p.column === 'account_id');
  assert.equal(seat?.handling, 'keep');
  for (const t of ['submissions', 'completions', 'moments', 'weekly_participants', 'payouts', 'coffer_entries', 'event_start_proofs']) {
    const rows = PERSON_DATA.filter((p) => p.table === t && (p.key === 'seat' || p.key === 'participant'));
    assert.ok(rows.length > 0 && rows.every((p) => p.handling === 'keep'), `${t} is a clan record and must be kept`);
  }
});

test('no export list names a secret or a staff note', () => {
  for (const p of PERSON_DATA) {
    for (const c of p.export?.columns ?? []) assert.equal(neverExported(p.table, c), false, `${p.table}.${c} must never be exported`);
  }
  const user = PERSON_DATA.find((p) => p.table === 'users' && p.column === 'id')!.export!.columns;
  for (const c of ['plugin_token', 'plugin_token_hash', 'password_hash', 'session_version', 'supporter_ref', 'banned_reason']) {
    assert.ok(!user.includes(c), `users.${c} must not be exported`);
  }
  const links = PERSON_DATA.find((p) => p.table === 'plugin_links')!.export!.columns;
  assert.deepEqual(links, ['id', 'created_at', 'last_used_at', 'revoked_at']);
});

test('the export is never driven by a pointer that only says they did something to somebody else’s record', () => {
  for (const p of PERSON_DATA) {
    if (!p.export) continue;
    assert.ok(!/_by(_user)?(_id)?$/.test(p.column), `${p.table}.${p.column} is an actor pointer and must not drive an export`);
  }
});
