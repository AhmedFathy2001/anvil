// Which paths take the clan prefix.
//
// One list decides, because ~470 call sites would otherwise each have to get it right, and a wrong
// answer is invisible in both directions: a missing prefix on a clan path 404s or — for an API call
// — reaches a route with no clan, which does not error but answers a different question; a spurious
// prefix on a platform path 404s a page that was working.
//
// So the interesting cases here are the ones where the two lists overlap by spelling: /api/profile
// sits under /api, /api/player is not a clan's, /profile is the person's while /players is not a
// route at all. Prefix-matching gets those wrong unless the order is deliberate.
//
// Run: npm run test:clanpaths

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isClanScopedPath, isPlatformPath, withClanPrefix } from '../src/lib/clanScopedPaths.ts';

const P = '/c/theafkspot';

test('a clan owns its events, roster and administration', () => {
  for (const p of ['/events', '/events/5', '/events/5/board', '/members', '/admin', '/admin/clan', '/weekly']) {
    assert.equal(isClanScopedPath(p), true, p);
  }
});

test('a person owns their identity, wherever they are', () => {
  // The whole point of the identity remodel: one human, one identity, not one per clan.
  for (const p of ['/u/2', '/p/Drenvox%20mdps', '/clans', '/login', '/staff', '/guide']) {
    assert.equal(isClanScopedPath(p), false, p);
  }
});

test('/profile is BOTH, which is what the prefix is for', () => {
  // This assertion used to say `isClanScopedPath('/profile') === false`, and that classification is
  // what made the clan locker unreachable: middleware 308s a platform path out of its prefix, so
  // /c/<slug>/profile bounced to the apex and `buildLocker` never rendered in production. Seven
  // hundred lines of career, boards, trophies and history, dead — and nothing reported it, because
  // redirecting to a page that works is not an error.
  //
  // app/profile/page.tsx has always branched on whether a clan is named. Only the address was
  // missing. Bare, it is you across the platform; prefixed, it is your standing in one clan — which
  // is per-clan by nature, exactly as /members is.
  assert.equal(isClanScopedPath('/profile'), true, 'so a link from inside a clan reaches the locker');
  assert.equal(withClanPrefix('/c/theafkspot', '/profile'), '/c/theafkspot/profile');
  assert.equal(withClanPrefix('', '/profile'), '/profile', 'and the apex still gets the person');
});

test('the API split does not follow the page split', () => {
  // /profile is the person's page AND /api/profile is theirs — but /api/plugin is a clan's with no
  // page at all, and /api/player is the platform's despite reading like a person's.
  assert.equal(isClanScopedPath('/api/admin/clan'), true);
  assert.equal(isClanScopedPath('/api/events/5/tiles'), true);
  assert.equal(isClanScopedPath('/api/plugin/config'), true);
  assert.equal(isClanScopedPath('/api/profile/accounts/1/share'), false);
  assert.equal(isClanScopedPath('/api/staff/clans/1'), false);
  assert.equal(isClanScopedPath('/api/player/login'), false);
  assert.equal(isClanScopedPath('/api/cron/stats'), false);
  assert.equal(isClanScopedPath('/api/webhooks/gumroad'), false);
});

test('a platform root that is a prefix of nothing still wins over the clan list', () => {
  // /api/profile would fall through to /api/... matching if the platform list were checked second.
  assert.equal(isClanScopedPath('/api/profile'), false);
  assert.equal(isClanScopedPath('/api/clans'), false);
});

test('query strings do not defeat the match', () => {
  assert.equal(isClanScopedPath('/events?tab=live'), true);
  // ?welcome=1 is the onboarding checklist, and it is shown on the CLAN locker — so this is the
  // exact query string that has to survive the prefix.
  assert.equal(isClanScopedPath('/profile?welcome=1'), true);
});

test('anything not recognised is left alone rather than guessed at', () => {
  // A wrong prefix is a 404; an unprefixed platform path still works. When unsure, do nothing.
  assert.equal(isClanScopedPath('/something-new'), false);
  assert.equal(isClanScopedPath('/'), false);
});

test('external and relative targets pass through untouched', () => {
  assert.equal(withClanPrefix(P, 'https://discord.gg/x'), 'https://discord.gg/x');
  assert.equal(withClanPrefix(P, '#top'), '#top');
  assert.equal(withClanPrefix(P, 'events/5'), 'events/5');
});

test('with no prefix — the apex, or a clan subdomain — nothing changes', () => {
  // The subdomain still serves clan pages at bare paths while it is being retired. Prefixing there
  // would send people to an address that host does not have.
  assert.equal(withClanPrefix('', '/events/5'), '/events/5');
  assert.equal(withClanPrefix('', '/profile'), '/profile');
});

test('prefixing is applied exactly once', () => {
  const once = withClanPrefix(P, '/events/5');
  assert.equal(once, '/c/theafkspot/events/5');
  // An already-prefixed path is a platform path by the list's reckoning (/c/ is a platform root),
  // so running it through again is a no-op rather than doubling.
  assert.equal(withClanPrefix(P, once), once);
});

