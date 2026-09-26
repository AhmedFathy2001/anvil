// What an unauthenticated plugin call is told is running.
//
// BEING READABLE BY LINK IS NOT BEING ENUMERABLE. canSeeEvent guards ACCESS, and is emphatic that
// `clan` does not mean "logged-in only" — a board link pasted into Discord has to open, and reading
// it the strict way once 404'd every board for every signed-out visitor.
//
// This is DISCOVERY: "what is this clan running", unauthenticated, to anyone who knows the hostname.
// It filtered on `invited` alone, so it listed every clan board on the platform to anybody who
// asked. A stranger holding a link to one board was never an argument for handing them the index.
//
// Access is deliberately NOT tested here — it is canSeeEvent's, it did not change, and every board
// below still opens for anyone holding its link.
//
// Run: npx tsx --test tests/plugin-schedule-visibility.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-schedule-visibility');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let buildSchedule: typeof import('../src/lib/pluginConfig.ts')['buildSchedule'];
let openClan: number;
let shyClan: number;

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ buildSchedule } = await import('../src/lib/pluginConfig.ts'));

  const [open, shy] = await db
    .insert(s.clans)
    .values([
      { slug: 'open', name: 'Open Clan', visibility: 'public' },
      { slug: 'shy', name: 'Shy Clan', visibility: 'private' },
    ])
    .returning({ id: s.clans.id });
  openClan = open!.id;
  shyClan = shy!.id;

  // The same three boards in each clan, so the only variable is the clan's own setting.
  for (const clanId of [openClan, shyClan]) {
    await db.insert(s.events).values(
      (['public', 'clan', 'invited'] as const).map((visibility) => ({
        clanId,
        name: `${visibility} board`,
        boardSize: 5,
        startDate: day(-1),
        endDate: day(6),
        visibility,
      })),
    );
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const names = (rows: { title: string }[]) => rows.map((b) => b.title).sort();

test('a stranger is told only about what the clan marked public', async () => {
  // The clan itself is public, which is what makes its boards openable by link. It is not an
  // argument for listing them.
  const { bingos } = await buildSchedule(openClan);
  assert.deepEqual(names(bingos), ['public board']);
});

test('an invited board is never advertised, to anyone', async () => {
  const stranger = await buildSchedule(openClan);
  const member = await buildSchedule(openClan, { member: true });
  assert.ok(!names(stranger.bingos).includes('invited board'));
  assert.ok(!names(member.bingos).includes('invited board'), 'the invite is the only way in');
});

test('a private clan answers the same way — the clan setting is not the board setting', async () => {
  const { bingos } = await buildSchedule(shyClan);
  assert.deepEqual(names(bingos), ['public board'], 'its clan board is its own business');
});

test('a member of one clan is not a member of the other', async () => {
  // The member flag is resolved per request against the clan being asked about, so it can never
  // carry someone's standing in their own clan into a clan they merely visit.
  const theirs = await buildSchedule(shyClan, { member: true });
  const ours = await buildSchedule(openClan);
  assert.ok(names(theirs.bingos).includes('clan board'));
  assert.ok(!names(ours.bingos).includes('clan board'));
});

test('its own member still sees the clan board', async () => {
  const { bingos } = await buildSchedule(shyClan, { member: true });
  assert.deepEqual(names(bingos), ['clan board', 'public board']);
});

// A GUEST SEAT IS NOT MEMBERSHIP. The plugin config used to pass `member: true` for any seat its
// token resolved, so somebody who guested in one event was listed every board the clan keeps to
// itself — each rendering "No board to show yet". pluginScheduleViewer draws the line; a guest sees
// public boards plus the ones they actually have standing on.
test('a guest is listed public boards and the clan boards they entered — nothing else', async () => {
  const { db, schema: s } = await loadDb();
  const { pluginScheduleViewer } = await import('../src/lib/pluginConfig.ts');

  const [person] = await db.insert(s.players).values({ displayName: 'Visitor' }).returning();
  const [user] = await db.insert(s.users).values({ displayName: 'Visitor', playerId: person.id }).returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: person.id, rsn: 'Visitor', rsnNormalized: 'visitor' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: openClan, accountId: acct.id, kind: 'guest' }).returning();

  const viewer = await pluginScheduleViewer(openClan, user.id);
  assert.equal(viewer.member, false, 'a guest seat is not membership');
  assert.deepEqual(names((await buildSchedule(openClan, viewer)).bingos), ['public board']);

  // Entering a clan-only board is standing on THAT board.
  const [entered] = await db
    .insert(s.events)
    .values({ clanId: openClan, name: 'entered clan board', boardSize: 5, startDate: day(-1), endDate: day(6), visibility: 'clan' })
    .returning();
  await db.insert(s.eventSignups).values({ eventId: entered.id, clanMemberId: seat.id, status: 'approved' });
  assert.deepEqual(names((await buildSchedule(openClan, viewer)).bingos), ['entered clan board', 'public board']);

  // A member seat is membership again.
  await db.update(s.clanMemberships).set({ kind: 'member' });
  assert.equal((await pluginScheduleViewer(openClan, user.id)).member, true);
});
