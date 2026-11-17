// What a member's data looks like by the time it leaves the server — to their own clan's staff, to
// another clan, and to the public.
//
// The owner's rule: protect members' data "even from their own admins". Staff see what they need to
// run the clan and its events; evidence of cheating in the clan's OWN events stays visible to that
// event's staff; everything else is trimmed. Every rule below failed silently before it was written
// down, because a response that carries too much looks exactly like one that does not.
//
// All pure: no database. Run: npm run test:memberprivacy

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { boardPlayer, clientEvent, playerSubmission, spectatorPlayer, staffPlayer } from '../src/lib/clientRows.ts';
import { handleFor, isWholeEmail, maskEmail, operatorEmail, peopleListIdentity, seesDiscordHandle, seesFeeLedger, teamChatStaffListeners } from '../src/lib/staffSight.ts';
import { auditValuesForClient } from '../src/lib/auditView.ts';
import { hiddenNameSet, personaCharacterVisible, withoutHiddenKeys, withoutHiddenNames, withoutHiddenRows } from '../src/lib/rosterVisibility.ts';
import { cofferName, donorBoard } from '../src/lib/cofferView.ts';
import { helloListsActivity } from '../src/lib/pluginHelloRules.ts';
import { historyEventShown, historyRowIsThisSeats, nicknameNamesFor } from '../src/lib/clanScopeRules.ts';

const src = (path: string) => readFileSync(join(import.meta.dirname, '..', 'src', path), 'utf8');

// A participant row as the database returns it: every column, including the ones no screen draws.
const participant = {
  id: 7,
  eventId: 3,
  clanMemberId: 41,
  accountId: 900,
  name: 'Drenvox',
  discord: 'drenvox#0001',
  timezone: 'Europe/Amsterdam',
  teamId: 2,
  pickNumber: 4,
  pickedAt: '2026-11-01 10:00:00',
  statsSnapshot: '{"overall":1}',
  snapshotAt: '2026-11-01 09:00:00',
  playerToken: 'SECRET-LOGIN-TOKEN',
  cachedStats: '{"overall":2}',
  lastStatsFetch: '2026-11-02 09:00:00',
  pluginStats: '{"zulrah":1250}',
  frozenAt: null,
  frozenStats: null,
  modeStats: null,
  pbBaseline: null,
  deaths: 12,
  lootGpGained: 1_250_000_000,
  pvpKills: 0,
  biggestHit: 73,
  minutesPlayed: 900,
  caTasks: 2,
  ownTeamChatOnly: false,
};

// ── A. Rows are picked, never spread ─────────────────────────────────────────────────────────────

