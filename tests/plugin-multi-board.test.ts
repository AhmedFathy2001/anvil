// One drop credits every board the player is on. A multi-board plugin (X-Anvil-Boards: 1) gets the
// tracked tiles of the character's OTHER live boards folded into /config, each tagged with the board
// it credits, and files those at the other board's own submissions route. Without the header /config
// is the single-board answer it always was — an older plugin would file board B's tiles to board A.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/plugin-multi-board.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('multiboard');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const ids = {} as Record<string, number>;

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

function headers(clan: string, extra: Record<string, string> = {}) {
  return { Authorization: 'Bearer tok-mb', 'X-RSN': 'Twoboard', 'X-Account-Hash': 'hash-mb', 'x-anvil-clan-slug': clan, ...extra };
}

async function config(extra: Record<string, string> = {}) {
  const { GET } = await import('../src/app/api/plugin/config/route.ts');
  const res = await GET(new Request('https://example.test/api/plugin/config', { headers: headers('alpha', extra) }));
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()) as Record<string, unknown> & { trackedDrops: { tileId: number; board?: Record<string, unknown> }[]; trackedKills: { tileId: number; board?: Record<string, unknown> }[] };
}

async function submit(clan: string, eventId: number, body: object) {
  const route = await import('../src/app/api/events/[eventId]/submissions/route.ts');
  return route.POST(
    new Request(`https://example.test/api/events/${eventId}/submissions`, {
      method: 'POST',
      headers: { ...headers(clan), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ eventId: String(eventId) }) },
  );
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const clan = async (slug: string, status = 'active') =>
    (await db.insert(s.clans).values({ slug, name: slug[0].toUpperCase() + slug.slice(1), status }).returning())[0].id;
  ids.alpha = await clan('alpha');
  ids.bravo = await clan('bravo');
  ids.susp = await clan('susp', 'suspended');

  const person = (await db.insert(s.players).values({ displayName: 'Twoboard' }).returning())[0].id;
  await db.insert(s.users).values({ displayName: 'Twoboard', discordId: 'd-mb', pluginTokenHash: tokenHash('tok-mb'), playerId: person });
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Twoboard', rsnNormalized: 'twoboard', accountHash: 'hash-mb', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();

  const seats = new Map<number, { id: number }>();
  const board = async (key: string, clanId: number, startDays: number, seated = true) => {
    // An account holds one live MEMBER seat; its other clans seat it as a guest.
    const seat = seats.get(clanId) ?? (await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: clanId === ids.alpha ? 'member' : 'guest', source: 'roster' }).returning())[0];
    seats.set(clanId, seat);
    const eventId = (await db.insert(s.events).values({ clanId, name: `Board ${key}`, boardSize: 3, startDate: day(startDays), endDate: day(5), tilesRevealed: 1 }).returning())[0].id;
    const teamId = (await db.insert(s.teams).values({ eventId, name: `Team ${key}`, color: '#fff' }).returning())[0].id;
    ids[`${key}Event`] = eventId;
    ids[`${key}Team`] = teamId;
    if (seated) {
      ids[`${key}Player`] = (await db.insert(s.eventParticipants).values({ eventId, clanMemberId: seat.id, accountId: acct.id, name: 'Twoboard', teamId }).returning())[0].id;
    }
    ids[`${key}Drop`] = (await db.insert(s.tiles).values({ eventId, position: 1, label: `${key} drop`, tileType: 'drop', trackedItemIds: '[4151]', requiredAmount: 1 }).returning())[0].id;
    ids[`${key}Kill`] = (await db.insert(s.tiles).values({ eventId, position: 2, label: `${key} kills`, tileType: 'kill', targetNpcs: '["Zulrah"]', requiredAmount: 50 }).returning())[0].id;
    ids[`${key}Gain`] = (await db.insert(s.tiles).values({ eventId, position: 3, label: `${key} sharks`, tileType: 'gain', trackedItemIds: '[383]', requiredAmount: 100 }).returning())[0].id;
  };
  await board('a', ids.alpha, -2); // the active board when addressing alpha
  await board('b', ids.bravo, -1); // another clan's live board the character is on
  await board('s', ids.susp, -1); // live, but its clan is suspended
  await board('x', ids.bravo, -3, false); // live in bravo, the character is not on it
  await board('c', ids.bravo, -3); // bravo's board that alpha co-hosts: reported through alpha
  for (const eventId of [ids.cEvent, ids.xEvent]) await db.insert(s.eventCohosts).values({ eventId, clanId: ids.alpha, status: 'accepted' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('without X-Anvil-Boards the config is the single-board answer', async () => {
  const cfg = await config();
  assert.equal('boards' in cfg, false);
  assert.deepEqual(cfg.trackedDrops.map((d) => d.tileId), [ids.aDrop]);
  assert.ok(cfg.trackedDrops.every((d) => !('board' in d)));
  assert.ok(cfg.trackedKills.every((d) => !('board' in d)));
});

test('with X-Anvil-Boards, another clan’s board is folded in and tagged; a suspended clan’s is not', async () => {
  const cfg = await config({ 'X-Anvil-Boards': '1' });
  const drops = cfg.trackedDrops;
  assert.deepEqual(drops.map((d) => d.tileId), [ids.aDrop, ids.bDrop, ids.cDrop], 'active board first, untagged; then the rest, latest start first');
  assert.equal('board' in drops[0], false);
  assert.deepEqual(drops[1].board, { eventId: ids.bEvent, teamId: ids.bTeam, playerId: ids.bPlayer, clan: 'bravo', name: 'Board b' });
  assert.ok(cfg.trackedKills.some((k) => k.tileId === ids.bKill && (k.board as { eventId: number }).eventId === ids.bEvent));
  for (const list of [cfg.trackedDrops, cfg.trackedKills]) {
    assert.ok(!list.some((e) => e.tileId === ids.sDrop || e.tileId === ids.sKill || e.tileId === ids.xDrop), 'suspended / not-seated boards stay out');
  }
  const boards = cfg.boards as Record<string, unknown>[];
  assert.deepEqual(boards.map((b) => b.eventId), [ids.aEvent, ids.bEvent, ids.cEvent]);
  assert.equal(boards[2].clan, 'alpha', 'a board the addressed clan co-hosts is reported through it');
  assert.deepEqual(boards[1], { eventId: ids.bEvent, name: 'Board b', clan: 'bravo', clanName: 'Bravo', teamId: ids.bTeam, teamName: 'Team b', tilesComplete: 0, tilesTotal: 3, pointsScored: false });
  assert.equal(boards[0].clan, 'alpha');
});

test('the token resolves the character’s own seat on a named second board', async () => {
  const A = await import('../src/lib/auth.ts');
  const on = (clan: string, eventId: number) => A.verifyPluginTokenOnEvent(new Request('https://example.test/x', { headers: headers(clan) }), eventId);
  const b = await on('bravo', ids.bEvent);
  assert.deepEqual([b?.eventId, b?.teamId, b?.playerId], [ids.bEvent, ids.bTeam, ids.bPlayer]);
  // Not seated on X: the live pick comes back, which the route's team check refuses.
  const x = await on('bravo', ids.xEvent);
  assert.notEqual(x?.eventId, ids.xEvent);
});

// Through the co-host's address (the route skips cookie roles there, so no request scope is needed).
test('a submission to another live board credits the character’s seat there', async () => {
  const res = await submit('alpha', ids.cEvent, { tileId: ids.cKill, teamId: ids.cTeam, amount: 3 });
  assert.ok(res.status < 300, `accepted (${res.status} ${await res.clone().text()})`);
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(s.submissions).where(eq(s.submissions.tileId, ids.cKill));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].teamId, ids.cTeam);
  assert.equal(rows[0].playerId, ids.cPlayer);
});

