// Structured data, and the ordinal that goes with a standing.
//
// Pure — lib/jsonLd takes plain values and lib/utils takes a number, so neither needs a database.
//
// Run: npm run test:jsonld

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { breadcrumbLd, clanLd, eventLd, faqLd, leaderboardLd, softwareLd, websiteLd } from '../src/lib/jsonLd.tsx';
import { ANVIL_DEFINITION, FEATURE_PAGES, GENERAL_FAQ, featurePage } from '../src/lib/answers.ts';
import { ordinal } from '../src/lib/utils.ts';

const APEX = 'https://anvilosrs.com';

test('an event carries strict ISO dates whichever way the column stored them', () => {
  // THE WHOLE REASON THIS IS TESTED. These columns hold two formats in the same column (lib/dbTime):
  // Postgres' space-separated form and JS's ISO form. schema.org accepts only the second, and a date
  // is the one field a search engine renders verbatim from this markup.
  const fromPg = eventLd({
    name: 'Summer Bingo',
    url: '/c/x/events/1',
    startDate: '2026-09-01 00:00:00',
    endDate: '2026-09-30 12:30:00',
    clanName: 'X',
    clanSlug: 'x',
  }) as Record<string, unknown>;
  assert.equal(fromPg.startDate, '2026-09-01T00:00:00.000Z');
  assert.equal(fromPg.endDate, '2026-09-30T12:30:00.000Z');

  const fromIso = eventLd({
    name: 'Summer Bingo',
    url: '/c/x/events/1',
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: null,
    clanName: 'X',
    clanSlug: 'x',
  }) as Record<string, unknown>;
  assert.equal(fromIso.startDate, '2026-09-01T00:00:00.000Z');
  // A rolling board genuinely has no end. Absent beats fabricated.
  assert.ok(!('endDate' in fromIso));
});

test('an unparseable date is omitted rather than emitted as Invalid Date', () => {
  const ld = eventLd({
    name: 'Board',
    url: '/c/x/events/1',
    startDate: 'not a date',
    endDate: '',
    clanName: 'X',
    clanSlug: 'x',
  }) as Record<string, unknown>;
  assert.ok(!('startDate' in ld));
  assert.ok(!('endDate' in ld));
});

test('every URL in the markup is apex-absolute', () => {
  const before = process.env.ANVIL_APEX_DOMAIN;
  try {
    delete process.env.ANVIL_APEX_DOMAIN;
    const ld = eventLd({
      name: 'B',
      url: '/c/x/events/1',
      startDate: null,
      endDate: null,
      clanName: 'X',
      clanSlug: 'x',
    }) as Record<string, Record<string, string>>;
    assert.equal(ld.url as unknown as string, `${APEX}/c/x/events/1`);
    assert.equal(ld.organizer.url, `${APEX}/c/x`);
    assert.equal(ld.location.url, `${APEX}/c/x/events/1`);
  } finally {
    if (before !== undefined) process.env.ANVIL_APEX_DOMAIN = before;
  }
});

test('a clan omits the fields it has nothing to say for', () => {
  const bare = clanLd({
    name: 'X',
    slug: 'x',
    description: 'A clan.',
    memberCount: 0,
    discordInvite: null,
  }) as Record<string, unknown>;
  // "0 members" is worse than silence, and a sameAs pointing nowhere is a broken claim.
  assert.ok(!('numberOfEmployees' in bare));
  assert.ok(!('sameAs' in bare));

  const full = clanLd({
    name: 'X',
    slug: 'x',
    description: 'A clan.',
    memberCount: 42,
    discordInvite: 'https://discord.gg/abc',
  }) as Record<string, Record<string, unknown>>;
  assert.equal(full.numberOfEmployees.value, 42);
  assert.deepEqual(full.sameAs as unknown as string[], ['https://discord.gg/abc']);
});

test('a breadcrumb is positioned from 1 and keeps its order', () => {
  const ld = breadcrumbLd([
    { name: 'The AFK Spot', path: '/c/theafkspot' },
    { name: 'Competitions', path: '/c/theafkspot/events' },
  ]) as { itemListElement: { position: number; name: string }[] };
  assert.deepEqual(
    ld.itemListElement.map((i) => [i.position, i.name]),
    [[1, 'The AFK Spot'], [2, 'Competitions']],
  );
});

