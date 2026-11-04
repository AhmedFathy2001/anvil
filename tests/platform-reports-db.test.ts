// Platform reports (lib/platformReports) against a real database: every kind of thing is reportable
// by a signed-in viewer who can see it (and nothing they cannot see is); one open report per person
// per thing; the snapshot is sanitized text and URLs; the rate limits; and staff actions per kind —
// hide a panel / page / clip, the platform hide of a clan (or an event's host), dismiss, mark
// handled, note — closing every open report on the same thing.
//
// Run: npm run test:reports   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('platform_reports');
process.env.S3_PUBLIC_BASE_URL = 'https://media.test';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/platformReports.ts');
let H: typeof import('../src/lib/highlights/store.ts');
let P: typeof import('../src/lib/spacePage/store.ts');

const DAY = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

let n = 0;
async function person(name: string, extra: Partial<typeof s.players.$inferInsert> = {}) {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name, ...extra }).returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99800000000000${String(n).padStart(4, '0')}` }).returning();
  return { userId: u.id, playerId: pl.id };
}

let viewer: { userId: number; playerId: number };
let viewer2: { userId: number; playerId: number };
let staffer: { userId: number; playerId: number };
let streamerPerson: { userId: number; playerId: number };
let clanId: number;
let spaceId: number;
let panelId: number;
let eventId: number;
let privateEventId: number;
let sharedAccount: number;
let unsharedAccount: number;
let highlightId: number;

const file = (who: { userId: number; playerId: number }, type: string, id: number, extra: { category?: unknown; note?: unknown } = {}) =>
  R.fileReport({ type, id, category: extra.category ?? 'scam', note: extra.note ?? '', reporterUserId: who.userId, reporterPlayerId: who.playerId });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/platformReports.ts');
  H = await import('../src/lib/highlights/store.ts');
  P = await import('../src/lib/spacePage/store.ts');
  viewer = await person('Viewer');
  viewer2 = await person('Viewer Two');
  staffer = await person('Staffer');
  streamerPerson = await person('Streamer Person', { linkAccountsPublicly: true });

  const [c] = await db
    .insert(s.clans)
    .values({
      slug: 'shady',
      name: 'Shady Clan',
      visibility: 'public',
      tagline: 'Cheap gp <b>here</b>​',
      description: 'Visit us\u0007 now',
      logoUrl: 'javascript:alert(1)',
      bannerUrl: 'https://media.test/c/shady/banner.webp',
    })
    .returning();
  clanId = c.id;
  const [sp] = await db.insert(s.clans).values({ slug: 'streamer', name: 'Streamer', kind: 'creator', plan: 'creator_free', visibility: 'public' }).returning();
  spaceId = sp.id;
  const panel = await P.createPanel({ id: sp.id, slug: sp.slug }, { title: 'Discord', body: 'Come say hi', linkUrl: null, imageUrl: null });
  assert.ok(panel.ok);
  if (panel.ok) panelId = panel.value;
  await P.setBio(sp.id, 'Hello there');

  const [e] = await db
    .insert(s.events)
    .values({ clanId, name: 'Shady Bingo', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  eventId = e.id;
  const [pe] = await db
    .insert(s.events)
    .values({ clanId, name: 'Invite only', boardSize: 2, visibility: 'invited', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  privateEventId = pe.id;

  const [a1] = await db.insert(s.accounts).values({ playerId: streamerPerson.playerId, rsn: 'Shared Guy', rsnNormalized: 'shared guy', shared: true }).returning();
  sharedAccount = a1.id;
  const [a2] = await db.insert(s.accounts).values({ playerId: streamerPerson.playerId, rsn: 'Hidden Guy', rsnNormalized: 'hidden guy', shared: false }).returning();
  unsharedAccount = a2.id;

  const [h] = await db
    .insert(s.streamHighlights)
    .values({
      eventId,
      clanId,
      beat: 'start',
      refKey: 'start',
      platform: 'twitch',
      channelOwner: 'host',
      channelId: '111',
      channelName: 'shadystream',
      title: 'Big drop',
      occurredAt: new Date(Date.now() - 3_600_000),
      clipStatus: 'ready',
      clipUrl: 'https://clips.twitch.tv/BigDrop',
      vodStatus: 'none',
    })
    .returning();
  highlightId = h.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('each kind of thing can be reported, and lands in the staff queue with its reason, note and snapshot', async () => {
  const cases: [string, number, RegExp][] = [
    ['clan', clanId, /Name: Shady Clan/],
    ['space', spaceId, /Bio: Hello there/],
    ['creator_panel', panelId, /Title: Discord/],
    ['event', eventId, /Event: Shady Bingo/],
    ['character', sharedAccount, /Character: Shared Guy/],
    ['person', streamerPerson.playerId, /Characters: Shared Guy/],
    ['highlight', highlightId, /Clip: https:\/\/clips\.twitch\.tv\/BigDrop/],
  ];
  for (const [type, id] of cases) {
    const r = await file(viewer, type, id, { category: 'jagex_rules', note: `about the ${type}` });
    assert.equal(r.ok, true, `${type}: ${r.ok ? '' : r.error}`);
  }
  assert.equal(await R.openReportCount(), cases.length);
  const queue = await R.listReports({ status: 'open' });
  for (const [type, , snap] of cases) {
    const row = queue.find((q) => q.targetType === type);
    assert.ok(row, type);
    assert.equal(row.category, 'jagex_rules');
    assert.equal(row.note, `about the ${type}`);
    assert.equal(row.reporter, 'Viewer', 'staff see who reported it');
    assert.match(row.snapshot, snap, type);
    assert.ok(row.href, `${type} links through`);
  }
  // The person page has no hidden characters in its snapshot.
  assert.ok(!queue.find((q) => q.targetType === 'person')!.snapshot.includes('Hidden Guy'));
  // Filters: by kind, and profiles as one.
  assert.equal((await R.listReports({ status: 'open', type: 'clan' })).length, 1);
  assert.deepEqual((await R.listReports({ status: 'open', type: 'character' })).map((r) => r.targetType).sort(), ['character', 'person']);
  const counts = await R.openReportCountsByType();
  assert.equal(counts.highlight, 1);
});

test('the snapshot is sanitized: no markup, no invisible characters, only http(s) URLs', async () => {
  const [row] = await R.listReports({ status: 'open', type: 'clan' });
  assert.ok(!/[<>]/.test(row.snapshot));
  assert.ok(!row.snapshot.includes('​') && !row.snapshot.includes('\u0007'));
  assert.ok(!row.snapshot.includes('javascript:'));
  assert.match(row.snapshot, /Banner: https:\/\/media\.test\/c\/shady\/banner\.webp/);
  // A later edit cannot erase what was reported.
  await db.update(s.clans).set({ name: 'Innocent Clan' }).where(eq(s.clans.id, clanId));
  assert.match((await R.listReports({ status: 'open', type: 'clan' }))[0].snapshot, /Shady Clan/);
});

test('one open report per person per thing; another person is another report', async () => {
  const first = (await R.listReports({ status: 'open', type: 'clan' }))[0];
  const again = await file(viewer, 'clan', clanId, { note: 'again' });
  assert.deepEqual(again, { ok: true, value: first.id });
  assert.equal((await R.listReports({ status: 'open', type: 'clan' })).length, 1);
  const other = await file(viewer2, 'clan', clanId);
  assert.equal(other.ok, true);
  assert.equal((await R.listReports({ status: 'open', type: 'clan' })).length, 2);
});

test('what the reporter cannot see cannot be reported, and bad input is refused', async () => {
  assert.equal((await file(viewer, 'character', unsharedAccount)).ok, false, 'an unshared character');
  assert.equal((await file(streamerPerson, 'character', unsharedAccount)).ok, true, 'but its owner sees it');
  assert.equal((await file(viewer, 'event', privateEventId)).ok, false, 'an invite-only event');
  assert.equal((await file(viewer, 'person', viewer.playerId)).ok, false, 'a person who has not linked publicly');
  assert.equal((await file(viewer, 'space', clanId)).ok, false, 'a regular clan is not a creator page');
  assert.equal((await file(viewer, 'clan', 999_999)).ok, false);
  assert.equal((await file(viewer, 'chat', 1)).ok, false);
  assert.equal((await file(viewer, 'clan', clanId, { category: 'spam' })).ok, false);
  assert.equal((await file(viewer, 'clan', clanId, { note: 'x'.repeat(501) })).ok, false);
});

test('rate limits: per person, and per network across people', async () => {
  const u = 900_001;
  for (let i = 0; i < 5; i += 1) assert.equal((await R.reportRateCheck(u, `10.0.0.${i}`)).ok, true);
  assert.equal((await R.reportRateCheck(u, '10.0.0.99')).ok, false, 'sixth from one person');
  const ip = '10.9.9.9';
  let ok = 0;
  for (let i = 0; i < 25; i += 1) if ((await R.reportRateCheck(800_000 + i, ip)).ok) ok += 1;
  assert.equal(ok, 20, 'twenty from one network');
});

test('staff: dismiss closes one report; mark handled; a note leaves it open', async () => {
  const reports = await R.listReports({ status: 'open', type: 'clan' });
  const [a, b] = reports;
  const noted = await R.actOnReport(a.id, { op: 'note', note: 'Looking into it <b>' }, staffer.userId);
  assert.equal(noted.ok, true);
  let row = (await R.listReports({ status: 'all', type: 'clan' })).find((r) => r.id === a.id)!;
  assert.equal(row.status, 'open');
  assert.equal(row.staffNote, 'Looking into it <b>');
  assert.equal((await R.actOnReport(a.id, { op: 'note', note: 'x'.repeat(1001) }, staffer.userId)).ok, false);

  assert.equal((await R.actOnReport(b.id, { op: 'dismiss' }, staffer.userId)).ok, true);
  row = (await R.listReports({ status: 'all', type: 'clan' })).find((r) => r.id === b.id)!;
  assert.equal(row.status, 'dismissed');
  assert.equal(row.resolvedBy, 'Staffer');

  const prof = (await R.listReports({ status: 'open', type: 'person' }))[0];
  assert.equal((await R.actOnReport(prof.id, { op: 'act', action: 'hide' }, staffer.userId)).ok, false, 'a profile has no hide');
  assert.equal((await R.actOnReport(prof.id, { op: 'act', action: 'unlist' }, staffer.userId)).ok, false, 'nor an unlist');
  assert.equal((await R.actOnReport(prof.id, { op: 'resolve' }, staffer.userId)).ok, true);
  assert.equal((await R.listReports({ status: 'resolved' })).length, 1);
});

test('staff: hide a clan from directories — the existing platform hide — closing every open report on it', async () => {
  // The dismissed one's reporter reports it again: a new open report beside the noted one.
  await file(viewer, 'clan', clanId);
  const open = await R.listReports({ status: 'open', type: 'clan' });
  assert.equal(open.length, 2);
  const r = await R.actOnReport(open[0].id, { op: 'act', action: 'unlist' }, staffer.userId);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.clanId, clanId);
    assert.equal(r.value.clanHiddenChanged, true);
    assert.equal(r.value.what, 'clan_unlisted');
  }
  const c = await db.query.clans.findFirst({ where: eq(s.clans.id, clanId) });
  assert.equal(c?.platformHidden, true);
  assert.equal((await R.listReports({ status: 'open', type: 'clan' })).length, 0);
  // Nothing else about the clan changed: still active, still public.
  assert.equal(c?.status, 'active');
  assert.equal(c?.visibility, 'public');
  await db.update(s.clans).set({ platformHidden: false }).where(eq(s.clans.id, clanId));
});

test('staff: an event report unlists its host clan', async () => {
  const [ev] = await R.listReports({ status: 'open', type: 'event' });
  const r = await R.actOnReport(ev.id, { op: 'act', action: 'unlist' }, staffer.userId);
  assert.ok(r.ok && r.value.clanId === clanId);
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, clanId) }))?.platformHidden, true);
  await db.update(s.clans).set({ platformHidden: false }).where(eq(s.clans.id, clanId));
});

test('staff: hide a highlight — it never renders again, cannot be reported again, and can be shown again', async () => {
  const all = () => true;
  assert.equal((await H.highlightsForEvent(eventId, all)).length, 1);
  const [hl] = await R.listReports({ status: 'open', type: 'highlight' });
  assert.equal((await R.actOnReport(hl.id, { op: 'act', action: 'hide' }, staffer.userId)).ok, true);
  assert.equal((await H.highlightsForEvent(eventId, all)).length, 0);
  assert.equal((await H.highlightsForSpace(clanId, async () => true)).length, 0);
  assert.equal((await file(viewer2, 'highlight', highlightId)).ok, false);
  assert.ok((await R.listHiddenHighlights()).some((h) => h.id === highlightId));
  assert.ok((await H.highlightsForStaff()).find((h) => h.id === highlightId)?.staffHidden);
  const row = (await R.listReports({ status: 'all', type: 'highlight' }))[0];
  assert.equal(row.status, 'hidden');
  assert.equal(row.hidden, true);

  assert.equal(await R.showHighlight(highlightId, staffer.userId), true);
  assert.equal((await H.highlightsForEvent(eventId, all)).length, 1);
});

test('staff: a creator panel and a creator page through the same queue', async () => {
  const [pr] = await R.listReports({ status: 'open', type: 'creator_panel' });
  assert.equal((await R.actOnReport(pr.id, { op: 'act', action: 'hide' }, staffer.userId)).ok, true);
  const page = await P.publicSpacePage({ id: spaceId, slug: 'streamer' }, { canSeeEvent: async () => true, live: false });
  assert.ok(!page.panels.some((p) => p.id === panelId));

  const [sr] = await R.listReports({ status: 'open', type: 'space' });
  assert.equal((await R.actOnReport(sr.id, { op: 'act', action: 'hide' }, staffer.userId)).ok, true);
  assert.equal((await P.spacePageForAdmin(spaceId)).pageHiddenByStaff, true);
  // A space can also come off the directories.
  await file(viewer2, 'space', spaceId);
  const [sr2] = await R.listReports({ status: 'open', type: 'space' });
  assert.equal((await R.actOnReport(sr2.id, { op: 'act', action: 'unlist' }, staffer.userId)).ok, true);
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, spaceId) }))?.platformHidden, true);
  // The creator page's own queue view still sees its reports, and none of the others.
  const promo = await P.listPromoReports('all');
  assert.ok(promo.length >= 3);
  assert.ok(promo.every((r) => r.space.id === spaceId));
});

test('a report on another kind never closes a creator page report on the same clan id', async () => {
  // Same numeric id, different kinds: a space report on space X and a clan report on clan X are two things.
  const rs = await file(viewer, 'space', spaceId, { note: 'fresh' });
  const rc = await file(viewer, 'clan', spaceId, { note: 'as a clan' });
  assert.ok(rs.ok && rc.ok);
  if (!rs.ok || !rc.ok) return;
  assert.notEqual(rs.value, rc.value);
  assert.equal((await P.resolvePromoReport(rs.value, 'hide', staffer.userId)).ok, true);
  const clanRow = (await R.listReports({ status: 'all', type: 'clan' })).find((r) => r.id === rc.value)!;
  assert.equal(clanRow.status, 'open');
});
