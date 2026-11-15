import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginHref } from '../src/lib/clanScopedPaths';

const back = (href: string) => new URL(href, 'http://x').searchParams.get('return');

test('a clan page keeps its /c/<slug> prefix in the sign-in return (server sees the bare path)', () => {
  assert.equal(back(loginHref('/c/ironforge', '/members')), '/c/ironforge/members');
  assert.equal(back(loginHref('/c/ironforge', '/admin/dashboard')), '/c/ironforge/admin/dashboard');
  assert.equal(back(loginHref('/c/ironforge', '/team')), '/c/ironforge/team');
  assert.equal(back(loginHref('/c/ironforge', '/team/7')), '/c/ironforge/team/7');
});

test('a creator space keeps /s/<slug>, and the clan home returns to the clan home', () => {
  assert.equal(back(loginHref('/s/drenvox', '/events/5')), '/s/drenvox/events/5');
  assert.equal(back(loginHref('/c/ironforge', '/')), '/c/ironforge');
});

test('a path that already carries the prefix (the browser) is not prefixed twice', () => {
  assert.equal(back(loginHref('/c/ironforge', '/c/ironforge/members')), '/c/ironforge/members');
  assert.equal(back(loginHref('', '/c/ironforge/members')), '/c/ironforge/members');
});

test('platform pages are never put under a clan, and home or login need no return', () => {
  assert.equal(back(loginHref('/c/ironforge', '/settings/account')), '/settings/account');
  assert.equal(back(loginHref('', '/clans')), '/clans');
  assert.equal(loginHref('', '/'), '/login');
  assert.equal(loginHref('', '/login'), '/login');
  assert.equal(loginHref('', null), '/login');
});
