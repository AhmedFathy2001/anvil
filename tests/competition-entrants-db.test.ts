// Cross-clan participation is always accepted, never "add means add" (lib/competitionTeamsDb,
// lib/clanBlocks): an invite enters nobody until the invited clan's owner/admin accepts; on accept
// its side is all members or the people it picks; any player can opt out of one competition; any
// number of clans can race; private clans stay private; blocked clans are refused silently; the
// invite rate limit holds.
//
// Run: npx tsx --test tests/competition-entrants-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('competition-entrants');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let T: typeof import('../src/lib/competitionTeamsDb.ts');
let B: typeof import('../src/lib/clanBlocks.ts');
let C: typeof import('../src/lib/coHost.ts');
let enrollAllPlayers: typeof import('../src/lib/weekly.ts')['enrollAllPlayers'];
let getEffectiveParticipants: typeof import('../src/lib/weekly.ts')['getEffectiveParticipants'];

const clan: Record<string, number> = {};
const admin: Record<string, number> = {};
const player: Record<string, number> = {}; // rsn -> players.id
let guestMod: number;

async function seat(clanId: number, names: string[]) {
  for (const n of names) {
    const [p] = await db.insert(s.players).values({ displayName: n }).returning({ id: s.players.id });
    player[n] = p.id;
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: n, rsnNormalized: n.toLowerCase() }).returning({ id: s.accounts.id });
    await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' });
  }
}

async function comp(hostClan: number, title: string, extra: Record<string, unknown> = {}) {
  const [c] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: hostClan,
      type: 'skill',
      metric: 'attack',
      title,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T00:00:00.000Z',
      status: 'active',
      mode: 'clans',
      ...extra,
    })
    .returning();
  return c;
}

const rsnsOf = async (competitionId: number, clanId?: number) =>
  (
    await db
      .select({ rsn: s.weeklyParticipants.rsn })
      .from(s.weeklyParticipants)
      .where(and(eq(s.weeklyParticipants.competitionId, competitionId), clanId ? eq(s.weeklyParticipants.clanId, clanId) : undefined))
  )
    .map((r) => r.rsn)
    .sort();

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  T = await import('../src/lib/competitionTeamsDb.ts');
  B = await import('../src/lib/clanBlocks.ts');
  C = await import('../src/lib/coHost.ts');
  ({ enrollAllPlayers, getEffectiveParticipants } = await import('../src/lib/weekly.ts'));

  for (const slug of ['host', 'guest', 'third', 'fourth', 'spammer']) {
    const [c] = await db.insert(s.clans).values({ slug, name: `${slug[0].toUpperCase()}${slug.slice(1)} Clan` }).returning({ id: s.clans.id });
    clan[slug] = c.id;
    const [u] = await db.insert(s.users).values({ displayName: `${slug} admin` }).returning({ id: s.users.id });
    admin[slug] = u.id;
    await db.insert(s.clanStaff).values({ clanId: c.id, userId: u.id, role: slug === 'host' ? 'owner' : 'admin' });
  }
  const [m] = await db.insert(s.users).values({ displayName: 'guest mod' }).returning({ id: s.users.id });
  guestMod = m.id;
  await db.insert(s.clanStaff).values({ clanId: clan.guest, userId: guestMod, role: 'moderator' });

  await seat(clan.host, ['Hana', 'Hugo']);
  await seat(clan.guest, ['Gwen', 'Gus', 'Gil']);
  await seat(clan.third, ['Tia']);
  await seat(clan.fourth, ['Fay', 'Finn']);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('an unaccepted invite enters nobody; a moderator cannot accept', async () => {
  const c = await comp(clan.host, 'Pending war');
  const inv = await T.inviteClanToCompetition(c, clan.host, 'guest', admin.host);
  assert.ok(inv.ok);
  await enrollAllPlayers(c.id);
  assert.deepEqual(await rsnsOf(c.id, clan.guest), [], 'pending invite: no guest players');
  assert.equal((await T.respondToCompetitionInvite(inv.id, guestMod, 'accept')).ok, false);
  await enrollAllPlayers(c.id);
  assert.deepEqual(await rsnsOf(c.id, clan.guest), []);
});

