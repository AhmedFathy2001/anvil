import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchTargetPath } from '../src/lib/clanSwitchTarget.ts';

const clan = { slug: 'beta', kind: 'clan', role: null };
const adminClan = { slug: 'beta', kind: 'clan', role: 'admin' };
const space = { slug: 'str', kind: 'creator', role: null };

test('lists keep their kind of page', () => {
  assert.equal(switchTargetPath('/c/alpha/weekly', clan), '/c/beta/weekly');
  assert.equal(switchTargetPath('/c/alpha/weekly/12', clan), '/c/beta/weekly');
  assert.equal(switchTargetPath('/c/alpha/members/Zezima', clan), '/c/beta/members');
  assert.equal(switchTargetPath('/c/alpha/events/5?x=1', clan), '/c/beta/events');
});
test('admin sections only for admins of the target', () => {
  assert.equal(switchTargetPath('/c/alpha/admin/people', adminClan), '/c/beta/admin/people');
  assert.equal(switchTargetPath('/c/alpha/admin/people', clan), '/c/beta');
});
test('spaces have events but no members or weekly', () => {
  assert.equal(switchTargetPath('/c/alpha/events', space), '/s/str/events');
  assert.equal(switchTargetPath('/c/alpha/members', space), '/s/str');
});
test('anything else falls back to home', () => {
  assert.equal(switchTargetPath('/c/alpha', clan), '/c/beta');
  assert.equal(switchTargetPath('/leaderboard', clan), '/c/beta');
});
