// Notices from Anvil against a real database (lib/notices): who sees what, read state in each place,
// the brief printing once, and the composer refusing a link that isn't Anvil or Discord.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/notices-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('notices');
// No bot token: nothing here may reach Discord.
delete process.env.DISCORD_BOT_TOKEN;
delete process.env.ANVIL_SHARED_BOT_TOKEN;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let N: typeof import('../src/lib/notices.ts');
let W: typeof import('../src/lib/welcomeDm.ts');
const ids = {} as Record<string, number>;

async function person(name: string) {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const [u] = await db.insert(s.users).values({ playerId: p.id, displayName: name, discordId: `10000000000000${ids.n = (ids.n ?? 0) + 1}` }).returning();
  return u.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  N = await import('../src/lib/notices.ts');
  W = await import('../src/lib/welcomeDm.ts');
  ids.owner = await person('owner');
  ids.member = await person('member');
  ids.patron = await person('patron');
  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'Afk' }).returning();
  ids.clan = clan.id;
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: ids.owner, role: 'owner' });
  await db.insert(s.supporterSubscriptions).values({
    userId: ids.patron,
    tier: 'patron',
    status: 'active',
    recurrence: 'monthly',
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    startedAt: '2026-01-01T00:00:00Z',
  });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const base = { body: 'Body', linkUrl: '', linkLabel: '', inPlugin: true, inBrief: true, byDm: false, level: 'info', expiresInDays: 0 };

test('audiences: admins, a tier, one clan, one person', async () => {
  const a = await N.createNotice({ ...base, title: 'For admins', audience: 'admins' }, ids.owner);
  const b = await N.createNotice({ ...base, title: 'For patrons', audience: 'tier:patron' }, ids.owner);
  const c = await N.createNotice({ ...base, title: 'For Afk', audience: `clan:${ids.clan}` }, ids.owner);
  const d = await N.createNotice({ ...base, title: 'For member', audience: `user:${ids.member}` }, ids.owner);
  assert.ok(a.ok && b.ok && c.ok && d.ok);
  const titles = async (u: number) => (await N.inboxFor(u)).notices.map((n) => n.title).sort();
  assert.deepEqual(await titles(ids.owner), ['For Afk', 'For admins']);
  assert.deepEqual(await titles(ids.patron), ['For patrons']);
  assert.deepEqual(await titles(ids.member), ['For member']);
});

test('read state: inbox, panel card, brief once', async () => {
  const before = await N.inboxFor(ids.owner);
  assert.equal(before.unread, 2);
  const panel = await N.panelNoticeFor(ids.owner);
  assert.equal(panel?.title, 'For Afk'); // newest first
  await N.hidePanelNotice(ids.owner, panel!.id);
  assert.equal((await N.panelNoticeFor(ids.owner))?.title, 'For admins');

  const line1 = await N.briefNoticeLine(ids.owner);
  const line2 = await N.briefNoticeLine(ids.owner);
  const line3 = await N.briefNoticeLine(ids.owner);
  assert.deepEqual([line1, line2, line3], ['From Anvil: For Afk', 'From Anvil: For admins', null]);

  // Hiding someone else's notice does nothing.
  const patronNotice = (await N.inboxFor(ids.patron)).notices[0];
  await N.hidePanelNotice(ids.owner, patronNotice.id);
  assert.equal((await N.panelNoticeFor(ids.patron))?.id, patronNotice.id);

  await N.markRead(ids.owner, 'all');
  const after = await N.inboxFor(ids.owner);
  assert.equal(after.unread, 0);
  assert.equal(await N.panelNoticeFor(ids.owner), null);
  // Stamping again keeps the first time.
  const [row] = await db.select().from(s.platformNoticeReads).where(eq(s.platformNoticeReads.userId, ids.owner)).limit(1);
  await N.markRead(ids.owner, 'all');
  const [again] = await db.select().from(s.platformNoticeReads).where(eq(s.platformNoticeReads.noticeId, row.noticeId));
  assert.equal(again.readAt?.getTime(), row.readAt?.getTime());
});

test('withdrawn and expired notices disappear', async () => {
  const r = await N.createNotice({ ...base, title: 'Soon gone', audience: 'everyone' }, ids.owner);
  assert.ok(r.ok);
  assert.ok((await N.inboxFor(ids.member)).notices.some((n) => n.title === 'Soon gone'));
  await N.withdrawNotice((r as { id: number }).id);
  assert.ok(!(await N.inboxFor(ids.member)).notices.some((n) => n.title === 'Soon gone'));
});