test('accept with selected people enters exactly those; changing later prunes and adds', async () => {
  const c = await comp(clan.host, 'Picked war');
  const inv = await T.inviteClanToCompetition(c, clan.host, 'guest', admin.host);
  assert.ok(inv.ok);
  const r = await T.respondToCompetitionInvite(inv.id, admin.guest, 'accept', { entrants: 'selected', rsns: ['Gwen', 'Nobody'] });
  assert.ok(r.ok);
  assert.deepEqual(r.unknown, ['Nobody']);
  await enrollAllPlayers(c.id); // the sweep must not top a 'selected' side up
  assert.deepEqual(await rsnsOf(c.id, clan.guest), ['Gwen']);

  // Only that clan's admin may change it.
  assert.equal((await T.setPartnerEntrants(inv.id, guestMod, { entrants: 'all' })).ok, false);
  assert.equal((await T.setPartnerEntrants(inv.id, admin.host, { entrants: 'all' })).ok, false);
  assert.ok((await T.setPartnerEntrants(inv.id, admin.guest, { entrants: 'selected', rsns: ['Gus', 'Gil'] })).ok);
  assert.deepEqual(await rsnsOf(c.id, clan.guest), ['Gil', 'Gus']);
  assert.ok((await T.setPartnerEntrants(inv.id, admin.guest, { entrants: 'all' })).ok);
  assert.deepEqual(await rsnsOf(c.id, clan.guest), ['Gil', 'Gus', 'Gwen']);
});

test('all members are entered on accept; a player opts out and back in', async () => {
  const c = await comp(clan.host, 'All war');
  const inv = await T.inviteClanToCompetition(c, clan.host, 'guest', admin.host);
  assert.ok(inv.ok);
  assert.ok((await T.respondToCompetitionInvite(inv.id, admin.guest, 'accept')).ok);
  await enrollAllPlayers(c.id);
  assert.deepEqual(await rsnsOf(c.id), ['Gil', 'Gus', 'Gwen', 'Hana', 'Hugo']);

  assert.deepEqual(await T.entryStatus(c.id, { playerId: player.Gus }), { entered: true, optedOut: false });
  assert.ok((await T.setOptOut(c.id, { playerId: player.Gus }, true)).ok);
  await enrollAllPlayers(c.id); // the sweep must not put them back
  const counting = (await getEffectiveParticipants(c.id)).map((p) => p.rsn).sort();
  assert.deepEqual(counting, ['Gil', 'Gwen', 'Hana', 'Hugo'], 'opted out: off the board');
  const view = (await T.buildGroupStandings(c))!;
  assert.equal(view.groups.find((g) => g.key === clan.guest)!.members, 2);
  assert.deepEqual(await T.entryStatus(c.id, { playerId: player.Gus }), { entered: true, optedOut: true });

  assert.ok((await T.setOptOut(c.id, { playerId: player.Gus }, false)).ok);
  assert.equal((await getEffectiveParticipants(c.id)).length, 5);
  // Someone not entered can't opt anything.
  assert.equal((await T.setOptOut(c.id, { playerId: player.Tia }, true)).ok, false);
});

test("the host's own side can be 'selected' too", async () => {
  const c = await comp(clan.host, 'Host picks', { mode: 'solo', hostEntrants: 'selected' });
  await enrollAllPlayers(c.id);
  assert.deepEqual(await rsnsOf(c.id), [], 'no roster sweep for a selected host side');
});

test('four clans race; each sees its own side; the cap is a named constant', async () => {
  const c = await comp(clan.host, 'Four-way');
  for (const slug of ['guest', 'third', 'fourth']) {
    const inv = await T.inviteClanToCompetition(c, clan.host, slug, admin.host);
    assert.ok(inv.ok);
    assert.ok((await T.respondToCompetitionInvite(inv.id, admin[slug], 'accept')).ok);
  }
  await enrollAllPlayers(c.id);
  const set = async (rsn: string, gain: number) =>
    db
      .update(s.weeklyParticipants)
      .set({ baselineValue: 0, currentValue: gain, gainAt: '2026-11-02T00:00:00Z' })
      .where(and(eq(s.weeklyParticipants.competitionId, c.id), eq(s.weeklyParticipants.rsnNormalized, rsn.toLowerCase())));
  await set('Hana', 100);
  await set('Gwen', 50);
  await set('Tia', 400);
  await set('Fay', 300);
  await set('Finn', 300);

  const view = (await T.buildGroupStandings(c, { memberIds: [] , rsn: 'Finn' }))!;
  assert.deepEqual(view.groups.map((g) => [g.name, g.total, g.members]), [
    ['Fourth Clan', 600, 2],
    ['Third Clan', 400, 1],
    ['Host Clan', 100, 2],
    ['Guest Clan', 50, 3],
  ]);
  assert.equal(view.groups[0].isYours, true);
  assert.equal((await T.racingClans(c)).length, 4);
  for (const slug of ['guest', 'third', 'fourth']) assert.ok(await T.competitionForClan(clan[slug], c.id));
  assert.equal(T.MAX_RACING_CLANS, 50);
});

