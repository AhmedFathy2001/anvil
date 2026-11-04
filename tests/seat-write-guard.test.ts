// Every write that can put somebody on an event's board goes through the plan's room check.
//
// The player cap on a creator plan (lib/creatorPlans: players at once across the host's overlapping
// events) only holds if EVERY sign-up write that lands on the board — a new row, or a status set to
// pending/approved — runs inside lib/creatorPlansDb withEventRoom, which takes the host's lock and
// measures what the write added. Paths that skipped it were found one at a time (captain seating,
// the admin bulk add, auto-enrol); this fails the next one the day it is written.
//
// A friends host's cap (lib/friendEvents guardFriendsSeats: the owner's Supporter tier) holds the same
// way. An event has exactly one host, so callers use lib/friendEvents withHostEventRoom, which runs the
// write once, on one locked transaction, under whichever of the two gates that host has.
//
// The rule, read straight off the source:
//   - `.insert(eventSignups)` and an `.update(eventSignups)` that sets `status:` to anything but
//     'withdrawn' / 'rejected' must be called on `tx`, in a file that calls withHostEventRoom( (or,
//     inside the two gate modules themselves, withEventRoom( / guardFriendsSeats().
//   - nothing outside those two modules calls withEventRoom( directly: that would skip a friends host.
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
      const gated = src.includes('withHostEventRoom(') || src.includes('withEventRoom(') || src.includes('guardFriendsSeats(');
      if (receiver !== 'tx' || !gated) offenders.push(`${file}:${line} (${receiver}.${kind})`);
    }
  }
  assert.ok(checked >= 8, `expected to find the known on-board writes, found ${checked}`);
  assert.deepEqual(offenders, [], 'sign-up writes that can add a player outside withEventRoom (lib/creatorPlansDb)');
});

const GATE_MODULES = new Set([join('src', 'lib', 'creatorPlansDb.ts'), join('src', 'lib', 'friendEvents.ts')]);

test('callers go through withHostEventRoom, so a friends host is never skipped', () => {
  const direct: string[] = [];
  for (const file of walk('src')) {
    if (GATE_MODULES.has(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\b(withEventRoom|guardFriendsSeats)\(/g)) {
      direct.push(`${file}:${src.slice(0, m.index ?? 0).split('\n').length} (${m[1]})`);
    }
  }
  assert.deepEqual(direct, [], 'call lib/friendEvents withHostEventRoom instead: it picks the creator or the friends gate');
});
