import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTINUE_KEYS, continueQuery, isContinueKey, linkCharacterHref, loginHref, readContinue, safeContinuePath, stepHref } from '../src/lib/clanScopedPaths';

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

// ── "do this first, then come back" (stepHref / readContinue) ─────────────────────────────────────

const q = (href: string) => {
  const u = new URL(href, 'http://x');
  return { path: u.pathname, next: u.searchParams.get('next'), for: u.searchParams.get('for'), hash: u.hash };
};

test('the link-a-character step carries its way home, prefix and hash kept', () => {
  assert.deepEqual(q(linkCharacterHref('/c/ironforge', '/events/5', 'event')), {
    path: '/settings/characters',
    next: '/c/ironforge/events/5',
    for: 'event',
    hash: '#link-account',
  });
  assert.deepEqual(q(linkCharacterHref('', '/s/drenvox/events/5/signup', 'event-signup')), {
    path: '/settings/characters',
    next: '/s/drenvox/events/5/signup',
    for: 'event-signup',
    hash: '#link-account',
  });
  // The page the browser reports already has the prefix: not doubled.
  assert.equal(q(linkCharacterHref('/c/ironforge', '/c/ironforge/clans', 'clan')).next, '/c/ironforge/clans');
});

test('an invite token in the path is passed through unchanged', () => {
  const next = '/c/ironforge/events/5/signup?invite=abc123DEF-_xyz';
  const read = readContinue({ next: q(linkCharacterHref('/c/ironforge', next, 'event-signup')).next, for: 'event-signup' });
  assert.equal(read?.next, next);
});

test('a page that cannot be a return target gives the plain step link', () => {
  assert.equal(linkCharacterHref('', '/', 'start'), '/settings/characters#link-account');
  assert.equal(linkCharacterHref('', null, 'start'), '/settings/characters#link-account');
  assert.equal(linkCharacterHref('', '/settings/characters', 'start'), '/settings/characters#link-account');
  assert.equal(stepHref('/settings/characters#link-account', '', '/events/5', 'nope' as never), '/settings/characters#link-account');
});

test('readContinue needs a valid path AND a key from the closed list', () => {
  assert.deepEqual(readContinue({ next: '/c/ironforge/events/5', for: 'event' }), { next: '/c/ironforge/events/5', key: 'event' });
  assert.equal(readContinue({ next: '/events/5', for: 'Join the event now' }), null);
  assert.equal(readContinue({ next: '/events/5' }), null);
  assert.equal(readContinue({ for: 'event' }), null);
  assert.deepEqual(readContinue({ next: ['/events/5', '/x'], for: ['event'] }), { next: '/events/5', key: 'event' });
  assert.equal(continueQuery(null), '');
  assert.equal(continueQuery({ next: '/events/5?a=1', key: 'event' }), 'next=%2Fevents%2F5%3Fa%3D1&for=event');
});

test('hostile return targets are refused', () => {
  const hostile = [
    'https://evil.com/x',
    'http://evil.com',
    '//evil.com',
    '//evil.com/x',
    '/\\evil.com',
    '\\\\evil.com',
    '/%2Fevil.com',
    '/%2f/evil.com',
    '/foo%5Cbar',
    '/foo%0d%0aSet-Cookie:x=1',
    '/foo%00',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,hi',
    'events/5',
    '',
    '/',
    '/ x',
    '/events/5\n',
    '/settings/characters?next=/events/5',
    '/login?return=/x',
    '/api/auth/logout',
    `/${'a'.repeat(700)}`,
  ];
  for (const h of hostile) {
    assert.equal(safeContinuePath(h), null, h);
    assert.equal(readContinue({ next: h, for: 'event' }), null, h);
  }
});

test('every key has wording and a requirement', () => {
  for (const [k, v] of Object.entries(CONTINUE_KEYS)) {
    assert.ok(isContinueKey(k));
    assert.ok(v.doing.length > 0 && v.back.length > 0);
    assert.ok(v.needs === 'linked' || v.needs === 'verified');
  }
  assert.equal(isContinueKey('constructor'), false);
  assert.equal(isContinueKey('__proto__'), false);
});
