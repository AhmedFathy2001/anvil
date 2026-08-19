// The lint rule that keeps `clan_roster` out of write statements must itself keep working.
//
// `clan_roster` is a VIEW. Postgres rejects it in an UPDATE/DELETE's WHERE or RETURNING at parse
// time, so the write never applies — and TypeScript cannot tell `clanRoster.id` from `accounts.id`,
// since both are real column objects. We shipped four of these. Three were found only by running the
// cron against a live database; the fourth (auto-claim-on-play's RETURNING) sat inside a
// best-effort try/catch and failed as a silent no-op with nothing in any log.
//
// The rule is configured as an ERROR, which means a regression in the rule itself reopens the whole
// class silently — the lint output would simply go quiet. Hence this test.
//
// Run: npm run test:lintview

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import rule from '../eslint-rules/no-view-writes.mjs';

const linter = new Linter();
const config = {
  plugins: { local: { rules: { 'no-view-writes': rule } } },
  rules: { 'local/no-view-writes': 'error' },
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
} as never;

const lint = (code: string) =>
  linter.verify(code, config).filter((m) => m.ruleId === 'local/no-view-writes');

test('flags the view in an UPDATE where — the stats sweep bug', () => {
  const msgs = lint(`db.update(accounts).set({ status: 'unranked' }).where(inArray(clanRoster.id, ids));`);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].message, /UPDATE/);
});

test('flags the view in an eq() where — the profile primary-clear bug', () => {
  assert.equal(lint(`db.update(accounts).set({ isPrimary: 0 }).where(eq(clanRoster.playerId, pid));`).length, 1);
});

test('flags the view in RETURNING — the silent auto-claim bug', () => {
  // The one that mattered most: swallowed by its own catch, so nothing surfaced it.
  assert.equal(
    lint(`db.update(accounts).set({ provisional: 0 }).where(eq(accounts.id, id)).returning({ id: clanRoster.id });`).length,
    1,
  );
});

test('flags the view in a DELETE', () => {
  const msgs = lint(`db.delete(clanMemberships).where(eq(clanRoster.id, id));`);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].message, /DELETE/);
});

test('allows reading the view — that is what it exists for', () => {
  assert.equal(lint(`db.select().from(clanRoster).where(inArray(clanRoster.id, ids));`).length, 0);
});

test('allows the correct fix: real table, seat -> account subquery', () => {
  // The shape every one of the four was rewritten into. If the rule flagged this it would be
  // pushing people away from the only correct answer.
  assert.equal(
    lint(`db.update(accounts).set({ status: 'unranked' }).where(
      inArray(accounts.id,
        db.select({ id: clanMemberships.accountId }).from(clanMemberships).where(inArray(clanMemberships.id, ids))),
    );`).length,
    0,
  );
});

test('allows a subquery that READS the view inside a write', () => {
  // Legitimate: the view is only being selected from. Postgres is fine with this.
  assert.equal(
    lint(`db.update(accounts).set({ provisional: 0 }).where(
      inArray(accounts.id, db.select({ id: clanRoster.accountId }).from(clanRoster).where(eq(clanRoster.clanId, clanId))),
    );`).length,
    0,
  );
});

test('does not flag the view outside a write statement', () => {
  assert.equal(lint(`const seat = rows.find((r) => r.id === clanRoster.id);`).length, 0);
});

test('flags the view as a write TARGET, passed bare', () => {
  // `db.update(clanRoster)` never contains a `clanRoster.col` reference, so it needs its own
  // selector. None exist today — this is what keeps it that way.
  const msgs = lint(`db.update(clanRoster).set({ status: 'x' }).where(eq(accounts.id, id));`);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].message, /target of a UPDATE/);
});

test('flags inserting into the view', () => {
  assert.equal(lint(`db.insert(clanRoster).values(row);`).length, 1);
});

test('does not flag writes to the real tables', () => {
  assert.equal(lint(`db.insert(clanMemberships).values(row);`).length, 0);
  assert.equal(lint(`db.update(accounts).set({ x: 1 }).where(eq(accounts.id, id));`).length, 0);
});
