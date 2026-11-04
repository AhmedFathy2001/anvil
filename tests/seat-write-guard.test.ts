// Every write that can put somebody on an event's board goes through the plan's room check.
//
// The player cap on a creator plan (lib/creatorPlans: players at once across the host's overlapping
// events) only holds if EVERY sign-up write that lands on the board — a new row, or a status set to
// pending/approved — runs inside lib/creatorPlansDb withEventRoom, which takes the host's lock and
// measures what the write added. Paths that skipped it were found one at a time (captain seating,
// the admin bulk add, auto-enrol); this fails the next one the day it is written.
//
// The rule, read straight off the source:
//   - `.insert(eventSignups)` and an `.update(eventSignups)` that sets `status:` to anything but
//     'withdrawn' / 'rejected' must be called on `tx`, in a file that calls withEventRoom(.
//   - writes that leave status alone (answers, a team request, a merge, adopting a login) or take a
//     row OFF the board never add anybody and are not checked.
//
// Run: npx tsx --test tests/seat-write-guard.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const OFF_BOARD = /status:\s*'(withdrawn|rejected)'/;

test('every on-board sign-up write runs inside withEventRoom', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf8');
    const writes = [...src.matchAll(/(\w+)\s*\.\s*(insert|update)\(\s*eventSignups\s*\)/g)];
    for (const m of writes) {
      const [, receiver, kind] = m;
      const at = m.index ?? 0;
      if (kind === 'update') {
        // The update's own .set({...}) — up to its .where(.
        const rest = src.slice(at, at + 600);
        const set = rest.slice(0, rest.indexOf('.where(') === -1 ? rest.length : rest.indexOf('.where('));
        if (!/\bstatus\s*:/.test(set) || OFF_BOARD.test(set)) continue;
      }
      checked += 1;
      const line = src.slice(0, at).split('\n').length;
      if (receiver !== 'tx' || !src.includes('withEventRoom(')) offenders.push(`${file}:${line} (${receiver}.${kind})`);
    }
  }
  assert.ok(checked >= 8, `expected to find the known on-board writes, found ${checked}`);
  assert.deepEqual(offenders, [], 'sign-up writes that can add a player outside withEventRoom (lib/creatorPlansDb)');
});
