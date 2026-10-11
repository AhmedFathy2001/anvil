// "Not my account" — shared PCs, siblings and visitors.
//
// The Account Token names whoever set this RuneLite up, not whoever is playing. So the plugin links
// what it plays by default, and the sidebar offers a way out on the character itself. These pin:
//   - brand-new characters link PROVISIONALLY (reversible, on the review queue);
//   - release detaches, really unclaims (the old Remove left the placeholder "owning" it), and the
//     same token never re-links it — by hash or by name;
//   - a released character can move: the real owner's plugin claims it;
//   - a live event blocks the detach but still records the choice;
//   - somebody else's character played here is recorded (throttled), reported as 'other', and
//     disputable as a wrong-owner report;
//   - resume undoes release.
//
// Run: npx tsx --test tests/plugin-account-optout.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-account-optout');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let route: typeof import('../src/app/api/plugin/account/route.ts');
let clanId: number;
let n = 0;

/** A Discord login with a plugin token. */
async function login() {
  n++;
  const token = `tok-${n}`;
  const [person] = await db.insert(s.players).values({ displayName: `discord-${n}` }).returning();
  const [user] = await db
    .insert(s.users)
    .values({ displayName: `discord-${n}`, discordId: `d-${n}`, pluginToken: token, playerId: person.id })
    .returning();
  return { token, person: person.id, userId: user.id };
}

function headers(token: string, rsn: string, hash: string | null): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-RSN': rsn, 'x-anvil-clan-slug': 'afk' };
  if (hash) h['X-Account-Hash'] = hash;
  return h;
}

function play(token: string, rsn: string, hash: string | null) {
  return A.resolvePluginMember(new Request('https://example.test/api/plugin/config', { headers: headers(token, rsn, hash) }));
}