test('a participant reaches a board or team screen without token, contact or private counters', () => {
  const out = boardPlayer(participant) as Record<string, unknown>;
  assert.deepEqual(Object.keys(out).sort(), [
    'cachedStats', 'clanMemberId', 'eventId', 'frozenAt', 'id', 'lastStatsFetch', 'name', 'pickNumber', 'pickedAt', 'snapshotAt', 'statsSnapshot', 'teamId',
  ]);
  const json = JSON.stringify(out);
  assert.doesNotMatch(json, /SECRET-LOGIN-TOKEN/);
  assert.doesNotMatch(json, /drenvox#0001|Europe\/Amsterdam/);
  for (const gone of ['playerToken', 'accountId', 'pluginStats', 'deaths', 'lootGpGained', 'minutesPlayed', 'discord', 'timezone']) {
    assert.equal(gone in out, false, `${gone} must not be serialised`);
  }
});

test('the stats page payload has no playerToken', () => {
  // The admin stats page maps every participant through boardPlayer and the event through clientEvent.
  const page = src('app/admin/events/[eventId]/stats/page.tsx');
  assert.match(page, /players=\{eventPlayers\.map\(boardPlayer\)\}/);
  assert.match(page, /event=\{clientEvent\(event\)\}/);
  assert.equal('playerToken' in boardPlayer(participant), false);
});

test('the read-time joins ride along only when the caller attached them', () => {
  assert.equal('ownerUserId' in boardPlayer(participant), false);
  const joined = boardPlayer({ ...participant, ownerUserId: 5, profile: { timezone: 'UTC' } });
  assert.equal(joined.ownerUserId, 5);
  assert.deepEqual(joined.profile, { timezone: 'UTC' });
});

test('the event staff draft screens keep the handle and timezone they edit, still no token', () => {
  const out = staffPlayer(participant) as Record<string, unknown>;
  assert.equal(out.discord, 'drenvox#0001');
  assert.equal(out.timezone, 'Europe/Amsterdam');
  assert.equal('playerToken' in out, false);
  assert.equal('lootGpGained' in out, false);
});

test('a draft spectator gets name, team and pick: no stat caches, seat id or contact', () => {
  const out = spectatorPlayer({ ...participant, ownerUserId: -1 }) as Record<string, unknown>;
  assert.equal(out.name, 'Drenvox');
  assert.equal(out.teamId, 2);
  assert.equal(out.ownerUserId, -1);
  assert.equal(out.discord, null);
  assert.equal(out.timezone, null);
  for (const gone of ['statsSnapshot', 'cachedStats', 'clanMemberId', 'accountId', 'playerToken', 'deaths']) {
    assert.equal(gone in out, false, `${gone} must not reach a spectator`);
  }
});

test('no page hands a whole participant row or a raw event to a client component', () => {
  for (const page of [
    'app/team/[teamId]/page.tsx',
    'app/captain/[teamId]/page.tsx',
    'app/events/[eventId]/teams/[teamId]/page.tsx',
    'app/admin/events/[eventId]/teams/page.tsx',
    'app/admin/events/[eventId]/teams/[teamId]/page.tsx',
    'app/admin/events/[eventId]/stats/page.tsx',
  ]) {
    const text = src(page);
    assert.doesNotMatch(text, /players=\{eventPlayers\}/, `${page} serialises raw participant rows`);
    assert.doesNotMatch(text, /event=\{event\}/, `${page} serialises the raw event row`);
  }
});

test('the friends-invite secret is blanked on an event sent to the browser', () => {
  const event = { id: 1, name: 'Friday bingo', inviteToken: 'INVITE-SECRET' };
  const out = clientEvent(event);
  assert.equal(out.inviteToken, null);
  assert.equal(out.name, 'Friday bingo');
  assert.equal(event.inviteToken, 'INVITE-SECRET', 'the server copy is untouched');
});

test('a non-staff reader of submissions loses the raw evidence columns and keeps the flag', () => {
  const row = { id: 1, tileId: 2, amount: 1, note: 'gz', flaggedReason: 'no_start_proof', footprint: 'ok', proofFacts: '{"world":302,"x":3200}', imageSha256: 'abc', coopGroup: 'k1' };
  const out = playerSubmission(row) as Record<string, unknown>;
  for (const gone of ['proofFacts', 'imageSha256', 'coopGroup']) assert.equal(gone in out, false);
  // The integrity flag and verdict are shown on the board on purpose ("counts · staff checking").
  assert.equal(out.flaggedReason, 'no_start_proof');
  assert.equal(out.footprint, 'ok');
  // …and the event's own staff get the row whole: the route only strips for non-staff.
  assert.match(src('app/api/events/[eventId]/submissions/route.ts'), /eventStaff \? publicSubmission\(s\) : playerSubmission\(publicSubmission\(s\)\)/);
});

test('the clan audit page sends only what the list draws out of a stored value', () => {
  // An applied character report keeps its undo snapshot in old_value.
  const snapshot = JSON.stringify({ v: 1, type: 'owner', accountId: 9, before: { playerId: 77, accountHash: '-123456789', verifiedByUserId: 4 }, formerLogin: { userId: 12 } });
  const applied = auditValuesForClient({ eventType: 'character_report_applied', oldValue: snapshot, newValue: JSON.stringify({ reportId: 5 }) });
  assert.deepEqual(applied, { oldValue: null, newValue: null });

  const renamed = auditValuesForClient({ eventType: 'renamed', oldValue: JSON.stringify({ rsn: 'Old Name', playerId: 3 }), newValue: JSON.stringify({ rsn: 'New Name' }) });
  assert.deepEqual(renamed, { oldValue: '{"rsn":"Old Name"}', newValue: '{"rsn":"New Name"}' });

  // An old first-login row still holds the Discord id and username: neither is sent.
  const login = auditValuesForClient({
    eventType: 'user_signed_up',
    oldValue: null,
    newValue: JSON.stringify({ userId: 5, discordId: '123456789012345678', discordUsername: 'someone_on_discord', role: 'member' }),
    actorDisplayName: 'Someone',
  });
  assert.doesNotMatch(JSON.stringify(login), /123456789012345678|someone_on_discord/);
  assert.equal(login.newValue, '{"rsn":"Someone"}');

  assert.deepEqual(auditValuesForClient({ eventType: 'left', oldValue: 'not json', newValue: null }), { oldValue: null, newValue: null });
});

test('a first login is no longer written with a Discord id or username', () => {
  const login = src('lib/discord-login.ts');
  const at = login.indexOf("eventType: 'user_signed_up'");
  const block = login.slice(at, at + 600);
  assert.doesNotMatch(block, /discordId: user|discordUsername: user/);
});

// ── D. Staff tiers ───────────────────────────────────────────────────────────────────────────────

test('Discord handles are for admins and the owner, not the moderator tier', () => {
  for (const role of ['admin', 'owner']) assert.equal(seesDiscordHandle(role), true, role);
  for (const role of ['moderator', 'treasurer', 'editor', 'member', null, undefined]) assert.equal(seesDiscordHandle(role), false, String(role));
  assert.equal(handleFor('admin', 'drenvox'), 'drenvox');
  assert.equal(handleFor('moderator', 'drenvox'), null);
  assert.equal(handleFor(undefined, 'drenvox'), null, 'a co-host’s staff carry no role here');
});

test('the fee ledger is for the people who collect: treasurer, admin, owner', () => {
  for (const role of ['treasurer', 'admin', 'owner']) assert.equal(seesFeeLedger(role), true, role);
  for (const role of ['moderator', 'editor', 'member', null]) assert.equal(seesFeeLedger(role), false, String(role));
  // The route uses the same gate as the page.
  assert.match(src('app/api/admin/fees/route.ts'), /await verifyFeeCollector\(\)/);
  assert.doesNotMatch(src('app/api/admin/fees/route.ts'), /verifyAdminOrModerator/);
});

test('the people list never carries a Discord id; a plain member has no avatar or last sign-in on it', () => {
  const url = (id: string, hash: string | null) => (hash ? `https://cdn.example/${id}/${hash}.png` : null);
  const member = peopleListIdentity({ role: 'member', discordId: '111', discordAvatar: 'abc', lastLoginAt: '2026-11-10 08:00:00' }, url);
  assert.deepEqual(member, { hasDiscord: true, avatarUrl: null, lastLoginAt: null });
  const mod = peopleListIdentity({ role: 'moderator', discordId: '222', discordAvatar: 'def', lastLoginAt: '2026-11-11 08:00:00' }, url);
  assert.equal(mod.avatarUrl, 'https://cdn.example/222/def.png');
  assert.equal(mod.lastLoginAt, '2026-11-11 08:00:00');
  assert.deepEqual(peopleListIdentity({ role: null, discordId: null, discordAvatar: null, lastLoginAt: null }, url), { hasDiscord: false, avatarUrl: null, lastLoginAt: null });
  // …and a seat that has left is no presence on that list.
  assert.match(src('lib/identity.ts'), /clanSeat\(\),\s*isNull\(clanMemberships\.leftAt\)/);
});

test('a team’s private chat is pushed live to the board’s staff, not every moderator of the clan', () => {
  const staff = [
    { userId: 1, role: 'owner' },
    { userId: 2, role: 'admin' },
    { userId: 3, role: 'moderator' }, // no job on this board
    { userId: 4, role: 'moderator' }, // holds a grant on it
    { userId: 5, role: 'treasurer' },
    { userId: 6, role: 'member' }, // a grant alone, with no staff tier, is not a chat job
  ];
  assert.deepEqual(teamChatStaffListeners(staff, [4, 6]), [1, 2, 4]);
  assert.deepEqual(teamChatStaffListeners(staff, []), [1, 2]);
  // The read rule is untouched: moderation of 'all' and 'announce', and opening a channel, still work.
  assert.match(src('lib/eventChat.ts'), /eventTeamChatStaffUserIds\(eventId\), ownTeamOnlyUserIds\(eventId\)/);
});

// ── C. Public pages obey the member's own switch ─────────────────────────────────────────────────

const hidden = hiddenNameSet(['Quiet Alt', 'iron_secret']);

test('a hidden character is dropped from name-bearing rows whatever its spelling', () => {
  const rows = [{ rsn: 'Drenvox', xp: 1 }, { rsn: 'quiet alt', xp: 2 }, { rsn: 'Iron Secret', xp: 3 }, { rsn: 'Iron-Secret', xp: 4 }];
  assert.deepEqual(withoutHiddenRows(rows, hidden).map((r) => r.rsn), ['Drenvox']);
  assert.equal(withoutHiddenRows(rows, new Set()), rows, 'an insider (nothing hidden) gets the list untouched');
  assert.deepEqual(withoutHiddenKeys({ Drenvox: 3, 'Quiet Alt': 9 }, hidden), { Drenvox: 3 });
});

test('nested leaderboards lose the hidden names and keep their totals', () => {
  const analytics = {
    memberCount: 3,
    totalEhp: 1200.5,
    topWeek: [{ rsn: 'Quiet Alt', hours: 40 }, { rsn: 'Drenvox', hours: 12 }],
    boards: [{ key: 'clues', rows: [{ rsn: 'Iron Secret', value: 9 }, { rsn: 'Drenvox', value: 4 }] }],
    titles: [{ key: 'caskets', title: 'Casket fiend', rsn: 'Quiet Alt' }],
    activity: [{ day: '2026-11-01', value: 8 }],
  };
  const out = withoutHiddenNames(analytics, hidden);
  assert.equal(out.memberCount, 3);
  assert.equal(out.totalEhp, 1200.5);
  assert.deepEqual(out.topWeek, [{ rsn: 'Drenvox', hours: 12 }]);
  assert.deepEqual(out.boards[0].rows, [{ rsn: 'Drenvox', value: 4 }]);
  assert.deepEqual(out.titles, []);
  assert.deepEqual(out.activity, analytics.activity);
  assert.doesNotMatch(JSON.stringify(out), /Quiet Alt|Iron Secret/);
});

test('the persona lists a seated-but-unshared character to clanmates only', () => {
  const seatedUnshared = { seatedHere: true, shared: false, linkable: true };
  assert.equal(personaCharacterVisible({ insider: true, ...seatedUnshared }), true);
  assert.equal(personaCharacterVisible({ insider: false, ...seatedUnshared }), false);
  // Published AND linked: anyone.
  assert.equal(personaCharacterVisible({ insider: false, seatedHere: false, shared: true, linkable: true }), true);
  // Published but the person never agreed to link their characters: an outsider gets nothing…
  assert.equal(personaCharacterVisible({ insider: false, seatedHere: true, shared: true, linkable: false }), false);
  // …and a clanmate still sees what the clan holds a seat for, and no more.
  assert.equal(personaCharacterVisible({ insider: true, seatedHere: true, shared: true, linkable: false }), true);
  assert.equal(personaCharacterVisible({ insider: true, seatedHere: false, shared: true, linkable: false }), false);
});

test('the persona payload has no Discord id field', () => {
  const lib = src('lib/memberProfile.ts');
  const at = lib.indexOf('export interface Persona {');
  assert.doesNotMatch(lib.slice(at, at + 400), /discordId|userId|discordAvatar/);
  assert.doesNotMatch(src('app/members/[rsn]/Persona.tsx'), /cdn\.discordapp\.com|discordId/);
});

test('coffer amounts are public; who gave is for people inside the clan', () => {
  const donors = [{ rsn: 'Drenvox', total: 5_000_000 }, { rsn: 'Quiet Alt', total: 1_000_000 }];
  assert.deepEqual(donorBoard(donors, true), donors);
  assert.deepEqual(donorBoard(donors, false), [{ rsn: null, total: 5_000_000 }, { rsn: null, total: 1_000_000 }]);
  assert.equal(cofferName('Drenvox', true), 'Drenvox');
  assert.equal(cofferName('Drenvox', false), 'a member');
  assert.equal(cofferName(null, false), null, 'a line with no name (the clan itself) stays unnamed');
});

test('the plugin greeting lists what is running to an anonymous caller only for a public clan', () => {
  assert.equal(helloListsActivity(false, 'public'), true);
  assert.equal(helloListsActivity(false, 'members'), false);
  assert.equal(helloListsActivity(false, null), false, 'anything but exactly public is closed');
  assert.equal(helloListsActivity(true, 'members'), true);
});

// ── B. One clan's view is that clan's own data ───────────────────────────────────────────────────

test('competition history: the seat’s own rows anywhere, a name match only in this clan’s events', () => {
  const seat = { id: 41, clanId: 1 };
  assert.equal(historyRowIsThisSeats({ seatId: 41, nameMatchesAlias: false, eventClanId: 2 }, seat), true, 'co-hosted board, own seat');
  assert.equal(historyRowIsThisSeats({ seatId: null, nameMatchesAlias: true, eventClanId: 1 }, seat), true, 'old name, own clan’s event');
  assert.equal(historyRowIsThisSeats({ seatId: 99, nameMatchesAlias: true, eventClanId: 2 }, seat), false, 'same name in another clan’s event');
  assert.equal(historyRowIsThisSeats({ seatId: null, nameMatchesAlias: true, eventClanId: 2 }, seat), false);
  assert.equal(historyRowIsThisSeats({ seatId: null, nameMatchesAlias: true, eventClanId: 1 }, { id: 41, clanId: null }), false);
  assert.equal(historyEventShown('invited', false), false);
  assert.equal(historyEventShown('invited', true), true);
  assert.equal(historyEventShown('clan', false), true);
});

test('staff ratings read this clan’s events only', () => {
  const lib = src('lib/playerProfile.ts');
  assert.match(lib, /from\(events\)\.where\(eq\(events\.clanId, clanId\)\)/);
  assert.doesNotMatch(lib, /db\.select\(\)\.from\(playerEventFacts\);/);
  assert.match(lib, /inArray\(playerEventFacts\.eventId, clanEventIds\)/);
});

test('a Discord nickname names only the characters seated in that clan', () => {
  const chars = [{ rsn: 'Drenvox', clanId: 1 }, { rsn: 'Quiet Alt', clanId: 2 }, { rsn: 'Drenvox Iron', clanId: 1 }];
  assert.deepEqual(nicknameNamesFor(chars, 1), ['Drenvox', 'Drenvox Iron']);
  const lib = src('lib/discord-roles.ts');
  const at = lib.indexOf('// Nickname sync');
  assert.match(lib.slice(at, at + 1800), /eq\(clanRoster\.clanId, member\.clanId\)/);
});

test('a join request says "another clan", never which', () => {
  const lib = src('lib/guestAdmission.ts');
  assert.match(lib, /memberOfAnotherClan: member != null/);
  assert.doesNotMatch(lib, /memberOf: member\?\.name/);
  assert.doesNotMatch(src('app/admin/people/JoinRequests.tsx'), /member of \{/);
});

test('player search names a clan only when it is public', () => {
  assert.match(src('app/api/players/search/route.ts'), /eq\(clans\.visibility, 'public'\)/);
});

// ── E. Platform side ─────────────────────────────────────────────────────────────────────────────

test('an owner’s email is whole for the top platform role and masked for every other operator', () => {
  assert.equal(operatorEmail('root', 'jane.doe@gmail.com'), 'jane.doe@gmail.com');
  for (const role of ['staff', 'support', 'none', null]) assert.equal(operatorEmail(role, 'jane.doe@gmail.com'), 'j•••@gmail.com', String(role));
  assert.equal(operatorEmail('support', null), null);
  assert.equal(maskEmail('  x@y.io '), 'x•••@y.io');
  assert.equal(maskEmail('not-an-email'), '•••');
  assert.equal(isWholeEmail('jane.doe@gmail.com'), true);
  assert.equal(isWholeEmail('j•••@gmail.com'), false);
});