// ── The clan header is ours, not the caller's ─────────────────────────────────────────────────
//
// `x-anvil-clan-slug` decides which clan a request is for, and clanContext prefers it over the
// Host. It is an ordinary request header, so anyone can send one — and until middleware stripped it
// first, sending `x-anvil-clan-slug: <someone else>` resolved that clan on a host that was not
// theirs. Verified against the running preview: the spoofed header changed which clan answered.
//
// A source check rather than a behavioural one, because middleware runs in the edge runtime and
// cannot be invoked from here. It is narrow on purpose: the claim is that two specific deletes
// exist and happen before anything sets the header.

test('middleware strips the clan headers before it trusts anything', () => {
  const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8');

  const del = src.indexOf("downstream.delete('x-anvil-clan-slug')");
  const delPrefix = src.indexOf("downstream.delete('x-anvil-clan-prefix')");
  assert.ok(del > 0, 'the slug header must be deleted');
  assert.ok(delPrefix > 0, 'and the prefix header with it');

  const set = src.indexOf("downstream.set('x-anvil-clan-slug'");
  assert.ok(set > del, 'the delete has to come first, or it undoes nothing');
});

// ── A platform path underneath a clan prefix ──────────────────────────────────────────────────
//
// Found on the preview, not here: /c/theafkspot/leaderboard rendered the platform leaderboard, 200.
// Two things wrong with that. Every apex page gained a second address, which is the drift the
// hostname redirect below already exists to prevent — and it arrived carrying x-anvil-clan-slug for
// a clan the page never asked about, which is the header-injection shape spelled in the URL.

test('platform and clan-scoped are not opposites — a path can be neither', () => {
  // The distinction the redirect rests on. Only a path we can positively call the platform's is
  // safe to redirect; an unrecognised one under a prefix is probably a clan page not yet listed,
  // and bouncing it to the apex would 404 something that works.
  assert.equal(isPlatformPath('/leaderboard'), true);
  assert.equal(isClanScopedPath('/leaderboard'), false);

  assert.equal(isPlatformPath('/events/5'), false);
  assert.equal(isClanScopedPath('/events/5'), true);

  assert.equal(isPlatformPath('/something-unlisted'), false, 'not claimed');
  assert.equal(isClanScopedPath('/something-unlisted'), false, 'not claimed the other way either');
});

test('the clan home is not a platform path, so the prefix still means something', () => {
  // /c/<slug> with nothing after it rewrites to '/', which must keep its clan. If '/' ever read as
  // the platform's, every clan's front page would redirect to the apex.
  assert.equal(isPlatformPath('/'), false);
});

test('a namespace matches bare as well as with its slash', () => {
  // PLATFORM_ROOTS spells these '/c/', '/u/', '/p/' so they read as namespaces. Comparing on the
  // written form alone would miss '/c' itself — and comparing on the trailing slash naively would
  // swallow '/clans', which is a different root.
  assert.equal(isPlatformPath('/c'), true);
  assert.equal(isPlatformPath('/c/theafkspot'), true, 'a prefix inside a prefix is still ours');
  assert.equal(isPlatformPath('/clans'), true, 'its own root, not a stray /c match');
  assert.equal(isPlatformPath('/captain'), false, "a clan's, despite starting with /c");
});

test('middleware redirects a prefixed platform PAGE and only rewrites a prefixed platform API', () => {
  // Same split as the hostname rule below, for the same reason: pages move to one canonical
  // address; /api keeps answering where it was asked, because redirecting a POST rewrites where a
  // body lands under clients that handle 308 badly. Both branches drop the clan header, which is
  // the half that is a security property rather than a tidiness one.
  const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8');

  const guard = src.indexOf('isPlatformPath(inner)');
  assert.ok(guard > 0, 'the guard must exist');

  const set = src.indexOf("downstream.set('x-anvil-clan-slug'");
  assert.ok(guard < set, 'and must come before the clan header is ever set');

  const branch = src.slice(guard, set);
  assert.match(branch, /redirect\([^)]*, 308\)/, 'pages redirect, permanently');
  assert.match(branch, /startsWith\('\/api\//, 'API is the exception');
  assert.match(branch, /NextResponse\.rewrite/, 'and is rewritten rather than bounced');
});

test('the redirect is built from the forwarded host, not the one the container sees', () => {
  // Two constraints meeting. Next parses the Location itself and throws ERR_INVALID_URL on a
  // relative one — the preview 500'd on every prefixed platform page until this was absolute. But
  // absolute-from-request.nextUrl hands back http://…:3000, because Caddy terminates TLS in front
  // and the URL reaching this process is the internal one. So: absolute, from the Host header.
  const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8');
  const guard = src.indexOf('isPlatformPath(inner)');
  const branch = src.slice(guard, src.indexOf("downstream.set('x-anvil-clan-slug'"));

  assert.match(branch, /x-forwarded-proto/, 'scheme from the proxy, not the socket');
  assert.match(branch, /headers\.get\('host'\)/, 'host from the request, not nextUrl');
  assert.doesNotMatch(
    branch,
    /new URL\([^)]*request\.nextUrl(?!\.search)/,
    'never resolve the redirect against nextUrl — that is where the :3000 comes from',
  );
});

test('middleware never hands the raw request headers downstream', () => {
  // The bug was a second `new Headers(request.headers)` further down, which reinstated whatever the
  // caller sent. There must be exactly one copy, and everything after works from it.
  const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8');
  const copies = src.match(/new Headers\(request\.headers\)/g) ?? [];
  assert.equal(copies.length, 1, 'one copy only — a second one re-admits the spoofed header');
});
