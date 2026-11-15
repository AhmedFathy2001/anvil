// Deleting an account, and downloading its data, against a real database.
//
// The pure half (tests/person-data-inventory.test.ts, tests/erase-rules.test.ts) checks the list and
// the rules. This checks what the list DOES: a person with a login, two characters, a seat, an event
// entry with a submission, a staff role, plugin sign-ins, goals, pictures and two bans is deleted,
// and afterwards the person is gone and the clan's records are exactly where they were.
//
// Needs the test database (tests/helpers/testDb.ts). Run: npm run test:erasedb

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('erase-person');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let erasePerson: typeof import('../src/lib/erasePerson.ts')['erasePerson'];
let exportPerson: typeof import('../src/lib/exportPerson.ts')['exportPerson'];

let clanId: number;
let otherClanId: number;
let eventId: number;
let teamId: number;
let tileId: number;

const DISCORD_ID = '223344556677889900';

const person = async (name: string) => (await db.insert(s.players).values({ displayName: name }).returning())[0].id;
const account = async (playerId: number, rsn: string, extra: Record<string, unknown> = {}) =>
  (await db.insert(s.accounts).values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), ...extra }).returning())[0].id;
const login = async (playerId: number, name: string, extra: Record<string, unknown> = {}) =>
  (await db.insert(s.users).values({ displayName: name, playerId, ...extra }).returning())[0].id;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ erasePerson } = await import('../src/lib/erasePerson.ts'));
  ({ exportPerson } = await import('../src/lib/exportPerson.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning();
  clanId = clan.id;
  const [other] = await db.insert(s.clans).values({ slug: 'iron', name: 'Iron Foundry' }).returning();
  otherClanId = other.id;
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Bingo', boardSize: 25 }).returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#f00' }).returning();
  teamId = team.id;
  const [tile] = await db.insert(s.tiles).values({ eventId, position: 0, label: 'Any pet' }).returning();
  tileId = tile.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** A full person: everything the deletion has to decide about, in one place. */
async function plantPerson(name: string, discordId: string) {
  const playerId = await person(name);
  const userId = await login(playerId, name, {
    discordId,
    discordUsername: `${name}#1`,
    email: `${name}@example.test`,
    pluginTokenHash: `hash-${name}`,
  });
  // A character on a clan's roster and in its event, and one on no clan record at all.
  const seated = await account(playerId, `${name}Main`, {
    accountHash: `acct-${name}`,
    discordId,
    claimedAt: '2026-01-01 00:00:00',
    verifiedAt: '2026-01-01 00:00:00',
    verificationMethod: 'plugin',
    isPrimary: 1,
    supporterStyle: '{"preset":"gold"}',
  });
  const loose = await account(playerId, `${name}Alt`);
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: seated }).returning();
  const [entry] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: `${name}Main`, accountId: seated, clanMemberId: seat.id, teamId, discord: `${name}#1`, timezone: 'Europe/London', playerToken: `pt-${name}` })
    .returning();
  const [submission] = await db
    .insert(s.submissions)
    .values({ tileId, teamId, playerId: entry.id, imageUrl: `https://media.example.test/c/afk/submissions/${name}.webp` })
    .returning();
  const [signup] = await db
    .insert(s.eventSignups)
    .values({ eventId, userId, clanMemberId: seat.id, profileData: '{"timezone":"Europe/London"}' })
    .returning();

  await db.insert(s.clanStaff).values({ clanId, userId, role: 'admin' });
  await db.insert(s.pluginLinks).values({ userId, tokenHash: `link-${name}` });
  await db.insert(s.profileMedia).values({ userId, avatarUrl: `https://media.example.test/avatars/${name}.webp` });
  await db.insert(s.accountMedia).values({ accountId: seated, bannerUrl: `https://media.example.test/banners/${name}.webp`, ownerPlayerId: playerId });
  await db.insert(s.playerGoals).values({ accountId: seated, kind: 'level', metric: 'attack', target: 99, createdAt: '2026-01-01' });
  await db.insert(s.userWebhooks).values({ userId, url: `https://discord.example.test/webhooks/${name}` });
  await db.insert(s.supporterSubscriptions).values({ userId, tier: 'supporter', status: 'ended', startedAt: '2026-01-01 00:00:00', gumroadSubscriptionId: `sub-${name}` });
  await db.insert(s.clanAuditLog).values({ clanId, clanMemberId: seat.id, eventType: 'claimed', actorUserId: userId, newValue: JSON.stringify({ userId, discordId }) });
  return { playerId, userId, seated, loose, seatId: seat.id, entryId: entry.id, submissionId: submission.id, signupId: signup.id };
}

