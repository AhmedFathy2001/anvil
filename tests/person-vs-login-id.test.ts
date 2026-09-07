// A person id is not a login id.
//
// `players.id` says WHO SOMEBODY IS; `users.id` says which login they signed in with. The two
// sequences were seeded 1:1 and have diverged ever since, so comparing them does not error — it
// answers, wrongly, and silently attaches one person's Discord identity to another person's
// character. It has been found three separate times:
//
//   verify-stat-delta   wrote `playerId: session.userId`, attaching a freshly proven character to
//                       a real, unrelated person
//   the roster picker   joined `clanRoster.playerId = users.id`, so the admin sign-up list showed
//                       one member's RSN over another member's Discord name and avatar
//   role + nick sync    the same join, deciding which roles a Discord account is handed and what
//                       its server nickname is set to
//
// The bridge is always `users.playerId`. This scans for the shape rather than the instance, because
// the mistake is the comparison, not the file it happens to be in.
//
// Run: npm run test:idmixup

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

const files = walk('src');

/**
 * A comparison between something named `*.playerId` (or a `playerId` variable) and `users.id`.
 *
 * Written as two directions of the same `eq(...)`, because Drizzle takes either order and a rule
 * that only caught one would be worth very little.
 */
const PATTERNS = [
  /eq\(\s*[A-Za-z]*\.?playerId\s*,\s*users\.id\s*\)/,
  /eq\(\s*users\.id\s*,\s*[A-Za-z]*\.?playerId\s*\)/,
];

test('nothing compares a person id against a login id', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [i, line] of source.split('\n').entries()) {
      if (PATTERNS.some((p) => p.test(line))) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'These compare players.id to users.id. The bridge is users.playerId:\n  ' + offenders.join('\n  '),
  );
});

test('the pattern would catch the bug it was written for', () => {
  // Both orders of the exact line that shipped, so a future reorder cannot slip past.
  assert.ok(PATTERNS.some((p) => p.test('.leftJoin(users, eq(clanRoster.playerId, users.id))')));
  assert.ok(PATTERNS.some((p) => p.test('where: eq(users.id, member.playerId)')));
  // And the correct join is not flagged.
  assert.ok(!PATTERNS.some((p) => p.test('.leftJoin(users, eq(users.playerId, clanRoster.playerId))')));
});
