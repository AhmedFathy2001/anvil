// Team competitions against a real database (lib/competitionTeamsDb): team totals, clan-vs-clan
// totals, invites (only an owner/admin of the invited clan may accept) and tenant isolation (a clan
// sees and edits only its own competition data, plus what clan-vs-clan shares — read-only).
//
// Run: npx tsx --test tests/competition-teams-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('competition-teams');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let T: typeof import('../src/lib/competitionTeamsDb.ts');
let enrollAllPlayers: typeof import('../src/lib/weekly.ts')['enrollAllPlayers'];

let hostClan: number;
let guestClan: number;
let strangerClan: number;
let hostOwner: number;
let guestAdmin: number;
let guestMod: number;
let strangerAdmin: number;

async function seatMembers(clanId: number, names: string[]) {
  const people = await db.insert(s.players).values(names.map((n) => ({ displayName: n }))).returning({ id: s.players.id });
  const accts = await db
    .insert(s.accounts)
    .values(names.map((rsn, i) => ({ playerId: people[i].id, rsn, rsnNormalized: rsn.toLowerCase() })))
    .returning({ id: s.accounts.id, rsn: s.accounts.rsn });
  await db.insert(s.clanMemberships).values(
    accts.map((a) => ({ clanId, accountId: a.id, rsn: a.rsn, rsnNormalized: a.rsn.toLowerCase(), status: 'active', kind: 'member' })),
  );
}

async function mkComp(clanId: number, mode: string, title: string) {
  const [c] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'skill',
      metric: 'attack',
      title,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T00:00:00.000Z',
      status: 'active',
      mode,
    })
    .returning();
  return c;
}

async function setGain(competitionId: number, rsn: string, baseline: number, current: number, gainAt: string | null) {
  await db
    .update(s.weeklyParticipants)
    .set({ baselineValue: baseline, currentValue: current, gainAt })
    .where(and(eq(s.weeklyParticipants.competitionId, competitionId), eq(s.weeklyParticipants.rsnNormalized, rsn.toLowerCase())));
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  T = await import('../src/lib/competitionTeamsDb.ts');
  ({ enrollAllPlayers } = await import('../src/lib/weekly.ts'));

  const [h, g, x] = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host Clan' },
      { slug: 'guest', name: 'Guest Clan' },
      { slug: 'stranger', name: 'Stranger Clan' },
    ])
    .returning({ id: s.clans.id });
  hostClan = h.id;
  guestClan = g.id;
  strangerClan = x.id;

  const mkUser = async (name: string) => (await db.insert(s.users).values({ displayName: name }).returning())[0].id;
  hostOwner = await mkUser('Host Owner');
  guestAdmin = await mkUser('Guest Admin');
  guestMod = await mkUser('Guest Mod');
  strangerAdmin = await mkUser('Stranger Admin');
  await db.insert(s.clanStaff).values([
    { clanId: hostClan, userId: hostOwner, role: 'owner' },
    { clanId: guestClan, userId: guestAdmin, role: 'admin' },
    { clanId: guestClan, userId: guestMod, role: 'moderator' },
    { clanId: strangerClan, userId: strangerAdmin, role: 'admin' },
  ]);

  await seatMembers(hostClan, ['Hana', 'Hugo', 'Hector', 'Hiro']);
  await seatMembers(guestClan, ['Gwen', 'Gus']);
  await seatMembers(strangerClan, ['Xena']);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('teams: late joiners fill the smallest team; team totals and averages', async () => {
  const comp = await mkComp(hostClan, 'teams', 'Team SOTW');
  const red = await T.createTeam(comp.id, 'Red');
  const blue = await T.createTeam(comp.id, 'Blue');
  assert.ok(red.ok && blue.ok);

  // Enrolment places everyone (late-join on by default): 4 players over 2 teams = 2 + 2.
  await enrollAllPlayers(comp.id);
  const parts = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, comp.id));
  assert.equal(parts.length, 4, 'only the host roster');
  assert.ok(parts.every((p) => p.teamId != null));
  const sizes = [red.team.id, blue.team.id].map((id) => parts.filter((p) => p.teamId === id).length);
  assert.deepEqual(sizes, [2, 2]);

  // Pin the teams explicitly: Red = Hana + Hugo, Blue = Hector + Hiro.
  const id = (rsn: string) => parts.find((p) => p.rsn === rsn)!.id;
  await T.assignParticipants(comp.id, [
    { participantId: id('Hana'), teamId: red.team.id },
    { participantId: id('Hugo'), teamId: red.team.id },
    { participantId: id('Hector'), teamId: blue.team.id },
    { participantId: id('Hiro'), teamId: blue.team.id },
  ]);
  await setGain(comp.id, 'Hana', 1000, 1600, '2026-11-02T10:00:00Z');
  await setGain(comp.id, 'Hugo', 1000, 1200, '2026-11-03T10:00:00Z');
  await setGain(comp.id, 'Hector', 1000, 1800, '2026-11-02T08:00:00Z');
  await setGain(comp.id, 'Hiro', 1000, 1000, null);

  const view = await T.buildGroupStandings(comp, { rsn: 'hiro' });
  assert.ok(view);
  assert.equal(view.mode, 'teams');
  // 800 vs 800 — Blue reached it first (11-02 08:00 vs Red's 11-03 10:00).
  assert.deepEqual(view.groups.map((g) => [g.name, g.total, g.average, g.members]), [['Blue', 800, 400, 2], ['Red', 800, 400, 2]]);
  assert.equal(view.groups[0].isYours, true, 'Hiro is on Blue');
  assert.equal(view.yourGroupKey, blue.team.id);
  assert.deepEqual(view.groups[1].entries.map((e) => e.rsn), ['Hana', 'Hugo']);

  // Unassigned players count for no team and show separately.
  await T.assignParticipants(comp.id, [{ participantId: id('Hugo'), teamId: null }]);
  await db.update(s.weeklyCompetitions).set({ teamLateJoin: false }).where(eq(s.weeklyCompetitions.id, comp.id));
  await enrollAllPlayers(comp.id); // late-join off → Hugo stays unassigned
  const v2 = (await T.buildGroupStandings(comp))!;
  assert.equal(v2.groups.find((g) => g.name === 'Red')!.total, 600);
  assert.deepEqual(v2.unassigned.map((e) => e.rsn), ['Hugo']);

  // Auto-balance re-splits everyone evenly.
  const bal = await T.autoBalanceTeams(comp);
  assert.ok(bal.ok);
  assert.equal(bal.assigned, 4);
  const after = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, comp.id));
  assert.deepEqual([red.team.id, blue.team.id].map((t) => after.filter((p) => p.teamId === t).length), [2, 2]);
});

