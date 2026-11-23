// Practice boards (lib/practice), against a real database: what a practice board is made of, who
// may see it, that it stays off the clan's listings, and above all that its Discord posts go to its
// own test webhook and nowhere else — even when the board it was copied from names the clan's
// channels.
//
// Run: npx tsx --test tests/practice-boards-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('practice-boards');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let practice: typeof import('../src/lib/practice.ts');
let discord: typeof import('../src/lib/discord.ts');
let access: typeof import('../src/lib/eventAccess.ts');
let cards: typeof import('../src/lib/eventCards.ts');
let index: typeof import('../src/lib/eventIndex.ts');
let moments: typeof import('../src/lib/momentsStore.ts');

const TEST_HOOK = 'https://discord.com/api/webhooks/111111111111111111/practice-token';
const CLAN_HOOK = 'https://discord.com/api/webhooks/222222222222222222/clan-bingo-token';
const EVENT_HOOK = 'https://discord.com/api/webhooks/333333333333333333/real-event-token';

let alpha: number;
let bravo: number;
let realEventId: number;
let killTileId: number;
const people = {} as Record<'admin' | 'helper' | 'outsider', { playerId: number; userId: number; seatId: number; accountId: number }>;
let practiceId: number;

/** Every Discord URL the code under test fetched, with the stand-in network answering 200. */
const fetched: string[] = [];
const realFetch = globalThis.fetch;

async function personWithSeat(name: string, clanId: number) {
  const [player] = await db.insert(s.players).values({ displayName: name }).returning();
  const [user] = await db.insert(s.users).values({ displayName: name, playerId: player.id }).returning();
  const [account] = await db.insert(s.accounts).values({ playerId: player.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: account.id, kind: 'member' }).returning();
  return { playerId: player.id, userId: user.id, seatId: seat.id, accountId: account.id };
}