test('a clan-vs-clan board is readable only when every racing clan lets the viewer in', async () => {
  const c = await comp(clan.host, 'Privacy');
  const inv = await T.inviteClanToCompetition(c, clan.host, 'third', admin.host);
  assert.ok(inv.ok);
  await T.respondToCompetitionInvite(inv.id, admin.third, 'accept');
  assert.equal(await T.competitionReadableBy(c, { playerId: null, userId: null }), true, 'both public');

  await db.update(s.clans).set({ visibility: 'members' }).where(eq(s.clans.id, clan.host));
  assert.equal(await T.competitionReadableBy(c, { playerId: null, userId: null }), false, 'stranger: host private');
  assert.equal(await T.competitionReadableBy(c, { playerId: player.Tia, userId: null }), false, 'partner member: host private');
  assert.equal(await T.competitionReadableBy(c, { playerId: player.Hana, userId: null }), true, 'host member; partner public');
  await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clan.host));
});

test('blocking: a blocked clan\'s invite reaches nobody; unblock restores; owner/admin only', async () => {
  // Only an owner/admin of the blocking clan may block or unblock.
  assert.equal(await B.blockClanAsUser(clan.guest, clan.spammer, guestMod), false);
  assert.equal(await B.blockClanAsUser(clan.guest, clan.spammer, admin.host), false);
  assert.ok(await B.blockClanAsUser(clan.guest, clan.spammer, admin.guest));
  assert.deepEqual((await B.listBlockedClans(clan.guest)).map((b) => b.slug), ['spammer']);
  // Reading the list is gated too (GET /api/admin/clan-blocks answers 403 on null).
  assert.equal(await B.listBlockedClansAsUser(clan.guest, guestMod), null, 'moderator cannot read it');
  assert.equal(await B.listBlockedClansAsUser(clan.guest, admin.host), null, 'another clan cannot read it');
  assert.deepEqual((await B.listBlockedClansAsUser(clan.guest, admin.guest))!.map((b) => b.slug), ['spammer']);
  assert.equal(await B.isAdminOf(clan.guest, guestMod), false);

  const c = await comp(clan.spammer, 'Spam war');
  const inv = await T.inviteClanToCompetition(c, clan.spammer, 'guest', admin.spammer);
  assert.ok(inv.ok, 'the sender is not told');
  const [row] = await db.select().from(s.weeklyCompetitionClans).where(eq(s.weeklyCompetitionClans.id, inv.id));
  assert.equal(row.status, 'declined', 'the sender sees it declined');
  assert.equal((await T.competitionInvitesForClan(clan.guest)).some((i) => i.competitionId === c.id), false, 'the blocker sees nothing');

  // Co-host invites from the same clan go the same way.
  const [ev] = await db.insert(s.events).values({ clanId: clan.spammer, name: 'Spam bingo', boardSize: 25 }).returning({ id: s.events.id });
  const co = await C.inviteCoHost(ev.id, clan.guest, admin.spammer);
  assert.equal(co.refused, undefined);
  const [coRow] = await db.select().from(s.eventCohosts).where(eq(s.eventCohosts.id, co.id));
  assert.equal(coRow.status, 'declined');
  assert.equal((await C.pendingCoHostInvites(clan.guest)).length, 0);

  // The blocker can't invite the clan it blocked.
  const mine = await comp(clan.guest, 'Guest war');
  const back = await T.inviteClanToCompetition(mine, clan.guest, 'spammer', admin.guest);
  assert.equal(back.ok, false);

  // Unblock: invites work again.
  assert.equal(await B.unblockClan(clan.guest, clan.spammer, guestMod), false);
  assert.ok(await B.unblockClan(clan.guest, clan.spammer, admin.guest));
  const again = await T.inviteClanToCompetition(c, clan.spammer, 'guest', admin.spammer);
  assert.ok(again.ok);
  const [row2] = await db.select().from(s.weeklyCompetitionClans).where(eq(s.weeklyCompetitionClans.id, again.id));
  assert.equal(row2.status, 'pending');
  assert.equal((await T.competitionInvitesForClan(clan.guest)).some((i) => i.competitionId === c.id), true);
});

test('"Decline & block" from the invite card blocks the sender', async () => {
  const c = await comp(clan.fourth, 'Fourth hosts');
  const inv = await T.inviteClanToCompetition(c, clan.fourth, 'third', admin.fourth);
  assert.ok(inv.ok);
  assert.equal((await T.respondToCompetitionInvite(inv.id, admin.fourth, 'block')).ok, false, 'not the invited clan');
  assert.ok((await T.respondToCompetitionInvite(inv.id, admin.third, 'block')).ok);
  assert.deepEqual((await B.listBlockedClans(clan.third)).map((b) => b.slug), ['fourth']);
  await B.unblockClan(clan.third, clan.fourth, admin.third);
});