test('the person goes; the clan’s roster seat and event history stay under the in-game name', async () => {
  const p = await plantPerson('Zezima', DISCORD_ID);
  // A ban still in force in another clan, and one that was lifted long ago.
  const [liveBan] = await db.insert(s.clanBans).values({ clanId: otherClanId, playerId: p.playerId, accountId: p.seated, reason: 'was rude' }).returning();
  await db.insert(s.clanBans).values({ clanId, playerId: p.playerId, reason: 'old', liftedAt: '2026-02-01 00:00:00' });
  // Somebody else, who must not be touched.
  const bystander = await plantPerson('Durial', '998877665544332211');

  const r = await erasePerson({ userId: p.userId });
  assert.ok(r.ok && !r.alreadyGone, JSON.stringify(r));
  assert.equal(r.summary.charactersKept, 1);
  assert.equal(r.summary.charactersDeleted, 1);
  assert.equal(r.summary.banRecordKept, true);

  // Removed completely.
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, p.userId))).length, 0, 'the login');
  assert.equal((await db.select().from(s.players).where(eq(s.players.id, p.playerId))).length, 0, 'the person');
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.id, p.loose))).length, 0, 'a character on no clan record');
  assert.equal((await db.select().from(s.clanStaff).where(eq(s.clanStaff.userId, p.userId))).length, 0, 'staff roles');
  assert.equal((await db.select().from(s.pluginLinks).where(eq(s.pluginLinks.userId, p.userId))).length, 0, 'plugin sign-ins');
  assert.equal((await db.select().from(s.profileMedia).where(eq(s.profileMedia.userId, p.userId))).length, 0, 'profile pictures');
  assert.equal((await db.select().from(s.accountMedia).where(eq(s.accountMedia.accountId, p.seated))).length, 0, 'character pictures');
  assert.equal((await db.select().from(s.playerGoals).where(eq(s.playerGoals.accountId, p.seated))).length, 0, 'goals');
  assert.equal((await db.select().from(s.userWebhooks).where(eq(s.userWebhooks.userId, p.userId))).length, 0, 'webhooks');
  assert.equal((await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, p.userId))).length, 0, 'Supporter rows');

  // The clan's records stay, and stop pointing at the person.
  const [kept] = await db.select().from(s.accounts).where(eq(s.accounts.id, p.seated));
  assert.ok(kept, 'the seated character stays as a name');
  assert.equal(kept.rsn, 'ZezimaMain');
  assert.notEqual(kept.playerId, p.playerId);
  assert.equal(kept.claimedAt, null);
  assert.equal(kept.verifiedAt, null);
  assert.equal(kept.accountHash, null);
  assert.equal(kept.discordId, null);
  assert.equal(kept.supporterStyle, null);
  assert.equal(kept.isPrimary, 0);
  const [placeholder] = await db.select().from(s.players).where(eq(s.players.id, kept.playerId));
  assert.equal(placeholder.displayName, 'ZezimaMain', 'held by a stand-in named after the RSN, as a released character is');
  assert.equal((await db.select().from(s.users).where(eq(s.users.playerId, kept.playerId))).length, 0, 'which nobody signs in as');

  assert.equal((await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.id, p.seatId))).length, 1, 'the seat');
  const [entry] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, p.entryId));
  assert.equal(entry.name, 'ZezimaMain');
  assert.equal(entry.accountId, p.seated);
  assert.equal(entry.discord, null);
  assert.equal(entry.timezone, null);
  assert.equal(entry.playerToken, null);
  const [submission] = await db.select().from(s.submissions).where(eq(s.submissions.id, p.submissionId));
  assert.ok(submission?.imageUrl, 'the proof stays as the clan’s evidence');
  const [signup] = await db.select().from(s.eventSignups).where(eq(s.eventSignups.id, p.signupId));
  assert.equal(signup.userId, null);
  assert.equal(signup.profileData, '{}');

  // The ban still in force survives on a stand-in that holds the Discord id and nothing else.
  const [ban] = await db.select().from(s.clanBans).where(eq(s.clanBans.id, liveBan.id));
  assert.ok(ban, 'the live ban');
  assert.equal(ban.liftedAt, null);
  assert.equal(ban.reason, null);
  assert.equal(ban.accountId, null);
  const standIns = await db.select().from(s.users).where(eq(s.users.discordId, DISCORD_ID));
  assert.equal(standIns.length, 1);
  const standIn = standIns[0];
  assert.equal(standIn.playerId, ban.playerId, 'signing in with that Discord account lands on the banned person');
  assert.equal(standIn.displayName, '');
  assert.equal(standIn.email, null);
  assert.equal(standIn.discordUsername, null);
  assert.equal(standIn.discordAvatar, null);
  assert.equal(standIn.pluginTokenHash, null);
  const [standInPerson] = await db.select().from(s.players).where(eq(s.players.id, ban.playerId));
  assert.equal(standInPerson.displayName, null);
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.playerId, ban.playerId))).length, 0, 'with no characters');
  assert.equal((await db.select().from(s.clanBans).where(eq(s.clanBans.clanId, clanId))).length, 0, 'a lifted ban is not kept');

  // One audit entry, and nothing in the log that says who.
  const log = await db.select().from(s.clanAuditLog);
  const deleted = log.filter((l) => l.eventType === 'platform_account_deleted');
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].actorUserId, null);
  assert.equal(deleted[0].clanId, null);
  for (const l of log) {
    const text = `${l.oldValue ?? ''}${l.newValue ?? ''}${l.notes ?? ''}`;
    assert.ok(!text.includes(DISCORD_ID), 'no log row carries the Discord id');
    assert.ok(!text.includes('Zezima@example.test'));
  }

  // Nobody else was touched.
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, bystander.userId))).length, 1);
  assert.equal((await db.select().from(s.accounts).where(inArray(s.accounts.id, [bystander.seated, bystander.loose]))).length, 2);
  const [theirs] = await db.select().from(s.accounts).where(eq(s.accounts.id, bystander.seated));
  assert.equal(theirs.playerId, bystander.playerId);
  assert.equal(theirs.discordId, '998877665544332211');
  assert.equal((await db.select().from(s.pluginLinks).where(eq(s.pluginLinks.userId, bystander.userId))).length, 1);
  assert.equal((await db.select().from(s.playerGoals).where(eq(s.playerGoals.accountId, bystander.seated))).length, 1);
  assert.equal((await db.select().from(s.clanStaff).where(eq(s.clanStaff.userId, bystander.userId))).length, 1);

  // Twice is the same as once.
  const again = await erasePerson({ userId: p.userId });
  assert.deepEqual(again, { ok: true, alreadyGone: true });
  assert.equal((await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'platform_account_deleted'))).length, 1);
});