test('a board the character is not on still refuses it', async () => {
  const res = await submit('alpha', ids.xEvent, { tileId: ids.xKill, teamId: ids.xTeam, amount: 1 });
  assert.equal(res.status, 403, await res.clone().text());
});

async function facts(facts: object[]) {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const res = await POST(
    new Request('https://example.test/api/plugin/facts', {
      method: 'POST',
      headers: { ...headers('alpha', { 'X-Anvil-Boards': '1' }), 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts }),
    }),
  );
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()) as { credits: { t: number; kind: string; label: string; have: number; of: number; ok?: boolean }[]; notes: string[] };
}

test('another board’s plugin-judged tiles say which board in their label', async () => {
  const cfg = (await config({ 'X-Anvil-Boards': '1' })) as unknown as { trackedGains: { tileId: number; label: string }[] };
  const label = (id: number) => cfg.trackedGains.find((g) => g.tileId === id)?.label;
  assert.equal(label(ids.aGain), 'a sharks');
  assert.equal(label(ids.bGain), 'b sharks · Board b');
});

// The co-hosted board, so the submissions route needs no request scope (see above).
test('a tile fact files the plugin’s own credit on the tile’s board, as its submission used to', async () => {
  const reply = await facts([
    { k: 'tile', t: ids.cGain, n: 12 },
    { k: 'tile', t: ids.xKill, n: 1 }, // a board the character is not on: not in its config
    { k: 'tile', t: ids.aDrop, n: 1 }, // a drop tile is the site's to match, not the plugin's to name
  ]);
  assert.deepEqual(reply.credits.map((c) => [c.t, c.kind, c.label, c.have, c.of, c.ok]), [[ids.cGain, 'tile', 'c sharks · Board c', 12, 100, true]]);
  assert.deepEqual(reply.notes, [], 'a count-only ping says nothing');
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(s.submissions).where(eq(s.submissions.tileId, ids.cGain));
  assert.deepEqual(rows.map((r) => [r.teamId, r.playerId, r.amount, r.imageUrl, r.note]), [[ids.cTeam, ids.cPlayer, 12, null, '[Auto] c sharks · Board c gain(s) counted by RuneLite plugin']]);
  const drops = await db.select().from(s.submissions).where(eq(s.submissions.tileId, ids.aDrop));
  assert.equal(drops.length, 0);
});