test('teams: ids from another competition are never touched', async () => {
  const a = await mkComp(hostClan, 'teams', 'A');
  const b = await mkComp(strangerClan, 'teams', 'B');
  const ta = await T.createTeam(a.id, 'A team');
  const tb = await T.createTeam(b.id, 'B team');
  assert.ok(ta.ok && tb.ok);
  await enrollAllPlayers(b.id);
  const [xena] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, b.id));
  // Through competition A: B's team and B's participant are both out of reach.
  assert.equal(await T.updateTeam(a.id, tb.team.id, { name: 'hijacked' }), 0);
  assert.equal(await T.deleteTeam(a.id, tb.team.id), 0);
  assert.equal(await T.assignParticipants(a.id, [{ participantId: xena.id, teamId: ta.team.id }]), 0);
  assert.equal(await T.assignParticipants(a.id, [{ participantId: xena.id, teamId: null }]), 0);
  const [still] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.id, xena.id));
  assert.equal(still.teamId, tb.team.id);
  const [tbRow] = await db.select().from(s.weeklyCompetitionTeams).where(eq(s.weeklyCompetitionTeams.id, tb.team.id));
  assert.equal(tbRow.name, 'B team');
});

test('clans: invite by slug, only an owner/admin of the invited clan accepts, clan totals', async () => {
  const comp = await mkComp(hostClan, 'clans', 'Clan war SOTW');
  await enrollAllPlayers(comp.id);

  assert.equal((await T.inviteClanToCompetition(comp, hostClan, 'host', hostOwner)).ok, false, 'no self-invite');
  assert.equal((await T.inviteClanToCompetition(comp, hostClan, 'nope', hostOwner)).ok, false);
  // Only the owning clan can invite into it.
  assert.equal((await T.inviteClanToCompetition(comp, strangerClan, 'guest', strangerAdmin)).ok, false);

  const inv = await T.inviteClanToCompetition(comp, hostClan, 'guest', hostOwner);
  assert.ok(inv.ok);
  const pending = await T.competitionInvitesForClan(guestClan);
  assert.deepEqual(pending.map((p) => [p.id, p.status, p.hostSlug]), [[inv.id, 'pending', 'host']]);

  // Before accepting, the guest clan can't see the competition at all.
  assert.equal(await T.competitionForClan(guestClan, comp.id), null);

  // A moderator of the guest clan, an admin of a third clan, and the host's own owner: all refused.
  assert.equal((await T.respondToCompetitionInvite(inv.id, guestMod, 'accept')).ok, false);
  assert.equal((await T.respondToCompetitionInvite(inv.id, strangerAdmin, 'accept')).ok, false);
  assert.equal((await T.respondToCompetitionInvite(inv.id, hostOwner, 'accept')).ok, false);
  const [stillPending] = await db.select().from(s.weeklyCompetitionClans).where(eq(s.weeklyCompetitionClans.id, inv.id));
  assert.equal(stillPending.status, 'pending');

  const ok = await T.respondToCompetitionInvite(inv.id, guestAdmin, 'accept');
  assert.ok(ok.ok);
  // Accepting enrols the guest roster, tagged with its clan; the stranger clan stays out.
  const parts = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, comp.id));
  assert.equal(parts.length, 6);
  assert.deepEqual(parts.filter((p) => p.clanId === guestClan).map((p) => p.rsn).sort(), ['Gus', 'Gwen']);
  assert.equal(parts.filter((p) => p.clanId == null).length, 4);

  await setGain(comp.id, 'Hana', 0, 100, '2026-11-02T00:00:00Z');
  await setGain(comp.id, 'Hugo', 0, 100, '2026-11-02T00:00:00Z');
  await setGain(comp.id, 'Gwen', 0, 300, '2026-11-02T00:00:00Z');
  const view = (await T.buildGroupStandings(comp, { rsn: 'Gus' }))!;
  assert.equal(view.mode, 'clans');
  assert.deepEqual(view.groups.map((g) => [g.name, g.total, g.members]), [['Guest Clan', 300, 2], ['Host Clan', 200, 4]]);
  assert.equal(view.groups[0].average, 150);
  assert.equal(view.groups[1].average, 50);
  assert.equal(view.groups[0].isYours, true);
  assert.equal(view.groups[0].slug, 'guest');
});