test('an owner cannot delete until the clan is handed over, and nothing is touched', async () => {
  const playerId = await person('Owner');
  const userId = await login(playerId, 'Owner', { discordId: '111111111111111111' });
  const [mine] = await db.insert(s.clans).values({ slug: 'owned', name: 'Owned Clan' }).returning();
  await db.insert(s.clanStaff).values({ clanId: mine.id, userId, role: 'owner' });

  const r = await erasePerson({ userId });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(r.blockers.map((b) => b.kind), ['owns-clan']);
    assert.match(r.blockers[0].message, /Owned Clan/);
  }
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, userId))).length, 1);
  assert.equal((await db.select().from(s.clanStaff).where(eq(s.clanStaff.userId, userId))).length, 1);

  // Handed over (an ordinary admin now): it goes through.
  await db.update(s.clanStaff).set({ role: 'admin' }).where(eq(s.clanStaff.userId, userId));
  const ok = await erasePerson({ userId });
  assert.ok(ok.ok && !ok.alreadyGone);
  assert.equal((await db.select().from(s.clans).where(eq(s.clans.id, mine.id))).length, 1, 'the clan is not the person’s to take with them');
});

test('a paid plan that still renews blocks; once the site sees it cancelled, it does not', async () => {
  const playerId = await person('Payer');
  const userId = await login(playerId, 'Payer', { discordId: '222222222222222222' });
  const [sub] = await db
    .insert(s.supporterSubscriptions)
    .values({ userId, tier: 'supporter', status: 'active', startedAt: '2026-01-01 00:00:00', gumroadSubscriptionId: 'sub-live' })
    .returning();

  const r = await erasePerson({ userId });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.blockers.map((b) => b.kind), ['active-plan']);
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, userId))).length, 1);

  await db.update(s.supporterSubscriptions).set({ status: 'cancelling' }).where(eq(s.supporterSubscriptions.id, sub.id));
  const ok = await erasePerson({ userId });
  assert.ok(ok.ok && !ok.alreadyGone);
  assert.equal(ok.summary.banRecordKept, false);
  assert.equal((await db.select().from(s.users).where(eq(s.users.discordId, '222222222222222222'))).length, 0, 'no ban, so no stand-in');
});

test('the export holds their own rows, as links and dates, and never a token or anyone else', async () => {
  const p = await plantPerson('Exporter', '333333333333333333');
  const other = await plantPerson('Stranger', '444444444444444444');

  const out = await exportPerson(p.userId);
  assert.ok(out);
  const text = JSON.stringify(out);

  assert.equal(out.data.account?.[0]?.email, 'Exporter@example.test');
  assert.equal(out.data.account?.[0]?.discord_id, '333333333333333333');
  assert.deepEqual(out.data.characters?.map((c) => c.rsn).sort(), ['ExporterAlt', 'ExporterMain']);
  assert.equal(out.data.clan_memberships?.length, 1);
  assert.equal(out.data.roles?.[0]?.role, 'admin');
  assert.equal(out.data.event_entries?.[0]?.name, 'ExporterMain');
  assert.match(String(out.data.proofs_submitted?.[0]?.image_url), /^https:\/\//);
  assert.equal(out.data.goals?.length, 1);
  assert.equal(out.data.supporter?.[0]?.tier, 'supporter');
  assert.deepEqual(Object.keys(out.data.plugin_sign_ins?.[0] ?? {}).sort(), ['_from', 'created_at', 'id', 'last_used_at', 'revoked_at']);

  // Never a secret.
  for (const secret of ['hash-Exporter', 'link-Exporter', 'acct-Exporter', 'pt-Exporter', 'discord.example.test/webhooks']) {
    assert.ok(!text.includes(secret), `${secret} must not be in the export`);
  }
  // Never somebody else.
  for (const theirs of ['Stranger', '444444444444444444']) assert.ok(!text.includes(theirs), `${theirs} must not be in the export`);
  assert.equal(await exportPerson(other.userId + 100_000), null);
});