const waitForFetches = async (n: number) => {
  for (let i = 0; i < 40 && fetched.length < n; i++) await new Promise((r) => setTimeout(r, 50));
};

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  practice = await import('../src/lib/practice.ts');
  discord = await import('../src/lib/discord.ts');
  access = await import('../src/lib/eventAccess.ts');
  cards = await import('../src/lib/eventCards.ts');
  index = await import('../src/lib/eventIndex.ts');
  moments = await import('../src/lib/momentsStore.ts');

  globalThis.fetch = (async (url: string | URL) => {
    fetched.push(String(url).split('?')[0]);
    return new Response(JSON.stringify({ id: '9', channel_id: '9' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  alpha = (await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning())[0].id;
  bravo = (await db.insert(s.clans).values({ slug: 'bravo', name: 'Bravo' }).returning())[0].id;
  people.admin = await personWithSeat('Boss', alpha);
  people.helper = await personWithSeat('Helper', alpha);
  people.outsider = await personWithSeat('Outsider', alpha);
  await db.insert(s.clanStaff).values({ clanId: alpha, userId: people.admin.userId, role: 'admin' });
  // The clan's real bingo channel.
  await db.insert(s.settings).values({ clanId: alpha, key: 'discord_webhook_bingo', value: CLAN_HOOK });

  // A real board, running, with its OWN channel set — exactly what a copy must never take along.
  const [ev] = await db
    .insert(s.events)
    .values({
      clanId: alpha,
      name: 'Winter Bingo',
      boardSize: 2,
      tilesRevealed: 1,
      startDate: new Date(Date.now() - 3_600_000).toISOString(),
      endDate: new Date(Date.now() + 86_400_000).toISOString(),
      startNotified: 1,
      discordPrefs: { webhookUrl: EVENT_HOOK },
    })
    .returning();
  realEventId = ev.id;
  const made = await db
    .insert(s.tiles)
    .values([
      { eventId: ev.id, position: 0, label: '50 Zulrah kills', tileType: 'kill', requiredAmount: 50, targetNpcs: JSON.stringify(['Zulrah']) },
      { eventId: ev.id, position: 1, label: 'Any Barrows item', tileType: 'drop', requiredAmount: 1 },
      { eventId: ev.id, position: 2, label: 'Slow tile', tileType: 'standard' },
      { eventId: ev.id, position: 3, label: 'Mission', tileType: 'standard', mission: 1 },
    ])
    .returning({ id: s.tiles.id, label: s.tiles.label });
  killTileId = made[0].id;
  const pick = made.filter((t) => t.label !== 'Slow tile').map((t) => t.id);

  practiceId = await practice.createPracticeBoard(people.admin.userId, alpha, {
    tiles: { mode: 'copy', eventId: realEventId, tileIds: pick },
    seats: [people.admin.seatId, people.helper.seatId],
    sides: 2,
    webhookUrl: TEST_HOOK,
    hours: 1,
  });
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a practice board is a closed, latched copy in the clan, with the people on two teams', async () => {
  const ev = (await db.query.events.findFirst({ where: eq(s.events.id, practiceId) }))!;
  assert.equal(ev.practice, true);
  assert.equal(ev.clanId, alpha);
  assert.equal(ev.visibility, 'invited');
  assert.equal(ev.signupsEnabled, false);
  assert.deepEqual(ev.discordPrefs, {}, 'never the copied board’s channel');
  assert.equal(ev.startNotified, 1);
  assert.equal(ev.endNotified, 1);
  assert.equal(ev.halfwayNotified, true);
  const tiles = await db.select().from(s.tiles).where(eq(s.tiles.eventId, practiceId));
  assert.deepEqual(tiles.map((t) => t.label).sort(), ['50 Zulrah kills', 'Any Barrows item', 'Mission']);
  assert.equal(tiles.find((t) => t.label === 'Mission')!.mission, 1, 'a hidden tile stays hidden');
  const teams = await db.select().from(s.teams).where(eq(s.teams.eventId, practiceId));
  assert.equal(teams.length, 2);
  const players = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, practiceId));
  assert.deepEqual(players.map((p) => p.clanMemberId).sort(), [people.admin.seatId, people.helper.seatId].sort());
  const [board] = await db.select().from(s.practiceBoards).where(eq(s.practiceBoards.eventId, practiceId));
  assert.equal(board.webhookUrl, TEST_HOOK);
  assert.equal(board.sourceEventId, realEventId);
});

test('one practice board per clan at a time, and only this clan’s seats and boards', async () => {
  const again = practice.createPracticeBoard(people.admin.userId, alpha, {
    tiles: { mode: 'pick', count: 1 },
    seats: [people.admin.seatId],
    sides: 1,
    webhookUrl: null,
    hours: 1,
  });
  await assert.rejects(again, (e: unknown) => e instanceof practice.PracticeError && e.status === 409);

  const stranger = await personWithSeat('Stranger', bravo);
  await assert.rejects(
    practice.createPracticeBoard(people.admin.userId, bravo, {
      tiles: { mode: 'copy', eventId: realEventId, tileIds: [killTileId] },
      seats: [stranger.seatId],
      sides: 1,
      webhookUrl: null,
      hours: 1,
    }),
    (e: unknown) => e instanceof practice.PracticeError && e.status === 404,
    'another clan cannot copy this clan’s board',
  );
  await assert.rejects(
    practice.createPracticeBoard(people.admin.userId, bravo, {
      tiles: { mode: 'pick', count: 1 },
      seats: [people.helper.seatId],
      sides: 1,
      webhookUrl: null,
      hours: 1,
    }),
    (e: unknown) => e instanceof practice.PracticeError,
    'another clan’s members cannot be put on it',
  );
  assert.equal(await practice.practiceBoardInClan(bravo, practiceId), null, 'not found from another clan');
  assert.ok(await practice.practiceBoardInClan(alpha, practiceId));
  assert.equal(await practice.practiceBoardInClan(alpha, realEventId), null, 'a real board is not a practice board');
});

test('only the people on it and the clan’s admins see it', async () => {
  assert.equal(await access.canSeeEvent({ eventId: practiceId, playerId: null }), false);
  assert.equal(await access.canSeeEvent({ eventId: practiceId, playerId: people.outsider.playerId }), false, 'a member not on it');
  assert.equal(await access.canSeeEvent({ eventId: practiceId, playerId: people.helper.playerId }), true, 'a helper on it');
  assert.equal(await access.canSeeEvent({ eventId: practiceId, playerId: people.admin.playerId }), true, 'an admin');
  // The real board is unchanged: the clan's own members see it.
  assert.equal(await access.canSeeEvent({ eventId: realEventId, playerId: people.outsider.playerId }), true);
});

test('the clan’s listings leave it out', async () => {
  const shown = await cards.loadEventCards(alpha, { includeUpcoming: true });
  assert.ok(shown.some((c) => c.id === realEventId));
  assert.ok(!shown.some((c) => c.id === practiceId), 'not on the events page or the clan home');
  const listed = await index.listEventIndex(alpha);
  assert.ok(listed.some((i) => i.kind === 'board' && i.id === realEventId));
  assert.ok(!listed.some((i) => i.kind === 'board' && i.id === practiceId), 'not in the admin index or schedule');
  // A moment can't be stamped with it either: the live-board read that picks a moment's board skips it.
  const boards = await moments.liveBoardRows(people.helper.seatId);
  assert.ok(!boards.some((b) => b.eventId === practiceId));
});

test('its Discord posts go to the test webhook only — the real board’s still go to the clan', async () => {
  fetched.length = 0;
  const payload = { embeds: [{ title: 'Tile completed' }], content: '<@&123> ping' };
  assert.equal(await discord.sendEventBingoWebhook(alpha, practiceId, payload, { post: 'tileComplete' }), true);
  await waitForFetches(1);
  assert.deepEqual([...new Set(fetched)], [TEST_HOOK], 'the practice post went to its test hook and nowhere else');

  fetched.length = 0;
  await discord.sendEventBingoWebhook(alpha, realEventId, { embeds: [{ title: 'Tile completed' }] }, { post: 'tileComplete' });
  await waitForFetches(1);
  assert.ok(fetched.includes(EVENT_HOOK), 'the real board posts to its own channel as before');
  assert.ok(!fetched.includes(TEST_HOOK));

  // Lifecycle-style posts that skip the chokepoint say nothing for a practice board.
  fetched.length = 0;
  assert.equal(await discord.notifyEventStartHeld({ clanId: alpha, eventId: practiceId, eventName: 'x', scheduledStart: new Date().toISOString(), blockers: [] } as never), false);
  assert.equal(fetched.length, 0);

  // The rules card (the board's own post) goes to the test hook too, never the clan's bingo channel.
  fetched.length = 0;
  const rules = await (await import('../src/lib/eventRulesPost.ts')).postEventRules(practiceId, alpha);
  assert.ok(rules.length <= 1);
  await waitForFetches(1);
  assert.ok(fetched.every((u) => u === TEST_HOOK), `rules card went only to the test hook: ${fetched.join(', ')}`);

  // No hook: no post at all.
  await db.update(s.practiceBoards).set({ webhookUrl: null }).where(eq(s.practiceBoards.eventId, practiceId));
  fetched.length = 0;
  assert.equal(await discord.sendEventBingoWebhook(alpha, practiceId, payload, { post: 'tileComplete' }), false);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(fetched.length, 0, 'nothing posted anywhere');
  await db.update(s.practiceBoards).set({ webhookUrl: TEST_HOOK }).where(eq(s.practiceBoards.eventId, practiceId));
});

test('the plugin is told it is a practice board', async () => {
  const { summaryOf } = await import('../src/lib/pluginBoards.ts');
  const base = { eventId: practiceId, name: 'Practice', clan: 'alpha', clanName: 'Alpha', teamId: 1, teamName: 'Gold' };
  assert.equal(summaryOf({ ...base, practice: true }, null).practice, true);
  assert.equal('practice' in summaryOf({ ...base, practice: false }, null), false, 'absent on a real board');
  const { buildEnrolledConfig } = await import('../src/lib/pluginConfigEnrolled.ts');
  const { resolveClanById } = await import('../src/lib/clanContext.ts');
  const [team] = await db.select().from(s.teams).where(eq(s.teams.eventId, practiceId)).limit(1);
  const built = await buildEnrolledConfig({ eventId: practiceId, teamId: team.id, clan: (await resolveClanById(alpha))!, viewer: null });
  assert.equal(built.ok, true);
  assert.equal((built as { body: { event: { practice?: boolean } } }).body.event.practice, true);
  // Its own (active, untagged) tile lists carry the prefix; the panel keeps the plain names.
  const pb = (built as { body: { trackedKills?: { label: string }[]; panel: { tiles: { label?: string }[] } } }).body;
  assert.ok((pb.trackedKills ?? []).length > 0);
  assert.ok((pb.trackedKills ?? []).every((k) => k.label.startsWith('[Practice] ')), JSON.stringify(pb.trackedKills));
  assert.ok(pb.panel.tiles.every((t) => !t.label?.startsWith('[Practice]')));
  const realTeam = await db.insert(s.teams).values({ eventId: realEventId, name: 'Real', color: '#123456' }).returning();
  const real = await buildEnrolledConfig({ eventId: realEventId, teamId: realTeam[0].id, clan: (await resolveClanById(alpha))!, viewer: null });
  assert.equal('practice' in (real as { body: { event: Record<string, unknown> } }).body.event, false);
  const rk = (real as { body: { trackedKills?: { label: string }[] } }).body.trackedKills ?? [];
  assert.ok(rk.every((k) => !k.label.startsWith('[Practice]')), 'a real board’s labels are untouched');
});

test('lower target: a real couple of kills finish the practice copy, the real tile is untouched', async () => {
  const [copy] = await db.select().from(s.tiles).where(and(eq(s.tiles.eventId, practiceId), eq(s.tiles.label, '50 Zulrah kills')));
  const [team] = await db.select().from(s.teams).where(eq(s.teams.eventId, practiceId)).limit(1);
  const [player] = await db.select().from(s.eventParticipants).where(and(eq(s.eventParticipants.eventId, practiceId), eq(s.eventParticipants.teamId, team.id)));
  await db.insert(s.submissions).values([
    { tileId: copy.id, teamId: team.id, playerId: player.id, amount: 1, source: 'plugin' },
    // The finishing kill carries the plugin's screenshot, as a real one does (proof on completion).
    { tileId: copy.id, teamId: team.id, playerId: player.id, amount: 1, source: 'plugin', imageUrl: '/uploads/proof.png' },
  ]);
  const lowered = await practice.lowerPracticeTarget(practiceId, copy.id, 2);
  assert.equal(lowered.goal, 2);
  const done = await db.select().from(s.completions).where(and(eq(s.completions.tileId, copy.id), eq(s.completions.teamId, team.id)));
  assert.equal(done.length, 1, 'finished by the two kills');
  const [real] = await db.select().from(s.tiles).where(eq(s.tiles.id, killTileId));
  assert.equal(real.requiredAmount, 50);

  await practice.resetPracticeTile(practiceId, copy.id);
  assert.equal((await db.select().from(s.completions).where(eq(s.completions.tileId, copy.id))).length, 0);
  assert.equal((await db.select().from(s.submissions).where(eq(s.submissions.tileId, copy.id))).length, 0);
  // A tile from another board can't be reset through this one.
  await assert.rejects(practice.resetPracticeTile(practiceId, killTileId), practice.PracticeError);
});

test('the event settings routes refuse a practice board, and still take a real one', async () => {
  const { refusePractice } = await import('../src/lib/practiceGuard.ts');
  assert.equal((await refusePractice(Promise.resolve({ eventId: String(practiceId) })))?.status, 404);
  assert.equal(await refusePractice({ eventId: String(realEventId) }), null);
  assert.equal(await refusePractice({ eventId: 'nope' }), null);

  type Handler = (req: Request, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;
  const call = async (handler: Handler, eventId: number, method: string): Promise<{ status: number; error?: string } | 'past-guard'> => {
    const req = new Request(`http://localhost/api/x/${eventId}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
    try {
      const res = await handler(req, { params: Promise.resolve({ eventId: String(eventId) }) });
      const body = (await res.clone().json().catch(() => ({}))) as { error?: string };
      return { status: res.status, error: body.error };
    } catch {
      // Outside a Next request there is no cookie store: a route that got as far as asking who is
      // calling has already passed the practice guard.
      return 'past-guard';
    }
  };
  const refused = { status: 404, error: 'Not available on a practice board.' };
  const routes: [string, Handler, string][] = [
    ['co-hosts', (await import('../src/app/api/events/[eventId]/co-hosts/route.ts')).POST as Handler, 'POST'],
    ['teams', (await import('../src/app/api/events/[eventId]/teams/route.ts')).POST as Handler, 'POST'],
    ['event settings', (await import('../src/app/api/events/[eventId]/route.ts')).PATCH as Handler, 'PATCH'],
    ['webhooks', (await import('../src/app/api/admin/events/[eventId]/webhooks/route.ts')).POST as Handler, 'POST'],
    ['sign-ups', (await import('../src/app/api/admin/events/[eventId]/signups/route.ts')).GET as Handler, 'GET'],
    ['prize pool', (await import('../src/app/api/admin/events/[eventId]/prize-pool/route.ts')).PUT as Handler, 'PUT'],
    ['editors', (await import('../src/app/api/events/[eventId]/editors/route.ts')).POST as Handler, 'POST'],
  ];
  for (const [name, handler, method] of routes) {
    assert.deepEqual(await call(handler, practiceId, method), refused, `${name} refuses a practice board`);
    assert.notDeepEqual(await call(handler, realEventId, method), refused, `${name} still takes a real board`);
  }
  // What the practice page itself uses is not refused: the tile import behind "Add tiles".
  const importer = (await import('../src/app/api/events/[eventId]/tiles/import/route.ts')).POST as Handler;
  assert.notDeepEqual(await call(importer, practiceId, 'POST'), refused);
});

test('ended, it is swept a week later — and only practice boards are', async () => {
  await practice.endPracticeBoard(practiceId);
  assert.equal(await practice.activePracticeBoard(alpha), null);
  assert.equal(await practice.sweepEndedPracticeBoards(new Date()), 0, 'kept for a week');
  assert.equal(await practice.sweepEndedPracticeBoards(new Date(Date.now() + 8 * 86_400_000)), 1);
  assert.equal((await db.select().from(s.events).where(eq(s.events.id, practiceId))).length, 0);
  assert.equal((await db.select().from(s.events).where(eq(s.events.id, realEventId))).length, 1);
  assert.equal(await practice.deletePracticeBoard(realEventId), false, 'a real board can never be deleted through here');
});
