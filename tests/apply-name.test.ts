// The name a visitor types into a clan's apply box before signing in, carried through sign-in in the
// address. It must only ever be a validated in-game name, and the sign-in return rules must still
// read the address as "this clan's page".
//
// Run: node --experimental-strip-types --test tests/apply-name.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readApplyName, validRsn, withApplyName } from '../src/lib/rsnRules.ts';
import { safeReturnPath } from '../src/lib/safe-redirect.ts';
import { firstLoginDestination } from '../src/lib/firstLogin.ts';
import { parseLoginTarget } from '../src/lib/loginTarget.ts';

test('a real name is kept, trimmed, with odd spaces made plain', () => {
  assert.equal(validRsn('  Zezima '), 'Zezima');
  assert.equal(validRsn('Iron Man 1'), 'Iron Man 1');
  assert.equal(validRsn('a_b-c'), 'a_b-c');
});

test('anything that cannot be an in-game name is nothing', () => {
  for (const bad of ['', '   ', 'thirteen chars', 'bad#name', '<script>', 'a/b', 'a?b=c', 'a&b', '../x', 'ü', null, undefined]) {
    assert.equal(validRsn(bad as string), null, String(bad));
  }
});

test('the name rides in the address as one encoded value, and the path stays a safe return path', () => {
  const path = withApplyName('/c/ironforge', 'Iron Man 1');
  assert.equal(path, '/c/ironforge?apply=Iron%20Man%201');
  assert.equal(safeReturnPath(path), path, 'no raw space, so sign-in accepts it');
  assert.equal(readApplyName('?apply=Iron%20Man%201'), 'Iron Man 1');
  assert.equal(withApplyName('/c/ironforge/events/3/signup?invite=abc', 'Zezima'), '/c/ironforge/events/3/signup?invite=abc&apply=Zezima');
});

test('a hostile value is never carried and never read back', () => {
  for (const bad of ['https://evil.example', '//evil.example', 'a\r\nSet-Cookie: x', '"><img src=x>', 'x'.repeat(13), 'a&return=/admin']) {
    assert.equal(withApplyName('/c/ironforge', bad), '/c/ironforge', bad);
    assert.equal(readApplyName(`?apply=${encodeURIComponent(bad)}`), null, bad);
  }
  assert.equal(readApplyName('?apply=%E0%A4%A'), null, 'broken encoding');
  assert.equal(readApplyName(''), null);
  assert.equal(readApplyName('?other=1'), null);
});

test('sign-in still reads the address as the clan’s page: straight back, with the right reason', () => {
  const path = withApplyName('/c/ironforge', 'Iron Man 1');
  assert.equal(firstLoginDestination(path, false), path, 'a first sign-in is not sent through the chooser');
  assert.deepEqual(parseLoginTarget(path), { kind: 'clan', slug: 'ironforge', creator: false });
  const signup = withApplyName('/c/ironforge/events/3/signup', 'Zezima');
  assert.equal(firstLoginDestination(signup, false), signup);
  assert.deepEqual(parseLoginTarget(signup), { kind: 'event-signup', eventId: 3 });
});