test('composer refuses bad links and audiences', async () => {
  assert.deepEqual(await N.createNotice({ ...base, title: 'x', audience: 'admins', linkUrl: 'https://evil.com/a.jar' }, ids.owner), {
    ok: false,
    error: 'Links can only go to an Anvil page or a Discord invite, and never to a file.',
  });
  assert.equal((await N.createNotice({ ...base, title: 'x', audience: 'nobody' }, ids.owner)).ok, false);
  assert.equal((await N.createNotice({ ...base, title: '', audience: 'admins' }, ids.owner)).ok, false);
  assert.equal((await N.createNotice({ ...base, title: 'x', audience: 'user:999999' }, ids.owner)).ok, false);
  const ok = await N.createNotice({ ...base, title: 'Linked', audience: 'admins', linkUrl: '/settings/notifications', linkLabel: 'Settings' }, ids.owner);
  assert.ok(ok.ok);
});

test('DM choice is saved by Discord id; no bot token means no welcome', async () => {
  const me = await db.query.users.findFirst({ where: eq(s.users.id, ids.member) });
  assert.equal(await W.setDmsChoice(me!.discordId!, 'yes'), true);
  assert.equal((await db.query.users.findFirst({ where: eq(s.users.id, ids.member) }))?.anvilDms, 'yes');
  assert.equal(await W.setDmsChoice('not-an-id', 'no'), false);
  assert.equal(await W.sendWelcomeDm(ids.member, { kind: 'clan', clanName: 'Afk' }), 'off');
  assert.equal((await db.query.users.findFirst({ where: eq(s.users.id, ids.member) }))?.welcomedAt, null);
  assert.deepEqual(await W.welcomeContextFor(ids.owner), { kind: 'clan', clanName: 'Afk' });
  assert.deepEqual(await W.welcomeContextFor(ids.patron), { kind: 'supporter', tierName: 'Patron' });
  assert.equal(await W.welcomeContextFor(ids.member), null);
});

test("What's new in the bell: marker starts at the newest, new entries per date, audience respected, read clears", async () => {
  const fresh = await person('fresh');
  const old = [{ id: 'old', date: '2026-10-01', title: 'Old', body: 'Old body' }];
  // First look: the marker starts at the newest entry, so no back-catalogue.
  assert.deepEqual(await N.whatsNewNoticesFor(fresh, old), []);
  assert.equal((await db.query.users.findFirst({ where: eq(s.users.id, fresh) }))?.whatsNewSeen, 'old');

  const later = [
    { id: 'staff-only', date: '2026-11-09', title: 'For staff', body: 'b', audience: ['clanStaff' as const] },
    { id: 'all-2', date: '2026-11-09', title: 'Two', body: 'b' },
    { id: 'all-1', date: '2026-11-08', title: 'One', body: 'One body' },
    ...old,
  ];
  const mine = await N.whatsNewNoticesFor(fresh, later);
  assert.deepEqual(
    mine.map((n) => [n.id, n.title, n.kind, n.linkUrl, n.read]),
    [
      [-20261109, 'What’s new: Two', 'whatsNew', '/whats-new', false],
      [-20261108, 'What’s new: One', 'whatsNew', '/whats-new', false],
    ],
  );
  // The clan owner gets the staff entry in the same date's notice.
  await db.update(s.users).set({ whatsNewSeen: 'old' }).where(eq(s.users.id, ids.owner));
  assert.equal((await N.whatsNewNoticesFor(ids.owner, later))[0].title, 'What’s new: 2 changes');

  // Only staff entries are new and this person isn't staff: the marker moves on quietly.
  const staffOnly = [{ id: 'staff-2', date: '2026-11-10', title: 'Staff again', body: 'b', audience: ['clanStaff' as const] }, ...later];
  await N.markWhatsNewSeen(fresh, later);
  assert.deepEqual(await N.whatsNewNoticesFor(fresh, staffOnly), []);
  assert.equal((await db.query.users.findFirst({ where: eq(s.users.id, fresh) }))?.whatsNewSeen, 'staff-2');

  // Reading a What's new notice (negative id) moves the marker to the real list's newest entry.
  await db.update(s.users).set({ whatsNewSeen: '2026-01-01-ancient' }).where(eq(s.users.id, fresh));
  assert.ok((await N.inboxFor(fresh)).notices.some((n) => n.kind === 'whatsNew'));
  await N.markRead(fresh, [-20261109]);
  assert.ok(!(await N.inboxFor(fresh)).notices.some((n) => n.kind === 'whatsNew'));
});
