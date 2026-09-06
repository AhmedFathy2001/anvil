// Canonical URLs, indexability and the guide hreflang set.
//
// All pure — lib/seo and lib/apexHost import no database, which is the property that let them be
// split out of lib/clanContext in the first place. tests/pure-module-imports enforces it.
//
// Run: npm run test:seo

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  GUIDE_PAGES,
  LOCALES,
  guideHref,
} from '../src/app/guide/_i18n/index.ts';
import { isClanListed } from '../src/lib/clanListing.ts';
import {
  NOINDEX_ROOTS,
  absoluteUrl,
  apexOrigin,
  canonicalPathFor,
  clanCanonicalPath,
  isNoIndexPath,
} from '../src/lib/seo.ts';

test('the apex origin comes from the env, so a self-hoster is not told they are anvilosrs.com', () => {
  const before = process.env.ANVIL_APEX_DOMAIN;
  try {
    process.env.ANVIL_APEX_DOMAIN = 'events.myclan.gg';
    assert.equal(apexOrigin(), 'https://events.myclan.gg');
    assert.equal(absoluteUrl('/clans'), 'https://events.myclan.gg/clans');
    // No scheme guessing for local development, where there is no certificate.
    process.env.ANVIL_APEX_DOMAIN = 'localhost';
    assert.equal(apexOrigin(), 'http://localhost');
  } finally {
    if (before === undefined) delete process.env.ANVIL_APEX_DOMAIN;
    else process.env.ANVIL_APEX_DOMAIN = before;
  }
});

test('a clan page canonicalises to /c/<slug>, whichever of its three addresses answered', () => {
  // Path-addressed: middleware resolved a prefix, and the framework routed the inner path.
  assert.equal(
    canonicalPathFor({ prefix: '/c/theafkspot', pathname: '/events/5' }),
    '/c/theafkspot/events/5',
  );
  // THE CASE THAT MATTERS. On the legacy per-clan subdomain there is a clan but NO prefix; without
  // the slug fallback the canonical would silently drop the clan and claim to be an apex page —
  // every clan's board declaring itself as anvilosrs.com/events/5.
  assert.equal(
    canonicalPathFor({ prefix: '', pathname: '/events/5', clanSlug: 'theafkspot' }),
    '/c/theafkspot/events/5',
  );
  // A clan's home is /c/<slug>, never /c/<slug>/.
  assert.equal(canonicalPathFor({ prefix: '/c/theafkspot', pathname: '/' }), '/c/theafkspot');
  assert.equal(clanCanonicalPath('theafkspot'), '/c/theafkspot');
  // The apex owns its own paths and takes no prefix.
  assert.equal(canonicalPathFor({ prefix: '', pathname: '/clans' }), '/clans');
});

test('gated and personal paths are never indexable, prefixed or not', () => {
  for (const root of NOINDEX_ROOTS) {
    assert.ok(isNoIndexPath(root), `${root} should be noindex`);
    assert.ok(isNoIndexPath(`${root}/anything`), `${root}/anything should be noindex`);
  }
  // The public surfaces stay indexable — the point of the list is that it is a list, not a mood.
  for (const ok of ['/', '/clans', '/events/5', '/members', '/guide/board', '/leaderboard']) {
    assert.ok(!isNoIndexPath(ok), `${ok} should be indexable`);
  }
  // A prefix does not smuggle a gated path past the check: the layout tests the INNER path, which
  // is what middleware has already rewritten to by the time metadata runs.
  assert.ok(isNoIndexPath('/admin/dashboard'));
});

test('/profile is noindex but /p is not confused with it', () => {
  assert.ok(isNoIndexPath('/p/zezima'));
  assert.ok(isNoIndexPath('/profile'));
  // A root is matched whole: `/players` must not be swallowed by `/player`.
  assert.ok(!isNoIndexPath('/players'));
  assert.ok(!isNoIndexPath('/pricing'));
});

test('every guide page exists in every language, and they all cross-link', () => {
  // The regression this guards: a guide added to GUIDE_PAGES but missing from the hreflang set is a
  // page Google reads as a duplicate of the English one rather than a translation of it.
  assert.ok(LOCALES.length >= 16, 'expected the full locale registry');
  assert.ok(GUIDE_PAGES.includes(''), 'the index is a guide page');

  for (const page of GUIDE_PAGES) {
    const hrefs = new Set(LOCALES.map((l) => guideHref(l.code, page)));
    assert.equal(hrefs.size, LOCALES.length, `duplicate href among locales for guide '${page}'`);
  }

  // English keeps the bare, shareable URL; everything else is namespaced under its code.
  assert.equal(guideHref(DEFAULT_LOCALE, 'board'), '/guide/board');
  assert.equal(guideHref(DEFAULT_LOCALE, ''), '/guide');
  assert.equal(guideHref('de', 'board'), '/guide/de/board');
  assert.equal(guideHref('de', ''), '/guide/de');
});

// ── Who may be NAMED on a public surface ─────────────────────────────────────────────────────────
//
// The SQL half of this rule (lib/clanListing's join + where) is exercised by the four queries that
// use it. This is the JS half, which decides whether a player's clan is labelled on the platform
// leaderboard — and it is the half that has to agree with the SQL, so the cases are written to
// mirror it exactly.

test('a clan is listed only when it is readable AND has not opted out', () => {
  const listed = { status: 'active', visibility: 'public' };
  assert.equal(isClanListed(listed, null), true, 'absent showcase row means listed');
  assert.equal(isClanListed(listed, 'on'), true);

  // The narrower opt-out: public, but not advertised.
  assert.equal(isClanListed(listed, 'off'), false);

  // THE GATE THAT WAS MISSING EVERYWHERE. A clan a stranger may not read is a clan a stranger may
  // not be shown the name of, whatever the showcase setting says.
  assert.equal(isClanListed({ status: 'active', visibility: 'members' }, null), false);
  assert.equal(isClanListed({ status: 'active', visibility: 'members' }, 'on'), false);

  // A suspended clan is nobody's business either.
  assert.equal(isClanListed({ status: 'suspended', visibility: 'public' }, null), false);
});

test('an unrecognised visibility hides a clan rather than exposing one', () => {
  // Same fail-closed rule as clanVisibilityOf and the SQL `= 'public'`: a typo, a half-finished
  // migration or a rolled-back feature must never publish a clan that did not ask to be published.
  for (const v of ['Public', 'PUBLIC', 'open', '', null, undefined]) {
    assert.equal(
      isClanListed({ status: 'active', visibility: v as string | null }, null),
      false,
      `visibility ${JSON.stringify(v)} should not be listed`,
    );
  }
});
