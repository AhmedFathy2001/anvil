// The public events directory (anvilosrs.com/events) against a real database.
//
// The thing that must never go wrong is the WHERE: an event appears only when its host advertised it
// AND a signed-out stranger could already open it. Every exclusion below is a real row that would be
// listed if one condition were dropped — so a loosened query fails here, not in production.
//
// Run: npm run test:events-directory

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('events-directory');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let D: typeof import('../src/lib/eventsDirectoryDb.ts');
let R: typeof import('../src/lib/eventsDirectory.ts');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const at = (ms: number) => new Date(NOW + ms).toISOString();

const ids: Record<string, number> = {};
let creatorListedId: number;
let creatorUnlistedId: number;
let alphaId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  D = await import('../src/lib/eventsDirectoryDb.ts');
  R = await import('../src/lib/eventsDirectory.ts');

  const c = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha Clan' },
      { slug: 'paid', name: 'Paid Clan', plan: 'bronze' },
      { slug: 'streamer', name: 'Big Streamer', kind: 'creator', plan: 'silver' },
      { slug: 'small', name: 'Small Streamer', kind: 'creator' },
      { slug: 'secret', name: 'Secret Clan', visibility: 'members' },
      { slug: 'gone', name: 'Suspended Clan', status: 'suspended' },
      { slug: 'lab', name: 'Tile Lab', platformHidden: true },
      { slug: 'nogue', name: 'No Guests', guestPolicy: 'closed' },
    ])
    .returning();
  const clan = Object.fromEntries(c.map((r) => [r.slug, r.id]));
  alphaId = clan.alpha;
  creatorListedId = clan.streamer;
  creatorUnlistedId = clan.small;
  // The big streamer advertises the space itself; the small one never has.
  await db.insert(s.settings).values({ clanId: clan.streamer, key: 'public_showcase', value: 'on' });

  const ev = async (
    key: string,
    clanSlug: string,
    v: Partial<typeof s.events.$inferInsert> & { startDate?: string | null },
  ) => {
    const [row] = await db
      .insert(s.events)
      .values({ clanId: clan[clanSlug], name: key, boardSize: 5, visibility: 'public', advertised: true, ...v })
      .returning();
    ids[key] = row.id;
  };

  // ── listed ──
  await ev('live', 'alpha', { startDate: at(-DAY), endDate: at(5 * HOUR) });
  await ev('clanVisible', 'alpha', { visibility: 'clan', startDate: at(2 * DAY), endDate: at(4 * DAY) });
  await ev('paidLater', 'paid', { startDate: at(5 * DAY), endDate: at(9 * DAY) });
  await ev('creatorOpen', 'small', { startDate: at(3 * DAY), teamPlacement: 'solo', format: 'tilerace' });
  await ev('creatorGated', 'streamer', {
    startDate: at(10 * DAY),
    entryGates: JSON.stringify({ anyOf: [{ kind: 'twitch-follow' }] }),
  });
  await ev('noGuests', 'nogue', { startDate: at(4 * DAY) });

  // ── never listed ──
  await ev('notAdvertised', 'alpha', { advertised: false, startDate: at(DAY) });
  await ev('inviteOnly', 'alpha', { visibility: 'invited', startDate: at(DAY) });
  await ev('typoVisibility', 'alpha', { visibility: 'everyone', startDate: at(DAY) });
  await ev('ended', 'alpha', { startDate: at(-3 * DAY), endDate: at(-HOUR) });
  await ev('forceEnded', 'alpha', { startDate: at(-DAY), forceEndedAt: at(-HOUR) });
  await ev('draft', 'alpha', { startDate: null });
  await ev('privateClan', 'secret', { startDate: at(DAY) });
  await ev('suspendedClan', 'gone', { startDate: at(DAY) });
  await ev('hiddenClan', 'lab', { startDate: at(DAY) });

  // Players on the live board: two on it, one rejected (not counted).
  const people = await db.insert(s.players).values([{ displayName: 'A' }, { displayName: 'B' }, { displayName: 'C' }]).returning();
  const accts = await db
    .insert(s.accounts)
    .values(people.map((pp, i) => ({ playerId: pp.id, rsn: `P${i}`, rsnNormalized: `p${i}` })))
    .returning();
  const seats = await db
    .insert(s.clanMemberships)
    .values(accts.map((a) => ({ clanId: clan.alpha, accountId: a.id })))
    .returning();
  await db.insert(s.eventSignups).values([
    { eventId: ids.live, clanMemberId: seats[0].id, status: 'approved' },
    { eventId: ids.live, clanMemberId: seats[1].id, status: 'pending' },
    { eventId: ids.live, clanMemberId: seats[2].id, status: 'rejected' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const names = (list: { name: string }[]) => list.map((e) => e.name).sort();

test('only advertised events a stranger can see, upcoming or live, are listed', async () => {
  const all = await D.loadDirectoryEvents(NOW);
  assert.deepEqual(names(all), ['clanVisible', 'creatorGated', 'creatorOpen', 'live', 'noGuests', 'paidLater']);
});

test('invite-only, hidden, suspended, private-clan, ended and draft events are never listed', async () => {
  const listed = new Set((await D.loadDirectoryEvents(NOW)).map((e) => e.eventId));
  for (const key of ['notAdvertised', 'inviteOnly', 'typoVisibility', 'ended', 'forceEnded', 'draft', 'privateClan', 'suspendedClan', 'hiddenClan']) {
    assert.equal(listed.has(ids[key]), false, `${key} must not be listed`);
  }
});

test('cards carry host, format, players and who can join', async () => {
  const by = new Map((await D.loadDirectoryEvents(NOW)).map((e) => [e.name, e]));
  const live = by.get('live')!;
  assert.equal(live.live, true);
  assert.equal(live.players, 2, 'pending + approved count; rejected does not');
  assert.equal(live.href, `/c/alpha/events/${ids.live}`);
  assert.equal(live.hostKind, 'clan');
  assert.equal(live.join, 'approval', 'a stranger asks to join a clan event');
  assert.match(R.whenWords(live, NOW), /^Live now · ends in [45]h$/);

  const open = by.get('creatorOpen')!;
  assert.deepEqual([open.hostKind, open.join, open.solo, open.formatLabel], ['creator', 'open', true, 'Tile race']);
  assert.equal(open.takingEntries, true);
  assert.equal(R.whenWords(open, NOW), 'Starts in 3 days');

  const gated = by.get('creatorGated')!;
  assert.equal(gated.join, 'gated');
  assert.match(gated.joinLabel, /followers of the host on Twitch/);
  assert.equal(gated.featured, true, 'a Silver creator is featured');

  assert.equal(by.get('paidLater')!.featured, true, 'a clan on a paid plan is featured');
  assert.equal(by.get('clanVisible')!.featured, false);
  assert.equal(by.get('noGuests')!.join, 'members');
});

test('filters: live, starting soon, format, joining and host type', async () => {
  const all = await D.loadDirectoryEvents(NOW);
  const run = (q: Record<string, string>) => names(R.directoryPage(all, R.parseFilters(q), NOW).items);
  assert.deepEqual(run({ when: 'live' }), ['live']);
  assert.deepEqual(run({ when: 'soon' }), ['clanVisible', 'creatorOpen', 'noGuests', 'paidLater']);
  assert.deepEqual(run({ format: 'race' }), ['creatorOpen']);
  assert.deepEqual(run({ format: 'solo' }), ['creatorOpen']);
  assert.deepEqual(run({ join: 'open' }), ['creatorOpen']);
  assert.deepEqual(run({ join: 'gated' }), ['clanVisible', 'creatorGated', 'live', 'noGuests', 'paidLater']);
  assert.deepEqual(run({ host: 'creator' }), ['creatorGated', 'creatorOpen']);
  assert.deepEqual(run({ host: 'clan', when: 'soon' }), ['clanVisible', 'noGuests', 'paidLater']);
  // Junk in the URL is the default, never an error.
  assert.equal(R.directoryPage(all, R.parseFilters({ when: 'x', format: '<script>', page: '-4' }), NOW).total, all.length);
});

test('ordering: live first, then featured within each group, then soonest start', async () => {
  const all = await D.loadDirectoryEvents(NOW);
  const order = R.directoryPage(all, R.DEFAULT_FILTERS, NOW).items.map((e) => e.name);
  // Featured upcoming (paidLater +5d, creatorGated +10d) lead the upcoming group — never above live.
  assert.deepEqual(order, ['live', 'paidLater', 'creatorGated', 'clanVisible', 'creatorOpen', 'noGuests']);
});

test('paginates 24 to a page', () => {
  const base = R.toDirectoryEvent(
    {
      eventId: 1, name: 'x', iconUrl: null, startDate: at(DAY), endDate: null, forceEndedAt: null, signupOpensAt: null,
      signupDeadline: null, format: 'bingo', scoringMode: 'tiles', rules: null, teamPlacement: 'auto', entry: 'open',
      entryGates: null, hostSlug: 'alpha', hostName: 'Alpha', hostLogoUrl: null, hostKind: 'clan', hostPlan: 'free',
      hostGuestPolicy: 'approval', twitchLogin: null, players: 0,
    },
    NOW,
  )!;
  const many = Array.from({ length: 30 }, (_, i) => ({ ...base, eventId: i + 1, startMs: base.startMs + i }));
  const p1 = R.directoryPage(many, R.DEFAULT_FILTERS, NOW);
  const p2 = R.directoryPage(many, { ...R.DEFAULT_FILTERS, page: 2 }, NOW);
  assert.deepEqual([p1.items.length, p1.pages, p2.items.length, p2.page], [24, 2, 6, 2]);
  assert.equal(R.filterHref(R.DEFAULT_FILTERS, { page: 2 }), '/events?page=2');
  assert.equal(R.filterHref({ ...R.DEFAULT_FILTERS, page: 3 }, { host: 'creator' }), '/events?host=creator', 'a filter change resets to page 1');
});

test('a cached list a minute old still drops what ended and lights what started', () => {
  const later = NOW + 6 * HOUR;
  return D.loadDirectoryEvents(NOW).then((all) => {
    const view = R.directoryPage(all, R.DEFAULT_FILTERS, later);
    assert.equal(view.items.some((e) => e.name === 'live'), false, 'ended since it was loaded');
  });
});

test('the "Advertise on Anvil" switch is admin-only', () => {
  assert.equal(R.mayAdvertiseEvents('owner'), true);
  assert.equal(R.mayAdvertiseEvents('admin'), true);
  for (const role of ['moderator', 'treasurer', 'member', 'guest', null, undefined, 'ADMIN']) {
    assert.equal(R.mayAdvertiseEvents(role), false, `${role} may not advertise`);
  }
});

test("a creator space's own listing preselects the switch for its new events; clans start off", async () => {
  assert.equal(await D.defaultAdvertisedForClan({ id: creatorListedId, kind: 'creator' }), true);
  assert.equal(await D.defaultAdvertisedForClan({ id: creatorUnlistedId, kind: 'creator' }), false);
  assert.equal(await D.defaultAdvertisedForClan({ id: alphaId, kind: 'clan' }), false);
});
