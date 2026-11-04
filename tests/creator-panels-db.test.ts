// Creator page promotions (lib/spacePage/store) against a real database: panels CRUD, the limit of
// eight and their order; the link and wording policy on save and again on render; the staff blocklist
// (seeded by the migration, editable, subdomains included); reports landing in the staff queue and a
// staff hide that the host cannot undo; hidden content never rendering; the schedule round trip; and
// featured highlights limited to the space's own, host-channel, visible ones.
//
// Run: npm run test:creator-panels   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('creator_panels');
process.env.S3_PUBLIC_BASE_URL = 'https://media.test';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let P: typeof import('../src/lib/spacePage/store.ts');

const DAY = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const IMG = (slug: string) => `https://media.test/c/${slug}/space/123e4567-e89b-12d3-a456-426614174000.webp`;

let n = 0;
async function person(name: string) {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99700000000000${String(n).padStart(4, '0')}` }).returning();
  return u.id;
}

let space: { id: number; slug: string };
let other: { id: number; slug: string };
let viewer: number;
let staffer: number;
let eventId: number;
let otherEventId: number;

const everything = async () => true;
const page = (sp = space, canSeeEvent: (id: number) => Promise<boolean> = everything, now?: number) =>
  P.publicSpacePage(sp, { canSeeEvent, live: false, now });

async function highlight(clanId: number, ev: number, extra: Partial<typeof s.streamHighlights.$inferInsert> = {}) {
  n += 1;
  const [h] = await db
    .insert(s.streamHighlights)
    .values({
      eventId: ev,
      clanId,
      beat: 'start',
      refKey: `start-${n}`,
      platform: 'twitch',
      channelOwner: 'host',
      channelId: '111',
      channelName: 'streamer',
      title: `Highlight ${n}`,
      occurredAt: new Date(Date.now() - 3_600_000),
      clipStatus: 'ready',
      clipUrl: `https://clips.twitch.tv/Clip${n}`,
      vodStatus: 'none',
      ...extra,
    })
    .returning();
  return h.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  P = await import('../src/lib/spacePage/store.ts');
  viewer = await person('Viewer');
  staffer = await person('Staffer');
  const [c] = await db.insert(s.clans).values({ slug: 'streamer', name: 'Streamer', kind: 'creator', plan: 'creator_free', visibility: 'public' }).returning();
  space = { id: c.id, slug: c.slug };
  const [o] = await db.insert(s.clans).values({ slug: 'other', name: 'Other', kind: 'creator', plan: 'creator_free', visibility: 'public' }).returning();
  other = { id: o.id, slug: o.slug };
  const [e] = await db
    .insert(s.events)
    .values({ clanId: space.id, name: 'Stream Bingo', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  eventId = e.id;
  const [oe] = await db
    .insert(s.events)
    .values({ clanId: other.id, name: 'Other Bingo', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  otherEventId = oe.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const panel = (over: Record<string, unknown> = {}) => ({ title: 'Discord', body: 'Come say hi', linkUrl: null, imageUrl: null, ...over });

test('the migration seeds the blocklist', async () => {
  const list = await P.loadBlocklist();
  for (const d of ['stake.com', 'playerauctions.com', 'dreambot.org', 'rune-server.ee', 'bit.ly', 'linktr.ee']) assert.ok(list.includes(d), d);
});

test('panels: create, edit, at most eight, reorder, hide, delete', async () => {
  const ids: number[] = [];
  for (let i = 0; i < 8; i++) {
    const r = await P.createPanel(space, panel({ title: `Panel ${i}` }));
    assert.equal(r.ok, true, JSON.stringify(r));
    if (r.ok) ids.push(r.value);
  }
  const ninth = await P.createPanel(space, panel({ title: 'Too many' }));
  assert.equal(ninth.ok, false);
  if (!ninth.ok) assert.match(ninth.error, /up to 8/);

  // Positions follow creation order.
  assert.deepEqual((await P.panelsOf(space.id)).map((p) => p.id), ids);

  // Edit.
  const ed = await P.updatePanel(space, ids[0], panel({ title: 'Rules', body: 'Be nice.\nNo spoilers.', linkUrl: 'https://discord.gg/abc' }));
  assert.equal(ed.ok, true);
  const [first] = await P.panelsOf(space.id);
  assert.equal(first.title, 'Rules');
  assert.equal(first.body, 'Be nice.\nNo spoilers.');
  assert.equal(first.linkUrl, 'https://discord.gg/abc');

  // Another space cannot edit, hide or delete this one's panel.
  assert.equal((await P.updatePanel(other, ids[0], panel({ title: 'Hijack' }))).ok, false);
  assert.equal(await P.setPanelHidden(other.id, ids[0], true), false);
  assert.equal(await P.deletePanel(other.id, ids[0]), false);

  // Reorder: reversed; a partial or foreign list is refused.
  const reversed = [...ids].reverse();
  assert.equal((await P.reorderPanels(space.id, reversed)).ok, true);
  assert.deepEqual((await P.panelsOf(space.id)).map((p) => p.id), reversed);
  assert.equal((await P.reorderPanels(space.id, reversed.slice(1))).ok, false);
  assert.equal((await P.reorderPanels(space.id, [...reversed.slice(1), 999999])).ok, false);
  assert.equal((await P.reorderPanels(space.id, [...reversed.slice(1), reversed[1]])).ok, false);

  // The public page follows the order.
  assert.deepEqual((await page()).panels.map((p) => p.id), reversed);

  // Hide: never rendered.
  assert.equal(await P.setPanelHidden(space.id, ids[3], true), true);
  assert.ok(!(await page()).panels.some((p) => p.id === ids[3]));

  // Delete makes room for another.
  assert.equal(await P.deletePanel(space.id, ids[7]), true);
  assert.equal((await P.createPanel(space, panel({ title: 'Room again' }))).ok, true);
});

test('panels: limits on title and text are refused, not cut', async () => {
  const id = (await P.panelsOf(space.id))[0].id;
  assert.equal((await P.updatePanel(space, id, panel({ title: 'x'.repeat(41) }))).ok, false);
  assert.equal((await P.updatePanel(space, id, panel({ body: 'x'.repeat(601) }))).ok, false);
  assert.equal((await P.updatePanel(space, id, panel({ title: '   ' }))).ok, false);
});

test('panels: the link policy on save — blocked, subdomains, shorteners, non-https refused; ordinary links pass', async () => {
  const id = (await P.panelsOf(space.id))[0].id;
  for (const linkUrl of ['https://stake.com/', 'https://promo.stake.com/', 'https://bit.ly/abc', 'http://discord.gg/abc', 'https://osrs-gold-shop.net', 'https://1.2.3.4/']) {
    const r = await P.updatePanel(space, id, panel({ linkUrl }));
    assert.equal(r.ok, false, linkUrl);
  }
  // A blocked site written into the text is refused too.
  assert.equal((await P.updatePanel(space, id, panel({ body: 'play at roobet.com' }))).ok, false);
  for (const linkUrl of ['https://twitch.tv/streamer', 'https://www.youtube.com/@streamer', 'https://discord.gg/abc']) {
    assert.equal((await P.updatePanel(space, id, panel({ linkUrl }))).ok, true, linkUrl);
  }
});

test('panels and bio: obvious gambling / RWT / bot / private server wording is refused in plain words', async () => {
  const id = (await P.panelsOf(space.id))[0].id;
  for (const [title, body] of [
    ['Cheap GP', ''],
    ['Services', 'Infernal cape service, any stats'],
    ['Fun', 'We stake every night'],
    ['Servers', 'Check out my RSPS'],
    ['Clients', 'best botting client'],
  ]) {
    const r = await P.updatePanel(space, id, panel({ title, body }));
    assert.equal(r.ok, false, `${title} ${body}`);
    if (!r.ok) assert.match(r.error, /^Promotions must follow Jagex's rules/);
  }
  const bio = await P.setBio(space.id, 'Selling accounts and gold, DM me');
  assert.equal(bio.ok, false);
  assert.equal((await P.setBio(space.id, 'x'.repeat(501))).ok, false);
  assert.deepEqual(await P.setBio(space.id, 'Bingo streams every Friday.\nhttps://discord.gg/abc'), { ok: true, value: 'Bingo streams every Friday.\nhttps://discord.gg/abc' });
});

test('panels: images must be this space’s own uploads', async () => {
  const id = (await P.panelsOf(space.id))[0].id;
  assert.equal((await P.updatePanel(space, id, panel({ imageUrl: 'https://evil.example/x.webp' }))).ok, false);
  assert.equal((await P.updatePanel(space, id, panel({ imageUrl: IMG('other') }))).ok, false);
  assert.equal((await P.updatePanel(space, id, panel({ imageUrl: IMG('streamer') }))).ok, true);
  // A row that somehow holds a foreign image renders with no image.
  await db.update(s.spacePanels).set({ imageUrl: 'https://evil.example/x.webp' }).where(eq(s.spacePanels.id, id));
  assert.equal((await page()).panels.find((p) => p.id === id)?.imageUrl, null);
  await db.update(s.spacePanels).set({ imageUrl: IMG('streamer') }).where(eq(s.spacePanels.id, id));
  assert.equal((await page()).panels.find((p) => p.id === id)?.imageUrl, IMG('streamer'));
});

test('staff blocklist: adding a domain blocks it and its subdomains at once, on save and on render; removing it lets it back', async () => {
  const id = (await P.panelsOf(space.id))[0].id;
  assert.equal((await P.updatePanel(space, id, panel({ linkUrl: 'https://shop.newtrade.example/', body: 'see https://newtrade.example/x' }))).ok, true);
  let shown = (await page()).panels.find((p) => p.id === id)!;
  assert.equal(shown.linkUrl, 'https://shop.newtrade.example/');
  assert.ok(shown.body.some((seg) => seg.href === 'https://newtrade.example/x'));

  const added = await P.addBlockedDomain('https://www.NewTrade.example/whatever', 'rwt', staffer);
  assert.deepEqual(added, { ok: true, value: 'newtrade.example' });
  assert.equal((await P.addBlockedDomain('not a domain', 'rwt', staffer)).ok, false);

  // The saved panel stays, but its link is no longer a link.
  shown = (await page()).panels.find((p) => p.id === id)!;
  assert.equal(shown.linkUrl, null);
  assert.ok(!shown.body.some((seg) => seg.href));
  // And it cannot be saved again with it.
  assert.equal((await P.updatePanel(space, id, panel({ linkUrl: 'https://a.b.newtrade.example/' }))).ok, false);

  const row = (await P.listBlockedDomains()).find((b) => b.domain === 'newtrade.example')!;
  assert.equal(row.addedBy, 'Staffer');
  await P.removeBlockedDomain(row.id);
  assert.equal((await P.updatePanel(space, id, panel({ linkUrl: 'https://a.b.newtrade.example/' }))).ok, true);
});

test('reports: a signed-in viewer’s report lands in the staff queue with a snapshot; duplicates collapse', async () => {
  const target = (await page()).panels[0];
  const r1 = await P.reportContent(space, { panelId: target.id, reason: 'looks like a gold site', reporterUserId: viewer });
  assert.equal(r1.ok, true);
  const r2 = await P.reportContent(space, { panelId: target.id, reason: 'again', reporterUserId: viewer });
  assert.deepEqual(r2, r1);
  // Another space's panel cannot be reported through this space.
  assert.equal((await P.reportContent(other, { panelId: target.id, reason: '', reporterUserId: viewer })).ok, false);

  assert.equal(await P.openPromoReportCount(), 1);
  const [q] = await P.listPromoReports('open');
  assert.equal(q.space.slug, 'streamer');
  assert.equal(q.panel?.id, target.id);
  assert.equal(q.reporter, 'Viewer');
  assert.equal(q.reason, 'looks like a gold site');
  assert.match(q.snapshot, new RegExp(target.title));

  // A later edit cannot erase what was reported.
  await P.updatePanel(space, target.id, panel({ title: 'Innocent now' }));
  assert.match((await P.listPromoReports('open'))[0].snapshot, new RegExp(target.title));
});

test('staff hide: the panel disappears, the report closes, and the host cannot bring it back', async () => {
  const [q] = await P.listPromoReports('open');
  const panelId = q.panel!.id;
  assert.equal((await P.resolvePromoReport(q.id, 'hide', staffer)).ok, true);
  assert.equal(await P.openPromoReportCount(), 0);
  assert.ok(!(await page()).panels.some((p) => p.id === panelId));
  // A hidden panel cannot be reported again.
  assert.equal((await P.reportContent(space, { panelId, reason: '', reporterUserId: viewer })).ok, false);

  // The host "shows" it: still hidden, because staff hid it.
  await P.setPanelHidden(space.id, panelId, false);
  assert.ok(!(await page()).panels.some((p) => p.id === panelId));
  assert.equal((await P.spacePageForAdmin(space.id)).panels.find((p) => p.id === panelId)?.hiddenByStaff, true);
  assert.ok((await P.listStaffHidden()).panels.some((p) => p.id === panelId));

  // Staff undo it.
  assert.equal(await P.staffSetPanelHidden(panelId, false, staffer), true);
  assert.ok((await page()).panels.some((p) => p.id === panelId));
});

test('staff hide of a whole page: no bio, panels, schedule or featured render', async () => {
  await P.setSchedule(space.id, 'Europe/London', [{ weekday: 5, minuteOfDay: 19 * 60, label: 'Bingo night' }]);
  const before = await page();
  assert.ok(before.bio && before.panels.length > 0 && before.schedule.length === 1);

  const rep = await P.reportContent(space, { panelId: null, reason: 'the bio', reporterUserId: viewer });
  assert.equal(rep.ok, true);
  const dismissed = await P.reportContent(space, { panelId: null, reason: 'dupe from someone else', reporterUserId: staffer });
  assert.equal(dismissed.ok, true);
  if (!rep.ok || !dismissed.ok) return;
  assert.equal((await P.resolvePromoReport(dismissed.value, 'dismiss', staffer)).ok, true);
  assert.equal((await P.resolvePromoReport(rep.value, 'hide', staffer)).ok, true);

  const after = await page();
  assert.equal(after.bio, null);
  assert.deepEqual(after.panels, []);
  assert.deepEqual(after.schedule, []);
  assert.equal(after.featured, null);
  assert.equal((await P.spacePageForAdmin(space.id)).pageHiddenByStaff, true);
  const statuses = (await P.listPromoReports('all')).filter((r) => r.panel == null).map((r) => r.status).sort();
  assert.deepEqual(statuses, ['dismissed', 'hidden']);

  await P.staffSetSpaceHidden(space.id, false, staffer);
  assert.ok((await page()).bio);
});

test('schedule: stored in the host’s zone, served as UTC instants in order, labels checked', async () => {
  assert.equal((await P.setSchedule(space.id, 'Mars/Olympus', [{ weekday: 1, minuteOfDay: 60 }])).ok, false);
  assert.equal((await P.setSchedule(space.id, 'Europe/London', [{ weekday: 1, minuteOfDay: 60, label: 'dice night' }])).ok, false);
  assert.equal((await P.setSchedule(space.id, 'Europe/London', Array.from({ length: 15 }, () => ({ weekday: 1, minuteOfDay: 60 })))).ok, false);
  const ok = await P.setSchedule(space.id, 'Europe/London', [
    { weekday: 0, minuteOfDay: 19 * 60, label: 'Sunday bingo' },
    { weekday: 5, minuteOfDay: 20 * 60, label: null },
  ]);
  assert.equal(ok.ok, true);
  // Thursday 26 March 2026: Friday 20:00 GMT is 20:00 UTC; Sunday is the BST change day, 19:00 BST = 18:00 UTC.
  const p = await page(space, everything, Date.UTC(2026, 2, 26, 12));
  assert.equal(p.scheduleTz, 'Europe/London');
  assert.deepEqual(
    p.schedule.map((x) => [new Date(x.startsAt).toISOString(), x.label]),
    [
      ['2026-03-27T20:00:00.000Z', null],
      ['2026-03-29T18:00:00.000Z', 'Sunday bingo'],
    ],
  );
});

test('featured: only the space’s own, host-channel, showable highlights — and only for viewers who may see the event', async () => {
  const mine = await highlight(space.id, eventId);
  const playerChannel = await highlight(space.id, eventId, { channelOwner: 'player', channelId: '777', channelName: 'viewer' });
  const pending = await highlight(space.id, eventId, { clipStatus: 'pending', clipUrl: null, vodStatus: 'pending' });
  const theirs = await highlight(other.id, otherEventId);

  const choices = (await P.featurableHighlights(space.id)).map((h) => h.id);
  assert.ok(choices.includes(mine));
  assert.ok(!choices.includes(playerChannel));
  assert.ok(!choices.includes(pending));
  assert.ok(!choices.includes(theirs));

  for (const id of [playerChannel, pending, theirs, 999999]) assert.equal((await P.setFeatured(space.id, { highlightId: id })).ok, false, String(id));
  assert.equal((await P.setFeatured(space.id, { highlightId: mine })).ok, true);

  const shown = (await page()).featured;
  assert.equal(shown?.kind, 'highlight');
  if (shown?.kind === 'highlight') {
    assert.equal(shown.highlight.id, mine);
    assert.equal(shown.highlight.eventName, 'Stream Bingo');
  }
  // A viewer who may not open the event does not see it.
  assert.equal((await page(space, async () => false)).featured, null);
});

test('featured: a clip link from Twitch, YouTube, Kick or Medal only; clearing works', async () => {
  for (const clipUrl of ['https://stake.com/clip', 'http://clips.twitch.tv/x', 'https://bit.ly/x']) {
    assert.equal((await P.setFeatured(space.id, { clipUrl })).ok, false, clipUrl);
  }
  assert.equal((await P.setFeatured(space.id, { clipUrl: 'https://medal.tv/clips/abc', title: 'Cheap gp here' })).ok, false);
  assert.equal((await P.setFeatured(space.id, { clipUrl: 'https://kick.com/streamer/clips/clip_1', title: 'My first pet' })).ok, true);
  const f = (await page()).featured;
  assert.deepEqual(f, { kind: 'clip', url: 'https://kick.com/streamer/clips/clip_1', platform: 'kick', title: 'My first pet' });
  assert.equal((await P.setFeatured(space.id, null)).ok, true);
  assert.equal((await page()).featured, null);
});

test('everything is keyed by space: the other space sees none of it', async () => {
  const p = await page(other);
  assert.equal(p.bio, null);
  assert.deepEqual(p.panels, []);
  assert.deepEqual(p.schedule, []);
});