test('the leaderboard declares itself a descending ranking', () => {
  const ld = leaderboardLd([
    { name: 'A', slug: 'a' },
    { name: 'B', slug: 'b' },
  ]) as Record<string, unknown>;
  assert.equal(ld.itemListOrder, 'https://schema.org/ItemListOrderDescending');
  assert.equal(ld.numberOfItems, 2);
});

test('every block names its vocabulary', () => {
  for (const ld of [
    websiteLd(),
    clanLd({ name: 'X', slug: 'x', description: 'd', memberCount: 1, discordInvite: null }),
    leaderboardLd([]),
    breadcrumbLd([]),
  ]) {
    const block = ld as Record<string, unknown>;
    assert.equal(block['@context'], 'https://schema.org');
    // A block is either one typed node or a @graph of them; every node must be typed either way.
    const nodes = (block['@graph'] as Record<string, unknown>[] | undefined) ?? [block];
    for (const node of nodes) assert.ok(node['@type']);
  }
});

test('the apex names its brand: site name, alternate name and a square logo', () => {
  const graph = (websiteLd() as { '@graph': Record<string, unknown>[] })['@graph'];
  const site = graph.find((n) => n['@type'] === 'WebSite')!;
  const org = graph.find((n) => n['@type'] === 'Organization')!;
  assert.equal(site.name, 'Anvil');
  assert.ok((site.alternateName as string[]).includes('Anvil OSRS'));
  assert.deepEqual(site.publisher, { '@id': org['@id'] });
  const logo = org.logo as { url: string; width: number; height: number };
  assert.match(logo.url, /^https?:\/\/.+\/icon-192\.png$/);
  assert.equal(logo.width, logo.height);
});

test('a placing reads the way a person says it', () => {
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(4), '4th');
  // The teens are the bug every hand-rolled version of this has.
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(12), '12th');
  assert.equal(ordinal(13), '13th');
  assert.equal(ordinal(21), '21st');
  assert.equal(ordinal(22), '22nd');
  assert.equal(ordinal(111), '111th');
  assert.equal(ordinal(101), '101st');
});

test('the FAQ markup is exactly the visible questions, in order', () => {
  const ld = faqLd(GENERAL_FAQ) as { '@type': string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.equal(ld['@type'], 'FAQPage');
  assert.deepEqual(
    ld.mainEntity.map((m) => [m.name, m.acceptedAnswer.text]),
    GENERAL_FAQ.map((f) => [f.q, f.a]),
  );
});

test('answers are fully rendered: no empty prices, no undefined, no unfilled template', () => {
  const all = [
    ANVIL_DEFINITION,
    ...GENERAL_FAQ.flatMap((f) => [f.q, f.a]),
    ...FEATURE_PAGES.flatMap((p) => [p.title, p.h1, p.summary, ...p.sections.flatMap((x) => [x.heading, x.body]), ...p.faq.flatMap((f) => [f.q, f.a])]),
  ];
  for (const text of all) {
    assert.ok(text && text.trim(), 'empty answer text');
    assert.doesNotMatch(text, /undefined|null|\$\s|\$\.|\{\w+\}/, text);
  }
  // The pricing answer quotes real figures.
  assert.match(GENERAL_FAQ.find((f) => f.q === 'Is Anvil free?')!.a, /\$\d+\.\d\d a month/);
});

test('feature pages have unique slugs and every one resolves', () => {
  const slugs = FEATURE_PAGES.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.ok(featurePage(s));
  assert.equal(featurePage('nope'), undefined);
  for (const p of FEATURE_PAGES) assert.ok(p.faq.length > 0, `${p.slug} has no FAQ`);
});

test('the app markup says free, and names its publisher', () => {
  const ld = softwareLd({ description: 'd' }) as { offers: { price: string }; publisher: { '@id': string } };
  assert.equal(ld.offers.price, '0');
  assert.match(ld.publisher['@id'], /#organization$/);
});