test('the invite rate limit holds per target', async () => {
  const sent = [];
  for (let i = 0; i < B.MAX_PENDING_INVITES_PER_TARGET; i++) {
    const c = await comp(clan.spammer, `Rate ${i}`);
    sent.push(await T.inviteClanToCompetition(c, clan.spammer, 'fourth', admin.spammer));
  }
  assert.ok(sent.every((r) => r.ok));
  const extra = await comp(clan.spammer, 'Rate over');
  const over = await T.inviteClanToCompetition(extra, clan.spammer, 'fourth', admin.spammer);
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.status, 429);
  assert.equal((await T.competitionInvitesForClan(clan.fourth)).filter((i) => i.status === 'pending').length, B.MAX_PENDING_INVITES_PER_TARGET);
});

test('a captain seated only in a clan that is not in the event is never entered on the board', async () => {
  const { placeCaptainOnTeam } = await import('../src/lib/teamCaptain.ts');
  const [ev] = await db.insert(s.events).values({ clanId: clan.host, name: 'Host bingo', boardSize: 25 }).returning({ id: s.events.id });
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#f80', captainPassword: 'x' }).returning({ id: s.teams.id });
  // Tia sits only in Third Clan, which has not co-hosted (or even been invited to) this event.
  const [u] = await db.insert(s.users).values({ displayName: 'Tia', playerId: player.Tia }).returning({ id: s.users.id });
  const r = await placeCaptainOnTeam(ev.id, team.id, u.id);
  assert.equal(r.playerId, null);
  const rows = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, ev.id));
  assert.equal(rows.length, 0);

  // Once Third Clan accepts a co-host seat, the same captain can be placed.
  const inv = await C.inviteCoHost(ev.id, clan.third, admin.host);
  assert.ok((await C.acceptCoHostInvite(inv.id, admin.third)).ok);
  const r2 = await placeCaptainOnTeam(ev.id, team.id, u.id);
  assert.ok(r2.playerId != null);
});

test("events list: a foreign clan-vs-clan card hides its leader unless the viewer can read every racing clan", async () => {
  const { loadWeeklyCards } = await import('../src/lib/weeklyCards.ts');
  const c = await comp(clan.fourth, 'Card privacy');
  const inv = await T.inviteClanToCompetition(c, clan.fourth, 'third', admin.fourth);
  assert.ok(inv.ok);
  await T.respondToCompetitionInvite(inv.id, admin.third, 'accept');
  await enrollAllPlayers(c.id);
  await db
    .update(s.weeklyParticipants)
    .set({ baselineValue: 0, currentValue: 999, gainAt: '2026-11-03T00:00:00Z' })
    .where(and(eq(s.weeklyParticipants.competitionId, c.id), eq(s.weeklyParticipants.rsnNormalized, 'fay')));
  await db.update(s.clans).set({ visibility: 'members' }).where(eq(s.clans.id, clan.fourth));
  try {
    const card = async (viewer: { playerId: number | null; userId: number | null } | null) =>
      (await loadWeeklyCards(clan.third, { viewer })).find((w) => w.id === c.id)!;
    const stranger = await card(null);
    assert.ok(stranger, 'listed for the partner clan, hosted by the other clan');
    assert.equal(stranger.hostSlug, 'fourth');
    assert.equal(stranger.top, null, 'leader hidden: the host is private');
    assert.equal(stranger.entrants, 0);
    assert.equal((await card({ playerId: player.Tia, userId: null })).top, null, 'partner member who cannot see the host');
    const insider = await card({ playerId: player.Fay, userId: null });
    assert.equal(insider.top?.rsn, 'Fay', 'a host member sees it (the partner is public)');

    // The HOST's own card follows the same rule: with the partner private, a host-only viewer can't
    // read the board, so the host's events list hides its leader too.
    await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clan.fourth));
    await db.update(s.clans).set({ visibility: 'members' }).where(eq(s.clans.id, clan.third));
    const hostCard = async (viewer: { playerId: number | null; userId: number | null } | null) =>
      (await loadWeeklyCards(clan.fourth, { viewer })).find((w) => w.id === c.id)!;
    assert.equal((await hostCard(null)).top, null, 'host list, stranger: partner private');
    assert.equal((await hostCard({ playerId: player.Fay, userId: null })).top, null, 'host member who cannot see the partner');
    assert.equal((await hostCard({ playerId: player.Tia, userId: null })).top?.rsn, 'Fay', 'a partner member sees both clans: shown');
    await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clan.third));
    assert.equal((await hostCard(null)).top?.rsn, 'Fay', 'both public: shown');
  } finally {
    await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clan.fourth));
    await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clan.third));
  }
});