async function act(token: string, rsn: string, hash: string | null, action: string) {
  const res = await route.POST(
    new Request('https://example.test/api/plugin/account', {
      method: 'POST',
      headers: { ...headers(token, rsn, hash), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

async function standing(token: string, rsn: string, hash: string | null) {
  const res = await route.GET(new Request('https://example.test/api/plugin/account', { headers: headers(token, rsn, hash) }));
  return (await res.json()).standing as string;
}

const accountByRsn = async (rsn: string) =>
  (await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, rsn.toLowerCase())))[0];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  route = await import('../src/app/api/plugin/account/route.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot', inGameName: 'AFK' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a brand-new character links to the token, provisionally', async () => {
  const me = await login();
  const resolved = await play(me.token, 'Fresh Alt', 'h-fresh');
  assert.ok(resolved, 'tracks straight away — the easy path is unchanged');
  const acct = await accountByRsn('Fresh Alt');
  assert.equal(acct.playerId, me.person);
  assert.equal(acct.provisional, 1, 'reversible, on the review queue');
  assert.equal(acct.verificationMethod, 'plugin_first_use');
  assert.equal(await standing(me.token, 'Fresh Alt', 'h-fresh'), 'yours');
});

test('Not my account: unlinks, unclaims, and the same token never re-links it', async () => {
  const brother = await login();
  await play(brother.token, 'Sibling Main', 'h-sib');
  assert.equal((await accountByRsn('Sibling Main')).playerId, brother.person);

  const r = await act(brother.token, 'Sibling Main', 'h-sib', 'release');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.standing, 'ignored');

  const acct = await accountByRsn('Sibling Main');
  assert.notEqual(acct.playerId, brother.person);
  assert.equal(acct.claimedAt, null, 'really unclaimed — not "owned" by a placeholder');
  assert.equal(acct.accountHash, 'h-sib', 'the character keeps its own hash');

  // The plugin stops sending, but even if it didn't (old build, another PC), nothing re-links it.
  assert.equal(await play(brother.token, 'Sibling Main', 'h-sib'), null);
  assert.equal((await accountByRsn('Sibling Main')).claimedAt, null, 'neither the hash path nor auto-link');
});

test('a released character can move: the real owner’s plugin claims it', async () => {
  const brother = await login();
  const sister = await login();
  await play(brother.token, 'Moves Over', 'h-move');
  await act(brother.token, 'Moves Over', 'h-move', 'release');

  const resolved = await play(sister.token, 'Moves Over', 'h-move');
  assert.ok(resolved, 'tracks for her at once');
  assert.equal((await accountByRsn('Moves Over')).playerId, sister.person);
});

test('the profile Remove is the same flow — the character is claimable afterwards', async () => {
  const me = await login();
  const other = await login();
  await play(me.token, 'Removed On Site', 'h-site');
  const { releaseCharacter } = await import('../src/lib/accountRelease.ts');
  const acct = await accountByRsn('Removed On Site');
  const out = await releaseCharacter({ userId: me.userId, playerId: me.person, accountId: acct.id, via: 'profile' });
  assert.deepEqual(out, { ok: true });
  assert.ok(await play(other.token, 'Removed On Site', 'h-site'), 'before the fix this was owned-by-other forever');
});

test('a live event blocks the detach but still records the choice', async () => {
  const me = await login();
  await play(me.token, 'In A Bingo', 'h-bingo');
  const acct = await accountByRsn('In A Bingo');
  const [seat] = await db
    .select()
    .from(s.clanMemberships)
    .where(and(eq(s.clanMemberships.clanId, clanId), eq(s.clanMemberships.accountId, acct.id)));
  const [event] = await db
    .insert(s.events)
    .values({ clanId, name: 'Live', boardSize: 25, startDate: new Date(Date.now() - 86_400_000).toISOString(), endDate: new Date(Date.now() + 86_400_000).toISOString() })
    .returning();
  await db.insert(s.eventParticipants).values({ eventId: event.id, clanMemberId: seat.id, accountId: acct.id, name: 'In A Bingo' });

  const r = await act(me.token, 'In A Bingo', 'h-bingo', 'release');
  assert.equal(r.status, 409);
  assert.equal(r.body.reason, 'live-event');
  assert.equal((await accountByRsn('In A Bingo')).playerId, me.person, 'still linked until the event ends');
  const marker = await db.query.detectedAccounts.findFirst({
    where: and(eq(s.detectedAccounts.userId, me.userId), eq(s.detectedAccounts.rsnNormalized, 'in a bingo')),
  });
  assert.equal(marker?.status, 'dismissed');
});

test('somebody else’s character played here: recorded once, shown as other, disputable', async () => {
  const owner = await login();
  const visitor = await login();
  await play(owner.token, 'Owned Elsewhere', 'h-owned');

  assert.equal(await play(visitor.token, 'Owned Elsewhere', 'h-owned'), null, 'never moves ownership');
  await play(visitor.token, 'Owned Elsewhere', 'h-owned');
  const acct = await accountByRsn('Owned Elsewhere');
  assert.equal(acct.playerId, owner.person);

  const rows = await db.select().from(s.accountSightings).where(eq(s.accountSightings.accountId, acct.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, visitor.userId);
  assert.equal(rows[0].hashMatched, 1);
  assert.equal(rows[0].firstSeenAt, rows[0].lastSeenAt, 'a second play within the window wrote nothing');

  assert.equal(await standing(visitor.token, 'Owned Elsewhere', 'h-owned'), 'other');

  const { alsoPlayedFromByAccount } = await import('../src/lib/accountSightings.ts');
  const shown = await alsoPlayedFromByAccount([acct.id], owner.userId);
  assert.equal(shown.get(acct.id)?.length, 1, 'the owner’s profile can say so');

  const d = await act(visitor.token, 'Owned Elsewhere', 'h-owned', 'dispute');
  assert.equal(d.status, 200, JSON.stringify(d.body));
  const again = await act(visitor.token, 'Owned Elsewhere', 'h-owned', 'dispute');
  assert.equal(again.body.alreadyOpen, true, 'one report, not one per click');
  const reports = await db.select().from(s.characterReports).where(eq(s.characterReports.accountId, acct.id));
  assert.equal(reports.length, 1);
  assert.equal(reports[0].kind, 'wrong_owner');
  assert.equal(reports[0].claimantPlayerId, visitor.person);
  assert.match(reports[0].body ?? '', /hash matched/);
  assert.doesNotMatch(reports[0].body ?? '', /h-owned/, 'the hash itself never lands in a report');

  const own = await act(owner.token, 'Owned Elsewhere', 'h-owned', 'dispute');
  assert.equal(own.status, 409, 'nothing to dispute on your own character');
});

test('Not my account on somebody else’s character only stops this token linking it', async () => {
  const owner = await login();
  const visitor = await login();
  await play(owner.token, 'Visitor Seen', 'h-vs');
  const r = await act(visitor.token, 'Visitor Seen', 'h-vs', 'release');
  assert.equal(r.status, 200);
  assert.equal((await accountByRsn('Visitor Seen')).playerId, owner.person, 'the owner keeps it');
});

test('resume undoes release: the next play links it again', async () => {
  const me = await login();
  await play(me.token, 'Changed Mind', 'h-cm');
  await act(me.token, 'Changed Mind', 'h-cm', 'release');
  const r = await act(me.token, 'Changed Mind', 'h-cm', 'resume');
  assert.equal(r.status, 200);
  assert.equal(r.body.standing, 'unclaimed');
  assert.ok(await play(me.token, 'Changed Mind', 'h-cm'));
  assert.equal((await accountByRsn('Changed Mind')).playerId, me.person);
});

test('the account route needs a logged-in character and never links one itself', async () => {
  const me = await login();
  const noRsn = await route.POST(
    new Request('https://example.test/api/plugin/account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${me.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release' }),
    }),
  );
  assert.equal(noRsn.status, 400);
  assert.equal(await standing(me.token, 'Never Played', 'h-np'), 'unclaimed');
  assert.equal(await accountByRsn('Never Played'), undefined, 'a GET created nothing');
});