test('clans: decline, re-invite, remove; partner reads only', async () => {
  const comp = await mkComp(hostClan, 'clans', 'Boss war');
  const inv = await T.inviteClanToCompetition(comp, hostClan, 'guest', hostOwner);
  assert.ok(inv.ok);
  assert.equal((await T.respondToCompetitionInvite(inv.id, guestMod, 'decline')).ok, false, 'moderator cannot decline either');
  assert.ok((await T.respondToCompetitionInvite(inv.id, guestAdmin, 'decline')).ok);
  assert.equal((await T.respondToCompetitionInvite(inv.id, guestAdmin, 'accept')).ok, false, 'declined stays declined');
  // Re-inviting re-opens it.
  const again = await T.inviteClanToCompetition(comp, hostClan, 'guest', hostOwner);
  assert.ok(again.ok && again.id === inv.id);
  assert.ok((await T.respondToCompetitionInvite(inv.id, guestAdmin, 'accept')).ok);

  // The partner sees it, read-only; a third clan sees nothing.
  const seen = await T.competitionForClan(guestClan, comp.id);
  assert.ok(seen);
  assert.equal(seen.owner, false);
  assert.equal(await T.competitionForClan(strangerClan, comp.id), null);
  assert.equal((await T.competitionForClan(hostClan, comp.id))!.owner, true);
  assert.deepEqual((await T.partnerCompetitions(guestClan, 'active')).map((c) => c.id).includes(comp.id), true);

  // Only the host can remove a partner; when it does, that clan's players leave the board.
  assert.equal(await T.removeCompetitionClan(comp, guestClan, inv.id), false);
  assert.equal(await T.removeCompetitionClan(comp, hostClan, inv.id), true);
  const left = await db
    .select()
    .from(s.weeklyParticipants)
    .where(and(eq(s.weeklyParticipants.competitionId, comp.id), eq(s.weeklyParticipants.clanId, guestClan)));
  assert.equal(left.length, 0);
  assert.equal(await T.competitionForClan(guestClan, comp.id), null);
});

test('isolation: a partner of one competition cannot reach the host clan\'s other competitions', async () => {
  const war = await mkComp(hostClan, 'clans', 'Shared');
  const own = await mkComp(hostClan, 'teams', 'Host only');
  const inv = await T.inviteClanToCompetition(war, hostClan, 'guest', hostOwner);
  assert.ok(inv.ok);
  await T.respondToCompetitionInvite(inv.id, guestAdmin, 'accept');
  assert.ok(await T.competitionForClan(guestClan, war.id));
  assert.equal(await T.competitionForClan(guestClan, own.id), null);

  // A teams/solo competition can never be shared, even with a stale accepted row pointing at it.
  await db.insert(s.weeklyCompetitionClans).values({ competitionId: own.id, clanId: guestClan, status: 'accepted' });
  assert.equal(await T.competitionForClan(guestClan, own.id), null);
  // ...and inviting into a non-clans competition is refused.
  assert.equal((await T.inviteClanToCompetition(own, hostClan, 'stranger', hostOwner)).ok, false);
});

test('switching a clans competition back to solo drops partner players', async () => {
  const comp = await mkComp(hostClan, 'clans', 'Flip');
  const inv = await T.inviteClanToCompetition(comp, hostClan, 'guest', hostOwner);
  assert.ok(inv.ok);
  await T.respondToCompetitionInvite(inv.id, guestAdmin, 'accept');
  await enrollAllPlayers(comp.id);
  await T.setCompetitionMode(comp, 'solo');
  const parts = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, comp.id));
  assert.ok(parts.length === 4 && parts.every((p) => p.clanId == null));
  assert.equal(await T.buildGroupStandings({ ...comp, mode: 'solo' }), null);
});
