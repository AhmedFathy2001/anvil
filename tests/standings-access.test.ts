// Who sees through the standings curtain (lib/standingsAccess), against a real database: staff of
// the host clan and of the board, platform staff, a player on a team (by character, captaincy or a
// team-staff seat), and everybody else.
//
// Run: npm run test:standingsaccess   (needs TEST_DATABASE_URL, default the local dev container)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('standings-access');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/standingsAccess.ts');
let V: typeof import('../src/lib/standingsVisibility.ts');

let event: { id: number; clanId: number; rules: string; endDate: string; forceEndedAt: null };
let teamRed: number;
let teamBlue: number;
const users: Record<string, { userId: number; playerId: number }> = {};

before(async () => {
  await resetDatabase(DB);
  let db: Awaited<ReturnType<typeof loadDb>>['db'];
  let s: Awaited<ReturnType<typeof loadDb>>['schema'];
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/standingsAccess.ts');
  V = await import('../src/lib/standingsVisibility.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const endDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const rules = JSON.stringify({ standings: { visibility: 'at-end', revealAt: null } });
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Hidden', boardSize: 25, rules, endDate }).returning();
  event = { id: ev.id, clanId: clan.id, rules, endDate, forceEndedAt: null };
  [{ id: teamRed }] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#ff0000' }).returning();
  [{ id: teamBlue }] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Blue', color: '#0000ff' }).returning();

  const person = async (name: string, platformRole = 'none') => {
    const [p] = await db.insert(s.players).values({ displayName: name }).returning();
    const [u] = await db.insert(s.users).values({ displayName: name, playerId: p.id, platformRole }).returning();
    users[name] = { userId: u.id, playerId: p.id };
    return { p, u };
  };

  // A player on Red, seated by their character.
  const { p: redPlayer } = await person('redPlayer');
  const [acc] = await db.insert(s.accounts).values({ playerId: redPlayer.id, rsn: 'Redder', rsnNormalized: 'redder' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acc.id, kind: 'member' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ev.id, name: 'Redder', teamId: teamRed, clanMemberId: seat.id, accountId: acc.id });

  // Blue's captain (no character on the board) and a team-staff seat on Blue.
  const { u: captain } = await person('blueCaptain');
  await db.update(s.teams).set({ captainUserId: captain.id }).where(eq(s.teams.id, teamBlue));
  const { u: blueStaff } = await person('blueStaff');
  await db.insert(s.teamStaff).values({ teamId: teamBlue, userId: blueStaff.id });

  // Staff of several kinds, and an outsider.
  const { u: mod } = await person('clanMod');
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: mod.id, role: 'moderator' });
  const { u: boardTreasurer } = await person('boardOnlyTreasurer');
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: boardTreasurer.id, role: 'treasurer', treasurerScope: 'assigned' });
  const { u: editor } = await person('boardEditor');
  await db.insert(s.eventEditors).values({ eventId: ev.id, userId: editor.id, role: 'editor' });
  await person('platformStaff', 'staff');
  await person('outsider');
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

test('host-clan moderators, board grants and platform staff are standings staff', async () => {
  assert.equal(await A.isStandingsStaff(event, users.clanMod.userId), true);
  assert.equal(await A.isStandingsStaff(event, users.boardEditor.userId), true);
  assert.equal(await A.isStandingsStaff(event, users.platformStaff.userId), true);
});

test('players, captains, team staff, a treasurer of other boards only, and outsiders are not staff', async () => {
  for (const who of ['redPlayer', 'blueCaptain', 'blueStaff', 'boardOnlyTreasurer', 'outsider']) {
    assert.equal(await A.isStandingsStaff(event, users[who].userId), false, who);
  }
});

test('own teams: by character, by captaincy, by team-staff seat; none for an outsider', async () => {
  assert.deepEqual(await A.viewerTeamIds(event.id, users.redPlayer), [teamRed]);
  assert.deepEqual(await A.viewerTeamIds(event.id, users.blueCaptain), [teamBlue]);
  assert.deepEqual(await A.viewerTeamIds(event.id, users.blueStaff), [teamBlue]);
  assert.deepEqual(await A.viewerTeamIds(event.id, users.outsider), []);
});

test('the plugin scope: a member sees their own team only, staff see all, the public none', async () => {
  const red = await A.standingsScopeForPlugin(event, { userId: users.redPlayer.userId, teamId: teamRed });
  assert.equal(red.hidden, true);
  assert.equal(V.canSeeTeamProgress(red, teamRed), true);
  assert.equal(V.canSeeTeamProgress(red, teamBlue), false);

  // An alt with no seat here still resolves its person's team.
  const viaPerson = await A.standingsScopeForPlugin(event, { userId: users.redPlayer.userId, teamId: null });
  assert.equal(V.canSeeTeamProgress(viaPerson, teamRed), true);

  assert.deepEqual(await A.standingsScopeForPlugin(event, { userId: users.clanMod.userId, teamId: null }), { hidden: false });
  const pub = await A.standingsScopeForPlugin(event, { userId: null, teamId: null });
  assert.equal(pub.hidden && pub.ownTeamIds.size, 0);
});

test('a lifted curtain (or a live board) costs no lookup and hides nothing', async () => {
  const ended = { ...event, endDate: new Date(Date.now() - 1000).toISOString() };
  assert.deepEqual(await A.standingsScopeForPlugin(ended, { userId: users.outsider.userId, teamId: null }), { hidden: false });
  const live = { ...event, rules: JSON.stringify({}) };
  assert.deepEqual(await A.standingsScopeForPlugin(live, { userId: null, teamId: null }), { hidden: false });
});

test('the reveal tick: marks a hidden board, then claims the reveal exactly once when it lifts', async () => {
  const R = await import('../src/lib/standingsReveal.ts');
  const { db, schema: s } = await loadDb();
  const { and, eq: eqq } = await import('drizzle-orm');
  const [ev] = await db
    .insert(s.events)
    .values({
      clanId: event.clanId,
      name: 'Reveal me',
      boardSize: 25,
      rules: JSON.stringify({ standings: { visibility: 'at-date', revealAt: new Date(Date.now() + 3_600_000).toISOString() } }),
      startDate: new Date(Date.now() - 86_400_000).toISOString(),
      endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .returning();
  const marker = () =>
    db.query.settings.findFirst({ where: and(eqq(s.settings.clanId, event.clanId), eqq(s.settings.key, `standings_curtain:${ev.id}`)) });

  await R.runStandingsReveals();
  assert.ok(await marker(), 'a curtain that is down leaves a marker');

  // Two hours later the date has passed: the marker is claimed (deleted) by one tick only.
  await R.runStandingsReveals(Date.now() + 2 * 3_600_000);
  assert.equal(await marker(), undefined);
  await R.runStandingsReveals(Date.now() + 2 * 3_600_000);
  assert.equal(await marker(), undefined);

  // Switched back to live mid-event by the host: the marker goes too (the "rule changed" case).
  await db.update(s.events).set({ rules: JSON.stringify({ standings: { visibility: 'at-end' } }) }).where(eqq(s.events.id, ev.id));
  await R.runStandingsReveals();
  assert.ok(await marker());
  await db.update(s.events).set({ rules: null }).where(eqq(s.events.id, ev.id));
  await R.runStandingsReveals();
  assert.equal(await marker(), undefined);
});