// ── Every live board, fully tracked ──────────────────────────────────────────────────────────────
// The rule table, the completions and the stat progress lines cover every board the character is on,
// in one config and one rules fetch.

async function rules() {
  const { GET } = await import('../src/app/api/plugin/rules/route.ts');
  const res = await GET(new Request('https://example.test/api/plugin/rules', { headers: headers('alpha', { 'X-Anvil-Boards': '1' }) }));
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()) as { drops: Record<string, { t: number; label: string }[]>; kills: Record<string, { t: number }[]>; stats: { t: number; label: string }[] };
}

test('one rules fetch carries every live board’s rules; another board’s line names it', async () => {
  const t = await rules();
  assert.deepEqual(t.drops['4151'].map((r) => r.t), [ids.aDrop, ids.bDrop, ids.cDrop], 'one item, a rule per board');
  assert.deepEqual(t.drops['4151'].map((r) => r.label), ['a drop', 'b drop · Board b', 'c drop · Board c']);
  assert.deepEqual(t.kills.zulrah.map((r) => r.t).sort((x, y) => x - y), [ids.aKill, ids.bKill, ids.cKill].sort((x, y) => x - y));
});

test('another board’s completions and stat tiles are folded in, tagged and named', async () => {
  const { db, schema: s } = await loadDb();
  ids.bStat = (await db.insert(s.tiles).values({ eventId: ids.bEvent, position: 4, label: 'b fishing', tileType: 'stat', statType: 'skill', trackedStat: 'fishing', statGoal: 100000 }).returning())[0].id;
  await db.insert(s.completions).values({ teamId: ids.bTeam, tileId: ids.bGain });
  const cfg = (await config({ 'X-Anvil-Boards': '1' })) as unknown as {
    completedTiles: { tileId: number; label: string; board?: { eventId: number } }[];
    trackedStats: { tileId: number; board?: { eventId: number } }[];
    tiles: { t: number }[];
  };
  const done = cfg.completedTiles.find((c) => c.tileId === ids.bGain);
  assert.ok(done, 'board b’s completion is in the one config');
  assert.equal(done!.board?.eventId, ids.bEvent);
  assert.equal(done!.label, 'b sharks · Board b');
  assert.ok(cfg.trackedStats.some((r) => r.tileId === ids.bStat && r.board?.eventId === ids.bEvent));
  const t = await rules();
  assert.ok(t.stats.some((r) => r.t === ids.bStat && r.label === 'b fishing · Board b'), 'its xp line is in the rule table');
});

test('one loot fact matches the drop on every board that tracks it', async () => {
  // One fact from the plugin; the site fans it out. (A drop's submission waits for its screenshot,
  // so without one each credit is held to retry: the matching is what is under test.)
  const reply = await facts([{ k: 'loot', src: 'Abyssal demon', kind: 'npc', items: [[4151, 1]] }]);
  assert.deepEqual(reply.credits.filter((c) => c.kind === 'drop').map((c) => c.t), [ids.aDrop, ids.bDrop, ids.cDrop]);
});

test('a tile pinned from another clan’s board polls its progress through the addressed clan', async () => {
  const route = await import('../src/app/api/plugin/event/[id]/tile/[tileId]/progress/route.ts');
  const get = (eventId: number, tileId: number) =>
    route.GET(new Request(`https://example.test/api/plugin/event/${eventId}/tile/${tileId}/progress`, { headers: headers('alpha') }), {
      params: Promise.resolve({ id: String(eventId), tileId: String(tileId) }),
    });
  const res = await get(ids.bEvent, ids.bKill);
  assert.equal(res.status, 200, await res.clone().text());
  const body = (await res.json()) as { teams: { teamId: number; mine?: boolean }[] };
  assert.ok(body.teams.some((t) => t.teamId === ids.bTeam && t.mine), 'its own team marked');
  assert.equal((await get(ids.sEvent, ids.sKill)).status, 404, 'a suspended clan’s board stays hidden, seat or not');
});
